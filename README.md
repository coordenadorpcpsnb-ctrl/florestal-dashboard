# Dashboard & Relatório de Inteligência Florestal — Automação Semanal

Automação que roda **toda segunda-feira às 07:00 (horário de Brasília)** no GitHub Actions:

1. **Busca** os indicadores macro (câmbio, soja, BDI)
2. **Atualiza** os KPIs do `dashboard.html`
3. **Gera** o `relatorio_executivo.docx` + `.pdf`
4. **Commita** os arquivos atualizados no repositório

Não depende de nenhum computador ligado — roda na infraestrutura do GitHub.

---

## 1. Como colocar no ar (uma vez)

### Passo 1 — Criar o repositório
1. No GitHub: **New repository** → dê um nome (ex.: `florestal-dashboard`)
2. Recomendo **Private** se os dados forem internos
3. Envie estes arquivos para o repositório (arraste na interface web ou use `git push`)

### Passo 2 — Liberar a permissão de escrita
Sem isso o workflow não consegue commitar os arquivos gerados.

**Settings → Actions → General → Workflow permissions** → marque
**"Read and write permissions"** → **Save**

(Isso cobre tanto o commit dos arquivos quanto a abertura do alerta por Issue.)

### Passo 3 — Testar antes de esperar a segunda-feira
Aba **Actions** → workflow *"Atualizacao Semanal - Dashboard e Relatorio"* →
botão **Run workflow** → **Run workflow**

Em ~2 minutos você verá o resultado. Clique na execução para ver o **resumo**
com o status de cada fonte e os valores atuais.

Pronto. A partir daí ele roda sozinho toda segunda.

---

## 2. Onde ficam os resultados

| O quê | Onde |
|-------|------|
| Dashboard atualizado | `dashboard.html` no repositório |
| Relatório PDF/DOCX | `relatorio_executivo.pdf` / `.docx` no repositório |
| Download rápido | Aba **Actions** → execução → seção **Artifacts** |
| Histórico de valores | `data.json` (versionado a cada commit) |
| Log de cada execução | Aba **Actions** → clique na execução |

---

## 3. Alerta automático quando uma fonte falha

Você não precisa ficar conferindo a aba Actions. Se alguma fonte não puder ser
buscada, o workflow **abre uma Issue** no repositório com:

- quais fontes falharam e o motivo
- qual valor está sendo exibido no lugar (o último conhecido)
- o que fazer em cada caso
- link para o log completo

**Como funciona no dia a dia:**

| Situação | O que acontece |
|---|---|
| Uma fonte falha | Abre uma Issue com o rótulo `fonte-indisponivel` |
| Falha de novo na semana seguinte | **Comenta na mesma Issue** (não cria duplicada) |
| Todas as fontes voltam | **Fecha a Issue automaticamente** com um comentário |

Você recebe notificação por e-mail do GitHub sempre que a Issue for aberta ou
comentada (conforme suas preferências de notificação em Settings → Notifications).

> Importante: a falha de uma fonte **não interrompe** a automação. O dashboard e o
> relatório continuam sendo gerados — apenas com o último valor conhecido daquele
> indicador. O alerta serve para você saber que aquele número está congelado.

---

## 4. Receber o relatório por e-mail (opcional)

O workflow pode enviar o **PDF anexado** com um resumo no corpo da mensagem
(gatilhos acionados, tabelas de fertilizantes, soja e macro).

O envio só acontece se o secret `MAIL_TO` existir — sem ele, o passo é simplesmente pulado.

### Secrets necessários

Em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | O que é | Exemplo |
|---|---|---|
| `MAIL_TO` | destinatário(s), separados por vírgula | `jamur@empresa.com.br, equipe@empresa.com.br` |
| `MAIL_SERVER` | endereço do servidor SMTP | `smtp.gmail.com` |
| `MAIL_PORT` | porta (SSL) | `465` |
| `MAIL_USERNAME` | usuário / e-mail remetente | `relatorios@empresa.com.br` |
| `MAIL_PASSWORD` | senha do SMTP | — |

