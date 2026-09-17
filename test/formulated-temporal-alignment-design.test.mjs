/**
 * test/formulated-temporal-alignment-design.test.mjs — Teste documental leve
 * (Etapa 4) para docs/formulated-temporal-alignment-design.md.
 *
 * Esta etapa e so diagnostico/desenho -- nao ha modulo novo para testar, so um
 * documento. Os testes aqui verificam presenca estrutural e ausencia de
 * conteudo proibido (caminho absoluto, usuario, segredos, dados privados),
 * usando marcadores estaveis (titulos de secao, termos especificos) -- nunca
 * comparacao de texto longo exato, que quebraria a cada edicao editorial do
 * documento.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const DOC_PATH = join(REPO_ROOT, "docs", "formulated-temporal-alignment-design.md");
const README_PATH = join(REPO_ROOT, "README.md");

// === 1. o arquivo de desenho existe ===
test("docs/formulated-temporal-alignment-design.md existe", () => {
  assert.equal(existsSync(DOC_PATH), true);
});

const doc = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, "utf-8") : "";

// === 2. as 20 secoes obrigatorias existem ===
test("documento tem as 20 secoes numeradas obrigatorias (## 1. a ## 20.)", () => {
  for (let i = 1; i <= 20; i++) {
    const re = new RegExp(`^## ${i}\\. `, "m");
    assert.match(doc, re, `secao ## ${i}. nao encontrada`);
  }
});

// === 3. nao contem caminho absoluto comum ===
test("documento nao contem caminho absoluto do checkout (/home/... ou /root/...)", () => {
  assert.doesNotMatch(doc, /\/home\/[^\s`)]+/);
  assert.doesNotMatch(doc, /\/root\/[^\s`)]+/);
});

// === 4. nao contem nome de usuario do ambiente ===
test("documento nao contem usuario do sistema (whoami) nem HOME do ambiente", () => {
  // nomes tipicos de usuario que apareceriam se alguem colasse um caminho local
  assert.doesNotMatch(doc, /\bC:\\Users\\/i);
  if (process.env.USER) {
    assert.doesNotMatch(doc, new RegExp(`\\b${process.env.USER}\\b`));
  }
});

// === 5. nao contem marcadores de segredo ===
test("documento nao contem valores de chave/token/segredo (so nomes de variavel publicos, ex. EIA_API_KEY)", () => {
  // aceita citar o NOME da variavel de ambiente (ja documentado no README), mas
  // nunca um valor no formato de chave/token real
  assert.doesNotMatch(doc, /(?:api[_-]?key|token|secret|senha|password)\s*[:=]\s*["'`]?[A-Za-z0-9_\-]{12,}/i);
  assert.doesNotMatch(doc, /AKIA[0-9A-Z]{16}/); // padrao de access key AWS, por precaucao
});

// === 6. nao contem fornecedor ficticio sensivel dos testes anteriores ===
test("documento nao contem os marcadores sensiveis ficticios usados nos testes das Etapas 1-3", () => {
  for (const marcador of [
    "PRODUTO_SIGILOSO_FICTICIO",
    "FORNECEDOR_SIGILOSO_FICTICIO",
    "DESTINO_SIGILOSO_FICTICIO",
    "OBSERVACAO_SIGILOSA_FICTICIA",
    "Fornecedor Ficticio",
    "FORNECEDOR-SIGILOSO",
  ]) {
    assert.doesNotMatch(doc, new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

// === 7. nao contem precos de formulados ===
test("documento nao contem a chave 'preco' de registro de formulado nem tabela de valores de mercado atuais", () => {
  assert.doesNotMatch(doc, /"preco"\s*:/);
  // valores atuais conhecidos de data.json na data desta etapa nao devem estar copiados
  assert.doesNotMatch(doc, /412[.,]8|834[.,]3|153[.,]59/);
});

// === 8. nao contem linguagem afirmando que ja existe previsao ===
test("documento nao afirma que ja calcula previsao, recomendacao de compra ou custo industrial", () => {
  assert.doesNotMatch(doc, /este documento (calcula|prev[êe]|recomenda)/i);
  assert.doesNotMatch(doc, /j[áa] implementa (a )?previs[ãa]o/i);
  assert.doesNotMatch(doc, /j[áa] calcula(mos)? (o )?custo industrial/i);
});

// === 9. README contem link relativo correto ===
test("README.md referencia docs/formulated-temporal-alignment-design.md com link relativo", () => {
  const readme = readFileSync(README_PATH, "utf-8");
  assert.match(readme, /\(docs\/formulated-temporal-alignment-design\.md\)/);
});

// === 10. documento distingue commitDate, collectedAt e referenceDate ===
test("documento distingue os conceitos commitDate / collectedAt / referencePeriod", () => {
  assert.match(doc, /collectedAt/);
  assert.match(doc, /referencePeriod/);
  assert.match(doc, /commitDate/);
});

// === 11. documento menciona look-ahead bias ===
test("documento menciona look-ahead bias", () => {
  assert.match(doc, /look-ahead bias/i);
});

// === 12. documento menciona pseudorreplicacao ===
test("documento menciona pseudorreplicacao (secao dedicada)", () => {
  assert.match(doc, /## 15\. Pseudorreplica[çc][ãa]o/);
  assert.match(doc, /pseudorreplica[çc][ãa]o/i);
});

// === 13. documento define T0, T-1, T-2 e T-3 ===
test("documento define os candidatos de janela T0, T-1, T-2 e T-3", () => {
  assert.match(doc, /\bT0\b/);
  assert.match(doc, /T-1/);
  assert.match(doc, /T-2/);
  assert.match(doc, /T-3/);
});

// === 14. documento nao seleciona automaticamente uma janela vencedora ===
test("documento explicita que nenhuma janela foi escolhida como vencedora", () => {
  assert.match(doc, /nenhum(a)? (escolhid[ao]|resolvid[ao])/i);
});

// === 15. documento registra as contagens calculadas com definicao explicita ===
test("documento tem uma tabela de contagens da auditoria Git com definicao explicita de cada uma", () => {
  assert.match(doc, /## 6\. Auditoria do hist[óo]rico Git/);
  assert.match(doc, /Commits que tocaram `data\.json`/);
  assert.match(doc, /Snapshots \(blobs\) de `data\.json`/);
  assert.match(doc, /N[uú]mero de observa[çc][õo]es utiliz[áa]veis/i);
});

// === verificacoes adicionais de escopo/seguranca desta etapa ===

test("documento nao contem um caminho absoluto de arquivo privado real (so a convencao generica *.private.json, ja publica no README, e permitida)", () => {
  // a convencao data/private/*.private.json ja e documentada publicamente (README 10-11);
  // o que nao pode aparecer e um caminho ABSOLUTO apontando para dentro dela
  assert.doesNotMatch(doc, /\/[\w./-]*data\/private\/[\w./-]*\.private\.json/);
});

test("documento reafirma os limites do principio de negocio (sem custo industrial, sem previsao)", () => {
  assert.match(doc, /custo industrial/i);
  assert.match(doc, /previs[ãa]o/i);
});

test("script de auditoria auxiliar nao foi commitado ao repositorio", () => {
  assert.doesNotMatch(doc, /audit-data-json\.mjs["'`]?\s*(?:foi commitado|adicionado ao repositorio)/i);
});
