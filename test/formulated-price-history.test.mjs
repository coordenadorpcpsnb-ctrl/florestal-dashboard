/**
 * test/formulated-price-history.test.mjs — Testes do modulo formulated-price-history.mjs.
 *
 * Usa node:test (nativo do Node 22, sem instalar framework). Rode com:
 *   node --test
 *   npm test
 *
 * IMPORTANTE: todos os registros usados aqui sao DADOS DE TESTE FICTICIOS -- nao sao
 * preco, fornecedor, volume ou data reais da empresa, e nunca sao gravados na base
 * real (data/formulated-prices-history.json). Os testes de arquivo usam um arquivo
 * temporario em node:os.tmpdir(), criado e apagado dentro do proprio teste.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateHistory,
  validateRecord,
  isValidIsoDate,
  normalizeRecord,
  readHistoryFile,
  loadAndValidateHistoryFile,
  TIPOS_ERRO,
} from "../formulated-price-history.mjs";

// --- fixtures de teste (DADOS FICTICIOS — nao usar como referencia de preco real) ---

/** Registro completo, com todos os campos preenchidos. FICTICIO. */
function registroCompletoFicticio(overrides = {}) {
  return {
    id: "teste-completo-001",
    dataCotacao: "2026-03-10",
    dataCompra: "2026-03-15",
    anoReferencia: 2026,
    produto: "Formulado Teste 04-14-08",
    formula: "04-14-08",
    categoriaFormula: "plantio",
    fornecedor: "Fornecedor Ficticio de Teste Ltda",
    preco: 3200.5,
    moeda: "BRL",
    unidadePreco: "BRL_TON",
    modalidadeEntrega: "CIF_DESTINO",
    destino: "Municipio Ficticio de Teste - TO",
    volumeToneladas: 120,
    prazoPagamentoDias: 30,
    validadeProposta: "2026-03-20",
    fonteRegistro: "COTACAO",
    observacoes: "Registro de teste, sem relacao com dados reais.",
    ...overrides,
  };
}

/** Registro minimo: so os campos obrigatorios, opcionais explicitamente null. FICTICIO. */
function registroMinimoFicticio(overrides = {}) {
  return {
    id: "teste-minimo-001",
    dataCotacao: "2026-03-10",
    dataCompra: null,
    anoReferencia: 2026,
    produto: "Formulado Teste Minimo",
    formula: null,
    fornecedor: "Fornecedor Ficticio Minimo",
    preco: 1,
    moeda: "BRL",
    unidadePreco: "BRL_TON",
    modalidadeEntrega: "NAO_INFORMADO",
    destino: null,
    volumeToneladas: null,
    prazoPagamentoDias: null,
    validadeProposta: null,
    fonteRegistro: "REGISTRO_INTERNO",
    observacoes: null,
    ...overrides,
  };
}

function baseVazia() {
  return { schemaVersion: 1, description: "Base de teste ficticia, vazia.", records: [] };
}

function baseCom(records) {
  return { schemaVersion: 1, description: "Base de teste ficticia.", records };
}

// === 1. base vazia valida ===
test("base vazia e valida", () => {
  const r = validateHistory(baseVazia());
  assert.equal(r.valid, true);
  assert.equal(r.recordCount, 0);
  assert.deepEqual(r.errors, []);
  assert.match(r.summary, /vazia/i);
});

// === 2. registro completo valido ===
test("registro completo (todos os campos preenchidos) e valido", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio()]));
  assert.equal(r.valid, true);
  assert.equal(r.recordCount, 1);
  assert.deepEqual(r.errors, []);
});

// === 3. registro minimo valido ===
test("registro minimo (so obrigatorios, opcionais null) e valido", () => {
  const r = validateHistory(baseCom([registroMinimoFicticio()]));
  assert.equal(r.valid, true);
  assert.equal(r.recordCount, 1);
  assert.deepEqual(r.errors, []);
});

// === 4. ID duplicado ===
test("ID duplicado e rejeitado", () => {
  const a = registroCompletoFicticio({ id: "duplicado-teste" });
  const b = registroMinimoFicticio({ id: "duplicado-teste" });
  const r = validateHistory(baseCom([a, b]));
  assert.equal(r.valid, false);
  const erros = r.errors.filter((e) => e.type === TIPOS_ERRO.ID_DUPLICADO);
  assert.equal(erros.length, 1);
  assert.match(erros[0].message, /duplicado-teste/);
});

// === 5. preco igual a zero ===
test("preco igual a zero e rejeitado", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio({ preco: 0 })]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.VALOR_INVALIDO && e.field === "preco"));
});

// === 6. preco negativo ===
test("preco negativo e rejeitado", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio({ preco: -10 })]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.VALOR_INVALIDO && e.field === "preco"));
});

// === 7. data de cotacao invalida ===
test("dataCotacao invalida (dia inexistente no calendario) e rejeitada", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio({ dataCotacao: "2026-02-30" })]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.DATA_INVALIDA && e.field === "dataCotacao"));
});

test("dataCotacao em formato errado (nao ISO) e rejeitada", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio({ dataCotacao: "10/03/2026" })]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.DATA_INVALIDA && e.field === "dataCotacao"));
});

// === 8. anoReferencia diferente do ano da dataCotacao ===
test("anoReferencia inconsistente com o ano de dataCotacao e rejeitado", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio({ dataCotacao: "2026-03-10", anoReferencia: 2025 })]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.ANO_INCONSISTENTE && e.field === "anoReferencia"));
});

// === 9. modalidade de entrega invalida ===
test("modalidadeEntrega fora do enum e rejeitada", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio({ modalidadeEntrega: "FRETE_GRATIS" })]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.VALOR_INVALIDO && e.field === "modalidadeEntrega"));
});

