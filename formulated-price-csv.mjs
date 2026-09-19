/**
 * formulated-price-csv.mjs — Parser e conversor de CSV para o formato de registro do
 * historico de precos de fertilizantes formulados.
 *
 * Modulo PURO: nao le arquivo nenhum (recebe o texto ja carregado), nao imprime nada,
 * nao decide nada sobre gravar em disco. So conhece: texto CSV -> lista de registros
 * candidatos (ainda nao validados) + lista de erros estruturais/de conversao.
 *
 * A validacao de verdade de cada registro (datas, enums, obrigatoriedade, unicidade de
 * id) continua inteiramente em formulated-price-history.mjs -- este modulo so faz o
 * trabalho que so ele pode fazer (parsing de texto e conversao string->numero/inteiro),
 * para nao duplicar regra nenhuma de validacao.
 *
 * Formato aceito: CSV UTF-8, delimitador ";", primeira linha = cabecalho, aspas duplas
 * para campos com ";" ou quebra de linha dentro, aspas escapadas como "" (padrao RFC
 * 4180), CRLF ou LF, com ou sem BOM UTF-8 no inicio, com ou sem quebra de linha final.
 * Nao ha suporte a XLSX nem a nenhum outro formato nesta etapa.
 */
import {
  CAMPOS_RECORD_PERMITIDOS,
  CAMPOS_RECORD_OBRIGATORIOS,
  TIPOS_ERRO,
} from "./formulated-price-history.mjs";

export const DELIMITADOR = ";";

/** Ordem canonica das 18 colunas -- usada no template publico e como referencia de
 *  documentacao. O parser aceita qualquer ordem no cabecalho real (regra 7). */
export const CABECALHO_CANONICO = Object.freeze([
  "id", "dataCotacao", "dataCompra", "anoReferencia", "produto", "formula",
  "categoriaFormula", "fornecedor", "preco", "moeda", "unidadePreco",
  "modalidadeEntrega", "destino", "volumeToneladas", "prazoPagamentoDias",
  "validadeProposta", "fonteRegistro", "observacoes",
]);

/** Tipos de erro especificos de estrutura de CSV, que nao existem no modulo base
 *  (formulated-price-history.mjs) porque so fazem sentido num arquivo tabular. Erros
 *  de campo (obrigatorio ausente, valor invalido, coluna desconhecida) reusam
 *  TIPOS_ERRO do modulo base, para nao ter dois nomes para a mesma coisa. */
export const TIPOS_ERRO_CSV = Object.freeze({
  CABECALHO_AUSENTE: "CABECALHO_AUSENTE",
  COLUNA_DUPLICADA: "COLUNA_DUPLICADA",
  ASPAS_NAO_FECHADAS: "ASPAS_NAO_FECHADAS",
  NUMERO_COLUNAS_INCONSISTENTE: "NUMERO_COLUNAS_INCONSISTENTE",
});

/** Campos numericos que passam por conversao de tipo nesta etapa. */
const CAMPO_INTEIRO_ESTRITO = new Set(["anoReferencia", "prazoPagamentoDias"]);
const CAMPO_DECIMAL = new Set(["preco", "volumeToneladas"]);
const CAMPOS_OPCIONAIS_VAZIO_OMITE = new Set([
  "dataCompra", "formula", "categoriaFormula", "destino",
  "volumeToneladas", "prazoPagamentoDias", "validadeProposta", "observacoes",
]);

function erro(type, message, extra = {}) {
  return { type, message, ...extra };
}

/**
 * Faz o parse de uma string decimal aceitando "," OU "." como separador decimal,
 * mas NUNCA separador de milhar (rejeita "1.234,56", "1,234.56" e "1.234.567").
 * Retorna { ok:true, value } ou { ok:false }.
 */
export function parseDecimalPtOuEn(texto) {
  const s = String(texto).trim();
  if (!/^-?\d+([.,]\d+)?$/.test(s)) return { ok: false };
  const v = Number(s.replace(",", "."));
  if (!Number.isFinite(v)) return { ok: false };
  return { ok: true, value: v };
}

/** Inteiro estrito: só dígitos (com sinal opcional), sem parte decimal. */
export function parseInteiroEstrito(texto) {
  const s = String(texto).trim();
  if (!/^-?\d+$/.test(s)) return { ok: false };
  const v = Number(s);
  if (!Number.isInteger(v)) return { ok: false };
  return { ok: true, value: v };
}