### Configuração por provedor

| Provedor | MAIL_SERVER | MAIL_PORT |
|---|---|---|
| Gmail | `smtp.gmail.com` | `465` |
| Outlook / Microsoft 365 | `smtp.office365.com` | `587` |
| Servidor corporativo | pergunte ao TI | geralmente `465` ou `587` |

> **Gmail e Microsoft 365 não aceitam a senha normal da conta.**
> No Gmail é preciso ativar a verificação em duas etapas e gerar uma
> **Senha de app** (myaccount.google.com → Segurança → Senhas de app).
> No Microsoft 365, o SMTP básico costuma vir desativado — o TI precisa liberar.
>
> Se a empresa tiver servidor SMTP próprio, prefira ele: evita depender de conta pessoal.

### Assunto da mensagem

Quando algum gatilho é acionado, o assunto vem destacado:
`[ATENÇÃO: 2 gatilho(s)] Inteligência de Mercado — Jul/2026`

### Enviar só quando houver gatilho

Se preferir receber apenas nas semanas com alerta, edite o passo
*"Enviar relatorio por e-mail"* no `weekly-update.yml`, trocando a condição por:

```yaml
        if: success() && env.MAIL_TO != '' && contains(env.ASSUNTO, 'ATENÇÃO')
```

(nesse caso é preciso expor o assunto como variável de ambiente — posso ajudar a montar).

---

## 5. Publicar o dashboard como site (opcional)

O arquivo `.github/workflows/publish-pages.yml` publica o dashboard numa URL
(ex.: `https://seu-usuario.github.io/florestal-dashboard`), sempre com os dados
mais recentes — prático para compartilhar com a equipe.

**Para ativar:** Settings → Pages → *Build and deployment* → Source: **GitHub Actions**
**Para desativar:** apague esse arquivo.

> Atenção: se o repositório for **público**, o site fica **acessível a qualquer pessoa**.
> Páginas privadas exigem plano GitHub Enterprise.

---

## 6. Fontes dos dados e o que ainda é manual

Quase tudo é buscado automaticamente. A tabela abaixo mostra a origem de cada indicador:

| Indicador | Fonte automática | Frequência |
|---|---|---|
| Dólar | AwesomeAPI | tempo real |
| Soja CEPEA | CEPEA/ESALQ (scraping) | diária |
| Frete Marítimo (BDI) | stooq | diária |
| **Ureia, MAP, KCl** | **ComexStat — API oficial do MDIC** | **mensal** |
| **Gás Natural** | **EIA (Henry Hub) ou stooq** | **diária** |

**Fertilizantes:** o preço é o FOB médio de importação brasileira, calculado como
`valor FOB (US$) ÷ peso líquido (t)` a partir dos NCMs oficiais:

| Produto | NCM |
|---|---|
| Ureia (>45% N) | `3102.10.10` |
| MAP (fosfato monoamônico) | `3105.40.00` |
| Cloreto de potássio | `3104.20.10` + `3104.20.90` (média ponderada) |

> Esse é o mesmo benchmark usado por publicações do setor. Como depende do
> fechamento das estatísticas de comércio exterior, o dado mais recente costuma
> ser **do mês anterior ou retrasado** — o `data.json` registra o mês de referência
> de cada produto em `refsFertilizantes`.

### Gás natural com dado oficial (opcional, recomendado)

Sem configuração, o gás vem do stooq (futuro NG — boa aproximação). Para usar o
**Henry Hub oficial da EIA**:

1. Pegue uma chave gratuita em https://www.eia.gov/opendata/register.php
2. No repositório: **Settings → Secrets and variables → Actions → New repository secret**
3. Nome: `EIA_API_KEY` · Valor: sua chave

### O que continua manual

Apenas o **BDI (frete marítimo)** — a fonte passou a exigir JavaScript e não há
alternativa pública gratuita. Edite em `fertilizers-override.json`:

```json
{
  "forceManual": false,
  "fontesManuais": ["bdi"],
  "bdi": 2667
}
```

Os demais valores nesse arquivo funcionam como **rede de segurança**: só são usados
se a busca automática falhar.

