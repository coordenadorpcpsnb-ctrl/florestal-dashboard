# Avaliação de fontes históricas complementares — direcionadores de mercado

> **Etapa 6.** Este documento é uma avaliação técnica e de governança. Ele **não
> implementa** nenhuma coleta nova, chamada de API, scraping, download de série,
> armazenamento de valor, histórico complementar, catálogo técnico de
> formulações, `formulationId`, micronutrientes, composição de formulado,
> cruzamento com formulados, correlação, regressão, previsão, faixa de
> negociação ou recomendação de compra. Nenhum arquivo de coleta, dashboard,
> relatório ou workflow foi alterado para produzir este documento.

## 1. Objetivo e escopo desta avaliação

Avaliar, para os direcionadores de mercado hoje presentes em `data.json`
(dólar, ureia, MAP, KCl, gás natural, BDI/frete marítimo, soja nacional e,
apenas se houver fonte legítima e rastreável, soja regional), possíveis
fontes **complementares** de dados históricos — isto é, fontes que poderiam,
numa etapa futura e após aprovação humana, preencher lacunas de profundidade
histórica que o extrator baseado em histórico do Git (`extract-market-driver-
history.mjs`, Etapas 5–5.2) não alcança, porque esse extrator só reconstrói o
que já foi commitado neste repositório.

Este documento **não decide** qual fonte usar. Ele registra o que existe, o
que foi possível verificar nesta pesquisa, o que não foi possível verificar, e
que tipo de decisão (aprovação humana, validação jurídica, priorização de
integração) cada fonte candidata exigiria antes de qualquer uso futuro.

## 2. Fora de escopo — o que esta etapa não implementa

Não implementados nesta etapa, mesmo que tecnicamente possíveis a partir do
que foi encontrado na pesquisa:

- Nenhuma nova chamada de rede em código de produção (`fetch-data.mjs`,
  `fetch-fertilizers.mjs`, `fetch-noticias.mjs` **não foram alterados**).
- Nenhum download, parsing ou armazenamento de série histórica de terceiros.
- Nenhum valor numérico de preço, câmbio, índice ou série foi copiado de
  nenhuma fonte candidata para dentro deste repositório.
- Nenhum catálogo técnico de formulações, `formulationId`, dado de
  micronutriente ou composição de formulado.
- Nenhum cruzamento entre o histórico de direcionadores de mercado e o
  histórico privado de preços de formulados (`data/formulated-prices-
  history.json`).
- Nenhuma correlação, regressão, projeção, previsão de preço, faixa de
  negociação ou recomendação de compra.
- Nenhuma alteração em `dashboard.html`, `relatorio_executivo`, workflows do
  GitHub Actions, `package.json` ou `package-lock.json`.
- Nenhum push, pull request, tag ou release.

## 3. Metodologia de pesquisa e disciplina de verificação

A pesquisa combinou duas fontes de evidência, mantidas sempre distintas:

1. **Evidência de repositório** — leitura direta de `fetch-data.mjs`,
   `fetch-fertilizers.mjs`, `fetch-noticias.mjs`, `fertilizers-override.json`,
   `CLAUDE.md`, `README.md` e `data.json` nesta sessão, para documentar as
   fontes **hoje efetivamente usadas** (seção 4 em diante). Nenhuma afirmação
   sobre a fonte atual foi feita sem uma linha de código ou comentário
   correspondente.
2. **Pesquisa externa** — busca por documentação oficial/primária de possíveis
   fontes complementares, realizada em 2026-09-17, com resultados registrados
   na seção 29 (Referências).

Regras seguidas durante a pesquisa externa, sem exceção:

- **Nunca presumir acesso gratuito, público ou redistribuível.** Quando uma
  fonte não declarou explicitamente sua política de licenciamento/redistrib-
  uição nos resultados encontrados, o campo correspondente foi marcado
  `NAO_VERIFICADO` — nunca preenchido por suposição ou por analogia com outra
  fonte.
- **Nunca contornar paywall, cadastro obrigatório ou autenticação.** Nenhuma
  tentativa foi feita de acessar conteúdo pago ou restrito; quando uma fonte
  exige assinatura, isso está documentado como característica da fonte, não
  como obstáculo a driblar.
- **Preferir documentação institucional primária** (domínio oficial do órgão,
  página de política de dados, página de termos de uso) a blogs, agregadores
  de notícia ou resumos de terceiros. Quando só um resumo de terceiro estava
  disponível na pesquisa, isso está sinalizado explicitamente no texto e o
  dado tratado como não confirmado na fonte primária.
- **Nunca inventar uma URL, um nome de instituição ou uma data de acesso.**
  Toda URL citada neste documento apareceu literalmente nos resultados de
  pesquisa registrados na seção 29; nenhuma foi composta manualmente por
  padrão ("provavelmente é `/api/v2/...`").
- Onde a pesquisa devolveu apenas um **resumo/paráfrase** de uma página (e não
  o texto literal da fonte primária, por exemplo o texto exato de uma cláusula
  de licença), isso está marcado explicitamente como carecendo de confirmação
  humana antes de qualquer uso — mesmo quando o resumo parecia favorável.

## 4. Fontes atualmente em uso — câmbio (dólar)

Evidência: `fetch-data.mjs`, função `getCambio()`.

