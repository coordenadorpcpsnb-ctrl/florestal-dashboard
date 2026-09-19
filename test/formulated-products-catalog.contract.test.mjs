/**
 * test/formulated-products-catalog.contract.test.mjs — compara o JSON Schema no
 * disco (schemas/formulated-products-catalog.schema.json) com as constantes
 * exportadas por formulated-products-catalog.mjs, para pegar divergência entre os
 * dois sem redigitar as listas manualmente (lidas diretamente do schema).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as Catalogo from "../formulated-products-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(__dirname, "..", "schemas", "formulated-products-catalog.schema.json"), "utf-8"));
const defs = schema.$defs;

test("schemaVersion do schema (const) bate com SCHEMA_VERSION do JS", () => {
  assert.equal(schema.properties.schemaVersion.const, Catalogo.SCHEMA_VERSION);
});

test("additionalProperties: false na raiz e o schema exige exatamente os 3 campos", () => {
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), [...Catalogo.CAMPOS_RAIZ_OBRIGATORIOS].sort());
  assert.deepEqual(Object.keys(schema.properties).sort(), [...Catalogo.CAMPOS_RAIZ_PERMITIDOS].sort());
});

test("required + propriedades permitidas da formulação batem com as constantes JS", () => {
  const formulation = defs.formulation;
  assert.equal(formulation.additionalProperties, false);
  assert.deepEqual([...formulation.required].sort(), [...Catalogo.CAMPOS_FORMULACAO_OBRIGATORIOS].sort());
  assert.deepEqual(Object.keys(formulation.properties).sort(), [...Catalogo.CAMPOS_FORMULACAO_PERMITIDOS].sort());
});

test("enum status bate com STATUS_VALIDOS", () => {
  assert.deepEqual([...defs.formulation.properties.status.enum].sort(), [...Catalogo.STATUS_VALIDOS].sort());
});

test("enum informationQuality bate com QUALIDADE_INFORMACAO_VALIDA", () => {
  assert.deepEqual([...defs.formulation.properties.informationQuality.enum].sort(), [...Catalogo.QUALIDADE_INFORMACAO_VALIDA].sort());
});

test("macronutrientGuarantees: required, unit e estrutura batem com as constantes JS", () => {
  const mg = defs.macronutrientGuarantees;
  assert.deepEqual([...mg.required].sort(), [...Catalogo.CAMPOS_MACRONUTRIENTES].sort());
  assert.deepEqual(Object.keys(mg.properties).sort(), [...Catalogo.CAMPOS_MACRONUTRIENTES].sort());
  assert.deepEqual(mg.properties.unit.enum, [...Catalogo.UNIDADE_MACRONUTRIENTE_VALIDA]);
});

test("secondaryNutrientGuarantee: enums nutrient/unit e campos batem com as constantes JS", () => {
  const s = defs.secondaryNutrientGuarantee;
  assert.deepEqual([...s.properties.nutrient.enum].sort(), [...Catalogo.NUTRIENTE_SECUNDARIO_VALIDO].sort());
  assert.deepEqual([...s.properties.unit.enum].sort(), [...Catalogo.UNIDADE_NUTRIENTE_SECUNDARIO_VALIDA].sort());
  assert.deepEqual([...s.required].sort(), [...Catalogo.CAMPOS_NUTRIENTE_SECUNDARIO_OBRIGATORIOS].sort());
  assert.deepEqual(Object.keys(s.properties).sort(), [...Catalogo.CAMPOS_NUTRIENTE_SECUNDARIO_PERMITIDOS].sort());
});

test("micronutrient: enums element/unit e campos batem com as constantes JS", () => {
  const m = defs.micronutrient;
  assert.deepEqual([...m.properties.element.enum].sort(), [...Catalogo.MICRONUTRIENTE_VALIDO].sort());
  assert.deepEqual([...m.properties.unit.enum].sort(), [...Catalogo.UNIDADE_MICRONUTRIENTE_VALIDA].sort());
  assert.deepEqual([...m.required].sort(), [...Catalogo.CAMPOS_MICRONUTRIENTE_OBRIGATORIOS].sort());
  assert.deepEqual(Object.keys(m.properties).sort(), [...Catalogo.CAMPOS_MICRONUTRIENTE_PERMITIDOS].sort());
});

test("physicalComposition: completenessStatus e campos batem com as constantes JS", () => {
  const p = defs.physicalComposition;
  assert.deepEqual([...p.properties.completenessStatus.enum].sort(), [...Catalogo.COMPLETUDE_COMPOSICAO_VALIDA].sort());
  assert.deepEqual([...p.required].sort(), [...Catalogo.CAMPOS_COMPOSICAO_OBRIGATORIOS].sort());
  assert.deepEqual(Object.keys(p.properties).sort(), [...Catalogo.CAMPOS_COMPOSICAO_PERMITIDOS].sort());
});

test("physicalComponent: unit/sourceType e campos batem com as constantes JS", () => {
  const c = defs.physicalComponent;
  assert.deepEqual(c.properties.unit.enum, [...Catalogo.UNIDADE_COMPONENTE_VALIDA]);
  assert.deepEqual([...c.properties.sourceType.enum].sort(), [...Catalogo.ORIGEM_COMPONENTE_VALIDA].sort());
  assert.deepEqual([...c.required].sort(), [...Catalogo.CAMPOS_COMPONENTE_OBRIGATORIOS].sort());
  assert.deepEqual(Object.keys(c.properties).sort(), [...Catalogo.CAMPOS_COMPONENTE_PERMITIDOS].sort());
});

test("informationSource: enum type e campos batem com as constantes JS", () => {
  const s = defs.informationSource;
  assert.deepEqual([...s.properties.type.enum].sort(), [...Catalogo.TIPO_FONTE_VALIDO].sort());
  assert.deepEqual([...s.required].sort(), [...Catalogo.CAMPOS_FONTE_OBRIGATORIOS].sort());
  assert.deepEqual(Object.keys(s.properties).sort(), [...Catalogo.CAMPOS_FONTE_PERMITIDOS].sort());
});

test("todos os $defs relevantes têm additionalProperties: false (objetos aninhados fechados)", () => {
  for (const nome of ["formulation", "macronutrientGuarantees", "secondaryNutrientGuarantee", "micronutrient", "physicalComposition", "physicalComponent", "informationSource"]) {
    assert.equal(defs[nome].additionalProperties, false, `$defs.${nome} deveria ter additionalProperties: false`);
  }
});
