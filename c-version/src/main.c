#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "common.h"
#include "hash.h"
#include "merkle.h"
#include "avl.h"
#include "trie.h"
#include "heap.h"
#include "knapsack.h"

/* ---------------- global-ish state for this demo program ---------------- */
static Ledger ledger;
static HashTable seen;
static AVLNode *registry = NULL;       /* user/department registry */
static TrieNode *catalog = NULL;       /* known actions -> CO2 factor */
static unsigned long trusted_root = 0;
static MerkleNode *trusted_snapshot = NULL;

/* Snapshot of record *values* as of the last verified/committed state,
   kept alongside trusted_snapshot's hash tree. When verify() finds a
   tampered leaf, we use this to report exactly what changed (old CO2
   vs new CO2) instead of just "record N is bad". */
static Record trusted_records[MAX_RECORDS];
static int trusted_record_count = 0;

#define SAVE_FILE "carbonledger.dat"

/* sample green-fund projects for the budget allocator */
static Project projects[] = {
    {"Solar panels - Block A",      200, 850.0},
    {"Tree plantation drive",        40, 120.0},
    {"LED retrofit - hostels",       60, 300.0},
    {"Rainwater harvesting",        150, 180.0},
    {"EV charging station",         180, 400.0},
    {"Compost/biogas unit",          90, 260.0},
};
static const int NUM_PROJECTS = sizeof(projects) / sizeof(projects[0]);

/* ---------------- small input-validation helpers ---------------- */

/* Discards everything up to and including the next newline (or EOF).
   Called after every scanf so a bad/partial token never leaks into
   the next read. Returns 1 if any non-whitespace character was
   discarded (a sign the user typed more than one token), else 0. */
static int flush_input_line(void) {
    int c;
    int had_extra = 0;
    while ((c = getchar()) != '\n' && c != EOF) {
        if (c != ' ' && c != '\t' && c != '\r') had_extra = 1;
    }
    return had_extra;
}

/* Reads one int. Returns 1 on success and sets *out; on bad input,
   prints a message, flushes the bad token, and returns 0 so the
   caller can bail out of the current action cleanly (never crashes
   or loops forever on non-numeric input). */
static int read_int(const char *prompt, int *out) {
    printf("%s", prompt);
    if (scanf("%d", out) != 1) {
        printf("  [!] That's not a valid number - action cancelled.\n");
        flush_input_line();
        return 0;
    }
    flush_input_line();
    return 1;
}

static int read_double(const char *prompt, double *out) {
    printf("%s", prompt);
    if (scanf("%lf", out) != 1) {
        printf("  [!] That's not a valid number - action cancelled.\n");
        flush_input_line();
        return 0;
    }
    flush_input_line();
    return 1;
}

/* Reads a User/Department ID: no spaces allowed. Uses fgets (not
   scanf) so we see the *whole* line the user typed, including any
   extra words - that lets us detect "joy boy" as invalid (rather than
   silently keeping "joy" and discarding "boy"), tell the user why,
   and make them re-enter it. Loops until a valid single-word ID is
   given or input runs out (EOF). */
static int read_username(const char *prompt, char *buf) {
    for (;;) {
        printf("%s", prompt);
        if (!fgets(buf, MAX_STR, stdin)) {
            printf("  [!] No input received - action cancelled.\n");
            return 0;
        }
        if (!strchr(buf, '\n')) flush_input_line(); /* line too long for buf */

        size_t len = strlen(buf);
        while (len > 0 && (buf[len - 1] == '\n' || buf[len - 1] == '\r'))
            buf[--len] = '\0';

        /* trim leading/trailing spaces */
        size_t start = 0;
        while (buf[start] == ' ' || buf[start] == '\t') start++;
        size_t end = len;
        while (end > start && (buf[end - 1] == ' ' || buf[end - 1] == '\t')) end--;
        if (start > 0 || end < len) {
            memmove(buf, buf + start, end - start);
            buf[end - start] = '\0';
        }

        if (buf[0] == '\0') {
            printf("  [!] No input received - action cancelled.\n");
            return 0;
        }
        if (strpbrk(buf, " \t") != NULL) {
            printf("  [!] No spaces allowed in User/Department ID - please re-enter.\n");
            continue;
        }
        return 1;
    }
}

