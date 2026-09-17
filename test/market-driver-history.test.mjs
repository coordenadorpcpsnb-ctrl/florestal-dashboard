/**
 * test/market-driver-history.test.mjs — Testes do modulo de contrato
 * market-driver-history.mjs (Etapa 5). Cobre validacao de envelope/observacao/
 * metadata, isValidIsoDate/isValidYearMonth, e sincronia schema <-> constantes
 * JS (mesmo padrao de formulated-price-history.contract.test.mjs).
 *
 * DADOS 100% FICTICIOS. Nenhum valor real de mercado nem de formulado.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  SCHEMA_VERSION,
  CAMPOS_RAIZ_PERMITIDOS,
  CAMPOS_OBSERVACAO_PERMITIDOS,
  CAMPOS_METADATA_PERMITIDOS,
  CAMPOS_SOURCE_PERMITIDOS,
  INDICADORES_SUPORTADOS,
  UNIDADES_SUPORTADAS,
  INDICADOR_UNIDADE,
  STATUS_OBSERVACAO,
  CONFIANCA_EXTRACAO,
  TIPOS_CONFLITO,
  isValidIsoDate,
  isValidYearMonth,
  validateObservation,
  validateRoot,
  validateHistory,
} from "../market-driver-history.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, "..", "schemas", "market-driver-history.schema.json");
const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));

function assertSameSet(actual, expected, label) {
  const a = [...new Set(actual)].sort();
  const b = [...new Set(expected)].sort();
  assert.deepEqual(a, b, `${label}: schema tem ${JSON.stringify(a)}, JS tem ${JSON.stringify(b)}`);
}

function observacaoFicticia(overrides = {}) {
  return {
    indicator: "dolar",
    value: 5.0,
    unit: "BRL_USD",
    referenceDate: null,
    referencePeriod: null,
    collectedAt: "2026-01-10T10:00:00.000Z",
    commitDate: "2026-01-10T10:00:01+00:00",
    commitHash: "abc1234567",
    sourceStatus: STATUS_OBSERVACAO.OBSERVADO,
    sourceName: "BCB PTAX",
    sourceMessage: "ok",
    extractionConfidence: CONFIANCA_EXTRACAO.PARCIAL,
    deduplicationKey: "dolar|2026-01-10T10:00:00.000Z|BRL_USD|abc1234567",
    metadata: {
      supportingSnapshotCount: 1,
      firstCollectedAt: "2026-01-10T10:00:00.000Z",
      lastCollectedAt: "2026-01-10T10:00:00.000Z",
      commitHashes: ["abc1234567"],
      conflict: false,
      conflictType: null,
    },
    ...overrides,
  };
}

function serieFicticia(observations = []) {
  return {
    schemaVersion: 1,
    description: "serie ficticia de teste",
    generatedAt: "2026-01-01T00:00:00.000Z",
    source: { type: "GIT_HISTORY", file: "data.json", commitCountAudited: 1, snapshotCountParsed: 1, snapshotCountRejected: 0 },
    observations,
  };
}

// === contrato: schema <-> JS ===

test("contrato: propriedades da raiz do schema == CAMPOS_RAIZ_PERMITIDOS", () => {
  assertSameSet(Object.keys(schema.properties), CAMPOS_RAIZ_PERMITIDOS, "propriedades da raiz");
});

test("contrato: required da raiz do schema == CAMPOS_RAIZ_PERMITIDOS (tudo obrigatorio)", () => {
  assertSameSet(schema.required, CAMPOS_RAIZ_PERMITIDOS, "required da raiz");
});

test("contrato: schema tem additionalProperties:false na raiz", () => {
  assert.equal(schema.additionalProperties, false);
});

test("contrato: propriedades de observation do schema == CAMPOS_OBSERVACAO_PERMITIDOS", () => {
  assertSameSet(Object.keys(schema.$defs.observation.properties), CAMPOS_OBSERVACAO_PERMITIDOS, "propriedades de observation");
  assertSameSet(schema.$defs.observation.required, CAMPOS_OBSERVACAO_PERMITIDOS, "required de observation");
  assert.equal(schema.$defs.observation.additionalProperties, false);
});

test("contrato: propriedades de metadata do schema == CAMPOS_METADATA_PERMITIDOS", () => {
  const metaSchema = schema.$defs.observation.properties.metadata;
  assertSameSet(Object.keys(metaSchema.properties), CAMPOS_METADATA_PERMITIDOS, "propriedades de metadata");
  assert.equal(metaSchema.additionalProperties, false);
});

test("contrato: propriedades de source do schema == CAMPOS_SOURCE_PERMITIDOS", () => {
  const sourceSchema = schema.properties.source;
  assertSameSet(Object.keys(sourceSchema.properties), CAMPOS_SOURCE_PERMITIDOS, "propriedades de source");
  assert.equal(sourceSchema.additionalProperties, false);
});

test("contrato: enum de indicator do schema == INDICADORES_SUPORTADOS", () => {
  assertSameSet(schema.$defs.observation.properties.indicator.enum, INDICADORES_SUPORTADOS, "enum indicator");
});

test("contrato: enum de unit do schema == UNIDADES_SUPORTADAS", () => {
  assertSameSet(schema.$defs.observation.properties.unit.enum, UNIDADES_SUPORTADAS, "enum unit");
});

test("contrato: enum de sourceStatus do schema == valores de STATUS_OBSERVACAO", () => {
  assertSameSet(schema.$defs.observation.properties.sourceStatus.enum, Object.values(STATUS_OBSERVACAO), "enum sourceStatus");
});

test("contrato: enum de extractionConfidence do schema == valores de CONFIANCA_EXTRACAO", () => {
  assertSameSet(schema.$defs.observation.properties.extractionConfidence.enum, Object.values(CONFIANCA_EXTRACAO), "enum extractionConfidence");
});

test("contrato: schemaVersion do schema (const) bate com SCHEMA_VERSION do JS", () => {
  assert.equal(schema.properties.schemaVersion.const, SCHEMA_VERSION);
});

test("contrato: todo indicador suportado tem uma unidade fixa em INDICADOR_UNIDADE", () => {
  for (const indicador of INDICADORES_SUPORTADOS) {
    assert.ok(UNIDADES_SUPORTADAS.includes(INDICADOR_UNIDADE[indicador]), `indicador "${indicador}" sem unidade valida`);
  }
});

test("contrato: indicadores removidos do sistema (diesel/glifosato) e derivados (troca) NAO estao no enum", () => {
  for (const naoDeveExistir of ["diesel", "glifosato", "trocaMap", "trocaUreia", "troca"]) {
    assert.ok(!INDICADORES_SUPORTADOS.includes(naoDeveExistir), `"${naoDeveExistir}" nao deveria estar em INDICADORES_SUPORTADOS`);
  }
});

// === isValidIsoDate / isValidYearMonth ===

test("isValidIsoDate: aceita data real, rejeita formato invalido e data inexistente", () => {
  assert.equal(isValidIsoDate("2026-01-10"), true);
  assert.equal(isValidIsoDate("2026-02-30"), false); // fevereiro nao tem 30
  assert.equal(isValidIsoDate("10/01/2026"), false);
  assert.equal(isValidIsoDate(null), false);
});

test("isValidYearMonth: aceita YYYY-MM com mes 01-12, rejeita o resto", () => {
  assert.equal(isValidYearMonth("2026-08"), true);
  assert.equal(isValidYearMonth("2026-13"), false);
  assert.equal(isValidYearMonth("2026-00"), false);
  assert.equal(isValidYearMonth("2026-08-01"), false);
  assert.equal(isValidYearMonth(null), false);
});

// === validateObservation ===

test("validateObservation: observacao ficticia completa e valida", () => {
  assert.deepEqual(validateObservation(observacaoFicticia(), 0), []);
});

test("validateObservation: rejeita campo desconhecido", () => {
  const erros = validateObservation(observacaoFicticia({ formulationId: "fp-ficticio" }), 0);
  assert.ok(erros.some((e) => e.type === "CAMPO_DESCONHECIDO" && e.field === "formulationId"));
});

test("validateObservation: indicator invalido (ex.: diesel, que nao existe) e rejeitado", () => {
  const erros = validateObservation(observacaoFicticia({ indicator: "diesel" }), 0);
  assert.ok(erros.some((e) => e.field === "indicator"));
});

test("validateObservation: unit invalida e rejeitada", () => {
  const erros = validateObservation(observacaoFicticia({ unit: "BRL_LITRO" }), 0);
  assert.ok(erros.some((e) => e.field === "unit"));
});

test("validateObservation: value aceita numero ou null, rejeita string", () => {
  assert.deepEqual(validateObservation(observacaoFicticia({ value: null }), 0), []);
  const erros = validateObservation(observacaoFicticia({ value: "400" }), 0);
  assert.ok(erros.some((e) => e.field === "value"));
});

test("validateObservation: commitHash precisa ter exatamente 10 hex chars", () => {
  assert.deepEqual(validateObservation(observacaoFicticia({ commitHash: "0123456789" }), 0), []);
  assert.ok(validateObservation(observacaoFicticia({ commitHash: "abc" }), 0).some((e) => e.type === "HASH_INVALIDO"));
  assert.ok(validateObservation(observacaoFicticia({ commitHash: "ABCDEF1234" }), 0).some((e) => e.type === "HASH_INVALIDO"));
});

test("validateObservation: referenceDate aceita YYYY-MM-DD ou null, rejeita o resto", () => {
  assert.deepEqual(validateObservation(observacaoFicticia({ referenceDate: "2026-08-10" }), 0), []);
  assert.ok(validateObservation(observacaoFicticia({ referenceDate: "10/08/2026" }), 0).some((e) => e.field === "referenceDate"));
});

test("validateObservation: referencePeriod aceita YYYY-MM ou null, rejeita YYYY-MM-DD", () => {
  assert.deepEqual(validateObservation(observacaoFicticia({ referencePeriod: "2026-08" }), 0), []);
  assert.ok(validateObservation(observacaoFicticia({ referencePeriod: "2026-08-10" }), 0).some((e) => e.field === "referencePeriod"));
});

test("validateObservation: sourceStatus so aceita os 5 valores exatos", () => {
  assert.ok(validateObservation(observacaoFicticia({ sourceStatus: "CONFIRMADO" }), 0).some((e) => e.field === "sourceStatus"));
});

test("validateObservation: campo obrigatorio ausente (mesmo que aceite null) e erro", () => {
  const obs = observacaoFicticia();
  delete obs.sourceName;
  const erros = validateObservation(obs, 0);
  assert.ok(erros.some((e) => e.type === "CAMPO_OBRIGATORIO_AUSENTE" && e.field === "sourceName"));
});

test("validateObservation: metadata.conflictType deve ser null quando conflict=false", () => {
  const erros = validateObservation(observacaoFicticia({ metadata: { ...observacaoFicticia().metadata, conflict: false, conflictType: "VALORES_DIVERGENTES" } }), 0);
  assert.ok(erros.some((e) => e.field === "metadata.conflictType"));
});

test("validateObservation: metadata.conflictType valido quando conflict=true", () => {
  const erros = validateObservation(observacaoFicticia({ metadata: { ...observacaoFicticia().metadata, conflict: true, conflictType: TIPOS_CONFLITO.VALORES_DIVERGENTES } }), 0);
  assert.deepEqual(erros, []);
});

test("validateObservation: metadata.commitHashes rejeita hash mal formado", () => {
  const erros = validateObservation(observacaoFicticia({ metadata: { ...observacaoFicticia().metadata, commitHashes: ["xyz"] } }), 0);
  assert.ok(erros.some((e) => e.field === "metadata.commitHashes"));
});

test("validateObservation: metadata precisa ser objeto (nao array, nao null)", () => {
  assert.ok(validateObservation(observacaoFicticia({ metadata: null }), 0).length > 0);
  assert.ok(validateObservation(observacaoFicticia({ metadata: [] }), 0).length > 0);
});

// === validateRoot / validateHistory ===

test("validateRoot: serie ficticia minima e valida", () => {
  assert.deepEqual(validateRoot(serieFicticia()), []);
});

test("validateRoot: rejeita schemaVersion errada", () => {
  const s = serieFicticia();
  s.schemaVersion = 2;
  assert.ok(validateRoot(s).some((e) => /schemaVersion/.test(e.message)));
});

test("validateRoot: generatedAt aceita null (contrato publico vazio)", () => {
  const s = serieFicticia();
  s.generatedAt = null;
  assert.deepEqual(validateRoot(s), []);
});

test("validateRoot: rejeita campo desconhecido na raiz", () => {
  const s = { ...serieFicticia(), campoInventado: 1 };
  assert.ok(validateRoot(s).some((e) => e.type === "CAMPO_DESCONHECIDO"));
});

test("validateHistory: serie vazia (observations: []) e valida", () => {
  const r = validateHistory(serieFicticia([]));
  assert.equal(r.valid, true);
  assert.equal(r.observationCount, 0);
  assert.match(r.summary, /vazia/i);
});

test("validateHistory: serie com uma observacao ficticia valida", () => {
  const r = validateHistory(serieFicticia([observacaoFicticia()]));
  assert.equal(r.valid, true);
  assert.equal(r.observationCount, 1);
});

test("validateHistory: erro em uma observacao invalida a serie inteira, sem lancar excecao", () => {
  const r = validateHistory(serieFicticia([observacaoFicticia({ indicator: "invalido" })]));
  assert.equal(r.valid, false);
  assert.ok(r.errors.length > 0);
});

test("validateHistory: nunca ecoa o VALOR de nenhum campo nas mensagens de erro (so tipo/campo/indice)", () => {
  const r = validateHistory(serieFicticia([observacaoFicticia({ value: "MARCADOR_SIGILOSO_FICTICIO_999" })]));
  const serializado = JSON.stringify(r.errors);
  assert.doesNotMatch(serializado, /MARCADOR_SIGILOSO_FICTICIO_999/);
});

// ============================================================================
// Emenda arquitetural (Etapa 5): separacao de dominios -- o schema/modulo dos
// direcionadores NUNCA tem campo de identificacao, formula ou composicao de
// formulado. Isso pertence a um catalogo tecnico privado separado, que esta
// etapa explicitamente NAO cria.
// ============================================================================

test("emenda: nenhum campo de formulado/catalogo tecnico existe em CAMPOS_OBSERVACAO_PERMITIDOS", () => {
  const proibidos = ["formulationId", "formula", "micronutrientes", "composicao", "percentualUreia", "percentualMap", "percentualKcl"];
  for (const campo of proibidos) {
    assert.ok(!CAMPOS_OBSERVACAO_PERMITIDOS.includes(campo), `"${campo}" nao deveria estar em CAMPOS_OBSERVACAO_PERMITIDOS`);
  }
});

test("emenda: nenhum campo de formulado/catalogo tecnico existe em nenhuma parte do schema JSON (raiz, observation, metadata, source)", () => {
  const proibidos = ["formulationId", "formula", "micronutrientes", "composicao", "percentualUreia", "percentualMap", "percentualKcl"];
  const camposDoSchema = new Set([
    ...Object.keys(schema.properties),
    ...Object.keys(schema.$defs.observation.properties),
    ...Object.keys(schema.$defs.observation.properties.metadata.properties),
    ...Object.keys(schema.properties.source.properties),
  ]);
  for (const campo of proibidos) {
    assert.ok(!camposDoSchema.has(campo), `"${campo}" nao deveria estar em nenhuma parte do schema`);
  }
});
