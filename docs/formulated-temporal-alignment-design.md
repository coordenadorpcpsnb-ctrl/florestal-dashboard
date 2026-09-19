# Projeto técnico — alinhamento temporal entre formulados e direcionadores de mercado

> **Etapa 4.** Este documento é exclusivamente diagnóstico e de desenho. Ele **não**
> implementa extrator, **não** cria série histórica nova, **não** cruza dados reais,
> **não** calcula correlação, peso, regressão ou previsão, **não** define faixa de
> negociação nem recomenda compra, e **não** apura custo industrial do fabricante.
> Nenhum dado privado real foi lido ou incluído aqui — os únicos identificadores de
> registro citados como exemplo são inequivocamente fictícios.

## 1. Resumo executivo

O repositório hoje tem duas fontes de histórico de mercado **estruturalmente
diferentes** e um histórico privado de formulados (Etapa 1–3) que ainda não foi
cruzado com nada:

1. **`data.json`** — uma **fotografia corrente** (não uma série), reescrita por
   inteiro a cada execução da esteira semanal. `previous` é a fotografia da
   *execução anterior*, não necessariamente "a semana passada" no calendário.
2. **`dashboard.html` (bloco `SERIES-START`/`SERIES-END`)** — arrays mensais
   (`MONTHS`, `fert.ureia`, `macro.dolar`, `soy.soja` etc.) que **são** uma série
   histórica de verdade, mas vivem fora de `data.json`, são atualizados no máximo
   uma vez por mês, e não foram auditados via `git log` nesta etapa (fora do
   escopo formal desta auditoria, que o pedido restringiu a `data.json` — ver
   seção 18).
3. **Histórico privado de formulados** (`formulated-price-history.mjs` e módulos
   das Etapas 1–3) — tem `dataCotacao`/`dataCompra`/`fonteRegistro`, mas ainda
   nenhuma regra formal de qual data usar em qual tipo de análise.

A auditoria do histórico Git de `data.json` (29 commits, `git log --follow`,
2026-07-23 a 2026-09-16) confirma que **câmbio e gás natural nunca carregam uma
data de referência identificável** dentro de `data.json` — só BDI e soja nacional
têm data extraída de texto (não um campo estruturado), e ureia/MAP/KCl têm
`refsFertilizantes` estruturado, mas com só **3 meses de fechamento distintos**
observados em 29 commits. Esses achados, e os demais, estão detalhados nas
seções 6 a 9.

## 2. Objetivo e limites

**Objetivo desta etapa:** diagnosticar a disponibilidade histórica real dos
direcionadores de mercado hoje no repositório e desenhar — sem implementar —
como um futuro alinhamento temporal entre esses direcionadores e o histórico
privado de formulados deveria funcionar.

**Princípio de negócio (repetido aqui por ser a premissa de todo o desenho):** o
objetivo futuro é estimar como movimentos observáveis de mercado *podem estar
relacionados* aos preços comerciais dos formulados — nunca reconstruir custo
industrial, beneficiamento, produção, granulação, micronutrientes, embalagem,
margem comercial, tributos ou logística não observada. Qualquer resultado futuro
é referência histórica ou faixa estimada, nunca um custo calculado.

**Limites explícitos desta etapa:** nenhum extrator novo, nenhuma série nova
gravada, nenhum cruzamento de dados real, nenhuma correlação/peso/regressão/
previsão, nenhuma alteração em `data.json`, dashboard, relatório, workflow ou
schema da base de formulados, nenhuma leitura de dado privado real, nenhum
`push`.

## 3. Arquitetura atual

```
fetch-data.mjs ──┬─→ data.json (fotografia corrente, sobrescrita a cada run)
                  │
patch-dashboard.mjs ─→ dashboard.html
                        ├─ blocos KPIS/LIVE/ALERTS/CONTEXTO (a partir de data.json)
                        └─ bloco SERIES (MONTHS + arrays mensais — só estende
                           quando o rótulo do mês muda, não a cada execução)

build-report.mjs ─→ relatorio_executivo.docx/.pdf (a partir de data.json + contexto-mercado.json)

--- separado de tudo acima, sem nenhuma conexão automática ainda: ---

import-formulated-history.mjs ─→ data/private/*.private.json (histórico privado)
profile-formulated-history.mjs ─→ relatório de qualidade (Etapa 3, também privado)
```

`run-weekly.mjs` executa `fetch-data.mjs → patch-dashboard.mjs → build-report.mjs
→ build-email.mjs`, nessa ordem, parando no primeiro erro. Nenhum desses passos
lê ou escreve nada do histórico de formulados — as duas árvores de dados são
hoje completamente desconectadas, como pedido pelas Etapas 1–3.

## 4. Inventário dos indicadores

