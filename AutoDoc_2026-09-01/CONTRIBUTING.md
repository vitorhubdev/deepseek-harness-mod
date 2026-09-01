# Contributing — AutoDoc Snapshot

> 00:33 -2026-09-01

Estas regras complementam o `CONTRIBUTING.md` e o `AGENTS.md` da raiz. O documento raiz informa que o upstream não aceita PRs externos no momento; para trabalho neste fork, siga as convenções abaixo sem apagar essa restrição histórica.

## Princípios

- Preserve a arquitetura Cordis e prefira extensão por plugin/seam a acoplamento entre subsistemas.
- Faça a menor mudança que resolva o problema.
- Não altere contratos públicos, persistência ou lifecycle sem atualizar documentação e testes.
- Nunca versione chaves, tokens, cookies, credenciais ou dados de sessão.
- Não misture refactor amplo com correção funcional sem necessidade.

## Branches

Sugestões:

- `feat/<escopo>`
- `fix/<escopo>`
- `docs/<escopo>`
- `refactor/<escopo>`
- `chore/<escopo>`

## Commits — Conventional Commits

Formato:

```text
<tipo>(<escopo opcional>): <descrição curta>
```

Tipos preferidos:

- `feat`: nova capacidade;
- `fix`: correção;
- `docs`: documentação;
- `refactor`: mudança estrutural sem alterar comportamento esperado;
- `test`: testes;
- `perf`: desempenho;
- `build`: build/dependências;
- `ci`: pipelines;
- `chore`: manutenção.

Breaking changes devem usar `!` ou trailer `BREAKING CHANGE:`.

## TypeScript e arquitetura

- Um pacote novo pertence a Host ou Client por padrão.
- Não faça o root `tsconfig.json` virar um programa agregando Host+Client.
- Se um pacote precisar de faces distintas, use leaf configs explícitos e atualize Project References.
- Registros Cordis devem ter lifecycle/disposal coerente.
- Estado model-visible durável deve ser representado no log de sessão.

## Estilo e lint

- Respeitar `.editorconfig` e configurações Oxlint.
- Use `pnpm run lint` para validação completa e `pnpm run lint:fix` somente quando a correção automática for apropriada.
- Evite duplicação estrutural; `pnpm run duplication` existe para inspeção.

## Testes e gates

Escolha o menor conjunto que cobre a mudança e amplie quando o risco exigir.

```sh
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:e2e
pnpm run check:all
```

Mudanças em documentação devem considerar `pnpm run doc-sync`/`pnpm run test:docs`. Mudanças que dependem de artefatos construídos devem executar `pnpm run build` antes dos gates consumidores.

## OneBinary

Para mudanças em `OneBinary/electron`:

```sh
pnpm run build:official
pnpm --filter onebinary-electron run typecheck
pnpm --filter onebinary-electron run build:bundle
```

Builds nativos finais devem ser feitos no OS correspondente por meio dos scripts `build:win`, `build:linux` e `build:mac`/CI.

## Changelog

Atualize o `CHANGELOG.md` da raiz para mudanças notáveis do fork. Use categorias `Added`, `Changed`, `Fixed`, `Breaking` e `Validated` quando aplicável. Não declare teste/validação que não foi realmente executado.

## Pull requests / revisão

Uma revisão deve confirmar:

- aderência ao contrato do pacote/subsistema;
- backward compatibility ou breaking change documentada;
- impacto em persistência e segurança;
- testes para regressão;
- documentação pública/JSDoc atualizada quando a API mudou;
- ausência de segredos e artefatos gerados indevidos.
