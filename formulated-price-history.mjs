/**
 * formulated-price-history.mjs — Leitura, normalizacao e validacao da base historica de
 * precos de fertilizantes formulados (data/formulated-prices-history.json).
 *
 * Este modulo NAO calcula custo industrial do fabricante, nao faz regressao, nao faz
 * previsao e nao arredonda/completa valores ausentes. Ele so garante que a base esteja
 * estruturalmente correta antes de qualquer uso futuro (indice de pressao de materias-
 * primas, faixa estimada de negociacao, etc. -- fora do escopo desta etapa).
 *
 * O contrato formal dos campos esta em schemas/formulated-price-history.schema.json.
 * Este modulo replica essas regras em JavaScript puro (sem dependencia de biblioteca de
 * JSON Schema) porque unicidade de id e a consistencia entre anoReferencia e dataCotacao
 * nao sao expressaveis em JSON Schema puro, e o projeto evita dependencias novas.
 *
 * Nao e chamado por fetch-data.mjs, patch-dashboard.mjs, build-report.mjs, build-email.mjs
 * nem run-weekly.mjs. E' standalone: rode via `npm run validate:formulated-history` ou
 * importe as funcoes abaixo.
 */
import { readFileSync } from "node:fs";

export const SCHEMA_VERSION = 1;

/** Moedas aceitas nesta etapa. Lista pensada para crescer sem quebrar registros antigos;
 *  nao implica conversao cambial automatica quando uma nova moeda for adicionada. */
export const MOEDAS_SUPORTADAS = ["BRL"];

/** Unidades de preco aceitas nesta etapa. BRL_TON = reais por tonelada. */
export const UNIDADES_PRECO_SUPORTADAS = ["BRL_TON"];

/** Modalidades de entrega do FORMULADO (comercial) -- nao confundir com o FOB
 *  internacional das materias-primas (ureia/MAP/KCl) que o resto do dashboard monitora. */
export const MODALIDADES_ENTREGA_VALIDAS = ["FOB_FABRICA", "CIF_DESTINO", "RETIRADA", "NAO_INFORMADO"];

/** Origens permitidas para um registro. Guarda so a categoria da fonte, nunca o
 *  documento/numero em si (nada confidencial deve ir no campo fonteRegistro/observacoes). */
export const FONTES_REGISTRO_VALIDAS = ["COTACAO", "PEDIDO_COMPRA", "NOTA_FISCAL", "CONTRATO", "REGISTRO_INTERNO"];

/** Campos textuais que normalizeRecord() pode aparar (trim). Nunca inclui preco, datas
 *  ou qualquer campo numerico -- normalizacao nunca altera valores, so espacos em volta
 *  de texto. */
const CAMPOS_TEXTO_NORMALIZAVEIS = ["id", "produto", "formula", "categoriaFormula", "fornecedor", "destino", "observacoes"];

const RE_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Tipos de erro distinguidos pelo validador, conforme pedido nesta etapa. */
export const TIPOS_ERRO = Object.freeze({
  ESTRUTURAL: "ESTRUTURAL",
  CAMPO_OBRIGATORIO_AUSENTE: "CAMPO_OBRIGATORIO_AUSENTE",
  DATA_INVALIDA: "DATA_INVALIDA",
  UNIDADE_INVALIDA: "UNIDADE_INVALIDA",
  VALOR_INVALIDO: "VALOR_INVALIDO",
  ID_DUPLICADO: "ID_DUPLICADO",
  ANO_INCONSISTENTE: "ANO_INCONSISTENTE",
  ARQUIVO_INEXISTENTE: "ARQUIVO_INEXISTENTE",
  JSON_INVALIDO: "JSON_INVALIDO",
});

function erro(type, message, extra = {}) {
  return { type, message, ...extra };
}

/** Valida formato ISO YYYY-MM-DD e que a data exista de verdade no calendario
 *  (ex.: rejeita "2024-02-30", que passaria numa checagem so de regex). */
