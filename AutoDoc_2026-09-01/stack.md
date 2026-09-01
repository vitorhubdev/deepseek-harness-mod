# Stack

> 00:33 -2026-09-01

## Runtime

| Tecnologia | Versão | Uso |
|---|---:|---|
| Node.js | `^22.19.0 || >=24.0.0` | runtime principal, CLI, Host e scripts |
| pnpm | `11.7.0` | package manager/workspaces |
| TypeScript | `^6.0.3` | linguagem principal e contratos Host/Client |
| Python | suporte auxiliar via `python/` | SDK e runtime empacotado |
| Electron | linha 44 no OneBinary | distribuição desktop DeepMod/RASNER |

## Aplicações e framework

| Tecnologia | Versão/linha | Uso |
|---|---:|---|
| Cordis | workspace interno | arquitetura de plugins, serviços e efeitos |
| React | `^18.2.0` | UI Web |
| React DOM | `^18.2.0` | renderização Web |
| Vite | `^6.0.0` | build do frontend |
| WebSocket (`ws`) | `8.21.0` | transporte Web |
| Electron Builder | configurado em `OneBinary/electron` | empacotamento Win/Linux/macOS |
| electron-updater | `6.8.9` conforme changelog do fork | atualização automática do OneBinary |

## Dependências principais

| Lib/subsistema | Versão | Para quê |
|---|---:|---|
| `@deepseek-ai/dsh-*` | workspace | serviços, tools, bundles, UI e runtime do Harness |
| `@deepseek-ai/cordis*` | workspace | composição de plugins |
| `@deepseek-ai/dsh-session-persistence-jsonl` | workspace | persistência baseada em eventos/JSONL |
| `@deepseek-ai/dsh-session-query-sqlite` | workspace | consulta/indexação SQLite de sessões |
| `@deepseek-ai/dsh-llm-*` | workspace | adaptadores de LLM |
| `@deepseek-ai/dsh-mcp-client` | workspace | integração MCP |

## Dev dependencies

| Lib | Versão | Para quê |
|---|---:|---|
| `tsx` | `^4.22.4` | execução de scripts TypeScript |
| `tsdown` | `^0.22.2` | bundling das faces Host/Client |
| `vitest` | `^4.1.8` | testes |
| `@vitest/coverage-v8` | `^4.1.8` | cobertura |
| `oxlint` | `1.76.0` | lint |
| `oxlint-tsgolint` | `7.0.2001` | regras TypeScript para Oxlint |
| `lefthook` | `^2.1.9` | hooks Git locais |
| `jscpd` | `^5.0.12` | detecção de duplicação |
| `fast-check` | `^4.8.0` | property-based testing |
| `mermaid` | `11.16.0` | diagramas/documentação |
| `jsdom` | `29.1.1` | ambiente DOM de testes |

## Banco de dados / persistência

- Tipo: arquitetura híbrida orientada a log de sessão.
- Persistência durável: eventos/log append-only, com implementação JSONL no workspace.
- Consulta/indexação: SQLite através de `dsh-session-query-sqlite`.
- ORM: nenhum ORM relacional central foi identificado como requisito do projeto.
- Dados de usuário: ficam sob `DSH_HOME`/diretório de dados da aplicação conforme a superfície.

## Infra / Deploy

- Repositório e releases: GitHub.
- CI/CD: GitHub Actions e arquivo legado/alternativo `.gitlab-ci.yml` presente no repositório.
- OneBinary: matriz GitHub Actions para Windows, Ubuntu e macOS.
- Artefatos desktop: portable/NSIS no Windows, AppImage/deb no Linux, dmg/zip no macOS.
- Web UI: execução local-first via `dsh web`, normalmente em `127.0.0.1:3080`.
- Docker: não é a via canônica do projeto; os arquivos deste AutoDoc servem para reproduzir instalação/gates, não para burlar a política de binding da Web UI.

## ⚠️ Versões travadas / sensíveis

- `pnpm@11.7.0`: fixado em `packageManager`; atualizar apenas junto com validação do lockfile e CI.
- Node `22.19+`/`24+`: respeitar `engines`; não documentar Node 20 como suportado.
- `oxlint 1.76.0`, `oxlint-tsgolint 7.0.2001`, `mermaid 11.16.0`, `jsdom 29.1.1`: versões exatas no root manifest; mudanças podem afetar gates/snapshots.
- Separação Host/Client: não é uma versão, mas é um contrato de build que não deve ser simplificado sem ADR.

## Comandos principais

```sh
pnpm install
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run check:all
pnpm dsh web
pnpm run build:official
pnpm --filter onebinary-electron run build:bundle
```

## Variáveis de ambiente relevantes

- `DEEPSEEK_API_KEY` — credencial para adapter real/demos.
- `DEEPSEEK_BASE_URL` — endpoint DeepSeek alternativo; opcional.
- `DSH_HOME` — diretório de estado/configuração do Harness.
- `DSH_TOOLS_MODE` — opt-in de modo de apresentação de tools em composições que o consomem.
- `BROWSER` — escolha do executável para handoff do navegador; somente ambiente herdado.

Variáveis gerenciadas pelo runtime, como `DSH_WEB_URL`, não devem ser pré-configuradas no `.env.example` como se fossem input do usuário.