| Ordem | Fonte | Endpoint (evidência de código) | Chave necessária |
|---|---|---|---|
| 1 (primária) | Banco Central do Brasil — PTAX | `olinda.bcb.gov.br/olinda/servico/PTAX/.../CotacaoDolarPeriodo` | Não |
| 2 (fallback) | Frankfurter | `api.frankfurter.app/latest?from=USD&to=BRL` | Não |
| 3 (fallback) | AwesomeAPI | `economia.awesomeapi.com.br/json/last/USD-BRL` | Não |

O valor usado é `cotacaoVenda` da PTAX. O comentário do código registra que a
AwesomeAPI "pode retornar 429 em IP de datacenter" — por isso ocupa a última
posição.

**Nota de dívida de documentação** (não corrigida nesta etapa, apenas
registrada): a seção 6 do `README.md` ainda lista "AwesomeAPI" como a fonte
automática do dólar, desatualizada em relação ao código atual, que usa BCB
PTAX como primária. Esse é o mesmo tipo de rótulo desatualizado já registrado
em `CLAUDE.md` para `check-status.mjs`.

## 5. Fontes atualmente em uso — soja nacional (CEPEA/ESALQ Paraná)

Evidência: `fetch-data.mjs`, função `getSoja()`.

| Ordem | Fonte | Endpoint (evidência de código) |
|---|---|---|
| 1 (primária) | Notícias Agrícolas (republica indicador CEPEA/ESALQ Paraná) | `noticiasagricolas.com.br/cotacoes/soja/indicador-cepea-esalq-soja-parana` |
| 2 (fallback) | CEPEA/ESALQ direto | `cepea.esalq.usp.br/br/indicador/soja.aspx` |

O comentário do código e `CLAUDE.md` registram que o site do CEPEA
frequentemente bloqueia servidores de datacenter (por isso a fonte primária é
a republicação via Notícias Agrícolas, que não bloqueia).

## 6. Fontes atualmente em uso — soja regional (Oeste da Bahia/AIBA)

Evidência: `fetch-data.mjs`, função `getSojaRegional()`.

Fonte única: Notícias Agrícolas, página `noticiasagricolas.com.br/cotacoes/
soja`, tabela "Soja — Mercado Físico", linha cujo nome de praça contém "Oeste
da Bahia" (associada à AIBA — Associação de Agricultores e Irrigantes da
Bahia). Não há um fallback de **fonte** separada; se essa busca falhar, o
código aplica, nesta ordem, valor manual do override → estimativa (95,7% do
indicador CEPEA nacional) → última leitura conhecida. Essas três alternativas
são comportamento de aplicação, não fontes de dado adicionais, e não são
tratadas como tal nesta avaliação.

O comentário do código explica que essa é "a referência mais próxima do
MATOPIBA disponível publicamente", porque a fonte usada não publica cotação
específica de Tocantins.

## 7. Fontes atualmente em uso — frete marítimo (BDI)

Evidência: `fetch-data.mjs`, função `getBdi()`.

| Ordem | Fonte | Endpoint (evidência de código) |
|---|---|---|
| 1 (primária) | HANDYBULK | `handybulk.com/baltic-dry-index/` (texto corrido, extraído por expressão regular) |
| 2 (fallback) | stooq | `stooq.com/q/d/l/?s=bdi&i=d&l=2` |

O comentário do código registra que, na data da última revisão, o stooq
"devolve página de bloqueio" para esse símbolo — ou seja, o fallback está
presente no código mas seu funcionamento efetivo não está confirmado no
momento da leitura.

## 8. Fontes atualmente em uso — gás natural

Evidência: `fetch-fertilizers.mjs`, função `buscarGasNatural()`.

| Ordem | Fonte | Endpoint (evidência de código) | Chave necessária |
|---|---|---|---|
| 1 (primária, se configurada) | EIA — Henry Hub (série `RNGWHHD`) | `api.eia.gov/v2/natural-gas/pri/fut/data/` | Sim — `EIA_API_KEY` (secret do GitHub Actions) |
| 2 (fallback, ou primária se não houver chave) | stooq (futuro NG) | `stooq.com/q/d/l/?s=ng.f&i=d&l=2` | Não |

Se `EIA_API_KEY` não estiver configurada, o código pula direto para o stooq e
registra esse fato no status ("sem EIA_API_KEY — tentando stooq").

## 9. Fontes atualmente em uso — fertilizantes (ureia, MAP, KCl)

Evidência: `fetch-fertilizers.mjs`, função `buscarFertilizantes()`.

Fonte única: ComexStat — API oficial do MDIC (Ministério do Desenvolvimento,
Indústria, Comércio e Serviços), endpoint `api-comexstat.mdic.gov.br/general`,
sem chave. O preço é o FOB médio de importação brasileira
(`valor FOB ÷ peso líquido em toneladas`), calculado a partir dos NCMs:

| Produto | NCM |
|---|---|
| Ureia (>45% N) | `3102.10.10` |
| MAP | `3105.40.00` |
| Cloreto de potássio (KCl) | `3104.20.10` + `3104.20.90` |

`fertilizers-override.json` funciona como rede de segurança (valor manual só
usado se a busca automática falhar, ou trava se `forceManual: true`) — não é
uma fonte de dado independente, é um mecanismo de contingência da aplicação.

**Armadilha conhecida** (já documentada em `CLAUDE.md` e reconfirmada nesta
leitura): a API do ComexStat só aceita um mês por consulta; um intervalo de
vários meses com `monthDetail` retorna uma lista vazia mesmo quando os dados
existem. A busca atual já contorna isso consultando mês a mês.

## 10. Lacunas de cobertura histórica identificadas (Etapas 5, 5.1, 5.2)

