# Projeto DBC Turbo e Download Adaptativo

Atualizado em 3 de setembro de 2026.

## Resumo

Este projeto ataca os dois tempos que o usuário percebe ao abrir um arquivo do DATASUS:

1. transferência do arquivo pela rede;
2. descompressão DBC e leitura dos registros DBF.

As duas etapas devem operar como um pipeline. O navegador começa a processar os bytes enquanto o restante ainda está chegando, mantém a interface responsiva e não materializa cópias intermediárias desnecessárias.

O trabalho fica isolado em `C:\projetos\datasus-dbc-modern-engine`. O projeto `C:\projetos\tabwin-web` não deve ser alterado por este laboratório.

## Meta de produto

Abrir DBCs grandes de forma previsível em computadores comuns e conexões instáveis. O usuário deve enxergar progresso real, conseguir cancelar, retomar uma transferência interrompida e receber um erro específico quando a origem, a rede, o arquivo ou o dispositivo não suportarem a operação.

Não existe uma tecnologia cliente capaz de transformar uma origem limitada a 0,8 MB/s numa origem rápida. O projeto melhora o uso da banda disponível, evita tempo ocioso e reduz a espera depois do download.

## Arquitetura

```text
catálogo DATASUS
       |
       v
URL preparada + identidade da representação
       |
       v
planejador adaptativo de faixas HTTP
       |
       +---- faixa 0 ----+
       +---- faixa 1 ----+--> verificador de tamanho, ETag e Content-Range
       +---- faixa N ----+                  |
                                             v
                                  buffer ordenado de entrada
                                             |
                                             v
                               Worker de descompressão DCL
                                             |
                                             v
                             blocos DBF de no máximo 4 KiB
                                             |
                              +--------------+-------------+
                              |                            |
                              v                            v
                    parser de registros            cache/checkpoint
                              |
                              v
                       tabela e análises
```

## Frente 1: download em Wi-Fi e rede lenta

### 1. Medição antes da estratégia

O cliente faz uma requisição pequena com `Range: bytes=0-0` e registra:

- suporte verdadeiro a `206 Partial Content`;
- tamanho total em `Content-Range`;
- `ETag` forte ou `Last-Modified`;
- tempo até os headers;
- tempo até o primeiro byte;
- taxa de uma amostra curta.

Sem `Range`, o sistema usa conexão única. Sem um identificador estável da representação, faixas paralelas não podem ser retomadas entre sessões e precisam ser descartadas se o arquivo mudar.

### 2. Faixas paralelas adaptativas

O início recomendado é duas faixas. A concorrência pode subir para quatro quando a taxa agregada melhora sem elevar erros ou latência. O limite deve ser pequeno, pois abrir oito ou dezesseis conexões contra uma origem lenta pode piorar o resultado e sobrecarregar o DATASUS.

Cada faixa tem:

- timeout para receber headers;
- timeout de ociosidade renovado somente quando bytes reais chegam;
- retry individual com atraso e jitter;
- limite de tamanho baseado no `Content-Range`;
- cancelamento compartilhado quando a representação muda;
- escrita direta na posição final, sem concatenar cópias temporárias.

O planejador compara a taxa agregada com a conexão única. Se o paralelismo não trouxer ganho sustentado, ele reduz a concorrência automaticamente.

### 3. Consistência da representação

Todas as partes precisam pertencer ao mesmo arquivo. O cliente deve fixar a identidade com `If-Range` quando houver `ETag` forte ou `Last-Modified`, além de conferir o tamanho total em todas as respostas. Mudança de identidade cancela o grupo inteiro.

Ao final, o sistema valida tamanho e, quando houver hash oficial ou manifesto próprio, SHA-256. Sem hash de origem, o projeto pode provar consistência interna da transferência, mas não autenticidade editorial.

### 4. Retomada

Uma transferência interrompida pode salvar no IndexedDB:

- URL lógica do arquivo;
- identidade da representação;
- tamanho total;
- mapa de faixas concluídas;
- hash incremental ou hashes por bloco;
- horário da última validação.

Na retomada, uma nova sondagem precisa confirmar a mesma representação. Caso contrário, os blocos antigos são descartados.

### 5. Cache e borda

Para o primeiro usuário, um Worker que apenas repassa o corpo não acelera uma origem lenta. O ganho grande aparece quando uma CDN pode reutilizar uma cópia já validada. A política de cache precisa respeitar licenças, atualizações e capacidade de armazenamento.

