#!/usr/bin/env bash
# Testes da SYS03 (sem root, sem nginx real): bash deploy/allowlist/test/test-allowlist.sh
set -uo pipefail
SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/laprizza-allowlist-apply.sh"
PASS=0; FAIL=0

setup() {
  T="$(mktemp -d)"
  export CONFIG_FILE="$T/allowed-clients.conf" NGINX_INCLUDE="$T/nginx-allowlist.conf"
  export STATE_DIR="$T/state" LAST_VALID="$T/state/last-valid.conf" LOG_FILE="$T/allowlist.log"
  export NGINX_BIN=true RELOAD_CMD=true AUDIT_KEY=none PATH="$T/bin:$PATH"
  mkdir -p "$T/bin"; printf '#!/bin/sh\nexit 0\n' >"$T/bin/logger"; chmod +x "$T/bin/logger"
}
teardown() { rm -rf "$T"; }
apply() { bash "$SCRIPT" apply >/dev/null 2>&1; }
ok()   { PASS=$((PASS+1)); echo "ok   - $1"; }
nok()  { FAIL=$((FAIL+1)); echo "FAIL - $1"; }
check() { if eval "$2"; then ok "$1"; else nok "$1"; fi; }

# 1. Ficheiro válido: gera allow por entrada, os locais e deny all; regista APPLIED
setup
printf '# comentário\n10.8.0.0/16   # VPN\n\n10.9.0.25\n2001:db8::/32\n' >"$CONFIG_FILE"
apply; rc=$?
check "valid file is applied"            "[[ $rc -eq 0 ]]"
check "allow per entry"                  "grep -qx 'allow 10.8.0.0/16;' '$NGINX_INCLUDE' && grep -qx 'allow 10.9.0.25;' '$NGINX_INCLUDE' && grep -qx 'allow 2001:db8::/32;' '$NGINX_INCLUDE'"
check "localhost always allowed"         "grep -qx 'allow 127.0.0.1;' '$NGINX_INCLUDE' && grep -qx 'allow ::1;' '$NGINX_INCLUDE'"
check "ends with deny all"               "[[ \$(tail -n1 '$NGINX_INCLUDE') == 'deny all;' ]]"
check "APPLIED is logged"                "grep -q 'INFO APPLIED' '$LOG_FILE'"

# 2. Alteração inválida: rejeitada, regras ativas iguais, linha indicada no registo
cp "$NGINX_INCLUDE" "$T/before"
printf '10.8.0.0/16\n10.9.0.300\n' >"$CONFIG_FILE"
apply; rc=$?
check "invalid change fails"             "[[ $rc -ne 0 ]]"
check "last valid rules kept active"     "cmp -s '$T/before' '$NGINX_INCLUDE'"
check "REJECTED logged with line"        "grep -q 'ERROR REJECTED' '$LOG_FILE' && grep -q 'line 2' '$LOG_FILE'"
teardown

# 3. Regras de validação
for bad in "0.0.0.0/0" "::/0" "10.8.3.1/16" "10.8.0.0/33" "10.8.0.0 10.9.0.0" "localhost"; do
  setup; printf '%s\n' "$bad" >"$CONFIG_FILE"
  bash "$SCRIPT" check >/dev/null 2>&1; rc=$?
  check "rejects '$bad'" "[[ $rc -ne 0 ]]"
  teardown
done
setup; printf '# só comentários\n\n' >"$CONFIG_FILE"
bash "$SCRIPT" check >/dev/null 2>&1; rc=$?
check "rejects a file without entries"   "[[ $rc -ne 0 ]]"
teardown

# 4. Duplicados: aviso, não erro
setup; printf '10.9.0.25\n10.9.0.25/32\n' >"$CONFIG_FILE"
apply; rc=$?
check "duplicate is a warning only"      "[[ $rc -eq 0 ]] && grep -q 'WARN' '$LOG_FILE' && [[ \$(grep -c 'allow 10.9.0.25;' '$NGINX_INCLUDE') -eq 1 ]]"

# 5. Mesma configuração: UNCHANGED, sem reload
apply
check "same content is UNCHANGED"        "grep -q 'INFO UNCHANGED' '$LOG_FILE'"

# 6. Diferenças registadas
printf '10.9.0.25\n10.8.0.0/16\n' >"$CONFIG_FILE"
apply
check "added entry logged"               "grep -q 'added   10.8.0.0/16' '$LOG_FILE'"
printf '10.8.0.0/16\n' >"$CONFIG_FILE"
apply
check "removed entry logged"             "grep -q 'removed 10.9.0.25' '$LOG_FILE'"

# 7. nginx -t falha: regras anteriores repostas
cp "$NGINX_INCLUDE" "$T/before"
printf '10.7.0.0/16\n' >"$CONFIG_FILE"
NGINX_BIN=false apply; rc=$?
check "nginx -t failure is rejected"     "[[ $rc -ne 0 ]] && grep -q 'nginx -t failed' '$LOG_FILE'"
check "previous rules restored"          "cmp -s '$T/before' '$NGINX_INCLUDE'"
teardown

# 8. Importação do ficheiro da SYS02 (allow …; deny all;)
setup
printf '# SYS02\nallow 127.0.0.1;   # a própria VM\nallow 10.8.0.0/16; # VPN do ISEP\nallow 10.9.0.0/16; # VNET1\ndeny  all;\n' >"$T/sys02.conf"
bash "$SCRIPT" import "$T/sys02.conf" >"$CONFIG_FILE" 2>/dev/null
check "import keeps the approved networks" "grep -q '^10.8.0.0/16 .*VPN do ISEP' '$CONFIG_FILE' && grep -q '^10.9.0.0/16' '$CONFIG_FILE'"
check "import drops localhost and deny all" "! grep -qE '127.0.0.1|deny' '$CONFIG_FILE'"
apply; rc=$?
check "imported file applies to the same rules" "[[ $rc -eq 0 ]] && diff <(grep -E '^(allow|deny)' '$NGINX_INCLUDE' | grep -v '::1') <(grep -E '^(allow|deny)' '$T/sys02.conf' | sed 's/ *#.*//; s/ \+/ /g; s/ *$//') >/dev/null"
teardown

echo; echo "$PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
