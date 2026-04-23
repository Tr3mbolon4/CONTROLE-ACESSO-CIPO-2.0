# PRD - Sistema CIPOLATTI - Controle de Acesso

## Problema Original
Clonar o repositório https://github.com/Tr3mbolon4/CONTROLE-ACESSO-CIPO-2.0 para fazer ajustes.
O usuário pediu para "Assume Default and Proceed" — ou seja, detectar e aplicar ajustes essenciais sem feedback explícito.

## Arquitetura
- **Frontend:** React 19 + Tailwind CSS + Shadcn/UI + Radix UI + Phosphor Icons
- **Backend:** Python FastAPI (`server.py` monolítico ~1900 linhas)
- **Database:** MongoDB
- **Storage:** Emergent Object Storage (usado p/ fotos de frota e carregamentos, via `EMERGENT_LLM_KEY`)
- **Auth:** JWT assinado com `JWT_SECRET` em cookies httpOnly + bcrypt

## User Personas
- **Admin:** Gerencia tudo (usuários, configurações, todos os módulos)
- **Portaria:** Cadastra, edita, visualiza registros de visitantes / frota / funcionários / diretoria
- **Gestor:** Visualização total, relatórios, agendamentos
- **DSL:** Agendamento de carregamentos
- **Diretoria:** Visualização gerencial

## Core Requirements
- Autenticação JWT segura com cookies httpOnly (access 8h + refresh 7d)
- CRUD de visitantes, frota, funcionários, diretoria, carregamentos
- Agendamentos com fluxo "dar entrada" para converter em registro ativo
- Relatórios com filtros por data e exportação PDF/Excel
- Upload de fotos (frota, carregamentos) com Object Storage
- Dashboard com estatísticas diárias e semanais
- Proteção anti-brute-force (5 tentativas → 429 por 15 min)

## O que foi feito nesta sessão (2026-04-23)

### Setup do ambiente
- Clonado o repo em `/app` (preservando `.git` e `.emergent` do pod) após o usuário tornar o repo público.
- Instaladas dependências backend (`pip install -r requirements.txt`) e frontend (`yarn install`).
- Limpo cache webpack de node_modules/.cache para resolver erros "Module not found" pós-instalação.
- Populado `/app/backend/.env` com `JWT_SECRET`, `EMERGENT_LLM_KEY`, `ADMIN_EMAIL/PASSWORD`, `FRONTEND_URL`, `CORS_ORIGINS`.
- Admin seedado automaticamente no lifespan: `admin@portaria.com` / `admin123`.

### Bugs corrigidos
1. **Cookies do /auth/login inconsistentes** (`server.py` linhas 437-438): o register/refresh usavam `secure=True, samesite="none", max_age=28800/604800` mas o login ainda estava com `secure=False, samesite="lax", max_age=900` (15min, fora do HTTPS ingress) — causa raiz da expiração prematura descrita no PRD original. Ajustado para ficar consistente.
2. **CORS com URL hardcoded antiga** (`server.py` ~1859): referência a `cipo-manager.preview.emergentagent.com` foi substituída por bloco dinâmico que lê `CORS_ORIGINS` do .env, com fallback a `allow_origin_regex='.*'` quando `CORS_ORIGINS="*"`, sempre mantendo `allow_credentials=True`.
3. **TypeError offset-naive vs offset-aware em brute-force** (`server.py` ~414): `last_attempt` salvo no Mongo podia voltar sem `tzinfo`, quebrando a subtração com `datetime.now(timezone.utc)`. Corrigido pelo testing agent com coerção explícita de `tzinfo=utc`.
4. **Brute-force rastreando IP errado atrás do ingress**: adicionada função `get_client_ip()` que lê `X-Forwarded-For` / `X-Real-IP` antes de cair no peer do socket. Garante que 5 tentativas reais de um mesmo cliente disparem o 429 em vez de ficarem diluídas entre pods do K8s.

### Testes
- Testing agent: **Backend 22/22 (100%)** — auth (login cookies flags, /me, refresh, logout, brute-force 429), CRUD completo de visitors/fleet/employees/directors/carregamentos/agendamentos, fluxo `dar-entrada`, dashboard, reports, history, roles e validação 422 para campos `Optional[float]`.

## Status atual
- Backend: 100% OK (endpoints públicos e protegidos funcionando, cookies corretos)
- Frontend: compila com 6 warnings (exhaustive-deps), não bloqueantes. Tela de login renderiza normalmente.
- Serviços: `backend`, `frontend`, `mongodb` rodando sob supervisor.

## Backlog (P2)
- Dividir `server.py` (~1900 linhas) em `routers/` (auth, visitors, fleet, etc.) para manutenibilidade.
- Refatorar checks `get_current_user` + `check_role` num `Depends(require_roles(...))` único.
- Padronizar envelope de erro `{code, message}` nas `HTTPException`.
- Resolver warnings `react-hooks/exhaustive-deps` em Visitors/Fleet/Employees/Directors/Carregamentos.
- Adicionar testes unitários de frontend (Playwright).
- Forçar normalização UTC em todos os writes ao Mongo para eliminar ambiguidade timezone.

## Próximos passos sugeridos ao usuário
- Testar o fluxo completo no frontend (login → dashboard → cadastrar visitante → agendamento → dar entrada).
- Trocar `JWT_SECRET` e `ADMIN_PASSWORD` antes de qualquer uso em produção.
- Configurar usuários reais (portaria/gestor/dsl/diretoria) via Configurações (admin).