Resumo, sem reproduzir valores, da cobertura real observada ao rodar o
extrator de histórico via Git contra este repositório (ver relatórios das
Etapas 5–5.2 para os números completos):

- **dólar, gás natural e soja regional**: nenhuma observação com referência
  econômica distinta pôde ser reconstruída a partir do histórico de commits —
  classificação de cobertura `SEM_REFERENCIA_ECONOMICA`. Isso não significa
  que a fonte atual esteja com problema; significa que o **histórico do Git**
  não contém informação suficiente para reconstruir uma série temporal
  confiável para esses três indicadores.
- **ureia, MAP e KCl**: cobertura estruturada, porém limitada — poucos meses
  de referência distintos disponíveis no histórico de commits deste
  repositório (classificação `COBERTURA_ESTRUTURADA_LIMITADA`).
- **BDI e soja nacional**: cobertura parcial, com múltiplas datas de
  referência distintas inferidas de texto (classificação `COBERTURA_PARCIAL`).

Essas lacunas são o motivo prático desta avaliação: qualquer fonte
complementar recomendada nas seções seguintes deveria, em primeiro lugar,
ajudar a cobrir justamente os indicadores com menor cobertura reconstruível
(dólar, gás, soja regional), não os que já têm cobertura parcial ou
estruturada.

## 11. Critérios de avaliação de fontes candidatas

Cada fonte candidata (seções 14–19) foi avaliada, na medida do que a pesquisa
permitiu confirmar, segundo os 25 critérios abaixo. Um critério não confirmado
por evidência direta está marcado `NAO_VERIFICADO` no lugar de um valor.

1. Nome oficial da fonte e organização mantenedora
2. Classificação como fonte primária, secundária, comercial, pública não
   oficial ou agregadora (enum da seção 12)
3. URL institucional oficial (não um espelho ou reprodução de terceiro)
4. Necessidade de chave de API, cadastro ou credencial
5. Custo de acesso (gratuito, gratuito com limite, pago por assinatura)
6. Frequência de atualização declarada pela própria fonte
7. Profundidade histórica declarada (desde quando a série começa, segundo a
   própria fonte — nunca uma data inventada por esta avaliação)
8. Formato de disponibilização (API JSON, CSV, XLS, PDF, HTML)
9. Estabilidade conhecida do formato/schema ao longo do tempo
10. Bloqueio conhecido a servidores de datacenter (relevante porque este
    projeto roda em GitHub Actions)
11. Idioma da documentação e dos dados
12. Moeda em que o valor é expresso
13. Unidade de medida em que o valor é expresso
14. Praça, condição comercial ou local de referência do preço (ex.: FOB,
    CFR, porto, região)
15. Existência de termos de uso publicados pela própria fonte
16. Licença de uso explícita (ex.: CC-BY, proprietária, não declarada)
17. Permissão explícita de redistribuição do dado
18. Permissão explícita de uso comercial/institucional
19. Exigência de atribuição
20. Risco conhecido de mudança de política de acesso sem aviso prévio
21. Existência de metodologia pública documentada pela própria fonte
22. Grau de correspondência metodológica com o indicador já usado hoje (mesma
    praça, mesma condição comercial, mesmo tipo de taxa — nunca presumida)
23. Evidência de uso por terceiros de reputação reconhecida
24. Dependência de terceiros (a fonte, por sua vez, agrega de outra fonte?)
25. Necessidade de validação jurídica antes de qualquer uso futuro

## 12. Enum — classificação do tipo de fonte

- `OFICIAL_PRIMARIA` — organização que produz ou mede o dado originalmente
  (ex.: Banco Central para a PTAX, MDIC para o ComexStat, EIA para o Henry
  Hub, CEPEA para seu próprio indicador, Baltic Exchange para o BDI).
- `OFICIAL_SECUNDARIA` — organização oficial/governamental que republica ou
  recompila dado de outra fonte primária (ex.: um banco central republicando
  série de outro órgão).
- `COMERCIAL_LICENCIADA` — exige contrato ou licença paga para acesso e/ou
  redistribuição.
- `PUBLICA_NAO_OFICIAL` — acesso público, mas sem vínculo declarado com o
  órgão medidor original e sem metodologia pública confirmada nesta pesquisa.
- `AGREGADOR` — combina/reprocessa dados de múltiplas fontes terceiras sem
  ser o medidor original nem uma agência oficial republicando dado próprio.
- `NAO_CLASSIFICADA` — evidência insuficiente nesta etapa para qualquer uma
  das classificações acima.

## 13. Enum — status de acesso

- `GRATUITO_SEM_CADASTRO`
- `GRATUITO_COM_CADASTRO` (ex.: exige registro de e-mail/chave, sem custo)
- `GRATUITO_COM_LIMITACAO` (ex.: limite de período por consulta, limite de
  requisições por janela de tempo)
- `PAGO_ASSINATURA`
- `ACESSO_NAO_CONFIRMADO` — equivalente a `NAO_VERIFICADO` para este campo

## 14. Enum — status de redistribuição

- `REDISTRIBUICAO_PERMITIDA_COM_ATRIBUICAO`
- `REDISTRIBUICAO_RESTRITA` — permitida apenas sob licença específica
- `REDISTRIBUICAO_PROIBIDA`
- `REDISTRIBUICAO_NAO_DECLARADA` — equivalente a `NAO_VERIFICADO` para este
  campo

## 15. Enum — recomendação por indicador

- `FONTE_PRIMARIA_RECOMENDADA`
- `FONTE_CONTINGENCIA_RECOMENDADA`
- `FONTE_APENAS_REFERENCIAL`
- `EXIGE_LICENCIAMENTO`
- `EXIGE_VALIDACAO_JURIDICA`
- `SEM_FONTE_APROVADA`

