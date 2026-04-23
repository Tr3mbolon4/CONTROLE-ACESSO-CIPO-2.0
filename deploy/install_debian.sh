#!/usr/bin/env bash
# =============================================================================
# CIPOLATTI - Script de instalação em Debian 12 (Bookworm)
# =============================================================================
# Uso (como root ou com sudo):
#   sudo bash install_debian.sh portaria.suaempresa.com.br admin@suaempresa.com.br
#
# Argumentos:
#   $1 = domínio (obrigatório)       ex: portaria.suaempresa.com.br
#   $2 = email p/ Let's Encrypt      ex: ti@suaempresa.com.br
# =============================================================================

set -euo pipefail

DOMAIN="${1:-}"
LE_EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$LE_EMAIL" ]]; then
    echo "Uso: sudo bash install_debian.sh <dominio> <email-letsencrypt>"
    echo "Ex:  sudo bash install_debian.sh portaria.empresa.com.br ti@empresa.com.br"
    exit 1
fi

if [[ $EUID -ne 0 ]]; then
    echo "Este script precisa ser executado como root (use sudo)."
    exit 1
fi

APP_USER="cipolatti"
APP_DIR="/opt/cipolatti"
REPO_URL="https://github.com/Tr3mbolon4/CONTROLE-ACESSO-CIPO-2.0.git"
LOG_DIR="/var/log/cipolatti"

echo
echo "==> [1/9] Atualizando apt e instalando pacotes base..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates curl wget gnupg git build-essential \
    python3 python3-venv python3-pip \
    nginx ufw \
    certbot python3-certbot-nginx

echo
echo "==> [2/9] Instalando Node.js 20 LTS + Yarn..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1)" != "v20" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
npm install -g yarn >/dev/null 2>&1

echo
echo "==> [3/9] Instalando MongoDB 7 (Community Edition)..."
if ! command -v mongod >/dev/null 2>&1; then
    curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
        gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" \
        > /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -y
    apt-get install -y mongodb-org
fi
systemctl enable --now mongod

echo
echo "==> [4/9] Criando usuário de sistema '$APP_USER' e diretórios..."
if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
fi
mkdir -p "$APP_DIR" "$LOG_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$LOG_DIR"

echo
echo "==> [5/9] Clonando (ou atualizando) código em $APP_DIR/src..."
if [[ -d "$APP_DIR/src/.git" ]]; then
    sudo -u "$APP_USER" git -C "$APP_DIR/src" pull --ff-only
else
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR/src"
fi
# Copiar árvore para /opt/cipolatti/backend e /opt/cipolatti/frontend
sudo -u "$APP_USER" rsync -a --delete "$APP_DIR/src/backend/" "$APP_DIR/backend/"
sudo -u "$APP_USER" rsync -a --delete "$APP_DIR/src/frontend/" "$APP_DIR/frontend/"
# Copiar pacote de deploy (este diretório)
sudo -u "$APP_USER" rsync -a "$APP_DIR/src/deploy/" "$APP_DIR/deploy/"

echo
echo "==> [6/9] Preparando backend Python (.venv + dependências)..."
sudo -u "$APP_USER" python3 -m venv "$APP_DIR/backend/.venv"
sudo -u "$APP_USER" "$APP_DIR/backend/.venv/bin/pip" install --upgrade pip wheel
sudo -u "$APP_USER" "$APP_DIR/backend/.venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

if [[ ! -f "$APP_DIR/backend/.env" ]]; then
    cp "$APP_DIR/deploy/backend.env.example" "$APP_DIR/backend/.env"
    # Gerar JWT_SECRET aleatório
    JWT_SECRET="$(openssl rand -hex 64)"
    sed -i "s#TROQUE_ESTE_SEGREDO_POR_ALGO_DE_128_CARACTERES_ALEATORIOS#${JWT_SECRET}#" "$APP_DIR/backend/.env"
    # Substituir domínio
    sed -i "s#portaria.suaempresa.com.br#${DOMAIN}#g" "$APP_DIR/backend/.env"
    chown "$APP_USER":"$APP_USER" "$APP_DIR/backend/.env"
    chmod 640 "$APP_DIR/backend/.env"
    echo "    [OK] backend/.env criado - revise-o antes de subir o serviço."
