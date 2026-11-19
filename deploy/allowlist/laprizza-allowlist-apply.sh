#!/usr/bin/env bash
# =============================================================================
# LaPrizza – SYS03 Configurable Allowed Endpoints
#
# Uso:
#   laprizza-allowlist-apply.sh apply          valida e aplica /etc/laprizza/allowed-clients.conf
#   laprizza-allowlist-apply.sh check [FICH]   só valida (não altera nada); útil antes de gravar
#   laprizza-allowlist-apply.sh status         mostra a configuração ativa e as últimas alterações
#   laprizza-allowlist-apply.sh import FICH    converte um ficheiro "allow …;" do nginx (SYS02) para o formato simples
#
# Gera /etc/laprizza/allowed-endpoints.conf, o ficheiro de regras da SYS02 incluído no site do
# nginx (/etc/nginx/sites-available/laprizza). Esse ficheiro passa a ser gerado: não editar à mão.
#
# Corre como root, chamado pelo laprizza-allowlist.service sempre que o ficheiro muda
# (laprizza-allowlist.path). Aplica com "nginx -t" + reload: o nginx não é reiniciado e as
# ligações abertas não caem.
#
# Se o ficheiro for inválido, nada é aplicado: o include ativo do nginx fica igual e o erro é
# registado (journal + /var/log/laprizza/allowlist.log).
# =============================================================================
set -Euo pipefail

CONFIG_FILE="${CONFIG_FILE:-/etc/laprizza/allowed-clients.conf}"
NGINX_INCLUDE="${NGINX_INCLUDE:-/etc/laprizza/allowed-endpoints.conf}"
STATE_DIR="${STATE_DIR:-/var/lib/laprizza/allowlist}"
LAST_VALID="${LAST_VALID:-$STATE_DIR/last-valid.conf}"
LOG_FILE="${LOG_FILE:-/var/log/laprizza/allowlist.log}"
AUDIT_KEY="${AUDIT_KEY:-laprizza-allowlist}"
NGINX_BIN="${NGINX_BIN:-nginx}"
RELOAD_CMD="${RELOAD_CMD:-systemctl reload nginx}"

# Sempre permitidos (não configuráveis): verificações locais do deploy e do health check.
ALWAYS_ALLOWED=("127.0.0.1" "::1")

log() {
  # $1 = nível (INFO|WARN|ERROR), resto = mensagem
  local level="$1"; shift
  local line
  line="$(date -u '+%Y-%m-%dT%H:%M:%SZ') $level $*"
  mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
  printf '%s\n' "$line" >> "$LOG_FILE" 2>/dev/null || true
  local prio=info
  case "$level" in WARN) prio=warning ;; ERROR) prio=err ;; esac
  command -v logger >/dev/null && logger -t laprizza-allowlist -p "auth.$prio" -- "$*" || true
  printf '%s\n' "$line" >&2
}

# Valida o ficheiro e, se for válido, escreve as entradas normalizadas (uma por linha) no stdout.
# Erros vão para o stderr com o número da linha. Termina com 1 se houver algum erro.
validate() {
  local file="$1"
  python3 - "$file" <<'PY'
import ipaddress, sys

path = sys.argv[1]
errors, warnings, entries, seen = [], [], [], {}

try:
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
except OSError as exc:
    print(f"cannot read {path}: {exc.strerror}", file=sys.stderr)
    sys.exit(1)

for number, raw in enumerate(lines, start=1):
    text = raw.split("#", 1)[0].strip()
    if not text:
        continue
    if len(text.split()) != 1:
        errors.append(f"line {number}: one address or network per line: '{text}'")
        continue
    try:
        net = ipaddress.ip_network(text, strict=True)
    except ValueError as exc:
        errors.append(f"line {number}: '{text}' is not a valid IP address or CIDR network ({exc})")
        continue
    if net.prefixlen == 0:
        errors.append(f"line {number}: '{text}' would allow every client")
        continue
    value = str(net.network_address) if net.num_addresses == 1 else str(net)
    if value in seen:
        warnings.append(f"line {number}: '{text}' repeats line {seen[value]} (ignored)")
        continue
    seen[value] = number
    entries.append(value)

if not entries and not errors:
    errors.append("no allowed client: the file must list at least one address or network")

for w in warnings:
    print(f"warning: {w}", file=sys.stderr)
for e in errors:
    print(f"error: {e}", file=sys.stderr)
if errors:
    sys.exit(1)
print("\n".join(entries))
PY
}