export function isValidIsoDate(value) {
  if (typeof value !== "string" || !RE_ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Extrai o ano de uma data ISO ja validada por isValidIsoDate(). */
function anoDe(isoDate) {
  return Number(isoDate.slice(0, 4));
}

const naoNulo = (v) => v !== null && v !== undefined;
const numeroFinito = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Valida um unico registro. Retorna a lista de erros encontrados (vazia se o
 * registro estiver correto). `index` e usado so para identificar o registro nas
 * mensagens de erro -- nao interfere na validacao.
 */
export function validateRecord(record, index) {
  const errors = [];
  const add = (type, field, message) => errors.push(erro(type, message, { index, id: record?.id, field }));

  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    return [erro(TIPOS_ERRO.ESTRUTURAL, `registro no indice ${index} nao e um objeto`, { index })];
  }

  // --- id ---
  if (!naoNulo(record.id) || record.id === "") {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "id", "id e obrigatorio e nao pode ser vazio");
  } else if (typeof record.id !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "id", "id deve ser texto");
  }

  // --- dataCotacao ---
  let anoCotacao = null;
  if (!naoNulo(record.dataCotacao)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "dataCotacao", "dataCotacao e obrigatoria");
  } else if (!isValidIsoDate(record.dataCotacao)) {
    add(TIPOS_ERRO.DATA_INVALIDA, "dataCotacao", `dataCotacao invalida: "${record.dataCotacao}" (esperado YYYY-MM-DD, data real do calendario)`);
  } else {
    anoCotacao = anoDe(record.dataCotacao);
  }

  // --- dataCompra (opcional, aceita null) ---
  if (naoNulo(record.dataCompra) && !isValidIsoDate(record.dataCompra)) {
    add(TIPOS_ERRO.DATA_INVALIDA, "dataCompra", `dataCompra invalida: "${record.dataCompra}" (esperado YYYY-MM-DD ou null)`);
  }

  // --- anoReferencia ---
  if (!naoNulo(record.anoReferencia)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "anoReferencia", "anoReferencia e obrigatorio");
  } else if (!Number.isInteger(record.anoReferencia) || record.anoReferencia < 1000 || record.anoReferencia > 9999) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "anoReferencia", `anoReferencia deve ser um inteiro de 4 digitos, recebido: ${JSON.stringify(record.anoReferencia)}`);
  } else if (anoCotacao !== null && record.anoReferencia !== anoCotacao) {
    add(TIPOS_ERRO.ANO_INCONSISTENTE, "anoReferencia", `anoReferencia (${record.anoReferencia}) nao bate com o ano de dataCotacao (${anoCotacao})`);
  }

  // --- produto ---
  if (!naoNulo(record.produto) || record.produto === "") {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "produto", "produto e obrigatorio");
  } else if (typeof record.produto !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "produto", "produto deve ser texto");
  }

  // --- formula (chave obrigatoria, valor aceita null) ---
  if (!("formula" in record)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "formula", "formula e obrigatoria como campo (use null quando desconhecida)");
  } else if (record.formula !== null && (typeof record.formula !== "string" || record.formula === "")) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "formula", "formula deve ser texto nao vazio ou null");
  }

  // --- categoriaFormula (opcional) ---
  if ("categoriaFormula" in record && record.categoriaFormula !== null) {
    if (typeof record.categoriaFormula !== "string" || record.categoriaFormula === "") {
      add(TIPOS_ERRO.VALOR_INVALIDO, "categoriaFormula", "categoriaFormula deve ser texto nao vazio ou null");
    }
  }

  // --- fornecedor ---
  if (!naoNulo(record.fornecedor) || record.fornecedor === "") {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "fornecedor", "fornecedor e obrigatorio");
  } else if (typeof record.fornecedor !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "fornecedor", "fornecedor deve ser texto");
  }

  // --- preco ---
  if (!naoNulo(record.preco)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "preco", "preco e obrigatorio");
  } else if (!numeroFinito(record.preco) || record.preco <= 0) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "preco", `preco deve ser um numero maior que zero, recebido: ${JSON.stringify(record.preco)}`);
  }

  // --- moeda ---
  if (!naoNulo(record.moeda)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "moeda", "moeda e obrigatoria");
  } else if (!MOEDAS_SUPORTADAS.includes(record.moeda)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "moeda", `moeda "${record.moeda}" nao suportada nesta etapa (aceitas: ${MOEDAS_SUPORTADAS.join(", ")})`);
  }

  // --- unidadePreco ---
  if (!naoNulo(record.unidadePreco)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "unidadePreco", "unidadePreco e obrigatoria");
  } else if (!UNIDADES_PRECO_SUPORTADAS.includes(record.unidadePreco)) {
    add(TIPOS_ERRO.UNIDADE_INVALIDA, "unidadePreco", `unidadePreco "${record.unidadePreco}" nao suportada (aceitas: ${UNIDADES_PRECO_SUPORTADAS.join(", ")})`);
  }

  // --- modalidadeEntrega ---
  if (!naoNulo(record.modalidadeEntrega)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "modalidadeEntrega", "modalidadeEntrega e obrigatoria (use NAO_INFORMADO quando desconhecida)");
  } else if (!MODALIDADES_ENTREGA_VALIDAS.includes(record.modalidadeEntrega)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "modalidadeEntrega", `modalidadeEntrega "${record.modalidadeEntrega}" invalida (aceitas: ${MODALIDADES_ENTREGA_VALIDAS.join(", ")})`);
  }

  // --- destino (opcional) ---
  if ("destino" in record && record.destino !== null && typeof record.destino !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "destino", "destino deve ser texto ou null");
  }

  // --- volumeToneladas (opcional) ---
  if (naoNulo(record.volumeToneladas) && (!numeroFinito(record.volumeToneladas) || record.volumeToneladas <= 0)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "volumeToneladas", `volumeToneladas deve ser um numero maior que zero ou null, recebido: ${JSON.stringify(record.volumeToneladas)}`);
  }

  // --- prazoPagamentoDias (opcional) ---
  if (naoNulo(record.prazoPagamentoDias) && (!Number.isInteger(record.prazoPagamentoDias) || record.prazoPagamentoDias < 0)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "prazoPagamentoDias", `prazoPagamentoDias deve ser um inteiro >= 0 ou null, recebido: ${JSON.stringify(record.prazoPagamentoDias)}`);
  }

  // --- validadeProposta (opcional) ---
  if (naoNulo(record.validadeProposta) && !isValidIsoDate(record.validadeProposta)) {
    add(TIPOS_ERRO.DATA_INVALIDA, "validadeProposta", `validadeProposta invalida: "${record.validadeProposta}" (esperado YYYY-MM-DD ou null)`);
  }

  // --- fonteRegistro ---
  if (!naoNulo(record.fonteRegistro)) {
    add(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, "fonteRegistro", "fonteRegistro e obrigatoria");
  } else if (!FONTES_REGISTRO_VALIDAS.includes(record.fonteRegistro)) {
    add(TIPOS_ERRO.VALOR_INVALIDO, "fonteRegistro", `fonteRegistro "${record.fonteRegistro}" invalida (aceitas: ${FONTES_REGISTRO_VALIDAS.join(", ")})`);
  }

  // --- observacoes (opcional) ---
  if ("observacoes" in record && record.observacoes !== null && typeof record.observacoes !== "string") {
    add(TIPOS_ERRO.VALOR_INVALIDO, "observacoes", "observacoes deve ser texto ou null");
  }

  return errors;
}

