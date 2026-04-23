# CIPOLATTI - Sistema de Controle de Acesso

Sistema web para portarias controlarem visitantes, frota, funcionários, diretoria, carregamentos e agendamentos.

- **Stack:** FastAPI + MongoDB + React 19 + Tailwind/shadcn-ui
- **Auth:** JWT em cookies `HttpOnly; Secure; SameSite=None` (access 8h + refresh 7d) + bcrypt
- **Perfis:** admin, portaria, gestor, dsl, diretoria

---

## Rodando em desenvolvimento

O ambiente já vem configurado via supervisor (backend + frontend + mongod). Serviços relevantes:

```
backend   /app/backend/server.py       (FastAPI)  -> 127.0.0.1:8001
frontend  /app/frontend/               (CRA)      -> 3000
mongo    mongodb://127.0.0.1:27017
```

Admin default (criado no boot): **`admin@portaria.com` / `admin123`** — veja `memory/test_credentials.md`.

Seed de dados de teste (idempotente):

```bash
cd /app/backend && /root/.venv/bin/python seed_data.py
```

Popula 4 usuários extras, 10 visitantes, 6 registros de frota, 8 funcionários, 5 diretores, 8 agendamentos e 6 carregamentos.

---

## Deploy em VM Debian 12 (produção)

Tudo que você precisa está na pasta [`deploy/`](./deploy/):

- **`deploy/install_debian.sh`** – instalador 1-click (Python venv, Node 20, MongoDB 7, Nginx, Certbot, systemd, SSL Let's Encrypt).
- **`deploy/update_debian.sh`** – atualização com backup automático do Mongo.
- **`deploy/systemd/cipolatti-backend.service`** – unit do backend (autostart + hardening).
- **`deploy/nginx/cipolatti`** – vhost com HTTPS, HSTS, proxy `/api → FastAPI` e SPA fallback.
- **`deploy/backend.env.example`** / **`deploy/frontend.env.example`** – templates de `.env`.
- **`deploy/README.md`** – guia completo (passo a passo, arquitetura, operação, troubleshooting, hardening).

Instalação resumida na VM (depois de apontar o DNS):

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/Tr3mbolon4/CONTROLE-ACESSO-CIPO-2.0.git /opt/cipolatti/src
cd /opt/cipolatti/src/deploy
sudo bash install_debian.sh portaria.suaempresa.com.br ti@suaempresa.com.br
```

Veja o [guia completo](./deploy/README.md).

---

## Estrutura

```
backend/       FastAPI server + seed
frontend/      SPA React (pages/components/context/services)
deploy/        Pacote de produção p/ Debian (systemd + nginx + certbot)
memory/        PRD e credenciais de teste
tests/         (placeholder)
```
