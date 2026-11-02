# API Monitor

API em Node.js que consulta os containers visíveis ao Docker, mede CPU e
memória e salva o histórico dessas medições em um banco PostgreSQL. Este
repositório contém a API e o banco; não contém uma interface web.

Este guia explica como iniciar o ambiente, testar os endpoints, encontrar as
métricas e diagnosticar problemas. Os exemplos de terminal são para Windows
PowerShell e usam `curl.exe`.

## O que você precisa

- Windows com Docker Desktop instalado e iniciado, usando containers Linux.
- Docker Compose v2 (`docker compose`).
- Uma porta TCP `3000` livre para a API e uma porta `5433` livre para o banco.
- Acesso à internet na primeira inicialização para baixar a imagem do
  PostgreSQL e as dependências da API.

O container da API precisa acessar o socket do Docker do host. O Compose monta
`/var/run/docker.sock` dentro do container da API para que ela possa consultar
os containers. Se o Docker Desktop não disponibilizar esse socket, a API pode
iniciar, mas as rotas que consultam containers não conseguirão obter métricas.

## 1. Preparar o projeto

Abra o PowerShell na pasta do projeto:

```powershell
cd C:\caminho\para\api-monitor
```

Crie o arquivo `.env` a partir do exemplo:

```powershell
Copy-Item .env.example .env
```

Abra `.env` e substitua `POSTGRES_PASSWORD` por uma senha local. Por exemplo:

```dotenv
POSTGRES_USER=monitor
POSTGRES_PASSWORD=minha_senha_local
POSTGRES_DB=monitoring
POSTGRES_HOST_PORT=5433
```

Não publique nem compartilhe o `.env`. As linhas `DB_HOST` e `DB_PORT` do
exemplo são para uma execução da API diretamente no host; no Compose, a API
usa automaticamente o hostname `postgres` e a porta interna `5432`.

## 2. Iniciar a API e o PostgreSQL

Na pasta do projeto, execute:

```powershell
docker compose up --build
```

Na primeira execução, o Docker pode levar alguns minutos para baixar a imagem
do banco e construir a imagem da API. Mantenha esse terminal aberto: o Compose
continua exibindo os logs enquanto os serviços estão ativos. Isso é esperado,
não significa que o comando travou.

O Compose inicia:

| Serviço | Endereço no host | Uso |
| --- | --- | --- |
| API | `http://localhost:3000` | Endpoints HTTP e métricas |
| PostgreSQL | `localhost:5433` | Armazenamento do histórico |

O PostgreSQL precisa ficar saudável antes de a API iniciar. Quando a API
estiver pronta, procure nos logs uma mensagem semelhante a:

```text
Server is running on port 3000
```

Para ver o estado dos containers em outro terminal, execute na pasta do
projeto:

```powershell
docker compose ps
```

Os serviços `api` e `postgres` devem estar em execução; o PostgreSQL deve
aparecer como `healthy`.

## 3. Confirmar que a API está respondendo

Abra um segundo PowerShell e consulte o endpoint de saúde:

```powershell
curl.exe -i http://localhost:3000/health
```

Uma resposta normal tem status HTTP `200` e corpo JSON semelhante a:

```json
{
  "status": "ok",
  "message": "API is running"
}
```

Também é possível abrir `http://localhost:3000/health` no navegador. A rota
`/health` só confirma que a API responde; ela não confirma sozinha o acesso ao
Docker nem ao histórico do banco.

## 4. Consultar serviços e métricas atuais

Faça a chamada:

```powershell
curl.exe -i http://localhost:3000/services
```

A resposta de sucesso é uma lista JSON, por exemplo:

```json
[
  {
    "id": "identificador-do-container",
    "name": "nome-do-container",
    "status": "Up 3 minutes",
    "cpu": "1.25",
    "memory": 42.5
  }
]
```

O campo `cpu` representa o percentual de CPU calculado pela API. `memory` é a
memória em megabytes. A lista pode estar vazia se não houver containers em
execução visíveis ao Docker. A chamada também consulta métricas e grava uma
medição de cada serviço no PostgreSQL.

Para receber apenas o corpo JSON no PowerShell:

```powershell
curl.exe -s http://localhost:3000/services
```

### Obter métricas atuais de um container específico

Copie o valor de `id` retornado por `/services` e use-o na rota:

```powershell
curl.exe -i http://localhost:3000/services/IDENTIFICADOR_DO_CONTAINER/stats
```

A resposta é semelhante a:

```json
{
  "CPU": "1.25",
  "MEMORIA": 42.5,
  "CPUS": 4
}
```

Essa rota faz uma nova consulta ao Docker. Ela não é a mesma coisa que ler o
histórico do banco.

## 5. Consultar o histórico

A API coleta e salva métricas automaticamente na inicialização e, depois, a
cada 60 segundos. A consulta de `/services` também grava medições. Por isso,
logo após iniciar o ambiente, o histórico pode ainda estar vazio; aguarde uma
coleta ou consulte `/services` antes de pedir o histórico.

Use o nome do container mostrado no campo `name` da resposta de `/services`:

```powershell
curl.exe -i http://localhost:3000/services/NOME_DO_CONTAINER/metrics
```