render_include() {
  # stdin: entradas normalizadas
  echo "# Redes aprovadas para acesso ao staging (SYS02), geradas pela SYS03 – NÃO EDITAR."
  echo "# Alterar com: sudo laprizza-allowlist-edit (valida, regista o autor e aplica automaticamente)."
  local entry
  for entry in "${ALWAYS_ALLOWED[@]}"; do echo "allow $entry;"; done
  while IFS= read -r entry; do
    [[ -n "$entry" ]] && echo "allow $entry;"
  done
  echo "deny all;"
}

# Utilizador que fez a última alteração ao ficheiro.
#  1. auditd (auid = utilizador que iniciou sessão, mesmo usando sudoedit), se estiver ativo;
#  2. senão, o registo do sudo no journal: o ficheiro é root:root 644, por isso só se altera com
#     "sudoedit /etc/laprizza/allowed-clients.conf" (grupo ssh-admins) e o sudo regista quem o fez.
#  Sem nenhum dos dois devolve "unknown".
last_author() {
  local who=""
  # 0. laprizza-allowlist-edit grava o autor ($SUDO_USER) antes de gravar o ficheiro
  local marker="$STATE_DIR/last-editor"
  if [[ -n "$(find "$marker" -mmin -5 2>/dev/null)" ]]; then
    who="$(head -n 1 "$marker")"
    rm -f "$marker"
    [[ -n "$who" ]] && { echo "$who"; return; }
  fi
  if command -v ausearch >/dev/null; then
    who="$(ausearch -k "$AUDIT_KEY" -ts recent -i 2>/dev/null | grep -o ' auid=[^ ]*' | tail -n 1 | cut -d= -f2)"
    [[ -n "$who" && "$who" != "unset" ]] && { echo "$who"; return; }
  fi
  if command -v journalctl >/dev/null; then
    # Sem filtro por processo: com sudoedit o processo chama-se "sudoedit", não "sudo".
    # Ignora as tentativas recusadas (utilizador fora do sudoers, password errada).
    who="$(journalctl --since "-${AUTHOR_WINDOW_MINUTES:-15}min" -o cat --no-pager 2>/dev/null \
      | grep -F "COMMAND=sudoedit $CONFIG_FILE" \
      | grep -vE 'NOT in sudoers|command not allowed|incorrect password|authentication failure' \
      | tail -n 1 | awk '{print $1}')"
    [[ -n "$who" ]] && { echo "$who (sudo)"; return; }
  fi
  echo "unknown"
}

cmd_check() {
  local file="${1:-$CONFIG_FILE}"
  local out
  if out="$(validate "$file")"; then
    echo "OK: $(grep -c . <<<"$out") entrada(s) válida(s) em $file"
    return 0
  fi
  echo "INVÁLIDO: $file não seria aplicado" >&2
  return 1
}

