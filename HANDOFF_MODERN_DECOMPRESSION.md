# Handoff: descompressão moderna de DBC DATASUS

O projeto integrado de descompressão e download adaptativo está em
`PROJETO_DECOMPRESSOR_E_DOWNLOAD_WIFI.md`.

Atualizado em 2 de setembro de 2026.

## Objetivo

Evoluir o pacote `@precisa-saude/datasus-dbc` numa pasta isolada, com foco em descompressão mais rápida, menor pico de memória, processamento em fluxo e detecção rigorosa de entrada corrompida. O resultado precisa ser mensurado em DBCs reais antes de qualquer alegação de desempenho.

## Onde continuar

- Repositório-base, sem desenvolvimento direto: `C:\projetos\datasus-dbc-modern-lab`
- Worktree de desenvolvimento: `C:\projetos\datasus-dbc-modern-engine`
- Branch: `perf/modern-decompression`
- Base inicial: `42fef70`
- Projeto principal do TabWin Web: `C:\projetos\tabwin-web`

Não editar `tabwin-web` durante este trabalho. Na última inspeção ele estava em `d3f3b5716b59da9118bbf2b839fcc79a402aa6ba` e tinha alterações não commitadas de outra sessão em `README.md`, `apps/web/index.html` e `docs/product/MANUAL_DO_USUARIO.md`.

## Estado confirmado

O pacote 2.0.2:

- implementa PKWARE DCL Implode em TypeScript puro;
- aloca o buffer descompactado completo antecipadamente;
- copia a janela byte a byte para o buffer final;
- percorre códigos Huffman bit a bit;
- não oferece consumidor incremental de blocos;
- não distingue com rigor todos os casos de entrada truncada no leitor de bits;
- compõe `readDbcRecords` por meio de `dbcToDbf`, portanto materializa todo o DBF antes de produzir o primeiro registro.

O `tabwin-web` contém uma evolução local em `packages/acquisition/src/implode-stream.ts` com tabela rápida de 9 bits, tabelas tipadas, `copyWithin`, saída em blocos de 4 KiB, limite de saída e modo de vista reutilizável. Essa implementação é uma referência útil, mas deve ser portada com testes próprios e sem copiar afirmações de benchmark que não tenham sido reproduzidas neste laboratório.

## Direção técnica

1. Preservar `implodeDecompress()` como API compatível.
2. Adicionar `implodeDecompressInto()` para preencher um destino fornecido pelo chamador sem uma cópia final.
3. Adicionar `implodeDecompressChunks()` para saída incremental limitada.
4. Construir tabelas Huffman rápidas uma única vez e manter caminho lento verificável.
5. Usar cópia nativa somente quando a semântica LZ77 não for autorreferente.
6. Validar tamanho inteiro seguro, limite máximo, fim prematuro da entrada, distância inválida, saída acima do declarado e tamanho final divergente.
7. Só considerar Rust/Wasm depois do benchmark do TypeScript otimizado. O custo de cruzar a fronteira Wasm e copiar buffers pode superar o ganho em arquivos pequenos.
8. Criar uma etapa posterior para `ReadableStream -> Worker/Wasm -> parser DBF`. Ela reduz o tempo percebido e a memória; não aumenta sozinha os MB/s da origem.

## Downloads

`fetch()` é apenas a API. As opções reais para maior vazão são faixas HTTP paralelas adaptativas, cache em CDN e uma origem melhor. O proxy atual do TabWin Web já respondeu `206 Partial Content`, portanto downloads em 2 a 4 faixas são tecnicamente possíveis. O pipeline de descompressão em fluxo permite trabalhar enquanto os bytes chegam, mas não transforma 0,8 MB/s em uma taxa maior.

## Fontes abertas e verificadas

- Repositório oficial do pacote: https://github.com/Precisa-Saude/datasus-dbc
- Implementação canônica `blast.c`: https://github.com/madler/zlib/blob/master/contrib/blast/blast.c
- `pklib` em Rust, com API de fluxo: https://docs.rs/pklib/latest/pklib/
- crate `implode`, com tabela de consulta Shannon-Fano: https://docs.rs/implode/latest/implode/

O formato é legado e sequencial. Não prometer paralelização interna de um único fluxo DCL sem pontos de reinício ou novo contêiner indexado.

## Regras do repositório

- Node 22 ou superior e pnpm 9.15.9 pelo Corepack.
- TypeScript estrito e `noUncheckedIndexedAccess`.
- Cobertura nunca abaixo de 80%.
- Documentação e mensagens para humanos em pt-BR com acentos.
- Não adicionar dependência npm sem autorização explícita.
- Não criar commit sem autorização explícita do usuário.
- Não fazer push direto em `main`.
- Não usar flags que ignorem hooks ou assinatura.

## Próximos comandos

```powershell
Set-Location C:\projetos\datasus-dbc-modern-engine
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @precisa-saude/datasus-dbc test
corepack pnpm --filter @precisa-saude/datasus-dbc typecheck
```

Depois das mudanças:

```powershell
corepack pnpm --filter @precisa-saude/datasus-dbc test:coverage
corepack pnpm --filter @precisa-saude/datasus-dbc typecheck
corepack pnpm --filter @precisa-saude/datasus-dbc lint
corepack pnpm --filter @precisa-saude/datasus-dbc build
```

## Critério de conclusão

O laboratório só está pronto quando:

- o resultado for idêntico ao decoder 2.0.2 e ao corpus real;
- casos truncados e malformados falharem de forma determinística;
- a API antiga continuar funcionando;
- streaming reduzir o pico de memória demonstravelmente;
- benchmark registrar máquina, Node, aquecimento, repetições, mediana, p95 e SHA dos arquivos;
- documentação separar resultados medidos de propostas futuras.
