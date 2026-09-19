/**
 * formulated-products-catalog.mjs — Contrato e validação pura do catálogo técnico
 * privado das formulações (data/private/formulated-products-catalog.private.json,
 * ainda não criado nesta etapa -- ver README).
 *
 * Domínio DIFERENTE do histórico comercial de preços (formulated-price-history.mjs):
 * aqui não há preço, custo, fornecedor comercial, condição de compra, previsão nem
 * recomendação. Este módulo também não cruza com nenhum dos dois -- isso é decisão de
 * uma etapa futura, própria, depois de revisão humana.
 *
 * PRINCÍPIO CENTRAL (repetido aqui de propósito, porque é o erro mais fácil de
 * cometer ao mexer neste arquivo): garantia nutricional (macronutrientGuarantees,
 * secondaryNutrientGuarantees) NUNCA prova nem permite calcular composição física
 * (physicalComposition). A fórmula declarada (declaredFormula) é texto opaco: nunca
 * interpretada quimicamente, nunca usada para preencher garantia ou componente
 * nenhum. Nenhuma função deste módulo deriva um campo a partir de outro.
 *
 * Distinção semântica obrigatória, replicada em vários campos (secondaryNutrient-
 * Guarantees, micronutrients, physicalComposition): campo AUSENTE (chave não existe)
 * = informação não coletada; valor `null` = informação coletada como desconhecida/
 * não divulgada; valor `[]` (ou objeto com completenessStatus: UNKNOWN) = foi
 * explicitamente registrado que não há informação a declarar. As três situações são
 * diferentes e nenhuma normalização deste módulo apaga essa diferença.
 *
 * O contrato formal está em schemas/formulated-products-catalog.schema.json.
 * Este módulo replica essas regras em JavaScript puro (sem dependência de biblioteca
 * de JSON Schema) pelo mesmo motivo de formulated-price-history.mjs: unicidade de
 * formulationId/sourceId/componentId, a regra de "exatamente uma fonte primária" e a
 * tolerância numérica de physicalComposition não são expressáveis em JSON Schema
 * puro. test/formulated-products-catalog.contract.test.mjs compara o schema no disco
 * com as constantes exportadas aqui embaixo.
 *
 * Mensagens de erro NUNCA ecoam productName, declaredFormula, conteúdo de
 * micronutrientes/composição/notas ou documentReference -- só tipo, índice, nome do
 * campo e, quando necessário, o identificador técnico (formulationId/sourceId/
 * componentId). O console do CLI (validate-formulated-products-catalog.mjs) vai um
 * passo além e nem imprime o formulationId por padrão (ver esse arquivo).
 */
import { readFileSync } from "node:fs";

export const SCHEMA_VERSION = 1;

// --- Propriedades da raiz ---------------------------------------------------------
export const CAMPOS_RAIZ_OBRIGATORIOS = Object.freeze(["schemaVersion", "description", "formulations"]);
export const CAMPOS_RAIZ_PERMITIDOS = CAMPOS_RAIZ_OBRIGATORIOS;

// --- Propriedades de uma formulação -----------------------------------------------
export const CAMPOS_FORMULACAO_OBRIGATORIOS = Object.freeze([
  "formulationId", "productName", "revision", "validFrom", "status",
  "macronutrientGuarantees", "informationSources", "informationQuality",
]);

export const CAMPOS_FORMULACAO_OPCIONAIS = Object.freeze([
  "declaredFormula", "category", "validTo",
  "secondaryNutrientGuarantees", "micronutrients", "physicalComposition", "notes",
]);

export const CAMPOS_FORMULACAO_PERMITIDOS = Object.freeze([
  ...CAMPOS_FORMULACAO_OBRIGATORIOS, ...CAMPOS_FORMULACAO_OPCIONAIS,
]);

// --- Enums -------------------------------------------------------------------------
export const STATUS_VALIDOS = Object.freeze(["ACTIVE", "INACTIVE", "DRAFT", "UNDER_REVIEW", "SUPERSEDED"]);
export const QUALIDADE_INFORMACAO_VALIDA = Object.freeze(["VERIFIED", "PARTIALLY_VERIFIED", "UNVERIFIED", "NOT_AVAILABLE"]);

export const UNIDADE_MACRONUTRIENTE_VALIDA = Object.freeze(["PERCENT"]);
export const CAMPOS_MACRONUTRIENTES = Object.freeze(["unit", "n", "p2o5", "k2o"]);

