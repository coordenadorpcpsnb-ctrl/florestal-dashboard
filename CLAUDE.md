# CLAUDE.md

Contexto para o Claude Code trabalhar neste repositório. Leia isto inteiro antes de
mexer em qualquer arquivo — a maioria dos erros já cometidos aqui vêm de ignorar um
destes pontos.

## Sobre o projeto

Dashboard de Inteligência de Mercado de Insumos Florestais, para a equipe de
Planejamento, Controle e Pesquisa Florestal (PCP) da Sinobras Florestal. Roda
sozinho toda terça-feira via GitHub Actions: busca preços de câmbio, fertilizantes,
soja, gás e frete; atualiza um dashboard HTML estático; gera um relatório
executivo em PDF; publica no GitHub Pages; envia por e-mail.

**Toda comunicação e todo texto voltado ao usuário (commits, comentários, UI) é em
português.** O usuário (Jamur) não é desenvolvedor — reporta erros colando o texto
exato do log do GitHub Actions, e espera uma correção pontual, não um reescrever.

## Regras inegociáveis

- **Nunca inventar números, nomes ou fontes.** Se um dado não pode ser verificado,
  o campo fica `null`/"—", nunca um valor chutado.
- **Toda fonte de dado precisa ser citável e verificável.** Ao trocar ou adicionar
  uma fonte, documente de onde veio.
- A análise qualitativa de mercado (`contexto-mercado.json`: causas da alta,
  perspectivas) é **sempre curada manualmente** — nunca gerada automaticamente pela
  pipeline. Só os números derivados (deltas) e as notícias com link são automáticos.
  Não crie lógica que reescreva `causas`/`perspectiva` sozinha.

## Arquitetura — ordem de execução

`run-weekly.mjs` orquestra tudo, nesta ordem, parando no primeiro erro:

```
fetch-data.mjs → patch-dashboard.mjs → build-report.mjs → build-email.mjs
```

| Arquivo | Função |
|---|---|
| `fetch-data.mjs` | Orquestra a busca de câmbio, soja, BDI, chama `fetch-fertilizers.mjs` e `fetch-noticias.mjs`, grava `data.json` |
| `fetch-fertilizers.mjs` | Ureia/MAP/KCl via ComexStat + gás via EIA/stooq |
| `fetch-noticias.mjs` | Notícias recentes de fertilizantes (Notícias Agrícolas) |
| `patch-dashboard.mjs` | Reescreve os blocos marcados do `dashboard.html` a partir de `data.json` e `contexto-mercado.json` |
| `build-report.mjs` | Gera `relatorio_executivo.docx` e converte para PDF via LibreOffice |
| `build-email.mjs` | Gera `email-body.html` e `email-subject.txt` |
| `check-status.mjs` | Roda separado no workflow; decide se abre/fecha a Issue de alerta |

O `dashboard.html` tem blocos delimitados por comentários que o patch reescreve —
**nunca editar esses blocos manualmente sem manter os marcadores**:
`KPIS-START/END`, `LIVE-START/END`, `ALERTS-START/END`, `SERIES-START/END`,
`CONTEXTO-START/END`.

## Fontes de dados

| Indicador | Fonte primária | Fallback | Automático? |
|---|---|---|---|
| Câmbio | BCB PTAX | Frankfurter → AwesomeAPI | Sim |
| Soja CEPEA | Notícias Agrícolas | site do CEPEA direto | Sim |
| Soja Oeste BA (AIBA) | Notícias Agrícolas (mercado físico) | estimativa 95,7% do CEPEA | Sim |
| Gás natural | EIA Henry Hub (precisa de `EIA_API_KEY`) | stooq | Sim |
| BDI (frete) | HANDYBULK | stooq | Sim |
| Ureia/MAP/KCl FOB | ComexStat (API oficial MDIC) | — | Sim |
| Diesel S10 | — | removido do sistema | — |
| Glifosato | — | removido do sistema | — |

`fertilizers-override.json` é rede de segurança: só entra em jogo se a busca
automática falhar, exceto quando `forceManual: true`. O array `fontesManuais`
(hoje vazio) suprime o alerta semanal para fontes sabidamente manuais.