cmd_apply() {
  local author entries errors tmp
  author="$(last_author)"
  mkdir -p "$STATE_DIR"

  errors="$(mktemp)"
  if ! entries="$(validate "$CONFIG_FILE" 2>"$errors")"; then
    log ERROR "REJECTED author=$author file=$CONFIG_FILE – last valid configuration kept active"
    while IFS= read -r line; do log ERROR "  $line"; done <"$errors"
    rm -f "$errors"
    return 1
  fi
  while IFS= read -r line; do log WARN "  $line"; done <"$errors"
  rm -f "$errors"

  tmp="$(mktemp)"
  render_include <<<"$entries" >"$tmp"

  if [[ -f "$NGINX_INCLUDE" ]] && cmp -s "$tmp" "$NGINX_INCLUDE"; then
    rm -f "$tmp"
    log INFO "UNCHANGED author=$author (same allowed clients)"
    return 0
  fi

  local backup="$STATE_DIR/include.previous"
  [[ -f "$NGINX_INCLUDE" ]] && cp -p "$NGINX_INCLUDE" "$backup"
  install -m 644 "$tmp" "$NGINX_INCLUDE"
  rm -f "$tmp"

  if ! "$NGINX_BIN" -t >/dev/null 2>&1; then
    [[ -f "$backup" ]] && install -m 644 "$backup" "$NGINX_INCLUDE"
    log ERROR "REJECTED author=$author – nginx -t failed, previous rules restored"
    return 1
  fi
  if ! $RELOAD_CMD; then
    [[ -f "$backup" ]] && install -m 644 "$backup" "$NGINX_INCLUDE"
    log ERROR "REJECTED author=$author – nginx reload failed, previous rules restored"
    return 1
  fi

  local diff_out=""
  [[ -f "$LAST_VALID" ]] && diff_out="$(diff <(grep -v '^#' "$LAST_VALID") <(printf '%s\n' "$entries") | grep '^[<>]' || true)"
  printf '%s\n' "$entries" >"$LAST_VALID"

  log INFO "APPLIED author=$author entries=$(grep -c . <<<"$entries") (nginx reloaded, no restart)"
  if [[ -n "$diff_out" ]]; then
    while IFS= read -r line; do
      case "$line" in
        "<"*) log INFO "  removed ${line#< }" ;;
        ">"*) log INFO "  added   ${line#> }" ;;
      esac
    done <<<"$diff_out"
  fi
}

# Converte as linhas "allow X;" de um ficheiro do nginx para o formato simples (mantém os
# comentários de fim de linha). Ignora os endereços sempre permitidos e "deny all;".
cmd_import() {
  local file="$1" line addr comment
  [[ -r "$file" ]] || { echo "não consigo ler $file" >&2; return 1; }
  echo "# Importado de $file em $(date -u '+%Y-%m-%d')"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*allow[[:space:]]+([^;[:space:]]+)[[:space:]]*\;[[:space:]]*(#.*)?$ ]]; then
      addr="${BASH_REMATCH[1]}"; comment="${BASH_REMATCH[2]:-}"
      [[ " ${ALWAYS_ALLOWED[*]} " == *" $addr "* ]] && continue
      printf '%-18s %s\n' "$addr" "$comment"
    elif [[ "$line" =~ ^[[:space:]]*deny[[:space:]]+all[[:space:]]*\; ]] || [[ "$line" =~ ^[[:space:]]*(#.*)?$ ]]; then
      continue
    else
      echo "aviso: linha não convertida: $line" >&2
    fi
  done <"$file"
}

cmd_status() {
  echo "Ficheiro:      $CONFIG_FILE"
  echo "Regras ativas: $NGINX_INCLUDE"
  echo
  [[ -f "$NGINX_INCLUDE" ]] && cat "$NGINX_INCLUDE" || echo "(ainda não aplicado)"
  echo
  echo "Últimas alterações ($LOG_FILE):"
  tail -n 20 "$LOG_FILE" 2>/dev/null || echo "(sem registos)"
}

case "${1:-apply}" in
  apply)  cmd_apply ;;
  check)  shift; cmd_check "${1:-}" ;;
  status) cmd_status ;;
  import) shift; cmd_import "${1:?indicar o ficheiro}" ;;
  log)    shift; log "$@" ;;
  *) echo "uso: $0 {apply|check [ficheiro]|status|import ficheiro}" >&2; exit 2 ;;
esac