export const NUTRIENTE_SECUNDARIO_VALIDO = Object.freeze(["CA", "MG", "S", "OUTRO"]);
export const UNIDADE_NUTRIENTE_SECUNDARIO_VALIDA = Object.freeze(["PERCENT", "G_KG", "MG_KG", "NAO_INFORMADA"]);
export const CAMPOS_NUTRIENTE_SECUNDARIO_OBRIGATORIOS = Object.freeze(["nutrient", "value", "unit"]);
export const CAMPOS_NUTRIENTE_SECUNDARIO_OPCIONAIS = Object.freeze(["sourceNote"]);
export const CAMPOS_NUTRIENTE_SECUNDARIO_PERMITIDOS = Object.freeze([
  ...CAMPOS_NUTRIENTE_SECUNDARIO_OBRIGATORIOS, ...CAMPOS_NUTRIENTE_SECUNDARIO_OPCIONAIS,
]);

export const MICRONUTRIENTE_VALIDO = Object.freeze(["B", "ZN", "CU", "MN", "FE", "MO", "CO", "NI", "OUTRO"]);
export const UNIDADE_MICRONUTRIENTE_VALIDA = Object.freeze(["PERCENT", "G_KG", "MG_KG", "PPM", "NAO_INFORMADA"]);
export const CAMPOS_MICRONUTRIENTE_OBRIGATORIOS = Object.freeze(["element", "value", "unit"]);
export const CAMPOS_MICRONUTRIENTE_OPCIONAIS = Object.freeze(["sourceNote"]);
export const CAMPOS_MICRONUTRIENTE_PERMITIDOS = Object.freeze([
  ...CAMPOS_MICRONUTRIENTE_OBRIGATORIOS, ...CAMPOS_MICRONUTRIENTE_OPCIONAIS,
]);

export const COMPLETUDE_COMPOSICAO_VALIDA = Object.freeze(["COMPLETE", "PARTIAL", "UNKNOWN"]);
export const CAMPOS_COMPOSICAO_OBRIGATORIOS = Object.freeze(["completenessStatus", "totalPercent", "components"]);
export const CAMPOS_COMPOSICAO_OPCIONAIS = Object.freeze(["sourceNote"]);
export const CAMPOS_COMPOSICAO_PERMITIDOS = Object.freeze([
  ...CAMPOS_COMPOSICAO_OBRIGATORIOS, ...CAMPOS_COMPOSICAO_OPCIONAIS,
]);

export const UNIDADE_COMPONENTE_VALIDA = Object.freeze(["PERCENT_MASS"]);
export const ORIGEM_COMPONENTE_VALIDA = Object.freeze(["SUPPLIER_DECLARED", "INTERNAL_ESTIMATE", "LAB_ANALYSIS", "OTHER", "NOT_INFORMED"]);
export const CAMPOS_COMPONENTE_OBRIGATORIOS = Object.freeze(["componentId", "componentName", "percentage", "unit", "sourceType"]);
export const CAMPOS_COMPONENTE_OPCIONAIS = Object.freeze(["notes"]);
export const CAMPOS_COMPONENTE_PERMITIDOS = Object.freeze([
  ...CAMPOS_COMPONENTE_OBRIGATORIOS, ...CAMPOS_COMPONENTE_OPCIONAIS,
]);

export const TIPO_FONTE_VALIDO = Object.freeze([
  "TECHNICAL_DATASHEET", "PRODUCT_LABEL", "CONTRACT", "SUPPLIER_DECLARATION",
  "INTERNAL_RECORD", "LAB_ANALYSIS", "OTHER", "NOT_INFORMED",
]);
export const CAMPOS_FONTE_OBRIGATORIOS = Object.freeze(["sourceId", "isPrimary", "type"]);
export const CAMPOS_FONTE_OPCIONAIS = Object.freeze(["documentReference", "effectiveDate", "sourceNote"]);
export const CAMPOS_FONTE_PERMITIDOS = Object.freeze([...CAMPOS_FONTE_OBRIGATORIOS, ...CAMPOS_FONTE_OPCIONAIS]);

/** Tolerância técnica para soma de percentuais de composição física (pontos percentuais). */
export const TOLERANCIA_PERCENTUAL_COMPOSICAO = 0.01;

/** Padrão RECOMENDADO (não obrigatório) de formulationId -- documentado, não imposto
 *  de forma destrutiva, para não travar evolução futura do formato do identificador. */
export const PADRAO_RECOMENDADO_FORMULATION_ID = "form-<slug>-<numero>-rev-<numero>";

