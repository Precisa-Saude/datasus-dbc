/**
 * Mede o núcleo novo contra o 2.0.2 publicado, nos critérios que o próprio
 * projeto definiu antes de qualquer alegação de desempenho.
 *
 * De `PROJETO_DECOMPRESSOR_E_DOWNLOAD_WIFI.md`:
 *   1. produzir exatamente os mesmos bytes;
 *   2. não regredir entradas pequenas de forma relevante;
 *   3. melhorar a mediana em mais do que o ruído observado;
 *   4. reduzir ou manter o pico de memória;
 *   5. repetir o ganho fora da máquina de desenvolvimento.
 *
 * Compara `dbcToDbf`, não `implodeDecompress`: o núcleo novo tornou o
 * `implodeDecompress` estrito quanto ao byte EOF do DBF, e o publicado é
 * tolerante. Medir o nível cru compararia contratos diferentes; `dbcToDbf` é o
 * que os consumidores chamam, e nele os dois concordam.
 *
 * Rodadas intercaladas e resultado pelo MÍNIMO, não pela média: numa VM de 2
 * CPUs o ruído só empurra para cima, então a média mede a instabilidade do
 * momento em vez da capacidade.
 *
 * Uso: node --expose-gc packages/dbc/bench/implode-bench.mjs [rodadas]
 * Requer `npx tsup` em `packages/dbc` antes, para existir `dist/`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RODADAS = Number(process.argv[2] ?? 7);
const FIXTURE = fileURLToPath(new URL('../test/fixtures/RDAC2401.dbc', import.meta.url));
const PUBLICADO = process.env.DBC_PUBLICADO
  ?? 'C:/projetos/tabwin-web/node_modules/@precisa-saude/datasus-dbc/dist/index.js';

const { readDbcMetadata, dbcToDbf } = await import('../dist/index.js');
const { dbcToDbf: publicado } = await import(pathToFileURL(PUBLICADO).href);

const dbc = new Uint8Array(readFileSync(FIXTURE));
const meta = readDbcMetadata(dbc);

function medir(executar) {
  // Uma volta antes de medir: a primeira paga compilação JIT e primeira
  // alocação, e incluí-la mediria o aquecimento, não o trabalho.
  executar();
  const tempos = [];
  const picos = [];
  for (let i = 0; i < RODADAS; i++) {
    globalThis.gc?.();
    const antes = process.memoryUsage().heapUsed;
    const inicio = process.hrtime.bigint();
    executar();
    tempos.push(Number(process.hrtime.bigint() - inicio) / 1e6);
    picos.push((process.memoryUsage().heapUsed - antes) / 1048576);
  }
  const ordenados = [...tempos].sort((a, b) => a - b);
  return {
    melhor: ordenados[0],
    mediana: ordenados[Math.floor(ordenados.length / 2)],
    picoMb: Math.min(...picos),
  };
}

// --- critério 1: os mesmos bytes -------------------------------------------
const saidaNova = dbcToDbf(dbc);
const saidaAntiga = publicado(dbc);
const iguais = saidaNova.byteLength === saidaAntiga.byteLength
  && saidaNova.every((byte, indice) => byte === saidaAntiga[indice]);

console.log(`fixture: ${FIXTURE.split(/[\\/]/).pop()}`);
console.log(`  ${meta.recordCount} registros · ${(dbc.byteLength / 1024).toFixed(0)} KB`
  + ` -> ${(saidaNova.byteLength / 1048576).toFixed(1)} MB`);
console.log(`\n1. bytes identicos ao publicado: ${iguais ? 'SIM' : 'NAO - nada mais importa'}`);
if (!iguais) process.exit(1);

// --- critérios 3 e 4: tempo e memória --------------------------------------
console.log(`\n${RODADAS} rodadas, resultado pelo minimo:\n`);
const antigo = medir(() => publicado(dbc));
const novo = medir(() => dbcToDbf(dbc));

for (const [nome, r] of [['2.0.2 publicado', antigo], ['nucleo novo', novo]]) {
  console.log(`  ${nome.padEnd(18)} ${r.melhor.toFixed(1).padStart(6)} ms`
    + ` | mediana ${r.mediana.toFixed(1).padStart(6)} ms`
    + ` | heap +${r.picoMb.toFixed(1)} MB`);
}

const ganho = antigo.melhor / novo.melhor;
console.log(`\n3. ${ganho >= 1 ? `${ganho.toFixed(2)}x mais rapido` : `${(1 / ganho).toFixed(2)}x MAIS LENTO`}`);
console.log(`4. pico de heap: ${novo.picoMb <= antigo.picoMb + 0.5 ? 'igual ou menor' : `MAIOR (+${(novo.picoMb - antigo.picoMb).toFixed(1)} MB)`}`);

// --- critério 2: entradas pequenas -----------------------------------------
// Não dá para sintetizar um DBC pequeno cortando este: o fluxo DCL é
// sequencial, e uma fatia não decodifica. Fabricar um número aqui seria pior
// que não ter número, então o que fica registrado é o que falta.
console.log('\n2. entradas pequenas: NAO MEDIDO - o conjunto de fixtures tem um'
  + ' arquivo so (4.315 registros).');
console.log('   Precisa de um DBC municipal real, de algumas centenas de registros.');
console.log('5. repetir fora desta maquina: pendente por natureza.');
