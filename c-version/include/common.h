#ifndef COMMON_H
#define COMMON_H

#define MAX_STR 64

/* One logged eco-action = one record in the ledger */
typedef struct {
    char user_id[MAX_STR];      /* who did the action            */
    char action[MAX_STR];       /* e.g. "planted_tree"            */
    double co2_saved;           /* kg of CO2 saved/reduced        */
    long timestamp;             /* unix-style timestamp or batch  */
    unsigned long record_hash;  /* fingerprint of this record     */
} Record;

#endif
