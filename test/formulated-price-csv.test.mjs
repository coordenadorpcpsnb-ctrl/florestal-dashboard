/**
 * test/formulated-price-csv.test.mjs — Testes unitarios (puros, sem I/O) do parser
 * CSV e da conversao de tipos em formulated-price-csv.mjs.
 *
 * Todos os dados usados sao DADOS DE TESTE FICTICIOS -- nunca sao gravados em
 * arquivo nenhum, so passam por memoria dentro dos proprios testes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseCsvRows,
  validarCabecalho,
  converterCsvParaRegistros,
  parseDecimalPtOuEn,
  parseInteiroEstrito,
  CABECALHO_CANONICO,
  TIPOS_ERRO_CSV,
} from "../formulated-price-csv.mjs";
import { TIPOS_ERRO } from "../formulated-price-history.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(__dirname, "..", "templates", "formulated-prices-history-template.csv");

const HEADER = CABECALHO_CANONICO.join(";");
/** Monta uma linha de dados FICTICIA minima valida, com overrides posicionais por nome de campo. */
function linhaMinimaFicticia(overrides = {}) {
  const base = {
    id: "fp-teste-csv-001", dataCotacao: "2026-01-10", dataCompra: "", anoReferencia: "2026",
    produto: "Produto Teste", formula: "", categoriaFormula: "", fornecedor: "Fornecedor Teste",
    preco: "100,50", moeda: "BRL", unidadePreco: "BRL_TON", modalidadeEntrega: "NAO_INFORMADO",
    destino: "", volumeToneladas: "", prazoPagamentoDias: "", validadeProposta: "",
    fonteRegistro: "COTACAO", observacoes: "",
  };
  const linha = { ...base, ...overrides };
  return CABECALHO_CANONICO.map((c) => linha[c]).join(";");
}

// === 3. cabecalho canonico valido ===
test("cabecalho canonico (ordem oficial) e aceito sem erros", () => {
  const r = validarCabecalho(CABECALHO_CANONICO);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test("ordem do cabecalho diferente da canonica e aceita, desde que os nomes sejam validos e unicos (regra 7)", () => {
  const embaralhado = [...CABECALHO_CANONICO].reverse();
  const r = validarCabecalho(embaralhado);
  assert.equal(r.ok, true);
});

// === 4. BOM UTF-8 ===
test("BOM UTF-8 no inicio do arquivo e removido sem afetar o parsing", () => {
  const texto = "﻿" + HEADER + "\n" + linhaMinimaFicticia() + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.equal(r.registrosConvertidos, 1);
});

// === 5. CRLF ===
test("quebras de linha CRLF sao aceitas", () => {
  const texto = HEADER.split(";").join(";") + "\r\n" + linhaMinimaFicticia() + "\r\n";
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.equal(r.registrosConvertidos, 1);
});

// === 6. LF ===
test("quebras de linha LF sao aceitas", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia() + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.equal(r.registrosConvertidos, 1);
});

// === 7. linha final sem quebra ===
test("a ultima linha do arquivo, sem quebra de linha final, e lida corretamente", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia(); // sem \n no final
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.equal(r.registrosConvertidos, 1);
});

// === 8. campo entre aspas ===
test("campo entre aspas duplas e lido sem as aspas", () => {
  const rows = parseCsvRows('id;produto\nabc;"Produto Ficticio"\n');
  assert.deepEqual(rows.errors, []);
  assert.deepEqual(rows.rows[1].cells, ["abc", "Produto Ficticio"]);
});

// === 9. ponto e virgula dentro de aspas ===
test("ponto e virgula dentro de um campo entre aspas nao quebra o campo", () => {
  const rows = parseCsvRows('id;produto\nabc;"Produto; com ponto e virgula"\n');
  assert.deepEqual(rows.rows[1].cells, ["abc", "Produto; com ponto e virgula"]);
});

