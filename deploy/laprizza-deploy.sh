#!/usr/bin/env bash
# =============================================================================
# LaPrizza – deploy automático do back end (SYS01)
#
# Uso:
#   laprizza-deploy.sh deploy            publica o último commit do branch configurado
#   laprizza-deploy.sh rollback [sha]    volta à versão anterior (ou à indicada)
#   laprizza-deploy.sh status            mostra versão atual, versões guardadas e histórico
#
# Variáveis úteis na linha de comandos:
#   FORCE=true           volta a publicar mesmo que o commit não tenha mudado
#   DEPLOY_BRANCH=<nome> publica outro branch (testes antes do merge)
#
# Configuração: /opt/laprizza/deploy.conf (ver deploy.conf.example)
# =============================================================================
set -Euo pipefail

CONFIG_FILE="${CONFIG_FILE:-/opt/laprizza/deploy.conf}"
# shellcheck disable=SC1090
[[ -r "$CONFIG_FILE" ]] && . "$CONFIG_FILE"

APP_ROOT="${APP_ROOT:-/opt/laprizza}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
RELEASES_DIR="${RELEASES_DIR:-$APP_ROOT/releases}"
CURRENT_LINK="${CURRENT_LINK:-$APP_ROOT/current}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env}"
LOG_ROOT="${LOG_ROOT:-/var/log/laprizza/deploys}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
APP_SUBDIR="${APP_SUBDIR:-backend}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RUN_LINT="${RUN_LINT:-true}"
HEALTH_URL="${HEALTH_URL:-http://localhost:3000/api/v1/health}"
VERSION_URL="${VERSION_URL:-http://localhost:3000/api/v1/version}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-60}"
MONGO_HOST="${MONGO_HOST:-}"
MONGO_PORT="${MONGO_PORT:-27017}"
FORCE="${FORCE:-false}"
if ! declare -p RESTART_CMD &>/dev/null; then
  RESTART_CMD=(sudo -n /usr/bin/systemctl restart laprizza-api)
fi

HISTORY_FILE="$LOG_ROOT/history.log"
TS="$(date +%Y%m%d-%H%M%S)"
STATUS=""
SHA="-"
RUN_DIR=""
REL=""
PREV=""
SWITCHED=false
ACTION="${1:-deploy}"

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }

current_release() { [[ -L "$CURRENT_LINK" ]] && readlink -f "$CURRENT_LINK" || true; }

record() {
  # Regista o resultado no histórico e na pasta da execução
  mkdir -p "$LOG_ROOT"
  printf '%s\t%s\t%s\t%s\t%s\n' "$TS" "$ACTION" "$DEPLOY_BRANCH" "$SHA" "$STATUS" >> "$HISTORY_FILE"
  if [[ -n "$RUN_DIR" ]]; then
    echo "$STATUS" > "$RUN_DIR/STATUS"
    ln -sfn "$RUN_DIR" "$LOG_ROOT/latest"
  fi
}

start_run_log() {
  RUN_DIR="$LOG_ROOT/$TS-$ACTION-$SHA"
  mkdir -p "$RUN_DIR"
  exec > >(tee -a "$RUN_DIR/run.log") 2>&1
  log "Registo desta execução: $RUN_DIR"
}

switch_to() {
  # Troca atómica do link "current"
  ln -sfn "$1" "$CURRENT_LINK.new"
  mv -Tf "$CURRENT_LINK.new" "$CURRENT_LINK"
}

restart_app() { "${RESTART_CMD[@]}"; }

health_check() {
  # $1 = sha curto esperado em /version
  local expected="$1" waited=0
  while (( waited < HEALTH_TIMEOUT_SECONDS )); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      if [[ -z "$VERSION_URL" ]]; then return 0; fi
      if curl -fsS --max-time 5 "$VERSION_URL" 2>/dev/null | grep -q "$expected"; then
        return 0
      fi
    fi
    sleep 3; waited=$(( waited + 3 ))
  done
  return 1
}

