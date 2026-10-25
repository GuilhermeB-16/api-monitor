# API Monitor

API em Node.js para listar containers Docker, consultar seu uso de CPU e memória
e armazenar métricas no PostgreSQL.

## Executar com Docker Compose

1. Copie `.env.example` para `.env` e defina uma senha local para
   `POSTGRES_PASSWORD`.
2. Inicie a API e o banco:

   ```sh
   docker compose up --build
   ```

A API fica disponível em `http://localhost:3000`. O PostgreSQL é publicado na
porta definida por `POSTGRES_HOST_PORT` (5433 por padrão no exemplo).

## Executar os testes

```sh
npm ci
npm test
```

Os testes da aplicação HTTP usam dependências simuladas; não precisam de Docker
ou PostgreSQL.

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/health` | Verifica se a API está respondendo. |
| `GET` | `/services` | Lista containers e coleta e armazena suas métricas. |
| `GET` | `/services/:id/stats` | Consulta as métricas atuais de um container pelo ID. |
| `GET` | `/services/:name/metrics` | Consulta o histórico de métricas de um serviço. |

Além da consulta em `/services`, a API coleta e armazena métricas dos containers
em intervalos de um minuto.

## Estrutura

```text
src/
  app.js       # Aplicação Express e rotas HTTP
  database.js  # Configuração da conexão PostgreSQL
  init.sql     # Estrutura inicial do banco
  metrics.js   # Leitura das métricas Docker e persistência
  server.js    # Inicialização do banco, servidor e coleta periódica
test/
  app.test.js  # Testes das rotas HTTP
```

O socket do Docker é montado no container da API pelo Compose para que ela possa
consultar os containers do host.