/* Reads a bounded token (no spaces) into buf[MAX_STR]. Returns 1 on
   success. scanf("%63s", ...) already skips leading whitespace and
   can't overflow buf, so failure here really only means EOF/stream
   error - still handled rather than left to undefined behaviour. */
static int read_token(const char *prompt, char *buf) {
    printf("%s", prompt);
    if (scanf("%63s", buf) != 1) {
        printf("  [!] No input received - action cancelled.\n");
        flush_input_line();
        return 0;
    }
    return 1;
}

/* Reads a full line (spaces allowed) into buf[MAX_STR], trimming the
   trailing newline. Use this for free-text fields like "User/Department
   ID" where names such as "Joy Boy" or "R&D Dept" are valid input -
   scanf("%s", ...) would stop at the first space and leak the rest of
   the line into the next prompt. Leading/trailing whitespace is
   trimmed; an empty result is treated as no input, same as read_token. */
static int read_line(const char *prompt, char *buf) {
    printf("%s", prompt);
    if (!fgets(buf, MAX_STR, stdin)) {
        printf("  [!] No input received - action cancelled.\n");
        return 0;
    }
    /* if the line was longer than the buffer, discard the remainder */
    if (!strchr(buf, '\n')) flush_input_line();

    size_t len = strlen(buf);
    while (len > 0 && (buf[len - 1] == '\n' || buf[len - 1] == '\r' || buf[len - 1] == ' '))
        buf[--len] = '\0';

    size_t start = 0;
    while (buf[start] == ' ') start++;
    if (start > 0) memmove(buf, buf + start, len - start + 1);

    if (buf[0] == '\0') {
        printf("  [!] No input received - action cancelled.\n");
        return 0;
    }
    return 1;
}

static void seed_action_catalog(void) {
    /* -- energy -- */
    trie_insert(catalog, "solar_panel_installed", 120.0);
    trie_insert(catalog, "led_bulbs_switch", 8.0);
    trie_insert(catalog, "energy_saved_kwh", 5.5);
    trie_insert(catalog, "smart_thermostat_installed", 18.0);
    trie_insert(catalog, "appliance_unplugged", 2.0);
    trie_insert(catalog, "renewable_energy_purchase", 45.0);

    /* -- transport -- */
    trie_insert(catalog, "bicycle_commute", 3.2);
    trie_insert(catalog, "carpool_trip", 4.5);
    trie_insert(catalog, "public_transport_used", 6.0);
    trie_insert(catalog, "ev_charger_added", 30.0);
    trie_insert(catalog, "work_from_home_day", 7.5);
    trie_insert(catalog, "flight_avoided", 90.0);

    /* -- waste & water -- */
    trie_insert(catalog, "compost_started", 15.0);
    trie_insert(catalog, "rainwater_harvesting", 10.0);
    trie_insert(catalog, "plastic_recycled", 4.0);
    trie_insert(catalog, "e_waste_recycled", 12.0);
    trie_insert(catalog, "water_conserved", 3.5);
    trie_insert(catalog, "reusable_bottle_used", 1.5);

    /* -- land & food -- */
    trie_insert(catalog, "tree_planted", 21.5);
    trie_insert(catalog, "meat_free_day", 6.5);
    trie_insert(catalog, "local_produce_bought", 3.0);
    trie_insert(catalog, "urban_garden_started", 9.0);

    /* -- org / department level -- */
    trie_insert(catalog, "paper_reduction", 5.0);
    trie_insert(catalog, "waste_audit_completed", 14.0);
    trie_insert(catalog, "green_procurement", 25.0);
    trie_insert(catalog, "emissions_report_filed", 2.5);
}

static void refresh_trusted_snapshot(void) {
    merkle_free(trusted_snapshot);
    trusted_snapshot = build_from_hashes_from_ledger(&ledger);
    trusted_root = trusted_snapshot ? trusted_snapshot->hash : 0;

    trusted_record_count = ledger.record_count;
    if (trusted_record_count > 0)
        memcpy(trusted_records, ledger.records, sizeof(Record) * (size_t)trusted_record_count);
}

/* After loading raw records from disk, the AVL registry and duplicate
   hash table are empty (they're derived state, never saved). Replay
   the loaded records through them so everything is consistent again. */