## 16. Fontes candidatas — câmbio (dólar)

**Candidata: Sistema Gerenciador de Séries Temporais do Banco Central (SGS)**
— `api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados` e o Portal de Dados
Abertos do BCB (`dadosabertos.bcb.gov.br`), que expõe a mesma família de
séries cambiais (ex.: série 1, dólar venda) em formato tabular histórico,
diferente do endpoint OLINDA/PTAX já usado hoje.

- Tipo de fonte: `OFICIAL_PRIMARIA` (mesmo órgão — Banco Central — já usado
  como fonte primária atual, apenas um mecanismo de consulta diferente,
  voltado a série histórica em vez de cotação do dia).
- Status de acesso: `GRATUITO_SEM_CADASTRO`, segundo a documentação
  encontrada — porém a pesquisa também encontrou um resumo indicando que,
  desde 26/03/2025, consultas de série diária em JSON/CSV passaram a exigir
  filtro de período, limitadas a intervalos de até 10 anos. Esse detalhe
  **não foi confirmado no texto literal da página oficial** nesta pesquisa —
  tratar como `NAO_VERIFICADO` até checagem direta da documentação do SGS.
- Status de redistribuição: `REDISTRIBUICAO_NAO_DECLARADA` — não foi
  encontrado, nesta pesquisa, um texto de licença explícito para os dados do
  SGS/Dados Abertos do BCB.
- Correspondência metodológica: alta — é o mesmo órgão e, presumivelmente, a
  mesma métrica PTAX já usada, mas isso exige confirmação humana campo a
  campo (qual série SGS corresponde exatamente à "cotação de venda" hoje
  usada) antes de qualquer uso.
- Recomendação: `FONTE_CONTINGENCIA_RECOMENDADA` — para reconstrução
  histórica retroativa (fora do alcance do extrator baseado em Git), não como
  substituta da fonte primária atual.

## 17. Fontes candidatas — soja nacional

**Candidata 1: CEPEA/ESALQ — página de séries históricas do indicador**
(`cepea.org.br/br/indicador/series/soja.aspx`) — mantida pelo mesmo instituto
que já é a origem do dado usado hoje (via republicação do Notícias Agrícolas).

- Tipo de fonte: `OFICIAL_PRIMARIA` (é a origem do próprio indicador já
  usado).
- Status de acesso: `ACESSO_NAO_CONFIRMADO` — o CEPEA oferece parte de seu
  conteúdo (análises, relatórios) por assinatura em outras linhas de produto;
  não foi possível confirmar nesta pesquisa se a série histórica completa do
  indicador de soja Paraná é gratuita ou paga. Some-se a isso que o próprio
  código deste repositório já documenta bloqueio a servidores de datacenter
  no acesso direto ao domínio do CEPEA — mesmo que o conteúdo seja
  publicamente visível a um navegador humano, isso não confirma acesso
  programático viável.
- Status de redistribuição: `REDISTRIBUICAO_NAO_DECLARADA`.
- Recomendação: `EXIGE_VALIDACAO_JURIDICA` antes de qualquer coleta direta ou
  reconstrução histórica além do que já é publicado hoje via Notícias
  Agrícolas.

**Candidata 2: CONAB — Preços Agropecuários, Série Histórica**
(`portaldeinformacoes.conab.gov.br/precos-agropecuarios-serie-historica.html`)
e Série Histórica de Custos de Produção — Soja
(`gov.br/conab/.../serie-historica-custos-soja...`).

- Tipo de fonte: `OFICIAL_PRIMARIA` — é um levantamento de preço agropecuário
  produzido pela própria CONAB (Companhia Nacional de Abastecimento), **não**
  o mesmo indicador metodológico do CEPEA (ver cautela na seção 24).
- Status de acesso: `GRATUITO_SEM_CADASTRO`, conforme o próprio portal
  público da CONAB.
- Status de redistribuição: um resumo de busca (não o texto literal da
  própria página) indicou permissão de reprodução para fins não comerciais
  mediante citação da fonte. **Esse texto não foi confirmado na página
  oficial nesta pesquisa** — tratar como `NAO_VERIFICADO` até leitura direta
  da página de termos da CONAB.
- Recomendação: `FONTE_APENAS_REFERENCIAL` — não deve substituir o indicador
  CEPEA hoje usado, porque mede um preço diferente (ver seção 24).

## 18. Fontes candidatas — soja regional (Oeste da Bahia/MATOPIBA)

Nesta pesquisa, **nenhuma fonte oficial/primária distinta** foi encontrada que
publique, de forma verificável e independente, uma cotação específica para a
praça "Oeste da Bahia" ou para o estado do Tocantins/região MATOPIBA, além da
tabela de mercado físico já usada hoje via Notícias Agrícolas (que, segundo o
comentário do próprio código, atribui a origem à AIBA, mas sem um link direto
verificável para um boletim próprio da AIBA localizado nesta pesquisa).

A CONAB (candidata 2 da seção 17) possui abertura regional em sua série de
preços agropecuários, mas não foi confirmado nesta pesquisa se essa abertura
chega ao nível de praça específica do Oeste da Bahia, ou apenas a médias
estaduais/nacionais — `NAO_VERIFICADO`.