/**
 * Parser CSV de baixo nivel: texto inteiro -> lista de linhas (cada uma com numero
 * da linha fisica onde comeca e o array de celulas), mais erros estruturais (aspas
 * nao fechadas). Nao sabe nada sobre cabecalho nem sobre os campos do dominio --
 * so entende a gramatica do CSV em si. Remove o BOM UTF-8 se presente.
 */
export function parseCsvRows(textoOriginal) {
  let texto = String(textoOriginal ?? "");
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // BOM UTF-8

  const rows = [];
  const errors = [];
  let blankLinesSkipped = 0;

  let campo = "";
  let linhaAtual = [];
  let linhaInicioAtual = 1;
  let dentroDeAspas = false;
  let numeroLinha = 1;

  const fecharCampo = () => { linhaAtual.push(campo); campo = ""; };
  const fecharLinha = () => {
    fecharCampo();
    // "totalmente vazia" = nenhum delimitador viu, nenhum caractere viu (so o \n).
    const linhaTotalmenteVazia = linhaAtual.length === 1 && linhaAtual[0] === "";
    if (linhaTotalmenteVazia) {
      blankLinesSkipped += 1;
    } else {
      rows.push({ line: linhaInicioAtual, cells: linhaAtual });
    }
    linhaAtual = [];
  };

  let i = 0;
  const n = texto.length;
  while (i < n) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i += 2; continue; }
        dentroDeAspas = false; i += 1; continue;
      }
      if (c === "\n") { campo += "\n"; numeroLinha += 1; i += 1; continue; }
      if (c === "\r") { i += 1; continue; } // CRLF dentro de aspas: o \r e ignorado, o \n conta a linha
      campo += c; i += 1; continue;
    }
    // aspas so tem efeito especial bem no inicio do campo (campo ainda vazio)
    if (c === '"' && campo === "") { dentroDeAspas = true; i += 1; continue; }
    if (c === DELIMITADOR) { fecharCampo(); i += 1; continue; }
    if (c === "\r") { i += 1; continue; } // absorvido; o \n seguinte fecha a linha
    if (c === "\n") {
      fecharLinha();
      numeroLinha += 1;
      linhaInicioAtual = numeroLinha;
      i += 1;
      continue;
    }
    campo += c; i += 1; continue;
  }

  if (dentroDeAspas) {
    errors.push(erro(TIPOS_ERRO_CSV.ASPAS_NAO_FECHADAS, "aspas nao fechadas no arquivo CSV", { line: linhaInicioAtual }));
  } else if (campo !== "" || linhaAtual.length > 0) {
    // ultima linha do arquivo sem quebra de linha final
    fecharLinha();
  }

  return { rows, errors, blankLinesSkipped };
}

/**
 * Valida um cabecalho ja tokenizado (array de nomes de coluna, na ordem em que
 * aparecem no arquivo) contra CAMPOS_RECORD_PERMITIDOS/OBRIGATORIOS. Nao exige
 * ordem canonica (regra 7). Retorna { ok, errors, header } onde `header` e o
 * array de nomes (sem espacos nas pontas) quando ok.
 */
export function validarCabecalho(celulasCabecalho) {
  const errors = [];
  if (!Array.isArray(celulasCabecalho) || celulasCabecalho.length === 0) {
    return { ok: false, errors: [erro(TIPOS_ERRO_CSV.CABECALHO_AUSENTE, "cabecalho ausente ou vazio", { line: 1 })], header: null };
  }
  const header = celulasCabecalho.map((h) => String(h).trim());

  const vistos = new Map(); // nome -> primeira posicao (1-based)
  header.forEach((nome, idx) => {
    if (vistos.has(nome)) {
      errors.push(erro(TIPOS_ERRO_CSV.COLUNA_DUPLICADA, `coluna duplicada no cabecalho: "${nome}"`, { line: 1, field: nome }));
    } else {
      vistos.set(nome, idx + 1);
    }
    if (!CAMPOS_RECORD_PERMITIDOS.includes(nome)) {
      errors.push(erro(TIPOS_ERRO.CAMPO_DESCONHECIDO, `coluna desconhecida no cabecalho: "${nome}"`, { line: 1, field: nome }));
    }
  });

  for (const obrigatorio of CAMPOS_RECORD_OBRIGATORIOS) {
    if (!vistos.has(obrigatorio)) {
      errors.push(erro(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, `coluna obrigatoria ausente no cabecalho: "${obrigatorio}"`, { line: 1, field: obrigatorio }));
    }
  }

  return { ok: errors.length === 0, errors, header: errors.length === 0 ? header : null };
}

