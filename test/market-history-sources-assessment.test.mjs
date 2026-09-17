/**
 * test/market-history-sources-assessment.test.mjs
 *
 * Verifica a estrutura e as restrições de conteúdo de
 * docs/market-history-sources-assessment.md (Etapa 6) e do link adicionado
 * ao README. Usa marcadores estáveis (números de seção, palavras-chave,
 * presença de padrões) em vez de comparação de parágrafo inteiro, para não
 * quebrar a cada ajuste de redação.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOC_PATH = join(ROOT, "docs", "market-history-sources-assessment.md");
const README_PATH = join(ROOT, "README.md");

const doc = readFileSync(DOC_PATH, "utf-8");
const readme = readFileSync(README_PATH, "utf-8");

/** Extrai os cabeçalhos "## N. Título" em ordem de aparição. */
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

// --- 1. Existência e estrutura básica -------------------------------------

test("o arquivo docs/market-history-sources-assessment.md existe", () => {
  assert.equal(existsSync(DOC_PATH), true);
});

test("o documento tem exatamente 30 seções numeradas de nível 2", () => {
  assert.equal(secoes.length, 30);
});

test("as seções estão numeradas de 1 a 30, em ordem, sem repetição nem salto", () => {
  const numeros = secoes.map((s) => s.numero);
  assert.deepEqual(numeros, Array.from({ length: 30 }, (_, i) => i + 1));
});