**Travar valores manualmente:** se em algum momento você quiser fixar os números
(por exemplo, para usar um benchmark diferente), mude `"forceManual": true`.
Nesse modo os valores do arquivo têm prioridade sobre a busca automática.

---

## 7. Ajustes comuns

**Mudar o horário** — edite o `cron` em `.github/workflows/weekly-update.yml`.
O GitHub usa **UTC**; Brasília é UTC-3 (sem horário de verão desde 2019):

| Horário desejado (BRT) | cron |
|---|---|
| Segunda 07:00 | `0 10 * * 1` *(atual)* |
| Segunda 06:00 | `0 9 * * 1` |
| Segunda 08:00 | `0 11 * * 1` |
| Diariamente 07:00 | `0 10 * * *` |

**Não commitar os binários** (para o repositório não crescer) — remova
`relatorio_executivo.docx relatorio_executivo.pdf` da linha `git add` no workflow.
Eles continuarão disponíveis como *Artifacts*.

---

## 8. Limites e cuidados (importante)

- **O horário é aproximado.** O agendador do GitHub sofre atrasos quando há muita
  fila — atrasos de 5 a 30 minutos são comuns, e em picos podem ser maiores.
  Se precisar de horário exato, o Agendador do Windows é mais preciso.

- **Inatividade pode desativar o agendamento.** O GitHub desativa workflows
  agendados após ~60 dias sem atividade no repositório. Commits feitos pelo próprio
  bot nem sempre contam. O GitHub avisa por e-mail antes; basta reativar na aba Actions.
  Fazer qualquer commit manual (ex.: a atualização quinzenal dos fertilizantes)
  já evita o problema.

- **Os scrapers podem ser bloqueados.** CEPEA e ANP às vezes bloqueiam acessos vindos
  de datacenters (que é o caso dos servidores do GitHub) com mais rigor do que
  acessos residenciais. Se alguma fonte falhar, a automação **mantém o último valor**
  e registra no `status` — nunca trava. Confira o resumo da execução de vez em quando.
  Se uma fonte falhar sempre, avise que ajustamos a estratégia.

- **Sites mudam.** Se o CEPEA/ANP alterarem o layout, o scraper para de encontrar o
  dado. O sintoma é o mesmo: `status` com falha e valor congelado.

- **Custo:** repositórios públicos têm Actions gratuito. Privados têm cota mensal
  gratuita (2.000 min no plano Free); esta automação consome ~3 min/semana (~12 min/mês),
  bem dentro do limite.

- **A busca de fertilizantes é recente.** O código foi escrito seguindo a
  documentação oficial da API do ComexStat e testado com respostas simuladas, mas
  **ainda não foi validado contra a API real**. Rode o workflow manualmente na
  primeira vez e confira no resumo da execução se `ureia`, `map` e `kcl` aparecem
  como `ok`. Se aparecerem como falha, os valores do `fertilizers-override.json`
  entram no lugar (nada quebra) e podemos ajustar o parser.

- **Benchmark dos fertilizantes mudou.** O valor agora é o FOB médio de importação
  (ComexStat), que pode diferir de outras referências (cotação spot internacional,
  ANDA). É um dado oficial e consistente ao longo do tempo, mas ao comparar com
  relatórios de terceiros verifique qual benchmark eles usam.

- **Defasagem dos fertilizantes:** o dado é mensal e depende do fechamento das
  estatísticas de comércio exterior — espere de 1 a 2 meses de atraso.

- **Causas qualitativas** (notícias, geopolítica, safra) **não** são geradas
  automaticamente — a seção 5 do relatório traz apenas as variações numéricas
  e pede revisão manual.

- Os **gráficos** do dashboard mantêm o histórico mensal; a automação atualiza os
  **cartões de KPI**. Estender a série histórica é um ajuste periódico à parte.

---

## 9. Estrutura dos arquivos