O Service Worker local ajuda em reaberturas no mesmo dispositivo. Ele não deve duplicar o arquivo em Cache API e IndexedDB sem um orçamento explícito de disco.

### 6. APIs de rede opcionais

`navigator.connection`, quando disponível, pode fornecer pistas como `effectiveType` e `saveData`. Esses valores não são confiáveis o bastante para decidir sozinhos. A adaptação deve usar a taxa e os erros medidos durante a própria transferência.

HTTP/2 e HTTP/3 melhoram multiplexação e recuperação de perdas quando a infraestrutura oferece suporte. Eles não removem um limite de banda ou de geração do arquivo no servidor.

## Frente 2: descompressor moderno do Precisa Saúde

### Estado anterior

A versão 2.0.2 de `@precisa-saude/datasus-dbc`:

- aloca o DBF descompactado completo;
- copia a janela DCL byte a byte para outra área;
- percorre Huffman bit a bit;
- começa a produzir registros somente depois de materializar o DBF;
- não expõe saída incremental.

### Núcleo em desenvolvimento

O laboratório já contém:

- tabela Huffman rápida de 9 bits com fallback canônico;
- tabelas em `TypedArray`;
- cópia nativa com `copyWithin` nos casos LZ77 sem autorreferência;
- checagem explícita de fim prematuro da entrada;
- limite de saída antes da alocação;
- `implodeDecompressInto()` para destino fornecido pelo chamador;
- `implodeDecompressChunks()` para blocos de até 4 KiB;
- `dbcToDbfChunks()` para cabeçalho e registros em fluxo;
- cancelamento por `AbortSignal` entre blocos;
- compatibilidade com DBCs que omitem o byte EOF final do DBF.

As alterações ainda são experimentais. A suíte anterior passou em uma execução, mas o runner Vitest apresentou encerramento nativo por memória numa execução posterior com Node 24. O typecheck passou quando executado com heap explícito. Nenhum resultado deve ser publicado como validado até o problema do runner ser isolado e a matriz em Node 22 ser executada.

### Quebra de contrato a resolver antes de publicar

O `implodeDecompress` novo é estrito quanto ao byte EOF do DBF: chamado com
`recordCount * recordSize + 1`, que é a convenção do formato, ele lança quando
o arquivo omite esse byte. O 2.0.2 publicado é tolerante e devolve o que
decodificou.

Isso acontece no fixture do próprio pacote — `RDAC2401.dbc` produz 3.029.130
bytes e a convenção pede 3.029.131 —, ou seja, em arquivo real do DATASUS.

A tolerância existe, mas só no `dbc.ts`, que passa `allowMissingFinalByte:
true` por conhecer a convenção. O layering está certo; o problema é semver:
quem chama `implodeDecompress` direto com o comprimento derivado do DBF passa
a receber exceção. **Isto é major, não patch.** Ou a versão sai como 3.0.0 com
a mudança documentada, ou o padrão de `allowMissingFinalByte` passa a ser
`true` no nível cru e a estrita vira opção.

### Por que não paralelizar um único DBC

PKWARE DCL Implode usa uma janela LZ77 de 4 KiB. Um casamento pode depender de bytes produzidos imediatamente antes, por isso um fluxo histórico não pode ser dividido em pontos arbitrários e descompactado em paralelo.

O paralelismo seguro acontece em outros níveis:

- download de faixas independentes;
- arquivos DBC diferentes em Workers diferentes;
- descompressão num Worker enquanto a interface tabula dados já produzidos;
- um formato derivado futuro com checkpoints explícitos.

### WebAssembly

Rust/Wasm é uma opção, não uma premissa. Ele será adotado somente se superar o TypeScript otimizado depois de incluir:

- custo de inicialização do módulo;
- cópia de entrada e saída;
- crescimento da memória linear;
- tempo total no navegador, não apenas o laço interno;
- tamanho adicional do bundle;
- fallback sem Wasm.

Arquivos pequenos podem ser mais rápidos em TypeScript por evitar a fronteira Wasm. Arquivos grandes e repetidos são os candidatos mais prováveis a ganho.

## Integração das duas frentes

O decoder DCL atual recebe um `Uint8Array` completo. A etapa seguinte deve transformá-lo numa máquina de estado que aceite chunks de entrada. Isso permitirá ligar `response.body` diretamente ao Worker.

