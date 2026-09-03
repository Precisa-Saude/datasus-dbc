/**
 * Descompressor PKWARE DCL Implode usado nos arquivos DBC do DATASUS.
 *
 * O núcleo mantém uma janela de 4 KiB, resolve os códigos Huffman mais comuns
 * por uma tabela de consulta e pode entregar a saída em blocos. A API antiga
 * continua disponível e aloca um único buffer de destino.
 */

const MAX_BITS = 13;
const WINDOW_SIZE = 4096;
const END_CODE = 519;
const FAST_BITS = 9;
const FAST_SIZE = 1 << FAST_BITS;
const NATIVE_COPY_MIN_BYTES = 20;

const LITERAL_LENGTHS = [
  11, 124, 8, 7, 28, 7, 188, 13, 76, 4, 10, 8, 12, 10, 12, 10, 8, 23, 8, 9, 7, 6, 7, 8, 7, 6, 55, 8,
  23, 24, 12, 11, 7, 9, 11, 12, 6, 7, 22, 5, 7, 24, 6, 11, 9, 6, 7, 22, 7, 11, 38, 7, 9, 8, 25, 11,
  8, 11, 9, 12, 8, 12, 5, 38, 5, 38, 5, 11, 7, 5, 6, 21, 6, 10, 53, 8, 7, 24, 10, 27, 44, 253, 253,
  253, 252, 252, 252, 13, 12, 45, 12, 45, 12, 61, 12, 45, 44, 173,
] as const;
const RUN_LENGTHS = [2, 35, 36, 53, 38, 23] as const;
const DISTANCE_LENGTHS = [2, 20, 53, 230, 247, 151, 248] as const;
const BASE = [3, 2, 4, 5, 6, 7, 8, 9, 10, 12, 16, 24, 40, 72, 136, 264] as const;
const EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

interface HuffmanTable {
  count: Int32Array;
  fastLength: Uint8Array;
  fastSymbol: Int16Array;
  symbol: Int32Array;
}

function construct(
  encodedLengths: readonly number[],
): Omit<HuffmanTable, 'fastLength' | 'fastSymbol'> {
  const lengths = new Uint8Array(256);
  let symbolCount = 0;

  for (const encoded of encodedLengths) {
    const length = encoded & 15;
    let repeats = (encoded >> 4) + 1;
    if (symbolCount + repeats > lengths.length) {
      throw new Error('DCL Implode: descrição Huffman excede 256 símbolos');
    }
    while (repeats-- > 0) lengths[symbolCount++] = length;
  }

  const count = new Int32Array(MAX_BITS + 1);
  const symbols = new Int32Array(symbolCount);
  for (let symbol = 0; symbol < symbolCount; symbol++) {
    const length = lengths[symbol]!;
    count[length] = count[length]! + 1;
  }

  let left = 1;
  for (let length = 1; length <= MAX_BITS; length++) {
    left = (left << 1) - count[length]!;
    if (left < 0) {
      throw new Error(`DCL Implode: conjunto Huffman inválido no comprimento ${length}`);
    }
  }

  const offsets = new Int32Array(MAX_BITS + 1);
  for (let length = 1; length < MAX_BITS; length++) {
    offsets[length + 1] = offsets[length]! + count[length]!;
  }
  for (let symbol = 0; symbol < symbolCount; symbol++) {
    const length = lengths[symbol]!;
    if (length === 0) continue;
    const offset = offsets[length]!;
    symbols[offset] = symbol;
    offsets[length] = offset + 1;
  }

  return { count, symbol: symbols };
}

function walkCanonical(
  table: Omit<HuffmanTable, 'fastLength' | 'fastSymbol'>,
  pattern: number,
  available: number,
): { length: number; symbol: number } | null {
  let code = 0;
  let first = 0;
  let index = 0;

  for (let length = 1; length <= available; length++) {
    code |= ((pattern >> (length - 1)) & 1) ^ 1;
    const count = table.count[length]!;
    if (code < first + count) {
      return { length, symbol: table.symbol[index + code - first]! };
    }
    index += count;
    first = (first + count) << 1;
    code <<= 1;
  }
  return null;
}