Por exemplo, para um serviço chamado `web`:

```powershell
curl.exe -i http://localhost:3000/services/web/metrics
```

A rota retorna uma lista JSON ordenada da medição mais recente para a mais
antiga:

```json
[
  {
    "service_name": "web",
    "cpu": "1.25",
    "memory": "42.50",
    "collected_at": "2026-11-02T18:00:00.000Z"
  }
]
```

Se o nome contiver espaços ou caracteres especiais, codifique-o para URL antes
de montar o endereço. O endpoint devolve o histórico disponível; não há
paginação implementada.

### Conferir os registros diretamente no PostgreSQL

No PowerShell, na pasta do projeto, abra o cliente PostgreSQL dentro do
container:

```powershell
docker compose exec postgres psql -U monitor -d monitoring
```

Se alterou `POSTGRES_USER` ou `POSTGRES_DB` no `.env`, use os valores definidos
lá no lugar de `monitor` e `monitoring`. No prompt `psql`, execute:

```sql
SELECT service_name, cpu, memory, collected_at
FROM api_monitor.metrics
ORDER BY collected_at DESC
LIMIT 20;
```

Para sair do `psql`, digite `\q`.

## Endpoints disponíveis

| Método | Rota | O que faz |
| --- | --- | --- |
| `GET` | `/health` | Confirma que a API está respondendo. |
| `GET` | `/services` | Lista containers em execução, mede CPU e memória e salva as medições no PostgreSQL. |
| `GET` | `/services/:id/stats` | Consulta as métricas atuais de um container pelo ID. |
| `GET` | `/services/:name/metrics` | Consulta o histórico do container pelo nome. |

## Rodar os testes automatizados

Os testes existentes validam rotas HTTP com Docker e PostgreSQL simulados; não
precisam do Compose estar ligado. Em outro terminal, execute:

```powershell
npm ci
npm test
```

`npm ci` instala as dependências e termina quando concluir. `npm test` executa
os testes e também termina quando concluir. Para consultar dados reais do
Docker, é necessário iniciar os serviços com `docker compose up --build`,
conforme explicado acima.

## Parar e iniciar novamente

Para parar a API e o banco, pressione `Ctrl+C` no terminal em que executou
`docker compose up --build`. Depois, você pode iniciar novamente com:

```powershell
docker compose up
```

Os dados do PostgreSQL ficam no volume `postgres_data` e permanecem salvos
quando os containers param. **Não use `docker compose down -v` se quiser
preservar o histórico**: a opção `-v` remove também o volume de dados.

## Solução de problemas

### `Cannot GET /health`

Com este projeto iniciado corretamente, `GET /health` retorna JSON. Confira:

1. A URL é `http://localhost:3000/health` (porta `3000`), não a porta do
   PostgreSQL (`5433`).
2. `docker compose ps` mostra o serviço `api` ativo.
3. Os logs da API mostram `Server is running on port 3000`:

   ```powershell
   docker compose logs --tail=100 api
   ```

4. Se há outro programa usando a porta `3000`, pare-o ou libere a porta e
   inicie novamente com `docker compose up --build`.

`Cannot GET /health` indica que a requisição chegou a um servidor que não
reconhece essa rota. Verifique a porta e se o processo que está respondendo é
o container desta API.

### A chamada à API falha ou expira

Confira o estado e os logs dos serviços:

```powershell
docker compose ps
docker compose logs --tail=100 postgres
docker compose logs --tail=100 api
```

Confirme também que as portas `3000` e `5433` estão livres e que as variáveis
do `.env` estão preenchidas corretamente. Se o PostgreSQL já foi inicializado
com uma senha diferente, mudar `POSTGRES_PASSWORD` no `.env` não altera a senha
armazenada no volume existente.

### `/health` funciona, mas `/services` retorna erro

`/health` não consulta Docker. Já `/services` precisa que o Docker esteja
acessível pela API e que os containers retornados forneçam estatísticas.
Verifique se o Docker Desktop está iniciado, se há containers em execução e se
os logs da API mostram erros de acesso ao socket ou à coleta de estatísticas.

### A lista ou o histórico vem vazio

- Uma lista vazia em `/services` significa que não foram encontrados
  containers em execução acessíveis ao Docker.
- O histórico pode estar vazio antes da primeira coleta. Aguarde até um minuto
  ou chame `/services` e tente novamente.
- O nome usado na URL do histórico precisa corresponder exatamente ao campo
  `name` retornado por `/services`.

### `npm run dev` não funciona

Este repositório não possui interface front-end nem script `dev`. Para testar a
API, inicie-a com `docker compose up --build` e consulte as URLs
`http://localhost:3000` descritas neste guia.

## Estrutura do projeto

```text
src/
  app.js       # Aplicação Express e rotas HTTP
  database.js  # Configuração da conexão PostgreSQL
  init.sql     # Criação do schema e da tabela de métricas
  metrics.js   # Leitura das métricas Docker e persistência
  server.js    # Inicialização da API e coleta periódica
test/
  app.test.js  # Testes das rotas HTTP
compose.yaml   # API, PostgreSQL, portas e volume de dados
dockerfile    # Imagem da API
```
