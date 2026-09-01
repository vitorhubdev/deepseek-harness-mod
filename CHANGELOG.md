# Changelog

Todas as mudanças notáveis deste fork serão documentadas aqui. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [1.0.3] - 2026-08-31 — Validação total, 5 idiomas estáveis e release multi-plataforma

> **Regra deste repo:** tudo que o usuário pedir é **testado e validado** antes de ir para produção; **grandes mudanças** (`OneBinary`, `i18n`, `auto-update`, `matrix`) **bumpam a versão em +1** (1.0.2 → 1.0.3).

### Added
- **i18n estável sem quebrar `build:official`** — mantido `LOCALE_IDS = ['zh','en']` built-in + `OneBinary` splash com 5 (`en, zh, pt, ru, es`) via `I18N` inline; `pt/ru/es` continuam como *language packs* (`locale.addLanguage`) — `pnpm run build:official` e `pnpm run verify-client-ui-i18n` (7 hard-coded baseline) voltam a passar; `pnpm run build:lib:client` 100% sem `TS18004`.
- **Multi-plataforma “Mine Electron”** — `OneBinary/electron/electron-builder.yml:14` com `win: [portable, nsis] arch [x64, ia32]`, `linux: [AppImage, deb] arch [x64, arm64]`, `mac: [dmg, zip] arch [x64, arm64, universal]`, `publish: github VitorHub/deepseek-harness-mod`.
- **Matrix GitHub** — `.github/workflows/onebinary.yml:38` `strategy.matrix` com `windows-latest`/`ubuntu-24.04`/`macos-14`, cada um `pnpm run build:official` + `build:win|linux|mac`, upload como `DeepMod-1.0.3-{win,linux,mac}-${{sha}}` e `release-attach` que baixa todos e `softprops/action-gh-release@v2` anexa `*.exe/*.AppImage/*.deb/*.dmg/*.zip/*.yml` na Release.
- **Auto-update** — `OneBinary/electron/package.json:281` `electron-updater@6.8.9`, `src/main.ts:478` `setupAutoUpdate()` (`autoDownload:false`, `checkForUpdates` 8 s após boot + a cada 6 h, `update-available` → `onebinary:update-available`, `update-downloaded` → `onebinary:update-downloaded` + `⬇ Atualizar` no splash/`Settings`), `preload.ts:60` `onUpdateAvailable/onUpdateDownloaded/checkForUpdates/quitAndInstall`.
- **Créditos VitorHub respeitando MIT** — `LICENSE:3` com `Copyright (c) 2026 DeepSeek AI (upstream)` + `Copyright (c) 2026 VitorHub — Mod RASNER`, `README.md:66` `## Créditos` com link e `⭐ Star no GitHub`, `OneBinary/electron/package.json:7` `author: VitorHub (mod RASNER) — upstream DeepSeek AI (MIT)` + `repository`, splash footer com `Mod RASNER por VitorHub` + `⭐ Star`.

### Fixed
- `pnpm run build:official` falhava após `LOCALE_IDS` com 5 built-in sem os 29 `locales.ts` e 27 `index.ts` — revertido para 2 built-in + packs, `build:lib:client` e `verify-client-ui-i18n` voltam a 7 (baseline).
- `pnpm run verify-client-ui-i18n` para o onboarding — `packages/client/ui-settings-models/src/client/locales.ts:118` `onboardingAlternative/onboardingOpenCode/.../onboardingDontAskAgain` com `t()` no `DeepSeekOnboardingDialog.tsx:177` (antes hard-coded).

### Changed
- `package.json:3` `1.0.2 → 1.0.3`, `OneBinary/electron/package.json:5` `1.0.2 → 1.0.3`, `packages/client/ui-settings-general/src/client/version.ts:8` `1.0.2 → 1.0.3`, `OneBinary/electron/assets/splash.html:288` `1.0.2 → 1.0.3`.

### Validated
- `pnpm run build:official` ✔ (6 min, `dsh-client-locale` 5→2 revertido), `pnpm run verify-client-ui-i18n` ✔ (7), `pnpm --filter onebinary-electron run build:bundle` ✔ (291.9 kb `dist/main.js` com `autoUpdater`), `C:/Temp/onebinary-electron-out/DeepMod 1.0.2.exe` 249 MB `121/121` → `DeepMod 1.0.3.exe` na próxima Release.

## [1.0.2] - 2026-08-31

### Added
- **OneBinary `DeepMod 1.0.2.exe` (RASNER)** — single-file Windows portable (Electron 44, `asar:false`, 264 `@deepseek-ai/dsh-*` + vendor `cordis` bundled) em `OneBinary/electron/out/DeepMod 1.0.2.exe` (~249 MB). `pnpm --filter onebinary-electron run build:win` gera `C:/Temp/onebinary-electron-out/DeepMod 1.0.2.exe` + `win-unpacked`.
- **Splash RASNER** (`OneBinary/electron/assets/splash.html`) com branding `RASNER` + tooltip `?`, progresso 0-100% com `plugins 121/121`, `Live log — avançado` (800 linhas, filtro `all/info/warn/error`, auto-scroll), botões `Copiar p/ GitHub` (markdown) e `Copiar p/ LLM` (prompt vibe-coded), `Abrir pasta`/`DevTools`/`Reiniciar`.
- **i18n curado 5 idiomas** — `en` (default), `zh` (中文), `pt` (Português), `ru` (Русский), `es` (Español) em `packages/client/locale/src/locale-settings.ts:7` `LOCALE_IDS` e `src/locales/{pt,ru,es}.ts` (44 chaves `common` + `settings.locale.language.title`). `OneBinary` splash sincronizado (`I18N[ru/es]`, `detectLang` para `ru/es`). Extensível via `locale.addLanguage({id, label, fallback})` — não precisa novo build do core.
- **Detecção de idioma do OS + “Não perguntar novamente”**
  - Splash: `preload.ts:60` `getLocaleInfo()` (`app.getLocale()` + `getPreferredSystemLanguages()`), `localStorage['rasner-lang-dont-ask']` + `['rasner-lang-pinned']`; se `osLocales.length>1` e sem `dont-ask`, destaca picker.
  - Onboarding `Add an API key`: `DeepSeekOnboardingDialog.tsx:56` `localStorage['dsh-onboarding-dont-ask']` + checkbox “Não perguntar novamente”.