```
.github/workflows/
  weekly-update.yml      # a automação semanal
  publish-pages.yml      # publicação do site (opcional)
fetch-data.mjs           # orquestra a busca -> data.json
fetch-fertilizers.mjs    # ComexStat (ureia/MAP/KCl) + gas natural (EIA/stooq)
fetch-noticias.mjs       # noticias recentes de fertilizantes (Noticias Agricolas)
patch-dashboard.mjs      # injeta os valores no dashboard.html
build-report.mjs         # gera o relatório docx + pdf
build-email.mjs          # monta o corpo do e-mail (email-body.html)
run-weekly.mjs           # orquestra os três passos
check-status.mjs         # detecta falhas e monta o alerta (Issue)
fertilizers-override.json# valores manuais + rede de seguranca
data.json                # última leitura + variações (não editar à mão)
dashboard.html           # o dashboard
logo.png                 # logo usado no cabeçalho do relatório
data/
  formulated-prices-history.json  # histórico PÚBLICO de preços, sempre vazio (ver seção 10)
  private/                        # NÃO versionado (.gitignore) -- dados reais ficam aqui, local
schemas/
  formulated-price-history.schema.json  # contrato formal dos campos do histórico
formulated-price-history.mjs      # módulo: carrega, valida e normaliza o histórico
validate-formulated-history.mjs   # CLI: `npm run validate:formulated-history [caminho]`
test/
  formulated-price-history.test.mjs           # testes de campo/validação
  formulated-price-history.contract.test.mjs  # schema <-> JS sempre sincronizados
  formulated-price-history.cli.test.mjs       # testes do CLI via subprocesso
```

---

## 10. Base histórica de preços dos formulados

> Esta seção documenta uma base **separada** do restante do dashboard. Nada aqui é
> lido pela esteira semanal (`run-weekly.mjs`), pelo `dashboard.html` ou pelo
> relatório executivo — é uma etapa 1 de arquitetura, isolada de propósito.

### Objetivo

O restante deste projeto monitora **direcionadores de mercado** das matérias-primas
dos fertilizantes (ureia, MAP, KCl, câmbio, frete marítimo, gás natural). Mas a
empresa não compra essas matérias-primas isoladamente — ela compra **fertilizantes
formulados**, já misturados e granulados por fornecedores externos.

Esta base guarda o **histórico de preços efetivamente cotados ou comprados** desses
formulados, para no futuro ser comparado com o histórico dos direcionadores acima —
por exemplo, para estimar um índice de pressão de matérias-primas ou uma faixa
estimada de negociação. Nada disso está implementado ainda nesta etapa: só a
estrutura de dados, a validação e os testes.

### Preço da matéria-prima × preço do formulado — e por que não dá pra calcular o custo do fabricante

- O preço FOB de ureia/MAP/KCl que o dashboard já monitora é o preço **internacional
  da matéria-prima pura**, medido nas estatísticas de comércio exterior.
- O preço de um formulado é o preço **comercial final** cobrado pelo fornecedor por um
  produto já pronto (ex.: uma fórmula NPK 04-14-08), que embute — sem que a gente
  consiga separar — custos como beneficiamento, formulação, produção, mistura,
  granulação, embalagem, perdas industriais, margem comercial, custos administrativos
  e a composição detalhada de micronutrientes.
- **Não temos acesso a esses custos internos do fabricante.** Por isso este módulo
  não calcula, e não deve ser usado para calcular, o custo real de produção do
  formulado, o custo industrial do fornecedor, um "preço exato" do produto ou o custo
  real por hectare. Esses componentes ficam como uma **caixa-preta observável apenas
  pelo preço final** — o que a base registra é o preço praticado, não a composição de
  custo por trás dele.

### Campos disponíveis

