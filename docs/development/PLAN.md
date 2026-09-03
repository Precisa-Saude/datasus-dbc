# Plano: motor moderno de descompressão DBC

## Objetivo

Criar uma evolução compatível do descompressor PKWARE DCL Implode usado pelo DATASUS, com saída incremental, limites de segurança e desempenho reproduzível em Node e navegador.

## Estado atual

- Worktree criado na branch `perf/modern-decompression` a partir de `42fef70`.
- Regras locais e compartilhadas foram lidas.
- Dependências estão sendo instaladas com o pnpm fixado pelo repositório.
- Decoder atual e implementação otimizada existente no TabWin Web foram localizados.
- Fontes primárias e implementações Rust relevantes foram abertas.

## Próximas etapas

1. Executar a suíte e medir o baseline 2.0.2.
2. Implementar núcleo tipado com tabela rápida e checagem explícita dos limites de entrada.
3. Expor APIs `into` e `chunks`, mantendo `implodeDecompress`.
4. Integrar saída de DBC por blocos e avaliar registros incrementais.
5. Criar testes diferenciais, de corrupção, de limites e de várias voltas da janela.
6. Medir tempo e memória no fixture público do pacote e em DBCs privados somente por hash e métricas, sem copiá-los para a entrega.
7. Documentar a decisão sobre Wasm com números.

## Contexto

O gargalo não admite paralelização ingênua porque cada casamento LZ77 depende da janela anterior. Ganhos plausíveis vêm de lookup Huffman, menos checagens dinâmicas, cópias nativas seguras, ausência de materialização e execução fora da thread da interface. Um contêiner futuro com checkpoints pode permitir acesso aleatório, mas não altera DBCs históricos já publicados.
