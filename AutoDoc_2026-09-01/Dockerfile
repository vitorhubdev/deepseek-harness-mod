# syntax=docker/dockerfile:1

FROM node:22.19.0-bookworm-slim

ENV CI=true \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       git \
       python3 \
       make \
       g++ \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@11.7.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

RUN pnpm install --frozen-lockfile

# Este container é deliberadamente orientado a build/test/gates.
# O Web bundle do projeto rejeita --host 0.0.0.0 por design de segurança.
CMD ["pnpm", "run", "typecheck"]