| Indicador | Campo em `data.json.current` | Fonte primária | Fonte de fallback | Frequência nominal da fonte |
|---|---|---|---|---|
| Dólar (câmbio) | `dolar` | BCB PTAX | Frankfurter → AwesomeAPI | diária (dias úteis) |
| Ureia FOB | `ureia` | ComexStat (NCM 3102.10.10) | `fertilizers-override.json` | mensal |
| MAP FOB | `map` | ComexStat (NCM 3105.40.00) | `fertilizers-override.json` | mensal |
| KCl FOB | `kcl` | ComexStat (NCM 3104.20.10 + 3104.20.90) | `fertilizers-override.json` | mensal |
| Gás natural | `gas` | EIA Henry Hub (precisa `EIA_API_KEY`) | stooq (futuro NG) | diária |
| Frete marítimo (BDI) | `bdi` | HANDYBULK (texto corrido) | stooq | diária |
| Soja CEPEA (nacional) | `soja` | Notícias Agrícolas (republica CEPEA/ESALQ-PR) | site do CEPEA direto | diária |
| Soja Oeste BA (AIBA) | `sojaTO` | Notícias Agrícolas (mercado físico) | estimativa 95,7% do CEPEA nacional | diária (quando cotada) |
| Diesel S10 | — | **removido do sistema** (commit `60e5498` / branch já mesclada que removeu o indicador e a aba Logística) | — | — |
| Relação de troca soja/MAP e soja/ureia | `troca.map`, `troca.ureia` | calculada (não é um direcionador observado, é derivada de `dolar`+`soja`+`ureia`/`map`) | — | acompanha a frequência do indicador mais lento do cálculo |

Não existe nenhum outro direcionador automático no repositório além destes. A
tabela cobre exatamente os campos que `fetch-data.mjs`/`fetch-fertilizers.mjs`
produzem hoje — nada foi inferido além do que o código efetivamente busca.

## 5. Diagnóstico de `data.json`

Estrutura observada no arquivo atual (nomes e tipos — sem reproduzir os valores
de mercado, que já são públicos no próprio arquivo do repositório para quem
precisar deles):

| Campo raiz | Tipo | Significado | Observação |
|---|---|---|---|
| `updatedAt` | string (ISO 8601 UTC) | timestamp da execução que gravou o arquivo | é a **data da coleta/commit**, não a data de referência econômica de cada indicador |
| `updatedAtBR` | string | mesmo timestamp, formatado pt-BR | redundante com `updatedAt`, só para leitura humana |
| `ref` | string `"Mmm/AAAA"` | mês/ano "de exibição" do dashboard (mês corrente da execução) | não é a data de referência de nenhum indicador específico — é um rótulo geral |
| `current` | objeto | leitura mais recente de cada indicador (ver seção 4) | fotografia única, sem histórico embutido |
| `previous` | objeto | **o `current` da execução anterior** (o que estava em `data.json` antes desta execução rodar) | não é necessariamente "uma semana atrás" — ver seção 6 |
| `delta` | objeto | variação percentual `current` vs `previous`, arredondada a 1 casa | `null` para ureia/map/kcl quando `refsFertilizantes` não mudou (regra explícita no código, para não parecer "estável" um mês sem fechamento novo) |
| `troca` | objeto | relação de troca soja/MAP e soja/ureia, calculada | derivado, não observado diretamente |
| `status` | objeto | uma string por fonte, começando com `"ok"` ou `"falha:"` | às vezes embute a data de referência como texto livre (BDI, soja) — nunca um campo estruturado |
| `refsFertilizantes` | objeto `{ureia, map, kcl}` | mês de referência (`"AAAA-MM"`) do fechamento ComexStat usado em cada fertilizante | é o único campo do arquivo com uma data de referência econômica verdadeiramente estruturada |
| `noticiasFert` | array | notícias recentes de fertilizantes, com `titulo`/`url`/`data` | campo `data` está sempre `null` no conteúdo atual — a data só existe embutida no texto do título |

Nenhum valor de `null`/fallback foi copiado aqui além do que já é estrutural
(campo `data` de `noticiasFert`, que é `null` por construção — `fetch-noticias.mjs`
não popula essa chave). Não há campo `collectedAt`, `referenceDate` ou
`sourceStatus` estruturado hoje — os três conceitos, quando existem, estão
misturados dentro de `status` como texto livre.

## 6. Auditoria do histórico Git

**Escopo e método:** somente leitura. Comandos usados: `git log --follow
--format=... -- data.json` (lista de commits) e `git show <hash>:data.json`
(conteúdo de cada versão, lido como objeto Git — sem checkout, sem alterar a
working tree, sem tocar referências). A lista completa de comandos está na
seção 20. Um script auxiliar foi usado para automatizar a leitura de metadados
(nunca de valores de preço) e **não foi commitado** — ver confirmação na
seção 24.

