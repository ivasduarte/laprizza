#!/usr/bin/env bash
# =============================================================================
# LaPrizza – deploy automático do front end
#
# Uso:
#   laprizza-deploy-web.sh deploy            publica o último commit do branch configurado
#   laprizza-deploy-web.sh rollback [sha]    volta à versão anterior (ou à indicada)
#   laprizza-deploy-web.sh status            mostra versão atual, versões guardadas e histórico
#
# Variáveis úteis na linha de comandos:
#   FORCE=true           volta a publicar mesmo que o commit não tenha mudado
#   DEPLOY_BRANCH=<nome> publica outro branch (testes antes do merge)
#   DEPLOY_TAG=<tag>     publica uma tag em vez de um branch (produção: tag de submissão)
#
# Configuração: /opt/laprizza/deploy-web.conf (ver deploy-web.conf.example)
#
# Como funciona: extrai o commit, corre npm ci / lint / testes / build e copia
# o resultado (dist) para /var/www/laprizza/releases/<sha>. O nginx serve o
# link /var/www/laprizza/current, que é trocado de forma atómica. Não é preciso
# reiniciar nada.
# =============================================================================
set -Euo pipefail

CONFIG_FILE="${CONFIG_FILE:-/opt/laprizza/deploy-web.conf}"
# shellcheck disable=SC1090
[[ -r "$CONFIG_FILE" ]] && . "$CONFIG_FILE"

APP_ROOT="${APP_ROOT:-/opt/laprizza}"
REPO_DIR="${REPO_DIR:-$APP_ROOT/repo}"
WEB_ROOT="${WEB_ROOT:-/var/www/laprizza}"
RELEASES_DIR="${RELEASES_DIR:-$WEB_ROOT/releases}"
CURRENT_LINK="${CURRENT_LINK:-$WEB_ROOT/current}"
WORK_ROOT="${WORK_ROOT:-$WEB_ROOT/build}"
LOG_ROOT="${LOG_ROOT:-/var/log/laprizza/deploys/web}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_TAG="${DEPLOY_TAG:-}"
# O que é publicado: a tag, se estiver definida; senão, o branch.
DEPLOY_REF="${DEPLOY_TAG:+tag $DEPLOY_TAG}"
DEPLOY_REF="${DEPLOY_REF:-branch $DEPLOY_BRANCH}"
WEB_SUBDIR="${WEB_SUBDIR:-frontend}"
BUILD_OUTPUT="${BUILD_OUTPUT:-dist}"
BUILD_MUST_NOT_CONTAIN="${BUILD_MUST_NOT_CONTAIN-localhost:3000}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
RUN_LINT="${RUN_LINT:-true}"
RUN_TESTS="${RUN_TESTS:-true}"
SITE_URL="${SITE_URL:-https://localhost/}"
VERSION_URL="${VERSION_URL:-https://localhost/version.json}"
# Verificação local (loopback): confirma a versão publicada, não a validade do certificado, que
# não é emitido para "localhost". Pôr vazio se o certificado for válido para o SITE_URL.
HEALTH_CURL_TLS_OPTS="${HEALTH_CURL_TLS_OPTS---insecure}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-30}"
FORCE="${FORCE:-false}"
if ! declare -p WEB_BUILD_ENV &>/dev/null; then
  WEB_BUILD_ENV=()
fi

HISTORY_FILE="$LOG_ROOT/history.log"
TS="$(date +%Y%m%d-%H%M%S)"
STATUS=""
SHA="-"
RUN_DIR=""
REL=""
PREV=""
WORK=""
SWITCHED=false
ACTION="${1:-deploy}"

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }

current_release() { [[ -L "$CURRENT_LINK" ]] && readlink -f "$CURRENT_LINK" || true; }