else
    echo "    [skip] backend/.env já existe - preservado."
fi

echo
echo "==> [7/9] Build do frontend (React)..."
if [[ ! -f "$APP_DIR/frontend/.env" ]]; then
    cp "$APP_DIR/deploy/frontend.env.example" "$APP_DIR/frontend/.env"
    sed -i "s#portaria.suaempresa.com.br#${DOMAIN}#g" "$APP_DIR/frontend/.env"
    chown "$APP_USER":"$APP_USER" "$APP_DIR/frontend/.env"
fi
sudo -u "$APP_USER" bash -c "cd $APP_DIR/frontend && yarn install --frozen-lockfile"
sudo -u "$APP_USER" bash -c "cd $APP_DIR/frontend && yarn build"

echo
echo "==> [8/9] Instalando unit systemd do backend..."
install -m 0644 "$APP_DIR/deploy/systemd/cipolatti-backend.service" \
    /etc/systemd/system/cipolatti-backend.service
systemctl daemon-reload
systemctl enable cipolatti-backend
systemctl restart cipolatti-backend

echo
echo "==> [9/9] Configurando Nginx + firewall + SSL (Let's Encrypt)..."
install -m 0644 "$APP_DIR/deploy/nginx/cipolatti" /etc/nginx/sites-available/cipolatti
sed -i "s#portaria.suaempresa.com.br#${DOMAIN}#g" /etc/nginx/sites-available/cipolatti
ln -sf /etc/nginx/sites-available/cipolatti /etc/nginx/sites-enabled/cipolatti
rm -f /etc/nginx/sites-enabled/default

# Firewall
if command -v ufw >/dev/null 2>&1; then
    ufw allow OpenSSH || true
    ufw allow 'Nginx Full' || true
    yes | ufw enable || true
fi

mkdir -p /var/www/certbot

# Preparar Nginx em HTTP primeiro (sem SSL) para o certbot validar
cat > /etc/nginx/sites-available/cipolatti-bootstrap <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 "cipolatti bootstrap"; add_header Content-Type text/plain; }
}
EOF
ln -sf /etc/nginx/sites-available/cipolatti-bootstrap /etc/nginx/sites-enabled/cipolatti-bootstrap
rm -f /etc/nginx/sites-enabled/cipolatti

nginx -t
systemctl reload nginx

# Emitir certificado
certbot certonly --webroot -w /var/www/certbot \
    --non-interactive --agree-tos --email "${LE_EMAIL}" \
    -d "${DOMAIN}" || {
        echo "!! Falha ao emitir certificado. Verifique se o DNS do domínio aponta para este servidor."
        exit 1
    }

# Trocar do bootstrap para config final com SSL
rm -f /etc/nginx/sites-enabled/cipolatti-bootstrap
ln -sf /etc/nginx/sites-available/cipolatti /etc/nginx/sites-enabled/cipolatti
nginx -t
systemctl reload nginx

# Renovação automática (cron do certbot já vem instalado; aqui só testa)
certbot renew --dry-run || true

echo
echo "================================================================="
echo "✔ Instalação concluída."
echo "   Serviços ativos:"
systemctl --no-pager --lines=0 status mongod cipolatti-backend nginx | grep -E "●|Active:"
echo
echo "   URL pública:   https://${DOMAIN}"
echo "   Backend local: http://127.0.0.1:8001"
echo
echo "   Próximos passos:"
echo "     1) Edite $APP_DIR/backend/.env e defina ADMIN_EMAIL / ADMIN_PASSWORD antes de logar."
echo "        sudo systemctl restart cipolatti-backend"
echo "     2) (Opcional) Rodar seed de dados:"
echo "        sudo -u cipolatti $APP_DIR/backend/.venv/bin/python $APP_DIR/backend/seed_data.py"
echo "     3) Acesse o site no navegador e faça o primeiro login."
echo "================================================================="
