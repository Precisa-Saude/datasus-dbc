## [2.0.4](https://github.com/Precisa-Saude/datasus-dbc/compare/v2.0.3...v2.0.4) (2026-10-02)

### Bug Fixes

* cap de saída padrão passa a 2 GiB e aceita maxOutputBytes ([#24](https://github.com/Precisa-Saude/datasus-dbc/issues/24)) ([7cf4b76](https://github.com/Precisa-Saude/datasus-dbc/commit/7cf4b76fcaac4d9c4b87453ed74a0ae6b35305a9))

## [2.0.3](https://github.com/Precisa-Saude/datasus-dbc/compare/v2.0.2...v2.0.3) (2026-10-02)

### Bug Fixes

* **ci:** guard de release compara desde a última release, não o push ([#19](https://github.com/Precisa-Saude/datasus-dbc/issues/19)) ([42fef70](https://github.com/Precisa-Saude/datasus-dbc/commit/42fef70c61592b5cf15c66d987d04e3d1c83fabe))
* **ci:** publish-watch aceita pacote sem tag quando bate com o package.json ([#18](https://github.com/Precisa-Saude/datasus-dbc/issues/18)) ([81ce0ab](https://github.com/Precisa-Saude/datasus-dbc/commit/81ce0ab8a47399ea1dac6525c91a4a2aabdfa4ab)), closes [#48](https://github.com/Precisa-Saude/datasus-dbc/issues/48) [tooling#52](https://github.com/Precisa-Saude/tooling/issues/52)
* **ci:** publish-watch compara a versão do pacote, não a maior tag ([#17](https://github.com/Precisa-Saude/datasus-dbc/issues/17)) ([b740485](https://github.com/Precisa-Saude/datasus-dbc/commit/b74048579052e1541d670d5537ede457a02b4c3e)), closes [tooling#51](https://github.com/Precisa-Saude/tooling/issues/51)
* decoder falha rápido com DBC truncado em vez de girar ([#23](https://github.com/Precisa-Saude/datasus-dbc/issues/23)) ([2f8794c](https://github.com/Precisa-Saude/datasus-dbc/commit/2f8794cbf0aef970f3c858bb78c3d38621c1b51e))
* quebra volta a gerar versão maior ([#22](https://github.com/Precisa-Saude/datasus-dbc/issues/22)) ([5986540](https://github.com/Precisa-Saude/datasus-dbc/commit/5986540b30d3bafa3f01a973cc28a05b58bd3b84))

### Documentation

* README raiz com overview, motivação, exemplo e API ([#6](https://github.com/Precisa-Saude/datasus-dbc/issues/6)) ([84d2265](https://github.com/Precisa-Saude/datasus-dbc/commit/84d22650b458c15159bc4b4478713d5ab4c3f3b7))

### CI/CD

* atualizar GitHub Actions para o runtime Node 24 ([#13](https://github.com/Precisa-Saude/datasus-dbc/issues/13)) ([7de23b1](https://github.com/Precisa-Saude/datasus-dbc/commit/7de23b17093d3cc2b57c9ce9d4d56a07db37a833))
* atualizar pnpm/action-setup de v5 para v6.0.8 ([#9](https://github.com/Precisa-Saude/datasus-dbc/issues/9)) ([638b440](https://github.com/Precisa-Saude/datasus-dbc/commit/638b440db2f8de878da2409c0d464a3e640022aa))
* bump pnpm/action-setup para v5 (Node.js 24) ([#5](https://github.com/Precisa-Saude/datasus-dbc/issues/5)) ([0145b95](https://github.com/Precisa-Saude/datasus-dbc/commit/0145b95e896d87c76b46e24f1e9f915581bd5c27))
* pin actions e adicionar tripwire publish-watch (postmortem TanStack) ([#8](https://github.com/Precisa-Saude/datasus-dbc/issues/8)) ([48e81c7](https://github.com/Precisa-Saude/datasus-dbc/commit/48e81c749ede9ee9a03151be2fc21cc567bd4aaa))
* roda publish-watch uma vez por dia em vez de a cada 15min ([#10](https://github.com/Precisa-Saude/datasus-dbc/issues/10)) ([f64a55e](https://github.com/Precisa-Saude/datasus-dbc/commit/f64a55e23d42ca361903ffb4f39096087d5a1e07))
* sincroniza template de review-dispatch (pr_number como number) ([#21](https://github.com/Precisa-Saude/datasus-dbc/issues/21)) ([826788f](https://github.com/Precisa-Saude/datasus-dbc/commit/826788f2a3e987e1b6478d6a3611a863e16f78b9))

### Chores

* **ci:** sincroniza templates do cli 1.13.1 ([#16](https://github.com/Precisa-Saude/datasus-dbc/issues/16)) ([a0a4942](https://github.com/Precisa-Saude/datasus-dbc/commit/a0a4942fb27e17b9bb11dae42cc68e9f516b1abc)), closes [tooling#47](https://github.com/Precisa-Saude/tooling/issues/47) [tooling#48](https://github.com/Precisa-Saude/tooling/issues/48) [tooling#50](https://github.com/Precisa-Saude/tooling/issues/50)
* **ci:** sincroniza templates e declara divergências deliberadas ([#15](https://github.com/Precisa-Saude/datasus-dbc/issues/15)) ([02cbb01](https://github.com/Precisa-Saude/datasus-dbc/commit/02cbb013684952c922e08b1ae6cb0dedd8484db0))
* **config:** precisa sync — publishPackages + template refresh ([#4](https://github.com/Precisa-Saude/datasus-dbc/issues/4)) ([b3e9407](https://github.com/Precisa-Saude/datasus-dbc/commit/b3e9407a50292153138853f45d6b891f867ce071)), closes [#if](https://github.com/Precisa-Saude/datasus-dbc/issues/if) [Precisa-Saude/tooling#28](https://github.com/Precisa-Saude/tooling/issues/28) [tooling#27](https://github.com/Precisa-Saude/tooling/issues/27)
* **config:** remover shamefully-hoist=false do .npmrc ([#3](https://github.com/Precisa-Saude/datasus-dbc/issues/3)) ([5bb9e3e](https://github.com/Precisa-Saude/datasus-dbc/commit/5bb9e3efc5c819734f571b988e9b0011852e59fb)), closes [Precisa-Saude/tooling#26](https://github.com/Precisa-Saude/tooling/issues/26)

## [2.0.2](https://github.com/Precisa-Saude/datasus-dbc/compare/v2.0.1...v2.0.2) (2026-04-24)

### Bug Fixes

* cap de alocação em implodeDecompress contra headers maliciosos ([#2](https://github.com/Precisa-Saude/datasus-dbc/issues/2)) ([0e3f91c](https://github.com/Precisa-Saude/datasus-dbc/commit/0e3f91c5afde3248f78e6c0310cdb29789a7a015))

### Chores

* **config:** sync VERSION do pacote dbc e formalizar threshold 80% do vitest ([3560506](https://github.com/Precisa-Saude/datasus-dbc/commit/3560506c098c838d756236959bc44661fd435670))

## [2.0.1](https://github.com/Precisa-Saude/datasus-dbc/compare/v2.0.0...v2.0.1) (2026-04-24)

### Bug Fixes

* **security:** usar contexto do repo atual no pr-review-responder ([bc8d14e](https://github.com/Precisa-Saude/datasus-dbc/commit/bc8d14e5df986c83492eeb78ac8a060690739223))
