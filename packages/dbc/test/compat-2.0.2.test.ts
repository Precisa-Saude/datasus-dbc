import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readDbcMetadata } from '../src/dbc.js';
import { implodeDecompress, implodeDecompressChunks } from '../src/implode.js';

/**
 * Compatibilidade com o contrato publicado em 2.0.2.
 *
 * O núcleo novo chegou a ser estrito quanto ao byte EOF do DBF: chamado com
 * `recordCount * recordSize + 1`, que é a convenção do formato, lançava. O
 * 2.0.2 aceita e devolve o que decodificou.
 *
 * A estritez é boa engenharia em abstrato, e péssimo padrão aqui: a falta do
 * `0x1a` final não é corrupção, é uma variação normal dos DBCs que o DATASUS
 * publica — o fixture deste pacote é um deles. Um pacote que existe para ler
 * DBC do DATASUS não pode recusar por omissão uma variação normal do seu
 * formato-alvo.
 *
 * Estes testes existem para que a decisão não se perca: enquanto passarem, a
 * versão sai como MINOR e quem já usa o pacote recebe o ganho de desempenho
 * sem migração.
 */
const FIXTURE = fileURLToPath(new URL('./fixtures/RDAC2401.dbc', import.meta.url));
const dbc = new Uint8Array(readFileSync(FIXTURE));
const metadata = readDbcMetadata(dbc);
const compressed = dbc.subarray(metadata.headerSize + 4);

/** O que a convenção do DBF manda calcular, e o que o arquivo realmente tem. */
const comEof = metadata.recordCount * metadata.recordSize + 1;
const semEof = comEof - 1;

describe('contrato de 2.0.2', () => {
  it('aceita o comprimento da convenção do DBF, como o publicado aceita', () => {
    const saida = implodeDecompress(compressed, comEof);
    expect(saida.byteLength).toBe(semEof);
  });

  it('aceita também o comprimento exato, sem o byte EOF', () => {
    expect(implodeDecompress(compressed, semEof).byteLength).toBe(semEof);
  });

  it('os dois caminhos produzem os mesmos bytes', () => {
    expect(implodeDecompress(compressed, comEof)).toEqual(implodeDecompress(compressed, semEof));
  });

  it('a API incremental segue o mesmo padrão da que materializa', () => {
    let total = 0;
    implodeDecompressChunks(compressed, comEof, (chunk) => {
      total += chunk.byteLength;
    });
    expect(total).toBe(semEof);
  });

  it('quem pede exatidão recebe exatidão', () => {
    // A estritez continua disponível, como opção de quem quer afirmar que o
    // arquivo tem exatamente o tamanho declarado.
    expect(() => implodeDecompress(compressed, comEof, { allowMissingFinalByte: false })).toThrow(
      /produziu \d+ bytes; esperado/,
    );
  });

  it('faltar mais de um byte continua sendo recusado', () => {
    // O padrão tolerante não pode virar tolerância a truncamento: a diferença
    // permitida é de UM byte, o EOF, e nada além disso.
    expect(() => implodeDecompress(compressed, comEof + 10)).toThrow(
      /produziu \d+ bytes; esperado/,
    );
  });

  it('entrada cortada falha antes, por truncamento, não por tolerância', () => {
    expect(() => implodeDecompress(compressed.subarray(0, 500), comEof)).toThrow(
      /entrada truncada/,
    );
  });
});
