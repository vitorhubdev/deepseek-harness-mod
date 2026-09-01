# Setup

> 00:33 -2026-09-01

## Pré-requisitos

- Git `>=2.26`;
- Node.js `22.19+` ou `24+` (o root também aceita `>=24` conforme `engines`);
- Corepack habilitado;
- pnpm `11.7.0` resolvido pelo `packageManager` do root.

## 1. Clone

```sh
git clone https://github.com/vitorhubdev/deepseek-harness-mod.git
cd deepseek-harness-mod
```

## 2. Ative Corepack

```sh
corepack enable
pnpm --version
```

A versão esperada neste snapshot é `11.7.0`.

## 3. Configure ambiente

Copie o exemplo deste AutoDoc para a raiz:

```sh
cp AutoDoc_2026-09-01/.env.example .env
```

Preencha apenas o que usar. Para chamadas reais à DeepSeek:

```dotenv
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=...
```

`DEEPSEEK_BASE_URL` é opcional. Nunca faça commit do `.env` com credenciais.

## 4. Instale dependências

```sh
pnpm install
```

O `postinstall` configura Lefthook e integrações Git locais. Se ele tiver sido ignorado/restaurado de cache:

```sh
node scripts/install-lefthook.mjs
```

## 5. Valide o checkout

Validação mínima recomendada após clone limpo:

```sh
pnpm run typecheck
```

Validação ampla:

```sh
pnpm run check:all
```

## 6. Build

```sh
pnpm run build
```

Ordem conceitual do build:

```text
Host tsc -> Host tsdown/Typert -> Client tsc -> Client tsdown -> Web build
```

## 7. Rodar Web UI

Depois do build:

```sh
pnpm dsh web
```

Por padrão a UI local usa `127.0.0.1:3080` e pode abrir o navegador. Para não abrir automaticamente:

```sh
pnpm dsh web --no-open
```

Para outra porta:

```sh
pnpm dsh web --no-open --port 8080
```

### Segurança de rede

Não use `--host 0.0.0.0`: o bundle Web atual rejeita esse binding por design. Não contorne essa política em Docker/reverse proxy sem uma decisão arquitetural explícita e revisão de autenticação/origin/trusted-hosts.

## 8. Rodar headless

Com `DEEPSEEK_API_KEY` configurada:

```sh
pnpm dsh --profile headless "summarize this workspace"
```

## 9. Desenvolvimento Web

Depois de um build completo inicial:

```sh
pnpm run dev:web
```

ou

```sh
pnpm run mod:watch
```

## 10. OneBinary Electron

Validação do bundle Electron:

```sh
pnpm run build:official
pnpm --filter onebinary-electron run typecheck
pnpm --filter onebinary-electron run build:bundle
```

Builds nativos:

```sh
pnpm --filter onebinary-electron run build:win
pnpm --filter onebinary-electron run build:linux
pnpm --filter onebinary-electron run build:mac
```

Prefira executar cada build final no sistema operacional correspondente ou pela matriz GitHub Actions.

## Docker deste AutoDoc

Os arquivos Docker fornecidos são para reproduzir instalação, typecheck, build e testes em Linux. Eles não são a forma canônica de executar a Web UI, porque o Web bundle é loopback-only por design.

```sh
docker compose -f AutoDoc_2026-09-01/docker-compose.yml build

docker compose -f AutoDoc_2026-09-01/docker-compose.yml run --rm harness pnpm run typecheck
```

## Makefile

A partir da pasta `AutoDoc_2026-09-01`:

```sh
make install
make typecheck
make build
make test
make check
```

## Troubleshooting

### `pnpm` não encontrado

```sh
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

### Web informa que frontend não foi construído

```sh
pnpm run build
```

### E2E real é ignorado

Confirme `DEEPSEEK_API_KEY` no ambiente ou `.env` da raiz. Os testes de API real se auto-ignoram sem a chave.

### Hooks Git ausentes

```sh
node scripts/install-lefthook.mjs
```