static void rebuild_derived_state_from_records(void) {
    for (int i = 0; i < ledger.record_count; i++) {
        Record *r = &ledger.records[i];
        unsigned long dup_key = hash_duplicate_key(r->user_id, r->action);
        hash_table_insert(&seen, dup_key);
        registry = avl_insert_or_update(registry, r->user_id, r->co2_saved);
    }
    merkle_build(&ledger);
    refresh_trusted_snapshot();
}

/* Normalizes a user-typed action name so "Tree Planted", "tree planted",
   and "tree_planted" all resolve to the same catalog entry: lowercases
   it and turns any run of whitespace into a single underscore. Done
   in place, buf must be MAX_STR. */
static void normalize_action_name(char *buf) {
    char out[MAX_STR];
    size_t j = 0;
    int last_was_space = 0;

    for (size_t i = 0; buf[i] != '\0' && j < MAX_STR - 1; i++) {
        unsigned char c = (unsigned char)buf[i];
        if (c == ' ' || c == '\t') {
            if (j > 0 && !last_was_space) {
                out[j++] = '_';
                last_was_space = 1;
            }
            continue;
        }
        out[j++] = (char)tolower(c);
        last_was_space = 0;
    }
    while (j > 0 && out[j - 1] == '_') j--; /* no trailing underscore */
    out[j] = '\0';

    strcpy(buf, out);
}

static void action_save(void) {
    if (ledger_save(&ledger, SAVE_FILE))
        printf("  [SAVED] Ledger (%d records) written to \"%s\".\n", ledger.record_count, SAVE_FILE);
}

/* ---------------- menu actions ---------------- */

static void action_log(void) {
    char user[MAX_STR], action[MAX_STR];
    if (!read_username("User/Department ID: ", user)) return;
    if (!read_line("Action name (e.g. tree_planted): ", action)) return;
    normalize_action_name(action);

    double co2;
    if (!trie_lookup(catalog, action, &co2)) {
        printf("  [!] Unknown action \"%s\".\n", action);
        trie_autocomplete(catalog, "");
        return;
    }

    unsigned long dup_key = hash_duplicate_key(user, action);
    if (hash_table_contains(&seen, dup_key)) {
        printf("  [REJECTED] %s has already claimed \"%s\" before (duplicate).\n", user, action);
        return;
    }

    Record r;
    strncpy(r.user_id, user, MAX_STR - 1);
    r.user_id[MAX_STR - 1] = '\0';
    strncpy(r.action, action, MAX_STR - 1);
    r.action[MAX_STR - 1] = '\0';
    r.co2_saved = co2;
    r.timestamp = 1000 + ledger.record_count; /* simple incrementing "time" */
    r.record_hash = hash_record(&r);

    hash_table_insert(&seen, dup_key);
    unsigned long new_root = ledger_commit(&ledger, r);
    long rotations_before = avl_rotation_count();
    registry = avl_insert_or_update(registry, user, co2);
    long rotations_after = avl_rotation_count();
    refresh_trusted_snapshot();

    printf("  [COMMITTED] %s by %s | CO2 saved: %.1f kg | ledger root: %lu\n",
           action, user, co2, new_root);

    AVLNode *node = avl_search(registry, user);
    if (node) {
        printf("  [AVL] %-15s | new total: %.1f kg | subtree balance factor: %d\n",
               node->user_id, node->total_co2, avl_balance_factor(node));
        if (rotations_after > rotations_before)
            printf("  [AVL] Tree rebalanced with a %s rotation (total rotations so far: %ld)\n",
                   avl_last_rotation(), rotations_after);
    }
}

static void action_leaderboard(void) {
    if (!registry) {
        printf("  No users registered yet.\n");
        return;
    }
    AVLNode *nodes[512];
    int count = avl_collect(registry, nodes, 0);

    MaxHeap heap;
    heap_init(&heap);
    for (int i = 0; i < count; i++)
        heap_insert(&heap, nodes[i]->user_id, nodes[i]->total_co2);

    int k;
    if (!read_int("Show top how many? ", &k)) return;
    if (k <= 0) {
        printf("  [!] Enter a positive number.\n");
        return;
    }
    heap_print_top_k(&heap, k);
}

static void action_autocomplete(void) {
    char prefix[MAX_STR];
    if (!read_token("Enter prefix to search actions: ", prefix)) return;
    trie_autocomplete(catalog, prefix);
}

