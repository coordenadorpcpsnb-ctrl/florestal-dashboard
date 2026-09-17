/**
 * market-driver-history.mjs — Leitura, validacao e contrato da serie historica
 * extraida dos direcionadores PUBLICOS de mercado (schema em
 * schemas/market-driver-history.schema.json).
 *
 * Modulo PURO de contrato: define os enums (indicador/unidade/status/confianca),
 * valida a estrutura ({schemaVersion, description, generatedAt, source,
 * observations}) e cada observacao. Nao extrai nada do Git -- isso e
 * extract-market-driver-history.mjs, que IMPORTA este modulo para validar o que
 * produz (mesmo padrao de formulated-price-history.mjs + import-formulated-
 * history.mjs nas Etapas 1-2).
 *
 * === Separacao de dominios (emenda arquitetural da Etapa 5) ===
 * Este schema e este modulo NUNCA guardam preco comercial de formulado,
 * fornecedor, volume comprado, condicao de pagamento, contrato, formula NPK,
 * garantia de macronutrientes, micronutrientes ou qualquer identificador de
 * formulacao (nem formulationId, que e proposital e explicitamente NAO criado
 * nesta etapa). Esses dados pertencem a dois dominios privados separados, que
 * este modulo nunca le nem referencia:
 *   1. Historico comercial privado dos formulados
 *      (data/private/formulated-prices-history.private.json) -- Etapas 1-3.
 *   2. Catalogo tecnico privado das formulacoes
 *      (data/private/formulated-products-catalog.private.json) -- ainda nao
 *      criado; formula/garantias/micronutrientes/composicao pertencerao la,
 *      nunca aqui.
 * O vinculo futuro entre os dois (um formulationId tecnico) e trabalho de uma
 * etapa propria, posterior a revisao do historico aqui extraido.
 *
 * === Indicadores ===
 * So os indicadores comprovadamente buscados por fetch-data.mjs/
 * fetch-fertilizers.mjs hoje: dolar, ureia, map, kcl, gas, bdi, soja, sojaTO.
 * diesel e glifosato NAO entram: CLAUDE.md e o historico confirmam que foram
 * removidos do sistema (commit "Remove indicador Diesel S10 e aba Logistica do
 * dashboard") -- nao ha evidencia de codigo para eles hoje. troca.map/
 * troca.ureia tambem NAO entram: sao valores CALCULADOS (razao soja/materia-
 * prima), nao direcionadores observados -- inclui-los misturaria observacao
 * com derivacao, o que esta etapa explicitamente nao deve fazer.
 *
 * === Unidades ===
 * data.json nao guarda unidade por campo -- a unidade de cada indicador vem de
 * uma tabela fixa (INDICADOR_UNIDADE, abaixo), evidenciada nos rotulos que
 * patch-dashboard.mjs usa nos KPIs (kpiLine(...,"R$/US$",...) etc.). Isso NAO
 * e inferencia por nome: e leitura do rotulo que o proprio codigo do projeto
 * ja atribui a cada campo.
 */
import { readFileSync } from "node:fs";

export const SCHEMA_VERSION = 1;

/** Chaves aceitas no objeto raiz. Qualquer outra chave e CAMPO_DESCONHECIDO. */
export const CAMPOS_RAIZ_OBRIGATORIOS = Object.freeze(["schemaVersion", "description", "generatedAt", "source", "observations"]);
export const CAMPOS_RAIZ_PERMITIDOS = CAMPOS_RAIZ_OBRIGATORIOS;

export const CAMPOS_SOURCE_OBRIGATORIOS = Object.freeze([
  "type", "file", "commitCountAudited", "snapshotCountParsed", "snapshotCountRejected",
]);
export const CAMPOS_SOURCE_PERMITIDOS = CAMPOS_SOURCE_OBRIGATORIOS;

/** Chaves que toda observacao precisa ter (nenhuma e opcional neste schema --
 *  quando um valor nao e conhecido, o campo existe e vale null/NAO_IDENTIFICAVEL). */
export const CAMPOS_OBSERVACAO_OBRIGATORIOS = Object.freeze([
  "indicator", "value", "unit", "referenceDate", "referencePeriod", "collectedAt",
  "commitDate", "commitHash", "sourceStatus", "sourceName", "sourceMessage",
  "extractionConfidence", "deduplicationKey", "metadata",
]);
export const CAMPOS_OBSERVACAO_PERMITIDOS = CAMPOS_OBSERVACAO_OBRIGATORIOS;

