# ControlaVenda

Aplicação full-stack de gestão comercial com frontend React/Vite, API Node.js/Express e banco SQLite local. O projeto não utiliza Vercel, Supabase ou serviços proprietários de hospedagem para executar as regras do sistema.

## Arquitetura atual

- **Frontend:** React 19 + React Router + Vite.
- **Build:** `npm run build`.
- **Saída estática:** `dist`.
- **Backend/API:** Express em `server/index.ts`.
- **Banco:** SQLite em `data/controlavenda.sqlite`, persistido pelo módulo `server/db.ts`.
- **Cliente de API:** `src/lib/localApi.ts`.
- **Autenticação:** interna, com sessões locais e senhas protegidas por hash.
- **Rotas:** client-side com React Router.

Não há `vercel.json`, `@vercel/*`, Vercel Functions, Vercel KV, Vercel Blob, Vercel Postgres, Vercel Analytics ou middleware da Vercel no projeto.

## Execução local

Requisitos: Node.js 20 ou superior.

```text
npm install
npm run dev
```

O frontend ficará disponível em `http://localhost:8080` e a API local em `http://localhost:3001`. O comando `npm run dev` inicia os dois processos juntos.

Na primeira execução, o banco é criado automaticamente em `data/controlavenda.sqlite`. Essa pasta é ignorada pelo Git para não sobrescrever os dados locais. Para usar outro diretório, copie `.env.example` para `.env` e ajuste `CONTROLAVENDA_DATA_DIR`.

## Deploy do frontend no Netlify

O arquivo `netlify.toml` já está configurado com:

- Comando de build: `npm run build`
- Diretório de publicação: `dist`
- Node.js: versão 20
- Fallback SPA: qualquer rota é encaminhada para `/index.html`

No Netlify, configure antes do build:

```text
VITE_API_URL=https://SEU-BACKEND.exemplo.com/api
```

Essa variável é incorporada ao bundle durante o build. Ela deve apontar para a API pública que executa `server/index.ts`, sempre terminando em `/api`.

### Limitação importante do banco

O Netlify hospeda o frontend estático, mas não oferece um processo Node persistente nem disco persistente para este SQLite. Por isso, para manter o banco e todos os dados existentes, a API deve ser executada em uma VPS, Render, Railway ou outro servidor Node.js com volume persistente.

O fluxo recomendado é:

1. Publique o frontend deste repositório no Netlify.
2. Publique a API Node no servidor escolhido executando `npm install`, `npm run build` e `npm run start`.
3. Mantenha `data/controlavenda.sqlite` em um volume persistente da API. Se já existir um banco com dados, copie esse arquivo para o volume sem recriá-lo.
4. No backend, configure `FRONTEND_ORIGIN` com o domínio público do Netlify.
5. No Netlify, configure `VITE_API_URL` com a URL pública da API e execute um novo deploy.

Não movi nem recriei dados do SQLite. Essa separação permite usar Netlify para o frontend sem transformar o banco em armazenamento efêmero de Functions.

## Variáveis de ambiente

| Variável | Onde configurar | Obrigatória | Uso |
| --- | --- | --- | --- |
| `VITE_API_URL` | Netlify, durante o build | Sim em produção | URL pública da API, com `/api` |
| `PORT` | Servidor da API | Não | Porta do Express; padrão `3001` |
| `CONTROLAVENDA_DATA_DIR` | Servidor da API | Não | Diretório persistente do SQLite; padrão `./data` |
| `FRONTEND_ORIGIN` | Servidor da API | Não | Origem permitida pelo CORS; padrão local `http://localhost:8080` |

Não há credenciais ou tokens privados no código. O `.env.example` contém somente exemplos de configuração.

## Produção em servidor Node.js

```text
npm install
npm run build
npm run start
```

O Express serve o conteúdo compilado de `dist` quando ele existe e também expõe a API local. A mesma estrutura pode ser hospedada em VPS, Render, Railway, Cloudflare com runtime Node compatível ou outro servidor Node.js.

## Backend no Render com SQLite persistente

O backend pode ser executado como um Render Web Service sem alterar o SQLite existente.

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Persistent Disk mount path:** `/var/data`
- **SQLite directory:** `/var/data`
- **SQLite file:** `/var/data/controlavenda.sqlite`
- **Health check:** `/api/health`

Configure no Web Service:

```text
PORT=10000
CONTROLAVENDA_DATA_DIR=/var/data
FRONTEND_ORIGIN=https://controlavendas.netlify.app
```

O Render injeta a porta do serviço; o servidor escuta `PORT` e também se liga a `0.0.0.0`, como exigido para acesso externo. O Persistent Disk deve ser montado em `/var/data` e o arquivo SQLite existente pode ser copiado para `/var/data/controlavenda.sqlite` antes da primeira inicialização. A cópia preserva a estrutura e os dados; não execute o serviço com um diretório temporário.

O tamanho mínimo prático do Persistent Disk é **1 GB**. Para crescimento do histórico e cópias de segurança, prefira começar com **5 GB**. O SQLite atual não usa uploads ou outros diretórios de filesystem além do diretório configurado por `CONTROLAVENDA_DATA_DIR`.

Depois que o Render fornecer a URL, por exemplo `https://controlavenda-api.onrender.com`, configure no Netlify durante o build:

```text
VITE_API_URL=https://controlavenda-api.onrender.com/api
```

As rotas de autenticação, banco, RPCs de venda, clientes, produtos, financeiro, orçamentos e demais operações são expostas sob `/api` e usam o token Bearer enviado pelo frontend. O CORS responde com a origem definida em `FRONTEND_ORIGIN`.

## Funcionalidades preservadas

Dashboard, nova venda, leitor de código de barras, cadastro rápido de produto, produtos, clientes, financeiro, orçamentos, descontos, estoque, pagamentos, histórico, auditoria, relatórios, PDF e conversão de orçamento em venda continuam no frontend atual. O painel de caixa apresenta entradas, saídas e saldo individualmente por dia.