static void action_verify(void) {
    int ok = ledger_verify(&ledger, trusted_root);
    printf("  Verify result: %s\n", ok ? "OK - ledger intact" : "TAMPERED!");
    if (ok) return;

    printf("  Locating tampered record(s)...\n");
    int indices[MAX_RECORDS];
    int count = ledger_find_tampered_against(&ledger, trusted_snapshot, indices);

    for (int i = 0; i < count; i++) {
        int idx = indices[i];
        Record *live = &ledger.records[idx];
        printf("  -> Record %d tampered | user: %-12s action: %-20s\n",
               idx, live->user_id, live->action);
        if (idx < trusted_record_count) {
            Record *trusted = &trusted_records[idx];
            printf("       Old CO2: %.1f kg -> New CO2: %.1f kg\n",
                   trusted->co2_saved, live->co2_saved);
        }
    }
}

static void action_tamper(void) {
    if (ledger.record_count == 0) {
        printf("  Ledger is empty, nothing to tamper with.\n");
        return;
    }
    int idx;
    char prompt[64];
    snprintf(prompt, sizeof(prompt), "Enter record index to tamper with (0 to %d): ",
              ledger.record_count - 1);
    if (!read_int(prompt, &idx)) return;
    if (idx < 0 || idx >= ledger.record_count) {
        printf("  [!] Invalid index.\n");
        return;
    }
    double new_val;
    if (!read_double("New (fake) CO2 value for this record: ", &new_val)) return;

    ledger.records[idx].co2_saved = new_val;
    printf("  Record %d silently modified (record_hash NOT updated - simulating a real attack).\n", idx);
    printf("  Run 'Verify ledger' to see if it gets caught.\n");
}

static void action_budget(void) {
    int budget;
    if (!read_int("Enter green fund budget (in thousands of rupees): ", &budget)) return;
    if (budget < 0) {
        printf("  [!] Budget can't be negative.\n");
        return;
    }

    printf("\n  Available projects:\n");
    for (int i = 0; i < NUM_PROJECTS; i++)
        printf("    %-28s cost=%-4d CO2=%.1fkg\n",
               projects[i].name, projects[i].cost, projects[i].co2_saved);

    printf("\n");
    double dp_best = knapsack_dp(projects, NUM_PROJECTS, budget);
    printf("\n");
    double greedy_best = knapsack_greedy(projects, NUM_PROJECTS, budget);
    printf("\n");
    double bb_best = knapsack_branch_and_bound(projects, NUM_PROJECTS, budget);

    printf("\n  --- Comparison ---\n");
    printf("  DP (optimal):      %.1f kg CO2\n", dp_best);
    printf("  Greedy:             %.1f kg CO2  (%s)\n", greedy_best,
           greedy_best < dp_best ? "suboptimal!" : "matched optimal");
    printf("  Branch & Bound:     %.1f kg CO2  (should match DP, found faster)\n", bb_best);
}

static void action_display_records(void) {
    if (ledger.record_count == 0) {
        printf("  Ledger is empty - no records yet.\n");
        return;
    }
    printf("  %-5s  %-15s  %-22s  %10s  %11s  %-20s\n",
           "Index", "User", "Action", "CO2 (kg)", "Timestamp", "Hash");
    printf("  %.5s  %.15s  %.22s  %.10s  %.11s  %.20s\n",
           "-----", "---------------", "----------------------",
           "----------", "-----------", "--------------------");
    for (int i = 0; i < ledger.record_count; i++) {
        Record *r = &ledger.records[i];
        printf("  %-5d  %-15s  %-22s  %10.1f  %11ld  %-20lu\n",
               i, r->user_id, r->action, r->co2_saved, r->timestamp, r->record_hash);
    }
}

static void action_search_user(void) {
    char user[MAX_STR];
    if (!read_username("User/Department ID to search: ", user)) return;

    AVLNode *node = avl_search(registry, user);
    if (!node) {
        printf("  \"%s\" is not registered.\n", user);
        return;
    }
    printf("  [FOUND via AVL] %-15s total CO2 saved: %.1f kg (balance factor: %d)\n",
           node->user_id, node->total_co2, avl_balance_factor(node));
}