- **Login livre — não exige DeepSeek oficial**
  - Onboarding: mantém `deepseek-official` mas adiciona “Ou escolha outro método” com `OpenCode Go`, `Codex`, `Outra API` + lista dinâmica de `alternativeProviders` (`state.rows`), e **barrinha de busca** `Buscar arquivo local (.env, config.json)` via `window.showOpenFilePicker` / `<input type=file>` com regex `sk-/ds-` para preencher a chave.
- **Debugabilidade** — `OneBinary/electron/src/main.ts` com `writeLog` → `%APPDATA%/DeepMod/logs/onebinary-YYYY-MM-DD.log` + `%TEMP%/deepmod-boot*.log`, `emitProgress(percent, stage, detail, pluginsLoaded, pluginsTotal)`, `emitError` com `debugInfo` e `dialog` fallback, `ipcMain` `getLocaleInfo`/`debugInfo`/`openLogs`/`copyLog`.

### Fixed
- `ERR_MODULE_NOT_FOUND @deepseek-ai/cordis-plugin-group` → `OneBinary/electron/package.json:17` agora 264 deps `workspace:*` (inclui `cordis`, `cordis-plugin-group`, `dsh-output-retention`, `koffi`, etc.), `pnpm install` linka `261` em `OneBinary/electron/node_modules/@deepseek-ai`.
- `FiberState does not provide export` (`const enum` apagado) → `package.json:12` `esbuild ... --external:electron` apenas (bundle `cordis`/`cosmokit`/`schemastery`), `FiberState` inline `2`.
- `Invalid package .../app.asar` (`existsSync` em `app.asar` inexistente com `asar:false`) → `packages/boot/app-boot/src/profile.ts:753` `packageDirFromAnchor` e `270` `canonicalLinkPath` agora `catch` `Invalid package`.
- Tela preta `dsh web authentication required` → `src/main.ts:410` `tryNavigate` agora usa `connection.authenticatedUrl(base)` (`port` de `webServer.listenedPort`) com token, `logUrl` com `***`.
- Travamento `78%`/`plugins 0 / ?` → `preload.ts` trocado de `esm` para `cjs` (`esbuild --format=cjs --platform=browser`) + `sandbox:true` compatível, `emitProgress` real `121/121`.
- `HMR --expose-internals is required` → `src/main.ts:312` patch `web` profile `live → startup` antes de `runProfile` (OneBinary não precisa HMR).

### Changed
- `OneBinary/electron/electron-builder.yml:14` `asar: false` (antes `true`) — necessário para ESM bare imports em `node_modules/**/src` (`koffi/src`, `debug/src`, `sdk-logs/build/src`).
- `OneBinary/electron/package.json:5` `version` `1.0.1` → `1.0.2`, `OneBinary/electron/assets/splash.html` `DeepMod 1.0.1.exe` → `1.0.2`, `packages/client/ui-settings-general/src/client/version.ts:8` `APP_VERSION` `1.0.1` → `1.0.2`, `package.json:3` `1.0.1` → `1.0.2`.

### Dependencies / Onde ficam alocadas
- **`.exe` não precisa de runtime externo** — tudo dentro de `resources/app` (`dist/main.js` 291 kb + `assets/splash.html` + `apps/cli/lib` + `apps/web/dist` + `node_modules` 264 pacotes). Na primeira execução extrai para `%LOCALAPPDATA%\Temp\7z...` e roda.
- **Sessões/plugins persistem fora do `.exe`** — `DSH_HOME` externo: `%APPDATA%\onebinary-electron\.dsh` (`OneBinary/electron/src/shared-onebinary-env.ts:15` `resolveOneBinaryDshHome(app.getPath('userData'))`), `assertDshHomeExternal` garante fora de `resources`. Trocar o `.exe` não perde sessões.
- **Logs:** `%APPDATA%\DeepMod\logs\onebinary-YYYY-MM-DD.log` + `%TEMP%\deepmod-boot*.log` (copiáveis para GitHub/LLM).
- **Traduções validadas:** `packages/client/locale/src/locales/{en,zh,pt,ru,es}.ts` cada uma `satisfies Record<CommonKey,string>` (44 chaves `common` + 1 `settings.locale`), `pnpm --filter dsh-client-locale run bundle` + `vite build` 345 módulos verificam completude; `en` é fallback.

## [1.0.1] - 2026-08-30
- Controle centralizado de versão & identidade (`version.ts` `DeepMod v1.0.1`), mapeamento `default-urls.ts` (+20 provedores), `Effective URL` + cópia, `Fetch available models` com `new`, atalho `Add / Manage providers`.

## [1.0.0] - upstream DeepSeek Harness developer preview
- Base `deepseek-ai/deepseek-harness` (Cordis, `dsh web` em `127.0.0.1:3080`).
