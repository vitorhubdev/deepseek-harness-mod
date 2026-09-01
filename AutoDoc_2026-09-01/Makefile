SHELL := /bin/sh
ROOT := ..
PNPM := corepack pnpm

.PHONY: help install build build-official typecheck lint test check docs web onebinary-bundle docker-build docker-typecheck

help:
	@printf '%s\n' \
	  'install          instala dependencias' \
	  'build            build completo' \
	  'build-official   build de artefato/release' \
	  'typecheck        valida TypeScript Host/Client' \
	  'lint             executa lint' \
	  'test             executa Vitest' \
	  'check            executa check:all' \
	  'docs             executa doc-sync' \
	  'web              build + dsh web --no-open' \
	  'onebinary-bundle build do bundle Electron' \
	  'docker-build     constroi imagem de gates' \
	  'docker-typecheck roda typecheck no container'

install:
	cd $(ROOT) && $(PNPM) install

build:
	cd $(ROOT) && $(PNPM) run build

build-official:
	cd $(ROOT) && $(PNPM) run build:official

typecheck:
	cd $(ROOT) && $(PNPM) run typecheck

lint:
	cd $(ROOT) && $(PNPM) run lint

test:
	cd $(ROOT) && $(PNPM) run test

check:
	cd $(ROOT) && $(PNPM) run check:all

docs:
	cd $(ROOT) && $(PNPM) run doc-sync

web: build
	cd $(ROOT) && $(PNPM) dsh web --no-open

onebinary-bundle: build-official
	cd $(ROOT) && $(PNPM) --filter onebinary-electron run typecheck
	cd $(ROOT) && $(PNPM) --filter onebinary-electron run build:bundle

docker-build:
	cd $(ROOT) && docker compose -f AutoDoc_2026-09-01/docker-compose.yml build

docker-typecheck:
	cd $(ROOT) && docker compose -f AutoDoc_2026-09-01/docker-compose.yml run --rm harness pnpm run typecheck
