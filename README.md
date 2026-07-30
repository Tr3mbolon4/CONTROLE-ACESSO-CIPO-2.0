# Controle de Acesso CIPO 2.0

Sistema web para controle operacional de acesso, portaria, visitantes, diretoria, frota, carregamentos, agendamentos, relatorios e fotos de evidencias.

> Status: em revisao para organizacao profissional e saneamento de dados sensiveis.

## Tecnologias

- Python
- FastAPI
- MongoDB
- React
- Tailwind CSS

## Configuracao

Use `.env.example` como base e defina segredos reais somente no ambiente seguro.

Nunca versione `.env`, bancos de dados, backups, fotos reais, tokens, CPFs, dados de visitantes, dados de funcionarios ou informacoes internas de cliente.

## Seguranca

Esta branch remove defaults sensiveis do backend e artefatos internos versionados do conteudo atual. A remocao nao limpa historico Git antigo.

Veja [SECURITY.md](SECURITY.md) e [docs/security-audit.md](docs/security-audit.md).

## Licenca

Projeto proprietario. Todos os direitos reservados.
