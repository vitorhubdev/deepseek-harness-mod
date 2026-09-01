# DeepSeek Harness — DeepMod `v1.0.3` (RASNER)

> **📋 Changelog prioritário:** veja [`CHANGELOG.md`](CHANGELOG.md) — `v1.0.3` traz OneBinary 249 MB, 5 idiomas, auto-update e login livre. **Criado por [VitorHub](https://github.com/VitorHub/deepseek-harness-mod)** — mod `RASNER` © 2026 VitorHub (upstream MIT © DeepSeek AI).

> **📚 Snapshot técnico:** [`AutoDoc_2026-09-01/`](AutoDoc_2026-09-01/) — contexto, arquitetura/ADRs, stack, setup, contribuição, changelog operacional e ambiente reproduzível. `> 00:33 -2026-09-01`

> **⭐ Uma estrela ajudaria no desenvolvimento** — *A star would help development* — *Один лайк поможет развитию* — *Una estrella ayudaría* — *一颗星星有助于发展* — deixe sua ⭐ em [VitorHub/deepseek-harness-mod](https://github.com/VitorHub/deepseek-harness-mod)!

English | [中文](README.zh.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [Español](README.es.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## DeepMod Modifications & Features — v1.0.3 (RASNER OneBinary)

Este fork/mod (`DeepMod`/`RASNER`) foca em **um clique, sem navegador** e base `deepseek-ai/deepseek-harness` intacta:

- **OneBinary `DeepMod 1.0.2.exe`** — `OneBinary/electron/out/DeepMod 1.0.2.exe` (~249 MB, Electron 44, `asar:false`, 264 `@deepseek-ai/dsh-*` + `cordis` bundled) gerado por `pnpm --filter onebinary-electron run build:win` (`C:/Temp/onebinary-electron-out/DeepMod 1.0.2.exe`). Clique duplo extrai para `%LOCALAPPDATA%\Temp\7z...` e abre na tela do app, não no navegador. Sessões/plugins ficam em `%APPDATA%\onebinary-electron\.dsh` (externo, `shared-onebinary-env.ts`), sobrevivem ao trocar o `.exe`. Ver [docs/onefile-viability.md](docs/onefile-viability.md).
- **Splash RASNER** — `Iniciando o RASNER…` + `?` tooltip, barra `0→100%` com `plugins 121/121`, `Live log — avançado` (800 linhas, filtro `all/info/warn/error`, níveis com cor) e dois caminhos de cópia: `Copiar p/ GitHub` (markdown com sistema) e `Copiar p/ LLM` (prompt vibe-coded com `121 plugins`, `hasAuth`, `debugInfo`). `DSH_HOME` e `F12` visíveis.
- **i18n curado, não exaustivo** — 5 built-in `en` (default) / `zh` / `pt` / `ru` / `es` (`packages/client/locale/src/locale-settings.ts:7` `LOCALE_IDS`), cada um `44 chaves common` + `language.title`, `pnpm --filter dsh-client-locale run bundle` + `vite build` validam completude; `en` é fallback. Extensível via `locale.addLanguage({id, label, fallback})` sem novo build. Detecção via `app.getLocale()` + `navigator.languages`; se `osLocales.length>1` destaca o picker; **“Não perguntar novamente”** (`localStorage['rasner-lang-dont-ask']` no splash e `localStorage['dsh-onboarding-dont-ask']` no `Add an API key`) persiste entre reinícios.
- **Login livre** — o modal `Add an API key to get started` mantém `deepseek-official` mas adiciona “Ou escolha outro método” com `OpenCode Go` / `Codex` / `Outra API` + lista dinâmica de provedores (`state.rows`) e **barrinha de busca** `Buscar arquivo local (.env, config.json)` via `window.showOpenFilePicker`/`<input type=file>` (regex `sk-/ds-`), sem exigir `~/.dsh` oficial.
- **Gerenciamento de provedores herdado v1.0.1** — `version.ts` `DeepMod v1.0.3`, `default-urls.ts` (+20 provedores, `Effective URL` + cópia), `Fetch available models` (`X models detected (Y new)`, tag `new`), atalho `Add / Manage providers` no composer, subprocessos Windows (PowerShell/CMD 1.2.0-beta.15), SQLite e `oxlint` (`version.ts` centraliza `1.0.3` em `package.json:3`, `OneBinary/electron/package.json:5`, `assets/splash.html` e `ui-settings-general`).

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

### AutoDoc 2026-09-01

O snapshot [`AutoDoc_2026-09-01/`](AutoDoc_2026-09-01/) consolida o estado técnico deste fork em `f5b014c`: stack real, arquitetura/ADRs, setup, convenções de contribuição, histórico resumido e arquivos auxiliares de build/test reproduzível. O snapshot não substitui os manifests e documentos canônicos do projeto; em caso de divergência, prevalece o código/configuração atual.

## Créditos

- **Upstream:** [DeepSeek AI](https://github.com/deepseek-ai/deepseek-harness) — MIT (`LICENSE` original).
- **Mod “RASNER” / OneBinary:** [VitorHub](https://github.com/VitorHub/deepseek-harness-mod) — modificações © 2026 VitorHub, distribuídas sob **MIT** mantendo o `Copyright (c) 2026 DeepSeek` (ver `LICENSE`). Se este mod te ajudou, deixe uma ⭐ em [VitorHub/deepseek-harness-mod](https://github.com/VitorHub/deepseek-harness-mod) — ajuda a proteger o trabalho e a comunidade.
- **Auto-update:** via `electron-updater` + GitHub Releases (`publish.provider: github` em `electron-builder.yml`). O app checa em background a cada 6h e no boot (8s); se `latest.yml` apontar `v1.0.3`, baixa e mostra `⬇ Atualizar` no splash/`Settings`.

## License

[MIT](LICENSE) — `Copyright (c) 2026 DeepSeek AI (upstream)` + `Copyright (c) 2026 VitorHub — Mod RASNER`. Respeitando a licença original, sua parte (OneBinary, splash, i18n curado, onboarding livre) é sua, mas o todo permanece MIT.

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
