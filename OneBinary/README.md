# OneBinary — Distribuição OneFile Electron do DeepSeek Harness

**Um arquivo, duplo-clique, sem quebrar a arquitetura Cordis.**

> **Invariante:** `DSH_HOME` (`~/.dsh` ou `%APPDATA%/.dsh`) fica **fora** do executável. Sessões, `cordis.patch.yml`, `settings.yaml` e plugins instalados via `dsh plugin` sobrevivem ao fechar/reabrir. Ver `docs/onefile-viability.md`, `OneBinary/electron/PLAN.md` e `docs/architecture.md:41`.

## Estrutura

```
OneBinary/
  electron/               # Distribuição Electron — única trilha (Tauri removido)
    package.json          # electron 44.1.0 + builder 26.15.3
    electron-builder.yml  # asar + portable single-file
    src/
      main.ts             # singleInstanceLock + DSH_HOME externo + runProfile(web)
      preload.ts          # contextBridge
      shared-resolve-paths.ts
      shared-onebinary-env.ts
    assets/splash.html
    build/afterPack.cjs   # prune src/maps antes do asar (otimização 653→72 MB)
    PLAN.md               # plano completo verificado 44.1.0
```

## Build

```sh
# Pré-requisito: gera lib/ + dist/ (host+client+web)
pnpm run build:official

# Dev (tsx, sem empacotar)
pnpm --filter onebinary-electron run dev

# Dir unpacked (teste rápido, sem portable)
pnpm --filter onebinary-electron run build:dir
# → OneBinary/electron/dist/installer/win-unpacked/DeepSeek Harness.exe

# Portable single-file (entrega)
pnpm --filter onebinary-electron run build:win
# → OneBinary/electron/dist/installer/DeepSeek Harness 0.1.0.exe  ~110 MB
```

## GitHub

Workflow `.github/workflows/onebinary.yml` — job `build-electron` em `windows-latest` (`pnpm run build:official` + `electron-builder --win portable` + upload artifact). Dispara em `push` com `paths: OneBinary/electron/**, apps/**, packages/**` e manual `workflow_dispatch`.

## Garantia de não-quebra

- `OneBinary/electron` **está** em `pnpm-workspace.yaml:14` como workspace para linkar `@deepseek-ai/dsh*` via `workspace:^` — mas `OneBinary/` não é escaneado por `verify-*` (só `packages/*/*` e `apps/*`). `pnpm run typecheck` continua `tsc -b tsconfig.host.json` + `tsconfig.client.json` sem incluir `OneBinary/`.
- Nenhum arquivo em `apps/` ou `packages/` foi editado; integração é `files: dist/*.js + ../../apps/cli/lib + ../../apps/web/dist` + `node_modules` via pnpm workspace.
- `Tauri` removido conforme decisão — `OneBinary/tauri/` e `OneBinary/shared/` deletados; lógica compartilhada movida para `OneBinary/electron/src/shared-*`.
