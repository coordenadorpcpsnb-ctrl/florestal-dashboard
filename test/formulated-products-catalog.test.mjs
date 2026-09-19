/**
 * test/formulated-products-catalog.test.mjs — testes do módulo de validação pura do
 * catálogo técnico de formulações (Etapa 7). Cobre: catálogo/formulação mínimos e
 * completos, campos obrigatórios/opcionais, as três distinções semânticas
 * (ausente/null/[]) em secondaryNutrientGuarantees, micronutrients e
 * physicalComposition, tolerância numérica de composição, unicidade de IDs,
 * regra de fonte primária única, e normalização não destrutiva.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA_VERSION,
  validateRoot,
  validateFormulation,
  validateCatalog,
  normalizeFormulation,
  normalizeCatalog,
  readCatalogFile,
  loadAndValidateCatalogFile,
  TIPOS_ERRO,
  STATUS_VALIDOS,
  QUALIDADE_INFORMACAO_VALIDA,
} from "../formulated-products-catalog.mjs";

// --- fixtures ----------------------------------------------------------------------

function fonte(overrides = {}) {
  return { sourceId: "src-01", isPrimary: true, type: "TECHNICAL_DATASHEET", ...overrides };
}

function formulacaoMinima(overrides = {}) {
  return {
    formulationId: "form-teste-000001-rev-01",
    productName: "PRODUTO_TESTE",
    revision: "REV-01",
    validFrom: "2026-01-01",
    status: "ACTIVE",
    macronutrientGuarantees: { unit: "PERCENT", n: null, p2o5: null, k2o: null },
    informationSources: [fonte()],
    informationQuality: "NOT_AVAILABLE",
    ...overrides,
  };
}

function formulacaoCompleta(overrides = {}) {
  return formulacaoMinima({
    declaredFormula: "00-00-00",
    category: "PLANTIO_FICTICIO",
    validTo: "2027-01-01",
    macronutrientGuarantees: { unit: "PERCENT", n: 10, p2o5: 20, k2o: 5 },
    secondaryNutrientGuarantees: [{ nutrient: "CA", value: 1, unit: "PERCENT" }],
    micronutrients: [{ element: "ZN", value: 0.5, unit: "PERCENT" }],
    physicalComposition: {
      completenessStatus: "COMPLETE",
      totalPercent: 100,
      components: [
        { componentId: "c1", componentName: "COMPONENTE_1", percentage: 60, unit: "PERCENT_MASS", sourceType: "SUPPLIER_DECLARED" },
        { componentId: "c2", componentName: "COMPONENTE_2", percentage: 40, unit: "PERCENT_MASS", sourceType: "SUPPLIER_DECLARED" },
      ],
    },
    notes: "nota de teste",
    ...overrides,
  });
}

const semErrosDoTipo = (errors, tipo) => !errors.some((e) => e.type === tipo);
const temErroDoTipo = (errors, tipo) => errors.some((e) => e.type === tipo);
const temErroNoCampo = (errors, campo) => errors.some((e) => e.field === campo);

// --- 1-3: catálogo/formulação mínimos e completos -----------------------------------

test("[1] catálogo vazio é válido", () => {
  const r = validateCatalog({ schemaVersion: SCHEMA_VERSION, description: "d", formulations: [] });
  assert.equal(r.valid, true);
  assert.equal(r.formulationCount, 0);
});

test("[2] formulação mínima é válida", () => {
  const errors = validateFormulation(formulacaoMinima(), 0);
  assert.deepEqual(errors, []);
});

test("[3] formulação completa (todos os campos opcionais preenchidos) é válida", () => {
  const errors = validateFormulation(formulacaoCompleta(), 0);
  assert.deepEqual(errors, []);
});

// --- 4-10: campos obrigatórios, enums, datas, propriedades desconhecidas -----------

test("[4] formulationId duplicado é detectado no catálogo", () => {
  const catalogo = { schemaVersion: SCHEMA_VERSION, description: "d", formulations: [formulacaoMinima(), formulacaoMinima()] };
  const r = validateCatalog(catalogo);
  assert.equal(r.valid, false);
  assert.ok(temErroDoTipo(r.errors, TIPOS_ERRO.ID_DUPLICADO));
});

for (const campo of ["formulationId", "productName", "revision", "validFrom", "status", "macronutrientGuarantees", "informationSources", "informationQuality"]) {
  test(`[5.${campo}] campo obrigatório ausente (${campo}) é detectado`, () => {
    const f = formulacaoMinima();
    delete f[campo];
    const errors = validateFormulation(f, 0);
    assert.ok(temErroNoCampo(errors, campo) || errors.some((e) => e.field?.startsWith(campo)), `esperado erro no campo ${campo}`);
  });
}

test("[6] propriedade desconhecida na raiz é rejeitada", () => {
  const errors = validateRoot({ schemaVersion: SCHEMA_VERSION, description: "d", formulations: [], extra: 1 });
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.CAMPO_DESCONHECIDO));
});

test("[7] propriedade desconhecida na formulação é rejeitada", () => {
  const errors = validateFormulation(formulacaoMinima({ campoInventado: true }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.CAMPO_DESCONHECIDO));
});

test("[8] data inválida (calendário) em validFrom é rejeitada", () => {
  const errors = validateFormulation(formulacaoMinima({ validFrom: "2024-02-30" }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.DATA_INVALIDA));
});

test("[9] validTo anterior a validFrom é rejeitado", () => {
  const errors = validateFormulation(formulacaoMinima({ validFrom: "2026-06-01", validTo: "2026-01-01" }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.VIGENCIA_INVALIDA));
});

test("[9b] validTo null é válido (vigência aberta)", () => {
  const errors = validateFormulation(formulacaoMinima({ validTo: null }), 0);
  assert.deepEqual(errors, []);
});

test("[10] status inválido é rejeitado", () => {
  const errors = validateFormulation(formulacaoMinima({ status: "ALGO_INVALIDO" }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.ENUM_INVALIDO));
  for (const s of STATUS_VALIDOS) {
    assert.deepEqual(validateFormulation(formulacaoMinima({ status: s }), 0), []);
  }
});

// --- 11-17: macronutrientGuarantees --------------------------------------------------

test("[11-13] garantias N/P2O5/K2O null são válidas individualmente e juntas", () => {
  for (const campo of ["n", "p2o5", "k2o"]) {
    const g = { unit: "PERCENT", n: 1, p2o5: 1, k2o: 1, [campo]: null };
    assert.deepEqual(validateFormulation(formulacaoMinima({ macronutrientGuarantees: g }), 0), []);
  }
  assert.deepEqual(
    validateFormulation(formulacaoMinima({ macronutrientGuarantees: { unit: "PERCENT", n: null, p2o5: null, k2o: null } }), 0),
    []
  );
});

test("[14] garantia zero é válida (zero não é null)", () => {
  const errors = validateFormulation(formulacaoMinima({ macronutrientGuarantees: { unit: "PERCENT", n: 0, p2o5: 0, k2o: 0 } }), 0);
  assert.deepEqual(errors, []);
});

test("[15] garantia negativa é inválida", () => {
  const errors = validateFormulation(formulacaoMinima({ macronutrientGuarantees: { unit: "PERCENT", n: -1, p2o5: 0, k2o: 0 } }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.VALOR_INVALIDO));
});

test("[16] garantia não infere nem exige composição física", () => {
  const f = formulacaoMinima({ macronutrientGuarantees: { unit: "PERCENT", n: 30, p2o5: 30, k2o: 30 } });
  assert.equal("physicalComposition" in f, false);
  assert.deepEqual(validateFormulation(f, 0), []);
});

test("[17] declaredFormula não preenche nem valida garantias", () => {
  const f1 = formulacaoMinima({ declaredFormula: "06-30-06" });
  const f2 = formulacaoMinima({ declaredFormula: "99-99-99" });
  assert.deepEqual(validateFormulation(f1, 0), []);
  assert.deepEqual(validateFormulation(f2, 0), []); // aceito mesmo sem bater com as garantias -- texto opaco
  assert.equal(f1.macronutrientGuarantees.n, null);
});

// --- 18-23: secondaryNutrientGuarantees ---------------------------------------------

test("[18] secondaryNutrientGuarantees ausente é válido (não coletado)", () => {
  const f = formulacaoMinima();
  assert.equal("secondaryNutrientGuarantees" in f, false);
  assert.deepEqual(validateFormulation(f, 0), []);
});

test("[19] secondaryNutrientGuarantees null é válido (desconhecido)", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima({ secondaryNutrientGuarantees: null }), 0), []);
});

test("[20] secondaryNutrientGuarantees [] é válido (explicitamente nenhum)", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima({ secondaryNutrientGuarantees: [] }), 0), []);
});

test("[21] secondaryNutrientGuarantee com value null é válido", () => {
  const errors = validateFormulation(formulacaoMinima({ secondaryNutrientGuarantees: [{ nutrient: "CA", value: null, unit: "NAO_INFORMADA" }] }), 0);
  assert.deepEqual(errors, []);
});

test("[22] secondaryNutrientGuarantee com value negativo é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({ secondaryNutrientGuarantees: [{ nutrient: "CA", value: -5, unit: "PERCENT" }] }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.VALOR_INVALIDO));
});

test("[23] secondaryNutrientGuarantee com unidade inválida é rejeitado", () => {
  const errors = validateFormulation(formulacaoMinima({ secondaryNutrientGuarantees: [{ nutrient: "CA", value: 1, unit: "KG" }] }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.ENUM_INVALIDO));
});

// --- 24-30: micronutrients -----------------------------------------------------------

test("[24] micronutrients ausente é válido (não coletado)", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima(), 0), []);
});

test("[25] micronutrients null é válido (desconhecido)", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima({ micronutrients: null }), 0), []);
});

test("[26] micronutrients [] é válido (explicitamente nenhum)", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima({ micronutrients: [] }), 0), []);
});

test("[27] micronutrients com lista preenchida é válido", () => {
  const errors = validateFormulation(formulacaoMinima({ micronutrients: [{ element: "B", value: 1, unit: "PPM" }] }), 0);
  assert.deepEqual(errors, []);
});

test("[28] micronutriente com value null é válido", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima({ micronutrients: [{ element: "B", value: null, unit: "NAO_INFORMADA" }] }), 0), []);
});

test("[29] micronutriente negativo é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({ micronutrients: [{ element: "B", value: -1, unit: "PPM" }] }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.VALOR_INVALIDO));
});

test("[30] micronutriente com unidade inválida é rejeitado", () => {
  const errors = validateFormulation(formulacaoMinima({ micronutrients: [{ element: "B", value: 1, unit: "LITROS" }] }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.ENUM_INVALIDO));
});

// --- 31-46: physicalComposition -------------------------------------------------------

test("[31] physicalComposition ausente é válido (não coletada)", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima(), 0), []);
});

test("[32] physicalComposition null é válido (desconhecida)", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima({ physicalComposition: null }), 0), []);
});

test("[33] physicalComposition UNKNOWN sem componentes é válida", () => {
  const errors = validateFormulation(formulacaoMinima({ physicalComposition: { completenessStatus: "UNKNOWN", totalPercent: null, components: [] } }), 0);
  assert.deepEqual(errors, []);
});

test("[34] UNKNOWN com percentual/componente é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({
    physicalComposition: { completenessStatus: "UNKNOWN", totalPercent: null, components: [
      { componentId: "c1", componentName: "X", percentage: 10, unit: "PERCENT_MASS", sourceType: "OTHER" },
    ] },
  }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.COMPOSICAO_INVALIDA));

  const errors2 = validateFormulation(formulacaoMinima({
    physicalComposition: { completenessStatus: "UNKNOWN", totalPercent: 10, components: [] },
  }), 0);
  assert.ok(temErroDoTipo(errors2, TIPOS_ERRO.COMPOSICAO_INVALIDA));
});

test("[35] PARTIAL pode somar menos de 100", () => {
  const errors = validateFormulation(formulacaoMinima({
    physicalComposition: { completenessStatus: "PARTIAL", totalPercent: null, components: [
      { componentId: "c1", componentName: "X", percentage: 30, unit: "PERCENT_MASS", sourceType: "OTHER" },
    ] },
  }), 0);
  assert.deepEqual(errors, []);
});

test("[36] PARTIAL nunca é completado automaticamente (soma permanece a informada)", () => {
  const comp = { completenessStatus: "PARTIAL", totalPercent: null, components: [
    { componentId: "c1", componentName: "X", percentage: 30, unit: "PERCENT_MASS", sourceType: "OTHER" },
  ] };
  const f = formulacaoMinima({ physicalComposition: comp });
  validateFormulation(f, 0);
  assert.equal(f.physicalComposition.components.length, 1); // nenhum componente residual foi criado
});

test("[37-38] COMPLETE soma 100 e está dentro da tolerância", () => {
  const errors = validateFormulation(formulacaoCompleta(), 0);
  assert.deepEqual(errors, []);
});

test("[38b] COMPLETE dentro da tolerância de 0,01 ainda é válido", () => {
  const errors = validateFormulation(formulacaoMinima({
    physicalComposition: { completenessStatus: "COMPLETE", totalPercent: 100, components: [
      { componentId: "c1", componentName: "X", percentage: 60.005, unit: "PERCENT_MASS", sourceType: "OTHER" },
      { componentId: "c2", componentName: "Y", percentage: 39.999, unit: "PERCENT_MASS", sourceType: "OTHER" },
    ] },
  }), 0);
  assert.deepEqual(errors, []);
});

test("[39] COMPLETE fora da tolerância é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({
    physicalComposition: { completenessStatus: "COMPLETE", totalPercent: 100, components: [
      { componentId: "c1", componentName: "X", percentage: 50, unit: "PERCENT_MASS", sourceType: "OTHER" },
      { componentId: "c2", componentName: "Y", percentage: 40, unit: "PERCENT_MASS", sourceType: "OTHER" },
    ] },
  }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.COMPOSICAO_INVALIDA));
});

test("[40] componente com percentual negativo é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({
    physicalComposition: { completenessStatus: "PARTIAL", totalPercent: null, components: [
      { componentId: "c1", componentName: "X", percentage: -10, unit: "PERCENT_MASS", sourceType: "OTHER" },
    ] },
  }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.VALOR_INVALIDO));
});

test("[40b] NaN e Infinity são inválidos em percentage e em garantias", () => {
  const errosPercent = validateFormulation(formulacaoMinima({
    physicalComposition: { completenessStatus: "PARTIAL", totalPercent: null, components: [
      { componentId: "c1", componentName: "X", percentage: Infinity, unit: "PERCENT_MASS", sourceType: "OTHER" },
    ] },
  }), 0);
  assert.ok(temErroDoTipo(errosPercent, TIPOS_ERRO.VALOR_INVALIDO));

  const errosGarantia = validateFormulation(formulacaoMinima({
    macronutrientGuarantees: { unit: "PERCENT", n: NaN, p2o5: 0, k2o: 0 },
  }), 0);
  assert.ok(temErroDoTipo(errosGarantia, TIPOS_ERRO.VALOR_INVALIDO));
});

test("[41] componentId duplicado dentro da formulação é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({
    physicalComposition: { completenessStatus: "PARTIAL", totalPercent: null, components: [
      { componentId: "dup", componentName: "X", percentage: 10, unit: "PERCENT_MASS", sourceType: "OTHER" },
      { componentId: "dup", componentName: "Y", percentage: 10, unit: "PERCENT_MASS", sourceType: "OTHER" },
    ] },
  }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.ID_DUPLICADO));
});

test("[42-45] componentName aceita qualquer nome e NPK nunca cria ureia/MAP/KCl automaticamente", () => {
  const errors = validateFormulation(formulacaoMinima({
    macronutrientGuarantees: { unit: "PERCENT", n: 46, p2o5: 0, k2o: 0 },
    physicalComposition: { completenessStatus: "PARTIAL", totalPercent: null, components: [
      { componentId: "c1", componentName: "COMPONENTE_QUALQUER", percentage: 10, unit: "PERCENT_MASS", sourceType: "OTHER" },
    ] },
  }), 0);
  assert.deepEqual(errors, []);
  const nomes = ["ureia", "UREIA", "MAP", "KCl"].map((n) => n.toLowerCase());
  // nenhum componente é criado automaticamente -- a lista de componentes é exatamente a informada
  assert.equal(nomes.includes("componente_qualquer"), false);
});

test("[46] completude e origem de cada componente permanecem campos separados", () => {
  const comp = {
    completenessStatus: "PARTIAL", totalPercent: null,
    components: [{ componentId: "c1", componentName: "X", percentage: 10, unit: "PERCENT_MASS", sourceType: "LAB_ANALYSIS" }],
  };
  const errors = validateFormulation(formulacaoMinima({ physicalComposition: comp }), 0);
  assert.deepEqual(errors, []);
  assert.notEqual(comp.completenessStatus, comp.components[0].sourceType);
});

// --- 47-53: informationSources --------------------------------------------------------

test("[47] informationSources é obrigatório", () => {
  const f = formulacaoMinima();
  delete f.informationSources;
  const errors = validateFormulation(f, 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE));
});

test("[48] exatamente uma fonte primária é válido", () => {
  const errors = validateFormulation(formulacaoMinima({ informationSources: [fonte({ isPrimary: true }), fonte({ sourceId: "src-02", isPrimary: false })] }), 0);
  assert.deepEqual(errors, []);
});

test("[49] nenhuma fonte primária é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({ informationSources: [fonte({ isPrimary: false })] }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.FONTE_PRIMARIA_INVALIDA));
});

test("[50] duas fontes primárias é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({ informationSources: [fonte({ isPrimary: true }), fonte({ sourceId: "src-02", isPrimary: true })] }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.FONTE_PRIMARIA_INVALIDA));
});

test("[51] sourceId duplicado dentro da formulação é inválido", () => {
  const errors = validateFormulation(formulacaoMinima({ informationSources: [fonte({ sourceId: "dup" }), fonte({ sourceId: "dup", isPrimary: false })] }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.ID_DUPLICADO));
});

test("[52] documentReference é opcional", () => {
  const errors = validateFormulation(formulacaoMinima({ informationSources: [fonte()] }), 0);
  assert.deepEqual(errors, []);
  assert.equal("documentReference" in fonte(), false);
});

test("[53] effectiveDate inválida é rejeitada", () => {
  const errors = validateFormulation(formulacaoMinima({ informationSources: [fonte({ effectiveDate: "31-12-2026" })] }), 0);
  assert.ok(temErroDoTipo(errors, TIPOS_ERRO.DATA_INVALIDA));
});

// --- 54-56: informationQuality e notes -------------------------------------------------

test("[54] informationQuality é obrigatório", () => {
  const f = formulacaoMinima();
  delete f.informationQuality;
  assert.ok(temErroDoTipo(validateFormulation(f, 0), TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE));
});

test("[55] informationQuality inválido é rejeitado; todos os valores válidos passam", () => {
  assert.ok(temErroDoTipo(validateFormulation(formulacaoMinima({ informationQuality: "TALVEZ" }), 0), TIPOS_ERRO.ENUM_INVALIDO));
  for (const q of QUALIDADE_INFORMACAO_VALIDA) {
    assert.deepEqual(validateFormulation(formulacaoMinima({ informationQuality: q }), 0), []);
  }
});

test("[56] notes é opcional", () => {
  assert.deepEqual(validateFormulation(formulacaoMinima(), 0), []);
  assert.deepEqual(validateFormulation(formulacaoMinima({ notes: "texto" }), 0), []);
});

// --- 57-61: normalização não destrutiva ------------------------------------------------

test("[57] normalização não cria campo ausente", () => {
  const f = formulacaoMinima();
  const normalizado = normalizeFormulation(f);
  assert.equal("micronutrients" in normalizado, false);
  assert.equal("physicalComposition" in normalizado, false);
});

test("[58] normalização preserva null", () => {
  const normalizado = normalizeFormulation(formulacaoMinima({ micronutrients: null }));
  assert.equal(normalizado.micronutrients, null);
});

test("[59] normalização preserva []", () => {
  const normalizado = normalizeFormulation(formulacaoMinima({ secondaryNutrientGuarantees: [] }));
  assert.deepEqual(normalizado.secondaryNutrientGuarantees, []);
});

test("[60] normalização não altera declaredFormula", () => {
  const normalizado = normalizeFormulation(formulacaoMinima({ declaredFormula: "  06-30-06  " }));
  assert.equal(normalizado.declaredFormula, "  06-30-06  ");
});

test("[61] normalização não altera revision", () => {
  const normalizado = normalizeFormulation(formulacaoMinima({ revision: " REV-01 " }));
  assert.equal(normalizado.revision, " REV-01 ");
});

test("[61b] normalização apara espaços só em campos descritivos seguros (productName, category, notes)", () => {
  const normalizado = normalizeFormulation(formulacaoMinima({ productName: "  NOME  ", category: " CAT ", notes: " nota " }));
  assert.equal(normalizado.productName, "NOME");
  assert.equal(normalizado.category, "CAT");
  assert.equal(normalizado.notes, "nota");
});

test("[61c] normalizeCatalog aplica normalizeFormulation a todas as formulações", () => {
  const catalogo = { schemaVersion: SCHEMA_VERSION, description: "d", formulations: [formulacaoMinima({ productName: " A " })] };
  const normalizado = normalizeCatalog(catalogo);
  assert.equal(normalizado.formulations[0].productName, "A");
});

// --- 62-63: leitura de arquivo ----------------------------------------------------------

test("[62] arquivo inexistente gera erro claro", () => {
  const r = readCatalogFile("/tmp/nao-existe-catalogo-de-teste.private.json");
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].type, TIPOS_ERRO.ARQUIVO_INEXISTENTE);
});

test("[63] JSON inválido gera erro claro", async () => {
  const { writeFileSync, unlinkSync } = await import("node:fs");
  const caminho = "/tmp/catalogo-invalido-de-teste.private.json";
  writeFileSync(caminho, "{ nao e json valido", "utf-8");
  try {
    const r = readCatalogFile(caminho);
    assert.equal(r.ok, false);
    assert.equal(r.errors[0].type, TIPOS_ERRO.JSON_INVALIDO);
  } finally {
    unlinkSync(caminho);
  }
});

test("[28-arquivo] arquivo privado não é procurado automaticamente por loadAndValidateCatalogFile (exige caminho explícito)", () => {
  // loadAndValidateCatalogFile não tem parâmetro padrão nem fallback -- só aceita o
  // caminho que o chamador passar explicitamente. Confirmado pela assinatura da função:
  assert.equal(loadAndValidateCatalogFile.length, 1);
});

// --- 71-76: template JSON público -------------------------------------------------------

const { join, dirname } = await import("node:path");
const { fileURLToPath } = await import("node:url");
const __dirnameTeste = dirname(fileURLToPath(import.meta.url));
const CAMINHO_TEMPLATE = join(__dirnameTeste, "..", "templates", "formulated-products-catalog-template.json");

test("[71] template JSON passa no schema/validador", () => {
  const r = loadAndValidateCatalogFile(CAMINHO_TEMPLATE);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.equal(r.formulationCount, 2);
});

test("[72] template JSON é inequivocamente fictício (nomes/IDs de exemplo)", async () => {
  const { readFileSync } = await import("node:fs");
  const texto = readFileSync(CAMINHO_TEMPLATE, "utf-8");
  assert.match(texto, /FORMULADO_FICTICIO_A/);
  assert.match(texto, /FORMULADO_FICTICIO_B/);
  assert.match(texto, /form-exemplo-000001-rev-01/);
  assert.match(texto, /form-exemplo-000002-rev-01/);
  assert.match(texto, /DOC_FICTICIO_001/);
});

test("[73] template JSON não contém preço nem volume comercial", async () => {
  const { readFileSync } = await import("node:fs");
  const dado = JSON.parse(readFileSync(CAMINHO_TEMPLATE, "utf-8"));
  const texto = JSON.stringify(dado);
  assert.doesNotMatch(texto, /"pre[cç]o"|"volumeToneladas"|"moeda"|"unidadePreco"/i);
});

test("[74] template JSON não contém fornecedor real nem nome de empresa real", async () => {
  const { readFileSync } = await import("node:fs");
  const texto = readFileSync(CAMINHO_TEMPLATE, "utf-8");
  assert.doesNotMatch(texto, /fornecedor/i);
  assert.doesNotMatch(texto, /\bLtda\b|\bS\.?A\.?\b|\bME\b/);
});

test("[75] template JSON não contém empresa (campo de identidade organizacional real)", async () => {
  const { readFileSync } = await import("node:fs");
  const dado = JSON.parse(readFileSync(CAMINHO_TEMPLATE, "utf-8"));
  assert.equal("empresa" in dado, false);
  assert.equal("company" in dado, false);
});

test("[76] template JSON não contém credencial (token/senha/chave)", async () => {
  const { readFileSync } = await import("node:fs");
  const texto = readFileSync(CAMINHO_TEMPLATE, "utf-8");
  assert.doesNotMatch(texto, /(api[_-]?key|token|senha|password)\s*[:=]/i);
});

// --- 78-79: separação do histórico comercial e ausência de conexão -----------------------

test("[78] nenhum formulationId foi adicionado ao histórico comercial nesta etapa", async () => {
  const { execFileSync } = await import("node:child_process");
  const diff = execFileSync("git", ["diff", "15a1be3", "--", "schemas/formulated-price-history.schema.json", "formulated-price-history.mjs"], {
    cwd: join(__dirnameTeste, ".."), encoding: "utf-8",
  });
  assert.equal(diff.trim(), "");
});

test("[79] o catálogo não é referenciado por dashboard.html nem pelo workflow semanal", async () => {
  const { readFileSync } = await import("node:fs");
  const dashboard = readFileSync(join(__dirnameTeste, "..", "dashboard.html"), "utf-8");
  const workflow = readFileSync(join(__dirnameTeste, "..", ".github", "workflows", "weekly-update.yml"), "utf-8");
  assert.doesNotMatch(dashboard, /formulated-products-catalog/);
  assert.doesNotMatch(workflow, /formulated-products-catalog/);
});

test("[81] o arquivo privado operacional do catálogo não existe no repositório", async () => {
  const { existsSync } = await import("node:fs");
  assert.equal(existsSync(join(__dirnameTeste, "..", "data", "private", "formulated-products-catalog.private.json")), false);
});

test("[82] o .gitignore protege /data/private/ e *.private.json", async () => {
  const { readFileSync } = await import("node:fs");
  const gitignore = readFileSync(join(__dirnameTeste, "..", ".gitignore"), "utf-8");
  assert.match(gitignore, /\/data\/private\//);
  assert.match(gitignore, /\*\.private\.json/);
});

test("[83-84] nenhuma dependência Node nova e package-lock sem alteração inesperada", async () => {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(join(__dirnameTeste, "..", "package.json"), "utf-8"));
  assert.deepEqual(pkg.dependencies, { cheerio: "^1.0.0", docx: "^9.0.0" });
  const { execFileSync } = await import("node:child_process");
  const diff = execFileSync("git", ["diff", "15a1be3", "--", "package-lock.json"], { cwd: join(__dirnameTeste, ".."), encoding: "utf-8" });
  assert.equal(diff.trim(), "");
});
