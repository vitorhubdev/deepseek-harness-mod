# Changelog — Snapshot AutoDoc

> 00:33 -2026-09-01

Este arquivo resume a evolução relevante do fork até o snapshot `f5b014c`. O `CHANGELOG.md` da raiz continua sendo a fonte canônica detalhada.

## [1.0.3] — 2026-08-31

### Added
- build OneBinary Electron multi-plataforma via matriz GitHub Actions;
- auto-update com `electron-updater`;
- estabilização do fluxo i18n e strings do onboarding;
- artefatos/release para Windows, Linux e macOS.

### Changed
- versão do fork atualizada para `1.0.3` em manifests e UI de versão;
- OneBinary consolidado em Electron como caminho de distribuição do fork.

### Fixed
- regressões de build/i18n após expansão de idiomas built-in;
- contrato de descoberta de modelos atualizado;
- script/tsconfig de build do Electron corrigido.

### Breaking
- nenhuma breaking change específica do fork foi declarada no changelog 1.0.3; o upstream permanece em developer preview e pode introduzir incompatibilidades.

## [1.0.2] — 2026-08-31

### Added
- executável OneBinary/RASNER;
- splash com progresso e live log;
- experiência curada de 5 idiomas no fluxo desktop;
- onboarding com provedores alternativos e importação de credencial local;
- persistência externa ao executável e diagnóstico de boot.

### Changed
- Electron passou a usar `asar: false` para compatibilidade do bundle/runtime;
- versão centralizada em `1.0.2` nas superfícies do fork.

### Fixed
- imports/bundle de dependências workspace no OneBinary;
- autenticação da URL Web interna do Electron;
- preload/progresso do splash;
- compatibilidade de profile do Web no empacotamento.

## [1.0.1] — 2026-08-30

### Added
- versionamento/identidade centralizados;
- mapeamento de endpoints de provedores;
- descoberta de modelos;
- atalho para gerenciamento de provedores.

## [1.0.0] — base inicial

### Added
- base do DeepSeek Harness upstream em developer preview;
- arquitetura Cordis e comando `dsh` como fundação do fork.

## Upstream incorporado

Em 2026-08-31, o fork incorporou a linha upstream `dsh-v0.1.2-alpha.3`. Essa versão não substitui a numeração DeepMod `1.0.3`; são linhas de versionamento distintas.