function withFastTable(table: Omit<HuffmanTable, 'fastLength' | 'fastSymbol'>): HuffmanTable {
  const fastLength = new Uint8Array(FAST_SIZE);
  const fastSymbol = new Int16Array(FAST_SIZE).fill(-1);
  for (let pattern = 0; pattern < FAST_SIZE; pattern++) {
    const hit = walkCanonical(table, pattern, FAST_BITS);
    if (hit === null) continue;
    fastLength[pattern] = hit.length;
    fastSymbol[pattern] = hit.symbol;
  }
  return { ...table, fastLength, fastSymbol };
}

const LITERAL_CODE = withFastTable(construct(LITERAL_LENGTHS));
const RUN_CODE = withFastTable(construct(RUN_LENGTHS));
const DISTANCE_CODE = withFastTable(construct(DISTANCE_LENGTHS));

/**
 * Limite padrão da API que materializa a saída: 2 GiB, o limite do próprio
 * formato dBase/DBF — o motivo de o DATASUS dividir meses grandes em arquivos
 * `a`, `b`, `c`… Um SIA-PA dividido de SP (`PASP2606d.dbc`, 4.109.589
 * registros × 419 bytes) descomprime em ~1,64 GB; o limite antigo de 500 MB
 * recusava todos eles (#24). Sobrescreva com `maxOutputBytes`.
 */
export const DEFAULT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024 * 1024;

/** Limite padrão da API incremental. Ela não aloca esse volume. */
export const DEFAULT_MAX_STREAM_OUTPUT_BYTES = 4 * 1024 * 1024 * 1024;

export interface ImplodeDecompressOptions {
  /**
   * Aceita o EOF DBF `0x1a` ausente. **Padrão `true`.**
   *
   * Não é tolerância a arquivo corrompido: é uma variação normal dos DBCs que
   * o DATASUS publica. O fixture deste próprio pacote, `RDAC2401.dbc`, produz
   * 3.029.130 bytes onde a convenção do DBF — `recordCount * recordSize + 1` —
   * pede 3.029.131.
   *
   * Um pacote que existe para ler DBC do DATASUS não pode tratar uma variação
   * normal do seu formato-alvo como erro por omissão. Quem precisa de exatidão
   * byte a byte passa `false` e recebe a checagem estrita.
   *
   * A falta de UM byte no fim também não esconde truncamento de verdade: uma
   * entrada cortada falha antes, em `entrada truncada`, e qualquer falta maior
   * que um byte continua sendo recusada.
   */
  allowMissingFinalByte?: boolean;
  /** Limite do tamanho descompactado declarado. */
  maxOutputBytes?: number;
  /** Cancela a operação entre blocos sem introduzir dependência de runtime. */
  signal?: AbortSignal;
}

export interface ImplodeChunkOptions extends ImplodeDecompressOptions {
  /** Força o percurso canônico para testes diferenciais. */
  forceSlowPath?: boolean;
  /**
   * Entrega uma vista da janela interna. O consumidor precisa terminar de usar
   * o bloco dentro da chamada, pois o próximo bloco reutiliza o mesmo buffer.
   */
  reuseWindowBuffer?: boolean;
}

export type ImplodeChunkConsumer = (chunk: Uint8Array, outputOffset: number) => void;

class ImplodeDecoder {
  private bitBuffer = 0;
  private bitCount = 0;
  private readonly consume: ImplodeChunkConsumer;
  private readonly expectedLength: number;
  private firstWindow = true;
  private readonly forceSlowPath: boolean;
  private readonly input: Uint8Array;
  private inputOffset = 0;
  private next = 0;
  private produced = 0;
  private readonly reuseWindowBuffer: boolean;
  private readonly signal: AbortSignal | undefined;
  private readonly window = new Uint8Array(WINDOW_SIZE);