**Contagens** (cada uma calculada diretamente, não estimada — ver a distinção
pedida entre os cinco tipos de contagem):

| O que foi contado | Resultado |
|---|---|
| Commits que tocaram `data.json` (`git log --follow`) | **29** |
| Snapshots (blobs) de `data.json` com conteúdo byte-a-byte distinto | **29** (nenhum duplicado — todo commit muda pelo menos `updatedAt`) |
| Dias-calendário distintos entre esses 29 commits | **16** |
| Datas de referência mensais distintas de `refsFertilizantes.ureia`/`.map`/`.kcl`, juntas | **3** (`2026-06`, `2026-07`, `2026-08`) |
| Commits com os três `refsFertilizantes` iguais entre si | 25 de 29 |
| Commits com os três `refsFertilizantes` diferentes entre si | 0 de 29 (mas o código não impede que aconteça — ver seção 7) |
| Commits com `refsFertilizantes` incompleto (algum produto ausente) | 4 de 29 — todos anteriores a 2026-07-23T13h ou os dois commits manuais |
| Commits com `status.cambio` carregando uma data DD/MM/AAAA identificável em texto | **0 de 29** |
| Commits com `status.gas` carregando uma data identificável em texto | **0 de 29** |
| Commits com `status.bdi` carregando uma data identificável em texto | 27 de 29 (as 2 exceções são os commits manuais, com `status` inteiramente `null`) |
| Commits com `status.soja` carregando uma data identificável em texto | 27 de 29 (mesmas 2 exceções) |
| Commits com `status.sojaRegional` carregando uma data identificável em texto | **0 de 29** (o parser de soja regional nunca captura data, só preço e praça) |
| Commits com ao menos uma falha de fonte registrada em `status` | 5 de 29 (`ac86c21`, `9ec93c8`, `c124b41`, `1217471` — todos na rajada de 2026-07-23 — e `5f3002d`, uma falha real de ComexStat em 2026-09-15) |

**"Número de observações utilizáveis" é deliberadamente deixado em branco
aqui** — depende da definição de "observação" que a Etapa 5 escolher (um
commit? um dia-calendário distinto? um mês de fechamento?), que é justamente a
pergunta que este documento não decide (ver seção 17).

**Rajada de commits em 2026-07-23:** 11 dos 29 commits (38%) foram feitos no
mesmo dia, em um intervalo de poucas horas — evidentemente o período de
configuração/teste inicial da automação, não 11 execuções semanais reais. Um
segundo agrupamento menor ocorreu em 2026-08-11 (3 commits) e em 2026-09-15 (2
commits). Contar commits como se fossem "semanas observadas" superestimaria a
cobertura real.

**Evolução estrutural das chaves de raiz:**