// === 10. aspas escapadas ===
test('aspas duplas escapadas como "" dentro de um campo viram uma aspa literal', () => {
  const rows = parseCsvRows('id;produto\nabc;"Produto ""ficticio"" entre aspas"\n');
  assert.deepEqual(rows.rows[1].cells, ["abc", 'Produto "ficticio" entre aspas']);
});

// === 11. aspas nao fechadas ===
test("aspas nao fechadas no arquivo geram erro ASPAS_NAO_FECHADAS, sem conteudo da linha na mensagem", () => {
  const rows = parseCsvRows('id;produto\nabc;"nunca fecha\n');
  assert.equal(rows.errors.length, 1);
  assert.equal(rows.errors[0].type, TIPOS_ERRO_CSV.ASPAS_NAO_FECHADAS);
  assert.doesNotMatch(rows.errors[0].message, /nunca fecha/);
});

// === 12. numero incorreto de colunas ===
test("linha com numero de colunas diferente do cabecalho gera NUMERO_COLUNAS_INCONSISTENTE", () => {
  const texto = HEADER + "\nfp-01;2026-01-10;;2026;Produto\n"; // muito poucas colunas
  const r = converterCsvParaRegistros(texto);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].type, TIPOS_ERRO_CSV.NUMERO_COLUNAS_INCONSISTENTE);
  assert.equal(r.errors[0].line, 2);
});

// === 13. coluna desconhecida ===
test("coluna desconhecida no cabecalho gera CAMPO_DESCONHECIDO", () => {
  const r = validarCabecalho(["id", "colunaQueNaoExiste", "dataCotacao", "anoReferencia", "produto", "fornecedor", "preco", "moeda", "unidadePreco", "modalidadeEntrega", "fonteRegistro"]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.CAMPO_DESCONHECIDO && e.field === "colunaQueNaoExiste"));
});

// === 14. coluna duplicada ===
test("coluna duplicada no cabecalho gera COLUNA_DUPLICADA", () => {
  const r = validarCabecalho(["id", "id", ...CABECALHO_CANONICO.slice(1)]);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO_CSV.COLUNA_DUPLICADA && e.field === "id"));
});

// === 15. coluna obrigatoria ausente ===
test("coluna obrigatoria ausente no cabecalho gera CAMPO_OBRIGATORIO_AUSENTE", () => {
  const semFornecedor = CABECALHO_CANONICO.filter((c) => c !== "fornecedor");
  const r = validarCabecalho(semFornecedor);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE && e.field === "fornecedor"));
});

// === 16. coluna opcional ausente ===
test("coluna opcional ausente no cabecalho e aceita (nao e erro)", () => {
  const semObservacoes = CABECALHO_CANONICO.filter((c) => c !== "observacoes");
  const r = validarCabecalho(semObservacoes);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

// === 17. linha totalmente vazia ignorada ===
test("linha totalmente vazia entre duas linhas de dados e ignorada, sem gerar erro", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ id: "fp-a" }) + "\n\n" + linhaMinimaFicticia({ id: "fp-b" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.equal(r.blankLinesSkipped, 1);
  assert.equal(r.registrosConvertidos, 2);
});

// === 18. campo obrigatorio vazio ===
test("campo obrigatorio vazio (produto) gera CAMPO_OBRIGATORIO_AUSENTE, sem valor da linha na mensagem", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ produto: "" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].type, TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE);
  assert.equal(r.errors[0].field, "produto");
});

// === 19. opcional vazio vira ausencia ===
test("campo opcional vazio (destino) vira AUSENCIA da propriedade no registro, nunca string vazia", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ destino: "" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.equal("destino" in r.records[0], false);
});

test("campos obrigatorios nunca sao omitidos, mesmo vazios (sempre viram erro em vez de ausencia silenciosa)", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ fornecedor: "" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.equal(r.records.length, 0); // linha com erro nao vira registro
  assert.equal(r.errors[0].field, "fornecedor");
});

