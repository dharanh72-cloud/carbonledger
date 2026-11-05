#include <stdio.h>
#include <string.h>
#include "heap.h"

void heap_init(MaxHeap *heap) {
    heap->size = 0;
}

static void swap_entries(HeapEntry *a, HeapEntry *b) {
    HeapEntry tmp = *a;
    *a = *b;
    *b = tmp;
}

static void sift_up(MaxHeap *heap, int idx) {
    while (idx > 0) {
        int parent = (idx - 1) / 2;
        if (heap->data[parent].total_co2 >= heap->data[idx].total_co2) break;
        swap_entries(&heap->data[parent], &heap->data[idx]);
        idx = parent;
    }
}

static void sift_down(MaxHeap *heap, int idx) {
    while (1) {
        int left = 2 * idx + 1;
        int right = 2 * idx + 2;
        int largest = idx;

        if (left < heap->size && heap->data[left].total_co2 > heap->data[largest].total_co2)
            largest = left;
        if (right < heap->size && heap->data[right].total_co2 > heap->data[largest].total_co2)
            largest = right;

        if (largest == idx) break;
        swap_entries(&heap->data[idx], &heap->data[largest]);
        idx = largest;
    }
}

void heap_insert(MaxHeap *heap, const char *user_id, double total_co2) {
    if (heap->size >= MAX_HEAP_SIZE) return;
    HeapEntry *e = &heap->data[heap->size];
    strncpy(e->user_id, user_id, MAX_STR - 1);
    e->user_id[MAX_STR - 1] = '\0'; /* strncpy doesn't guarantee this if
                                        user_id is >= MAX_STR chars */
    e->total_co2 = total_co2;
    sift_up(heap, heap->size);
    heap->size++;
}

HeapEntry heap_extract_max(MaxHeap *heap) {
    HeapEntry top = heap->data[0];
    heap->data[0] = heap->data[heap->size - 1];
    heap->size--;
    sift_down(heap, 0);
    return top;
}

void heap_print_top_k(MaxHeap *heap, int k) {
    /* work on a copy so we don't destroy the caller's heap */
    MaxHeap copy = *heap;
    int rank = 1;
    printf("  Rank  User             Total CO2 Saved\n");
    while (copy.size > 0 && rank <= k) {
        HeapEntry top = heap_extract_max(&copy);
        printf("  #%-4d %-15s  %.1f kg\n", rank, top.user_id, top.total_co2);
        rank++;
    }
}