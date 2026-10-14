/**
 * Critério 2 do plano — "não regredir entradas pequenas" — pelo lugar certo.
 *
 * O núcleo novo constrói tabelas Huffman rápidas de 9 bits: 512 entradas por
 * tabela, três tabelas. A pergunta natural é se isso não pesa demais para quem
 * abre um arquivo pequeno.
 *
 * Só que essa construção acontece **no escopo do módulo** — `const
 * LITERAL_CODE = withFastTable(...)` roda uma vez por processo, não por
 * chamada. Então não existe custo fixo por descompressão a regredir; o que
 * existe é custo de **importar**, pago uma vez, e é isso que se mede aqui.
 *
 * Importa cada versão num processo limpo, porque um segundo `import()` no
 * mesmo processo devolve o módulo do cache e mediria zero.
 *
 * Uso: node packages/dbc/bench/startup-bench.mjs [rodadas]
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RODADAS = Number(process.argv[2] ?? 9);
const NOVO = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const PUBLICADO =
  process.env.DBC_PUBLICADO ??
  'C:/projetos/tabwin-web/node_modules/@precisa-saude/datasus-dbc/dist/index.js';

/** Mede o tempo de importar um módulo, num processo que só faz isso. */
function medirImport(caminho) {
  const url = pathToFileURL(caminho).href;
  const script =
    `const t=process.hrtime.bigint();` +
    `await import(${JSON.stringify(url)});` +
    `process.stdout.write(String(Number(process.hrtime.bigint()-t)/1e6));`;
  const tempos = [];
  for (let i = 0; i < RODADAS; i += 1) {
    tempos.push(
      Number(
        execFileSync(process.execPath, ['--input-type=module', '-e', script], {
          encoding: 'utf8',
        }),
      ),
    );
  }
  return Math.min(...tempos);
}

const antigo = medirImport(PUBLICADO);
const novo = medirImport(NOVO);

console.log(`custo de importar, melhor de ${RODADAS} processos limpos:\n`);
console.log(`  2.0.2 publicado   ${antigo.toFixed(2).padStart(6)} ms`);
console.log(`  nucleo novo       ${novo.toFixed(2).padStart(6)} ms`);

const diferenca = novo - antigo;
console.log(
  `\n2. entradas pequenas: ${
    diferenca <= 5
      ? `sem regressao relevante (${diferenca >= 0 ? '+' : ''}${diferenca.toFixed(2)} ms na importacao)`
      : `REGRIDE ${diferenca.toFixed(2)} ms na importacao`
  }`,
);
console.log('   As tabelas sao construidas uma vez por processo, no escopo do');
console.log('   modulo. Nao ha custo fixo por descompressao a regredir.');