O buffer de rede precisa manter apenas uma janela curta fora de ordem. Faixas muito distantes podem terminar antes da primeira, mas o decoder sequencial só consome o próximo intervalo contínuo. O downloader deve aplicar backpressure para não guardar centenas de megabytes aguardando uma lacuna.

Transferir `ArrayBuffer` para um Worker evita cópia, mas muda a propriedade do buffer. `SharedArrayBuffer` pode reduzir transferências adicionais, porém exige isolamento de origem com COOP e COEP. Essa exigência precisa ser testada contra a hospedagem real antes de virar arquitetura padrão.

## Fases

### Fase A: correção e baseline

- fixar Node 22 para a validação oficial;
- rodar suíte, cobertura, lint, typecheck e build no código original;
- medir a versão 2.0.2 no fixture `RDAC2401.dbc`;
- registrar mediana, p95, pico de memória e hash da saída.

### Fase B: motor TypeScript

- validar as APIs `into`, `chunks` e materializada;
- comparar caminho rápido e lento byte a byte;
- testar truncamento em vários offsets;
- usar DBCs reais de sistemas e tamanhos diferentes;
- realizar fuzzing diferencial com limites de CPU e memória.

### Fase C: transporte adaptativo

- extrair o cliente de faixas para módulo testável;
- adicionar identidade com `If-Range`;
- implementar retomada por blocos;
- simular 0,8 MB/s, jitter, perda, stall e troca de arquivo;
- medir conexão única contra 2 e 4 faixas.

### Fase D: pipeline no navegador

- mover o decoder para Worker;
- alimentar chunks de entrada em ordem;
- emitir registros ou lotes colunares;
- aplicar backpressure;
- manter progresso separado para rede, descompressão e parsing.

### Fase E: backend Wasm opcional

- protótipo Rust sem dependência obrigatória no pacote principal;
- benchmark nos navegadores suportados;
- seleção automática baseada em tamanho e disponibilidade;
- fallback TypeScript com os mesmos testes goldens.

## Testes de aceite

### Correção

- saída SHA-256 idêntica ao decoder 2.0.2 e ao `dbf2dbc`/oráculo disponível;
- caminho rápido idêntico ao caminho Huffman canônico;
- todos os registros DBF preservados;
- entrada truncada, distância impossível e saída acima do limite falham;
- cancelamento não inicia fallback silencioso.

### Download

- nenhuma parte curta é aceita;
- troca de ETag cancela a montagem;
- falha de uma faixa encerra as irmãs antes do fallback;
- retry ocorre somente para erro transitório;
- progresso conta bytes reais, sem ultrapassar o total;
- transferência retomada produz o mesmo hash da transferência direta.

### Desempenho

- benchmark com aquecimento e pelo menos 20 repetições para arquivos pequenos;
- arquivos grandes medidos em repetições suficientes para estabilidade térmica;
- mediana e p95, sem escolher apenas a melhor execução;
- pico de memória medido separadamente do tempo;
- comparação em Node 22 e pelo menos Chromium;
- resultados de Wi-Fi registrados com RSSI, banda, distância, congestionamento e servidor de teste controlado.

## Critérios para afirmar melhoria

Uma versão só será chamada de mais rápida quando:

1. produzir exatamente os mesmos bytes;
2. não regredir entradas pequenas de forma relevante;
3. melhorar a mediana em mais do que o ruído observado;
4. reduzir ou manter o pico de memória;
5. repetir o ganho fora da máquina de desenvolvimento.

Para rede, o relatório deve separar taxa bruta, tempo até o primeiro byte, tempo total e tempo até o primeiro registro utilizável.

## Arquivos relacionados

- `HANDOFF_MODERN_DECOMPRESSION.md`: estado operacional e comandos de retomada.
- `docs/development/PLAN.md`: plano curto mantido durante a implementação.
- `packages/dbc/src/implode.ts`: núcleo experimental.
- `packages/dbc/src/dbc.ts`: integração com o envelope DATASUS.
- `packages/dbc/test/modern-implode.test.ts`: testes diferenciais e de streaming.

## Fontes técnicas verificadas

- Pacote oficial: https://github.com/Precisa-Saude/datasus-dbc
- `blast.c` de Mark Adler: https://github.com/madler/zlib/blob/master/contrib/blast/blast.c
- PKWARE DCL: https://support.pkware.com/pkzip/dcl
- `pklib` em Rust: https://docs.rs/pklib/latest/pklib/
- crate `implode` com lookup table: https://docs.rs/implode/latest/implode/
