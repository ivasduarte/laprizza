#!/usr/bin/env bash
# =============================================================================
# LaPrizza – atualizar o serviço Prolog (ai-scheduling) em PRODUÇÃO
#
# Uso (como root):   laprizza-update-ai.sh <branch|tag>     ex.: main, sprint2
#
# Extrai ai-scheduling/ do commit indicado para /opt/laprizza/ai-scheduling, mantém o .env
# e reinicia laprizza-ai. Os scripts de deploy só publicam o back end e o front end.
# =============================================================================
set -Eeuo pipefail

REF="${1:?Indicar o branch ou a tag (ex.: main, sprint2)}"
APP_ROOT="${APP_ROOT:-/opt/laprizza}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
TARGET="$APP_ROOT/ai-scheduling"

[[ $EUID -eq 0 ]] || { echo "Correr como root (sudo)." >&2; exit 1; }

sudo -u deploy git -C "$REPO_DIR" fetch --quiet --force --tags origin
if sudo -u deploy git -C "$REPO_DIR" rev-parse -q --verify "refs/tags/$REF^{commit}" >/dev/null; then
  COMMIT="$(sudo -u deploy git -C "$REPO_DIR" rev-parse "refs/tags/$REF^{commit}")"
else
  sudo -u deploy git -C "$REPO_DIR" fetch --quiet origin "$REF"
  COMMIT="$(sudo -u deploy git -C "$REPO_DIR" rev-parse "origin/$REF")"
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
sudo -u deploy git -C "$REPO_DIR" archive "$COMMIT" ai-scheduling | tar -x -C "$STAGE" --strip-components=1

mkdir -p "$TARGET"
[[ -f "$TARGET/.env" ]] && cp -a "$TARGET/.env" "$STAGE/.env"
rsync -a --delete "$STAGE/" "$TARGET/"
chown -R deploy:deploy "$TARGET"
chmod 600 "$TARGET/.env" 2>/dev/null || echo "AVISO: falta $TARGET/.env (ver ai.env.production.example)"
chmod +x "$TARGET/start-server.sh"

systemctl restart laprizza-ai
sleep 3
curl -fsS --max-time 5 http://127.0.0.1:5000/health && echo
echo "Serviço Prolog em ${COMMIT:0:7} ($REF)."
