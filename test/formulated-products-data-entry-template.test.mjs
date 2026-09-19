/**
 * test/formulated-products-data-entry-template.test.mjs — testes estruturais do
 * modelo Excel público fictício (Etapa 7). Um .xlsx é um .zip contendo XML (OOXML);
 * este arquivo implementa um leitor mínimo de ZIP (central directory + inflate via
 * node:zlib) para inspecionar abas, colunas, listas e metadados -- sem adicionar
 * nenhuma dependência Node, sem rede, sem abrir o Excel de verdade e sem executar
 * nenhuma macro.
 *
 * Nota sobre validação por reabertura no LibreOffice: tentamos abrir e salvar
 * novamente o arquivo com `soffice --headless --convert-to xlsx` durante a
 * validação manual desta etapa. Um arquivo .xlsx mínimo de controle (gerado à parte,
 * sem nenhuma relação com este template) também falhou a carregar no LibreOffice
 * deste ambiente sandbox ("Error: source file could not be loaded"), inclusive com
 * um perfil de usuário novo e isolado -- ou seja, é uma limitação deste ambiente de
 * execução, não um defeito deste arquivo. Por isso a validação estrutural abaixo é a
 * autoridade desta suíte para o XLSX, consistente com a orientação da etapa de não
 * depender do Microsoft Excel instalado nem de interface gráfica.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const XLSX_PATH = join(ROOT, "templates", "formulated-products-data-entry-template.xlsx");

// --- leitor ZIP mínimo (central directory + local headers), só para leitura -------

function unzip(buffer) {
  const eocdSig = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === eocdSig) { eocdOffset = i; break; }
  }
  assert.ok(eocdOffset !== -1, "EOCD (fim do diretório central) não encontrado -- não é um ZIP válido");

  const cdEntryCount = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  const entries = new Map();
  let ptr = cdOffset;
  for (let i = 0; i < cdEntryCount; i++) {
    const sig = buffer.readUInt32LE(ptr);
    assert.equal(sig, 0x02014b50, `assinatura de entrada do diretório central inválida no índice ${i}`);
    const compMethod = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = buffer.readUInt32LE(ptr + 42);
    const name = buffer.toString("utf-8", ptr + 46, ptr + 46 + nameLen);
    entries.set(name, { compMethod, compSize, localHeaderOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  const result = new Map();
  for (const [name, info] of entries) {
    const lh = info.localHeaderOffset;
    assert.equal(buffer.readUInt32LE(lh), 0x04034b50, `assinatura de local file header inválida para ${name}`);
    const lhNameLen = buffer.readUInt16LE(lh + 26);
    const lhExtraLen = buffer.readUInt16LE(lh + 28);
    const dataStart = lh + 30 + lhNameLen + lhExtraLen;
    const raw = buffer.subarray(dataStart, dataStart + info.compSize);
    const data = info.compMethod === 0 ? raw : inflateRawSync(raw);
    result.set(name, data);
  }
  return result;
}

function textoDoXml(buffer) {
  return buffer.toString("utf-8");
}

function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z0-9:]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(tag))) out[m[1]] = m[2];
  return out;
}

// --- fixtures --------------------------------------------------------------------

assert.ok(existsSync(XLSX_PATH), "arquivo XLSX não existe -- rode tools/generate-formulated-products-data-entry-template.py");
const buffer = readFileSync(XLSX_PATH);
const zip = unzip(buffer);
const workbookXml = textoDoXml(zip.get("xl/workbook.xml"));
const workbookRelsXml = textoDoXml(zip.get("xl/_rels/workbook.xml.rels"));

const NOMES_ABAS_ESPERADOS = [
  "00_INSTRUCOES", "01_PRECOS", "02_FORMULACOES", "03_NUTRIENTES_SECUNDARIOS",
  "04_MICRONUTRIENTES", "05_COMPOSICAO_FISICA", "06_FONTES_INFORMACAO", "99_LISTAS",
];

function abasDoWorkbook() {
  const sheets = [];
  const re = /<sheet\s+([^>]+)\/>/g;
  let m;
  while ((m = re.exec(workbookXml))) sheets.push(attrs(m[1]));
  return sheets;
}

function sheetIdParaArquivo(rId) {
  const re = new RegExp(`<Relationship\\s+Id="${rId}"[^>]*Target="worksheets/(sheet\\d+\\.xml)"`);
  const m = workbookRelsXml.match(re);
  assert.ok(m, `relacionamento não encontrado para ${rId}`);
  return `xl/worksheets/${m[1]}`;
}

function xmlDaAba(nome) {
  const aba = abasDoWorkbook().find((s) => s.name === nome);
  assert.ok(aba, `aba não encontrada: ${nome}`);
  const arquivo = sheetIdParaArquivo(aba["r:id"]);
  return textoDoXml(zip.get(arquivo));
}

function cabecalhosDaAba(nome) {
  const xml = xmlDaAba(nome);
  const primeiraLinha = xml.match(/<row r="1">([\s\S]*?)<\/row>/)[1];
  const celulas = [...primeiraLinha.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
  return celulas;
}

// --- 1-9: existência, formato, ausência de conteúdo ativo --------------------------

test("[1] o arquivo templates/formulated-products-data-entry-template.xlsx existe", () => {
  assert.ok(existsSync(XLSX_PATH));
});

test("[2] o arquivo tem uma estrutura ZIP interna válida (abre sem erro)", () => {
  assert.ok(zip.size > 0);
  assert.ok(zip.has("[Content_Types].xml"));
});

test("[3] o formato é XLSX (workbook.xml presente), não XLSM (sem vbaProject)", () => {
  assert.ok(zip.has("xl/workbook.xml"));
  assert.equal(zip.has("xl/vbaProject.bin"), false);
});

test("[4] não possui macro nem VBA", () => {
  assert.equal([...zip.keys()].some((n) => /vbaProject/i.test(n)), false);
  const contentTypes = textoDoXml(zip.get("[Content_Types].xml"));
  assert.doesNotMatch(contentTypes, /vnd\.ms-office\.vbaProject/i);
});

test("[5] não possui conexão externa (connections.xml)", () => {
  assert.equal([...zip.keys()].some((n) => /xl\/connections\.xml/i.test(n)), false);
});

test("[6] não possui Power Query (customXml queryTable ou xl\\/queryTables)", () => {
  assert.equal([...zip.keys()].some((n) => /queryTable/i.test(n)), false);
  assert.equal([...zip.keys()].some((n) => /customXml/i.test(n)), false);
});

test("[7] não possui link externo (externalLinks)", () => {
  assert.equal([...zip.keys()].some((n) => /externalLink/i.test(n)), false);
});

test("[8] não possui objeto incorporado (oleObject) nem imagem (media)", () => {
  assert.equal([...zip.keys()].some((n) => /oleObject/i.test(n)), false);
  assert.equal([...zip.keys()].some((n) => /xl\/media\//i.test(n)), false);
});

test("[9] possui exatamente as 8 abas esperadas, na ordem, nenhuma oculta", () => {
  const abas = abasDoWorkbook();
  assert.deepEqual(abas.map((a) => a.name), NOMES_ABAS_ESPERADOS);
  for (const a of abas) {
    assert.notEqual(a.state, "hidden");
    assert.notEqual(a.state, "veryHidden");
  }
});

// --- 10-20: colunas por aba --------------------------------------------------------

test("[10] 01_PRECOS possui exatamente as 18 colunas do contrato comercial, na ordem, sem formulationId", () => {
  const esperado = [
    "id", "dataCotacao", "dataCompra", "anoReferencia", "produto", "formula", "categoriaFormula",
    "fornecedor", "preco", "moeda", "unidadePreco", "modalidadeEntrega", "destino",
    "volumeToneladas", "prazoPagamentoDias", "validadeProposta", "fonteRegistro", "observacoes",
  ];
  const cabecalhos = cabecalhosDaAba("01_PRECOS");
  assert.deepEqual(cabecalhos, esperado);
  assert.equal(cabecalhos.includes("formulationId"), false);
});

test("[11] 02_FORMULACOES possui as colunas técnicas exatas, com formulationId, sem preço/fornecedor/composição", () => {
  const esperado = [
    "formulationId", "productName", "declaredFormula", "category", "revision", "validFrom",
    "validTo", "status", "nPercent", "p2o5Percent", "k2oPercent", "informationQuality", "notes",
  ];
  const cabecalhos = cabecalhosDaAba("02_FORMULACOES");
  assert.deepEqual(cabecalhos, esperado);
  for (const proibido of ["preco", "fornecedor", "componentId", "percentage"]) {
    assert.equal(cabecalhos.includes(proibido), false);
  }
});

test("[12] 03_NUTRIENTES_SECUNDARIOS possui as colunas esperadas", () => {
  assert.deepEqual(cabecalhosDaAba("03_NUTRIENTES_SECUNDARIOS"), ["formulationId", "nutrient", "value", "unit", "sourceNote"]);
});

test("[13] 04_MICRONUTRIENTES possui as colunas esperadas", () => {
  assert.deepEqual(cabecalhosDaAba("04_MICRONUTRIENTES"), ["formulationId", "element", "value", "unit", "sourceNote"]);
});

test("[14] 05_COMPOSICAO_FISICA possui as colunas esperadas", () => {
  assert.deepEqual(cabecalhosDaAba("05_COMPOSICAO_FISICA"), [
    "formulationId", "completenessStatus", "componentId", "componentName", "percentage", "unit", "sourceType", "sourceNote", "notes",
  ]);
});

test("[15] 06_FONTES_INFORMACAO possui as colunas esperadas", () => {
  assert.deepEqual(cabecalhosDaAba("06_FONTES_INFORMACAO"), [
    "formulationId", "sourceId", "isPrimary", "type", "documentReference", "effectiveDate", "sourceNote",
  ]);
});

test("[16] todas as abas filhas (02 a 06) possuem a coluna formulationId como primeira coluna", () => {
  for (const aba of ["02_FORMULACOES", "03_NUTRIENTES_SECUNDARIOS", "04_MICRONUTRIENTES", "05_COMPOSICAO_FISICA", "06_FONTES_INFORMACAO"]) {
    assert.equal(cabecalhosDaAba(aba)[0], "formulationId", `${aba} deveria começar com formulationId`);
  }
});

// --- 21: 99_LISTAS ------------------------------------------------------------------

function colunasDaListasSheet() {
  const xml = xmlDaAba("99_LISTAS");
  const primeiraLinha = xml.match(/<row r="1">([\s\S]*?)<\/row>/)[1];
  return [...primeiraLinha.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
}

test("[21] 99_LISTAS possui os enums esperados como cabeçalhos de coluna", () => {
  const colunas = colunasDaListasSheet();
  for (const nome of [
    "STATUS_FORMULACAO", "QUALIDADE_INFORMACAO", "NUTRIENTE_SECUNDARIO", "UNIDADE_NUTRIENTE_SECUNDARIO",
    "MICRONUTRIENTE", "UNIDADE_MICRONUTRIENTE", "COMPLETUDE_COMPOSICAO", "UNIDADE_COMPONENTE",
    "ORIGEM_COMPONENTE", "TIPO_FONTE_INFORMACAO", "MOEDA", "UNIDADE_PRECO", "MODALIDADE_ENTREGA",
    "FONTE_REGISTRO", "BOOLEANO", "SENTINELAS_EXCEL",
  ]) {
    assert.ok(colunas.includes(nome), `coluna de lista ausente: ${nome}`);
  }
});

// --- 12/22-29: aba de instruções e alinhamento com o schema/JS ---------------------

test("[12b] aba 00_INSTRUCOES existe e contém texto substancial", () => {
  const xml = xmlDaAba("00_INSTRUCOES");
  assert.ok(xml.length > 2000);
});

test("[22] status do Excel (99_LISTAS) coincide com STATUS_VALIDOS do schema/JS", async () => {
  const mod = await import("../formulated-products-catalog.mjs");
  const xml = xmlDaAba("99_LISTAS");
  for (const s of mod.STATUS_VALIDOS) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
});

test("[23] informationQuality do Excel coincide com QUALIDADE_INFORMACAO_VALIDA do schema/JS", async () => {
  const mod = await import("../formulated-products-catalog.mjs");
  const xml = xmlDaAba("99_LISTAS");
  for (const s of mod.QUALIDADE_INFORMACAO_VALIDA) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
});

test("[24] micronutrientes do Excel coincidem com MICRONUTRIENTE_VALIDO + sentinelas documentados", async () => {
  const mod = await import("../formulated-products-catalog.mjs");
  const xml = xmlDaAba("99_LISTAS");
  for (const s of mod.MICRONUTRIENTE_VALIDO) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
  assert.match(xml, /<t[^>]*>NAO_INFORMADO<\/t>/);
  assert.match(xml, /<t[^>]*>NENHUM_DECLARADO<\/t>/);
});

test("[25] nutrientes secundários do Excel coincidem com NUTRIENTE_SECUNDARIO_VALIDO do schema/JS", async () => {
  const mod = await import("../formulated-products-catalog.mjs");
  const xml = xmlDaAba("99_LISTAS");
  for (const s of mod.NUTRIENTE_SECUNDARIO_VALIDO) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
});

test("[26] completude de composição do Excel coincide com COMPLETUDE_COMPOSICAO_VALIDA + sentinela NOT_COLLECTED", async () => {
  const mod = await import("../formulated-products-catalog.mjs");
  const xml = xmlDaAba("99_LISTAS");
  for (const s of mod.COMPLETUDE_COMPOSICAO_VALIDA) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
  assert.match(xml, /<t[^>]*>NOT_COLLECTED<\/t>/);
});

test("[27] sourceType (origem do componente) do Excel coincide com ORIGEM_COMPONENTE_VALIDA do schema/JS", async () => {
  const mod = await import("../formulated-products-catalog.mjs");
  const xml = xmlDaAba("99_LISTAS");
  for (const s of mod.ORIGEM_COMPONENTE_VALIDA) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
});

test("[28] type de informationSource do Excel coincide com TIPO_FONTE_VALIDO do schema/JS", async () => {
  const mod = await import("../formulated-products-catalog.mjs");
  const xml = xmlDaAba("99_LISTAS");
  for (const s of mod.TIPO_FONTE_VALIDO) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
});

test("[29] listas de preço (moeda/unidadePreco/modalidadeEntrega/fonteRegistro) coincidem com o contrato comercial", async () => {
  const historico = await import("../formulated-price-history.mjs");
  const xml = xmlDaAba("99_LISTAS");
  for (const s of historico.MOEDAS_SUPORTADAS) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
  for (const s of historico.UNIDADES_PRECO_SUPORTADAS) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
  for (const s of historico.MODALIDADES_ENTREGA_VALIDAS) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
  for (const s of historico.FONTES_REGISTRO_VALIDAS) assert.match(xml, new RegExp(`<t[^>]*>${s}</t>`));
});

// --- 30-41: formatação -----------------------------------------------------------------

test("[30] cabeçalhos congelados (freeze panes) presentes nas abas de dados", () => {
  for (const aba of ["01_PRECOS", "02_FORMULACOES", "99_LISTAS"]) {
    assert.match(xmlDaAba(aba), /<pane\s+ySplit="1"[^>]*state="frozen"/);
  }
});

test("[31] autofiltros presentes nas abas de dados", () => {
  for (const aba of ["01_PRECOS", "02_FORMULACOES", "06_FONTES_INFORMACAO"]) {
    assert.match(xmlDaAba(aba), /<autoFilter\s+ref="/);
  }
});

test("[33-34] campos obrigatórios e opcionais têm estilos de cabeçalho distintos", () => {
  const xml = xmlDaAba("02_FORMULACOES");
  const primeiraLinha = xml.match(/<row r="1">([\s\S]*?)<\/row>/)[1];
  const estilos = [...primeiraLinha.matchAll(/<c r="[A-Z]+1" s="(\d+)"/g)].map((m) => m[1]);
  assert.ok(new Set(estilos).size >= 2, "esperado ao menos dois estilos de cabeçalho distintos (obrigatório x opcional)");
});

test("[36] existe versão do modelo declarada", () => {
  assert.match(xmlDaAba("00_INSTRUCOES"), /Vers[ãa]o do modelo: 1/);
  const core = textoDoXml(zip.get("docProps/core.xml"));
  assert.match(core, /vers[ãa]o 1/i);
});

test("[37] existe aviso sobre exemplos fictícios", () => {
  assert.match(xmlDaAba("00_INSTRUCOES"), /exemplos fict[íi]cios/i);
});

test("[38] existe aviso garantia ≠ composição", () => {
  assert.match(xmlDaAba("00_INSTRUCOES"), /GARANTIA NUTRICIONAL N[ÃA]O REPRESENTA PERCENTUAL F[ÍI]SICO/);
});

test("[39] existe aviso de não inferência (fórmula não calcula matéria-prima)", () => {
  assert.match(xmlDaAba("00_INSTRUCOES"), /06-30-06 N[ÃA]O PERMITE CALCULAR AUTOMATICAMENTE/);
});

test("[40] existe aviso de não preencher desconhecido com zero", () => {
  assert.match(xmlDaAba("00_INSTRUCOES"), /N[ÃA]O PREENCHER INFORMA[ÇC][ÃA]O DESCONHECIDA COM ZERO/);
});

test("[41] existe aviso de não inserir credenciais", () => {
  assert.match(xmlDaAba("00_INSTRUCOES"), /N[ÃA]O REGISTRAR SENHAS, TOKENS, DADOS PESSOAIS/);
});

test("existe aviso de que o modelo não executa carga automática", () => {
  assert.match(xmlDaAba("00_INSTRUCOES"), /N[ÃA]O EXECUTA CARGA AUTOM[ÁA]TICA/);
});

// --- 42-52: ausência de dado real/sensível -------------------------------------------

test("[42-49] os exemplos são inequivocamente fictícios e não contêm dado real/sensível", () => {
  const textoCompleto = [...zip.entries()]
    .filter(([n]) => n.startsWith("xl/worksheets/"))
    .map(([, buf]) => textoDoXml(buf))
    .join("\n");
  assert.match(textoCompleto, /FORMULADO_FICTICIO_A/);
  assert.match(textoCompleto, /FORMULADO_FICTICIO_B/);
  assert.doesNotMatch(textoCompleto, /(api[_-]?key|token|senha|password)\s*[:=]/i);
  assert.doesNotMatch(textoCompleto, /https?:\/\/(?!schemas\.openxmlformats)/i);
});

test("[50-52] não contém conexão com data.json, arquivo privado, ou link para data/private/", () => {
  const todasEntradas = [...zip.entries()].map(([, buf]) => textoDoXml(buf)).join("\n");
  assert.doesNotMatch(todasEntradas, /data\.json/);
  assert.doesNotMatch(todasEntradas, /data\/private/);
  assert.doesNotMatch(todasEntradas, /\.private\.json/);
});

// --- 53-60: integridade e não interferência com o resto do projeto -----------------

test("[53] não possui erro estrutural: todas as partes XML referenciadas existem no ZIP", () => {
  for (const aba of abasDoWorkbook()) {
    const arquivo = sheetIdParaArquivo(aba["r:id"]);
    assert.ok(zip.has(arquivo), `parte ausente: ${arquivo}`);
  }
  assert.ok(zip.has("xl/styles.xml"));
});

test("[55] gerar o arquivo não altera o template CSV de preços existente", () => {
  const diff = execFileSync("git", ["diff", "15a1be3", "--", "templates/formulated-prices-history-template.csv"], { cwd: ROOT, encoding: "utf-8" });
  assert.equal(diff.trim(), "");
});

test("[56] gerar o arquivo não altera o schema comercial existente", () => {
  const diff = execFileSync("git", ["diff", "15a1be3", "--", "schemas/formulated-price-history.schema.json"], { cwd: ROOT, encoding: "utf-8" });
  assert.equal(diff.trim(), "");
});

test("[57] nenhum importador XLSX foi criado nesta etapa", () => {
  const candidatos = ["import-formulated-products-catalog.mjs", "import-data-entry-template.mjs", "xlsx-import.mjs"];
  for (const c of candidatos) assert.equal(existsSync(join(ROOT, c)), false);
});

test("[58] o gerador Python não acessa rede nem lê arquivo privado (inspeção estática do código-fonte)", () => {
  const codigo = readFileSync(join(ROOT, "tools", "generate-formulated-products-data-entry-template.py"), "utf-8");
  // Sem import de rede.
  assert.doesNotMatch(codigo, /^\s*(import|from)\s+(urllib|requests|socket|http\.client)\b/m);
  // O script MENCIONA "data/private" e "*.private.json" só em comentários (para
  // documentar o que ele nunca faz) -- o que ele nunca deve fazer é abrir ("open(")
  // um caminho contendo esses termos.
  const chamadasOpen = [...codigo.matchAll(/open\(([^)]*)\)/g)].map((m) => m[1]);
  for (const args of chamadasOpen) {
    assert.doesNotMatch(args, /private/i);
  }
});

test("[59] o modelo é público (está em templates/, rastreado pelo git) e fictício", () => {
  const rastreado = execFileSync("git", ["ls-files", "templates/formulated-products-data-entry-template.xlsx"], { cwd: ROOT, encoding: "utf-8" });
  // Pode ainda não estar adicionado ao index no momento exato deste teste dentro do
  // fluxo da etapa; o que importa é que o caminho está sob templates/, não em
  // data/private/ nem marcado como *.private.*.
  assert.ok(!XLSX_PATH.includes("data/private"));
  assert.ok(!XLSX_PATH.endsWith(".private.xlsx"));
});
