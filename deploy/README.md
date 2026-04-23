# Guia de Deploy – CIPOLATTI em VM Debian 12

Este pacote deixa o sistema **pronto para produção** em uma VM Linux Debian 12 (Bookworm), com MongoDB local, backend FastAPI rodando como serviço `systemd`, frontend React buildado e servido estaticamente pelo Nginx, proxy reverso `/api → FastAPI`, SSL automático via Let's Encrypt e firewall habilitado.

---

## 1. Pré-requisitos na VM

| Item | Recomendação |
|---|---|
| OS | Debian 12 (Bookworm) – funciona também em Ubuntu 22.04/24.04 |
| CPU / RAM | Mínimo 2 vCPU / 2 GB; recomendado 2 vCPU / 4 GB |
| Disco | 20 GB livres (fotos + Mongo crescem com o uso) |
| Portas abertas no firewall da cloud | **22** (SSH), **80** (HTTP), **443** (HTTPS) |
| Domínio | Um registro DNS `A` (ou `AAAA`) apontando para o IP público da VM, ex.: `portaria.suaempresa.com.br` |
| Usuário com `sudo` | Não use root direto |

> **Importante:** o certificado Let's Encrypt só será emitido depois que o DNS estiver propagado. Confira com `dig portaria.suaempresa.com.br +short` antes de começar.

---

## 2. Instalação em um comando

Copie o conteúdo da pasta `deploy/` (este diretório) para a VM, ou faça clone do repositório na própria VM:

```bash
sudo apt-get update && sudo apt-get install -y git
sudo git clone https://github.com/Tr3mbolon4/CONTROLE-ACESSO-CIPO-2.0.git /opt/cipolatti/src
cd /opt/cipolatti/src/deploy
sudo bash install_debian.sh portaria.suaempresa.com.br ti@suaempresa.com.br
```

Troque `portaria.suaempresa.com.br` pelo seu domínio e `ti@suaempresa.com.br` pelo e-mail de notificação do Let's Encrypt.

O script faz **tudo**:

1. Atualiza o apt e instala dependências base.
2. Instala **Node.js 20** + Yarn.
3. Instala **MongoDB 7 Community** e habilita no boot.
4. Cria o usuário de sistema `cipolatti` e o diretório `/opt/cipolatti`.
5. Faz clone do código em `/opt/cipolatti/src` e copia para `backend/` e `frontend/`.
6. Cria um **virtualenv Python** em `/opt/cipolatti/backend/.venv` e instala `requirements.txt`.
7. Gera um `.env` do backend com `JWT_SECRET` aleatório (`openssl rand -hex 64`) e domínio já preenchido.
8. Instala deps do frontend e gera o build estático (`yarn build`).
9. Instala o unit `cipolatti-backend.service` e habilita para iniciar no boot.
10. Configura o Nginx (proxy reverso + SPA fallback), UFW, e pede o certificado SSL via `certbot --webroot`.
11. Reload do Nginx já com HTTPS ativo.

Ao final você verá uma saída com a URL pública e os próximos passos.

---

## 3. Passos manuais pós-instalação

### 3.1 Revisar o `.env` do backend

```bash
sudo -u cipolatti nano /opt/cipolatti/backend/.env
```

Garanta:

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` estão setados com uma senha forte **antes** do primeiro start (eles criam o admin automaticamente).
- `CORS_ORIGINS` e `FRONTEND_URL` têm exatamente a URL pública do site (com `https://`).
- `EMERGENT_LLM_KEY` só é necessário se você for usar upload de fotos. Se não, deixe vazio.

Depois reinicie:

```bash
sudo systemctl restart cipolatti-backend
```

### 3.2 (Opcional) Popular com dados de exemplo

```bash
sudo -u cipolatti /opt/cipolatti/backend/.venv/bin/python \
    /opt/cipolatti/backend/seed_data.py
```

Cria 4 usuários extras (portaria/gestor/dsl/diretoria), 10 visitantes, 6 frotas, 8 funcionários, 5 diretores, 8 agendamentos e 6 carregamentos para a portaria validar todos os fluxos. **Idempotente** – pode rodar várias vezes.

### 3.3 Teste o site

Acesse `https://portaria.suaempresa.com.br/login` e faça login com o admin que você definiu no `.env`.

---

## 4. Arquitetura final na VM

```
                       Internet
                          │
                    ┌─────▼─────┐
                    │   Nginx   │  (443 SSL, 80 redirect)
                    └─────┬─────┘
             /              │  /api/*
             │              │
             ▼              ▼
   /opt/cipolatti/    127.0.0.1:8001
   frontend/build/    (uvicorn workers)
   (arquivos estáticos)      │
                             ▼
                       MongoDB local
                       127.0.0.1:27017
                       (banco: cipolatti)
```

Diretórios importantes:

| Caminho | O que é |
|---|---|
| `/opt/cipolatti/backend/` | código FastAPI + `.venv/` + `.env` |
| `/opt/cipolatti/frontend/build/` | bundle estático gerado pelo `yarn build` |
| `/opt/cipolatti/deploy/` | scripts, systemd, nginx config (referência) |
| `/etc/systemd/system/cipolatti-backend.service` | serviço do backend |
| `/etc/nginx/sites-available/cipolatti` | config Nginx |
| `/etc/letsencrypt/live/<dominio>/` | certificados SSL |
| `/var/log/cipolatti/` | logs do backend (stdout/stderr) |
| `/var/log/nginx/cipolatti.access.log` | logs de acesso do site |
| `/var/backups/cipolatti/AAAAMMDD-HHMMSS/` | snapshots do Mongo feitos pelo `update_debian.sh` |

---

## 5. Operação diária

### Status dos serviços

```bash
sudo systemctl status cipolatti-backend nginx mongod
```

### Logs em tempo real

```bash
sudo journalctl -u cipolatti-backend -f          # backend
sudo tail -f /var/log/nginx/cipolatti.access.log # acessos HTTP
sudo tail -f /var/log/nginx/cipolatti.error.log  # erros do nginx
```

### Restart

```bash
sudo systemctl restart cipolatti-backend
sudo systemctl reload nginx
```

### Atualizar o sistema (pull do Git + rebuild + restart)

```bash
sudo bash /opt/cipolatti/deploy/update_debian.sh
```

O script faz um `mongodump` automático em `/var/backups/cipolatti/` antes de atualizar.

### Backup manual do Mongo

```bash
sudo mongodump --uri="mongodb://127.0.0.1:27017" --db cipolatti \
    --out /var/backups/cipolatti/manual-$(date +%Y%m%d)
```

### Restore

```bash
sudo mongorestore --uri="mongodb://127.0.0.1:27017" --db cipolatti \
    /var/backups/cipolatti/<pasta>/cipolatti
```

### Renovação do SSL

O certbot instala um timer em `/etc/systemd/system/certbot.timer` automaticamente. Verifique:

```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Nada precisa ser feito manualmente – o Nginx recarrega sozinho após a renovação.

---

## 6. Boot automático

Tudo que o instalador habilita fica ativo depois de `reboot`:

- `mongod.service` → MongoDB
- `cipolatti-backend.service` → Backend FastAPI
- `nginx.service` → Frontend + proxy
- `certbot.timer` → Renovação do SSL

Para conferir:

```bash
sudo systemctl is-enabled mongod cipolatti-backend nginx
```

Deve retornar `enabled` para os três.

---

## 7. Hardening recomendado (opcional)

- **SSH:** desabilitar login de root e só aceitar chave pública (`/etc/ssh/sshd_config`).
- **Fail2Ban:** `sudo apt-get install fail2ban` – bloqueia IPs que erram muito login SSH e tentativas HTTP maliciosas.
- **Backups off-site:** agendar `mongodump` diário em `cron` e copiar para S3/Wasabi/B2.
- **Monitoramento:** Netdata, Uptime Kuma ou Grafana com node_exporter.
- **Troque o `JWT_SECRET`** se desconfiar de vazamento (todas as sessões serão invalidadas).
- **MongoDB com autenticação:** se a VM for compartilhada com outros sistemas, configure `security.authorization: enabled` no `mongod.conf` e atualize `MONGO_URL` com usuário/senha.

---

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Certbot falha com "Invalid response" | DNS ainda não propagado | Espere a propagação (`dig +short`) e rode `sudo certbot certonly --webroot -w /var/www/certbot -d dominio` |
| Frontend carrega mas login dá CORS error | `CORS_ORIGINS` / `FRONTEND_URL` errado no backend/.env | Ajuste e `sudo systemctl restart cipolatti-backend` |
| 502 Bad Gateway ao chamar `/api/*` | Backend caiu | `sudo journalctl -u cipolatti-backend -n 100` |
| Cookies de login não persistem | Site acessado via IP (não HTTPS com domínio) | Use o domínio com SSL – os cookies são `Secure; SameSite=None` |
| Erros de upload de foto (500) | `EMERGENT_LLM_KEY` não configurado | Pegue sua chave e coloque no backend/.env, ou remova o módulo de fotos |
| Nginx retorna `404` em rotas SPA | Build não foi feito ou `root` apontando errado | `cd /opt/cipolatti/frontend && yarn build` e confira o `root` em `/etc/nginx/sites-available/cipolatti` |

---

## 9. Desinstalar

```bash
sudo systemctl disable --now cipolatti-backend
sudo rm -f /etc/systemd/system/cipolatti-backend.service /etc/nginx/sites-enabled/cipolatti /etc/nginx/sites-available/cipolatti
sudo systemctl reload nginx
sudo rm -rf /opt/cipolatti /var/log/cipolatti /var/backups/cipolatti
sudo userdel cipolatti
# Opcional: remover mongod e o banco
sudo systemctl disable --now mongod
sudo apt-get purge -y mongodb-org*
sudo rm -rf /var/lib/mongodb /var/log/mongodb /etc/apt/sources.list.d/mongodb-org-7.0.list
```