fail() {
  # $1 = mensagem; $2 = estado (opcional)
  log "ERRO: $1"
  STATUS="${2:-FAILED}"
  if [[ "$SWITCHED" == true ]]; then
    if [[ -n "$PREV" && -d "$PREV" ]]; then
      log "A repor a versão anterior: $(basename "$PREV")"
      switch_to "$PREV"
      if restart_app && health_check "$(basename "$PREV" | cut -c1-7)"; then
        log "Versão anterior reposta e saudável."
        STATUS="ROLLED_BACK"
        if [[ "$ACTION" == deploy && -n "$REL" && "$REL" != "$PREV" ]]; then
          rm -rf "$REL"     # a versão com falha não fica disponível para rollback
        fi
      else
        log "ATENÇÃO: a versão anterior também não respondeu. Intervenção manual necessária."
        STATUS="ROLLBACK_FAILED"
      fi
    else
      log "Não existe versão anterior para repor."
    fi
  elif [[ -n "$REL" && -d "$REL" && "$REL" != "$(current_release)" ]]; then
    rm -rf "$REL"
  fi
  record
  exit 1
}

run_step() {
  # $1 = nome do passo (também nome do ficheiro de log); resto = comando
  local name="$1"; shift
  log "→ $name"
  if "$@" > "$RUN_DIR/$name.log" 2>&1; then
    log "  ok"
  else
    tail -n 30 "$RUN_DIR/$name.log"
    fail "o passo '$name' falhou (ver $RUN_DIR/$name.log)"
  fi
}

prune_releases() {
  local cur keep=0 dir
  cur="$(current_release)"
  while IFS= read -r dir; do
    [[ "$dir" == "$cur" || "$dir" == "$PREV" ]] && continue
    keep=$(( keep + 1 ))
    if (( keep > KEEP_RELEASES - 2 )); then
      log "A remover versão antiga: $(basename "$dir")"
      rm -rf "$dir"
    fi
  done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-)
}

acquire_lock() {
  mkdir -p "$APP_ROOT"
  exec 9>"$APP_ROOT/.deploy.lock"
  if ! flock -n 9; then
    log "Já está a decorrer outro deploy ou rollback. Nada a fazer."
    exit 0
  fi
}

# -----------------------------------------------------------------------------
do_deploy() {
  acquire_lock
  log "A verificar o branch '$DEPLOY_BRANCH' no GitHub…"
  git -C "$REPO_DIR" fetch --prune --quiet origin "$DEPLOY_BRANCH" \
    || { STATUS="FETCH_FAILED"; log "ERRO: não foi possível contactar o GitHub."; record; exit 1; }

  local target_full
  target_full="$(git -C "$REPO_DIR" rev-parse "origin/$DEPLOY_BRANCH")"
  SHA="${target_full:0:7}"
  PREV="$(current_release)"
  local prev_sha=""
  [[ -n "$PREV" ]] && prev_sha="$(basename "$PREV" | cut -c1-7)"

  if [[ "$SHA" == "$prev_sha" && "$FORCE" != true ]]; then
    log "Sem alterações: a versão $SHA já está publicada."
    exit 0
  fi

  start_run_log
  log "Deploy de $SHA (branch $DEPLOY_BRANCH). Versão atual: ${prev_sha:-nenhuma}"

  REL="$RELEASES_DIR/$SHA"
  if [[ "$REL" == "$PREV" ]]; then
    REL="$RELEASES_DIR/$SHA-$TS"          # FORCE sobre a versão em execução
  elif [[ -d "$REL" ]]; then
    rm -rf "$REL"
  fi
  mkdir -p "$REL"

  log "→ extrair código"
  git -C "$REPO_DIR" archive "$target_full" "$APP_SUBDIR" | tar -x -C "$REL" --strip-components=1 \
    || fail "não foi possível extrair '$APP_SUBDIR' do commit $SHA"
  cat > "$REL/VERSION.json" <<EOF
{
  "sha": "$target_full",
  "shortSha": "$SHA",
  "branch": "$DEPLOY_BRANCH",
  "commitDate": "$(git -C "$REPO_DIR" log -1 --format=%cI "$target_full")",
  "deployedAt": "$(date -u +%FT%TZ)"
}
EOF
  log "  ok"

  cd "$REL"
  # Validação (plano de testes). As variáveis de staging NÃO são carregadas aqui,
  # para que os testes nunca toquem na base de dados de staging.
  run_step npm-ci     npm ci --no-audit --no-fund
  if [[ "$RUN_LINT" == true ]]; then
    run_step lint     npm run lint
  fi
  run_step tests      npm test -- --test-reporter=spec --test-reporter-destination=stdout \
                                  --test-reporter=junit --test-reporter-destination="$RUN_DIR/test-report.xml"

  if [[ -n "$MONGO_HOST" ]]; then
    log "→ verificar base de dados ($MONGO_HOST:$MONGO_PORT)"
    nc -z -w 5 "$MONGO_HOST" "$MONGO_PORT" \
      || fail "base de dados indisponível; a versão em execução não foi alterada" "DB_UNAVAILABLE"
    log "  ok"
  fi

  run_step migrations bash -c 'set -a; . "$1"; set +a; npm run migrate:up' _ "$ENV_FILE"
  run_step prune      npm prune --omit=dev --no-audit --no-fund

  log "→ ativar versão $SHA"
  switch_to "$REL"
  SWITCHED=true
  restart_app || fail "não foi possível reiniciar o serviço"
  log "→ verificar saúde (até ${HEALTH_TIMEOUT_SECONDS}s)"
  health_check "$SHA" || fail "a versão $SHA não respondeu corretamente em $HEALTH_URL / $VERSION_URL"
  log "  ok"

  STATUS="SUCCESS"
  prune_releases
  record
  log "SUCESSO: versão $SHA publicada."
}

