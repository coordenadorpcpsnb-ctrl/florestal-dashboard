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

---

## 31. Adendo Etapa 6.1 — objetivo e escopo desta verificação aprofundada

As seções 1–30 acima são o documento original da Etapa 6 e **não foram
reescritas**. Este adendo (seções 31–44) aprofunda e consolida a verificação
das fontes prioritárias (BCB, ComexStat/MDIC, EIA, CEPEA/ESALQ, Baltic
Exchange, World Bank Commodity Markets/Pink Sheet, CONAB e uma eventual fonte
institucional de soja regional), aplicando uma regra de prova mais estrita do
que a usada na Etapa 6: **resultado de busca (WebSearch) não é, sozinho,
prova suficiente para o status `CONFIRMADO`** — apenas a leitura direta da
documentação oficial (abertura literal da página) confirma um campo. Onde a
Etapa 6 tratou um resumo de busca como suficientemente confiável para uma
recomendação, isso é revisto aqui.

Nenhuma coleta, API, scraping, download, armazenamento de série, catálogo
técnico, `formulationId`, dado de formulação/micronutriente, cruzamento com
formulados, regressão ou previsão foi implementado nesta etapa. Nenhum
workflow, dashboard ou `package.json` foi alterado. Nenhum push foi feito.

## 32. Restrição técnica de acesso constatada nesta etapa

Nesta etapa, antes de qualquer classificação, foi testada a abertura direta
(ferramenta de leitura de página, não de busca) das páginas oficiais das oito
fontes prioritárias. **Todas as tentativas de abertura direta foram
bloqueadas pelo proxy de rede deste ambiente de execução**, com o mesmo tipo
de erro (`EGRESS_BLOCKED`), para os seguintes domínios testados nesta etapa:

- `dadosabertos.bcb.gov.br`, `www.bcb.gov.br`, `api.bcb.gov.br` (Banco
  Central)
- `api-comexstat.mdic.gov.br` (ComexStat/MDIC)
- `www.eia.gov` (EIA)
- `cepea.org.br` (CEPEA/ESALQ)
- `www.balticexchange.com` (Baltic Exchange)
- `www.worldbank.org` (World Bank)
- `www.gov.br` (CONAB)

Como controle, a mesma ferramenta de leitura direta **funcionou normalmente**
para um domínio fora da lista de fontes de dado (`github.com`), confirmando
que o bloqueio é específico aos domínios institucionais de dado, não uma
falha geral da ferramenta. Isso é consistente com a armadilha já documentada
em `CLAUDE.md`: *"Sandbox/ambiente de execução aqui bloqueia rede externa (só
libera npm/GitHub/PyPI)... isso é esperado."*

A ferramenta de busca (WebSearch, que roda fora deste sandbox) continuou
funcionando e foi usada para localizar candidatas e pistas — mas, pela regra
da seção 33, **um resultado de busca nunca eleva um campo a `CONFIRMADO`**.
Consequência direta e assumida desta etapa: com a leitura direta bloqueada
para todas as oito fontes prioritárias, **nenhuma afirmação externa a este
repositório pôde ser elevada a `CONFIRMADO` nesta etapa** — apenas fatos
evidenciados pelo próprio código e configuração deste repositório (que
puderam ser lidos diretamente) recebem esse status. Isso não é uma escolha de
rigor arbitrária: é o resultado honesto do teste de acesso acima, registrado
para que uma etapa futura, rodando num ambiente sem esse bloqueio (ou com
acesso liberado pelo usuário), possa concluir a verificação direta que esta
etapa tentou e não conseguiu completar.

## 33. Regra de verificação aplicada

- `CONFIRMADO`: a afirmação está literalmente presente num documento que foi
  aberto e lido diretamente nesta etapa (leitura de página, não busca) **ou**
  num arquivo deste repositório lido diretamente nesta etapa (código,
  configuração, `data.json`). Dado o bloqueio da seção 32, nenhuma fonte
  externa prioritária pôde ser lida diretamente nesta etapa — todo
  `CONFIRMADO` usado a partir daqui vem de arquivo deste repositório, nunca
  de página institucional externa.
- `NAO_VERIFICADO`: a afirmação apareceu apenas em resultado de busca,
  resumo, snippet, ou não apareceu em nenhuma fonte consultada nesta etapa.
  Cobre licença, redistribuição, armazenamento, limite de requisições,
  gratuidade, uso comercial, abrangência histórica, frequência, método de
  revisão e estabilidade de API sempre que a única evidência disponível foi
  busca — que é o caso de toda fonte externa nesta etapa (seção 32).
- `NAO_APLICAVEL`: o campo da matriz não se aplica à fonte em questão (ex.:
  "chave" para uma fonte que não usa nenhum mecanismo de credencial).
- `RESTRITO_CONFIRMADO` / `PROIBIDO_CONFIRMADO`: reservados para quando uma
  restrição ou proibição está confirmada por leitura direta. Não usados nesta
  etapa para nenhuma fonte externa, pelo mesmo motivo — sem leitura direta,
  não há confirmação, só indício.

Nenhuma coluna de status usa "provavelmente", "aparentemente" ou equivalente.
Comentários explicativos fora das colunas de status podem registrar indícios
de busca com linguagem cautelosa, sempre rotulados como indício, nunca como
prova.

## 34. Correções em relação à Etapa 6 (classificações excessivamente conclusivas revisadas)

A pesquisa da Etapa 6 usou exclusivamente WebSearch (nunca uma leitura direta
de página) — o mesmo método hoje insuficiente pela regra da seção 33. Por
isso, vários campos que a Etapa 6 apresentou com redação afirmativa são
rebaixados aqui para `NAO_VERIFICADO`, mantendo o achado como indício de
busca, não como fato confirmado:

- **World Bank / Pink Sheet** — a Etapa 6 escreveu que a página do catálogo de
  dados "confirma" a licença CC-BY 4.0 para os datasets do Banco Mundial.
  Sem leitura direta nesta etapa, isso é revisto para `NAO_VERIFICADO`: o
  indício de busca continua registrado (seção 40), mas não sustenta mais uma
  recomendação de contingência tão favorável quanto a anterior.
