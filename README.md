# datasus-dbc

[![CI](https://github.com/Precisa-Saude/datasus-dbc/actions/workflows/ci.yml/badge.svg)](https://github.com/Precisa-Saude/datasus-dbc/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![npm @precisa-saude/datasus-dbc](https://img.shields.io/npm/v/@precisa-saude/datasus-dbc?label=%40precisa-saude%2Fdatasus-dbc)](https://www.npmjs.com/package/@precisa-saude/datasus-dbc)

Decoder em **TypeScript puro** do formato `.dbc` do DATASUS — xBase DBF + PKWARE DCL Implode (a.k.a. "blast"). Browser e Node compatível, **zero dependências em runtime**, licença Apache-2.0.

Mantido pela [Precisa Saúde](https://precisa-saude.com.br) como base do ecossistema aberto de microdados DATASUS em JS/TS.

---

## Por que existe

Microdados públicos do DATASUS (SIA, SIH, SIM, SINASC, SINAN, CNES, etc.) são distribuídos em `.dbc` — um formato dos anos 90 sem spec oficial. O ecossistema histórico se resolve em outras linguagens:

- **R**: pacote [`read.dbc`](https://github.com/danicat/read.dbc)
- **Python**: [`pyreaddbc`](https://pypi.org/project/pyreaddbc/), [`datasus-dbc`](https://pypi.org/project/datasus-dbc/)
- **JS/TS**: até este pacote, só existia um Node native addon AGPLv3 (`dbf2sus-node`) — sem suporte a browser, licença viral

Este pacote preenche a lacuna com uma implementação limpa, testada, sem deps nativas, browser-friendly.

> Reusam este decoder: [`datasus-sdk`](https://github.com/Precisa-Saude/datasus-sdk) (alto-nível, FTP cliente + schemas tipados); [`datasus-parquet`](https://github.com/Precisa-Saude/datasus-parquet) (arquivo Parquet público convertido).

---

## Pacotes

| Pacote                                                 | Descrição                                                |
| ------------------------------------------------------ | -------------------------------------------------------- |
| [`@precisa-saude/datasus-dbc`](packages/dbc/README.md) | Decoder DBC — alto-nível (`readDbcRecords`) + primitivas |

---

## Instalação

```bash
npm install @precisa-saude/datasus-dbc
```

---

## Exemplo

```ts
import { readDbcRecords } from '@precisa-saude/datasus-dbc';

const bytes = new Uint8Array(await fetch('PAAC2401.dbc').then((r) => r.arrayBuffer()));

let n = 0;
for await (const record of readDbcRecords(bytes)) {
  // record é um objeto JS com os campos do DBF tipados
  if (n++ === 0) console.log(Object.keys(record));
  if (n >= 5) break;
}
console.log(`${n} registros processados`);
```

Mais detalhes (API de baixo nível, opções, charset/encoding) em [`packages/dbc/README.md`](packages/dbc/README.md).

---

## API resumida

Três camadas, expostas independentemente:

```ts
// Alto-nível — yield records direto
readDbcRecords(bytes, options?): AsyncIterable<DbfRecord>

// Médio — decompress DBC → DBF buffer
dbcToDbf(bytes): Uint8Array

// Baixo — DBF parser
readDbfHeader(buffer): DbfHeader
readDbfRecords(buffer, options?): AsyncIterable<DbfRecord>

// Primitivo — PKWARE DCL Implode decompressor
implodeDecompress(input, output): void
```

---

## Estado

- ✅ Decoder DBC completo (header + body)
- ✅ DBF parser com tipos: C (string), N (numeric), D (date), L (logical), F (float), M (memo)
- ✅ Charset CP850/Latin-1 → UTF-8
- ✅ Browser e Node compatível
- ✅ ≥80% cobertura, validado contra arquivos reais do FTP DATASUS (SIA-PA, CNES-ST, SIH-RD, SINAN)

---

## Contribuindo

PRs bem-vindas. Veja [`CONTRIBUTING.md`](CONTRIBUTING.md) e [`AGENTS.md`](AGENTS.md) para convenções (Conventional Commits, pt-BR pra docs/comentários, ≥80% cobertura).

Reportar arquivos `.dbc` reais que falham é uma contribuição valiosa — anexe um sample mínimo que reproduza o problema.

---

## Licença

Apache-2.0 — veja [`LICENSE`](LICENSE).

A implementação do PKWARE DCL Implode foi escrita do zero a partir da [especificação pública](https://www.pkware.com/documents/casestudies/APPNOTE.TXT), sem código portado de implementações GPL/AGPL.