export const TIPOS_ERRO = Object.freeze({
  ESTRUTURAL: "ESTRUTURAL",
  CAMPO_DESCONHECIDO: "CAMPO_DESCONHECIDO",
  CAMPO_OBRIGATORIO_AUSENTE: "CAMPO_OBRIGATORIO_AUSENTE",
  DATA_INVALIDA: "DATA_INVALIDA",
  VALOR_INVALIDO: "VALOR_INVALIDO",
  ENUM_INVALIDO: "ENUM_INVALIDO",
  ID_DUPLICADO: "ID_DUPLICADO",
  FONTE_PRIMARIA_INVALIDA: "FONTE_PRIMARIA_INVALIDA",
  COMPOSICAO_INVALIDA: "COMPOSICAO_INVALIDA",
  VIGENCIA_INVALIDA: "VIGENCIA_INVALIDA",
  ARQUIVO_INEXISTENTE: "ARQUIVO_INEXISTENTE",
  JSON_INVALIDO: "JSON_INVALIDO",
});

const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function erro(type, message, extra = {}) {
  return { type, message, ...extra };
}

/** Mesma checagem de formulated-price-history.mjs: formato + data real do calendário. */
export function isValidIsoDate(value) {
  if (typeof value !== "string" || !RE_ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const presente = (obj, campo) => Object.prototype.hasOwnProperty.call(obj, campo);
const numeroFinito = (v) => typeof v === "number" && Number.isFinite(v);
const objetoSimples = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// ------------------------------------------------------------------------------------
// Validação da raiz
// ------------------------------------------------------------------------------------

export function validateRoot(data) {
  const errors = [];
  if (!objetoSimples(data)) {
    return [erro(TIPOS_ERRO.ESTRUTURAL, "o catálogo deve ser um objeto JSON com schemaVersion, description e formulations")];
  }
  for (const chave of Object.keys(data)) {
    if (!CAMPOS_RAIZ_PERMITIDOS.includes(chave)) {
      errors.push(erro(TIPOS_ERRO.CAMPO_DESCONHECIDO, `campo desconhecido na raiz: "${chave}"`, { field: chave }));
    }
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, `schemaVersion deve ser ${SCHEMA_VERSION}`, { field: "schemaVersion" }));
  }
  if (typeof data.description !== "string" || data.description.trim() === "") {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, "description é obrigatória e deve ser um texto não vazio", { field: "description" }));
  }
  if (!Array.isArray(data.formulations)) {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, "formulations deve ser um array (pode ser vazio)", { field: "formulations" }));
  }
  return errors;
}

// ------------------------------------------------------------------------------------
// Validação de sub-objetos de uma formulação
// ------------------------------------------------------------------------------------

function validarMacronutrientGuarantees(valor, index, add) {
  if (!objetoSimples(valor)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "macronutrientGuarantees", "macronutrientGuarantees é obrigatório e deve ser um objeto");
    return;
  }
  for (const chave of Object.keys(valor)) {
    if (!CAMPOS_MACRONUTRIENTES.includes(chave)) {
      add(TIPOS_ERRO.CAMPO_DESCONHECIDO, `macronutrientGuarantees.${chave}`, `campo desconhecido em macronutrientGuarantees: "${chave}"`);
    }
  }
  if (valor.unit !== "PERCENT") {
    add(TIPOS_ERRO.ENUM_INVALIDO, "macronutrientGuarantees.unit", `unit deve ser "PERCENT" (recebido inválido)`);
  }
  for (const campo of ["n", "p2o5", "k2o"]) {
    if (!presente(valor, campo)) {
      add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, `macronutrientGuarantees.${campo}`, `macronutrientGuarantees.${campo} é obrigatório (use null quando desconhecido)`);
      continue;
    }
    const v = valor[campo];
    if (v !== null && (!numeroFinito(v) || v < 0)) {
      add(TIPOS_ERRO.VALOR_INVALIDO, `macronutrientGuarantees.${campo}`, `macronutrientGuarantees.${campo} deve ser número >= 0 ou null`);
    }
  }
}

function validarListaComSentinela(lista, campoPai, index, add, { camposPermitidos, camposObrigatorios, validarItem }) {
  // Ausente é tratado pelo chamador (campo opcional em presença). Aqui só validamos
  // quando a chave existe: null é sempre válido (semântica própria); array é
  // validado item a item.
  if (lista === null) return;
  if (!Array.isArray(lista)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, campoPai, `${campoPai} deve ser array, null, ou estar ausente`);
    return;
  }
  lista.forEach((item, i) => {
    const prefixo = `${campoPai}[${i}]`;
    if (!objetoSimples(item)) {
      add(TIPOS_ERRO.ESTRUTURAL, prefixo, `${prefixo} deve ser um objeto`);
      return;
    }
    for (const chave of Object.keys(item)) {
      if (!camposPermitidos.includes(chave)) {
        add(TIPOS_ERRO.CAMPO_DESCONHECIDO, `${prefixo}.${chave}`, `campo desconhecido em ${prefixo}: "${chave}"`);
      }
    }
    for (const campo of camposObrigatorios) {
      if (!presente(item, campo)) {
        add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, `${prefixo}.${campo}`, `${prefixo}.${campo} é obrigatório`);
      }
    }
    validarItem(item, prefixo, add);
  });
}