/** Valida so a forma do envelope raiz ({ schemaVersion, description, records }). */
export function validateRoot(data) {
  const errors = [];
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return [erro(TIPOS_ERRO.ESTRUTURAL, "a base deve ser um objeto JSON com schemaVersion, description e records")];
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, `schemaVersion deve ser ${SCHEMA_VERSION}, recebido: ${JSON.stringify(data.schemaVersion)}`));
  }
  if (typeof data.description !== "string" || data.description.trim() === "") {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, "description e obrigatoria e deve ser um texto nao vazio"));
  }
  if (!Array.isArray(data.records)) {
    errors.push(erro(TIPOS_ERRO.ESTRUTURAL, "records deve ser um array (pode ser vazio)"));
  }
  return errors;
}

/**
 * Valida a base inteira: envelope raiz, cada registro e duplicidade de id entre
 * registros. Uma base com records: [] e valida (nao e tratada como erro).
 *
 * Retorna { valid, recordCount, errors, summary }. Nunca lanca excecao para dados
 * invalidos -- excecoes so vem de bugs no proprio modulo.
 */
export function validateHistory(data) {
  const rootErrors = validateRoot(data);
  // Sem um array de records valido, nao ha como seguir validando registro a registro.
  if (!Array.isArray(data?.records)) {
    return {
      valid: false,
      recordCount: 0,
      errors: rootErrors,
      summary: `Base invalida: ${rootErrors.length} erro(s) estrutural(is). Nao foi possivel validar registros.`,
    };
  }

  const recordErrors = [];
  const vistos = new Map(); // id -> primeiro indice em que apareceu
  data.records.forEach((record, index) => {
    recordErrors.push(...validateRecord(record, index));
    const id = record?.id;
    if (typeof id === "string" && id !== "") {
      if (vistos.has(id)) {
        recordErrors.push(erro(TIPOS_ERRO.ID_DUPLICADO, `id "${id}" duplicado (indices ${vistos.get(id)} e ${index})`, { index, id, field: "id" }));
      } else {
        vistos.set(id, index);
      }
    }
  });

  const errors = [...rootErrors, ...recordErrors];
  const recordCount = data.records.length;
  const valid = errors.length === 0;
  const summary = valid
    ? (recordCount === 0
        ? "Base vazia (0 registros) — valida."
        : `Base valida com ${recordCount} registro(s).`)
    : `Base invalida: ${errors.length} erro(s) em ${recordCount} registro(s).`;

  return { valid, recordCount, errors, summary };
}

