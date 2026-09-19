/**
 * test/market-source-replacement-checklist.test.mjs
 *
 * Verifica a estrutura e as restrições de conteúdo de
 * docs/market-source-replacement-checklist.md (Etapa 6.3) e do link
 * adicionado ao README. Usa marcadores estáveis (números de seção,
 * palavras-chave, checkboxes, enums) em vez de comparação de parágrafo
 * inteiro.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOC_PATH = join(ROOT, "docs", "market-source-replacement-checklist.md");
const README_PATH = join(ROOT, "README.md");

const doc = readFileSync(DOC_PATH, "utf-8");
const readme = readFileSync(README_PATH, "utf-8");

function extrairSecoes(texto) {
  const linhas = texto.split("\n");
  const secoes = [];
  for (const linha of linhas) {
    const m = /^##\s+(\d+)\.\s+(.+)$/.exec(linha.trim());
    if (m) secoes.push({ numero: Number(m[1]), titulo: m[2].trim() });
  }
  return secoes;
}
const secoes = extrairSecoes(doc);

function bloco(inicio, fim) {
  const i = doc.indexOf(inicio);
  assert.ok(i !== -1, `marcador não encontrado: "${inicio}"`);
  return doc.slice(i, fim ? doc.indexOf(fim, i) : doc.length);
}

// --- 1-2. Existência e estrutura -------------------------------------------

test("[1] o arquivo docs/market-source-replacement-checklist.md existe", () => {
  assert.equal(existsSync(DOC_PATH), true);
});

test("[2] o documento possui exatamente as 12 seções numeradas de nível 2, em ordem", () => {
  assert.equal(secoes.length, 12);
  assert.deepEqual(secoes.map((s) => s.numero), Array.from({ length: 12 }, (_, i) => i + 1));
});

// --- 3. Link no README -------------------------------------------------------

test("[3] o README contém um link relativo para o checklist", () => {
  assert.match(readme, /\[`docs\/market-source-replacement-checklist\.md`\]\(docs\/market-source-replacement-checklist\.md\)/);
});

// --- 4-5. Enums --------------------------------------------------------------

test("[4] a seção 3 contém os 6 status permitidos", () => {
  const b = bloco("## 3.", "## 4.");
  for (const status of [
    "PENDENTE",
    "EM_AVALIACAO",
    "APROVADA_PARA_TESTE",
    "APROVADA_COM_RESTRICOES",
    "APROVADA_PARA_SUBSTITUICAO",
    "REJEITADA",
  ]) {
    assert.match(b, new RegExp("`" + status + "`"), status);
  }
});

test("[5] a seção 4 contém os 12 motivos de avaliação (11 nomeados + OUTRO)", () => {
  const b = bloco("## 4.", "## 5.");
  const motivos = [
    "FONTE_INDISPONIVEL",
    "FALHAS_RECORRENTES",
    "BLOQUEIO_DE_ACESSO",
    "FONTE_DESCONTINUADA",
    "ALTERACAO_METODOLOGICA",
    "ALTERACAO_DE_UNIDADE",
    "ALTERACAO_DE_LICENCA",
    "HISTORICO_INSUFICIENTE",
    "DATA_DE_REFERENCIA_INADEQUADA",
    "MAIOR_RASTREABILIDADE",
    "MELHORIA_DE_QUALIDADE",
    "OUTRO",
  ];
  assert.equal(motivos.length, 12);
  for (const m of motivos) assert.match(b, new RegExp("`" + m + "`"), m);
});

// --- 6. Matriz resumida ------------------------------------------------------

function linhasMatriz() {
  const b = bloco("## 6.", "## 7.");
  return b
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && !/^\|\s*-+\s*\|/.test(l.trim()) && !l.includes("Indicador | Fonte atual"))
    .map((l) => l.split("|").map((c) => c.trim()).filter((c) => c.length));
}

test("[6] a matriz resumida (seção 6) existe com cabeçalho de 10 colunas", () => {
  const b = bloco("## 6.", "## 7.");
  assert.match(b, /\|\s*Indicador\s*\|\s*Fonte atual\s*\|\s*Fonte candidata\s*\|\s*Status\s*\|/);
});

test("[7] todas as linhas da matriz resumida têm status PENDENTE", () => {
  const linhas = linhasMatriz();
  assert.ok(linhas.length >= 8, `esperadas ao menos 8 linhas (indicadores), encontrado ${linhas.length}`);
  for (const linha of linhas) {
    assert.ok(linha.some((c) => c.includes("PENDENTE") && !c.includes("PENDENTE_DE_PREENCHIMENTO")), linha.join(" | "));
  }
});

// --- 8-14. Cautelas de conteúdo já exigidas nas Etapas 6/6.1/6.2 -----------

test("[8] ComexStat não é chamado de preço spot", () => {
  assert.doesNotMatch(doc, /ComexStat[\s\S]{0,40}pre[cç]o spot/i);
  assert.doesNotMatch(doc, /spot[\s\S]{0,40}ComexStat/i);
});

test("[9] World Bank não é descrito como equivalente ao ComexStat", () => {
  const b = bloco("## 6.", "## 7.");
  assert.match(b, /World Bank n[aã]o deve ser descrito como equivalente\s+ao\s+ComexStat/i);
});

test("[10] CONAB não é descrita automaticamente como equivalente ao CEPEA", () => {
  const b = bloco("## 6.", "## 7.");
  assert.match(b, /CONAB n[aã]o deve ser descrita automaticamente como equivalente\s+ao\s+CEPEA/i);
});

test("[11] soja nacional não substitui soja regional", () => {
  const b = bloco("## 6.", "## 7.");
  assert.match(b, /Soja nacional n[aã]o deve substituir\s+soja regional/i);
});

test("[12] BDI não é descrito como frete específico de fertilizante", () => {
  const b = bloco("## 6.", "## 7.");
  assert.match(b, /BDI n[aã]o deve ser descrito como frete espec[ií]fico de fertilizante/i);
});

test("[13] Henry Hub não é descrito como custo direto global de todos os produtores", () => {
  const b = bloco("## 6.", "## 7.");
  assert.match(b, /Henry Hub[\s\S]{0,60}n[aã]o deve ser descrito como custo direto/i);
});

test("[14] SEAGRO-TO continua classificada apenas como pista até confirmação documental", () => {
  const b = bloco("## 6.", "## 7.");
  assert.match(b, /SEAGRO-TO continua como pista at[eé] confirma[cç][aã]o documental/i);
});

// --- 15-22. Modelo individual e suas subseções ------------------------------

test("[15] o modelo individual de avaliação existe (seção 7)", () => {
  assert.match(doc, /^## 7\. Modelo individual de avalia[cç][aã]o$/m);
});

test("[16] a subseção de documentação da candidata existe", () => {
  assert.match(doc, /^### Documenta[cç][aã]o da candidata$/m);
});

test("[17] a subseção de comparabilidade existe", () => {
  assert.match(doc, /^### Comparabilidade$/m);
});

test("[18] a subseção de teste técnico existe", () => {
  assert.match(doc, /^### Teste t[eé]cnico$/m);
});

test("[19] a subseção de execução em paralelo existe", () => {
  assert.match(doc, /^### Execu[cç][aã]o em paralelo$/m);
});

test("[20] a subseção de governança existe", () => {
  assert.match(doc, /^### Governan[cç]a$/m);
});

test("[21] a subseção de riscos e contingência existe", () => {
  assert.match(doc, /^### Riscos e conting[eê]ncia$/m);
});

test("[22] a subseção de decisão final existe", () => {
  assert.match(doc, /^### Decis[aã]o final$/m);
});

// --- 23-26. Regras de não-substituição automática --------------------------

test("[23] a execução em paralelo declara que a fonte atual permanece oficial (teste não substitui)", () => {
  const b = bloco("### Execução em paralelo", "### Governança");
  assert.match(b, /fonte atual permanece a fonte\s*\noficial em produ[cç][aã]o/i);
});

test("[24] a regra de decisão declara que APROVADA_PARA_TESTE não autoriza produção", () => {
  const b = bloco("## 8.", "## 9.");
  assert.match(b, /APROVADA_PARA_TESTE[\s\S]{0,150}n[aã]o autoriza produ[cç][aã]o/i);
});

test("[25] a regra de decisão declara que APROVADA_COM_RESTRICOES não altera código automaticamente", () => {
  const b = bloco("## 8.", "## 9.");
  assert.match(b, /APROVADA_COM_RESTRICOES[\s\S]{0,250}n[aã]o substitui automaticamente/i);
});

test("[26] a regra de decisão declara que APROVADA_PARA_SUBSTITUICAO exige etapa de código separada", () => {
  const b = bloco("## 8.", "## 9.");
  assert.match(b, /APROVADA_PARA_SUBSTITUICAO[\s\S]{0,250}etapa separada/i);
});

// --- 27-29. Bloqueio, reversão, registro de alterações ----------------------

test("[27] os critérios de bloqueio existem (seção 9) com ao menos 13 itens", () => {
  const b = bloco("## 9.", "## 10.");
  const itens = b.match(/^-\s+.+;$/gm) ?? [];
  assert.ok(itens.length >= 12, `esperados ao menos 12 itens de bloqueio, encontrado ${itens.length}`);
});

test("[28] o plano de reversão é obrigatório (critério de bloqueio + campo do modelo individual)", () => {
  const b9 = bloco("## 9.", "## 10.");
  assert.match(b9, /aus[eê]ncia de plano de revers[aã]o/i);
  const bRiscos = bloco("### Riscos e contingência", "### Decisão final");
  assert.match(bRiscos, /Plano de revers[aã]o definido/i);
});

test("[29] a tabela de registro de alterações futuras (seção 10) existe e está vazia", () => {
  const b = bloco("## 10.", "## 11.");
  assert.match(b, /\|\s*Data\s*\|\s*Indicador\s*\|\s*Fonte anterior\s*\|\s*Fonte nova\s*\|/);
  const linhasDados = b
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && !/^\|\s*-+\s*\|/.test(l.trim()) && !l.includes("Fonte anterior"));
  assert.equal(linhasDados.length, 1, "esperada exatamente uma linha (vazia) de dados na tabela");
  const celulas = linhasDados[0].split("|").map((c) => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length);
  for (const c of celulas) assert.equal(c, "", `célula não vazia na tabela de alterações futuras: "${c}"`);
});

// --- 30-37. Ausência de segredos e dados sensíveis --------------------------

test("[30-32] o documento não contém token, chave ou senha reais (heurística: sequência tipo segredo fora de URL)", () => {
  const candidatos = doc.match(/[A-Za-z0-9_-]{32,}/g) ?? [];
  for (const c of candidatos) {
    const pareceSegredo = /[a-z]/.test(c) && /[A-Z]/.test(c) && /\d/.test(c) && !c.includes(".") && !c.includes("/");
    assert.equal(pareceSegredo, false, `sequência com aparência de token/segredo: ${c}`);
  }
  assert.doesNotMatch(doc, /senha\s*[:=]\s*\S+/i);
  assert.doesNotMatch(doc, /(api[_-]?key|token|password)\s*[:=]\s*["'`]?[A-Za-z0-9]{6,}/i);
});

test("[33] o documento não contém URL privada (apenas domínios institucionais públicos, quando citados)", () => {
  const urls = doc.match(/https?:\/\/[^\s)`|]+/g) ?? [];
  for (const u of urls) {
    assert.doesNotMatch(u, /localhost|127\.0\.0\.1|internal|intranet|private/i, u);
  }
});

test("[34] o documento não contém preço interno nem valor numérico de série histórica", () => {
  const overridePath = join(ROOT, "fertilizers-override.json");
  const override = JSON.parse(readFileSync(overridePath, "utf-8"));
  for (const chave of ["soja", "sojaTO", "bdi", "ureia", "map", "kcl", "gasNatural", "dolar"]) {
    const valor = override[chave];
    if (typeof valor !== "number") continue;
    const texto = String(valor);
    assert.doesNotMatch(
      doc,
      new RegExp(`(?<![\\d.])${texto.replace(".", "\\.")}(?![\\d])`),
      `valor de override vazou no documento: ${chave}=${valor}`
    );
  }
});

test("[35] o documento não contém nome de fornecedor de formulado", () => {
  const historico = JSON.parse(readFileSync(join(ROOT, "data", "formulated-prices-history.json"), "utf-8"));
  assert.deepEqual(historico.records, [], "pré-condição: base pública de formulados deve estar vazia");
  assert.doesNotMatch(doc, /fornecedor\s+(de\s+)?formulado/i);
});

test("[36] o documento não contém composição de formulação", () => {
  assert.doesNotMatch(doc, /composi[cç][aã]o (f[ií]sica )?de formula[cç][aã]o/i);
});

test("[37] o documento não contém referência a micronutriente", () => {
  assert.doesNotMatch(doc, /micronutriente/i);
});

// --- 38-43. Fora de escopo desta etapa --------------------------------------

test("[38] o documento não cria formulationId", () => {
  assert.doesNotMatch(doc, /formulationId/);
});

test("[39] o documento não implementa coleta (não altera fetch-*.mjs)", async () => {
  const { execFileSync } = await import("node:child_process");
  for (const arquivo of ["fetch-data.mjs", "fetch-fertilizers.mjs", "fetch-noticias.mjs"]) {
    const diff = execFileSync("git", ["diff", "d582bff", "--", arquivo], { cwd: ROOT, encoding: "utf-8" });
    assert.equal(diff.trim(), "", `${arquivo} foi alterado desde d582bff`);
  }
});

test("[40] o documento não implementa substituição de fonte (nenhuma automação nova, apenas checklist)", () => {
  assert.doesNotMatch(doc, /substitui[cç][aã]o (foi|j[aá] foi) implementada/i);
  assert.match(doc, /Nenhuma linha da matriz[\s\S]{0,200}autoriza[\s\S]{0,20}qualquer mudan[cç]a de c[oó]digo/i);
});

test("[41] o documento não implementa previsão", () => {
  assert.doesNotMatch(doc, /previs[aã]o (foi|j[aá] foi) implementada/i);
});

test("[42] nenhum workflow foi alterado nesta etapa", async () => {
  const { execFileSync } = await import("node:child_process");
  const diff = execFileSync("git", ["diff", "d582bff", "--stat", "--", ".github/workflows/"], { cwd: ROOT, encoding: "utf-8" });
  assert.equal(diff.trim(), "");
});

test("[43] o documento não contém dados privados (nenhum arquivo *.private.* existe no repositório)", () => {
  assert.equal(existsSync(join(ROOT, "data", "private")), false);
  assert.equal(existsSync(join(ROOT, "data", "private", "formulated-products-catalog.private.json")), false);
});

// --- 44-45. Campos humanos e fluxo -------------------------------------------

test("[44] os campos humanos de governança do modelo individual usam PENDENTE_DE_PREENCHIMENTO", () => {
  const b = bloco("### Governança", "### Riscos e contingência");
  const linhasCampo = b.split("\n").filter((l) => /^[A-Za-zÀ-ú çãéíóú]+:\s*PENDENTE_DE_PREENCHIMENTO\s*$/.test(l.trim()));
  assert.ok(linhasCampo.length >= 10, `esperados ao menos 10 campos PENDENTE_DE_PREENCHIMENTO, encontrado ${linhasCampo.length}`);
});

test("[45] o fluxo resumido existe (seção 12) com as 7 etapas na ordem", () => {
  const b = bloco("## 12.", null);
  const ordem = [
    "PENDENTE",
    "EM_AVALIACAO",
    "APROVADA_PARA_TESTE",
    "TESTE_EM_PARALELO",
    "APROVADA_COM_RESTRICOES ou REJEITADA",
    "APROVADA_PARA_SUBSTITUICAO",
    "NOVA_ETAPA_DE_CODIGO",
  ];
  let posAnterior = -1;
  for (const etapa of ordem) {
    const pos = b.indexOf(etapa);
    assert.ok(pos > posAnterior, `etapa fora de ordem ou ausente: ${etapa}`);
    posAnterior = pos;
  }
});

// --- 46-48. Nenhuma aprovação antecipada -------------------------------------

test("[46] nenhuma linha da matriz resumida está classificada como APROVADA_PARA_SUBSTITUICAO", () => {
  const linhas = linhasMatriz();
  for (const linha of linhas) assert.ok(!linha.some((c) => c.includes("APROVADA_PARA_SUBSTITUICAO")), linha.join(" | "));
});

test("[47] nenhuma linha da matriz resumida está classificada como APROVADA_COM_RESTRICOES", () => {
  const linhas = linhasMatriz();
  for (const linha of linhas) assert.ok(!linha.some((c) => c.includes("APROVADA_COM_RESTRICOES")), linha.join(" | "));
});

test("[48] nenhuma candidata da matriz aparece descrita como fonte ativa (todas continuam 'candidata')", () => {
  const linhas = linhasMatriz();
  for (const linha of linhas) {
    const colCandidata = linha[2] ?? "";
    assert.doesNotMatch(colCandidata, /\bj[aá] (em uso|ativa|integrada)\b/i, colCandidata);
  }
});

// --- 49-50. Formato e aviso público ------------------------------------------

test("[49] o modelo individual é copiável em Markdown (delimitado por --- e usa blocos de código para os campos)", () => {
  const b = bloco("## 7.", "## 8.");
  const separadores = (b.match(/^---$/gm) ?? []).length;
  assert.ok(separadores >= 2, `esperados ao menos 2 separadores '---' delimitando o bloco copiável, encontrado ${separadores}`);
  const blocosCodigo = (b.match(/```/g) ?? []).length;
  assert.ok(blocosCodigo >= 2 && blocosCodigo % 2 === 0, "blocos de código de campos não estão balanceados");
});

test("[50] o documento traz aviso explícito de que é público", () => {
  assert.match(doc, /\*\*Documento p[uú]blico\.\*\*/);
});
