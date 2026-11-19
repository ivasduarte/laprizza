#!/usr/bin/env bash
# =============================================================================
# LaPrizza – instalação da SYS03 na VM web (correr uma vez, como root, a partir do repositório):
#   sudo ./deploy/allowlist/install.sh
# É idempotente: pode ser corrido de novo para atualizar o script e as unidades.
# =============================================================================
set -Eeuo pipefail
trap 'echo "ERRO na linha $LINENO: $BASH_COMMAND" >&2' ERR
HERE="$(cd "$(dirname "$0")" && pwd)"
ADMIN_GROUP="${ADMIN_GROUP:-ssh-admins}"

[[ $EUID -eq 0 ]] || { echo "Correr com sudo." >&2; exit 1; }
getent group "$ADMIN_GROUP" >/dev/null || { echo "O grupo $ADMIN_GROUP não existe (SYS05)." >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 é necessário para validar o ficheiro." >&2; exit 1; }

echo "1/6 Script de validação e aplicação"
install -d -m 755 /opt/laprizza/bin /var/lib/laprizza/allowlist
install -d -m 750 /var/log/laprizza
install -m 755 "$HERE/laprizza-allowlist-apply.sh" /opt/laprizza/bin/laprizza-allowlist-apply.sh
install -m 755 -o root -g root "$HERE/laprizza-allowlist-edit.sh" /usr/local/sbin/laprizza-allowlist-edit

echo "2/6 Ficheiro de configuração (root:root 644 – só se altera com sudo laprizza-allowlist-edit)"
install -d -m 755 /etc/laprizza
SYS02_FILE=/etc/laprizza/allowed-endpoints.conf
if [[ ! -f /etc/laprizza/allowed-clients.conf ]]; then
  if [[ -f "$SYS02_FILE" ]]; then
    # Migração: as redes já aprovadas na SYS02 passam para o formato simples; guarda-se o original.
    cp -p "$SYS02_FILE" /var/lib/laprizza/allowlist/allowed-endpoints.conf.sys02-original
    /opt/laprizza/bin/laprizza-allowlist-apply.sh import "$SYS02_FILE" >/etc/laprizza/allowed-clients.conf
    echo "   importado de $SYS02_FILE (original em /var/lib/laprizza/allowlist/)"
  else
    install -m 644 "$HERE/allowed-clients.conf.example" /etc/laprizza/allowed-clients.conf
    echo "   criado a partir do exemplo – REVER as redes antes de continuar!"
  fi
fi
chown root:root /etc/laprizza/allowed-clients.conf
chmod 644 /etc/laprizza/allowed-clients.conf

echo "3/6 Permissão de alteração para o grupo $ADMIN_GROUP (sudoers)"
visudo -cf "$HERE/sudoers-laprizza-allowlist" >/dev/null
install -m 440 -o root -g root "$HERE/sudoers-laprizza-allowlist" /etc/sudoers.d/laprizza-allowlist

echo "4/6 Registo de quem altera o ficheiro (auditd)"
if command -v augenrules >/dev/null; then
  install -d -m 750 /etc/audit/rules.d
  install -m 640 "$HERE/audit-laprizza-allowlist.rules" /etc/audit/rules.d/laprizza-allowlist.rules
  systemctl enable --now auditd >/dev/null 2>&1 || true
  if augenrules --load >/dev/null 2>&1 && auditctl -l 2>/dev/null | grep -q laprizza-allowlist; then
    echo "   regra ativa (auditctl -l)"
  else
    echo "   AVISO: não foi possível carregar a regra de auditoria (ver: systemctl status auditd)."
    echo "          O autor das alterações passa a ser obtido do registo do sudo (journal)."
  fi
else
  echo "   AVISO: auditd não está instalado – o autor das alterações é obtido do registo do sudo (journal)."
fi

echo "5/6 Primeira aplicação (gera $SYS02_FILE)"
/opt/laprizza/bin/laprizza-allowlist-apply.sh check
/opt/laprizza/bin/laprizza-allowlist-apply.sh apply || true
grep -q 'allowed-endpoints.conf' /etc/nginx/sites-available/laprizza 2>/dev/null \
  || echo "   AVISO: falta 'include $SYS02_FILE;' no server do nginx (ver deploy/nginx/laprizza.conf)."

echo "6/6 Aplicação automática ao gravar (systemd .path)"
install -m 644 "$HERE/laprizza-allowlist.service" "$HERE/laprizza-allowlist.path" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now laprizza-allowlist.path

echo
/opt/laprizza/bin/laprizza-allowlist-apply.sh status