static void action_summary(void) {
    double total_co2 = 0.0;
    for (int i = 0; i < ledger.record_count; i++)
        total_co2 += ledger.records[i].co2_saved;

    AVLNode *nodes[512];
    int user_count = avl_collect(registry, nodes, 0);

    printf("  Total actions logged  : %d\n", ledger.record_count);
    printf("  Total users registered: %d\n", user_count);
    printf("  Total CO2 saved (all) : %.1f kg\n", total_co2);
    printf("  AVL rotations so far  : %ld (last: %s)\n", avl_rotation_count(), avl_last_rotation());
    printf("  Current Merkle root   : %lu\n", trusted_root);
}

static void action_reset(void) {
    char confirm[MAX_STR];
    if (!read_token("This wipes the ledger AND the save file. Type \"yes\" to confirm: ", confirm))
        return;
    if (strcmp(confirm, "yes") != 0) {
        printf("  Reset cancelled.\n");
        return;
    }

    ledger_init(&ledger);
    hash_table_free(&seen);
    hash_table_init(&seen);
    avl_free(registry);
    registry = NULL;
    avl_reset_rotation_stats();
    merkle_free(trusted_snapshot);
    trusted_snapshot = NULL;
    trusted_root = 0;
    trusted_record_count = 0;

    remove(SAVE_FILE); /* ok if it doesn't exist yet */
    printf("  [RESET] Ledger cleared and save file removed.\n");
}

static void print_menu(void) {
    printf("\n\n===================== CarbonLedger =====================\n");
    printf(" Records: %-4d   Merkle root: %lu\n", ledger.record_count, trusted_root);
    printf("----------------------------------------------------------\n");
    printf(" 1. Log an eco-action\n");
    printf(" 2. View leaderboard (top contributors)\n");
    printf(" 3. Search/autocomplete known actions\n");
    printf(" 4. Verify ledger integrity\n");
    printf(" 5. Simulate a tampering attack\n");
    printf(" 6. Allocate green fund budget (DP vs Greedy vs Branch&Bound)\n");
    printf(" 7. View all registered users (sorted)\n");
    printf(" 8. Display all ledger records\n");
    printf(" 9. Search user by ID\n");
    printf("10. Ledger summary\n");
    printf("11. Save ledger to disk\n");
    printf("12. Reset ledger (for testing)\n");
    printf(" 0. Exit (auto-saves)\n");
    printf("==========================================================\n");
    printf("Choice: ");
}

int main(void) {
    ledger_init(&ledger);
    hash_table_init(&seen);
    catalog = trie_create_node();
    seed_action_catalog();

    printf("=== Welcome to CarbonLedger ===\n");
    printf("A tamper-proof carbon credit tracker with fraud detection.\n");

    if (ledger_load(&ledger, SAVE_FILE)) {
        printf("[LOADED] %d record(s) restored from \"%s\".\n", ledger.record_count, SAVE_FILE);
        rebuild_derived_state_from_records();
    } else {
        printf("[INFO] No existing save file found - starting with an empty ledger.\n");
    }

    int choice;
    do {
        print_menu();
        int rc = scanf("%d", &choice);
        if (rc == EOF) {            /* input closed (Ctrl+D / Ctrl+Z / end of a pipe): exit cleanly */
            choice = 0;
            break;
        }
        if (rc != 1) {
            flush_input_line();
            printf("  [!] Please enter a number from the menu.\n");
            choice = -1;
            continue;
        }
        flush_input_line();

        switch (choice) {
            case 1: action_log(); break;
            case 2: action_leaderboard(); break;
            case 3: action_autocomplete(); break;
            case 4: action_verify(); break;
            case 5: action_tamper(); break;
            case 6: action_budget(); break;
            case 7:
                printf("  Registered users:\n");
                avl_inorder(registry);
                break;
            case 8: action_display_records(); break;
            case 9: action_search_user(); break;
            case 10: action_summary(); break;
            case 11: action_save(); break;
            case 12: action_reset(); break;
            case 0: printf("Exiting. Ledger stays honest even after you leave!\n"); break;
            default: printf("  Invalid choice.\n");
        }
    } while (choice != 0);

    ledger_save(&ledger, SAVE_FILE);

    merkle_free(trusted_snapshot);
    merkle_free(ledger.root);
    hash_table_free(&seen);
    avl_free(registry);
    trie_free(catalog);

    return 0;
}