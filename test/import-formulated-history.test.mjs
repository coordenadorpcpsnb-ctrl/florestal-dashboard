/**
 * test/import-formulated-history.test.mjs — Testes das funcoes de orquestracao de
 * import-formulated-history.mjs (planImport, escreverSaidaAtomica, validarCaminhoSaida,
 * ordenarRegistros), chamadas diretamente (sem subprocesso) para cobrir a logica de
 * merge/conflito/idempotencia/ordenacao rapido e com precisao.
 *
 * Testes que exercitam o CLI de ponta a ponta (dry-run/--write via subprocesso, log
 * redigido) ficam em test/import-formulated-history.cli.test.mjs.
 *
 * DADOS FICTICIOS: todo id/produto/fornecedor usado aqui e de teste, nunca gravado
 * na base publica real. Escritas de arquivo usam node:os.tmpdir().
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  planImport,
  escreverSaidaAtomica,
  validarCaminhoSaida,
  ordenarRegistros,
  registrosEstruturalmenteIguais,
  carregarSaidaExistente,
  CAMINHO_BASE_PUBLICA,
  DESCRICAO_PADRAO_SAIDA,
} from "../import-formulated-history.mjs";
import { CABECALHO_CANONICO } from "../formulated-price-csv.mjs";
import { loadAndValidateHistoryFile } from "../formulated-price-history.mjs";

const HEADER = CABECALHO_CANONICO.join(";");

function linhaFicticia(overrides = {}) {
  const base = {
    id: "fp-teste-import-001", dataCotacao: "2026-01-10", dataCompra: "", anoReferencia: "2026",
    produto: "Produto Ficticio", formula: "", categoriaFormula: "", fornecedor: "Fornecedor Ficticio",
    preco: "100,50", moeda: "BRL", unidadePreco: "BRL_TON", modalidadeEntrega: "NAO_INFORMADO",
    destino: "", volumeToneladas: "", prazoPagamentoDias: "", validadeProposta: "",
    fonteRegistro: "COTACAO", observacoes: "",
  };
  const linha = { ...base, ...overrides };
  return CABECALHO_CANONICO.map((c) => linha[c]).join(";");
}

function csvCom(...linhas) {
  return HEADER + "\n" + linhas.join("\n") + "\n";
}

let dir;
test.beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "import-formulated-history-test-")); });
test.afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

// === validarCaminhoSaida ===
test("validarCaminhoSaida rejeita a base publica conhecida", () => {
  const r = validarCaminhoSaida(CAMINHO_BASE_PUBLICA);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "SAIDA_E_BASE_PUBLICA");
});

test("validarCaminhoSaida rejeita caminho que nao termina em .private.json", () => {
  const r = validarCaminhoSaida("/tmp/alguma-coisa/saida.json");
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "SAIDA_NAO_PRIVADA");
});

test("validarCaminhoSaida aceita caminho valido terminado em .private.json", () => {
  const r = validarCaminhoSaida("/tmp/data/private/formulated-prices-history.private.json");
  assert.equal(r.ok, true);
});

// === ordenarRegistros ===
test("ordenarRegistros ordena por dataCotacao crescente, depois id crescente", () => {
  const registros = [
    { id: "fp-b", dataCotacao: "2026-02-01" },
    { id: "fp-a", dataCotacao: "2026-01-01" },
    { id: "fp-z", dataCotacao: "2026-01-01" },
  ];
  const ordenado = ordenarRegistros(registros);
  assert.deepEqual(ordenado.map((r) => r.id), ["fp-a", "fp-z", "fp-b"]);
});

test("registrosEstruturalmenteIguais ignora ordem de chaves mas nao ignora diferenca de valor", () => {
  const a = { id: "x", preco: 100, produto: "P" };
  const b = { produto: "P", preco: 100, id: "x" };
  const c = { ...a, preco: 101 };
  assert.equal(registrosEstruturalmenteIguais(a, b), true);
  assert.equal(registrosEstruturalmenteIguais(a, c), false);
});

// === 23/24. preco zero/negativo rejeitado (via validateRecord, reusado por planImport) ===
test("preco zero no CSV e rejeitado na validacao (nao vira registro valido)", () => {
  const plano = planImport({ csvText: csvCom(linhaFicticia({ preco: "0" })) });
  assert.equal(plano.ok, false);
  assert.equal(plano.registrosValidos, 0);
});

test("preco negativo no CSV e rejeitado na validacao", () => {
  const plano = planImport({ csvText: csvCom(linhaFicticia({ preco: "-10" })) });
  assert.equal(plano.ok, false);
  assert.equal(plano.registrosValidos, 0);
});

// === 27/28/29. volume negativo rejeitado / prazo zero e inteiro validos aceitos ===
test("volumeToneladas negativo e rejeitado na validacao", () => {
  const plano = planImport({ csvText: csvCom(linhaFicticia({ volumeToneladas: "-5" })) });
  assert.equal(plano.ok, false);
});

test("prazoPagamentoDias igual a zero e aceito (regra e >= 0)", () => {
  const plano = planImport({ csvText: csvCom(linhaFicticia({ prazoPagamentoDias: "0" })) });
  assert.equal(plano.ok, true);
  assert.equal(plano.novos[0].prazoPagamentoDias, 0);
});

// === 31. data invalida chega ao validador existente e e rejeitada ===
test("dataCotacao invalida (dia inexistente no calendario) e rejeitada pelo validador existente", () => {
  const plano = planImport({ csvText: csvCom(linhaFicticia({ dataCotacao: "2026-02-30", anoReferencia: "2026" })) });
  assert.equal(plano.ok, false);
  assert.ok(plano.errors.some((e) => e.type === "DATA_INVALIDA"));
});

// === 32. enum invalido chega ao validador existente e e rejeitado ===
test("modalidadeEntrega fora do enum e rejeitada pelo validador existente", () => {
  const plano = planImport({ csvText: csvCom(linhaFicticia({ modalidadeEntrega: "FRETE_GRATIS" })) });
  assert.equal(plano.ok, false);
  assert.ok(plano.errors.some((e) => e.type === "VALOR_INVALIDO" && e.field === "modalidadeEntrega"));
});

// === 33. IDs duplicados no proprio CSV ===
test("dois registros com o mesmo id no mesmo CSV geram ID_DUPLICADO", () => {
  const plano = planImport({
    csvText: csvCom(
      linhaFicticia({ id: "fp-duplicado", dataCotacao: "2026-01-01", anoReferencia: "2026" }),
      linhaFicticia({ id: "fp-duplicado", dataCotacao: "2026-01-02", anoReferencia: "2026" }),
    ),
  });
  assert.equal(plano.ok, false);
  assert.ok(plano.errors.some((e) => e.type === "ID_DUPLICADO"));
});

// === 36/37. --write cria saida valida, com ordenacao deterministica ===
test("planImport + escreverSaidaAtomica cria uma saida privada valida e ordenada", () => {
  const saida = join(dir, "saida.private.json");
  const plano = planImport({
    csvText: csvCom(
      linhaFicticia({ id: "fp-b", dataCotacao: "2026-02-01", anoReferencia: "2026" }),
      linhaFicticia({ id: "fp-a", dataCotacao: "2026-01-01", anoReferencia: "2026" }),
    ),
  });
  assert.equal(plano.ok, true);
  escreverSaidaAtomica(saida, plano.outputFinal);

  const gravado = JSON.parse(readFileSync(saida, "utf-8"));
  assert.deepEqual(gravado.records.map((r) => r.id), ["fp-a", "fp-b"]); // ordenado por data
  const v = loadAndValidateHistoryFile(saida);
  assert.equal(v.valid, true);
});

// === 38. importacao repetida do mesmo conteudo e idempotente ===
test("importar o mesmo CSV duas vezes contra a mesma saida e idempotente (0 novos na segunda vez)", () => {
  const saida = join(dir, "saida.private.json");
  const csvText = csvCom(linhaFicticia({ id: "fp-idempotente" }));

  const plano1 = planImport({ csvText });
  escreverSaidaAtomica(saida, plano1.outputFinal);

  const existente = carregarSaidaExistente(saida);
  const plano2 = planImport({ csvText, saidaExistente: existente });
  assert.equal(plano2.ok, true);
  assert.equal(plano2.novos.length, 0);
  assert.deepEqual(plano2.jaExistentes, ["fp-idempotente"]);
});

// === 39/40. ID existente com conteudo diferente gera conflito; conflito nao altera arquivo ===
test("id existente com conteudo diferente gera conflito e nao altera o arquivo", () => {
  const saida = join(dir, "saida.private.json");
  const plano1 = planImport({ csvText: csvCom(linhaFicticia({ id: "fp-conflito", preco: "100,00" })) });
  escreverSaidaAtomica(saida, plano1.outputFinal);
  const conteudoAntes = readFileSync(saida, "utf-8");

  const existente = carregarSaidaExistente(saida);
  const plano2 = planImport({ csvText: csvCom(linhaFicticia({ id: "fp-conflito", preco: "999,00" })), saidaExistente: existente });
  assert.equal(plano2.ok, false);
  assert.equal(plano2.conflitos.length, 1);
  assert.equal(plano2.conflitos[0].id, "fp-conflito");
  assert.equal(plano2.outputFinal, null);

  // nao escrevemos nada nesse cenario (a CLI so escreve quando plano.ok) -- confirma que o arquivo continua igual
  assert.equal(readFileSync(saida, "utf-8"), conteudoAntes);
});

// === 41. registro invalido nao altera arquivo ===
test("um registro invalido no CSV deixa o plano invalido e outputFinal null (arquivo nao seria alterado)", () => {
  const plano = planImport({ csvText: csvCom(linhaFicticia({ preco: "-1" })) });
  assert.equal(plano.ok, false);
  assert.equal(plano.outputFinal, null);
});

// === 42. saida existente invalida nao e sobrescrita ===
test("saida existente mas invalida (JSON quebrado o suficiente para falhar validacao) nao e sobrescrita", () => {
  const saida = join(dir, "saida.private.json");
  writeFileSync(saida, JSON.stringify({ schemaVersion: 1, description: "teste", records: [{ id: "" }] }), "utf-8");
  const existente = carregarSaidaExistente(saida);
  assert.equal(existente.valido, false);

  const plano = planImport({ csvText: csvCom(linhaFicticia()), saidaExistente: existente });
  assert.equal(plano.ok, false);
  assert.equal(plano.saidaExistenteInvalida, true);
  assert.equal(plano.outputFinal, null);
});

// === 45. arquivo temporario e removido apos erro ===
test("arquivo temporario e removido do disco se a escrita falhar", () => {
  const saida = join(dir, "saida.private.json");
  // BigInt nao serializa em JSON.stringify -- forca a escrita a falhar de proposito
  const dadosInvalidosParaJson = { schemaVersion: 1, description: "teste", records: [], quebraJson: 10n };
  assert.throws(() => escreverSaidaAtomica(saida, dadosInvalidosParaJson));
  const arquivosNoDir = readdirSync(dir);
  assert.deepEqual(arquivosNoDir, []); // nenhum .tmp-* sobrou, e o arquivo final nao foi criado
  assert.equal(existsSync(saida), false);
});

// === 50. arquivo gerado passa em loadAndValidateHistoryFile ===
test("arquivo gerado por escreverSaidaAtomica passa integralmente em loadAndValidateHistoryFile", () => {
  const saida = join(dir, "saida.private.json");
  const plano = planImport({ csvText: csvCom(linhaFicticia()) });
  escreverSaidaAtomica(saida, plano.outputFinal);
  const v = loadAndValidateHistoryFile(saida);
  assert.equal(v.valid, true);
  assert.equal(v.recordCount, 1);
});

// === descricao padrao usada quando a saida ainda nao existe ===
test("um arquivo de saida novo usa a descricao padrao, sem nome de empresa/fornecedor/preco", () => {
  const plano = planImport({ csvText: csvCom(linhaFicticia()) });
  assert.equal(plano.outputFinal.description, DESCRICAO_PADRAO_SAIDA);
  assert.doesNotMatch(plano.outputFinal.description, /sinobras|florestal|fornecedor|r\$|\d/i);
});

test("uma saida ja existente preserva sua propria description ao adicionar registros novos", () => {
  const saida = join(dir, "saida.private.json");
  writeFileSync(saida, JSON.stringify({ schemaVersion: 1, description: "Descricao customizada de teste.", records: [] }), "utf-8");
  const existente = carregarSaidaExistente(saida);
  const plano = planImport({ csvText: csvCom(linhaFicticia()), saidaExistente: existente });
  assert.equal(plano.ok, true);
  assert.equal(plano.outputFinal.description, "Descricao customizada de teste.");
});
