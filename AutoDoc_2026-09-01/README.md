# AutoDoc — 2026-09-01

> 00:33 -2026-09-01

Snapshot de contexto técnico do repositório `vitorhubdev/deepseek-harness-mod`, gerado a partir do estado do `master` em `f5b014c` (DeepMod `1.0.3`).

## Índice

- [`CONTEXT.md`](CONTEXT.md) — contexto, escopo e mapa do repositório.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — visão arquitetural e ADRs resumidos.
- [`stack.md`](stack.md) — runtimes, dependências, persistência e CI/CD.
- [`CHANGELOG.md`](CHANGELOG.md) — snapshot do histórico relevante do fork.
- [`changelog.md`](changelog.md) — template operacional para próximas mudanças.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — convenções de contribuição e validação.
- [`SETUP.md`](SETUP.md) — setup reproduzível a partir de um clone limpo.
- [`.env.example`](.env.example) — variáveis de ambiente sem segredos.
- [`Dockerfile`](Dockerfile) e [`docker-compose.yml`](docker-compose.yml) — ambiente reproduzível para instalação e gates de desenvolvimento.
- [`Makefile`](Makefile) — atalhos padronizados para tarefas frequentes.

## Fonte de verdade

Este diretório é um snapshot de contexto, não substitui os documentos canônicos do projeto. Em caso de divergência, prevalecem `package.json`, `pnpm-lock.yaml`, `docs/architecture.md`, `docs/development.md`, `AGENTS.md`, os `README.md` dos pacotes e os workflows em `.github/workflows/`.

## Convenção de atualização

Ao atualizar este snapshot:

1. confirmar o `master`/commit de referência;
2. atualizar `stack.md` a partir dos manifests reais;
3. registrar mudanças relevantes em `CHANGELOG.md`;
4. atualizar ADRs se uma decisão arquitetural mudou;
5. rodar ao menos `pnpm run typecheck` e os gates pertinentes ao escopo.
