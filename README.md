# ControlaVenda

Aplicação full-stack de gestão comercial com frontend React, API Node.js e banco SQLite local. O projeto não depende de Vercel, Supabase ou qualquer serviço externo para executar o ambiente de desenvolvimento.

## Execução local

Requisitos: Node.js 20 ou superior.

```text
npm install
npm run dev
```

O frontend ficará disponível em `http://localhost:8080` e a API local em `http://localhost:3001`. O comando `npm run dev` inicia os dois processos juntos.

Na primeira execução, o banco é criado automaticamente em `data/controlavenda.sqlite`. Essa pasta deve permanecer local e não precisa ser versionada. Para iniciar com outro diretório, copie `.env.example` para `.env` e ajuste `CONTROLAVENDA_DATA_DIR`.

## Produção em qualquer servidor Node.js

```text
npm install
npm run build
npm run start
```

A API serve o conteúdo compilado de `dist` quando ele existe. A mesma estrutura pode ser hospedada em uma VPS, Render, Railway, Cloudflare (com um servidor Node compatível) ou outro ambiente que execute Node.js. O deploy é apenas infraestrutura: as regras de negócio ficam em `server/index.ts` e o armazenamento em `server/db.ts`.

## Configuração

Todas as configurações são descritas em `.env.example`. Não coloque senhas, tokens ou credenciais no código. A autenticação de desenvolvimento é local, com contas armazenadas no SQLite e senhas protegidas por hash.

## Arquitetura

- `src/`: interface React, rotas e componentes.
- `src/lib/localApi.ts`: cliente HTTP local com uma interface compatível com as chamadas usadas pelas telas existentes.
- `server/index.ts`: API, autenticação, autorização e regras transacionais de vendas.
- `server/db.ts`: schema SQLite, persistência e transações.
- `data/`: banco SQLite criado em tempo de execução.

O schema usa tabelas relacionais e tipos simples que podem ser migrados posteriormente para PostgreSQL sem amarrar a aplicação a um provedor específico.