| Campo | Presença física | Tipo / aceita `null` | Observação |
|---|---|---|---|
| `id` | **obrigatória** | texto, único, não vazio | chave do registro dentro da base |
| `dataCotacao` | **obrigatória** | data ISO `YYYY-MM-DD` | data em que o preço foi cotado/registrado |
| `dataCompra` | opcional (pode faltar) | data ISO ou `null` | preenchido só quando virou compra de fato |
| `anoReferencia` | **obrigatória** | inteiro de 4 dígitos | deve bater com o ano de `dataCotacao` |
| `produto` | **obrigatória** | texto | nome comercial ou interno do formulado |
| `formula` | opcional (pode faltar) | texto ou `null` | ex. `"04-14-08"`; ausente ou `null` quando desconhecida — nunca presumida a partir do nome comercial |
| `categoriaFormula` | opcional (pode faltar) | texto ou `null` | vocabulário aberto nesta etapa (ex.: plantio, manutenção, correção, formulação especial) |
| `fornecedor` | **obrigatória** | texto | nunca deve ser usado para inferir custo/margem do fornecedor |
| `preco` | **obrigatória** | número > 0 | preço comercial observado, na unidade de `unidadePreco` |
| `moeda` | **obrigatória** | `"BRL"` (por enquanto) | ver "Unidades" abaixo |
| `unidadePreco` | **obrigatória** | `"BRL_TON"` (por enquanto) | ver "Unidades" abaixo |
| `modalidadeEntrega` | **obrigatória** | enum (ver abaixo), nunca `null` | use `NAO_INFORMADO` quando desconhecida — não omitir |
| `destino` | opcional (pode faltar) | texto ou `null` | local de entrega, para comparações futuras |
| `volumeToneladas` | opcional (pode faltar) | número > 0 ou `null` | volume da cotação/compra |
| `prazoPagamentoDias` | opcional (pode faltar) | inteiro ≥ 0 ou `null` | |
| `validadeProposta` | opcional (pode faltar) | data ISO ou `null` | |
| `fonteRegistro` | **obrigatória** | enum (ver abaixo) | categoria da fonte — nunca o documento em si |
| `observacoes` | opcional (pode faltar) | texto ou `null` | texto livre, sem dados confidenciais |

**Só estes 17 campos são aceitos** — a base rejeita qualquer chave fora dessa lista,
tanto no envelope raiz (`schemaVersion`/`description`/`records`) quanto em cada
registro, com um erro do tipo `CAMPO_DESCONHECIDO` (ver "Como interpretar os erros").

Um campo **opcional** pode simplesmente não existir no objeto do registro, ou existir
com valor `null`, ou existir com um valor válido — as três formas são aceitas. Um
campo **obrigatório** precisa existir e ter um valor real (nunca `null`, nunca ausente).

O contrato completo e formal desses campos está em
[`schemas/formulated-price-history.schema.json`](schemas/formulated-price-history.schema.json)
(JSON Schema draft 2020-12) — os testes em
[`test/formulated-price-history.contract.test.mjs`](test/formulated-price-history.contract.test.mjs)
leem esse arquivo e comparam com as constantes do módulo JavaScript, para pegar
divergência entre os dois automaticamente.

### Unidades

- **Moeda (`moeda`):** só `BRL` é aceito nesta etapa. O campo existe como uma lista
  fechada (`MOEDAS_SUPORTADAS` em `formulated-price-history.mjs`) pensada para
  crescer no futuro — mas adicionar uma moeda nova **não** implica conversão cambial
  automática, que não está implementada.
- **Unidade de preço (`unidadePreco`):** só `BRL_TON` é aceito nesta etapa — reais
  por tonelada do formulado (não da matéria-prima).

### Modalidades de entrega

`FOB_FABRICA`, `CIF_DESTINO`, `RETIRADA`, `NAO_INFORMADO`.

> **Atenção:** este é o FOB **comercial do formulado** (retirada na fábrica do
> fornecedor), que **não é o mesmo conceito** do FOB internacional usado nos preços
> de ureia/MAP/KCl monitorados no resto do dashboard (FOB de exportação/importação
> nas estatísticas de comércio exterior). Não misture os dois.
>
> `CIF_DESTINO` e `FOB_FABRICA` também **não são diretamente comparáveis entre si**
> sem um ajuste logístico (frete, seguro) — um preço CIF mais alto que um FOB não
> significa necessariamente um produto mais caro na origem.

### Dados privados: este repositório é público