// === 20/21. preco com virgula ou ponto decimal ===
test("preco com virgula decimal (formato pt-BR) e convertido corretamente", () => {
  assert.deepEqual(parseDecimalPtOuEn("1234,56"), { ok: true, value: 1234.56 });
});

test("preco com ponto decimal e convertido corretamente", () => {
  assert.deepEqual(parseDecimalPtOuEn("1234.56"), { ok: true, value: 1234.56 });
});

// === 22. preco com separador de milhar rejeitado ===
test("preco com separador de milhar (ponto E virgula juntos) e rejeitado", () => {
  assert.equal(parseDecimalPtOuEn("1.234,56").ok, false);
});

test("preco com varios separadores de milhar (so pontos) e rejeitado", () => {
  assert.equal(parseDecimalPtOuEn("1.234.567").ok, false);
});

test("preco com formato invalido no CSV gera VALOR_INVALIDO, sem o valor bruto na mensagem", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ preco: "1.234,56" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].type, TIPOS_ERRO.VALOR_INVALIDO);
  assert.equal(r.errors[0].field, "preco");
  assert.doesNotMatch(r.errors[0].message, /1\.234,56/);
});

// === 25. volume vazio ===
test("volumeToneladas vazio vira ausencia da propriedade", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ volumeToneladas: "" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.equal("volumeToneladas" in r.records[0], false);
});

// === 26. volume decimal valido ===
test("volumeToneladas com decimal valido e convertido para numero", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ volumeToneladas: "12,5" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.equal(r.records[0].volumeToneladas, 12.5);
});

// === 29/30. prazo inteiro valido / decimal rejeitado ===
test("prazoPagamentoDias inteiro valido e convertido", () => {
  assert.deepEqual(parseInteiroEstrito("30"), { ok: true, value: 30 });
});

test("prazoPagamentoDias decimal e rejeitado (deve ser inteiro estrito)", () => {
  assert.equal(parseInteiroEstrito("30.5").ok, false);
  assert.equal(parseInteiroEstrito("30,5").ok, false);
});

test("prazoPagamentoDias decimal no CSV gera VALOR_INVALIDO", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ prazoPagamentoDias: "30,5" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].field, "prazoPagamentoDias");
});

// === anoReferencia: inteiro estrito tambem ===
test("anoReferencia nao inteiro no CSV gera VALOR_INVALIDO", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ anoReferencia: "2026.5" }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].field, "anoReferencia");
});

// === espacos externos removidos, conteudo interno preservado (regras 10/11) ===
test("espacos externos em campo de texto sao removidos ao converter (trim)", () => {
  const texto = HEADER + "\n" + linhaMinimaFicticia({ produto: "  Produto Com Espacos  " }) + "\n";
  const r = converterCsvParaRegistros(texto);
  assert.equal(r.records[0].produto, "Produto Com Espacos");
});

// === 51/52. template publico ===
test("template CSV publico passa no parser sem nenhum erro estrutural/de conversao", () => {
  const texto = readFileSync(TEMPLATE_PATH, "utf-8");
  const r = converterCsvParaRegistros(texto);
  assert.deepEqual(r.errors, []);
  assert.ok(r.registrosConvertidos >= 1);
  assert.ok(r.registrosConvertidos <= 2, "template deve ter no maximo 2 linhas de dados");
});

test("template CSV publico usa o cabecalho canonico, na ordem oficial", () => {
  const texto = readFileSync(TEMPLATE_PATH, "utf-8");
  const primeiraLinha = texto.split(/\r?\n/)[0];
  assert.equal(primeiraLinha, CABECALHO_CANONICO.join(";"));
});

test("template CSV publico contem so dados inequivocamente ficticios", () => {
  const texto = readFileSync(TEMPLATE_PATH, "utf-8").toLowerCase();
  assert.match(texto, /ficticio/);
  // nada que pareça nome de empresa real, e-mail, telefone, CNPJ/CPF ou chave/token
  assert.doesNotMatch(texto, /sinobras|florestal|@|cnpj|cpf|tel:|\+55\s?\d/);
});