export const CAMPOS_METADATA_OBRIGATORIOS = Object.freeze([
  "supportingSnapshotCount", "firstCollectedAt", "lastCollectedAt", "commitHashes", "conflict", "conflictType",
]);
/** Etapa 5.2: repeatedFromPrevious/matchesOverrideValue viraram OPCIONAIS na
 *  validacao (schemaVersion continua 1) -- um arquivo valido da Etapa 5 (sem
 *  esses dois campos) precisa continuar valido. Quando presentes, ainda
 *  precisam ser booleanos (ver validateMetadata). Ausencia != false: so
 *  significa "nao calculado/indisponivel". Este modulo nao tem nenhuma funcao
 *  de normalizacao que reescreva `observations`/`metadata` -- validateHistory/
 *  readHistoryFile/loadAndValidateHistoryFile so leem e validam, nunca
 *  preenchem campo ausente nenhum (nem aqui nem em nenhum outro lugar deste
 *  arquivo). */
export const CAMPOS_METADATA_OPCIONAIS = Object.freeze(["repeatedFromPrevious", "matchesOverrideValue"]);
export const CAMPOS_METADATA_PERMITIDOS = Object.freeze([...CAMPOS_METADATA_OBRIGATORIOS, ...CAMPOS_METADATA_OPCIONAIS]);

/** Indicadores comprovadamente presentes no codigo/historico atual. Ver nota no
 *  cabeçalho sobre por que diesel/glifosato/troca ficam de fora. */
export const INDICADORES_SUPORTADOS = Object.freeze(["dolar", "ureia", "map", "kcl", "gas", "bdi", "soja", "sojaTO"]);

/** Unidades com evidencia de codigo hoje (rotulos usados em patch-dashboard.mjs),
 *  mais NAO_IDENTIFICADA para quando a unidade nao puder ser confirmada. */
export const UNIDADES_SUPORTADAS = Object.freeze(["BRL_USD", "USD_TON", "USD_MMBTU", "BDI_PONTOS", "BRL_SACA_60KG", "NAO_IDENTIFICADA"]);

/** Tabela fixa indicador -> unidade, evidenciada no codigo (ver cabecalho). */
export const INDICADOR_UNIDADE = Object.freeze({
  dolar: "BRL_USD",
  ureia: "USD_TON",
  map: "USD_TON",
  kcl: "USD_TON",
  gas: "USD_MMBTU",
  bdi: "BDI_PONTOS",
  soja: "BRL_SACA_60KG",
  sojaTO: "BRL_SACA_60KG",
});

/** Classificacao de rastreabilidade da observacao -- NUNCA "confianca estatistica"
 *  nem qualidade do preco. So diz o que a evidencia do repositorio permite afirmar. */
export const STATUS_OBSERVACAO = Object.freeze({
  OBSERVADO: "OBSERVADO",
  FALLBACK_ULTIMO_CONHECIDO: "FALLBACK_ULTIMO_CONHECIDO",
  OVERRIDE_MANUAL: "OVERRIDE_MANUAL",
  AUSENTE: "AUSENTE",
  NAO_IDENTIFICAVEL: "NAO_IDENTIFICAVEL",
});

/** Rastreabilidade da EXTRACAO -- nunca confianca de previsao. */
export const CONFIANCA_EXTRACAO = Object.freeze({
  ESTRUTURADA: "ESTRUTURADA",
  PARCIAL: "PARCIAL",
  INFERENCIA_TECNICA: "INFERENCIA_TECNICA",
  NAO_RASTREAVEL: "NAO_RASTREAVEL",
});

export const TIPOS_CONFLITO = Object.freeze({
  VALORES_DIVERGENTES: "VALORES_DIVERGENTES",
  STATUS_DIVERGENTE: "STATUS_DIVERGENTE",
});

/** Tipos de erro distinguidos pelo validador. */
export const TIPOS_ERRO = Object.freeze({
  ESTRUTURAL: "ESTRUTURAL",
  CAMPO_DESCONHECIDO: "CAMPO_DESCONHECIDO",
  CAMPO_OBRIGATORIO_AUSENTE: "CAMPO_OBRIGATORIO_AUSENTE",
  DATA_INVALIDA: "DATA_INVALIDA",
  PERIODO_INVALIDO: "PERIODO_INVALIDO",
  VALOR_INVALIDO: "VALOR_INVALIDO",
  UNIDADE_INVALIDA: "UNIDADE_INVALIDA",
  HASH_INVALIDO: "HASH_INVALIDO",
  ARQUIVO_INEXISTENTE: "ARQUIVO_INEXISTENTE",
  JSON_INVALIDO: "JSON_INVALIDO",
});

