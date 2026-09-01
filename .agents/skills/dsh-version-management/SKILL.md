---
name: dsh-version-management
description: Use em todo commit no fork DeepMod para bump de versão patch 0.0.1 e gate de Release. Toda LLM deve seguir este protocolo para que `git log --oneline` e `package.json` reflitam versão incremental por commit, mas `GitHub Release` só seja criado com autorização explícita do usuário.
---

# DSH Version Management — DeepMod 1.0.x

## Regra obrigatória para LLMs

> **A cada `git commit` (feature, fix, docs, merge) a versão DeepMod DEVE ser incrementada em `patch` (`0.0.1`). Release no GitHub SÓ com autorização explícita, mas a LLM DEVE perguntar se deseja release após cada bump.**

Versão canônica: `package.json` (`@deepseek-ai/dsh-root`) e `OneBinary/electron/package.json` (ambos `1.0.3` → `1.0.4` → ...). Upstream `dsh-v0.1.2-alpha.*` é tracking separado e não deve ser usado como versão DeepMod (`git describe` mostra `dsh-v*` mas `package.json` é a fonte).

## Protocolo por commit

### 1. Antes de `git commit` — bump patch sem commit separado

```sh
# LLM deve executar antes de cada commit que altera código/docs:
pnpm exec tsx scripts/version-auto-bump.ts
# ou equivalente:
tsx scripts/release/bump.ts --family dsh patch --dry-run  # preview
```

`scripts/version-auto-bump.ts` (novo) faz:
- lê `package.json:version` e `OneBinary/electron/package.json:version` (devem estar iguais)
- incrementa `patch`: `1.0.3` → `1.0.4` (`releaseNumbers` em `scripts/release/bump.ts:66`)
- escreve ambos os manifests preservando formatação (`writeVersion`)
- `pnpm install --lockfile-only` (atualiza `pnpm-lock.yaml`)
- **não** faz `git commit` — a LLM inclui os 3 arquivos no commit da feature

Se o bump já foi feito manualmente, verificar:
```sh
git diff --stat | grep -E "package.json|pnpm-lock.yaml"
```

### 2. Commit — incluir versão

```sh
git add package.json OneBinary/electron/package.json pnpm-lock.yaml <arquivos da feature>
git commit -m "feat(scope): descrição

release(dsh): 1.0.3 -> 1.0.4"
# ou usar hook que já stageou
```

Mensagem deve mencionar `release(dsh): X -> Y` para rastreio.

### 3. Após commit — PERGUNTAR sobre Release

**Obrigatório:** usar `default.question` tool:

```json
{
  "questions": [{
    "header": "Release?",
    "question": "Versão bumpada de 1.0.3 para 1.0.4. Deseja criar GitHub Release agora? (publica binários OneBinary via .github/workflows/onebinary.yml)",
    "options": [
      {"label": "Sim, patch release", "description": "Cria tag v1.0.4 + Release com portable/setup/dmg"},
      {"label": "Não, só bump", "description": "Mantém commit versionado sem publicar Release"},
      {"label": "Aguardar", "description": "Acumula commits, release depois"}
    ]
  }]
}
```

- Se `Sim`: executar **após** push do branch:
  ```sh
  git tag v1.0.4 HEAD && git push origin v1.0.4
  # ou
  gh release create v1.0.4 --generate-notes --title "DeepMod v1.0.4"
  # workflow onebinary.yml:release-attach só roda em release published
  ```
- Se `Não`/`Aguardar`: **não** criar tag/release. Próximo commit fará `1.0.4 -> 1.0.5`.

### 4. Push

```sh
git push origin HEAD
# Release só se autorizado acima
```

## O que é bumpado vs o que é release

| Ação | Quando | Comando | Efeito |
|------|--------|---------|--------|
| **bump patch** | **todo commit** | `scripts/version-auto-bump.ts` | `1.0.3→1.0.4` local, sem tag |
| **Release** | **só com `Sim`** | `git tag && gh release create` | Publica `OneBinary` artefatos (portable/nsis/dmg/zip/AppImage/deb) |

## Artefatos OneBinary por plataforma (ref `OneBinary/electron/package.json:14-17`)

- `build:win` → `portable` (.exe) + `nsis` (setup .exe) `x64` — **SIM**, `msi` **NÃO** (adicionar `target: msi`), `x86` **NÃO** (adicionar `--ia32`)
- `build:linux` → `AppImage`+`deb` `x64/arm64` — **SIM**
- `build:mac` → `dmg`+`zip` `x64/arm64/universal` — **SIM**
- `arm Win` — **NÃO** (só linux/mac `arm64`)

## Verificação

```sh
# versão atual
node -p "require('./package.json').version"
node -p "require('./OneBinary/electron/package.json').version"
git describe --tags --always
git log --oneline -5 | grep release
```

## Proibições

- Nunca criar `git tag`/`gh release` sem `question: Release? -> Sim`.
- Nunca commitar sem bump se `git diff` tocou `packages/**`, `apps/**`, `OneBinary/**`, `vendor/**`, `native/**`, `pnpm-lock.yaml`.
- Nunca usar `dsh-v0.1.2-*` como versão DeepMod (upstream tracking).
