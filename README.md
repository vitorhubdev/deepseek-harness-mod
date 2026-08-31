# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## DeepMod Modifications & Features

Este fork/mod (`DeepMod`) inclui melhorias de usabilidade, gerenciamento avançado de modelos e provedores, e otimizações de performance:

- **Controle Centralizado de Versão & Identidade (`version.ts`)**: Identidade visual `DeepMod` com versão centralizada exibida no cabeçalho de configurações, barra lateral e telas de informações.
- **Gerenciamento Completo de Provedores & Base URL**:
  - Mapeamento pré-configurado de endpoints padrão para mais de 20 provedores de LLM (`default-urls.ts`).
  - Exibição visual persistente da URL ativa (`Effective URL`) no editor de configurações.
  - Botão de cópia rápida da Base URL para a área de transferência em um clique.
- **Detecção Inteligente de Modelos (`Fetch available models`)**:
  - Indicadores de status e contadores de novos modelos (`X models detected (Y new)` e `X models added`).
  - Destaque com tag visual `new` para identificar modelos recém-lançados ou não configurados.
  - Exibição imediata de erros de conexão no topo da lista.
- **Acesso Rápido no Seletor do Composer**: Atalho direto *"Add / Manage providers…"* no menu de seleção de modelos para abrir as configurações instantaneamente.
- **Otimizações de Performance & Plataforma**:
  - Ajustes de subprocessos locais para execução fluida no Windows (PowerShell/CMD).
  - Otimizações na persistência e compressão de sessões SQLite.
  - Refatoração e sanitização de código TypeScript com linter/oxlint.

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

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
