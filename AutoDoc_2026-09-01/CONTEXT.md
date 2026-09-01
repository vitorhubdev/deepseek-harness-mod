# Contexto do Projeto

> 00:33 -2026-09-01

## Identidade

- Repositório: `vitorhubdev/deepseek-harness-mod`
- Branch padrão: `master`
- Snapshot analisado: `f5b014c2064a712c8e469097c03218e076afa3f3`
- Versão do fork/mod: `1.0.3`
- Upstream incorporado no snapshot: linha `dsh 0.1.2-alpha.3`
- Licença: MIT

## Objetivo do fork

`DeepMod`/`RASNER` estende o DeepSeek Harness preservando a arquitetura-base de plugins do upstream. As mudanças de maior impacto concentram-se em distribuição desktop OneBinary/Electron, onboarding e provedores alternativos, i18n, observabilidade de boot e atualização automática.

## Mapa de alto nível

| Área | Papel |
|---|---|
| `apps/cli` | launcher Node oficial `dsh`; seleciona profiles e encaminha argumentos ao app |
| `apps/web` | entrada do frontend Web/Vite |
| `packages/` | plugins, bundles, serviços, ferramentas, UI e infraestrutura Cordis |
| `OneBinary/electron` | empacotamento Electron do DeepMod/RASNER |
| `native/` | componentes nativos auxiliares |
| `python/` | SDK Python e runtime empacotado que reutiliza o launcher `dsh` |
| `docs/` | documentação de arquitetura, desenvolvimento e subsistemas |
| `scripts/` | build, gates, verificações, geração e release |
| `.github/workflows/` | CI, matriz de compatibilidade e builds OneBinary |

## Fluxo principal de execução

1. O usuário inicia `dsh` por `apps/cli`.
2. O launcher seleciona um profile (`web`, `headless`, `sdk`, `sdk-minimal`, `acp` etc.).
3. O profile monta bundles Cordis em ordem e aplica patches de configuração.
4. Plugins registram serviços, eventos e efeitos reversíveis em um contexto compartilhado.
5. Sessões registram fatos duráveis em um log append-only; projeções derivam estado consumível.
6. No modo Web, o host HTTP serve a aplicação e a API autenticada; no OneBinary, Electron fornece a janela e integra o mesmo runtime do Harness.

## Modificações relevantes do DeepMod 1.0.3

- distribuição Electron multi-plataforma com `electron-builder`;
- auto-update por `electron-updater`;
- splash RASNER com progresso e logs;
- suporte curado a idiomas adicionais no fluxo OneBinary/onboarding;
- seleção de provedores/modelos sem exigir somente DeepSeek oficial;
- persistência externa ao executável via `DSH_HOME`/user data;
- pipeline GitHub Actions para artefatos Windows, Linux e macOS.

## Invariantes operacionais

- Node suportado: `^22.19.0 || >=24.0.0`.
- Gerenciador fixado: `pnpm@11.7.0` via Corepack.
- O build TypeScript é dividido em agregados Host e Client; não achatar ambos em um único `ts.Program`.
- O frontend de um checkout de fonte precisa estar previamente construído para `dsh web`.
- O Web GUI é loopback-first; `--host 0.0.0.0` é rejeitado pelo bundle Web por segurança.
- Dados de sessão/model-visible devem ser reconstruíveis a partir do log de sessão.
- Segredos nunca devem ser versionados; o projeto aceita `.env` gitignored na raiz.

## Fontes canônicas consultadas

- `package.json`
- `README.md`
- `CHANGELOG.md`
- `docs/architecture.md`
- `docs/development.md`
- `apps/cli/README.md`
- `apps/web/package.json`
- `packages/bundle/web-app/README.md`
- `packages/host/webserver/README.md`
- `OneBinary/electron/package.json`