do_rollback() {
  acquire_lock
  local wanted="${1:-}" target=""
  PREV="$(current_release)"
  if [[ -n "$wanted" ]]; then
    target="$(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -name "$wanted*" -printf '%T@ %p\n' \
              | sort -rn | head -n1 | cut -d' ' -f2-)"
  else
    target="$(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d ! -path "$PREV" -printf '%T@ %p\n' \
              | sort -rn | head -n1 | cut -d' ' -f2-)"
  fi
  if [[ -z "$target" || ! -d "$target" ]]; then
    log "ERRO: versão '${wanted:-anterior}' não encontrada em $RELEASES_DIR."
    exit 1
  fi
  if [[ "$target" == "$PREV" ]]; then
    log "A versão $(basename "$target") já é a que está em execução."
    exit 0
  fi

  SHA="$(basename "$target" | cut -c1-7)"
  start_run_log
  log "Rollback: $(basename "${PREV:-nenhuma}") → $(basename "$target")"
  log "Nota: as migrações de base de dados não são revertidas automaticamente."
  switch_to "$target"
  SWITCHED=true
  restart_app || fail "não foi possível reiniciar o serviço"
  health_check "$SHA" || fail "a versão $SHA não respondeu corretamente"
  touch "$target"            # passa a contar como a versão mais recente
  STATUS="SUCCESS"
  record
  log "SUCESSO: versão $SHA reposta."
}

do_status() {
  echo "Versão em execução: $(basename "$(current_release)" 2>/dev/null || echo nenhuma)"
  if [[ -n "$VERSION_URL" ]]; then
    echo "Resposta de /version: $(curl -fsS --max-time 5 "$VERSION_URL" 2>/dev/null | tr -d '\n' || echo 'sem resposta')"
  fi
  echo
  echo "Versões guardadas (mais recente primeiro):"
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%TY-%Tm-%Td %TH:%TM  %f\n' 2>/dev/null | sort -r
  echo
  echo "Últimas execuções (data, ação, branch, sha, resultado):"
  tail -n 10 "$HISTORY_FILE" 2>/dev/null || echo "(sem histórico)"
}

case "$ACTION" in
  deploy)   do_deploy ;;
  rollback) do_rollback "${2:-}" ;;
  status)   do_status ;;
  *) echo "Uso: $0 {deploy|rollback [sha]|status}"; exit 2 ;;
esac