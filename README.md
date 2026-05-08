# Controle de Acesso Portaria

Projeto de controle de acesso com frontend React e backend FastAPI.

## Ajuste feito

O backend foi preparado para funcionar com `SQLite` no lugar de `MongoDB`, pensando em deploy simples em VM Windows ou Linux sem depender de um serviço externo de banco.

## Estrutura

- `backend/server.py`: API principal
- `backend/local_db.py`: camada de persistencia compatível com o uso atual da API
- `backend/.env.example`: variaveis minimas para subir o backend
- `frontend/`: aplicacao React

## Backend em VM

1. Crie um `.env` dentro de `backend/` com base em `backend/.env.example`.
2. Ajuste `SQLITE_PATH` para o local onde o banco deve ficar salvo.
3. Instale as dependencias Python do backend.
4. Suba a API a partir da raiz do projeto com um comando como:

```bash
uvicorn backend.server:app --host 0.0.0.0 --port 8000
```

## Observacoes

- O armazenamento de fotos agora usa `STORAGE_BACKEND=local` por padrao, salvando arquivos no diretório configurado em `LOCAL_STORAGE_DIR`.
- Se voce quiser manter armazenamento externo, basta configurar `STORAGE_BACKEND` para outro modo e manter a chave `EMERGENT_LLM_KEY`.
- O script `backend_test.py` agora deve ser usado apontando para a URL local da API, por exemplo `BASE_URL=http://localhost:8000`.
- O passo a passo completo de VM Linux esta em `docs/DEPLOY_VM_LINUX.md`.

## Testes

- Foi validada a nova camada SQLite com teste funcional local.
- O script antigo de integracao contra `https://cipo-manager.preview.emergentagent.com` retornou `404` em todas as rotas no dia `2026-05-08`, entao ele nao serve mais como referencia confiavel do ambiente atual.