- Recomendação: `SEM_FONTE_APROVADA` — nenhuma candidata testada nesta
  pesquisa atingiu confirmação suficiente para qualquer recomendação
  positiva. Isso não impede que uma etapa futura pesquise diretamente o
  boletim da AIBA (associação citada como origem da praça), o que não foi
  feito aqui por não haver, nesta pesquisa, uma URL institucional própria da
  AIBA a citar sem risco de invenção.

## 19. Fontes candidatas — frete marítimo (BDI)

**Candidata: Baltic Exchange** (`balticexchange.com`) — organização
proprietária e mantenedora oficial do Baltic Dry Index.

- Tipo de fonte: `OFICIAL_PRIMARIA` — é o próprio dono do índice.
- Status de acesso: `PAGO_ASSINATURA` — a página oficial de Política de Dados
  do Baltic Exchange (`balticexchange.com/en/site-services/data-policy.html`)
  confirma explicitamente a exigência de assinatura/associação para acesso a
  dados de mercado, com múltiplos níveis de licença.
- Status de redistribuição: `REDISTRIBUICAO_RESTRITA` — a mesma página
  descreve licenças específicas para redistribuição ("Full Baltic Data
  Licence" e "Restricted Baltic Data Licence"), concedidas apenas conforme o
  nível de assinatura contratado.
- Recomendação: `EXIGE_LICENCIAMENTO` — jamais deve ser usada como fonte
  automática sem contrato comercial formal com o Baltic Exchange.

**stooq** (já usado como fallback hoje, código evidenciado na seção 7) segue
classificado, nesta avaliação, como `PUBLICA_NAO_OFICIAL`: não é o mantenedor
do índice e nenhuma metodologia pública foi localizada nesta pesquisa para
confirmar como o stooq compõe o símbolo que hoje é consultado no código deste
repositório. Isso não é uma recomendação de remoção — apenas o registro de
que a natureza exata desse fallback permanece `NAO_VERIFICADO`.

## 20. Fontes candidatas — gás natural

**Candidata 1: EIA — mesma série já usada (Henry Hub Spot Price, `RNGWHHD`)**,
consultada em profundidade histórica via os mesmos mecanismos oficiais
(`eia.gov/dnav/ng/hist_xls/RNGWHHDm.xls` e a API v2 já usada no código). A
pesquisa confirma cobertura histórica da série desde 1997.

- Tipo de fonte: `OFICIAL_PRIMARIA` — idêntica à já usada hoje.
- Recomendação: `FONTE_CONTINGENCIA_RECOMENDADA` para reconstrução histórica
  retroativa, usando a mesma `EIA_API_KEY` já prevista no workflow — não é
  uma fonte nova, apenas uma consulta histórica da mesma fonte.

**Candidata 2: FRED — Federal Reserve Bank of St. Louis** (séries `DHHNGSP` e
`WHHNGSP`, `fred.stlouisfed.org`), que republicam o mesmo dado da EIA.

- Tipo de fonte: `OFICIAL_SECUNDARIA` — agência governamental distinta
  (sistema de bancos regionais do Federal Reserve) republicando dado oficial
  de outra agência (EIA).
- Status de acesso: `NAO_VERIFICADO` nesta pesquisa quanto aos termos exatos
  de uso da API do FRED (a existência de uma API pública é amplamente
  conhecida, mas seus termos de uso não foram lidos na fonte primária aqui).
- Recomendação: `FONTE_APENAS_REFERENCIAL` — útil para checagem cruzada
  humana, não recomendada para automação sem validação adicional dos termos.

**Candidata 3: World Bank Commodity Markets — "Pink Sheet"** (ver seção 21,
que já trata do mesmo relatório para fertilizantes; ele também publica gás
natural dos EUA e da Europa).

## 21. Fontes candidatas — fertilizantes (ureia, MAP, KCl)

**Candidata 1: ComexStat histórico direto (mesma API já usada, seção 9)**,
consultando período retroativo além do que consta no histórico de commits
deste repositório. A pesquisa confirma que a plataforma documenta consulta de
séries desde 1989 (dados de 1989–1996 disponíveis como arquivo CSV separado;
a API principal cobre o período posterior).

- Tipo de fonte: `OFICIAL_PRIMARIA` — idêntica à já usada hoje.
- Recomendação: `FONTE_PRIMARIA_RECOMENDADA` para preenchimento de histórico
  retroativo de ureia/MAP/KCl — é a mesma fonte e a mesma metodologia já em
  uso, então não introduz uma nova incerteza metodológica; exige apenas
  repetir a consulta mês a mês, respeitando a limitação de um mês por
  requisição já documentada em `CLAUDE.md`.

**Candidata 2: World Bank Commodity Markets — "Pink Sheet"**
(`thedocs.worldbank.org/.../CMO-Pink-Sheet-*.pdf`), relatório mensal do Banco
Mundial que inclui ureia (prill, spot FOB Oriente Médio/Leste Europeu), DAP
(spot FOB US Gulf) e cloreto de potássio granular (CFR Brasil), além de gás
natural dos EUA e da Europa.

- Tipo de fonte: `OFICIAL_PRIMARIA` — para o índice do próprio Banco Mundial,
  que é uma referência internacional amplamente citada.
- Status de acesso: `GRATUITO_SEM_CADASTRO` — os relatórios mensais em PDF
  estão publicados abertamente no domínio institucional do Banco Mundial.
- Status de redistribuição: `REDISTRIBUICAO_PERMITIDA_COM_ATRIBUICAO` — o
  catálogo de dados do Banco Mundial (`datacatalog.worldbank.org/public-
  licenses`) confirma que os datasets produzidos pelo próprio Banco Mundial
  são licenciados por padrão sob CC-BY 4.0, que permite cópia, modificação e
  redistribuição, inclusive para uso comercial, mediante atribuição.
- Formato: PDF/planilha mensal — **não** uma API estruturada como as fontes
  já usadas hoje; qualquer uso automatizado exigiria extração de PDF/XLS, não
  uma chamada JSON simples.
- Recomendação: `FONTE_CONTINGENCIA_RECOMENDADA` — mas com a ressalva
  obrigatória da seção 26: os preços ali publicados **não** correspondem à
  mesma praça/condição comercial do FOB de importação brasileira medido pelo
  ComexStat.

**Candidata 3: USDA — Fertilizer Prices by Region**
(`agtransport.usda.gov/Fertilizer/Fertilizer-Prices-by-Region/8bgf-5mdv`),
preços de fertilizante nos Estados Unidos por região, incluindo ureia, MAP,
DAP e potássio.

- Tipo de fonte: `OFICIAL_PRIMARIA` — para o mercado americano.
- Recomendação: `FONTE_APENAS_REFERENCIAL` — mercado doméstico americano,
  moeda e praça diferentes do FOB de importação brasileira medido pelo
  ComexStat; nunca deve ser tratada como proxy direta do preço brasileiro.

## 22. Requisitos temporais por indicador

Esta avaliação **não define uma data de início histórico universal** para
nenhum indicador — cada fonte declara sua própria profundidade, e a
profundidade efetivamente necessária é uma decisão de negócio, não desta
avaliação técnica.

- **Dólar**: o SGS do Banco Central (candidata da seção 16) cobre décadas de
  série diária, sujeito ao limite de intervalo por consulta mencionado
  (`NAO_VERIFICADO`, ver seção 16).
- **Ureia/MAP/KCl**: o ComexStat cobre, segundo a própria plataforma, desde
  1989 (com um recorte 1989–1996 em formato separado de CSV histórico); a
  cobertura reconstruível pelo extrator de Git deste repositório é muito mais
  recente, pois depende apenas de commits já feitos aqui.
- **Gás natural**: a série Henry Hub da EIA cobre, segundo a pesquisa, desde
  1997.
- **BDI**: segundo um resumo de busca (não o texto literal da fonte
  primária), a série contínua do Baltic Dry Index remonta a 1985 —
  `NAO_VERIFICADO` na fonte primária nesta pesquisa, e de qualquer forma
  sujeita a licenciamento (seção 19).
- **Soja nacional**: segundo um resumo de busca, o indicador CEPEA/ESALQ
  Paraná existe desde março de 2006 — `NAO_VERIFICADO` na fonte primária
  nesta pesquisa.
- **Soja regional**: sem fonte aprovada (seção 18); portanto, sem requisito
  temporal a documentar nesta etapa.

## 23. Compatibilidade de unidades entre fontes

Documentação apenas — **nenhuma conversão de unidade é feita nesta etapa**.

| Indicador | Unidade usada hoje (evidência de código) | Unidade observada nas candidatas |
|---|---|---|
| Dólar | R$ por US$ (cotação de venda PTAX) | Mesma unidade esperada no SGS/BCB, mas o código exato da série precisa ser confirmado campo a campo antes de qualquer uso |
| Ureia/MAP/KCl | US$ por tonelada, FOB, calculado (`FOB ÷ peso líquido em t`) | Pink Sheet: US$ por tonelada, mas em praças/condições diferentes (spot FOB Oriente Médio/Leste Europeu para ureia, FOB US Gulf para DAP, CFR Brasil para KCl); USDA: US$ por tonelada, mercado doméstico americano |
| Gás natural | US$ por MMBtu (Henry Hub) ou valor de futuro (stooq) | EIA histórico: mesma unidade (é a mesma fonte). Pink Sheet: também reporta em US$/MMBtu, mas cobre EUA e Europa separadamente |
| BDI | Pontos de índice, adimensional | Baltic Exchange: mesma unidade de índice, mas mediante licença |
| Soja nacional | R$ por saca de 60 kg | CONAB: unidade não confirmada nesta pesquisa (`NAO_VERIFICADO`) — pode divergir (ex.: R$/@ ou R$/t) e não deve ser presumida igual sem checagem direta |
| Soja regional | R$ por saca de 60 kg | Sem fonte aprovada (seção 18) |

## 24. Cautela obrigatória — frete marítimo (BDI não é frete de fertilizante)

O Baltic Dry Index mede uma cesta de rotas e tipos de navio de carga seca a
granel em geral (minério, carvão, grãos, entre outros) — **não** é, e nunca
deve ser tratado como, um índice específico de frete marítimo de
fertilizantes para o Brasil. Uma eventual fonte complementar de frete
específico de fertilizantes seria um indicador **diferente**, com sua própria
avaliação de fonte — não uma substituição do BDI hoje usado, nem uma
conversão automática entre os dois.

## 25. Cautela obrigatória — gás natural (sem causalidade quantitativa)

O preço do gás natural (Henry Hub ou futuro NG) é hoje tratado neste projeto
apenas como um direcionador de custo de produção de ureia (que usa gás
natural como insumo em parte do mundo). Esta avaliação **não estabelece, e
nenhuma fonte candidata aqui listada permite estabelecer sozinha**, uma
relação de causalidade quantitativa entre o preço do gás e o preço da ureia
— isso exigiria um estudo econométrico próprio, fora do escopo desta etapa e
desta ferramenta.

## 26. Cautela obrigatória — soja (nacional ≠ regional ≠ internacional)

Três referências de soja, hoje ou potencialmimente no futuro, **nunca devem
ser tratadas como equivalentes ou substituíveis automaticamente**:

- **Soja nacional** (CEPEA/ESALQ Paraná) — indicador de balcão físico no
  Paraná.
- **Soja regional** (Oeste da Bahia/AIBA) — praça física distinta, com
  logística, sazonalidade e prêmio/desconto próprios em relação ao Paraná.
- **Soja internacional** (ex.: contratos futuros CBOT/Chicago, não avaliados
  nesta etapa) — outra moeda, outra praça, outra unidade de medida.

Nenhuma fonte candidata desta avaliação (seções 17–18) deve ser usada para
"completar" ou "estimar" uma dessas três referências a partir de outra sem
uma decisão humana explícita — o próprio código de produção já documenta uma
estimativa (95,7% do CEPEA nacional) como último recurso para a soja
regional; esta avaliação não propõe estender esse tipo de estimativa a novas
fontes.

## 27. Cautela obrigatória — câmbio (sem mistura de tipos de taxa) e fertilizantes (FOB ≠ CFR ≠ valor aduaneiro ≠ spot)

**Câmbio:** a PTAX (fonte primária atual) é uma taxa de referência específica,
calculada pelo Banco Central a partir de operações interbancárias — diferente
de taxas comerciais de balcão, taxas de fechamento de corretora, ou taxas
turismo. Qualquer fonte candidata de câmbio (seção 16) deve ser confirmada
como usando o **mesmo tipo de taxa** (ou a diferença deve ser documentada
explicitamente) antes de qualquer uso conjunto com os dados já coletados —
nunca presumir equivalência entre tipos de taxa diferentes.

**Fertilizantes:** as candidatas desta avaliação (seção 21) publicam preços
em condições comerciais distintas entre si e distintas da métrica já usada
neste projeto:

- **FOB de importação brasileira** (ComexStat, já usado hoje) — valor
  declarado nas transações reais de importação do Brasil, dividido pelo peso
  líquido.
- **FOB spot internacional** (Pink Sheet, ureia e DAP) — cotação de mercado
  numa praça de referência internacional (Oriente Médio/Leste Europeu, US
  Gulf), não o preço efetivamente pago nas importações brasileiras.
- **CFR Brasil** (Pink Sheet, KCl) — já inclui frete e seguro até o porto
  brasileiro, diferente de um valor FOB.
- **Valor aduaneiro** (não observado nas candidatas desta pesquisa, mas
  mencionado aqui como categoria a nunca confundir) — inclui tributos e
  outros ajustes aduaneiros, diferente do valor FOB declarado.
- **Preço doméstico americano** (USDA) — mercado, moeda e praça totalmente
  diferentes do FOB de importação brasileira.

Nenhuma fonte deve ser adotada só porque é gratuita ou de fácil acesso — a
condição comercial (FOB × CFR × valor aduaneiro × spot) precisa corresponder
à métrica já em uso, ou a diferença precisa ser documentada e decidida
explicitamente por uma pessoa, antes de qualquer substituição ou combinação.

## 28. Relação de princípio com o domínio de formulados

O histórico privado de preços de formulados (`data/formulated-prices-
history.json`, Etapas 1–3) e o catálogo técnico de formulações (ainda não
criado, e que continua não sendo criado nesta etapa) permanecem domínios
**separados** do assunto desta avaliação. Esta etapa:

- Não acessou nenhum registro privado de preço de formulado.
- Não leu nem cita nome de fornecedor comercial de formulado.
- Não propõe nenhuma data de publicação, prazo ou cronograma de cruzamento
  entre o histórico de direcionadores de mercado (assunto deste documento) e
  o histórico de formulados.
- Trata a separação entre os dois domínios como um **princípio arquitetural
  já estabelecido** (ver `README.md`, seção "Separação de domínios") — não
  como algo a ser decidido ou revisto aqui.

Qualquer eventual cruzamento entre uma fonte histórica complementar de
direcionador de mercado e o histórico de formulados é, como já registrado nas
etapas anteriores, trabalho de uma etapa própria e futura, após revisão
humana — e está fora do escopo desta avaliação.

## 29. Referências

Todas as URLs abaixo foram obtidas por pesquisa (WebSearch) em **2026-09-17**.
Quando a pesquisa devolveu apenas um resumo/paráfrase e não o texto literal da
página, isso está indicado explicitamente — nesses casos, a afirmação
correspondente no corpo do documento está marcada `NAO_VERIFICADO` quanto ao
seu texto exato, mesmo com a URL confirmada.

| Título | Instituição | URL | Data de acesso | Afirmação que sustenta |
|---|---|---|---|---|
| Taxa de câmbio - Livre - Dólar americano (venda) - diário | Banco Central do Brasil | https://dadosabertos.bcb.gov.br/dataset/1-taxa-de-cambio---livre---dolar-americano-venda---diario | 2026-09-17 | Existência do Portal de Dados Abertos do BCB como candidata de câmbio (seção 16) |
| Dólar comercial (venda e compra) - cotações diárias - API | Banco Central do Brasil | https://dadosabertos.bcb.gov.br/dataset/dolar-americano-usd-todos-os-boletins-diarios/resource/ae69aa94-4194-45a6-8bae-12904af7e176 | 2026-09-17 | Existência de endpoint de API para série histórica de câmbio (seção 16) |
| Comexstat - Documentação | Ministério do Desenvolvimento, Indústria, Comércio e Serviços (MDIC) | https://api-comexstat.mdic.gov.br/docs | 2026-09-17 | Confirmação de que a API do ComexStat já usada hoje possui documentação própria (seções 9 e 21) |
| Estatísticas de Comércio Exterior em Dados Abertos | MDIC | https://www.gov.br/mdic/pt-br/assuntos/comercio-exterior/estatisticas/base-de-dados-bruta | 2026-09-17 | Cobertura histórica do ComexStat desde 1989 (resumo de busca, seção 22 — `NAO_VERIFICADO` quanto ao texto literal) |
| CMO-Pink-Sheet-May-2026.pdf | Banco Mundial | https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Pink-Sheet-May-2026.pdf | 2026-09-17 | Existência e formato do relatório "Pink Sheet" como candidata para ureia/MAP/KCl/gás (seções 20–21) |
| Data Access And Licensing | Banco Mundial (Data Catalog) | https://datacatalog.worldbank.org/public-licenses | 2026-09-17 | Licença CC-BY 4.0 como padrão para datasets produzidos pelo Banco Mundial (seção 21) |
| Henry Hub Natural Gas Spot Price (DHHNGSP) | Federal Reserve Bank of St. Louis (FRED) | https://fred.stlouisfed.org/series/DHHNGSP | 2026-09-17 | FRED como fonte secundária que republica dado da EIA (seção 20) |
| Henry Hub Natural Gas Spot Price | U.S. Energy Information Administration (EIA) | https://www.eia.gov/dnav/ng/hist_xls/RNGWHHDm.xls | 2026-09-17 | Cobertura histórica da série Henry Hub desde 1997 (seções 20 e 22) |
| Membership and Data Subscription Benefits | Baltic Exchange | https://www.balticexchange.com/en/apply-page.html | 2026-09-17 | Exigência de associação/assinatura para acesso a dados do BDI (seção 19) |
| Data Policy | Baltic Exchange | https://www.balticexchange.com/en/site-services/data-policy.html | 2026-09-17 | Estrutura de licenciamento e redistribuição restrita do BDI (seção 19) |
| Séries — Soja | CEPEA/ESALQ-USP | https://www.cepea.org.br/br/indicador/series/soja.aspx | 2026-09-17 | Existência de página de séries históricas do indicador de soja como candidata (seção 17) |
| Metodologia da Soja CEPEA/ESALQ - Paranaguá | CEPEA/ESALQ-USP | https://cepea.org.br/br/metodologia/metodologia-da-soja-esalq-bm-fbovespa-paranagua.aspx | 2026-09-17 | Existência de metodologia pública própria do indicador CEPEA (critério 21 da seção 11) |
| Série Histórica - Preços Agropecuários | Companhia Nacional de Abastecimento (CONAB) | https://portaldeinformacoes.conab.gov.br/precos-agropecuarios-serie-historica.html | 2026-09-17 | Existência da série histórica de preços agropecuários da CONAB como candidata de soja nacional (seção 17) |
| Série Histórica - Custos - Soja - 1997 a 2024 | CONAB | https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/custos-de-producao/arquivos-custo-de-producao/agricolas/serie-historica-custos-soja-1997-a-2024-1/view | 2026-09-17 | Profundidade histórica declarada da série de custos de soja da CONAB (seção 17) |
| Fertilizer Prices by Region | United States Department of Agriculture (USDA) — Open Ag Transport Data | https://agtransport.usda.gov/Fertilizer/Fertilizer-Prices-by-Region/8bgf-5mdv | 2026-09-17 | Existência da série de preços de fertilizante do USDA como candidata apenas referencial (seções 21 e 27) |

Todo dado de licenciamento, custo, profundidade histórica ou permissão de
redistribuição citado a partir de um **resumo de busca** (e não do texto
literal da própria página, lido diretamente) está explicitamente marcado
`NAO_VERIFICADO` no corpo deste documento, mesmo quando a URL da fonte está
confirmada nesta tabela. Nenhuma URL, nome de instituição ou data de acesso
foi inventada — todas vieram literalmente dos resultados de pesquisa obtidos
nesta etapa.

## 30. Próximos passos sugeridos

Esta avaliação não recomenda, e não deve ser lida como recomendando,
implementação de coleta, criação de catálogo técnico de formulação,
cruzamento com o histórico de formulados, correlação, regressão ou previsão
de preço. Os únicos próximos passos sugeridos por este documento são:

1. **Aprovação humana** de quais fontes candidatas (seções 16–21), se
   alguma, devem avançar para uma etapa de implementação — indicador por
   indicador, considerando as recomendações da seção correspondente
   (`FONTE_PRIMARIA_RECOMENDADA`, `FONTE_CONTINGENCIA_RECOMENDADA`,
   `FONTE_APENAS_REFERENCIAL`, `EXIGE_LICENCIAMENTO`,
   `EXIGE_VALIDACAO_JURIDICA` ou `SEM_FONTE_APROVADA`).
2. **Validação jurídica** dos pontos marcados `NAO_VERIFICADO` quanto a
   licença, redistribuição ou termos de uso — em particular CEPEA (seção 17),
   BCB/SGS (seção 16) e CONAB (seção 17) — antes de qualquer coleta,
   armazenamento ou publicação de dado derivado dessas fontes.
3. **Priorização de integração**, uma vez aprovadas as fontes e concluída a
   validação jurídica, começando pelos indicadores com menor cobertura
   histórica reconstruível hoje (dólar, gás natural e soja regional, seção
   10) — decisão de ordem e de quando implementar, não implementação em si,
   que permanece fora do escopo desta etapa.
