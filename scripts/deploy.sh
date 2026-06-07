#!/usr/bin/env bash
set -euo pipefail

# MyndBBS deployment template.
# Fill these values with environment variables before running the script.
# Example:
#   DEPLOY_SSH_HOST=example.com DEPLOY_SSH_USER=deploy DEPLOY_PUBLIC_URL=https://example.com ./scripts/deploy.sh deploy

SSH_HOST="${DEPLOY_SSH_HOST:-}"
SSH_PORT="${DEPLOY_SSH_PORT:-22}"
SSH_USER="${DEPLOY_SSH_USER:-}"
DEPLOY_DIR="${DEPLOY_DIR:-/path/to/myndbbs}"
BACKEND_IMAGE="${BACKEND_IMAGE:-myndbbs-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-myndbbs-frontend}"
DEPLOY_TAG="${DEPLOY_TAG:-deploy}"
PUBLIC_URL="${DEPLOY_PUBLIC_URL:-}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-myndbbs-postgres}"
DB_USER="${DB_USER:-myndbbs}"
DB_NAME="${DB_NAME:-myndbbs}"

BACKEND_TAR="${BACKEND_IMAGE}.tar"
FRONTEND_TAR="${FRONTEND_IMAGE}.tar"

info() { echo -e "\033[1;34m[INFO]\033[0m $*"; }
ok() { echo -e "\033[1;32m[OK]\033[0m $*"; }
err() { echo -e "\033[1;31m[ERROR]\033[0m $*"; exit 1; }

require_remote_config() {
  [ -n "$SSH_HOST" ] || err "DEPLOY_SSH_HOST is required"
  [ -n "$SSH_USER" ] || err "DEPLOY_SSH_USER is required"
  [ "$DEPLOY_DIR" != "/path/to/myndbbs" ] || err "DEPLOY_DIR must be set to your server deployment directory"
}

require_public_url() {
  [ -n "$PUBLIC_URL" ] || err "DEPLOY_PUBLIC_URL is required for health checks"
}

ssh_cmd() {
  ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "$@"
}

scp_upload() {
  scp -P "$SSH_PORT" "$1" "${SSH_USER}@${SSH_HOST}:${DEPLOY_DIR}/"
}

backup() {
  require_remote_config
  info "Creating backup on server..."
  BACKUP_DIR="${DEPLOY_DIR}/backup/$(date +%Y%m%d_%H%M%S)"
  ssh_cmd "mkdir -p '${BACKUP_DIR}' && \
    docker save '${BACKEND_IMAGE}:${DEPLOY_TAG}' -o '${BACKUP_DIR}/backend.tar' 2>/dev/null || echo 'No backend image to backup' && \
    docker save '${FRONTEND_IMAGE}:${DEPLOY_TAG}' -o '${BACKUP_DIR}/frontend.tar' 2>/dev/null || echo 'No frontend image to backup' && \
    cp '${DEPLOY_DIR}/docker-compose.yml' '${BACKUP_DIR}/docker-compose.yml' 2>/dev/null || true && \
    docker exec '${POSTGRES_CONTAINER}' pg_dump -U '${DB_USER}' '${DB_NAME}' > '${BACKUP_DIR}/db_dump.sql' 2>/dev/null || echo 'DB dump skipped'"
  ok "Backup created at ${BACKUP_DIR}"
}

build() {
  info "Building backend image..."
  docker build --no-cache -t "${BACKEND_IMAGE}:latest" -f packages/backend/Dockerfile .
  ok "Backend image built"

  info "Building frontend image..."
  docker build --no-cache -t "${FRONTEND_IMAGE}:latest" -f packages/frontend/Dockerfile .
  ok "Frontend image built"
}

upload() {
  require_remote_config
  info "Saving and uploading backend image..."
  docker save "${BACKEND_IMAGE}:latest" -o "$BACKEND_TAR"
  scp_upload "$BACKEND_TAR"
  ok "Backend image uploaded"

  info "Saving and uploading frontend image..."
  docker save "${FRONTEND_IMAGE}:latest" -o "$FRONTEND_TAR"
  scp_upload "$FRONTEND_TAR"
  ok "Frontend image uploaded"

  info "Cleaning up local tar files..."
  rm -f "$BACKEND_TAR" "$FRONTEND_TAR"
}

deploy_remote() {
  require_remote_config
  info "Loading images and restarting services on server..."
  ssh_cmd "set -e && \
    cd '${DEPLOY_DIR}' && \
    docker load -i '${BACKEND_TAR}' && \
    docker tag '${BACKEND_IMAGE}:latest' '${BACKEND_IMAGE}:${DEPLOY_TAG}' && \
    docker load -i '${FRONTEND_TAR}' && \
    docker tag '${FRONTEND_IMAGE}:latest' '${FRONTEND_IMAGE}:${DEPLOY_TAG}' && \
    docker compose up -d && \
    rm -f '${BACKEND_TAR}' '${FRONTEND_TAR}' && \
    echo 'Deployment complete'"
  ok "Services restarted"
}

health_check() {
  require_public_url
  info "Waiting for services to start..."
  sleep 15

  info "Checking backend health..."
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "${PUBLIC_URL%/}/api/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" -eq 200 ]; then
    ok "Backend health check passed (HTTP ${HTTP_CODE})"
  else
    err "Backend health check failed (HTTP ${HTTP_CODE})"
  fi

  info "Checking frontend health..."
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "${PUBLIC_URL%/}/" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" -eq 200 ]; then
    ok "Frontend health check passed (HTTP ${HTTP_CODE})"
  else
    err "Frontend health check failed (HTTP ${HTTP_CODE})"
  fi
}

rollback() {
  require_remote_config
  info "Finding latest backup..."
  LATEST_BACKUP=$(ssh_cmd "ls -td '${DEPLOY_DIR}'/backup/*/ 2>/dev/null | head -1")
  if [ -z "$LATEST_BACKUP" ]; then
    err "No backup found for rollback"
  fi

  info "Rolling back to: ${LATEST_BACKUP}"
  ssh_cmd "set -e && \
    docker load -i '${LATEST_BACKUP}/backend.tar' && \
    docker load -i '${LATEST_BACKUP}/frontend.tar' && \
    docker tag '${BACKEND_IMAGE}:latest' '${BACKEND_IMAGE}:${DEPLOY_TAG}' && \
    docker tag '${FRONTEND_IMAGE}:latest' '${FRONTEND_IMAGE}:${DEPLOY_TAG}' && \
    cd '${DEPLOY_DIR}' && docker compose up -d"
  ok "Rollback complete"
}

case "${1:-}" in
  build)
    build
    ;;
  upload)
    upload
    ;;
  deploy)
    backup
    build
    upload
    deploy_remote
    health_check
    ;;
  rollback)
    rollback
    ;;
  *)
    echo "Usage: $0 {build|upload|deploy|rollback}"
    echo ""
    echo "Required for upload/deploy/rollback:"
    echo "  DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_DIR"
    echo ""
    echo "Required for deploy health checks:"
    echo "  DEPLOY_PUBLIC_URL"
    echo ""
    echo "Optional:"
    echo "  DEPLOY_SSH_PORT, BACKEND_IMAGE, FRONTEND_IMAGE, DEPLOY_TAG,"
    echo "  POSTGRES_CONTAINER, DB_USER, DB_NAME"
    exit 1
    ;;
esac
