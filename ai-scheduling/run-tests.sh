#!/bin/sh
# Runs the knowledge base tests (needs SWI-Prolog >= 9).
# Each file runs in its own process, so their helpers and HTTP handlers do not clash.
cd "$(dirname "$0")" || exit 1
status=0
for file in test/kb.plt test/kb_ai01.plt test/bom.plt test/requirements.plt test/service.plt; do
  echo "== $file"
  swipl -q -g "(run_tests -> halt(0) ; halt(1))" "$file" || status=1
done
exit $status