function validarSecondaryNutrientGuarantees(valor, index, add) {
  validarListaComSentinela(valor, "secondaryNutrientGuarantees", index, add, {
    camposPermitidos: CAMPOS_NUTRIENTE_SECUNDARIO_PERMITIDOS,
    camposObrigatorios: CAMPOS_NUTRIENTE_SECUNDARIO_OBRIGATORIOS,
    validarItem: (item, prefixo, add) => {
      if (presente(item, "nutrient") && !NUTRIENTE_SECUNDARIO_VALIDO.includes(item.nutrient)) {
        add(TIPOS_ERRO.ENUM_INVALIDO, `${prefixo}.nutrient`, `${prefixo}.nutrient inválido`);
      }
      if (presente(item, "value") && item.value !== null && (!numeroFinito(item.value) || item.value < 0)) {
        add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.value`, `${prefixo}.value deve ser número >= 0 ou null`);
      }
      if (presente(item, "unit") && !UNIDADE_NUTRIENTE_SECUNDARIO_VALIDA.includes(item.unit)) {
        add(TIPOS_ERRO.ENUM_INVALIDO, `${prefixo}.unit`, `${prefixo}.unit inválida`);
      }
      if (presente(item, "sourceNote") && typeof item.sourceNote !== "string") {
        add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.sourceNote`, `${prefixo}.sourceNote deve ser texto`);
      }
    },
  });
}

function validarMicronutrients(valor, index, add) {
  validarListaComSentinela(valor, "micronutrients", index, add, {
    camposPermitidos: CAMPOS_MICRONUTRIENTE_PERMITIDOS,
    camposObrigatorios: CAMPOS_MICRONUTRIENTE_OBRIGATORIOS,
    validarItem: (item, prefixo, add) => {
      if (presente(item, "element") && !MICRONUTRIENTE_VALIDO.includes(item.element)) {
        add(TIPOS_ERRO.ENUM_INVALIDO, `${prefixo}.element`, `${prefixo}.element inválido`);
      }
      if (presente(item, "value") && item.value !== null && (!numeroFinito(item.value) || item.value < 0)) {
        add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.value`, `${prefixo}.value deve ser número >= 0 ou null`);
      }
      if (presente(item, "unit") && !UNIDADE_MICRONUTRIENTE_VALIDA.includes(item.unit)) {
        add(TIPOS_ERRO.ENUM_INVALIDO, `${prefixo}.unit`, `${prefixo}.unit inválida`);
      }
      if (presente(item, "sourceNote") && typeof item.sourceNote !== "string") {
        add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.sourceNote`, `${prefixo}.sourceNote deve ser texto`);
      }
    },
  });
}

