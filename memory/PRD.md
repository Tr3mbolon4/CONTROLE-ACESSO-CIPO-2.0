# PRD - Sistema CIPOLATTI - Controle de Acesso

## Data: 2026-04-13

## Problema Original
Sistema de Controle de Acesso CIPOLATTI - repositório GitHub existente com bugs de login e problemas de qualidade de código:
1. Erro de login - usuários não conseguem logar após criação
2. Admin também perde acesso após horas
3. Vulnerabilidades XSS via document.write
4. Missing hook dependencies no React
5. Array index como React key
6. Comparações is vs == no Python

## Arquitetura
- **Frontend:** React.js + Tailwind CSS + Shadcn/UI + Radix UI
- **Backend:** Python FastAPI
- **Database:** MongoDB
- **Storage:** Emergent Object Storage
- **Auth:** JWT (httpOnly cookies) + bcrypt

## User Personas
- **Admin:** Gerencia tudo (usuários, configurações, todos os módulos)
- **Portaria:** Cadastra, edita, visualiza registros de visitantes/frota/funcionários/diretoria
- **Gestor:** Visualização total, relatórios, agendamentos
- **DSL:** Agendamento de carregamentos
- **Diretoria:** Visualização gerencial

## Core Requirements
- Autenticação JWT segura com cookies httpOnly
- CRUD de visitantes, frota, funcionários, diretoria
- Agendamentos com "dar entrada" automático
- Relatórios com exportação PDF/Excel
- Upload de fotos para frota e carregamentos
- Dashboard com estatísticas diárias

## Correções Realizadas (2026-04-13)

### 1. Bug Crítico de Login CORRIGIDO
**Causa raiz:** Token de acesso expirava em 15 minutos sem refresh automático
- **Fix:** Token de acesso aumentado para 8 horas (duração de expediente)
- **Fix:** Cookie max_age aumentado para 28800 segundos (8h)
- **Fix:** Cookies agora com secure=True e samesite=none (necessário para HTTPS)
- **Fix:** CORS corrigido - removido wildcard `*` com allow_credentials=True

### 2. Loop Infinito de Redirecionamento CORRIGIDO
**Causa raiz:** Interceptor do axios tentava refresh em endpoints de auth, causando loop
- **Fix:** Interceptor agora ignora endpoints /auth/me, /auth/refresh, /auth/login, /auth/register
- **Fix:** AuthContext agora usa instância `api` com interceptor (não axios raw)

### 3. XSS via document.write CORRIGIDO
- Reports.js, Fleet.js, Directors.js, Carregamentos.js: `window.open()` + `document.write()` agora com null check e `document.open()` 

### 4. Array Index as React Key CORRIGIDO
- Reports.js: Keys agora usam `item.id` e `col` name em vez de índices

### 5. Nota sobre `is None` no Python
- As 43 instâncias de `is None`/`is not None` são **corretas** em Python (None é singleton). Não foram alteradas.

## Status
- Backend: 100% (11/11 testes) 
- Frontend: 100% (10/10 testes)
- Overall: 100% (21/21 testes)

## Correções Realizadas (2026-04-14) - Agendamentos 422 + React Crash

### 5. Erro 422 ao criar agendamento CORRIGIDO
**Causa raiz:** Frontend enviava strings vazias `""` para campos `Optional[float]` como `km_saida`, e Pydantic não conseguia converter `""` em float
- **Fix:** Criada função `cleanFormData()` em `/app/frontend/src/utils/errorUtils.js` que converte strings vazias para `null` antes de enviar ao API
- **Fix:** Aplicada em Agendamentos.js e Carregamentos.js

### 6. React crash "Objects are not valid as a React child" CORRIGIDO
**Causa raiz:** `toast.error(error.response?.data?.detail)` tentava renderizar o array de objetos do 422 `[{type, loc, msg, input, url}]` como JSX
- **Fix:** Criada função `formatApiError()` que converte objetos de erro do FastAPI em strings legíveis
- **Fix:** Aplicada em 13 ocorrências em 7 arquivos (Agendamentos, Carregamentos, Directors, Employees, Fleet, Settings, Visitors)
- Missing hook dependencies em useEffect (warnings, não causam bugs)
- Refatoração de componentes grandes (700-1200 linhas)
- Refatoração de funções backend complexas (dar_entrada_agendamento)

## Backlog (P2)
- Extrair componentes de formulário/modal/tabela em arquivos separados
- Adicionar validação de dados mais robusta
- Adicionar testes unitários
