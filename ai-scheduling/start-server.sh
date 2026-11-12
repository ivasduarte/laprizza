#!/bin/sh
# Starts the LaPrizza AI service (AI01) on 127.0.0.1:${AI_PORT:-5000}.
#
#   Git Bash, Linux or macOS:   ./ai-scheduling/start-server.sh   (from any folder)
#   Windows without Git Bash:   swipl ai-scheduling/server.pl      (server.pl also reads .env)
#
# Loads ai-scheduling/.env, if it exists (see .env.example). Variables already set in the
# environment win over the file, so this uses the VM for one run without editing it:
#   AI_BACKEND_URL=http://10.9.22.22/api/v1 ./ai-scheduling/start-server.sh

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 1
ENV_FILE="$DIR/.env"

trim() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    line=$(trim "$(printf '%s' "$line" | tr -d '\r')")
    case "$line" in '' | '#'*) continue ;; esac
    line=${line#export }
    case "$line" in *=*) ;; *) continue ;; esac
    key=$(trim "${line%%=*}")
    value=$(trim "${line#*=}")
    case "$key" in '' | [0-9]* | *[!A-Za-z0-9_]*) continue ;; esac
    case "$value" in
      \"*\") value=${value#\"}; value=${value%\"} ;;
      \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    eval "current=\${$key:-}"
    if [ -z "$current" ]; then
      export "$key=$value"
    fi
  done < "$ENV_FILE"
fi

exec swipl "$DIR/server.pl"
