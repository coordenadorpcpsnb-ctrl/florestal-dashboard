# Dashboard & Relatório de Inteligência Florestal — Automação Semanal

Automação que roda **toda segunda-feira às 07:00 (horário de Brasília)** no GitHub Actions:

1. **Busca** os indicadores macro (câmbio, soja, diesel, BDI)
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

## 4. Publicar o dashboard como site (opcional)

O arquivo `.github/workflows/publish-pages.yml` publica o dashboard numa URL
(ex.: `https://seu-usuario.github.io/florestal-dashboard`), sempre com os dados
mais recentes — prático para compartilhar com a equipe.

**Para ativar:** Settings → Pages → *Build and deployment* → Source: **GitHub Actions**
**Para desativar:** apague esse arquivo.

> Atenção: se o repositório for **público**, o site fica **acessível a qualquer pessoa**.
> Páginas privadas exigem plano GitHub Enterprise.

---

## 5. Fontes dos dados e o que ainda é manual

Quase tudo é buscado automaticamente. A tabela abaixo mostra a origem de cada indicador:

| Indicador | Fonte automática | Frequência |
|---|---|---|
| Dólar | AwesomeAPI | tempo real |
| Soja CEPEA | CEPEA/ESALQ (scraping) | diária |
| Diesel S10 | ANP (scraping) | semanal |
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

## 6. Ajustes comuns

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

## 7. Limites e cuidados (importante)

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

## 8. Estrutura dos arquivos

```
.github/workflows/
  weekly-update.yml      # a automação semanal
  publish-pages.yml      # publicação do site (opcional)
fetch-data.mjs           # orquestra a busca -> data.json
fetch-fertilizers.mjs    # ComexStat (ureia/MAP/KCl) + gas natural (EIA/stooq)
patch-dashboard.mjs      # injeta os valores no dashboard.html
build-report.mjs         # gera o relatório docx + pdf
run-weekly.mjs           # orquestra os três passos
check-status.mjs         # detecta falhas e monta o alerta (Issue)
fertilizers-override.json# valores manuais + rede de seguranca
data.json                # última leitura + variações (não editar à mão)
dashboard.html           # o dashboard
logo.png                 # logo usado no cabeçalho do relatório
```