  constructor(
    input: Uint8Array,
    expectedLength: number,
    consume: ImplodeChunkConsumer,
    options: ImplodeChunkOptions,
  ) {
    this.input = input;
    this.expectedLength = expectedLength;
    this.consume = consume;
    this.forceSlowPath = options.forceSlowPath ?? false;
    this.reuseWindowBuffer = options.reuseWindowBuffer ?? false;
    this.signal = options.signal;
  }

  private appendInputByte(): void {
    if (this.inputOffset >= this.input.length) {
      throw new Error(`DCL Implode: entrada truncada no byte ${this.inputOffset}`);
    }
    this.bitBuffer |= this.input[this.inputOffset++]! << this.bitCount;
    this.bitCount += 8;
  }

  private bits(need: number): number {
    if (need === 0) return 0;
    while (this.bitCount < need) this.appendInputByte();
    const value = this.bitBuffer & ((1 << need) - 1);
    this.bitBuffer >>>= need;
    this.bitCount -= need;
    return value;
  }

  private fillFastBits(): void {
    while (this.bitCount < FAST_BITS && this.inputOffset < this.input.length) {
      this.bitBuffer |= this.input[this.inputOffset++]! << this.bitCount;
      this.bitCount += 8;
    }
  }

  private decode(table: HuffmanTable): number {
    if (!this.forceSlowPath) {
      this.fillFastBits();
      if (this.bitCount >= FAST_BITS) {
        const pattern = this.bitBuffer & (FAST_SIZE - 1);
        const symbol = table.fastSymbol[pattern]!;
        if (symbol >= 0) {
          const length = table.fastLength[pattern]!;
          this.bitBuffer >>>= length;
          this.bitCount -= length;
          return symbol;
        }
      }
    }

    let code = 0;
    let first = 0;
    let index = 0;
    for (let length = 1; length <= MAX_BITS; length++) {
      code |= this.bits(1) ^ 1;
      const count = table.count[length]!;
      if (code < first + count) return table.symbol[index + code - first]!;
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new Error('DCL Implode: código Huffman inválido');
  }

  private assertFits(additional: number): void {
    if (this.produced + this.next + additional > this.expectedLength) {
      throw new Error('DCL Implode: saída excedeu o tamanho declarado');
    }
  }

  private flush(): void {
    if (this.next === 0) return;
    this.signal?.throwIfAborted();
    const length = this.next;
    const chunk = this.reuseWindowBuffer
      ? this.window.subarray(0, length)
      : this.window.slice(0, length);
    this.consume(chunk, this.produced);
    this.produced += length;
    this.next = 0;
    this.firstWindow = false;
  }

  private copyMatch(length: number, distance: number): void {
    this.assertFits(length);
    do {
      let destination = this.next;
      let source = destination - distance;
      let copy = WINDOW_SIZE;
      if (this.next < distance) {
        source += copy;
        copy = distance;
      }
      copy -= this.next;
      if (copy > length) copy = length;
      length -= copy;
      this.next += copy;

      const gap = destination - source;
      if (copy >= NATIVE_COPY_MIN_BYTES && (gap <= 0 || gap >= copy)) {
        this.window.copyWithin(destination, source, source + copy);
      } else {
        let remaining = copy;
        do this.window[destination++] = this.window[source++]!;
        while (--remaining);
      }
      if (this.next === WINDOW_SIZE) this.flush();
    } while (length !== 0);
  }

  run(allowMissingFinalByte: boolean): number {
    this.signal?.throwIfAborted();
    const literalMode = this.bits(8);
    if (literalMode > 1) {
      throw new Error(`DCL Implode: indicador literal inválido ${literalMode}`);
    }
    const dictionaryBits = this.bits(8);
    if (dictionaryBits < 4 || dictionaryBits > 6) {
      throw new Error(`DCL Implode: dicionário inválido ${dictionaryBits}`);
    }

    for (;;) {
      if (this.bits(1) === 0) {
        const symbol = literalMode === 1 ? this.decode(LITERAL_CODE) : this.bits(8);
        this.assertFits(1);
        this.window[this.next++] = symbol;
        if (this.next === WINDOW_SIZE) this.flush();
        continue;
      }

      const lengthSymbol = this.decode(RUN_CODE);
      const length = BASE[lengthSymbol]! + this.bits(EXTRA[lengthSymbol]!);
      if (length === END_CODE) break;

      const distanceShift = length === 2 ? 2 : dictionaryBits;
      const distanceSymbol = this.decode(DISTANCE_CODE);
      const distance = (distanceSymbol << distanceShift) + this.bits(distanceShift) + 1;
      if (this.firstWindow && distance > this.next) {
        throw new Error(`DCL Implode: distância ${distance} excede a saída disponível`);
      }
      this.copyMatch(length, distance);
    }

    this.flush();
    const missingFinalByte = allowMissingFinalByte && this.produced === this.expectedLength - 1;
    if (this.produced !== this.expectedLength && !missingFinalByte) {
      throw new Error(
        `DCL Implode: saída produziu ${this.produced} bytes; esperado ${this.expectedLength}`,
      );
    }
    return this.produced;
  }
}

function validateExpectedLength(expectedLength: number, maximum: number): void {
  if (!Number.isSafeInteger(maximum) || maximum < 0) {
    throw new Error(`implodeDecompress: maxOutputBytes inválido (${maximum})`);
  }
  // Duas condições, duas mensagens. Fundi-las custaria a distinção que o
  // chamador usa para decidir o que fazer: um comprimento inválido é erro de
  // programação, e um acima do limite é cabeçalho DBC suspeito ou cap curto
  // demais — só o segundo se resolve ajustando `maxOutputBytes`.
  if (!Number.isSafeInteger(expectedLength) || expectedLength < 0) {
    throw new Error(`implodeDecompress: uncompressedLength inválido (${expectedLength})`);
  }
  if (expectedLength > maximum) {
    throw new Error(
      `implodeDecompress: uncompressedLength ${expectedLength} excede cap ${maximum}. ` +
        'Cabeçalho DBC suspeito ou ajuste maxOutputBytes.',
    );
  }
}

/**
 * Descomprime em blocos de até 4 KiB, sem alocar a saída completa.
 *
 * O consumidor é chamado de forma síncrona e em ordem. Se ele lançar, a
 * descompressão termina imediatamente com o mesmo erro.
 */
export function implodeDecompressChunks(
  compressed: Uint8Array,
  uncompressedLength: number,
  consume: ImplodeChunkConsumer,
  options: ImplodeChunkOptions = {},
): number {
  const maximum = options.maxOutputBytes ?? DEFAULT_MAX_STREAM_OUTPUT_BYTES;
  validateExpectedLength(uncompressedLength, maximum);
  return new ImplodeDecoder(compressed, uncompressedLength, consume, options).run(
    options.allowMissingFinalByte ?? true,
  );
}

/** Preenche um buffer fornecido pelo chamador e devolve quantos bytes escreveu. */
export function implodeDecompressInto(
  compressed: Uint8Array,
  destination: Uint8Array,
  options: ImplodeDecompressOptions = {},
): number {
  const maximum = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  validateExpectedLength(destination.byteLength, maximum);
  return implodeDecompressChunks(
    compressed,
    destination.byteLength,
    (chunk, offset) => destination.set(chunk, offset),
    { ...options, maxOutputBytes: maximum, reuseWindowBuffer: true },
  );
}

/** Descomprime um fluxo DCL para um único `Uint8Array`. */
export function implodeDecompress(
  compressed: Uint8Array,
  uncompressedLength: number,
  options: ImplodeDecompressOptions = {},
): Uint8Array {
  const maximum = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  validateExpectedLength(uncompressedLength, maximum);
  const output = new Uint8Array(uncompressedLength);
  const written = implodeDecompressInto(compressed, output, {
    ...options,
    maxOutputBytes: maximum,
  });
  return written === output.length ? output : output.slice(0, written);
}

/** Superfície interna para testes diferenciais das tabelas. */
export const __huffmanTablesForTest = {
  distance: DISTANCE_CODE,
  literal: LITERAL_CODE,
  run: RUN_CODE,
} as const;