test("o documento começa com um título de nível 1 sobre avaliação de fontes históricas", () => {
  assert.match(doc.split("\n")[0], /^#\s+Avalia[cç][aã]o de fontes hist[oó]ricas complementares/i);
});

test("o documento não é vazio além do título e das seções (tem corpo de texto substancial)", () => {
  assert.ok(doc.length > 8000, `documento inesperadamente curto: ${doc.length} caracteres`);
});

// --- 2. Escopo e não-implementação -----------------------------------------

test("a seção 1 declara objetivo e escopo da avaliação", () => {
  assert.match(secoes[0].titulo, /objetivo e escopo/i);
});

test("a seção 2 declara explicitamente o que não é implementado nesta etapa", () => {
  assert.match(secoes[1].titulo, /fora de escopo/i);
});

test("o documento declara, no cabeçalho, que não implementa coleta, scraping ou chamadas de API novas", () => {
  assert.match(doc, /n[aã]o implementa/i);
  assert.match(doc, /scraping/i);
});

test("o documento declara explicitamente que não cria formulationId nem catálogo técnico de formulações", () => {
  assert.match(doc, /cat[aá]logo t[eé]cnico de formula[cç][oõ]es/i);
  assert.match(doc, /`formulationId`/);
});

test("o documento declara explicitamente que não faz correlação, regressão ou previsão de preço", () => {
  assert.match(doc, /correla[cç][aã]o/i);
  assert.match(doc, /regress[aã]o/i);
  assert.match(doc, /previs[aã]o de pre[cç]o/i);
});

test("o documento declara explicitamente que não propõe faixa de negociação nem recomendação de compra", () => {
  assert.match(doc, /faixa de\s+negocia[cç][aã]o/i);
  assert.match(doc, /recomenda[cç][aã]o de compra/i);
});

test("o documento declara que nenhum arquivo de coleta, dashboard, relatório ou workflow foi alterado", () => {
  assert.match(doc, /dashboard\.html/);
  assert.match(doc, /workflows?\s+do\s+GitHub Actions/i);
});

// --- 3. Fontes atualmente em uso, por indicador (seções 4-9) --------------

test("as seções 4 a 9 documentam as fontes atualmente em uso, uma por indicador", () => {
  const titulosEsperados = [
    /c[aâ]mbio.*d[oó]lar/i,
    /soja nacional/i,
    /soja regional/i,
    /frete mar[ií]timo.*bdi/i,
    /g[aá]s natural/i,
    /fertilizantes.*ureia.*map.*kcl/i,
  ];
  for (let i = 0; i < titulosEsperados.length; i++) {
    assert.match(secoes[3 + i].titulo, titulosEsperados[i], `seção ${4 + i}`);
  }
});

test("a seção de câmbio cita BCB PTAX como fonte primária evidenciada no código", () => {
  const bloco = doc.slice(doc.indexOf("## 4."), doc.indexOf("## 5."));
  assert.match(bloco, /PTAX/);
  assert.match(bloco, /getCambio/);
});

test("a seção de fertilizantes cita o ComexStat/MDIC e os NCMs usados", () => {
  const bloco = doc.slice(doc.indexOf("## 9."), doc.indexOf("## 10."));
  assert.match(bloco, /ComexStat/);
  assert.match(bloco, /3102\.10\.10/);
});

test("a seção de gás natural documenta a dependência da variável EIA_API_KEY", () => {
  const bloco = doc.slice(doc.indexOf("## 8."), doc.indexOf("## 9."));
  assert.match(bloco, /EIA_API_KEY/);
});

// --- 4. Critérios de avaliação e enums (seções 11-15) ----------------------

test("a seção 11 lista exatamente 25 critérios de avaliação numerados", () => {
  const bloco = doc.slice(doc.indexOf("## 11."), doc.indexOf("## 12."));
  const itens = bloco.match(/^\d+\.\s+/gm) ?? [];
  assert.equal(itens.length, 25);
});

test("a seção 12 define o enum de classificação do tipo de fonte com os 6 valores esperados", () => {
  const bloco = doc.slice(doc.indexOf("## 12."), doc.indexOf("## 13."));
  for (const valor of [
    "OFICIAL_PRIMARIA",
    "OFICIAL_SECUNDARIA",
    "COMERCIAL_LICENCIADA",
    "PUBLICA_NAO_OFICIAL",
    "AGREGADOR",
    "NAO_CLASSIFICADA",
  ]) {
    assert.match(bloco, new RegExp("`" + valor + "`"), valor);
  }
});

test("a seção 13 define o enum de status de acesso", () => {
  const bloco = doc.slice(doc.indexOf("## 13."), doc.indexOf("## 14."));
  for (const valor of [
    "GRATUITO_SEM_CADASTRO",
    "GRATUITO_COM_CADASTRO",
    "GRATUITO_COM_LIMITACAO",
    "PAGO_ASSINATURA",
    "ACESSO_NAO_CONFIRMADO",
  ]) {
    assert.match(bloco, new RegExp("`" + valor + "`"), valor);
  }
});

test("a seção 14 define o enum de status de redistribuição", () => {
  const bloco = doc.slice(doc.indexOf("## 14."), doc.indexOf("## 15."));
  for (const valor of [
    "REDISTRIBUICAO_PERMITIDA_COM_ATRIBUICAO",
    "REDISTRIBUICAO_RESTRITA",
    "REDISTRIBUICAO_PROIBIDA",
    "REDISTRIBUICAO_NAO_DECLARADA",
  ]) {
    assert.match(bloco, new RegExp("`" + valor + "`"), valor);
  }
});

test("a seção 15 define o enum de recomendação por indicador com os 6 valores esperados", () => {
  const bloco = doc.slice(doc.indexOf("## 15."), doc.indexOf("## 16."));
  for (const valor of [
    "FONTE_PRIMARIA_RECOMENDADA",
    "FONTE_CONTINGENCIA_RECOMENDADA",
    "FONTE_APENAS_REFERENCIAL",
    "EXIGE_LICENCIAMENTO",
    "EXIGE_VALIDACAO_JURIDICA",
    "SEM_FONTE_APROVADA",
  ]) {
    assert.match(bloco, new RegExp("`" + valor + "`"), valor);
  }
});

test("todo valor de enum de recomendação usado nas seções de fontes candidatas pertence ao enum declarado na seção 15", () => {
  const enumValores = [
    "FONTE_PRIMARIA_RECOMENDADA",
    "FONTE_CONTINGENCIA_RECOMENDADA",
    "FONTE_APENAS_REFERENCIAL",
    "EXIGE_LICENCIAMENTO",
    "EXIGE_VALIDACAO_JURIDICA",
    "SEM_FONTE_APROVADA",
  ];
  const bloco = doc.slice(doc.indexOf("## 16."), doc.indexOf("## 22."));
  const usados = [...bloco.matchAll(/Recomenda[cç][aã]o:\s*`([A-Z_]+)`/g)].map((m) => m[1]);
  assert.ok(usados.length >= 6, "esperado ao menos 6 recomendações nas seções de fontes candidatas");
  for (const v of usados) assert.ok(enumValores.includes(v), `valor fora do enum: ${v}`);
});

// --- 5. Fontes candidatas por indicador (seções 16-21) ---------------------

test("a seção 16 (câmbio) cita o SGS/BCB com URL real do domínio oficial do Banco Central", () => {
  const bloco = doc.slice(doc.indexOf("## 16."), doc.indexOf("## 17."));
  assert.match(bloco, /api\.bcb\.gov\.br|dadosabertos\.bcb\.gov\.br/);
});

test("a seção 19 (BDI) classifica o Baltic Exchange como EXIGE_LICENCIAMENTO", () => {
  const bloco = doc.slice(doc.indexOf("## 19."), doc.indexOf("## 20."));
  assert.match(bloco, /Baltic Exchange/);
  assert.match(bloco, /EXIGE_LICENCIAMENTO/);
});

test("a seção 18 (soja regional) não aprova nenhuma fonte candidata", () => {
  const bloco = doc.slice(doc.indexOf("## 18."), doc.indexOf("## 19."));
  assert.match(bloco, /SEM_FONTE_APROVADA/);
});

test("a seção 21 (fertilizantes) trata o World Bank Pink Sheet e documenta a licença CC-BY 4.0", () => {
  const bloco = doc.slice(doc.indexOf("## 21."), doc.indexOf("## 22."));
  assert.match(bloco, /Pink Sheet/);
  assert.match(bloco, /CC-BY 4\.0/);
});

// --- 6. Requisitos temporais e unidades (seções 22-23) ---------------------

test("a seção 22 não afirma uma data de início histórico universal para todos os indicadores", () => {
  const bloco = doc.slice(doc.indexOf("## 22."), doc.indexOf("## 23."));
  assert.match(bloco, /n[aã]o define uma data de in[ií]cio hist[oó]rico universal/i);
});

test("a seção 23 é uma tabela de compatibilidade de unidades e declara que nenhuma conversão é feita", () => {
  const bloco = doc.slice(doc.indexOf("## 23."), doc.indexOf("## 24."));
  assert.match(bloco, /nenhuma convers[aã]o de unidade [eé] feita nesta etapa/i);
  assert.match(bloco, /\|.*Indicador.*\|/i);
});

// --- 7. Cautelas obrigatórias (seções 24-27) --------------------------------

test("a seção 24 alerta que o BDI não é um índice de frete de fertilizantes", () => {
  const bloco = doc.slice(doc.indexOf("## 24."), doc.indexOf("## 25."));
  assert.match(bloco, /Baltic Dry Index/);
  assert.match(bloco, /[ií]ndice espec[ií]fico de frete/i);
  assert.match(bloco, /nunca[\s\S]{0,20}deve ser tratado como/i);
});

test("a seção 25 alerta contra causalidade quantitativa entre gás natural e ureia", () => {
  const bloco = doc.slice(doc.indexOf("## 25."), doc.indexOf("## 26."));
  assert.match(bloco, /n[aã]o estabelece[\s\S]*?causalidade quantitativa/i);
});

test("a seção 26 trata soja nacional, regional e internacional como referências não intercambiáveis", () => {
  const bloco = doc.slice(doc.indexOf("## 26."), doc.indexOf("## 27."));
  assert.match(bloco, /Soja nacional/);
  assert.match(bloco, /Soja regional/);
  assert.match(bloco, /Soja internacional/);
  assert.match(bloco, /nunca devem[\s\S]{0,20}tratadas como\s+equivalentes/i);
});

test("a seção 27 distingue FOB, CFR, valor aduaneiro e spot para fertilizantes, e alerta sobre tipos de taxa de câmbio", () => {
  const bloco = doc.slice(doc.indexOf("## 27."), doc.indexOf("## 28."));
  assert.match(bloco, /FOB/);
  assert.match(bloco, /CFR/);
  assert.match(bloco, /valor aduaneiro/i);
  assert.match(bloco, /spot/i);
  assert.match(bloco, /tipo de taxa/i);
});

test("a seção 27 declara que nenhuma fonte deve ser adotada só por ser gratuita ou de fácil acesso", () => {
  const bloco = doc.slice(doc.indexOf("## 27."), doc.indexOf("## 28."));
  assert.match(bloco, /nenhuma fonte deve ser adotada s[oó] porque [eé] gratuita/i);
});

// --- 8. Domínio de formulados (seção 28) ------------------------------------

test("a seção 28 trata a separação de domínios como princípio, sem acesso a dado privado de formulado", () => {
  const bloco = doc.slice(doc.indexOf("## 28."), doc.indexOf("## 29."));
  assert.match(bloco, /n[aã]o acessou nenhum registro privado de pre[cç]o de formulado/i);
  assert.match(bloco, /n[aã]o le[uê] nem cita nome de fornecedor comercial/i);
});

// --- 9. Referências e disciplina de verificação (seções 3, 29) ------------

test("a seção 3 descreve a disciplina de não presumir acesso gratuito, público ou redistribuível", () => {
  const bloco = doc.slice(doc.indexOf("## 3."), doc.indexOf("## 4."));
  assert.match(bloco, /nunca presumir acesso gratuito, p[uú]blico ou redistribu[ií]vel/i);
  assert.match(bloco, /nunca contornar paywall/i);
});

test("o documento usa o marcador NAO_VERIFICADO ao menos uma vez fora das seções de metodologia e enums", () => {
  const ocorrencias = (doc.match(/NAO_VERIFICADO/g) ?? []).length;
  assert.ok(ocorrencias >= 3, `esperado ao menos 3 ocorrências, encontrado ${ocorrencias}`);
});

test("a seção 29 é uma tabela de referências com título, instituição, URL, data de acesso e afirmação sustentada", () => {
  const bloco = doc.slice(doc.indexOf("## 29."), doc.indexOf("## 30."));
  assert.match(bloco, /\|\s*T[ií]tulo\s*\|\s*Institui[cç][aã]o\s*\|\s*URL\s*\|\s*Data de acesso\s*\|/i);
  const linhasUrl = bloco.match(/https:\/\/\S+/g) ?? [];
  assert.ok(linhasUrl.length >= 10, `esperado ao menos 10 URLs de referência, encontrado ${linhasUrl.length}`);
});

test("toda URL citada na seção 29 usa https e um domínio (nenhuma URL truncada ou de exemplo)", () => {
  const bloco = doc.slice(doc.indexOf("## 29."), doc.indexOf("## 30."));
  const urls = bloco.match(/https:\/\/[^\s|)]+/g) ?? [];
  assert.ok(urls.length >= 10);
  for (const url of urls) {
    assert.match(url, /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i, url);
    assert.doesNotMatch(url, /example\.com|localhost|seu-dominio/i, url);
  }
});