**Este repositório é público.** A base versionada em
`data/formulated-prices-history.json` **deve permanecer vazia** (`records: []`) —
ela existe só como estrutura, referência, prova de que a validação funciona e
fallback seguro. Preço, fornecedor, volume, condições de pagamento e destino são,
em geral, informação comercial confidencial da empresa, e **dados reais nunca devem
ser commitados** nesse arquivo nem em nenhum outro arquivo público deste repositório.

Para trabalhar com dados reais (fora desta etapa, quando essa necessidade surgir):

- Use um arquivo **local, fora do controle de versão**, no caminho recomendado
  `data/private/formulated-prices-history.private.json`. O `.gitignore` já protege
  esse caminho (`/data/private/` e `*.private.json`) — nada nele é versionado.
- Valide esse arquivo privado com o mesmo CLI, passando o caminho explicitamente
  (veja "Como executar a validação" abaixo). O validador nunca procura um arquivo
  privado sozinho, e nunca cai de volta na base pública se o caminho que você deu
  não existir — um caminho errado sempre vira erro, nunca um "sucesso" silencioso
  validando outra coisa.
- O CLI nunca imprime o conteúdo de um registro (preço, fornecedor, observações
  etc.) no console, mesmo ao validar um arquivo privado — só o tipo de erro, o
  índice, o `id` e o nome do campo. Ainda assim, **nunca copie a saída do CLI, nem
  o próprio arquivo privado, para um lugar público** (comentário de PR, corpo de
  Issue, artifact do GitHub Actions, log de CI) — trate a saída do terminal como
  parte do mesmo perímetro confidencial do arquivo que ela descreve.

**Se um dado real for commitado por engano:** apagar o arquivo (ou o trecho) num
commit posterior **não o remove do histórico do Git** — qualquer pessoa com acesso
ao repositório ainda consegue recuperá-lo por um commit antigo. Isso não se resolve
sozinho e não é algo que este projeto tenta consertar automaticamente: **nenhum
procedimento destrutivo de reescrita de histórico (rebase, filter-branch,
force-push, etc.) é executado por nenhum script daqui.** Se isso acontecer, acione
o processo de segurança e saneamento de histórico adotado pela sua organização
(geralmente envolve avaliar o alcance do vazamento e, se necessário, reescrever e
forçar a publicação de um histórico limpo sob coordenação de quem administra o
repositório) — não tente resolver sozinho com um novo commit "removendo" o dado.

### Como adicionar um registro

1. Edite `data/formulated-prices-history.json` e acrescente um objeto ao array
   `records`, preenchendo os campos obrigatórios (veja a tabela acima). Os campos
   opcionais podem ficar de fora do objeto por completo, ou como `null` — as duas
   formas são válidas; não é preciso escrever a chave se não há valor.
2. Rode a validação (abaixo) antes de commitar.
3. **Nunca** coloque neste arquivo público preço real, nome real de fornecedor,
   volume real, contrato, ou qualquer dado confidencial — veja "Dados privados"
   acima para onde esse tipo de dado deve ficar.

Exemplo — **EXEMPLO FICTÍCIO**, apenas ilustrativo, não é um dado real e não deve
ser copiado para a base:

```json
{
  "id": "EXEMPLO-FICTICIO-2026-001",
  "dataCotacao": "2026-03-10",
  "dataCompra": null,
  "anoReferencia": 2026,
  "produto": "Formulado Exemplo 04-14-08",
  "formula": "04-14-08",
  "categoriaFormula": "plantio",
  "fornecedor": "Fornecedor Exemplo Ltda (NÃO É UM FORNECEDOR REAL)",
  "preco": 3199.9,
  "moeda": "BRL",
  "unidadePreco": "BRL_TON",
  "modalidadeEntrega": "CIF_DESTINO",
  "destino": "Exemplo - TO",
  "volumeToneladas": 100,
  "prazoPagamentoDias": 30,
  "validadeProposta": "2026-03-20",
  "fonteRegistro": "COTACAO",
  "observacoes": "Registro de exemplo do README — não representa um preço real."
}
```