/**
 * Devolve uma copia do registro com os campos textuais (CAMPOS_TEXTO_NORMALIZAVEIS)
 * aparados (trim). Nao mexe em preco, datas, numeros ou enums -- e nunca inventa,
 * arredonda ou zera valor nenhum. Nao normaliza um registro invalido silenciosamente:
 * quem chamar deve validar antes ou depois, conforme a necessidade.
 */
export function normalizeRecord(record) {
  if (record === null || typeof record !== "object") return record;
  const copia = { ...record };
  for (const campo of CAMPOS_TEXTO_NORMALIZAVEIS) {
    if (typeof copia[campo] === "string") copia[campo] = copia[campo].trim();
  }
  return copia;
}

/** Aplica normalizeRecord() a todos os registros de uma base, sem alterar o restante do objeto. */
export function normalizeHistory(data) {
  if (data === null || typeof data !== "object" || !Array.isArray(data.records)) return data;
  return { ...data, records: data.records.map(normalizeRecord) };
}

/**
 * Le e faz JSON.parse do arquivo em filePath. Nao valida o conteudo -- so isola os
 * dois jeitos de falha que precisam de um tipo de erro proprio (arquivo inexistente,
 * JSON invalido) do resto da validacao.
 * Retorna { ok: true, data } ou { ok: false, errors: [...] }.
 */
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

/**
 * Combina readHistoryFile() + validateHistory() num unico resultado, no mesmo
 * formato de validateHistory (valid/recordCount/errors/summary), para quem so quer
 * "carregar e validar o arquivo real" sem se preocupar com as duas etapas.
 */
export function loadAndValidateHistoryFile(filePath) {
  const lido = readHistoryFile(filePath);
  if (!lido.ok) {
    return {
      valid: false,
      recordCount: 0,
      errors: lido.errors,
      summary: `Nao foi possivel carregar a base: ${lido.errors.map((e) => e.message).join(" | ")}`,
    };
  }
  return validateHistory(lido.data);
}
