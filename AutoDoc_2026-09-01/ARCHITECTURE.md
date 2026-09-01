# Arquitetura

> 00:33 -2026-09-01

## Visão geral

DeepSeek Harness/DeepMod é um monorepo orientado a plugins sobre Cordis. A aplicação não é um core monolítico com extensões periféricas: profiles compõem bundles e plugins que registram serviços, eventos e efeitos em um contexto compartilhado. O fork RASNER adiciona uma camada de distribuição e UX sem substituir esse modelo arquitetural.

```text
CLI dsh
  -> profile selecionado
     -> bundles Cordis em ordem
        -> patch do profile
           -> patch global do DSH_HOME
              -> overlays --patch
                 -> serviços / eventos / tools / UI / persistência
```

## Componentes

### Launcher e profiles

`apps/cli` é o launcher Node suportado. Os modos `web`, `headless`, `sdk`, `sdk-minimal` e `acp` são profiles, não executáveis independentes. Cada profile declara bundles e política de reload.

### Cordis e bundles

Cordis provê composição temporal de plugins. Registros são efeitos descartáveis: ao descarregar o plugin, seus efeitos devem ser revertidos. Bundles empacotam árvores de configuração reutilizáveis; patches superiores substituem/configuram rows das camadas inferiores.

### Host e Client

O TypeScript é separado em dois agregados:

- `tsconfig.host.json`: serviços Node, scripts, testes e componentes Host;
- `tsconfig.client.json`: UI/browser e componentes Client.

A separação evita colisões de declaration merging do `Context` Cordis. Pacotes novos devem pertencer a uma face por padrão; exceções split precisam manter leaf configs explícitos.

### Sessões e persistência

O log de sessão append-only é a fonte de verdade para fatos duráveis. O conteúdo visível ao modelo deve ser reconstruível a partir desse log. Projeções derivam estados consumíveis sem transformar caches em fonte de verdade.

A persistência é híbrida:

- log/eventos persistidos, incluindo backend JSONL;
- projeções e caches derivados;
- `session-query-sqlite` para consulta/indexação de sessões;
- configurações e credenciais em serviços/arquivos próprios sob o Harness home.

Não há ORM relacional central documentado como requisito arquitetural.

### Web

O Web GUI usa servidor HTTP Node com rotas registradas por plugins. A postura padrão é loopback. O bundle Web rejeita `--host 0.0.0.0`; exposição de rede exige desenho explícito de confiança e não deve ser contornada por documentação de setup.

### OneBinary / RASNER

`OneBinary/electron` empacota o Harness em Electron, mantendo o runtime Cordis/Node. A janela desktop, splash, preload, integração de filesystem e auto-update ficam na camada Electron. Sessões e plugins permanecem fora do executável, de forma a sobreviver à troca de binário.

## ADRs resumidos

### ADR-001 — Tudo é plugin Cordis

**Status:** aceito.

**Decisão:** funcionalidades de domínio, ferramentas, adaptadores e UI entram como plugins/serviços registrados no contexto, em vez de patches diretos em um core privilegiado.

**Motivo:** substituibilidade, isolamento de lifecycle e composição por configuração.

**Trade-off:** aumenta a necessidade de contratos explícitos entre serviços, eventos e ordem de composição.

### ADR-002 — Profiles + bundles + patches ordenados

**Status:** aceito.

**Decisão:** aplicações são composições nomeadas; a precedência é bundle(s) → patch do profile → patch do Harness home → overlays CLI.

**Motivo:** permitir customização sem forks internos de cada superfície.

**Risco:** um patch substitui configuração de row; mudanças parciais mal especificadas podem apagar campos necessários.

### ADR-003 — Agregados TypeScript Host/Client separados

**Status:** aceito.

**Decisão:** manter dois programas TypeScript agregados e construir Host antes do Client quando contratos gerados forem necessários.

**Motivo:** evitar colisões de declaration merging Cordis e preservar geração de contratos Host→Client.

**Risco:** novos pacotes split exigem disciplina de Project References.

### ADR-004 — Session log como fonte de verdade

**Status:** aceito.

**Decisão:** fatos duráveis e entradas model-visible são registrados no log; projeções/caches são derivados.

**Motivo:** replay, resume, fork, auditoria e consistência do contexto do modelo.

**Risco:** qualquer atalho que injete contexto sem evento durável quebra reconstruibilidade.

### ADR-005 — OneBinary como camada de distribuição, não novo core

**Status:** aceito no fork.

**Decisão:** Electron encapsula o runtime existente e mantém `DSH_HOME`/dados persistentes fora do pacote distribuído.

**Motivo:** experiência de um clique sem duplicar a arquitetura do Harness.

**Trade-off:** o bundle desktop precisa carregar um conjunto grande de pacotes e aumenta tamanho/complexidade de release.

### ADR-006 — Web local-first

**Status:** aceito.

**Decisão:** Web GUI permanece em loopback por padrão e o bundle rejeita binding geral em `0.0.0.0`.

**Motivo:** reduzir exposição acidental de uma superfície capaz de executar ferramentas e acessar workspaces.

**Implicação:** Docker deste snapshot é voltado a build/test/gates; não documenta exposição insegura da Web UI.

## Diagramas de dependência conceitual

```text
Model adapter ----> ctx.llm
Tools ------------> ctx.tools
Agent loop -------> session log -------> projections/query
Web UI -----------> authenticated API ---> agent/session services
OneBinary Electron -> same Harness runtime + desktop integration
```

## Regras para mudanças arquiteturais

- atualizar o documento canônico em `docs/architecture.md` quando o comportamento-base mudar;
- registrar ADR quando a mudança criar/retirar uma seam, alterar lifecycle ou mudar fonte de verdade;
- preferir extensão por plugin a importações cruzadas de camada;
- manter efeitos descartáveis e lifecycle explícito;
- não introduzir persistência paralela de estado model-visible sem integração com o log.
