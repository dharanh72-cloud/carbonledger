#ifndef HEAP_H
#define HEAP_H

#include "common.h"

#define MAX_HEAP_SIZE 512

typedef struct {
    char user_id[MAX_STR];
    double total_co2;
} HeapEntry;

typedef struct {
    HeapEntry data[MAX_HEAP_SIZE];
    int size;
} MaxHeap;

void heap_init(MaxHeap *heap);
void heap_insert(MaxHeap *heap, const char *user_id, double total_co2);
HeapEntry heap_extract_max(MaxHeap *heap);

/* Prints the top K contributors without fully sorting everything -
   repeatedly extracts from a max-heap, which is O(K log n) instead
   of O(n log n) for a full sort. */
void heap_print_top_k(MaxHeap *heap, int k);

#endif