### Como executar a validação

```bash
npm run validate:formulated-history
```

Sem argumentos, valida sempre a base pública padrão
(`data/formulated-prices-history.json`). Para validar outro arquivo — por exemplo,
um arquivo privado em `data/private/` — passe o caminho explicitamente:

```bash
node validate-formulated-history.mjs caminho/para/arquivo.json
# ou, via npm (repare no "--"):
npm run validate:formulated-history -- caminho/para/arquivo.json
```

O comando:
1. carrega o arquivo pedido (a base pública, se nenhum caminho for informado; o
   caminho explícito, se um for informado — sem procurar nada por conta própria e
   sem cair de volta na base pública se o caminho não existir);
2. valida a estrutura raiz (`schemaVersion`, `description`, `records`, sem chaves
   desconhecidas);
3. valida cada registro (sem chaves desconhecidas) e detecta `id` duplicado;
4. informa quantos registros foram encontrados;
5. termina com **código 0** se a base for válida (inclusive uma base vazia — `records: []`
   é sempre válida) e com **código diferente de zero** se houver qualquer erro.

O CLI nunca imprime o conteúdo de um registro (preço, fornecedor, observações) —
só tipo de erro, índice, `id` e nome do campo (ver "Dados privados" acima).

Os testes automatizados rodam com:

```bash
npm test
```

Isso roda três arquivos: os testes de campo/validação
(`test/formulated-price-history.test.mjs`), os testes de sincronia entre o schema e
o JavaScript (`test/formulated-price-history.contract.test.mjs`) e os testes do CLI
via subprocesso (`test/formulated-price-history.cli.test.mjs`).

### Como interpretar os erros

Cada erro reportado tem um `type` (categoria), o índice e/ou `id` do registro, o
`field` afetado e uma mensagem em português. Os tipos possíveis:

| Tipo | Significado |
|---|---|
| `ESTRUTURAL` | problema no envelope raiz (`schemaVersion`, `description` ou `records` ausente/errado) |
| `CAMPO_DESCONHECIDO` | uma chave fora da lista de campos aceitos (na raiz ou num registro) |
| `CAMPO_OBRIGATORIO_AUSENTE` | um campo obrigatório não está presente (ou está vazio/`null`) |
| `DATA_INVALIDA` | data fora do formato `YYYY-MM-DD` ou que não existe no calendário |
| `UNIDADE_INVALIDA` | `unidadePreco` fora da lista aceita |
| `VALOR_INVALIDO` | valor de um campo fora da regra (ex.: preço ≤ 0, enum inválido) |
| `ID_DUPLICADO` | dois ou mais registros com o mesmo `id` |
| `ANO_INCONSISTENTE` | `anoReferencia` não bate com o ano de `dataCotacao` |
| `ARQUIVO_INEXISTENTE` | `data/formulated-prices-history.json` não foi encontrado |
| `JSON_INVALIDO` | o arquivo existe, mas não é um JSON válido |

Uma base **vazia** (`records: []`) nunca é um erro — é o estado inicial esperado.

### Boas práticas ao registrar preços

- **Não misture preços de formulações diferentes** (ex.: 04-14-08 com 08-20-20) numa
  mesma análise ou comparação — são produtos diferentes, com custo de matéria-prima
  diferente.
- **CIF destino e FOB fábrica não são diretamente comparáveis** sem ajuste logístico
  (ver seção "Modalidades de entrega" acima).
- **Distinga preço cotado de preço efetivamente comprado**: uma cotação
  (`dataCompra: null`) pode não se concretizar, ou fechar em condições diferentes da
  proposta original — por isso os campos `dataCotacao` e `dataCompra` são separados,
  e `fonteRegistro` indica se o registro veio de uma cotação, um pedido de compra,
  uma nota fiscal, um contrato ou um registro interno.
- **Nenhum dado confidencial** (preço real, fornecedor real, volume real, número de
  contrato, condições comerciais sigilosas) deve ir para este repositório público.
  Trate a base real com a mesma cautela que qualquer outro dado comercial sensível
  da empresa.