function erro(type, message, extra = {}) {
  return { type, message, ...extra };
}

const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RE_YYYY_MM = /^\d{4}-\d{2}$/;
const RE_HASH10 = /^[0-9a-f]{10}$/;

/** YYYY-MM-DD valido, checando calendario de verdade (nao so o formato). */
export function isValidIsoDate(value) {
  if (typeof value !== "string" || !RE_ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** YYYY-MM valido (mes de 01 a 12). Nao valida dia nenhum -- e so um periodo. */
export function isValidYearMonth(value) {
  if (typeof value !== "string" || !RE_YYYY_MM.test(value)) return false;
  const mes = Number(value.slice(5, 7));
  return mes >= 1 && mes <= 12;
}

const naoNulo = (v) => v !== null && v !== undefined;

/** Valida uma unica observacao. Retorna a lista de erros (vazia se correta). */
export function validateObservation(obs, index) {
  const errors = [];
  const add = (type, field, message) => errors.push(erro(type, message, { index, field }));

  if (obs === null || typeof obs !== "object" || Array.isArray(obs)) {
    return [erro(TIPOS_ERRO.ESTRUTURAL, `observacao no indice ${index} nao e um objeto`, { index })];
  }

  for (const chave of Object.keys(obs)) {
    if (!CAMPOS_OBSERVACAO_PERMITIDOS.includes(chave)) {
      add(TIPOS_ERRO.CAMPO_DESCONHECIDO, chave, `campo desconhecido na observacao: "${chave}"`);
    }
  }
  for (const chave of CAMPOS_OBSERVACAO_OBRIGATORIOS) {
    if (!(chave in obs)) add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, chave, `${chave} e obrigatorio (pode ser null, mas precisa existir)`);
  }

  if ("indicator" in obs && !INDICADORES_SUPORTADOS.includes(obs.indicator)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "indicator", `indicator invalido (aceitos: ${INDICADORES_SUPORTADOS.join(", ")})`);
  }

  if ("value" in obs && naoNulo(obs.value) && (typeof obs.value !== "number" || !Number.isFinite(obs.value))) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "value", "value deve ser numero finito ou null");
  }

  if ("unit" in obs && !UNIDADES_SUPORTADAS.includes(obs.unit)) {
    add(TIPOS_ERRO.UNIDADE_INVALIDA, "unit", `unit invalida (aceitas: ${UNIDADES_SUPORTADAS.join(", ")})`);
  }

  if ("referenceDate" in obs && naoNulo(obs.referenceDate) && !isValidIsoDate(obs.referenceDate)) {
    add(TIPOS_ERRO.DATA_INVALIDA, "referenceDate", "referenceDate invalida (esperado YYYY-MM-DD ou null)");
  }

  if ("referencePeriod" in obs && naoNulo(obs.referencePeriod) && !isValidYearMonth(obs.referencePeriod)) {
    add(TIPOS_ERRO.PERIODO_INVALIDO, "referencePeriod", "referencePeriod invalido (esperado YYYY-MM ou null)");
  }

  if ("collectedAt" in obs && naoNulo(obs.collectedAt) && (typeof obs.collectedAt !== "string" || obs.collectedAt === "")) {
    add(TIPOS_ERRO.DATA_INVALIDA, "collectedAt", "collectedAt deve ser texto nao vazio ou null");
  }

  if ("commitDate" in obs && naoNulo(obs.commitDate) && (typeof obs.commitDate !== "string" || obs.commitDate === "")) {
    add(TIPOS_ERRO.DATA_INVALIDA, "commitDate", "commitDate deve ser texto nao vazio ou null");
  }

  if ("commitHash" in obs && (typeof obs.commitHash !== "string" || !RE_HASH10.test(obs.commitHash))) {
    add(TIPOS_ERRO.HASH_INVALIDO, "commitHash", "commitHash deve ter exatamente 10 caracteres hexadecimais");
  }

  if ("sourceStatus" in obs && !Object.values(STATUS_OBSERVACAO).includes(obs.sourceStatus)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "sourceStatus", `sourceStatus invalido (aceitos: ${Object.values(STATUS_OBSERVACAO).join(", ")})`);
  }

  if ("sourceName" in obs && naoNulo(obs.sourceName) && (typeof obs.sourceName !== "string" || obs.sourceName === "")) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "sourceName", "sourceName deve ser texto nao vazio ou null");
  }

  if ("sourceMessage" in obs && naoNulo(obs.sourceMessage) && (typeof obs.sourceMessage !== "string" || obs.sourceMessage === "")) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "sourceMessage", "sourceMessage deve ser texto nao vazio ou null");
  }

  if ("extractionConfidence" in obs && !Object.values(CONFIANCA_EXTRACAO).includes(obs.extractionConfidence)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "extractionConfidence", `extractionConfidence invalida (aceitas: ${Object.values(CONFIANCA_EXTRACAO).join(", ")})`);
  }

  if ("deduplicationKey" in obs && (typeof obs.deduplicationKey !== "string" || obs.deduplicationKey === "")) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "deduplicationKey", "deduplicationKey deve ser texto nao vazio");
  }

  if ("metadata" in obs) errors.push(...validateMetadata(obs.metadata, index));

  return errors;
}

