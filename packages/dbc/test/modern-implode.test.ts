import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { dbcToDbf, dbcToDbfChunks, readDbcMetadata } from '../src/dbc.js';
import {
  implodeDecompress,
  implodeDecompressChunks,
  implodeDecompressInto,
} from '../src/implode.js';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/RDAC2401.dbc', import.meta.url));
const fixture = new Uint8Array(readFileSync(FIXTURE_PATH));
const metadata = readDbcMetadata(fixture);
const compressed = fixture.subarray(metadata.headerSize + 4);
const expectedRecordsSize = metadata.recordCount * metadata.recordSize + 1;

function join(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function expectBytesEqual(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.byteLength).toBe(expected.byteLength);
  expect(Buffer.from(actual).compare(Buffer.from(expected))).toBe(0);
}

describe('núcleo DCL moderno', () => {
  it('preserva o vetor canônico de blast.c', () => {
    const input = Uint8Array.from([0x00, 0x04, 0x82, 0x24, 0x25, 0x8f, 0x80, 0x7f]);
    const output = implodeDecompress(input, 13);
    expect(new TextDecoder().decode(output)).toBe('AIAIAIAIAIAIA');
  });

  it('produz bytes idênticos nos modos materializado, into, rápido e lento', () => {
    const materialized = implodeDecompress(compressed, expectedRecordsSize, {
      allowMissingFinalByte: true,
    });
    const destination = new Uint8Array(expectedRecordsSize);
    const written = implodeDecompressInto(compressed, destination, {
      allowMissingFinalByte: true,
    });

    const slowChunks: Uint8Array[] = [];
    const slowWritten = implodeDecompressChunks(
      compressed,
      expectedRecordsSize,
      (chunk) => slowChunks.push(chunk),
      { allowMissingFinalByte: true, forceSlowPath: true },
    );

    expect(written).toBe(materialized.byteLength);
    expect(slowWritten).toBe(materialized.byteLength);
    expectBytesEqual(destination.subarray(0, written), materialized);
    expectBytesEqual(join(slowChunks), materialized);
  });

  it('entrega blocos contíguos de no máximo 4 KiB', () => {
    let nextOffset = 0;
    let chunks = 0;
    const written = implodeDecompressChunks(
      compressed,
      expectedRecordsSize,
      (chunk, offset) => {
        expect(offset).toBe(nextOffset);
        expect(chunk.byteLength).toBeGreaterThan(0);
        expect(chunk.byteLength).toBeLessThanOrEqual(4096);
        nextOffset += chunk.byteLength;
        chunks++;
      },
      { allowMissingFinalByte: true, reuseWindowBuffer: true },
    );

    expect(chunks).toBeGreaterThan(1);
    expect(nextOffset).toBe(written);
  });

  it('propaga cancelamento e erro do consumidor', () => {
    const controller = new AbortController();
    controller.abort(new Error('cancelado pelo teste'));
    expect(() =>
      implodeDecompressChunks(compressed, expectedRecordsSize, () => undefined, {
        allowMissingFinalByte: true,
        signal: controller.signal,
      }),
    ).toThrow(/cancelado pelo teste/);

    expect(() =>
      implodeDecompressChunks(
        compressed,
        expectedRecordsSize,
        () => {
          throw new Error('consumidor recusou o bloco');
        },
        { allowMissingFinalByte: true },
      ),
    ).toThrow(/consumidor recusou o bloco/);
  });

  it('recusa entrada truncada e tamanhos de saída incoerentes', () => {
    for (const length of [0, 1, 2, 4, 8, 64, Math.floor(compressed.length / 2)]) {
      expect(() =>
        implodeDecompress(compressed.subarray(0, length), expectedRecordsSize, {
          allowMissingFinalByte: true,
        }),
      ).toThrow(/truncada/);
    }

    expect(() => implodeDecompress(compressed, expectedRecordsSize - 100)).toThrow(
      /excedeu o tamanho declarado/,
    );
    expect(() => implodeDecompress(compressed, expectedRecordsSize + 100)).toThrow(
      /saída produziu/,
    );
  });
});

describe('streaming do envelope DBC', () => {
  it('é byte a byte idêntico ao dbcToDbf', () => {
    const expected = dbcToDbf(fixture);
    const chunks: Uint8Array[] = [];
    const written = dbcToDbfChunks(fixture, (chunk) => chunks.push(Uint8Array.from(chunk)));
    const streamed = join(chunks);

    expect(written).toBe(expected.byteLength);
    expectBytesEqual(streamed, expected);
  });

  it('valida o limite antes de entregar o cabeçalho ao consumidor', () => {
    let calls = 0;
    expect(() =>
      dbcToDbfChunks(fixture, () => calls++, {
        maxOutputBytes: expectedRecordsSize - 1,
      }),
    ).toThrow(/acima do limite/);
    expect(calls).toBe(0);
  });
});
