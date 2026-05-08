# Deploy em VM Linux

Este guia assume Ubuntu 22.04 ou 24.04, mas funciona com pequenas adaptações em outras distros.

## 1. Pacotes do sistema

```bash
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip nginx nodejs npm
```

## 2. Clonar o projeto

```bash
cd /opt
sudo git clone https://github.com/Tr3mbolon4/CONTROLE-ACESSO-CIPO-2.0.git controle-acesso-portaria
sudo chown -R $USER:$USER /opt/controle-acesso-portaria
cd /opt/controle-acesso-portaria
```

## 3. Configurar o backend

```bash
cd /opt/controle-acesso-portaria
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Edite `backend/.env` com pelo menos:

```env
JWT_SECRET=troque-esta-chave
ADMIN_EMAIL=admin@portaria.com
ADMIN_PASSWORD=uma-senha-forte
FRONTEND_URL=http://SEU_IP_OU_DOMINIO
SQLITE_PATH=/opt/controle-acesso-portaria/backend/data/portaria.db
STORAGE_BACKEND=local
LOCAL_STORAGE_DIR=/opt/controle-acesso-portaria/backend/uploads
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

Se for usar HTTPS com domínio, troque para:

```env
FRONTEND_URL=https://seu-dominio.com
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

## 4. Testar backend manualmente

```bash
cd /opt/controle-acesso-portaria
source .venv/bin/activate
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

Se quiser testar a API:

```bash
BASE_URL=http://127.0.0.1:8000 python3 backend_test.py
```

## 5. Configurar o frontend

```bash
cd /opt/controle-acesso-portaria/frontend
npm install
REACT_APP_BACKEND_URL=http://SEU_IP_OU_DOMINIO npm run build
```

Se frontend e backend ficarem no mesmo host com Nginx, também funciona sem `REACT_APP_BACKEND_URL`, porque o frontend agora usa `window.location.origin` como fallback.

## 6. Criar serviço systemd

Crie `/etc/systemd/system/controle-portaria.service`:

```ini
[Unit]
Description=Controle de Acesso Portaria API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/controle-acesso-portaria
EnvironmentFile=/opt/controle-acesso-portaria/backend/.env
ExecStart=/opt/controle-acesso-portaria/.venv/bin/uvicorn backend.server:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Ative:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now controle-portaria
sudo systemctl status controle-portaria
```

## 7. Configurar Nginx

Crie `/etc/nginx/sites-available/controle-portaria`:

```nginx
server {
    listen 80;
    server_name _;

    root /opt/controle-acesso-portaria/frontend/build;
    index index.html;

    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

Ative:

```bash
sudo ln -s /etc/nginx/sites-available/controle-portaria /etc/nginx/sites-enabled/controle-portaria
sudo nginx -t
sudo systemctl restart nginx
```

## 8. Persistência e backup

Arquivos importantes:

- Banco SQLite: `/opt/controle-acesso-portaria/backend/data/portaria.db`
- Uploads locais: `/opt/controle-acesso-portaria/backend/uploads`
- Configuração: `/opt/controle-acesso-portaria/backend/.env`

Exemplo de backup:

```bash
tar -czf /backup/controle-portaria-$(date +%F).tar.gz \
  /opt/controle-acesso-portaria/backend/data \
  /opt/controle-acesso-portaria/backend/uploads \
  /opt/controle-acesso-portaria/backend/.env
```

## 9. Atualização

```bash
cd /opt/controle-acesso-portaria
git pull
source .venv/bin/activate
pip install -r backend/requirements.txt
cd frontend
npm install
npm run build
sudo systemctl restart controle-portaria
sudo systemctl restart nginx
```