function validarPhysicalComposition(valor, index, add) {
  if (valor === null) return; // desconhecida/não divulgada -- válido
  if (!objetoSimples(valor)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "physicalComposition", "physicalComposition deve ser objeto, null, ou estar ausente");
    return;
  }
  for (const chave of Object.keys(valor)) {
    if (!CAMPOS_COMPOSICAO_PERMITIDOS.includes(chave)) {
      add(TIPOS_ERRO.CAMPO_DESCONHECIDO, `physicalComposition.${chave}`, `campo desconhecido em physicalComposition: "${chave}"`);
    }
  }
  for (const campo of CAMPOS_COMPOSICAO_OBRIGATORIOS) {
    if (!presente(valor, campo)) {
      add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, `physicalComposition.${campo}`, `physicalComposition.${campo} é obrigatório`);
    }
  }
  const status = valor.completenessStatus;
  if (presente(valor, "completenessStatus") && !COMPLETUDE_COMPOSICAO_VALIDA.includes(status)) {
    add(TIPOS_ERRO.ENUM_INVALIDO, "physicalComposition.completenessStatus", "physicalComposition.completenessStatus inválido");
    return; // sem status válido não dá pra aplicar as regras específicas abaixo
  }

  const totalPercent = valor.totalPercent;
  if (presente(valor, "totalPercent") && totalPercent !== null && (!numeroFinito(totalPercent) || totalPercent < 0 || totalPercent > 100)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "physicalComposition.totalPercent", "physicalComposition.totalPercent deve ser número entre 0 e 100, ou null");
  }

  const components = Array.isArray(valor.components) ? valor.components : null;
  if (!presente(valor, "components") || !Array.isArray(valor.components)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "physicalComposition.components", "physicalComposition.components deve ser array");
  }

  const idsComponentes = new Set();
  let somaPercentuais = 0;
  let algumComponenteInvalido = false;
  (components ?? []).forEach((comp, i) => {
    const prefixo = `physicalComposition.components[${i}]`;
    if (!objetoSimples(comp)) {
      add(TIPOS_ERRO.ESTRUTURAL, prefixo, `${prefixo} deve ser um objeto`);
      algumComponenteInvalido = true;
      return;
    }
    for (const chave of Object.keys(comp)) {
      if (!CAMPOS_COMPONENTE_PERMITIDOS.includes(chave)) {
        add(TIPOS_ERRO.CAMPO_DESCONHECIDO, `${prefixo}.${chave}`, `campo desconhecido em ${prefixo}: "${chave}"`);
      }
    }
    for (const campo of CAMPOS_COMPONENTE_OBRIGATORIOS) {
      if (!presente(comp, campo)) {
        add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, `${prefixo}.${campo}`, `${prefixo}.${campo} é obrigatório`);
        algumComponenteInvalido = true;
      }
    }
    if (presente(comp, "componentId")) {
      if (typeof comp.componentId !== "string" || comp.componentId === "") {
        add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.componentId`, `${prefixo}.componentId deve ser texto não vazio`);
        algumComponenteInvalido = true;
      } else if (idsComponentes.has(comp.componentId)) {
        add(TIPOS_ERRO.ID_DUPLICADO, `${prefixo}.componentId`, `componentId duplicado dentro da formulação: "${comp.componentId}"`, { componentId: comp.componentId });
      } else {
        idsComponentes.add(comp.componentId);
      }
    }
    if (presente(comp, "componentName") && (typeof comp.componentName !== "string" || comp.componentName === "")) {
      add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.componentName`, `${prefixo}.componentName deve ser texto não vazio`);
    }
    if (presente(comp, "percentage")) {
      if (!numeroFinito(comp.percentage) || comp.percentage <= 0) {
        add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.percentage`, `${prefixo}.percentage deve ser número maior que zero`);
        algumComponenteInvalido = true;
      } else {
        somaPercentuais += comp.percentage;
      }
    }
    if (presente(comp, "unit") && comp.unit !== "PERCENT_MASS") {
      add(TIPOS_ERRO.ENUM_INVALIDO, `${prefixo}.unit`, `${prefixo}.unit deve ser "PERCENT_MASS"`);
    }
    if (presente(comp, "sourceType") && !ORIGEM_COMPONENTE_VALIDA.includes(comp.sourceType)) {
      add(TIPOS_ERRO.ENUM_INVALIDO, `${prefixo}.sourceType`, `${prefixo}.sourceType inválido`);
    }
    if (presente(comp, "notes") && typeof comp.notes !== "string") {
      add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.notes`, `${prefixo}.notes deve ser texto`);
    }
  });

  if (algumComponenteInvalido || !components) return; // regras de soma exigem componentes válidos

  if (status === "UNKNOWN") {
    if (components.length !== 0) {
      add(TIPOS_ERRO.COMPOSICAO_INVALIDA, "physicalComposition.components", "physicalComposition com completenessStatus UNKNOWN não pode conter componentes");
    }
    if (totalPercent !== null) {
      add(TIPOS_ERRO.COMPOSICAO_INVALIDA, "physicalComposition.totalPercent", "physicalComposition com completenessStatus UNKNOWN deve ter totalPercent null");
    }
  } else if (status === "PARTIAL") {
    if (components.length === 0) {
      add(TIPOS_ERRO.COMPOSICAO_INVALIDA, "physicalComposition.components", "physicalComposition PARTIAL deve conter ao menos um componente");
    }
    if (totalPercent !== null && Math.abs(totalPercent - somaPercentuais) > TOLERANCIA_PERCENTUAL_COMPOSICAO) {
      add(TIPOS_ERRO.COMPOSICAO_INVALIDA, "physicalComposition.totalPercent", "physicalComposition.totalPercent não corresponde à soma dos componentes (fora da tolerância)");
    }
  } else if (status === "COMPLETE") {
    if (components.length === 0) {
      add(TIPOS_ERRO.COMPOSICAO_INVALIDA, "physicalComposition.components", "physicalComposition COMPLETE deve conter ao menos um componente");
    }
    if (Math.abs(somaPercentuais - 100) > TOLERANCIA_PERCENTUAL_COMPOSICAO) {
      add(TIPOS_ERRO.COMPOSICAO_INVALIDA, "physicalComposition.components", `physicalComposition COMPLETE deve somar 100 dentro da tolerância de ${TOLERANCIA_PERCENTUAL_COMPOSICAO} ponto percentual`);
    }
    if (totalPercent !== null && Math.abs(totalPercent - 100) > TOLERANCIA_PERCENTUAL_COMPOSICAO) {
      add(TIPOS_ERRO.COMPOSICAO_INVALIDA, "physicalComposition.totalPercent", `physicalComposition COMPLETE deve ter totalPercent igual a 100 dentro da tolerância de ${TOLERANCIA_PERCENTUAL_COMPOSICAO} ponto percentual`);
    }
  }
}

