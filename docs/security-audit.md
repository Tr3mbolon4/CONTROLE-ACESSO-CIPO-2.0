# Auditoria de seguranca preliminar

Data: 2026-07-30

| Item | Severidade | Acao nesta branch |
|---|---:|---|
| `JWT_SECRET` com fallback hardcoded | Alta | Removido; variavel de ambiente obrigatoria |
| Admin seed com email/senha padrao | Alta | Removido; variaveis obrigatorias |
| Escrita de credenciais em `/app/memory/test_credentials.md` | Alta | Removida |
| Testes com URL/credenciais fixas | Media | Movidos para variaveis de ambiente |
| Artefatos internos versionados | Media | Removidos do conteudo atual |

## Pendencias

- Limpar historico Git antigo.
- Confirmar se o repositorio deve permanecer publico.
- Rotacionar credenciais antigas se usadas fora de ambiente demonstrativo.
- Avaliar referencias de marca/cliente antes de manter o projeto publico.