record() {
  # Regista o resultado no histórico e na pasta da execução
  mkdir -p "$LOG_ROOT"
  printf '%s\t%s\t%s\t%s\t%s\n' "$TS" "$ACTION" "$DEPLOY_REF" "$SHA" "$STATUS" >> "$HISTORY_FILE"
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

health_check() {
  # $1 = sha curto esperado em /version.json
  local expected="$1" waited=0
  while (( waited < HEALTH_TIMEOUT_SECONDS )); do
    # shellcheck disable=SC2086 # HEALTH_CURL_TLS_OPTS pode estar vazio
    if curl -fsS $HEALTH_CURL_TLS_OPTS --max-time 5 "$SITE_URL" >/dev/null 2>&1 \
       && curl -fsS $HEALTH_CURL_TLS_OPTS --max-time 5 "$VERSION_URL" 2>/dev/null | grep -q "$expected"; then
      return 0
    fi
    sleep 2; waited=$(( waited + 2 ))
  done
  return 1
}

cleanup_work() {
  # Apaga a pasta temporária do build (código + node_modules)
  cd "$APP_ROOT" 2>/dev/null || cd /
  if [[ -n "$WORK" && -d "$WORK" ]]; then rm -rf "$WORK"; fi
  return 0
}

fail() {
  # $1 = mensagem; $2 = estado (opcional)
  log "ERRO: $1"
  STATUS="${2:-FAILED}"
  cleanup_work
  if [[ "$SWITCHED" == true ]]; then
    if [[ -n "$PREV" && -d "$PREV" ]]; then
      log "A repor a versão anterior: $(basename "$PREV")"
      switch_to "$PREV"
      if health_check "$(basename "$PREV" | cut -c1-7)"; then
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
  # Mesmo ficheiro de lock do deploy do back end: nunca correm os dois ao mesmo tempo
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
  log "A verificar $DEPLOY_REF no GitHub…"
  local target_full
  if [[ -n "$DEPLOY_TAG" ]]; then
    git -C "$REPO_DIR" fetch --quiet --force origin "refs/tags/$DEPLOY_TAG:refs/tags/$DEPLOY_TAG" \
      || { STATUS="FETCH_FAILED"; log "ERRO: não foi possível obter a tag '$DEPLOY_TAG'."; record; exit 1; }
    target_full="$(git -C "$REPO_DIR" rev-parse "refs/tags/$DEPLOY_TAG^{commit}")"
  else
    git -C "$REPO_DIR" fetch --prune --quiet origin "$DEPLOY_BRANCH" \
      || { STATUS="FETCH_FAILED"; log "ERRO: não foi possível contactar o GitHub."; record; exit 1; }
    target_full="$(git -C "$REPO_DIR" rev-parse "origin/$DEPLOY_BRANCH")"
  fi
  SHA="${target_full:0:7}"
  PREV="$(current_release)"
  local prev_sha=""
  [[ -n "$PREV" ]] && prev_sha="$(basename "$PREV" | cut -c1-7)"

  if [[ "$SHA" == "$prev_sha" && "$FORCE" != true ]]; then
    log "Sem alterações: a versão $SHA já está publicada."
    exit 0
  fi

  start_run_log
  log "Deploy de $SHA ($DEPLOY_REF). Versão atual: ${prev_sha:-nenhuma}"

  REL="$RELEASES_DIR/$SHA"
  if [[ "$REL" == "$PREV" ]]; then
    REL="$RELEASES_DIR/$SHA-$TS"          # FORCE sobre a versão em execução
  elif [[ -d "$REL" ]]; then
    rm -rf "$REL"
  fi
  mkdir -p "$RELEASES_DIR" "$WORK_ROOT"

  # O repositório inteiro é extraído (e não só o front end) porque o build pode
  # precisar de ficheiros do back end (por exemplo o openapi.js usado pelo Orval).
  WORK="$WORK_ROOT/$SHA-$TS"
  mkdir -p "$WORK"
  log "→ extrair código"
  git -C "$REPO_DIR" archive "$target_full" | tar -x -C "$WORK" \
    || fail "não foi possível extrair o commit $SHA"
  [[ -d "$WORK/$WEB_SUBDIR" ]] || fail "a pasta '$WEB_SUBDIR' não existe no commit $SHA"
  log "  ok"

  cd "$WORK/$WEB_SUBDIR"
  run_step npm-ci npm ci --no-audit --no-fund
  if [[ "$RUN_LINT" == true ]]; then
    run_step lint npm run lint
  fi
  if [[ "$RUN_TESTS" == true ]]; then
    run_step tests env CI=true npm test
  fi
  run_step build env "${WEB_BUILD_ENV[@]}" npm run build

  [[ -f "$BUILD_OUTPUT/index.html" ]] || fail "o build não gerou '$BUILD_OUTPUT/index.html'"
  if [[ -n "$BUILD_MUST_NOT_CONTAIN" ]] && grep -rqF -- "$BUILD_MUST_NOT_CONTAIN" "$BUILD_OUTPUT"; then
    fail "o build contém '$BUILD_MUST_NOT_CONTAIN': a variável de ambiente do URL da API não foi aplicada (ver WEB_BUILD_ENV)"
  fi

  mkdir -p "$REL"
  cp -a "$BUILD_OUTPUT/." "$REL/" || fail "não foi possível copiar o build para $REL"
  cat > "$REL/version.json" <<EOF
{
  "sha": "$target_full",
  "shortSha": "$SHA",
  "branch": "$DEPLOY_REF",
  "commitDate": "$(git -C "$REPO_DIR" log -1 --format=%cI "$target_full")",
  "deployedAt": "$(date -u +%FT%TZ)"
}
EOF
  cleanup_work

  log "→ ativar versão $SHA"
  switch_to "$REL"
  SWITCHED=true
  log "→ verificar site (até ${HEALTH_TIMEOUT_SECONDS}s)"
  health_check "$SHA" || fail "a versão $SHA não respondeu corretamente em $SITE_URL / $VERSION_URL"
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
  switch_to "$target"
  SWITCHED=true
  health_check "$SHA" || fail "a versão $SHA não respondeu corretamente"
  touch "$target"            # passa a contar como a versão mais recente
  STATUS="SUCCESS"
  record
  log "SUCESSO: versão $SHA reposta."
}

do_status() {
  echo "Versão em execução: $(basename "$(current_release)" 2>/dev/null || echo nenhuma)"
  echo "Resposta de /version.json: $(curl -fsS $HEALTH_CURL_TLS_OPTS --max-time 5 "$VERSION_URL" 2>/dev/null | tr -d '\n' || echo 'sem resposta')"
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