function validarInformationSources(valor, index, add) {
  if (!Array.isArray(valor)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "informationSources", "informationSources é obrigatório e deve ser um array com ao menos um item");
    return;
  }
  if (valor.length === 0) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "informationSources", "informationSources deve conter ao menos um item");
  }
  const idsFontes = new Set();
  let primarias = 0;
  valor.forEach((fonte, i) => {
    const prefixo = `informationSources[${i}]`;
    if (!objetoSimples(fonte)) {
      add(TIPOS_ERRO.ESTRUTURAL, prefixo, `${prefixo} deve ser um objeto`);
      return;
    }
    for (const chave of Object.keys(fonte)) {
      if (!CAMPOS_FONTE_PERMITIDOS.includes(chave)) {
        add(TIPOS_ERRO.CAMPO_DESCONHECIDO, `${prefixo}.${chave}`, `campo desconhecido em ${prefixo}: "${chave}"`);
      }
    }
    for (const campo of CAMPOS_FONTE_OBRIGATORIOS) {
      if (!presente(fonte, campo)) {
        add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, `${prefixo}.${campo}`, `${prefixo}.${campo} é obrigatório`);
      }
    }
    if (presente(fonte, "sourceId")) {
      if (typeof fonte.sourceId !== "string" || fonte.sourceId === "") {
        add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.sourceId`, `${prefixo}.sourceId deve ser texto não vazio`);
      } else if (idsFontes.has(fonte.sourceId)) {
        add(TIPOS_ERRO.ID_DUPLICADO, `${prefixo}.sourceId`, `sourceId duplicado dentro da formulação: "${fonte.sourceId}"`, { sourceId: fonte.sourceId });
      } else {
        idsFontes.add(fonte.sourceId);
      }
    }
    if (presente(fonte, "isPrimary")) {
      if (typeof fonte.isPrimary !== "boolean") {
        add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.isPrimary`, `${prefixo}.isPrimary deve ser booleano`);
      } else if (fonte.isPrimary) {
        primarias += 1;
      }
    }
    if (presente(fonte, "type") && !TIPO_FONTE_VALIDO.includes(fonte.type)) {
      add(TIPOS_ERRO.ENUM_INVALIDO, `${prefixo}.type`, `${prefixo}.type inválido`);
    }
    if (presente(fonte, "documentReference") && typeof fonte.documentReference !== "string") {
      add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.documentReference`, `${prefixo}.documentReference deve ser texto`);
    }
    if (presente(fonte, "effectiveDate") && !isValidIsoDate(fonte.effectiveDate)) {
      add(TIPOS_ERRO.DATA_INVALIDA, `${prefixo}.effectiveDate`, `${prefixo}.effectiveDate inválida (esperado YYYY-MM-DD)`);
    }
    if (presente(fonte, "sourceNote") && typeof fonte.sourceNote !== "string") {
      add(TIPOS_ERRO.VALOR_INVALIDO, `${prefixo}.sourceNote`, `${prefixo}.sourceNote deve ser texto`);
    }
  });
  if (valor.length > 0) {
    if (primarias === 0) {
      add(TIPOS_ERRO.FONTE_PRIMARIA_INVALIDA, "informationSources", "nenhuma informationSource está marcada como isPrimary: true");
    } else if (primarias > 1) {
      add(TIPOS_ERRO.FONTE_PRIMARIA_INVALIDA, "informationSources", `mais de uma informationSource (${primarias}) está marcada como isPrimary: true`);
    }
  }
}

// ------------------------------------------------------------------------------------
// Validação de uma formulação
// ------------------------------------------------------------------------------------

/**
 * Valida uma única formulação. Retorna a lista de erros (vazia se estiver correta).
 * `index` identifica a formulação nas mensagens de erro -- não interfere na validação.
 * Não recebe nem verifica unicidade entre formulações (isso é validateCatalog()).
 */
export function validateFormulation(formulation, index) {
  const errors = [];
  const add = (type, field, message, extra = {}) => errors.push(erro(type, message, { index, field, ...extra }));

  if (!objetoSimples(formulation)) {
    return [erro(TIPOS_ERRO.ESTRUTURAL, `formulação no índice ${index} não é um objeto`, { index })];
  }

  for (const chave of Object.keys(formulation)) {
    if (!CAMPOS_FORMULACAO_PERMITIDOS.includes(chave)) {
      add(TIPOS_ERRO.CAMPO_DESCONHECIDO, chave, `campo desconhecido na formulação: "${chave}"`);
    }
  }

  // --- formulationId ---
  if (!presente(formulation, "formulationId") || formulation.formulationId === "" || formulation.formulationId == null) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "formulationId", "formulationId é obrigatório e não pode ser vazio");
  } else if (typeof formulation.formulationId !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "formulationId", "formulationId deve ser texto");
  }

  // --- productName ---
  if (!presente(formulation, "productName") || formulation.productName === "" || formulation.productName == null) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "productName", "productName é obrigatório e não pode ser vazio");
  } else if (typeof formulation.productName !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "productName", "productName deve ser texto");
  }

  // --- declaredFormula (opcional) ---
  if (presente(formulation, "declaredFormula") && (typeof formulation.declaredFormula !== "string" || formulation.declaredFormula === "")) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "declaredFormula", "declaredFormula deve ser texto não vazio quando presente");
  }

  // --- category (opcional) ---
  if (presente(formulation, "category") && (typeof formulation.category !== "string" || formulation.category === "")) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "category", "category deve ser texto não vazio quando presente");
  }

  // --- revision ---
  if (!presente(formulation, "revision") || formulation.revision === "" || formulation.revision == null) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "revision", "revision é obrigatória e não pode ser vazia");
  } else if (typeof formulation.revision !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "revision", "revision deve ser texto");
  }

  // --- validFrom / validTo ---
  let validFromValida = null;
  if (!presente(formulation, "validFrom") || formulation.validFrom == null) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "validFrom", "validFrom é obrigatório");
  } else if (!isValidIsoDate(formulation.validFrom)) {
    add(TIPOS_ERRO.DATA_INVALIDA, "validFrom", "validFrom inválido (esperado YYYY-MM-DD, data real do calendário)");
  } else {
    validFromValida = formulation.validFrom;
  }

  if (presente(formulation, "validTo") && formulation.validTo !== null) {
    if (!isValidIsoDate(formulation.validTo)) {
      add(TIPOS_ERRO.DATA_INVALIDA, "validTo", "validTo inválido (esperado YYYY-MM-DD ou null)");
    } else if (validFromValida !== null && formulation.validTo < validFromValida) {
      add(TIPOS_ERRO.VIGENCIA_INVALIDA, "validTo", "validTo não pode ser anterior a validFrom");
    }
  }

  // --- status ---
  if (!presente(formulation, "status") || formulation.status == null) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "status", "status é obrigatório");
  } else if (!STATUS_VALIDOS.includes(formulation.status)) {
    add(TIPOS_ERRO.ENUM_INVALIDO, "status", `status inválido (aceitos: ${STATUS_VALIDOS.join(", ")})`);
  }

  // --- macronutrientGuarantees ---
  validarMacronutrientGuarantees(formulation.macronutrientGuarantees, index, add);

  // --- secondaryNutrientGuarantees (opcional) ---
  if (presente(formulation, "secondaryNutrientGuarantees")) {
    validarSecondaryNutrientGuarantees(formulation.secondaryNutrientGuarantees, index, add);
  }

  // --- micronutrients (opcional) ---
  if (presente(formulation, "micronutrients")) {
    validarMicronutrients(formulation.micronutrients, index, add);
  }

  // --- physicalComposition (opcional) ---
  if (presente(formulation, "physicalComposition")) {
    validarPhysicalComposition(formulation.physicalComposition, index, add);
  }

  // --- informationSources ---
  validarInformationSources(formulation.informationSources, index, add);

  // --- informationQuality ---
  if (!presente(formulation, "informationQuality") || formulation.informationQuality == null) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "informationQuality", "informationQuality é obrigatório");
  } else if (!QUALIDADE_INFORMACAO_VALIDA.includes(formulation.informationQuality)) {
    add(TIPOS_ERRO.ENUM_INVALIDO, "informationQuality", `informationQuality inválido (aceitos: ${QUALIDADE_INFORMACAO_VALIDA.join(", ")})`);
  }

  // --- notes (opcional) ---
  if (presente(formulation, "notes") && typeof formulation.notes !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "notes", "notes deve ser texto quando presente");
  }

  return errors;
}

/**
 * Valida o catálogo inteiro: envelope raiz, cada formulação, e unicidade de
 * formulationId entre formulações. Um catálogo com formulations: [] é válido.
 * Nunca lança exceção para dados inválidos -- exceções só vêm de bugs no módulo.
 */
export function validateCatalog(data) {
  const rootErrors = validateRoot(data);
  if (!Array.isArray(data?.formulations)) {
    return {
      valid: false,
      formulationCount: 0,
      errors: rootErrors,
      summary: `Catálogo inválido: ${rootErrors.length} erro(s) estrutural(is). Não foi possível validar formulações.`,
    };
  }

  const formulationErrors = [];
  const vistos = new Map(); // formulationId -> primeiro índice em que apareceu
  data.formulations.forEach((formulation, index) => {
    formulationErrors.push(...validateFormulation(formulation, index));
    const id = formulation?.formulationId;
    if (typeof id === "string" && id !== "") {
      if (vistos.has(id)) {
        formulationErrors.push(erro(
          TIPOS_ERRO.ID_DUPLICADO,
          `formulationId duplicado no catálogo (índices ${vistos.get(id)} e ${index})`,
          { index, field: "formulationId" }
        ));
      } else {
        vistos.set(id, index);
      }
    }
  });

  const errors = [...rootErrors, ...formulationErrors];
  const formulationCount = data.formulations.length;
  const valid = errors.length === 0;
  const summary = valid
    ? (formulationCount === 0
        ? "Catálogo vazio (0 formulações) — válido."
        : `Catálogo válido com ${formulationCount} formulação(ões).`)
    : `Catálogo inválido: ${errors.length} erro(s) em ${formulationCount} formulação(ões).`;

  return { valid, formulationCount, errors, summary };
}

// ------------------------------------------------------------------------------------
// Normalização não destrutiva
// ------------------------------------------------------------------------------------

/** Campos de texto descritivo seguros para aparar espaços externos. NUNCA inclui
 *  formulationId, sourceId, componentId, declaredFormula, revision, datas, enums,
 *  percentuais ou unidades -- normalização nunca altera identidade nem valor. */
const CAMPOS_TEXTO_NORMALIZAVEIS = ["productName", "category", "notes"];

/** Normaliza uma formulação: apara espaços externos só nos campos descritivos
 *  seguros. Nunca insere campo ausente, nunca converte null em [] nem [] em null,
 *  nunca altera formulationId/revision/declaredFormula/datas/enums/percentuais. */
export function normalizeFormulation(formulation) {
  if (!objetoSimples(formulation)) return formulation;
  const copia = { ...formulation };
  for (const campo of CAMPOS_TEXTO_NORMALIZAVEIS) {
    if (typeof copia[campo] === "string") copia[campo] = copia[campo].trim();
  }
  return copia;
}

/** Aplica normalizeFormulation() a todas as formulações do catálogo. */
export function normalizeCatalog(data) {
  if (!objetoSimples(data) || !Array.isArray(data.formulations)) return data;
  return { ...data, formulations: data.formulations.map(normalizeFormulation) };
}

// ------------------------------------------------------------------------------------
// Leitura de arquivo
// ------------------------------------------------------------------------------------

/** Lê e faz JSON.parse do arquivo em filePath. Não valida o conteúdo -- só isola os
 *  dois jeitos de falha que precisam de tipo de erro próprio (arquivo inexistente,
 *  JSON inválido). Nunca procura um caminho por conta própria: o caminho é sempre
 *  explícito, decidido por quem chama (ver validate-formulated-products-catalog.mjs).
 *  Retorna { ok: true, data } ou { ok: false, errors: [...] }. */
export function readCatalogFile(filePath) {
  let texto;
  try {
    texto = readFileSync(filePath, "utf-8");
  } catch (e) {
    if (e.code === "ENOENT") {
      return { ok: false, errors: [erro(TIPOS_ERRO.ARQUIVO_INEXISTENTE, `arquivo não encontrado: ${filePath}`)] };
    }
    return { ok: false, errors: [erro(TIPOS_ERRO.ARQUIVO_INEXISTENTE, `não foi possível ler ${filePath}: ${e.message}`)] };
  }
  try {
    return { ok: true, data: JSON.parse(texto) };
  } catch (e) {
    return { ok: false, errors: [erro(TIPOS_ERRO.JSON_INVALIDO, `JSON inválido em ${filePath}: ${e.message}`)] };
  }
}

/** Combina readCatalogFile() + validateCatalog() num único resultado. */
export function loadAndValidateCatalogFile(filePath) {
  const lido = readCatalogFile(filePath);
  if (!lido.ok) {
    return {
      valid: false,
      formulationCount: 0,
      errors: lido.errors,
      summary: `Não foi possível carregar o catálogo: ${lido.errors.map((e) => e.message).join(" | ")}`,
    };
  }
  return validateCatalog(lido.data);
}