## Armadilhas conhecidas (leia antes de "consertar" algo)

- **ComexStat só aceita UM MÊS por consulta.** Pedir um intervalo de vários meses
  com `monthDetail` retorna `{"data":{"list":[]},"success":true}` — parece vazio,
  mas o problema é o intervalo, não os NCMs nem os filtros. A busca atual consulta
  mês a mês, recuando até achar dados publicados.
- **Um commit feito com o `GITHUB_TOKEN` padrão não dispara outros workflows.**
  Por isso a publicação do GitHub Pages está *dentro* de `weekly-update.yml`
  (passos 8–11), não num `publish-pages.yml` disparado por push — esse arquivo
  separado hoje só roda manualmente (`workflow_dispatch`).
- **Vários sites bloqueiam IPs de datacenter** (CEPEA direto, ANP, Petrobras,
  Portal Canaã). Notícias Agrícolas, HANDYBULK, EIA e BCB PTAX não bloqueiam —
  por isso são as fontes primárias escolhidas.
- **Cards de fertilizante mostram "—" em vez de "0,0%"** nas semanas sem
  fechamento mensal novo (o dado do ComexStat só muda uma vez por mês). A lógica
  compara o mês de referência salvo com o anterior; não "conserte" isso voltando
  para 0,0%.
- **Editar o `dashboard.html` por posição de texto já quebrou a página duas
  vezes** (apagou canvases de gráfico e a grade de KPIs sem gerar erro de
  sintaxe). `node --check` só valida sintaxe — não garante que a página renderiza.
  Ver seção de validação abaixo.
- **Sandbox/ambiente de execução aqui bloqueia rede externa** (só libera
  npm/GitHub/PyPI). Toda fonte de dado retorna 403 em teste local — isso é
  esperado. Validar a lógica com respostas HTTP simuladas (mocks), não assumindo
  que "sem internet = quebrado".
- **`check-status.mjs` tem rótulos desatualizados**: os nomes exibidos ainda
  dizem "AwesomeAPI" e "stooq" para câmbio e BDI — mas as fontes reais hoje são
  BCB PTAX e HANDYBULK. Os *dados* buscados estão corretos; só os textos de
  rótulo (`FONTES` no topo do arquivo) ficaram para trás. Vale corrigir quando
  mexer nesse arquivo por outro motivo.

## Como validar antes de entregar qualquer mudança

Nesta ordem, sempre:

1. `node --check arquivo.mjs` em todo `.mjs` tocado (sintaxe)
2. Se mexeu em `dashboard.html`: teste de renderização com jsdom — carregar a
   página, trocar entre as 7 abas, contar KPIs/canvases/cards esperados, e
   verificar que não sobrou nenhum `${...}` sem interpolar
3. `npm ci && node run-weekly.mjs` — a esteira completa tem que terminar com
   exit 0
4. Para mudança em workflow `.yml`: `python3 -c "import yaml; yaml.safe_load(open('arquivo.yml'))"`
5. Para mudança no relatório: gerar o PDF e olhar visualmente (renderizar página
   a página), não só `pdftotext` — formatação quebrada não aparece no texto puro

## Comandos úteis

```bash
npm ci                      # instalar dependências
node run-weekly.mjs         # esteira completa (fetch → patch → report → email)
node fetch-data.mjs         # só a busca de dados
node patch-dashboard.mjs    # só reescrever o dashboard a partir de data.json
node build-report.mjs       # só gerar docx/pdf
node check-status.mjs       # só checar status das fontes (usa GITHUB_OUTPUT)
```

## Convenções de entrega

- Commits e nomes de branch em português, seguindo o padrão já usado
  ("chore: atualizacao automatica AAAA-MM-DD" nos commits do robô)
- Ao corrigir um bug relatado, prefira a correção mínima e cirúrgica — o usuário
  já foi pego de surpresa por reescritas maiores que introduziram regressões
- Ao adicionar um arquivo **novo** (não substituir um existente), deixe isso
  explícito no resumo do PR — já aconteceu de um `.mjs` novo não ser enviado
  junto e quebrar `ERR_MODULE_NOT_FOUND` na primeira execução
