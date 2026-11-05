# CarbonLedger (C) - build and test
CC      ?= gcc
CFLAGS  ?= -Wall -Wextra -Werror -O2 -Iinclude
SRC      = $(wildcard src/*.c)

all: carbonledger

carbonledger: $(SRC) $(wildcard include/*.h)
	$(CC) $(CFLAGS) $(SRC) -o $@

test: carbonledger
	bash tests/smoke.sh ./carbonledger

clean:
	rm -f carbonledger carbonledger.exe carbonledger.dat

.PHONY: all test clean