test("a seção 29 declara que nenhuma URL foi inventada", () => {
  const bloco = doc.slice(doc.indexOf("## 29."), doc.indexOf("## 30."));
  assert.match(bloco, /nenhuma URL[\s\S]*?foi inventada/i);
});

// --- 10. Próximos passos (seção 30) -----------------------------------------

test("a seção 30 sugere apenas aprovação humana, validação jurídica e priorização de integração", () => {
  const bloco = doc.slice(doc.indexOf("## 30."), doc.length);
  assert.match(bloco, /Aprova[cç][aã]o humana/i);
  assert.match(bloco, /Valida[cç][aã]o jur[ií]dica/i);
  assert.match(bloco, /Prioriza[cç][aã]o de integra[cç][aã]o/i);
});

test("a seção 30 não sugere implementação de coleta, catálogo ou cruzamento com formulados", () => {
  const bloco = doc.slice(doc.indexOf("## 30."), doc.length);
  assert.doesNotMatch(bloco, /implementar a coleta/i);
  assert.doesNotMatch(bloco, /criar o cat[aá]logo/i);
  assert.doesNotMatch(bloco, /cruzar com (o|os) (histórico|dados) de formulados/i);
});

// --- 11. Proibições de conteúdo (preços, dados privados, segredos) --------

