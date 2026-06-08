#!/bin/bash
set -euo pipefail

WORKERS=${WORKERS:-1}
WORKER_CLASS=${WORKER_CLASS:-gevent}
ACCESS_LOG=${ACCESS_LOG:--}
ERROR_LOG=${ERROR_LOG:--}
WORKER_TEMP_DIR=${WORKER_TEMP_DIR:-/dev/shm}
SECRET_KEY=${SECRET_KEY:-}
SKIP_DB_PING=${SKIP_DB_PING:-false}

# Auto-provision a stable SECRET_KEY so multi-worker mode works without manual setup.
# All gunicorn workers must share one fixed key, otherwise sessions break across workers
# (gunicorn runs without --preload, so each worker would otherwise generate its own key).
# The repo is mounted read-only, so upstream's .ctfd_secret_key auto-write cannot persist;
# instead we keep the key on a writable, restart-persistent volume and pass it via the env.
if [ -z "$SECRET_KEY" ] && [ ! -f .ctfd_secret_key ]; then
    SECRET_KEY_FILE="/var/lib/ctfd-secret/.ctfd_secret_key"
    mkdir -p "$(dirname "$SECRET_KEY_FILE")"
    if [ ! -s "$SECRET_KEY_FILE" ]; then
        SECRET_KEY_FILE="$SECRET_KEY_FILE" python -c "import os; open(os.environ['SECRET_KEY_FILE'], 'w').write(os.urandom(64).hex())"
    fi
    SECRET_KEY="$(cat "$SECRET_KEY_FILE")"
    export SECRET_KEY
fi

# Check that a .ctfd_secret_key file or SECRET_KEY envvar is set
if [ ! -f .ctfd_secret_key ] && [ -z "$SECRET_KEY" ]; then
    if [ $WORKERS -gt 1 ]; then
        echo "[ ERROR ] You are configured to use more than 1 worker."
        echo "[ ERROR ] To do this, you must define the SECRET_KEY environment variable or create a .ctfd_secret_key file."
        echo "[ ERROR ] Exiting..."
        exit 1
    fi
fi

# Skip db ping if SKIP_DB_PING is set to a value other than false or empty string
if [[ "$SKIP_DB_PING" == "false" ]]; then
  # Ensures that the database is available
  python ping.py
fi

# Initialize database
flask db upgrade

# Start CTFd
echo "Starting CTFd"
exec gunicorn 'CTFd:create_app()' \
    --bind '0.0.0.0:8000' \
    --workers $WORKERS \
    --worker-tmp-dir "$WORKER_TEMP_DIR" \
    --worker-class "$WORKER_CLASS" \
    --access-logfile "$ACCESS_LOG" \
    --error-logfile "$ERROR_LOG"
