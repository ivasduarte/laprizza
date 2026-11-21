#!/usr/bin/env bash
# =============================================================================
# LaPrizza – deixar a PRODUÇÃO "limpa" e publicar a tag de submissão
#
# Uso (como root):
#   laprizza-reset-production.sh <tag> --confirm [--keep-shared]
#
# O que faz, por esta ordem:
#   1. pára o back end e o serviço Prolog;
#   2. apaga a database da produção (MONGODB_URI de /opt/laprizza/.env), que vive no mesmo
#      servidor MongoDB do staging: só aceita o host de MONGO_HOST (deploy.conf) e a database
#      de MONGODB_DB_NAME, nunca "laprizza" (staging);
#   3. esvazia a pasta partilhada (SHARED_DIR), exceto com --keep-shared;
#   4. publica a tag no back end (migrations + arranque: o seeder cria o admin inicial),
#      no front end e no serviço Prolog;
#   5. desliga os timers de deploy automático (a produção fica presa à tag).
#
# IRREVERSÍVEL. Recusa correr se o .env não for de produção.
# =============================================================================
set -Eeuo pipefail

TAG="${1:-}"
CONFIRM="${2:-}"
KEEP_SHARED=false
[[ "${3:-}" == "--keep-shared" ]] && KEEP_SHARED=true

APP_ROOT=/opt/laprizza
ENV_FILE="$APP_ROOT/.env"
DEPLOY_CONF="$APP_ROOT/deploy.conf"
BIN="$APP_ROOT/bin"

die() { echo "ERRO: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "correr como root (sudo)."
[[ -n "$TAG" && "$CONFIRM" == "--confirm" ]] || die "uso: $0 <tag> --confirm [--keep-shared]"
[[ -r "$ENV_FILE" ]] || die "não encontro $ENV_FILE."

env_value() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-; }
[[ "$(env_value NODE_ENV)" == "production" ]] || die "$ENV_FILE não tem NODE_ENV=production: recusado."
MONGODB_URI="$(env_value MONGODB_URI)"
DB_NAME="$(env_value MONGODB_DB_NAME)"
SHARED_DIR="$(env_value SHARED_DIR)"
PROD_DB_HOST="$(grep -E '^MONGO_HOST=' "$DEPLOY_CONF" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '"')"
[[ -n "$MONGODB_URI" && -n "$DB_NAME" && -n "$PROD_DB_HOST" ]] \
  || die "faltam MONGODB_URI/MONGODB_DB_NAME (.env) ou MONGO_HOST ($DEPLOY_CONF)."
[[ "$DB_NAME" != "laprizza" ]] || die "MONGODB_DB_NAME=laprizza é a database do staging: recusado."
# O URI tem de apontar para o host da produção e para a mesma database de MONGODB_DB_NAME.
[[ "$MONGODB_URI" =~ @${PROD_DB_HOST//./\\.}(:[0-9]+)?/${DB_NAME}(\?|$) ]] \
  || die "o MONGODB_URI não aponta para $PROD_DB_HOST/$DB_NAME: recusado."

sudo -u deploy git -C "$APP_ROOT/repo" fetch --quiet --force origin "refs/tags/$TAG:refs/tags/$TAG" \
  || die "a tag '$TAG' não existe no GitHub."

echo ">> 1/5 parar serviços"
systemctl stop laprizza-deploy.timer laprizza-deploy-web.timer laprizza-api laprizza-ai || true

echo ">> 2/5 apagar a database $DB_NAME em $PROD_DB_HOST"
mongosh "$MONGODB_URI" --quiet --eval "db.getSiblingDB('$DB_NAME').dropDatabase().ok" | grep -q 1 \
  || die "dropDatabase falhou."

if [[ "$KEEP_SHARED" == false && -n "$SHARED_DIR" && -d "$SHARED_DIR" ]]; then
  echo ">> 3/5 esvaziar $SHARED_DIR"
  find "$SHARED_DIR" -mindepth 1 -delete
else
  echo ">> 3/5 pasta partilhada mantida"
fi

echo ">> 4/5 publicar a tag $TAG"
sudo -u deploy env FORCE=true DEPLOY_TAG="$TAG" "$BIN/laprizza-deploy.sh" deploy
sudo -u deploy env FORCE=true DEPLOY_TAG="$TAG" "$BIN/laprizza-deploy-web.sh" deploy
"$BIN/laprizza-update-ai.sh" "$TAG"

echo ">> 5/5 timers de deploy automático desligados (produção presa à tag)"
systemctl disable --now laprizza-deploy.timer laprizza-deploy-web.timer || true

echo "Produção limpa e publicada na tag $TAG."
echo "Conta inicial: admin@laprizza.pt com a password de SEED_MANAGER_PASSWORD."
