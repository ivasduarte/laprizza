#!/bin/sh
# Runs the knowledge base tests (needs SWI-Prolog >= 9)
cd "$(dirname "$0")" && swipl -q -g "(run_tests -> halt(0) ; halt(1))" test/kb.plt