- Commit mais antigo auditado (`36ab47e`, 2026-07-23, mensagem "Dashboard
  atualizado", claramente manual): só 6 chaves — `current, delta, previous,
  ref, status, troca`. Sem `updatedAt`, `updatedAtBR`, `refsFertilizantes` nem
  `noticiasFert`.
- A partir de `1217471` (mesmo dia, algumas horas depois): ganha
  `refsFertilizantes`, `updatedAt`, `updatedAtBR` (9 chaves).
- A partir de `5ecebc6`/`d9dcfb8` (2026-08-11): ganha `noticiasFert` (10
  chaves — o conjunto atual).

Isso responde diretamente à pergunta 14 do pedido: **sim, houve mudança de
estrutura** (adição de campos) ao longo do histórico — nunca remoção, nunca
renomeação identificada nos 29 commits auditados.

**Dois commits com `status` inteiramente `null`** (`d9dcfb8` "Update files" e
`36ab47e` "Dashboard atualizado") são snapshots claramente editados/gerados
manualmente antes ou fora da automação normal — não representam uma execução
real de `fetch-data.mjs` (que sempre popula `status`). Tratá-los como
"observação de mercado automática" seria um erro de classificação.

## 7. Cobertura observada por indicador

| Indicador | Primeira referência observável no período auditado | Última referência observável | Nº de datas de referência distintas observadas |
|---|---|---|---|
| Ureia FOB | `2026-06` (`refsFertilizantes.ureia`) | `2026-08` | 3 |
| MAP FOB | `2026-06` | `2026-08` | 3 |
| KCl FOB | `2026-06` | `2026-08` | 3 |
| BDI | 22/07/2026 (extraída de `status.bdi`, texto livre) | 15/09/2026 | não contado formalmente — a data é texto livre, não uma chave estruturada; contar exigiria normalizar 27 strings heterogêneas, o que não foi feito nesta etapa para não estimar além do que foi de fato calculado |
| Soja CEPEA nacional | 22/07/2026 (texto livre) | 15/09/2026 | mesma ressalva do BDI |
| Câmbio | não identificável | não identificável | 0 (nenhuma data estruturada nem em texto) |
| Gás natural | não identificável | não identificável | 0 |
| Soja Oeste BA (AIBA) | não identificável | não identificável | 0 |

Os únicos indicadores com "primeira e última referência observável" realmente
contáveis de forma estruturada são ureia/MAP/KCl, porque só eles têm
`refsFertilizantes`. Para BDI/soja a data existe, mas só dentro de uma string
de status pensada para leitura humana, não para agregação — contar exigiria uma
lógica de parsing que esta etapa deliberadamente não construiu (seria começar a
implementar o extrator, fora do escopo).

**Existem indicadores mensais, semanais e diários misturados?** Sim: ureia/
MAP/KCl são mensais (fechamento ComexStat); câmbio, gás, BDI e soja são de
frequência nominal diária, mas a *cadência real de coleta* é semanal (a
automação roda uma vez por semana, mais execuções manuais avulsas) — a
granularidade diária da fonte não é aproveitada, cada execução só guarda o
valor do dia da coleta.

## 8. Qualidade das datas

Resumo direto das perguntas 5 a 9 do pedido, com evidência:

- **Câmbio possui data diária identificável?** Não, dentro de `data.json`. A
  chamada à API do BCB PTAX (`fetch-data.mjs`, função `getCambio`) pede uma
  janela de 12 dias e ordena por `dataHoraCotacao` decrescente, e **a resposta
  da API contém essa data** — mas o código só extrai `cotacaoVenda`
  (`parseFloat(...cotacaoVenda)`), descartando `dataHoraCotacao` antes de
  gravar em `status` ou em qualquer outro campo. É um dado que existe na fonte
  e se perde no processamento atual.
- **BDI possui data de referência identificável?** Sim, mas só como texto
  livre dentro de `status.bdi` (ex.: extraída de uma frase como "... points"
  precedida por "DD-Mês-AAAA" no HTML da HANDYBULK), nunca como campo
  estruturado.
- **Gás natural possui data de referência identificável?** Não. A API da EIA
  retorna um campo `period` (data) junto com o valor, mas `buscarGasNatural()`
  só extrai `value`, descartando `period` — mesmo padrão do câmbio. O fallback
  stooq também não registra data.
- **Soja (nacional) possui data de referência identificável?** Sim, como texto
  livre em `status.soja`, extraída da própria tabela HTML da fonte (coluna de
  data ao lado do preço).
- **Diesel possui data de referência identificável?** Não aplicável — o
  indicador foi removido do sistema (ver seção 4); não há mais busca, campo
  nem status para diesel em nenhum commit do período auditado.
- **Soja Oeste BA (AIBA) possui data identificável?** Não. `getSojaRegional()`
  extrai preço e nome da praça da tabela de mercado físico, mas não captura
  nenhuma data da mesma linha.

**Risco central, válido para todos os indicadores:** a data do commit
(`updatedAt`) **não é** a data econômica do indicador, e o desenho futuro não
deve assumir isso. Um commit de segunda-feira pode conter uma cotação de
câmbio de sexta-feira (a API busca "o último valor disponível em até 12 dias"),
um fechamento de ComexStat de dois meses atrás, e um BDI de dois dias atrás —
tudo na mesma fotografia, com uma única `updatedAt`.

## 9. Classificação possível de status

O pedido definiu cinco categorias-alvo para uma futura observação de
direcionador: `OBSERVADO`, `FALLBACK_ULTIMO_CONHECIDO`, `OVERRIDE_MANUAL`,
`AUSENTE`, `NAO_IDENTIFICAVEL`. Com os metadados que `data.json` guarda hoje,
o que dá para determinar automaticamente é:

| Categoria | Determinável hoje com `data.json`? | Como |
|---|---|---|
| `OBSERVADO` | Parcialmente | `status.<fonte>` começando com `"ok"` indica sucesso da busca automática **naquela execução** — mas não confirma que o valor é de uma data nova (pode ser o mesmo valor da execução anterior, coincidentemente) |
| `FALLBACK_ULTIMO_CONHECIDO` | Parcialmente | Só quando `status.<fonte>` começa com `"falha:"` — nesse caso o valor em `current` veio de `previous`/override, não de uma busca bem-sucedida. Quando o status é `"ok"` mas o valor é idêntico ao anterior por coincidência de mercado, **não dá para distinguir** de um fallback silencioso sem outra fonte de verdade |
| `OVERRIDE_MANUAL` | Parcialmente | Só é identificável comparando `status` com o conteúdo de `fertilizers-override.json` no mesmo commit (não guardado em `data.json`) — e só nos casos em que a busca automática falhou ou `forceManual: true` estava ativo. `data.json` sozinho não registra "este valor veio do override" |
| `AUSENTE` | Sim | Quando o campo correspondente é `null` em `current` (acontece quando nunca houve leitura anterior nem override, ex.: primeira execução) |
| `NAO_IDENTIFICAVEL` | Sim, por definição | Todo o resto — inclusive câmbio/gás/sojaTO, que nunca têm data de referência identificável (seção 8), e os dois commits manuais com `status` nulo |

Nenhuma classificação retroativa foi aplicada aos 29 commits além do que a
tabela de contagens da seção 6 já mostra (ex.: os 5 commits com falha
registrada). Quando não deu para determinar com confiança, a categoria correta
é `NAO_IDENTIFICAVEL` — não uma suposição.

## 10. Datas dos formulados

Campos disponíveis no schema privado (Etapas 1–3, não alterado nesta etapa):
`dataCotacao` (obrigatória), `dataCompra` (opcional), `fonteRegistro`
(`COTACAO`/`PEDIDO_COMPRA`/`NOTA_FISCAL`/`CONTRATO`/`REGISTRO_INTERNO`),
`validadeProposta` (opcional).

Regra proposta para uso futuro (não implementada aqui):

- **A. Análise de cotação:** usar `dataCotacao` como data central do evento —
  é a única data sempre presente e sempre representa o momento da negociação/
  proposta, independentemente de ter virado compra.
- **B. Análise de compra:** quando `dataCompra` está presente, usá-la para
  perguntas do tipo "o que estava acontecendo no mercado quando a compra foi
  efetivada" — mas manter `dataCotacao` disponível como a data em que o preço
  foi negociado, porque um alinhamento temporal que ignore `dataCotacao`
  perderia a data mais próxima da formação do preço. Nunca inventar
  `dataCompra` quando ausente.
- **C. Registros de `CONTRATO`:** `dataCompra`, quando existir num registro de
  contrato, pode representar só o início da vigência — não necessariamente
  todo o período em que o preço daquele contrato ficou em vigor. Sem um campo
  de `deliveryDate`/período de vigência (que não existe no schema atual), não
  há como definir automaticamente uma regra para "todo o período coberto" —
  fica como decisão pendente (seção 18), não uma regra inventada agora.
- **D. Registros de `NOTA_FISCAL`:** `dataCompra` pode representar
  contratação, faturamento ou registro interno, dependendo de como cada
  fornecedor/processo preenche o documento de origem — o schema não distingue
  esses casos hoje. Documentar a limitação é a ação desta etapa; **não** foi
  criada uma regra automática para adivinhar qual dos três significados se
  aplica.

## 11. Candidatos de janela

Candidatos a projetar (nenhum escolhido nesta etapa):

- **T0** — a referência de mercado disponível mais próxima e **não posterior**
  a `dataCotacao` do formulado (ou `dataCompra`, conforme a regra da seção 10
  que a análise futura escolher). Nunca posterior — violar isso é look-ahead
  bias.
- **T-1, T-2, T-3** — os períodos imediatamente anteriores a T0, na
  granularidade nativa de cada indicador (mês anterior para ureia/MAP/KCl; dia
  útil anterior mais próximo para os diários).
- **Médias móveis de 30/60/90 dias anteriores** — só fazem sentido para os
  indicadores de granularidade diária (câmbio, BDI, soja); para os mensais,
  seria uma média móvel de 1, 2 ou 3 meses fechados anteriores, não de dias.
- **Média dos 3 meses anteriores** — proposta específica para ureia/MAP/KCl,
  dado que só há fechamento uma vez por mês.

Decisões que o desenho futuro precisa fixar explicitamente antes de calcular
qualquer janela (nenhuma resolvida aqui):

| Decisão | Opções em aberto |
|---|---|
| Janela inclusiva ou exclusiva de T0 | incluir o próprio dia da referência ou só estritamente anterior |
| Fim de semana | usar o último dia útil anterior, ou tratar como lacuna |
| Feriado | mesma pergunta que fim de semana — o repositório hoje não tem calendário de feriados |
| Mês incompleto (ex.: fechamento do ComexStat ainda não publicado) | esperar o fechamento (atraso de 1–2 meses, conforme README seção 8) ou usar o mês anterior disponível |
| Nenhuma observação anterior disponível (formulado mais antigo que o histórico de mercado coletado) | marcar como `NAO_IDENTIFICAVEL`/lacuna, nunca extrapolar |
| Valor congelado (fallback) dentro da janela | contar como observação real ou excluir — hoje só é detectável via `status`, e só nos casos em que a fonte falhou explicitamente (seção 9) |
| Override manual dentro da janela | mesma pergunta — hoje não é distinguível de um valor automático só olhando `data.json` |
| Múltiplos snapshots da mesma referência (ex.: 3 commits no mesmo dia, mesmo mês de fechamento) | usar o mais recente, o primeiro, ou agregar — não decidido |

## 12. Matriz conceitual de alinhamento

Estrutura conceitual de uma futura linha analítica (**não implementada, não é
código real, id e datas abaixo são fictícios**):

```json
{
  "formulatedRecordId": "fp-exemplo-ficticio-000001",
  "eventDate": "2026-05-10",
  "eventType": "COTACAO",
  "seriesId": "serie-001",
  "drivers": {
    "ureia": {
      "value": null,
      "unit": "USD_TON",
      "referencePeriod": null,
      "collectedAt": null,
      "status": "NAO_IDENTIFICAVEL",
      "lagDays": null
    },
    "dolar": {
      "value": null,
      "unit": "BRL_USD",
      "referencePeriod": null,
      "collectedAt": null,
      "status": "NAO_IDENTIFICAVEL",
      "lagDays": null
    }
  }
}
```

`referencePeriod` (data/mês econômico do indicador), `collectedAt` (quando a
automação buscou/commitou aquele valor) e `commitDate` (data do commit Git)
são **três conceitos diferentes** que o desenho futuro deve manter separados —
hoje `data.json` só guarda algo parecido com `collectedAt`/`commitDate`
(`updatedAt`) de forma confiável; `referencePeriod` só existe, estruturado,
para ureia/MAP/KCl.

## 13. Unidades e opções de transformação

**Opção A — manter cada matéria-prima em US$/t, com dólar como variável
separada.** Mais simples, preserva a granularidade da fonte, mas exige que
qualquer comparação futura trate câmbio e matéria-prima como duas séries
independentes.

**Opção B — converter cada matéria-prima para R$/t usando o câmbio da data de
referência.** Mais direto para comparar com preço comercial em reais do
formulado, mas introduz riscos:

- **Dupla contagem do efeito cambial** — se o formulado importado já embute
  variação cambial no preço negociado, converter a matéria-prima separadamente
  pode contar o mesmo movimento duas vezes.
- **Datas diferentes entre matéria-prima e dólar** — câmbio não tem data
  identificável hoje (seção 8); usar `updatedAt` do commit como proxy da data
  cambial seria uma aproximação não documentada como tal.
- **Preço FOB não é custo entregue** — nenhuma das duas opções resolve a
  ausência de frete, seguro e demais custos de importação.
- **NPK garantido vs. participação física da matéria-prima** — a fórmula do
  formulado (ex.: uma NPK qualquer) não informa a proporção física real de
  ureia/MAP/KCl usada — qualquer peso assumido seria inventado.
- **Micronutrientes, mudanças de margem e de processo produtivo** não são
  observados por nenhuma das duas fontes de dado atuais.

Nenhuma das duas opções deve ser escolhida como definitiva sem testar contra
dados reais numa etapa futura — este documento só registra os riscos de cada
uma.

## 14. Riscos e limitações (vieses)

- **Viés de seleção** — só os fornecedores/negociações que efetivamente geram
  um registro no histórico privado entram na análise; compras não registradas
  ficam de fora sem nenhuma indicação disso.
- **Viés de sobrevivência** — se registros antigos foram descartados ou nunca
  digitados, séries "que sobreviveram" no histórico podem não representar bem
  o passado real.
- **Look-ahead bias** — usar uma referência de mercado posterior à data do
  formulado (a regra de T0 da seção 11 existe para evitar isso).
- **Defasagem de repasse** — o preço do formulado pode reagir ao mercado de
  matéria-prima com atraso (contratos, estoque do fornecedor), não
  instantaneamente.
- **Autocorrelação temporal** — cotações próximas no tempo não são
  observações independentes entre si (ver seção 15).
- **Sazonalidade** — plantio/safra concentram compras em janelas específicas
  do ano, o que pode confundir "tendência de preço" com "época do ano".
- **Mudança de fornecedor, de formulação, de modalidade ou de prazo** — cada
  uma altera o que está sendo comparado; é por isso que a Etapa 3 usa
  `serieExata` em vez de comparar registros soltos.
- **Volume negociado** — não é peso amostral automático de nada; volumes
  diferentes podem representar poder de negociação diferente.
- **Diferença entre cotação e compra** — nem toda cotação vira compra (ver
  seção 10).
- **Estoques do fabricante, contratos cambiais e estoque em trânsito do
  fornecedor** — nenhum desses é observável a partir dos dados hoje
  disponíveis.
- **Custos industriais, margem comercial e frete rodoviário não observados**
  — reafirmando o princípio de negócio da seção 2: o modelo futuro nunca deve
  tentar reconstruir esses valores.
- **Mudança de fonte ou metodologia** — já aconteceu no histórico auditado
  (ex.: câmbio migrou de AwesomeAPI para BCB PTAX como fonte primária, embora
  `check-status.mjs` ainda rotule "AwesomeAPI" — inconsistência de rótulo já
  conhecida e documentada em `CLAUDE.md`, não corrigida nesta etapa por estar
  fora do escopo).

## 15. Pseudorreplicação

Risco central: tratar várias cotações do mesmo evento comercial como se fossem
observações independentes infla artificialmente a quantidade aparente de
dados. Exemplos concretos que podem ocorrer no histórico privado:

- três fornecedores cotados no mesmo dia para a mesma necessidade;
- várias propostas para a mesma necessidade de compra;
- renovação da mesma proposta em datas próximas;
- notas fiscais que na verdade fecham uma única negociação, faturada em
  partes;
- entregas parceladas de um único contrato, cada uma virando um registro.

O mesmo risco já apareceu na própria auditoria desta etapa: 11 dos 29 commits
de `data.json` vieram da mesma rajada de configuração em 2026-07-23 (seção 6)
— contá-los como "11 semanas de mercado observadas" seria pseudorreplicação
idêntica em espírito.

Conceitos a projetar para mitigar isso no futuro (não implementados, schema
não alterado): **evento de negociação**, **lote de cotação**, **processo de
compra**, **contrato**, **rodada comercial**. Campos que poderiam apoiar esses
conceitos, citados apenas como ideia a avaliar — **nenhum implementado, nenhum
identificador real incluído**: `negotiationEventId`, `purchaseProcessId`,
`contractId` técnico, `deliveryDate`, `paymentConditionType`,
`freightIncluded`, `formulationRevision`.

## 16. Segmentações necessárias

Qualquer análise futura precisa poder segmentar por, no mínimo:

- `serieId` (Etapa 3 — produto/fórmula/modalidade/destino);
- `fonteRegistro` (cotação vs. compra efetivada);
- presença ou ausência de `dataCompra`;
- ano de referência (`anoReferencia`);
- classificação de suficiência da série (Etapa 3 —
  `INSUFICIENTE`/`LIMITADA`/`EXPLORATORIA`);
- presença de alertas de mistura (`MISTURA_DE_FONTES_NA_SERIE`,
  `MISTURA_DE_FORNECEDORES_NA_SERIE`, `MISTURA_DE_PRAZOS_NA_SERIE`) — uma
  série com mistura relevante pode precisar ser tratada separadamente num
  alinhamento temporal, para não misturar condições comerciais diferentes sob
  o mesmo rótulo.

## 17. Critérios para avanço

Proposta inicial — **números marcados explicitamente como ponto de partida a
validar, não como garantia de precisão**, seguindo a mesma lógica de
`classificarSuficiencia()` da Etapa 3 (que também nunca promete confiança
estatística):

| Nível | Critério proposto (a validar) |
|---|---|
| 1. Suficiente para análise exploratória | pelo menos 1 série com classificação `LIMITADA` ou `EXPLORATORIA` (Etapa 3) já é o bastante para começar a olhar os dados lado a lado |
| 2. Suficiente para testar correlação | pelo menos uma série `EXPLORATORIA` (12+ registros, 2+ anos) **e** o indicador de mercado correspondente com pelo menos o mesmo número de períodos independentes (não commits — ver seção 6) cobrindo a mesma janela de tempo |
| 3. Suficiente para testar defasagem | mesmo critério do nível 2, mais múltiplas séries `EXPLORATORIA` para poder comparar defasagens entre séries diferentes |
| 4. Suficiente para um modelo de referência | proposta deliberadamente **não numérica** aqui — depende de decisões ainda pendentes (seção 18) sobre pseudorreplicação e unidade de análise, que precisam ser resolvidas antes de qualquer número fazer sentido |
| 5. Insuficiente | qualquer caso abaixo do nível 1, ou quando a proporção de registros com alertas `MISTURA_DE_*`/outliers não revisados for alta demais para a série ser tratada como uma unidade comparável (limiar não definido nesta etapa) |

Dimensões que qualquer critério futuro precisa considerar, além da contagem
bruta: anos distintos, número de períodos independentes (não commits, não
registros brutos), variabilidade do indicador de mercado no mesmo período,
cobertura por série, proporção de compras efetivadas vs. cotações, estabilidade
de fórmula dentro da série, comparabilidade logística (modalidade/destino) e
quantidade de valores `NAO_IDENTIFICAVEL`/`FALLBACK_ULTIMO_CONHECIDO` na janela
usada.

## 18. Decisões ainda pendentes

- Qual conceito usar como "observação independente" para o histórico de
  mercado: commit, dia-calendário distinto, ou mês de fechamento (para os
  mensais)? Esta etapa mostrou que as três respostas dão números muito
  diferentes (29 vs. 16 vs. 3, respectivamente, no período auditado) — ver
  seção 6.
- Regra automática para `dataCompra` em registros de `CONTRATO` (seção 10-C) —
  requer decidir se um campo de período de vigência é necessário no schema, o
  que é uma mudança de schema fora do escopo desta etapa.
- Como (e se) auditar formalmente o histórico Git do bloco `SERIES` de
  `dashboard.html` — esta etapa não fez essa auditoria porque o pedido
  restringiu o escopo formal a `data.json`; os valores mensais mais antigos
  desse bloco têm um padrão visualmente muito mais suave e regular que os
  meses mais recentes, o que **sugere** (sem confirmação por auditoria Git
  nesta etapa) que a parte inicial da série pode ter sido estimada/semeada
  manualmente em vez de coletada — fica como item a verificar antes de usar
  esse bloco como fonte histórica real.
- Se e como capturar `dataHoraCotacao` (câmbio) e `period` (gás/EIA) das
  respostas das APIs, hoje descartadas pelo código (seção 8) — implica alterar
  `fetch-data.mjs`/`fetch-fertilizers.mjs`, fora do escopo desta etapa.
- Escolha entre Opção A e Opção B de unidade (seção 13) — não pode ser feita
  sem testar contra dados reais.
- Definição formal de evento de negociação/lote de cotação (seção 15) —
  depende de decidir se vale a pena estender o schema privado, o que é uma
  mudança fora do escopo desta etapa.

## 19. Proposta de Etapa 5

Sugestão de escopo, **apenas indicado, não implementado aqui**:

- criação controlada de um extrator histórico (ainda sem cruzar com
  formulados);
- desenho de um schema de série temporal para os direcionadores de mercado
  (separado do schema de formulados, que não deve ser alterado);
- testes com snapshots **fictícios** (nunca dados reais de mercado nem
  privados);
- sem cruzamento com formulados nesta etapa seguinte;
- sem previsão.

> **Nota (Etapa 5):** o extrator descrito acima foi implementado
> (`extract-market-driver-history.mjs` + `schemas/market-driver-history.schema.json`)
> numa etapa posterior a este documento — ver README, seção 13. A separação
> em três domínios (histórico comercial privado dos formulados, catálogo
> técnico privado das formulações — ainda não criado — e histórico público dos
> direcionadores) foi decidida nessa mesma etapa; nenhum vínculo técnico entre
> os domínios (`formulationId` ou equivalente) foi criado ainda.
>
> **Nota (Etapa 5.1):** a classificação de proveniência (`sourceStatus`) foi
> endurecida — igualdade de valor com `previous` ou com o override deixou de
> ser, sozinha, prova de `FALLBACK_ULTIMO_CONHECIDO`/`OVERRIDE_MANUAL`; passou
> a exigir evidência explícita no texto de status (hoje, só comprovada para
> `sojaTO`) ou nas regras determinísticas de `fetch-data.mjs`. Ver README,
> seção 13, subseção "Proveniência exige evidência explícita".
>
> **Nota (Etapa 5.2):** os dois campos de metadata acima viraram opcionais na
> validação (compatibilidade retroativa com saídas da Etapa 5; `schemaVersion`
> continua `1`), e o resumo de cobertura ganhou uma classificação descritiva
> por indicador (`COBERTURA_ESTRUTURADA_LIMITADA`/`COBERTURA_PARCIAL`/
> `SEM_REFERENCIA_ECONOMICA`/`COBERTURA_NAO_IDENTIFICAVEL`) — ver README,
> seção 13, subseções "Compatibilidade do schema v1" e a cobertura sanitizada.

## 20. Apêndice — comandos de auditoria executados

Todos somente leitura, executados a partir da raiz do repositório:

```bash
git status --porcelain
git log --oneline --decorate --all
git show --stat 8f81307

git log --follow --oneline -- data.json
git log --follow --format="%h|%ad|%s" --date=iso-strict -- data.json
git show <hash>:data.json          # para cada um dos 29 commits listados acima
git ls-tree <hash> -- data.json    # hash do blob, para checar duplicidade de conteúdo

npm test
npm run validate:formulated-history
python3 -c "import json; json.load(open('<arquivo>.json'))"   # para cada .json do repositório
```

Um script Node auxiliar (`audit-data-json.mjs`) foi usado para automatizar a
leitura de `git show <hash>:data.json` e extrair só metadados (chaves
presentes, `refsFertilizantes`, se `status.<fonte>` contém uma data
`DD/MM/AAAA`, contagens agregadas) — nunca valores de preço. Rodou fora do
repositório (diretório temporário de sessão) e **não foi commitado**; sua
remoção está confirmada no relatório desta etapa (seção 24 do relatório
final).