// === 10. unidade de preco invalida ===
test("unidadePreco fora do enum e rejeitada com tipo UNIDADE_INVALIDA", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio({ unidadePreco: "USD_TON" })]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.UNIDADE_INVALIDA && e.field === "unidadePreco"));
});

// === 11. campo obrigatorio ausente ===
test("campo obrigatorio ausente (fornecedor) e rejeitado", () => {
  const registro = registroCompletoFicticio();
  delete registro.fornecedor;
  const r = validateHistory(baseCom([registro]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE && e.field === "fornecedor"));
});

test("campo obrigatorio ausente (id) e rejeitado", () => {
  const registro = registroCompletoFicticio();
  delete registro.id;
  const r = validateHistory(baseCom([registro]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE && e.field === "id"));
});

// === 12. valor null em campo opcional ===
test("null em campos opcionais (dataCompra, destino, volumeToneladas, observacoes) e aceito", () => {
  const registro = registroCompletoFicticio({
    dataCompra: null,
    destino: null,
    volumeToneladas: null,
    prazoPagamentoDias: null,
    validadeProposta: null,
    categoriaFormula: null,
    observacoes: null,
  });
  const r = validateHistory(baseCom([registro]));
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, []);
});

test("formula null (informacao desconhecida) e aceita", () => {
  const r = validateHistory(baseCom([registroCompletoFicticio({ formula: null })]));
  assert.equal(r.valid, true);
});

// === 13. arquivo com JSON invalido ===
test("arquivo com JSON invalido produz erro do tipo JSON_INVALIDO", () => {
  const dir = mkdtempSync(join(tmpdir(), "formulated-history-test-"));
  const arquivo = join(dir, "invalido.json");
  writeFileSync(arquivo, "{ isto nao e json valido ", "utf-8");
  try {
    const lido = readHistoryFile(arquivo);
    assert.equal(lido.ok, false);
    assert.equal(lido.errors[0].type, TIPOS_ERRO.JSON_INVALIDO);

    const r = loadAndValidateHistoryFile(arquivo);
    assert.equal(r.valid, false);
    assert.equal(r.errors[0].type, TIPOS_ERRO.JSON_INVALIDO);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// === 14. ausencia do arquivo ===
test("arquivo inexistente produz erro do tipo ARQUIVO_INEXISTENTE", () => {
  const dir = mkdtempSync(join(tmpdir(), "formulated-history-test-"));
  const arquivoInexistente = join(dir, "nao-existe.json");
  try {
    const lido = readHistoryFile(arquivoInexistente);
    assert.equal(lido.ok, false);
    assert.equal(lido.errors[0].type, TIPOS_ERRO.ARQUIVO_INEXISTENTE);

    const r = loadAndValidateHistoryFile(arquivoInexistente);
    assert.equal(r.valid, false);
    assert.equal(r.errors[0].type, TIPOS_ERRO.ARQUIVO_INEXISTENTE);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// === testes complementares: estrutura raiz e normalizacao ===

test("erro estrutural quando records nao e array", () => {
  const r = validateHistory({ schemaVersion: 1, description: "teste", records: "nao-e-array" });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.ESTRUTURAL));
});

test("erro estrutural quando schemaVersion esta errada", () => {
  const r = validateHistory({ schemaVersion: 99, description: "teste", records: [] });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.type === TIPOS_ERRO.ESTRUTURAL));
});

test("erro estrutural quando o payload raiz nao e um objeto", () => {
  const r = validateHistory(["nao", "e", "objeto"]);
  assert.equal(r.valid, false);
  assert.equal(r.errors[0].type, TIPOS_ERRO.ESTRUTURAL);
});

test("isValidIsoDate distingue data real de data com formato certo mas invalida", () => {
  assert.equal(isValidIsoDate("2026-03-10"), true);
  assert.equal(isValidIsoDate("2024-02-29"), true); // 2024 e bissexto
  assert.equal(isValidIsoDate("2023-02-29"), false); // 2023 nao e bissexto
  assert.equal(isValidIsoDate("2026-13-01"), false); // mes invalido
  assert.equal(isValidIsoDate("10-03-2026"), false); // formato errado
  assert.equal(isValidIsoDate(null), false);
});

test("normalizeRecord apara espacos so em campos de texto, sem tocar em preco/datas/numeros", () => {
  const sujo = registroCompletoFicticio({
    id: "  teste-normalizacao  ",
    produto: "  Formulado Com Espacos  ",
    fornecedor: "\tFornecedor Com Tab\n",
    preco: 3200.5,
    dataCotacao: "2026-03-10",
  });
  const limpo = normalizeRecord(sujo);
  assert.equal(limpo.id, "teste-normalizacao");
  assert.equal(limpo.produto, "Formulado Com Espacos");
  assert.equal(limpo.fornecedor, "Fornecedor Com Tab");
  // preco e data continuam exatamente como estavam — normalizacao nunca mexe neles
  assert.equal(limpo.preco, 3200.5);
  assert.equal(limpo.dataCotacao, "2026-03-10");
});

test("validateRecord isolado retorna lista vazia para registro completo valido", () => {
  const erros = validateRecord(registroCompletoFicticio(), 0);
  assert.deepEqual(erros, []);
});

test("validateRecord isolado acumula mais de um erro no mesmo registro", () => {
  const registro = registroCompletoFicticio({ preco: -5, modalidadeEntrega: "INVALIDA" });
  delete registro.fornecedor;
  const erros = validateRecord(registro, 0);
  const tipos = erros.map((e) => e.type).sort();
  assert.ok(tipos.includes(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE));
  assert.ok(tipos.includes(TIPOS_ERRO.VALOR_INVALIDO));
  assert.ok(erros.length >= 3);
});