- **Baltic Exchange** — a Etapa 6 descreveu nomes de licença ("Full Baltic
  Data Licence", "Restricted Baltic Data Licence") como se a página tivesse
  sido lida diretamente. Não foi — era resultado de busca. O campo de
  licença/redistribuição é rebaixado a `NAO_VERIFICADO`. **Correção da Etapa
  6.2:** a Etapa 6.1 também errou ao registrar a **decisão** (seção 43) como
  `EXIGE_LICENCA` de forma conclusiva — isso tratou um indício de busca como
  se fosse prova suficiente para uma decisão, violando a própria regra da
  seção 33 desta etapa ("resultado de busca nunca eleva um campo a
  `CONFIRMADO`", e por extensão, nunca sustenta sozinho uma decisão
  conclusiva). A decisão correta, mantida a partir daqui, é
  `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA` — não porque o acesso seja
  necessariamente livre (não há evidência disso também), mas porque **nenhuma
  decisão conclusiva, em qualquer direção, pode se apoiar em indício de
  busca.** Detalhamento nas seções 39 e 46 (adendo da Etapa 6.2).
- **BCB SGS** — a Etapa 6 escreveu "Status de acesso: `GRATUITO_SEM_CADASTRO`,
  segundo a documentação encontrada". Não era documentação, era busca.
  Rebaixado a `NAO_VERIFICADO`.
- **ComexStat (cobertura desde 1989)** e **EIA (cobertura desde 1997)** — a
  Etapa 6 tratou esses números como confirmados pela pesquisa. Rebaixados a
  `NAO_VERIFICADO` quanto à profundidade histórica exata; o que permanece
  `CONFIRMADO` é que os **mesmos domínios** (`api-comexstat.mdic.gov.br`,
  `api.eia.gov`) já são usados com sucesso pela pipeline de produção deste
  repositório — isso vem do código e do `data.json`, não de busca (seção 44).
- **CEPEA** — a Etapa 6 já havia marcado o acesso como não confirmado; mantido
  assim, reforçado pela regra mais estrita.
- **CONAB** — a Etapa 6 já havia marcado a redistribuição como não confirmada
  (citando apenas um resumo de busca); mantido, e a distinção entre o produto
  de **preço agropecuário** e o produto de **custo de produção** da CONAB é
  reforçada explicitamente na seção 41, por exigência desta etapa.

## 35. Verificação aprofundada — Banco Central do Brasil (BCB)

| Item | Status | Observação |
|---|---|---|
| Produto/API adequado (PTAX venda) | `CONFIRMADO` | Confirmado por leitura direta de `fetch-data.mjs` (função `getCambio`), que já consome `olinda.bcb.gov.br/.../CotacaoDolarPeriodo` e usa `cotacaoVenda`. Fonte: código deste repositório. |
| Série SGS equivalente para reconstrução histórica | `NAO_VERIFICADO` | A correspondência exata entre um código de série do SGS e a métrica `cotacaoVenda` da PTAX hoje usada não foi confirmada por leitura direta nesta etapa. |
| Tipo de taxa | `CONFIRMADO` (para o que já é usado) | O código usa explicitamente `cotacaoVenda` da PTAX — não taxa de compra, não taxa comercial, não taxa média. Qualquer fonte candidata precisa confirmar o mesmo tipo de taxa antes de qualquer uso conjunto (ver seção 27). |
| Periodicidade/calendário da PTAX | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Cobertura histórica do SGS | `NAO_VERIFICADO` | Indício de busca (Etapa 6) descrevia limite de 10 anos por consulta desde 26/03/2025 — não confirmado por leitura direta. |
| Data de referência retornada | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Unidade | `CONFIRMADO` (para o que já é usado) | R$ por US$, evidenciado no cálculo do código (`Math.round(v * 100) / 100`, valor de `cotacaoVenda`). |
| Acesso/limites/chave | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Armazenamento interno | `NAO_APLICAVEL` | Nenhum valor foi armazenado nesta etapa. |
| Redistribuição | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Publicação em repositório público | `NAO_APLICAVEL` | Não avaliada — nenhuma publicação proposta nesta etapa. |
| Situação técnica de acesso ao domínio `bcb.gov.br` | `CONFIRMADO` | `data.json` (lido diretamente nesta etapa) registra `"cambio": "ok (BCB PTAX)"` em 2026-09-16 — evidência de que a pipeline de produção (GitHub Actions) alcança esse domínio com sucesso, mesmo que este sandbox de desenvolvimento esteja bloqueado para o mesmo domínio (seção 32). |

**Não misturado nesta verificação:** PTAX compra, taxa média, taxa de
fechamento, câmbio comercial de balcão ou série de outro provedor — nenhum
desses foi mencionado como equivalente à PTAX venda hoje usada.

## 36. Verificação aprofundada — ComexStat/MDIC

| Item | Status | Observação |
|---|---|---|
| Documentação oficial da API | `NAO_VERIFICADO` | A existência de uma página `api-comexstat.mdic.gov.br/docs` foi apenas um resultado de busca na Etapa 6; não foi lida diretamente nesta etapa (bloqueio da seção 32). |
| Cobertura histórica (ex.: desde 1989) | `NAO_VERIFICADO` | Rebaixado — era só resultado de busca (seção 34). |
| Granularidade mensal | `CONFIRMADO` | Confirmado por leitura direta de `fetch-fertilizers.mjs`: a consulta usa `period: { from: mes, to: mes }`, um mês por chamada — comportamento também documentado como armadilha conhecida em `CLAUDE.md`. |
| Campos FOB e peso líquido (kg) | `CONFIRMADO` | Confirmado no código: `metrics: ["metricFOB", "metricKG"]`, e o preço final é `fob / (kg / 1000)`. |
| Revisão de dados publicados | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| NCM usados | `CONFIRMADO` | `31021010` (ureia), `31054000` (MAP), `31042010`+`31042090` (KCl) — evidenciados em `NCM_PRODUTO` no código. |
| Limite de acesso | `CONFIRMADO` (parcial) | O código já trata explicitamente HTTP 429 com retentativa (`postar()`), evidência direta de limite de requisições observado operacionalmente — não uma página de termos, mas comportamento real já enfrentado pela pipeline. |
| Armazenamento interno | `NAO_APLICAVEL` | Nenhum valor foi armazenado nesta etapa. |
| Redistribuição | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Situação técnica de acesso | `CONFIRMADO` | `data.json` registra `"ureia": "ok (ComexStat 2026-08)"`, `"map": "ok (ComexStat 2026-08)"`, `"kcl": "ok (ComexStat 2026-08)"` em 2026-09-16 — evidência de sucesso operacional real na pipeline de produção. |

**Documentado explicitamente, por exigência desta etapa:** o valor calculado
pelo código (`FOB ÷ peso líquido`) é uma **média unitária declarada de
comércio exterior** — isto é, o valor médio por tonelada resultante de somar
todas as transações de importação daquele NCM no mês e dividir pelo peso
total. Isso **não é**:

- um preço spot de mercado num instante específico;
- um preço CFR (que incluiria frete/seguro já embutido de forma diferente,
  dependendo de como cada transação individual foi registrada);
- um custo entregue (não inclui frete interno brasileiro, tributos internos
  ou margem de distribuição);
- o preço de um fornecedor específico (é uma média entre todas as
  importações do NCM no mês, de todos os importadores e origens).

## 37. Verificação aprofundada — EIA

| Item | Status | Observação |
|---|---|---|
| Série exata (Henry Hub, `RNGWHHD`) | `CONFIRMADO` | Confirmado por leitura direta de `fetch-fertilizers.mjs` (`buscarGasNatural`): `facets[series][]=RNGWHHD`. |
| Frequência da série usada no código | `CONFIRMADO` | O código pede `frequency=daily` e o último valor (`length=1`) — evidenciado no corpo da requisição. |
| Unidade | `NAO_VERIFICADO` | O código não declara a unidade explicitamente (não há comentário/constante com "US$/MMBtu" no trecho relevante); tratar como não confirmada nesta etapa apesar de ser um dado amplamente conhecido do setor. |
| Data de referência retornada pela API | `NAO_VERIFICADO` | O código não armazena/loga a data de referência do valor da EIA (diferente do BDI, que loga a data extraída do texto). |
| Cobertura histórica (ex.: desde 1997) | `NAO_VERIFICADO` | Rebaixado — era só resultado de busca (seção 34). |
| Chave de API | `CONFIRMADO` | `EIA_API_KEY`, lida de `process.env`, confirmada também no workflow (`weekly-update.yml`, variável de ambiente do passo "Executar atualizacao"). |
| Limites/termos de uso | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Armazenamento interno | `NAO_APLICAVEL` | Nenhum valor foi armazenado nesta etapa. |
| Redistribuição | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Situação técnica de acesso | `CONFIRMADO` | `data.json` registra `"gas": "ok (EIA Henry Hub)"` em 2026-09-16 — sucesso operacional real na pipeline de produção, com chave configurada. |

**Documentado explicitamente, por exigência desta etapa:** Henry Hub é uma
referência de **preço regional** (o principal hub de gás natural dos EUA) —
não é, e não deve ser tratada como, uma proxy perfeita para todos os mercados
globais de gás natural (Europa, Ásia, ou o gás usado como insumo industrial
fora dos EUA podem ter preços substancialmente diferentes e sujeitos a outras
dinâmicas de oferta/demanda e contratos regionais).

## 38. Verificação aprofundada — CEPEA/ESALQ

| Item | Status | Observação |
|---|---|---|
| Indicador de soja usado hoje (CEPEA/ESALQ Paraná) | `CONFIRMADO` | Confirmado por leitura direta de `fetch-data.mjs` (`getSoja`), que consome a página do indicador CEPEA/ESALQ Paraná republicada pelo Notícias Agrícolas. |
| Praça | `CONFIRMADO` (para o uso atual) | Paraná, evidenciado no próprio nome da página consultada pelo código (`indicador-cepea-esalq-soja-parana`). |
| Unidade | `CONFIRMADO` (para o uso atual) | R$ por saca, evidenciado no parse do código (`v > 30 && v < 500`, faixa plausível para R$/saca de 60 kg). |
| Metodologia publicada pelo próprio CEPEA | `NAO_VERIFICADO` | A existência de uma página de metodologia foi só um resultado de busca (Etapa 6); não lida diretamente nesta etapa. |
| Frequência declarada pela própria fonte | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Série histórica própria do CEPEA | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Acesso automatizado ao domínio `cepea.org.br`/`cepea.esalq.usp.br` | `CONFIRMADO` (como **bloqueado**, não como liberado) | O próprio código (`fetch-data.mjs`, comentário da função `getSoja`) e `CLAUDE.md` documentam bloqueio conhecido a servidores de datacenter no acesso direto ao domínio do CEPEA — por isso a fonte primária usada é a republicação via Notícias Agrícolas, não o CEPEA direto. |
| Armazenamento interno | `NAO_APLICAVEL` | Nenhum valor foi armazenado nesta etapa. |
| Redistribuição | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Uso corporativo | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Publicação | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |

Por exigência explícita desta etapa: **a página do CEPEA ser publicamente
visível num navegador não é, e não foi tratada aqui como, aprovação de
integração automática.** O acesso direto já está documentado como bloqueado
para servidores de datacenter — isto é, mesmo a visibilidade pública não
implica viabilidade de automação, e a licença/redistribuição continuam
`NAO_VERIFICADO` de qualquer forma.

## 39. Verificação aprofundada — Baltic Exchange

*(Seção corrigida na Etapa 6.2 — ver seção 34 para o registro da
inconsistência e da correção.)*

| Item | Status | Observação |
|---|---|---|
| Natureza oficial do índice | `NAO_VERIFICADO` | O fato de o Baltic Exchange ser o mantenedor oficial do BDI é amplamente conhecido do setor, mas não foi confirmado por leitura direta de uma página institucional nesta etapa. |
| Acesso a dados históricos | `NAO_VERIFICADO` | Não confirmado por leitura direta. |
| Licença | `NAO_VERIFICADO` | Não confirmado por leitura direta. |
| Armazenamento interno | `NAO_APLICAVEL` | Nenhum valor foi armazenado nesta etapa. |
| Redistribuição | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Publicação | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Uso em aplicação interna | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |

**Nota não conclusiva (evidência de busca, não promovida a evidência
externa):** resultados de pesquisa indicam possível exigência de
licenciamento, mas a documentação oficial não foi aberta neste ambiente.

Por isso, a decisão registrada na matriz (seção 43) para o Baltic Exchange é
`SEM_DECISAO_POR_FALTA_DE_EVIDENCIA`, não `EXIGE_LICENCA` — nenhuma decisão
conclusiva pode se apoiar apenas em indício de busca, em qualquer direção
(nem para liberar, nem para restringir). **Nenhum contorno por agregador foi
buscado ou proposto nesta etapa** — o fallback `stooq` já em uso hoje pelo
código (seção 7) permanece como está, sem alteração e sem ser tratado como
substituto equivalente ao índice oficial. **Nenhuma nova pesquisa externa foi
feita nesta etapa** sobre o Baltic Exchange, por instrução explícita da Etapa
6.2 — a correção acima é só de classificação, sobre a evidência já registrada
na Etapa 6.1.

## 40. Verificação aprofundada — World Bank Commodity Markets/Pink Sheet

| Item | Status | Observação |
|---|---|---|
| Existência e formato do relatório "Pink Sheet" | `NAO_VERIFICADO` | Indício de busca (PDF mensal); não aberto diretamente nesta etapa. |
| Cobertura de ureia/DAP/KCl/gás | `NAO_VERIFICADO` | Indício de busca; não confirmado por leitura direta. |
| Periodicidade | `NAO_VERIFICADO` | Indício de busca sugere mensal; não confirmado por leitura direta. |
| Unidade | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Metodologia | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Revisão | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |
| Licença (CC-BY 4.0 do catálogo de dados do Banco Mundial) | `NAO_VERIFICADO` | Rebaixado da Etapa 6 (seção 34) — era resultado de busca, não leitura direta da página `datacatalog.worldbank.org/public-licenses`. |
| Armazenamento interno | `NAO_APLICAVEL` | Nenhum valor foi armazenado nesta etapa. |
| Redistribuição | `NAO_VERIFICADO` | Não lido diretamente nesta etapa. |

Mantida como candidata **apenas referencial nesta etapa** — nunca equivalente
ao ComexStat: mesmo que a licença viesse a ser confirmada como permissiva, a
Pink Sheet publica preços em praças/condições comerciais diferentes do FOB de
importação brasileira medido pelo ComexStat (ver seção 27), o que por si só
impede tratá-la como substituta, independentemente da situação jurídica.

## 41. Verificação aprofundada — CONAB

A busca desta etapa (mesma limitação de leitura direta da seção 32) encontrou
**dois produtos distintos da CONAB**, que não devem ser confundidos:

| Produto CONAB | Tipo de dado | Status |
|---|---|---|
| "Série Histórica — Preços Agropecuários" (`portaldeinformacoes.conab.gov.br`) | Preço de mercado agropecuário | `NAO_VERIFICADO` quanto a cobertura, unidade, metodologia, acesso e redistribuição — indício de busca apenas |
| "Série Histórica de Custos de Produção — Soja" (`gov.br/conab`) | **Custo de produção**, não preço de mercado | `NAO_VERIFICADO` quanto aos mesmos itens; classificação de tipo de dado (custo × preço) confirmada pelo próprio título do produto encontrado na busca |

Por exigência explícita desta etapa: **o produto de custo de produção da
CONAB nunca deve ser apresentado, aqui ou em qualquer uso futuro, como preço
de mercado.** Caso uma etapa futura confirme e integre algum produto da
CONAB, os dois produtos exigem avaliação e decisão separadas — não podem ser
tratados como uma única "fonte CONAB".

## 42. Soja regional — busca por fonte institucional (Tocantins)

Nesta etapa, uma nova busca (WebSearch, mesma limitação de leitura direta da
seção 32) foi feita especificamente por fonte institucional para o estado do
Tocantins — não encontrada na Etapa 6. O resultado aponta uma pista nova:

- **SEAGRO-TO — Secretaria da Agricultura, Pecuária e Aquicultura do Estado
  do Tocantins**, seção "Cotações Agropecuárias" no domínio oficial do
  governo do estado (`to.gov.br/seagro/cotacoes-agropecuarias/...`).

Esta é, nesta pesquisa, a única pista de fonte **institucional** (governo
estadual) especificamente associada ao Tocantins. Ela **não foi aberta
diretamente** nesta etapa (bloqueio da seção 32), então nada sobre ela é
`CONFIRMADO`: não se sabe, a partir desta etapa, se a página cobre soja
especificamente, qual a praça exata, a metodologia, a frequência, ou a
situação de acesso/redistribuição. Tudo isso é `NAO_VERIFICADO`.

Reforçando a instrução desta etapa: **nenhuma cotação de Bahia, Paraná ou
Mato Grosso — nem um benchmark nacional — foi tratada como substituto do
Tocantins.** O IMEA (Instituto Mato-Grossense de Economia Agropecuária),
encontrado na mesma busca, é explicitamente **descartado** como candidata de
soja regional para o Tocantins nesta avaliação, por ser especificamente do
Mato Grosso.

Decisão (seção 43): `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA` — a lacuna
permanece explícita, agora com uma pista institucional nomeada para uma etapa
futura verificar por leitura direta, em vez de "nenhuma pista encontrada"
como registrado na Etapa 6.

## 43. Matriz final de evidências e decisão por fonte

Enum de status de campo, usado em todas as colunas da matriz abaixo:
`CONFIRMADO`, `NAO_VERIFICADO`, `NAO_APLICAVEL`, `RESTRITO_CONFIRMADO`,
`PROIBIDO_CONFIRMADO`.

Enum de decisão por fonte (coluna "recomendação"):
`APROVADA_TECNICAMENTE_PENDENTE_GOVERNANCA`,
`APROVADA_PARA_PROVA_DE_CONCEITO_LOCAL`, `APROVADA_PARA_ARMAZENAMENTO_INTERNO`,
`APROVADA_PARA_PUBLICACAO`, `SOMENTE_REFERENCIAL`, `EXIGE_LICENCA`,
`REJEITADA`, `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA`.

Nenhuma fonte abaixo recebe `APROVADA_PARA_PUBLICACAO` (nenhuma tem
redistribuição confirmada) nem `APROVADA_PARA_ARMAZENAMENTO_INTERNO`
(nenhuma tem avaliação de governança/armazenamento concluída nesta etapa).

| Indicador | Fonte | Classificação | Finalidade proposta | Documentação oficial | Acesso | Cadastro | Chave | Custo | Cobertura histórica | Granularidade | referenceDate/Period | Unidade | Revisão de dados | Armazenamento interno | Redistribuição | Publicação em repo público | Situação técnica | Situação jurídica | Recomendação | Pendência |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dólar | BCB PTAX (já em uso) | `OFICIAL_PRIMARIA` | Fonte já integrada; nenhuma mudança proposta | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` (código não usa chave) | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | diária (por execução) | `NAO_VERIFICADO` | `CONFIRMADO` (R$/US$, venda) | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `CONFIRMADO` (domínio já usado com sucesso na produção, `data.json`) | `NAO_VERIFICADO` | `APROVADA_TECNICAMENTE_PENDENTE_GOVERNANCA` (para uso complementar/histórico; uso atual já em produção) | Confirmar por leitura direta: série SGS equivalente, limites de consulta, licença |
| Dólar (complementar) | BCB SGS (candidata) | `OFICIAL_PRIMARIA` | Reconstrução histórica retroativa | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` (nada armazenado) | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` (mesmo domínio-família do BCB, não testado especificamente) | `NAO_VERIFICADO` | `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA` | Leitura direta da documentação do SGS |
| Ureia/MAP/KCl | ComexStat/MDIC (já em uso) | `OFICIAL_PRIMARIA` | Fonte já integrada; candidata a aprofundamento histórico retroativo | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` (código não usa chave) | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `CONFIRMADO` (mensal, código) | `CONFIRMADO` (mês de referência, `refsFertilizantes`) | `CONFIRMADO` (US$/t FOB) | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `CONFIRMADO` (domínio já usado com sucesso na produção, `data.json`) | `NAO_VERIFICADO` | `APROVADA_TECNICAMENTE_PENDENTE_GOVERNANCA` | Confirmar por leitura direta: cobertura histórica real, limites, licença de redistribuição |
| Gás natural | EIA Henry Hub (já em uso) | `OFICIAL_PRIMARIA` | Fonte já integrada; candidata a aprofundamento histórico retroativo | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `CONFIRMADO` (`EIA_API_KEY`) | `CONFIRMADO` (`EIA_API_KEY`) | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `CONFIRMADO` (diária, código) | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `CONFIRMADO` (domínio já usado com sucesso na produção, `data.json`) | `NAO_VERIFICADO` | `APROVADA_TECNICAMENTE_PENDENTE_GOVERNANCA` | Confirmar por leitura direta: unidade declarada, termos de uso, cobertura histórica |
| Soja nacional | CEPEA/ESALQ direto (candidata) | `OFICIAL_PRIMARIA` | Reconstrução histórica retroativa | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `CONFIRMADO` **como bloqueado** para datacenter (código + `CLAUDE.md`) | `NAO_VERIFICADO` | `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA` | Leitura direta de metodologia/termos; resolução do bloqueio técnico |
| Soja nacional (referencial) | CONAB — Preços Agropecuários | `OFICIAL_PRIMARIA` | Apenas referência/checagem cruzada humana | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `SOMENTE_REFERENCIAL` | Confirmar se mede o mesmo indicador metodológico do CEPEA (provavelmente não, ver seção 41) |
| BDI/frete marítimo | HANDYBULK (já em uso) | `PUBLICA_NAO_OFICIAL` | Fonte já integrada; nenhuma mudança proposta | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | diária (texto corrido) | `CONFIRMADO` (data extraída do texto, código) | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `CONFIRMADO` (domínio já usado com sucesso na produção, `data.json`) | `NAO_VERIFICADO` | `APROVADA_TECNICAMENTE_PENDENTE_GOVERNANCA` (uso atual); nenhuma mudança proposta | — |
| BDI/frete marítimo | Baltic Exchange (candidata oficial) | `NAO_CLASSIFICADA` (natureza oficial não confirmada por leitura direta) | Fonte possivelmente oficial do índice — sem decisão nesta etapa | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA` | Abrir e ler a documentação oficial do Baltic Exchange (política de dados e licenciamento) antes de qualquer nova decisão — indício de busca (seção 39) não é suficiente |
| Ureia/MAP/KCl (referencial) | World Bank Pink Sheet | `OFICIAL_PRIMARIA` | Apenas referência/checagem cruzada humana | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` (relatório público, sem chave conhecida) | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `SOMENTE_REFERENCIAL` | Praça/condição comercial diferente do ComexStat (seção 27) — nunca tratar como equivalente |
| Soja regional (Tocantins) | Nenhuma confirmada; SEAGRO-TO como pista | `NAO_CLASSIFICADA` | Sem finalidade proposta — lacuna documentada | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_APLICAVEL` | `NAO_VERIFICADO` | `NAO_VERIFICADO` | `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA` | Leitura direta de `to.gov.br/seagro/cotacoes-agropecuarias` para confirmar se cobre soja |

## 44. Fontes atuais do código — auditoria e correção da divergência com o README

Auditoria de código (`fetch-data.mjs`, `fetch-fertilizers.mjs`), confirmada
por leitura direta nesta etapa, e comparação com o texto anterior da seção 6
do `README.md`:

| Indicador | README (texto anterior) | Código (real, confirmado) | Divergência? |
|---|---|---|---|
| Dólar | "AwesomeAPI, tempo real" | Primária: BCB PTAX. Fallback 1: Frankfurter. Fallback 2 (última opção): AwesomeAPI | Sim — AwesomeAPI é a **última** opção, não a única/primária |
| Soja CEPEA | "CEPEA/ESALQ (scraping)" | Primária: Notícias Agrícolas (republica CEPEA/ESALQ Paraná). Fallback: CEPEA direto | Sim — a fonte primária real não é o domínio do CEPEA |
| BDI | "stooq" | Primária: HANDYBULK. Fallback: stooq | Sim — stooq é fallback, não primária |
| BDI ("O que continua manual") | "Apenas o BDI... a fonte passou a exigir JavaScript" | `fertilizers-override.json` tem `"fontesManuais": []` (vazio) — nenhum indicador travado como manual hoje | Sim — o texto descrevia um estado anterior; hoje o BDI é buscado automaticamente via HANDYBULK |
| Ureia/MAP/KCl | "ComexStat — API oficial do MDIC, mensal" | Confere | Não |
| Gás natural | "EIA (Henry Hub) ou stooq, diária" | Confere | Não |
| Soja regional | Não mencionada | Primária: Notícias Agrícolas (praça Oeste da Bahia/AIBA). Sem fallback de fonte própria (aplica estimativa/última leitura) | Ausente — indicador existente no código, mas não documentado |

O README (seção 6) foi corrigido nesta etapa **apenas nos pontos acima,
comprovados por leitura direta do código**, sem alterar nenhuma linha de
código e sem alterar a ordem real dos fallbacks. A distinção entre fonte
primária atual, fallback atual, override, fonte candidata futura e fonte
somente referencial é mantida explícita tanto na tabela do README quanto na
matriz da seção 43 — nenhuma fonte candidata futura é descrita, em nenhum dos
dois documentos, como já integrada.

---

## 45. Adendo Etapa 6.2 — objetivo e escopo desta correção

As seções 1–44 acima (Etapas 6 e 6.1) **não foram reescritas**, exceto pelas
duas correções pontuais assinaladas nas seções 34 e 39 (Baltic Exchange —
ver abaixo). Este segundo adendo (seções 45–48) tem três objetivos:

1. Corrigir a inconsistência identificada entre a Etapa 6.1 e a sua própria
   regra de verificação: a decisão `EXIGE_LICENCA` para o Baltic Exchange
   havia sido registrada como se fosse conclusiva, apoiada apenas em indício
   de busca — o que a própria seção 33 já proibia. Corrigido para
   `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA` (seções 34, 39 e 43).
2. Formalizar, numa única seção de referência (seção 46), a separação entre
   evidência do repositório, evidência externa (documento oficial aberto e
   lido) e evidência de busca — para cada uma das fontes já discutidas nas
   seções 35–42, deixando explícito que evidência de busca nunca é promovida
   a evidência externa confirmada.
3. Transformar a matriz da seção 43 num pacote objetivo de aprovação humana:
   um checklist por fonte (seção 47) e um gate de integração (seção 48) que
   nenhuma fonte pode contornar.

**Nenhuma nova pesquisa externa foi feita nesta etapa.** O ambiente já havia
demonstrado `EGRESS_BLOCKED` para todos os domínios institucionais prioritários
na Etapa 6.1 (seção 32); esta etapa trabalha inteiramente sobre a evidência já
registrada, sem repetir tentativas de abertura direta nem novas buscas.

Nenhuma coleta, API, scraping, download, armazenamento de série, integração,
alteração de coletor, catálogo técnico, `formulationId`, dado de
formulação/micronutriente, cruzamento com formulados, correlação, regressão
ou previsão foi implementada nesta etapa. Nenhum workflow, dashboard ou
`package.json` foi alterado. Nenhum push foi feito.

## 46. Separação formal das evidências (repositório × documentação externa × busca)

Três categorias de evidência, nunca combinadas nem promovidas de uma para
outra:

- **Evidência do repositório** (`EVIDENCIA_DO_REPOSITORIO`): implementação
  atual, endpoint já codificado, unidade usada pelo código, campo lido,
  status registrado em `data.json`, fallback existente, variável de chave
  citada no workflow. Lida diretamente nesta sessão, a partir de arquivos
  deste repositório. Sustenta `CONFIRMADO` nas seções 35–43, mas **prova
  apenas o que o código faz hoje — nunca uma autorização jurídica, uma
  licença ou uma permissão de armazenamento/redistribuição/publicação
  externa**, que dependem de uma fonte diferente de evidência (abaixo).
- **Evidência externa** (`EVIDENCIA_DA_DOCUMENTACAO_EXTERNA`): documentação
  oficial aberta e lida diretamente (termos de uso, política de dados,
  licença, cobertura histórica declarada pela própria fonte, texto sobre
  redistribuição/armazenamento). **Nenhuma fonte desta avaliação tem
  evidência externa nesta categoria** — todas as tentativas de abertura
  direta retornaram `EGRESS_BLOCKED` (seção 32), e esta etapa não tentou
  novamente (instrução explícita da Etapa 6.2).
- **Evidência de busca**: URL localizada, snippet, resumo do mecanismo de
  pesquisa, pista para validação futura. **Nunca promovida a evidência
  externa confirmada** — usada apenas para apontar o que uma etapa futura,
  com acesso direto liberado, precisaria abrir e ler.

| Fonte | Evidência do repositório | Evidência externa (documento oficial aberto) | Evidência de busca (pista, não promovida) |
|---|---|---|---|
| BCB PTAX (atual) | `cotacaoVenda` via `olinda.bcb.gov.br`, uso confirmado em `fetch-data.mjs` e sucesso operacional em `data.json` (seção 35) | Nenhuma | Nenhuma pesquisa nova nesta etapa |
| BCB SGS (histórico, candidata) | Nenhuma — não é usada pelo código hoje | Nenhuma | URL de domínio (`api.bcb.gov.br/dados/serie/...`, `dadosabertos.bcb.gov.br`) e menção a limite de 10 anos por consulta, ambas só de busca (Etapa 6) |
| ComexStat/MDIC | Granularidade mensal, campos FOB/KG, NCMs, tratamento de HTTP 429, sucesso operacional em `data.json` (seção 36) | Nenhuma | Existência de página de documentação e cobertura "desde 1989", só de busca (Etapa 6) |
| EIA | Série `RNGWHHD`, frequência diária, `EIA_API_KEY` no workflow, sucesso operacional em `data.json` (seção 37) | Nenhuma | Cobertura "desde 1997" e unidade US$/MMBtu, só de busca (Etapa 6) |
| CEPEA/ESALQ | Indicador/praça/unidade usados hoje, bloqueio a datacenter documentado no código e em `CLAUDE.md` (seção 38) | Nenhuma | Existência de página de metodologia e de séries históricas, só de busca (Etapa 6) |
| Baltic Exchange | Nenhuma — não é usada pelo código hoje | Nenhuma | Nomes de licença e exigência de assinatura, só de busca (Etapa 6) — **não promovidos a decisão conclusiva nesta etapa (correção da seção 34/39)** |
| World Bank/Pink Sheet | Nenhuma — não é usada pelo código hoje | Nenhuma | Existência do relatório, cobertura de produtos e licença CC-BY 4.0, só de busca (Etapa 6) |
| CONAB (Preços Agropecuários) | Nenhuma — não é usada pelo código hoje | Nenhuma | Existência da página de série histórica, só de busca (Etapa 6) |
| CONAB (Custos de Produção — Soja) | Nenhuma — não é usada pelo código hoje | Nenhuma | Existência do produto, e sua natureza de custo (não preço), só de busca (Etapa 6) |
| SEAGRO-TO (soja regional) | Nenhuma — não é usada pelo código hoje | Nenhuma | Existência de seção "Cotações Agropecuárias" no domínio `to.gov.br`, só de busca (Etapa 6.1) — **não afirma que a página cobre soja** |

## 47. Checklist de aprovação humana por fonte

Cada bloco abaixo é o pacote de decisão para uma fonte. Os quatro campos
finais (`responsável pela validação`, `decisão jurídica`, `data da decisão`,
`evidência arquivada`) são **exclusivamente humanos** e estão marcados
`PENDENTE_DE_PREENCHIMENTO` — nenhum nome, data ou valor foi inventado. Nenhum
dado pessoal aparece neste checklist.

#### Fonte: BCB PTAX (uso atual)
- documento oficial a abrir: metodologia/termos de uso da PTAX no domínio `bcb.gov.br`
- termo ou política a localizar: termos de uso e política de redistribuição de dados do Banco Central
- série ou produto a confirmar: uso atual já confirmado por evidência do repositório (seção 35) — sem candidata nova aqui
- unidade: `CONFIRMADO` (R$/US$, venda) via evidência do repositório
- periodicidade: `NAO_VERIFICADO`
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_APLICAVEL` (uso atual não depende de histórico)
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_APLICAVEL` (código não usa chave, evidência do repositório)
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_APLICAVEL` (já em produção; decisão original de uso não revisada aqui)
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `APROVADA_TECNICAMENTE_PENDENTE_GOVERNANCA` (uso atual, sem mudança proposta)
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: uso já em produção; este checklist cobre apenas o que ainda falta para qualquer ampliação (armazenamento/publicação de histórico), não o uso corrente da cotação do dia.

#### Fonte: BCB SGS (histórico, candidata)
- documento oficial a abrir: documentação do SGS/API de Dados Abertos do BCB
- termo ou política a localizar: termos de uso, licença e limite de período por consulta
- série ou produto a confirmar: código de série equivalente à PTAX venda hoje usada
- unidade: `NAO_VERIFICADO`
- periodicidade: `NAO_VERIFICADO`
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_VERIFICADO`
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_VERIFICADO`
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA`
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: a adequação técnica do endpoint PTAX atual não é prova de que o SGS esteja autorizado para armazenamento ou publicação — são avaliações separadas.

#### Fonte: ComexStat/MDIC (histórico retroativo)
- documento oficial a abrir: documentação oficial da API ComexStat
- termo ou política a localizar: termos de uso, política de revisão de dados, licença de redistribuição
- série ou produto a confirmar: cobertura histórica real (não presumir "desde 1989")
- unidade: `CONFIRMADO` (US$/t FOB) via evidência do repositório
- periodicidade: `CONFIRMADO` (mensal) via evidência do repositório
- referência econômica: `CONFIRMADO` (mês de referência, `refsFertilizantes`) via evidência do repositório
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_APLICAVEL` (código não usa chave, evidência do repositório)
- limite de requisições: parcialmente evidenciado pelo repositório (tratamento de HTTP 429), mas o limite oficial documentado é `NAO_VERIFICADO`
- permissão de automação: `NAO_APLICAVEL` (já em produção para o uso corrente; ampliação de histórico não avaliada)
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `APROVADA_TECNICAMENTE_PENDENTE_GOVERNANCA` — significa apenas que a integração atual está comprovada pelo código, a estrutura técnica é conhecida e a execução foi observada (seção 36); **não implica nenhuma autorização jurídica**
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: uso corrente (preço do mês) já em produção; pendência é sobre aprofundamento retroativo/armazenamento de histórico.

#### Fonte: EIA Henry Hub (histórico retroativo)
- documento oficial a abrir: termos de uso da API de dados abertos da EIA
- termo ou política a localizar: termos de uso, licença de redistribuição
- série ou produto a confirmar: `RNGWHHD` já confirmado por evidência do repositório; unidade ainda não
- unidade: `NAO_VERIFICADO`
- periodicidade: `CONFIRMADO` (diária) via evidência do repositório
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO` quanto à política externa (o uso de `EIA_API_KEY` no workflow é evidência do repositório de que o código exige uma chave, não uma confirmação da política de cadastro da EIA)
- necessidade de chave: `CONFIRMADO` **apenas como evidência do repositório** (`EIA_API_KEY` no workflow) — não confirma se a EIA proíbe uso sem chave em outros contextos
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_APLICAVEL` (já em produção para o uso corrente; ampliação de histórico não avaliada)
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `APROVADA_TECNICAMENTE_PENDENTE_GOVERNANCA` — apenas integração atual comprovada, estrutura conhecida, execução observada; **nenhuma autorização jurídica implícita**
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: mesma ressalva do ComexStat — uso corrente em produção, pendência é sobre histórico/armazenamento.

#### Fonte: CEPEA/ESALQ (direto, candidata)
- documento oficial a abrir: metodologia e termos de uso do CEPEA/ESALQ
- termo ou política a localizar: licença, redistribuição, uso corporativo
- série ou produto a confirmar: indicador equivalente ao já usado (soja Paraná)
- unidade: `NAO_VERIFICADO` para a fonte direta (o uso atual, via Notícias Agrícolas, tem unidade confirmada por repositório — seção 38)
- periodicidade: `NAO_VERIFICADO`
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_VERIFICADO`
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_VERIFICADO` — e mesmo que fosse permitida, o acesso direto já está tecnicamente bloqueado para datacenter (evidência do repositório, seção 38)
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA`
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: visibilidade pública da página não implica, e não foi tratada aqui como, aprovação de automação, armazenamento ou redistribuição.

#### Fonte: Baltic Exchange
- documento oficial a abrir: política de dados e termos de licenciamento do Baltic Exchange
- termo ou política a localizar: tipos de licença, exigência de assinatura, permissão de redistribuição
- série ou produto a confirmar: Baltic Dry Index (BDI) oficial
- unidade: `NAO_VERIFICADO`
- periodicidade: `NAO_VERIFICADO`
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_VERIFICADO`
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_VERIFICADO`
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `SEM_DECISAO_POR_FALTA_DE_EVIDENCIA`
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: resultados de pesquisa indicam possível exigência de licenciamento, mas a documentação oficial não foi aberta neste ambiente — não usar como decisão confirmada em nenhuma direção.

#### Fonte: World Bank Commodity Markets/Pink Sheet
- documento oficial a abrir: relatório "Pink Sheet" e página de licenciamento do catálogo de dados do Banco Mundial
- termo ou política a localizar: licença (CC-BY 4.0 é, até aqui, só indício de busca), redistribuição
- série ou produto a confirmar: cobertura de ureia/DAP/KCl/gás natural e praça/condição comercial de cada uma
- unidade: `NAO_VERIFICADO`
- periodicidade: `NAO_VERIFICADO`
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_APLICAVEL` (indício de busca aponta relatório público, mas não confirmado por leitura direta)
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_VERIFICADO`
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `SOMENTE_REFERENCIAL` — mantida apenas pela diferença metodológica já registrada (seção 27: praças/condições comerciais diferentes do FOB de importação do ComexStat), não por qualquer confirmação de licença
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: licença CC-BY 4.0 não deve ser mencionada como confirmada em nenhum uso futuro deste documento enquanto a página oficial não for aberta e lida.

#### Fonte: CONAB — Preços Agropecuários
- documento oficial a abrir: página oficial da série histórica de preços agropecuários da CONAB
- termo ou política a localizar: termos de reprodução/redistribuição
- série ou produto a confirmar: se mede o mesmo indicador metodológico do CEPEA (provavelmente não — ver seção 41)
- unidade: `NAO_VERIFICADO`
- periodicidade: `NAO_VERIFICADO`
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_VERIFICADO`
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_VERIFICADO`
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO` (não presumida a partir de resumo de busca)
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `SOMENTE_REFERENCIAL`
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: produto de preço de mercado — não confundir com o produto de custos de produção abaixo.

#### Fonte: CONAB — Custos de Produção (Soja)
- documento oficial a abrir: página oficial da série histórica de custos de produção da CONAB
- termo ou política a localizar: termos de reprodução/redistribuição
- série ou produto a confirmar: **este produto é custo de produção, não preço de mercado** — nunca apresentar como preço
- unidade: `NAO_VERIFICADO`
- periodicidade: `NAO_VERIFICADO`
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_VERIFICADO`
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_VERIFICADO`
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `REJEITADA` para uso como preço de mercado (é custo de produção); poderia, em tese, ser referencial para outra finalidade, não avaliada aqui
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: rejeitada especificamente para o uso de "preço de mercado" que este documento avalia — não uma rejeição geral do produto para todo e qualquer uso futuro.

#### Fonte: Soja regional — SEAGRO-TO (pista)
- documento oficial a abrir: seção "Cotações Agropecuárias" em `to.gov.br/seagro`
- termo ou política a localizar: existência de cotação de soja, metodologia, termos de uso
- série ou produto a confirmar: **não confirmado que a página cobre soja** — isso é a primeira coisa a checar
- unidade: `NAO_VERIFICADO`
- periodicidade: `NAO_VERIFICADO`
- referência econômica: `NAO_VERIFICADO`
- cobertura histórica: `NAO_VERIFICADO`
- necessidade de cadastro: `NAO_VERIFICADO`
- necessidade de chave: `NAO_VERIFICADO`
- limite de requisições: `NAO_VERIFICADO`
- permissão de automação: `NAO_VERIFICADO`
- permissão de armazenamento interno: `NAO_VERIFICADO`
- permissão de redistribuição: `NAO_VERIFICADO`
- permissão de publicação: `NAO_VERIFICADO`
- responsável pela validação: `PENDENTE_DE_PREENCHIMENTO`
- decisão técnica: `PISTA_PARA_VERIFICACAO` — não é uma fonte candidata aprovada, é uma pista de busca a verificar
- decisão jurídica: `PENDENTE_DE_PREENCHIMENTO`
- data da decisão: `PENDENTE_DE_PREENCHIMENTO`
- evidência arquivada: `PENDENTE_DE_PREENCHIMENTO`
- observação: nenhuma cotação de Bahia, Paraná, Mato Grosso ou benchmark nacional substitui esta lacuna (seção 42). Esta pista não afirma, e não deve ser lida como afirmando, que a SEAGRO-TO fornece preço de soja.

## 48. Gate de integração

**Nenhuma fonte desta avaliação pode avançar para integração** (implementação
de coleta, armazenamento ou publicação) **até possuir, no mínimo**, todos os
itens abaixo confirmados — não apenas alguns:

1. série exata identificada;
2. unidade confirmada;
3. `referenceDate` ou `referencePeriod` definido;
4. granularidade confirmada;
5. cobertura histórica confirmada;
6. acesso técnico confirmado;
7. permissão de automação avaliada;
8. armazenamento interno avaliado;
9. redistribuição avaliada;
10. publicação avaliada;
11. decisão humana registrada (não `PENDENTE_DE_PREENCHIMENTO`).

Enum de status do gate, usado para cada fonte: `APROVADA_PARA_PROVA_LOCAL`,
`APROVADA_PARA_USO_INTERNO`, `APROVADA_PARA_PUBLICACAO`, `REJEITADA`,
`PENDENTE`.

**Os três níveis de aprovação não se implicam.** `APROVADA_PARA_PROVA_LOCAL`
autoriza, no máximo, um experimento técnico isolado, sem persistência
integrada ao pipeline de produção e sem uso pelo dashboard/relatório — **não
autoriza uso interno continuado nem publicação**. `APROVADA_PARA_USO_INTERNO`
autoriza armazenamento/uso dentro da organização — **não autoriza
publicação** em repositório público ou GitHub Pages. `APROVADA_PARA_PUBLICACAO`
é o único nível que autoriza tornar o dado público, e exige adicionalmente
permissão de redistribuição confirmada por evidência externa (nunca por
indício de busca). Cada nível exige sua própria decisão humana registrada —
uma aprovação de nível mais baixo nunca é lida como cobrindo o nível
seguinte.

Estado do gate para todas as fontes desta avaliação, nesta etapa:

| Fonte | Itens do gate confirmados | Status do gate |
|---|---|---|
| BCB PTAX (uso atual) | Parcial (série/unidade/acesso técnico do uso corrente; não do histórico) | `PENDENTE` |
| BCB SGS (histórico) | Nenhum | `PENDENTE` |
| ComexStat/MDIC (histórico) | Parcial (série/unidade/granularidade/referencePeriod/acesso técnico do uso corrente; não do histórico) | `PENDENTE` |
| EIA (histórico) | Parcial (série/granularidade/acesso técnico do uso corrente; não do histórico) | `PENDENTE` |
| CEPEA/ESALQ direto | Nenhum | `PENDENTE` |
| Baltic Exchange | Nenhum | `PENDENTE` |
| World Bank/Pink Sheet | Nenhum | `PENDENTE` |
| CONAB — Preços Agropecuários | Nenhum | `PENDENTE` |
| CONAB — Custos de Produção | Nenhum (e rejeitada para uso como preço de mercado — seção 47) | `PENDENTE` |
| Soja regional — SEAGRO-TO | Nenhum (nem confirmado que cobre soja) | `PENDENTE` |

Nenhuma fonte desta avaliação está, nesta etapa, `APROVADA_PARA_PROVA_LOCAL`,
`APROVADA_PARA_USO_INTERNO` ou `APROVADA_PARA_PUBLICACAO`. Isso é esperado e
correto: esta etapa é documental, não decide por aprovação humana ainda
pendente (seção 47), e nenhuma decisão jurídica foi tomada dentro deste
ambiente.