/**
 * Converte uma linha de dados (celulas + numero da linha) num registro candidato,
 * usando o `header` ja validado por validarCabecalho(). NAO valida o registro (isso
 * e trabalho de validateRecord, no modulo base) -- so faz a travessia estrutural:
 * numero de colunas bate com o cabecalho, campos numericos convertem, campos
 * opcionais vazios viram ausencia de propriedade (decisao documentada abaixo).
 *
 * Retorna { ok:true, record } ou { ok:false, errors }.
 */
export function linhaParaRegistroCandidato(header, row) {
  const { line, cells } = row;
  if (cells.length !== header.length) {
    return {
      ok: false,
      errors: [erro(TIPOS_ERRO_CSV.NUMERO_COLUNAS_INCONSISTENTE, `linha com ${cells.length} coluna(s), esperado ${header.length}`, { line })],
    };
  }

  const errors = [];
  const record = {};

  header.forEach((nomeCampo, idx) => {
    const bruto = cells[idx];
    const valor = typeof bruto === "string" ? bruto.trim() : bruto;
    const vazio = valor === "" || valor == null;
    const opcional = CAMPOS_OPCIONAIS_VAZIO_OMITE.has(nomeCampo);

    if (vazio) {
      if (!opcional) {
        // campo obrigatorio vazio: regra 13. Mesmo tipo de erro que o modulo base usaria.
        errors.push(erro(TIPOS_ERRO.CAMPO_OBRIGATORIO_AUSENTE, `${nomeCampo} esta vazio nesta linha`, { line, field: nomeCampo }));
      }
      // opcional vazio: OMITE a propriedade do objeto (decisao documentada no README).
      return;
    }

    if (CAMPO_INTEIRO_ESTRITO.has(nomeCampo)) {
      const conv = parseInteiroEstrito(valor);
      if (!conv.ok) {
        errors.push(erro(TIPOS_ERRO.VALOR_INVALIDO, `${nomeCampo} deve ser um numero inteiro`, { line, field: nomeCampo }));
      } else {
        record[nomeCampo] = conv.value;
      }
      return;
    }

    if (CAMPO_DECIMAL.has(nomeCampo)) {
      const conv = parseDecimalPtOuEn(valor);
      if (!conv.ok) {
        errors.push(erro(TIPOS_ERRO.VALOR_INVALIDO, `${nomeCampo} deve ser um numero decimal valido (separador "," ou "."), sem separador de milhar`, { line, field: nomeCampo }));
      } else {
        record[nomeCampo] = conv.value;
      }
      return;
    }

    // datas: mantidas como string, validadas depois por isValidIsoDate via validateRecord.
    // demais campos de texto: mantidos como string, validados depois (enum/obrigatoriedade).
    record[nomeCampo] = valor;
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true, record, line };
}

/**
 * Funcao de alto nivel: texto CSV completo -> { header, records, errors, resumo }.
 * `records` traz so os candidatos estruturalmente convertidos com sucesso (ainda
 * nao passaram por validateRecord/validateHistory -- isso e responsabilidade de
 * quem chama, em import-formulated-history.mjs). `errors` acumula problemas de
 * cabecalho e de conversao por linha; nenhum deles contem o conteudo bruto da
 * linha, so numero da linha, tipo e campo.
 */
export function converterCsvParaRegistros(textoCsv) {
  const { rows, errors: errosParse, blankLinesSkipped } = parseCsvRows(textoCsv);

  if (errosParse.length) {
    return { header: null, records: [], errors: errosParse, totalLinhasDados: 0, blankLinesSkipped, registrosConvertidos: 0 };
  }
  if (rows.length === 0) {
    return { header: null, records: [], errors: [erro(TIPOS_ERRO_CSV.CABECALHO_AUSENTE, "arquivo CSV vazio", { line: 1 })], totalLinhasDados: 0, blankLinesSkipped, registrosConvertidos: 0 };
  }

  const [linhaCabecalho, ...linhasDados] = rows;
  const { ok, errors: errosCabecalho, header } = validarCabecalho(linhaCabecalho.cells);
  if (!ok) {
    return { header: null, records: [], errors: errosCabecalho, totalLinhasDados: linhasDados.length, blankLinesSkipped, registrosConvertidos: 0 };
  }

  const records = [];
  const errors = [];
  for (const row of linhasDados) {
    const resultado = linhaParaRegistroCandidato(header, row);
    if (resultado.ok) records.push(resultado.record);
    else errors.push(...resultado.errors);
  }

  return {
    header,
    records,
    errors,
    totalLinhasDados: linhasDados.length,
    blankLinesSkipped,
    registrosConvertidos: records.length,
  };
}
