#!/usr/bin/env bash
# =============================================================================
# CIPOLATTI - Script de atualização (deploy subsequente)
# =============================================================================
# Use este script toda vez que quiser atualizar o código em produção.
# Ele faz pull do Git, reinstala dependências, rebuilda o frontend e reinicia
# os serviços com zero perda de dados no MongoDB.
#
# Uso:
#   sudo bash /opt/cipolatti/deploy/update_debian.sh
# =============================================================================

set -euo pipefail

APP_USER="cipolatti"
APP_DIR="/opt/cipolatti"

if [[ $EUID -ne 0 ]]; then
    echo "Este script precisa ser executado como root (use sudo)."
    exit 1
fi

echo "==> Backup rápido do MongoDB..."
BACKUP_DIR="/var/backups/cipolatti/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
mongodump --uri="mongodb://127.0.0.1:27017" --db cipolatti --out "$BACKUP_DIR" || \
    echo "    (backup falhou - continuando mesmo assim)"

echo "==> Git pull..."
sudo -u "$APP_USER" git -C "$APP_DIR/src" pull --ff-only

echo "==> Sincronizando árvores..."
sudo -u "$APP_USER" rsync -a --delete --exclude='.venv' --exclude='.env' \
    "$APP_DIR/src/backend/" "$APP_DIR/backend/"
sudo -u "$APP_USER" rsync -a --delete --exclude='node_modules' --exclude='build' --exclude='.env' \
    "$APP_DIR/src/frontend/" "$APP_DIR/frontend/"
sudo -u "$APP_USER" rsync -a "$APP_DIR/src/deploy/" "$APP_DIR/deploy/"

echo "==> Atualizando deps backend..."
sudo -u "$APP_USER" "$APP_DIR/backend/.venv/bin/pip" install --upgrade -r "$APP_DIR/backend/requirements.txt"

echo "==> Atualizando deps frontend + build..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR/frontend && yarn install --frozen-lockfile"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/frontend && yarn build"

echo "==> Reinstalando unit systemd (caso tenha mudado)..."
install -m 0644 "$APP_DIR/deploy/systemd/cipolatti-backend.service" \
    /etc/systemd/system/cipolatti-backend.service
systemctl daemon-reload

echo "==> Reiniciando serviços..."
systemctl restart cipolatti-backend
systemctl reload nginx

echo "==> Status:"
systemctl --no-pager --lines=0 status cipolatti-backend nginx mongod | grep -E "●|Active:"
echo
echo "✔ Atualização concluída. Backup em: $BACKUP_DIR"