function validateMetadata(meta, index) {
  const errors = [];
  const add = (type, field, message) => errors.push(erro(type, message, { index, field: `metadata.${field}` }));

  if (meta === null || typeof meta !== "object" || Array.isArray(meta)) {
    return [erro(TIPOS_ERRO.ESTRUTURAL, "metadata deve ser um objeto", { index, field: "metadata" })];
  }
  for (const chave of Object.keys(meta)) {
    if (!CAMPOS_METADATA_PERMITIDOS.includes(chave)) add(TIPOS_ERRO.CAMPO_DESCONHECIDO, chave, `campo desconhecido em metadata: "${chave}"`);
  }
  for (const chave of CAMPOS_METADATA_OBRIGATORIOS) {
    if (!(chave in meta)) add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, chave, `metadata.${chave} e obrigatorio`);
  }
  if ("supportingSnapshotCount" in meta && (!Number.isInteger(meta.supportingSnapshotCount) || meta.supportingSnapshotCount < 1)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "supportingSnapshotCount", "supportingSnapshotCount deve ser inteiro >= 1");
  }
  if ("commitHashes" in meta) {
    if (!Array.isArray(meta.commitHashes) || meta.commitHashes.length < 1) {
      add(TIPOS_ERRO.VALOR_INVALIDO, "commitHashes", "commitHashes deve ser um array com pelo menos 1 hash");
    } else if (!meta.commitHashes.every((h) => typeof h === "string" && RE_HASH10.test(h))) {
      add(TIPOS_ERRO.HASH_INVALIDO, "commitHashes", "todo item de commitHashes deve ter 10 caracteres hexadecimais");
    }
  }
  if ("conflict" in meta && typeof meta.conflict !== "boolean") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "conflict", "conflict deve ser booleano");
  }
  if ("repeatedFromPrevious" in meta && typeof meta.repeatedFromPrevious !== "boolean") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "repeatedFromPrevious", "repeatedFromPrevious deve ser booleano -- registra so a coincidencia de valor, nunca prova proveniencia sozinho");
  }
  if ("matchesOverrideValue" in meta && typeof meta.matchesOverrideValue !== "boolean") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "matchesOverrideValue", "matchesOverrideValue deve ser booleano -- registra so a coincidencia com o override, nunca prova uso sozinho");
  }
  if ("conflictType" in meta) {
    const valoresAceitos = [...Object.values(TIPOS_CONFLITO), null];
    if (!valoresAceitos.includes(meta.conflictType)) {
      add(TIPOS_ERRO.VALOR_INVALIDO, "conflictType", `conflictType invalido (aceitos: ${Object.values(TIPOS_CONFLITO).join(", ")} ou null)`);
    }
    if (meta.conflict === false && meta.conflictType !== null) {
      add(TIPOS_ERRO.VALOR_INVALIDO, "conflictType", "conflictType deve ser null quando conflict=false");
    }
  }
  return errors;
}

