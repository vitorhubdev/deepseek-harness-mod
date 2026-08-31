# OneBinary — Distribuição OneFile do DeepSeek Harness

Distribuições **clica-e-abre** do Harness sem quebrar a arquitetura Cordis.

> **Invariante:** `DSH_HOME` (`~/.dsh` ou `%APPDATA%/.dsh`) fica **fora** do executável. Sessões, `cordis.patch.yml`, `settings.yaml` e plugins instalados via `dsh plugin` sobrevivem ao fechar/reabrir. Ver `docs/onefile-viability.md` e `docs/architecture.md:41`.

## Estrutura

```
OneBinary/
  shared/               # Lógica compartilhada (Node) entre Electron e Tauri
    resolve-paths.ts    # INSTALL_ANCHOR / bareModuleBaseUrl / distIndex
    onebinary-env.ts    # DSH_HOME externo + DSH_LAUNCH_ENVIRONMENT
  electron/             # Trilha A — Electron (recomendada primeiro, 0 perdas)
    package.json
    electron-builder.yml
    src/main.ts
    src/preload.ts
  tauri/                # Trilha B — Tauri 2 + Node sidecar (leve, 15-35MB)
    src-tauri/
      Cargo.toml
      tauri.conf.json
      src/main.rs
    src/                # placeholder frontend (reusa apps/web/dist)
```

## Por que duas trilhas?

| Critério | Electron | Tauri 2 + sidecar |
|---|---|---|
| Tamanho | 180–280 MB (Chromium+Node) | 15–35 MB (WebView nativo) |
| Preserva plugins | ✅ 100% — Node nativo, `koffi`/`node-pty`/`landlock-run` funcionam | ✅ só com sidecar Node |
| Risco | Baixo — `boot()` `packages/boot/app-boot/src/index.ts:772` reaproveitado 1:1 | Médio — precisa proxy Rust→Node + `extraResources` |
| GitHub build | `electron-builder --win portable` | `tauri build` + `externalBin: node` |
| Recomendação | **Fazer primeiro** (2–3 sem). | **Fazer segundo**, reaproveitando `shared/` |

`Wails 3.0 Alpha` foi avaliado e descartado para produção agora (contrato `runtime.*` quebra sem semver). Se quiser, o scaffold Tauri já isola o sidecar e um futuro port para Wails 2 seria trivial.

## Como usar (dev)

```sh
# Pré-requisito: build oficial já gera lib/ + dist/
pnpm run build:official

# Electron (Windows portable, sem installer)
pnpm --filter onebinary-electron run build:win

# Tauri (precisa Rust 1.77+ e WebView2)
pnpm --filter onebinary-tauri run build
# ou direto:
cargo tauri build --manifest-path OneBinary/tauri/src-tauri/Cargo.toml
```

## GitHub — compila ambas em paralelo

Workflow `.github/workflows/onebinary.yml` dispara em `push` com `paths: OneBinary/**` + manual `workflow_dispatch`. Jobs `build-electron` e `build-tauri` rodam em `windows-latest` em paralelo, cada um faz `pnpm run build:official` + build do alvo e sobe artifact. Ver `docs/onefile-viability.md:5` para matriz completa.

## Garantia de não-quebra do código atual

- `OneBinary/` **não** está em `pnpm-workspace.yaml:1` (`packages: [...]`). Logo `pnpm install`, `pnpm run typecheck`, `tsc -b tsconfig.host.json` e gates `verify-*` não enxergam `OneBinary/`. Zero impacto em `packages/*/*` e `apps/*`.
- `OneBinary/shared/resolve-paths.ts` importa `@deepseek-ai/dsh-app-boot` e `@deepseek-ai/dsh-home-paths` como dependências externas — não duplica tipos.
- Ambos os alvos usam `process.resourcesPath` (Electron) / `resourceDir()` (Tauri) como `bareModuleBaseUrl` para o Loader Cordis, preservando `profile.ts:42` `.dsh-module-fallback`.
- Nenhum arquivo em `apps/` ou `packages/` é editado por este scaffold; integração é por overlay `extraResources`/`resources`.
