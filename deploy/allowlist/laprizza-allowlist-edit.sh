#!/usr/bin/env bash
# =============================================================================
# LaPrizza – SYS03: editar os clientes autorizados
#
#   sudo laprizza-allowlist-edit
#
# Só o grupo ssh-admins o pode correr (sudoers). O editor corre como o próprio administrador,
# numa cópia temporária (nunca como root). Ao sair do editor a cópia é validada:
#   - inválida: mostra os erros, regista REJECTED com o autor e nada é alterado;
#   - válida:   grava o ficheiro, regista o autor e o laprizza-allowlist.path aplica-o no nginx.
# O autor vem de $SUDO_USER, definido pelo sudo e não pelo utilizador.
# =============================================================================
set -Euo pipefail

CONFIG_FILE="${CONFIG_FILE:-/etc/laprizza/allowed-clients.conf}"
STATE_DIR="${STATE_DIR:-/var/lib/laprizza/allowlist}"
APPLY="${APPLY:-/opt/laprizza/bin/laprizza-allowlist-apply.sh}"
EDITOR_CMD="${ALLOWLIST_EDITOR:-nano}"
AUTHOR="${SUDO_USER:-}"

[[ $EUID -eq 0 && -n "$AUTHOR" && "$AUTHOR" != root ]] \
  || { echo "Usar: sudo laprizza-allowlist-edit (com a própria conta de administrador)" >&2; exit 1; }
command -v "$EDITOR_CMD" >/dev/null || EDITOR_CMD=vi

log() { CONFIG_FILE="$CONFIG_FILE" STATE_DIR="$STATE_DIR" "$APPLY" log "$@"; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
chown "$AUTHOR" "$work"; chmod 700 "$work"
draft="$work/allowed-clients.conf"
cp "$CONFIG_FILE" "$draft"; chown "$AUTHOR" "$draft"

while true; do
  # O editor corre com os privilégios do administrador, não de root.
  ${EDIT_AS:-sudo -u "$AUTHOR"} "$EDITOR_CMD" "$draft"

  if cmp -s "$draft" "$CONFIG_FILE"; then
    echo "Sem alterações."
    exit 0
  fi
  if errors="$("$APPLY" check "$draft" 2>&1)"; then
    break
  fi
  log ERROR "REJECTED author=$AUTHOR (edit not saved) – last valid configuration kept active"
  while IFS= read -r line; do log ERROR "  $line"; done < <(grep -v '^INVÁLIDO' <<<"$errors")
  echo
  echo "$errors"
  read -r -p "Ficheiro inválido – nada foi alterado. Voltar a editar? [S/n] " answer
  [[ "${answer:-S}" =~ ^[SsYy]$ ]] || exit 1
done

mkdir -p "$STATE_DIR"
printf '%s\n' "$AUTHOR" >"$STATE_DIR/last-editor"
install -m 644 -o root -g root "$draft" "$CONFIG_FILE"
echo "Gravado. A alteração está a ser aplicada (ver: sudo laprizza-allowlist-apply.sh status)."
