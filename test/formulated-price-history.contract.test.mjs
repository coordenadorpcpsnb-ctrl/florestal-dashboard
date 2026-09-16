/**
 * test/formulated-price-history.contract.test.mjs — Testes de sincronia entre o
 * schema formal (schemas/formulated-price-history.schema.json) e as constantes
 * exportadas por formulated-price-history.mjs.
 *
 * Nao instala AJV nem nenhuma outra biblioteca de JSON Schema (fora do escopo desta
 * etapa). Em vez disso, LE o arquivo de schema real e compara os conjuntos de campos
 * e enums que ele declara com as constantes que o modulo JavaScript usa para validar
 * -- nada aqui e uma lista redigitada a mao. Se alguem editar um dos dois lados sem
 * editar o outro, um destes testes falha.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CAMPOS_RAIZ_PERMITIDOS,
  CAMPOS_RAIZ_OBRIGATORIOS,
  CAMPOS_RECORD_PERMITIDOS,
  CAMPOS_RECORD_OBRIGATORIOS,
  MODALIDADES_ENTREGA_VALIDAS,
  FONTES_REGISTRO_VALIDAS,
  MOEDAS_SUPORTADAS,
  UNIDADES_PRECO_SUPORTADAS,
} from "../formulated-price-history.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, "..", "schemas", "formulated-price-history.schema.json");
const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));

/** Compara dois arrays como conjuntos (ordem nao importa, sem duplicar listas no teste). */
function assertSameSet(actual, expected, label) {
  const a = [...new Set(actual)].sort();
  const b = [...new Set(expected)].sort();
  assert.deepEqual(a, b, `${label}: schema tem ${JSON.stringify(a)}, JS tem ${JSON.stringify(b)}`);
}

test("contrato: propriedades da raiz do schema == CAMPOS_RAIZ_PERMITIDOS", () => {
  assertSameSet(Object.keys(schema.properties), CAMPOS_RAIZ_PERMITIDOS, "propriedades da raiz");
});

test("contrato: required da raiz do schema == CAMPOS_RAIZ_OBRIGATORIOS", () => {
  assertSameSet(schema.required, CAMPOS_RAIZ_OBRIGATORIOS, "required da raiz");
});

test("contrato: schema tem additionalProperties:false na raiz", () => {
  assert.equal(schema.additionalProperties, false);
});

test("contrato: propriedades do registro do schema == CAMPOS_RECORD_PERMITIDOS", () => {
  const propriedadesRegistro = Object.keys(schema.$defs.record.properties);
  assertSameSet(propriedadesRegistro, CAMPOS_RECORD_PERMITIDOS, "propriedades do registro");
});

test("contrato: required do registro do schema == CAMPOS_RECORD_OBRIGATORIOS", () => {
  assertSameSet(schema.$defs.record.required, CAMPOS_RECORD_OBRIGATORIOS, "required do registro");
});

test("contrato: schema tem additionalProperties:false no registro", () => {
  assert.equal(schema.$defs.record.additionalProperties, false);
});

test("contrato: enum de modalidadeEntrega do schema == MODALIDADES_ENTREGA_VALIDAS", () => {
  assertSameSet(schema.$defs.record.properties.modalidadeEntrega.enum, MODALIDADES_ENTREGA_VALIDAS, "enum modalidadeEntrega");
});

test("contrato: enum de fonteRegistro do schema == FONTES_REGISTRO_VALIDAS", () => {
  assertSameSet(schema.$defs.record.properties.fonteRegistro.enum, FONTES_REGISTRO_VALIDAS, "enum fonteRegistro");
});

test("contrato: enum de moeda do schema == MOEDAS_SUPORTADAS", () => {
  assertSameSet(schema.$defs.record.properties.moeda.enum, MOEDAS_SUPORTADAS, "enum moeda");
});

test("contrato: enum de unidadePreco do schema == UNIDADES_PRECO_SUPORTADAS", () => {
  assertSameSet(schema.$defs.record.properties.unidadePreco.enum, UNIDADES_PRECO_SUPORTADAS, "enum unidadePreco");
});

test("contrato: nenhum campo obrigatorio do registro esta fora da lista de campos permitidos", () => {
  for (const campo of CAMPOS_RECORD_OBRIGATORIOS) {
    assert.ok(CAMPOS_RECORD_PERMITIDOS.includes(campo), `${campo} esta em OBRIGATORIOS mas nao em PERMITIDOS`);
  }
});

test("contrato: schemaVersion do schema (const) bate com SCHEMA_VERSION do JS", async () => {
  const { SCHEMA_VERSION } = await import("../formulated-price-history.mjs");
  assert.equal(schema.properties.schemaVersion.const, SCHEMA_VERSION);
});