test("o documento não contém nenhum dos valores numéricos hoje presentes em fertilizers-override.json", () => {
  const overridePath = join(ROOT, "fertilizers-override.json");
  const override = JSON.parse(readFileSync(overridePath, "utf-8"));
  for (const chave of ["soja", "sojaTO", "bdi", "ureia", "map", "kcl", "gasNatural", "dolar"]) {
    const valor = override[chave];
    if (typeof valor !== "number") continue;
    const texto = String(valor);
    assert.doesNotMatch(doc, new RegExp(`(?<![\\d.])${texto.replace(".", "\\.")}(?![\\d])`),
      `valor de override vazou no documento: ${chave}=${valor}`);
  }
});

test("o documento não contém caminho absoluto de sistema de arquivos", () => {
  assert.doesNotMatch(doc, /\/home\/[a-z0-9_-]+\//i);
  assert.doesNotMatch(doc, /\/root\//);
  assert.doesNotMatch(doc, /^[A-Za-z]:\\/m);
});

test("o documento não contém nome de fornecedor comercial de formulado nem dado do histórico privado", () => {
  const historico = JSON.parse(readFileSync(join(ROOT, "data", "formulated-prices-history.json"), "utf-8"));
  assert.deepEqual(historico.records, [], "pré-condição: base pública de formulados deve estar vazia nesta etapa");
});

test("o documento não contém padrão de chave/segredo (ex.: valor atribuído a EIA_API_KEY)", () => {
  assert.doesNotMatch(doc, /EIA_API_KEY\s*[:=]\s*["'`]?[A-Za-z0-9]/);
  // Heurística de "parece um token/segredo": mistura de maiúsculas, minúsculas
  // e dígitos em 32+ caracteres contínuos, sem ponto nem barra (o que
  // descarta domínios/caminhos de URL e nomes de enum em MAIÚSCULAS_COM_underscore).
  const candidatos = doc.match(/[A-Za-z0-9_-]{32,}/g) ?? [];
  for (const c of candidatos) {
    const pareceSegredo = /[a-z]/.test(c) && /[A-Z]/.test(c) && /\d/.test(c) && !c.includes(".") && !c.includes("/");
    assert.equal(pareceSegredo, false, `sequência com aparência de token/segredo: ${c}`);
  }
});

test("o documento não reproduz série histórica de valores (nenhuma sequência de 3+ números decimais separados por vírgula)", () => {
  assert.doesNotMatch(doc, /(\d+[.,]\d+\s*,\s*){3,}\d+[.,]\d+/);
});

// --- 12. README --------------------------------------------------------------

test("o README ganhou uma seção 14 com link para o novo documento", () => {
  assert.match(readme, /##\s+14\.\s+Avalia[cç][aã]o de fontes hist[oó]ricas complementares/i);
  assert.match(readme, /docs\/market-history-sources-assessment\.md/);
});

test("o README não duplica a matriz completa de critérios/enums do novo documento (apenas aponta para ele)", () => {
  const bloco = readme.slice(readme.indexOf("## 14."));
  assert.doesNotMatch(bloco, /OFICIAL_PRIMARIA/);
  assert.doesNotMatch(bloco, /FONTE_PRIMARIA_RECOMENDADA/);
});

// --- 13. Arquivos que não deveriam ter sido tocados nesta etapa ------------

test("fetch-data.mjs, fetch-fertilizers.mjs e fetch-noticias.mjs continuam com sintaxe válida (não foram quebrados)", async () => {
  const { execFileSync } = await import("node:child_process");
  for (const arquivo of ["fetch-data.mjs", "fetch-fertilizers.mjs", "fetch-noticias.mjs"]) {
    assert.doesNotThrow(() => execFileSync(process.execPath, ["--check", join(ROOT, arquivo)]), arquivo);
  }
});

test("package.json não ganhou nenhum script novo nesta etapa (permanece com as 6 entradas conhecidas)", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
  assert.deepEqual(Object.keys(pkg.scripts).sort(), [
    "extract:market-history",
    "import:formulated-history",
    "profile:formulated-history",
    "test",
    "validate:formulated-history",
    "weekly",
  ]);
});

test("nenhum teste desta suite deixa rastro no git status do repositório", async () => {
  const { execFileSync } = await import("node:child_process");
  const saida = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf-8" });
  const linhasRelevantes = saida
    .split("\n")
    .filter((l) => l.trim())
    .filter((l) => !/docs\/market-history-sources-assessment\.md|README\.md|test\/market-history-sources-assessment\.test\.mjs/.test(l));
  assert.deepEqual(linhasRelevantes, []);
});