function validateSource(source) {
  const errors = [];
  const add = (type, field, message) => errors.push(erro(type, message, { field: `source.${field}` }));

  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return [erro(TIPOS_ERRO.ESTRUTURAL, "source deve ser um objeto", { field: "source" })];
  }
  for (const chave of Object.keys(source)) {
    if (!CAMPOS_SOURCE_PERMITIDOS.includes(chave)) add(TIPOS_ERRO.CAMPO_DESCONHECIDO, chave, `campo desconhecido em source: "${chave}"`);
  }
  for (const chave of CAMPOS_SOURCE_OBRIGATORIOS) {
    if (!(chave in source)) add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, chave, `source.${chave} e obrigatorio`);
  }
  if ("type" in source && source.type !== "GIT_HISTORY") add(TIPOS_ERRO.VALOR_INVALIDO, "type", 'source.type deve ser "GIT_HISTORY"');
  if ("file" in source && source.file !== "data.json") add(TIPOS_ERRO.VALOR_INVALIDO, "file", 'source.file deve ser "data.json"');
  for (const campo of ["commitCountAudited", "snapshotCountParsed", "snapshotCountRejected"]) {
    if (campo in source && (!Number.isInteger(source[campo]) || source[campo] < 0)) {
      add(TIPOS_ERRO.VALOR_INVALIDO, campo, `source.${campo} deve ser inteiro >= 0`);
    }
  }
  return errors;
}

/** Valida so a forma do envelope raiz. */
export function validateRoot(data) {
  const errors = [];
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [erro(TIPOS_ERRO.ESTRUTURAL, "a serie deve ser um objeto JSON com schemaVersion, description, generatedAt, source e observations")];
  }
  for (const chave of Object.keys(data)) {
    if (!CAMPOS_RAIZ_PERMITIDOS.includes(chave)) {
      errors.push(erro(TIPOS_ERRO.CAMPO_DESCONHECIDO, `campo desconhecido na raiz: "${chave}"`, { field: chave }));
    }
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, `schemaVersion deve ser ${SCHEMA_VERSION}`));
  }
  if (typeof data.description !== "string" || data.description.trim() === "") {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, "description e obrigatoria e deve ser um texto nao vazio"));
  }
  if (!("generatedAt" in data) || (data.generatedAt !== null && typeof data.generatedAt !== "string")) {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, "generatedAt e obrigatorio e deve ser texto ou null"));
  }
  if (!Array.isArray(data.observations)) {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, "observations deve ser um array (pode ser vazio)"));
  }
  if ("source" in data) errors.push(...validateSource(data.source));
  else errors.push(erro(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "source e obrigatorio", { field: "source" }));
  return errors;
}

/**
 * Valida a serie inteira: envelope raiz + cada observacao. Uma serie com
 * observations: [] e valida. Retorna { valid, observationCount, errors, summary }.
 */
export function validateHistory(data) {
  const rootErrors = validateRoot(data);
  if (!Array.isArray(data?.observations)) {
    return {
      valid: false,
      observationCount: 0,
      errors: rootErrors,
      summary: `Serie invalida: ${rootErrors.length} erro(s) estrutural(is). Nao foi possivel validar observacoes.`,
    };
  }

  const obsErrors = [];
  data.observations.forEach((obs, index) => obsErrors.push(...validateObservation(obs, index)));

  const errors = [...rootErrors, ...obsErrors];
  const observationCount = data.observations.length;
  const valid = errors.length === 0;
  const summary = valid
    ? (observationCount === 0
        ? "Serie vazia (0 observacoes) — valida."
        : `Serie valida com ${observationCount} observacao(oes).`)
    : `Serie invalida: ${errors.length} erro(s) em ${observationCount} observacao(oes).`;

  return { valid, observationCount, errors, summary };
}

/** Le e faz JSON.parse do arquivo em filePath. Retorna { ok:true, data } ou { ok:false, errors }. */
export function readHistoryFile(filePath) {
  let texto;
  try {
    texto = readFileSync(filePath, "utf-8");
  } catch (e) {
    if (e.code === "ENOENT") {
      return { ok: false, errors: [erro(TIPOS_ERRO.ARQUIVO_INEXISTENTE, `arquivo nao encontrado: ${filePath}`)] };
    }
    return { ok: false, errors: [erro(TIPOS_ERRO.ARQUIVO_INEXISTENTE, `nao foi possivel ler ${filePath}: ${e.message}`)] };
  }
  try {
    return { ok: true, data: JSON.parse(texto) };
  } catch (e) {
    return { ok: false, errors: [erro(TIPOS_ERRO.JSON_INVALIDO, `JSON invalido em ${filePath}: ${e.message}`)] };
  }
}

/** Combina readHistoryFile() + validateHistory(). */
export function loadAndValidateHistoryFile(filePath) {
  const lido = readHistoryFile(filePath);
  if (!lido.ok) {
    return {
      valid: false,
      observationCount: 0,
      errors: lido.errors,
      summary: `Nao foi possivel carregar a serie: ${lido.errors.map((e) => e.message).join(" | ")}`,
    };
  }
  return validateHistory(lido.data);
}
