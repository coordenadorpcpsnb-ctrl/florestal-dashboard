/**
 * import-formulated-history.mjs — Importa um CSV de precos de formulados para a base
 * JSON privada (local, fora do Git).
 *
 * Exporta funcoes puras e testaveis (planImport, escreverSaidaAtomica, validacao de
 * caminho de saida, ordenacao) -- a parte de I/O e o parsing de argv ficam isolados
 * no bloco de CLI no final do arquivo, que so roda quando este arquivo e executado
 * diretamente (node import-formulated-history.mjs ...), nunca quando e importado
 * pelos testes. Isso deixa a logica de merge/conflito/ordenacao testavel sem
 * precisar de subprocesso para cada cenario.
 *
 * Reusa formulated-price-csv.mjs (parsing/conversao) e formulated-price-history.mjs
 * (normalizeRecord/validateRecord/validateHistory/loadAndValidateHistoryFile) --
 * nao duplica nenhuma regra de validacao de registro aqui.
 *
 * SEGURANCA: este modulo nunca imprime preco, fornecedor, produto, formula, volume,
 * destino, prazo ou observacoes. So numero de linha, id tecnico (quando permitido),
 * nome do campo e tipo/categoria do erro. Nunca grava na base publica conhecida
 * (data/formulated-prices-history.json) nem em qualquer caminho que nao termine em
 * ".private.json". Nunca procura um arquivo privado por conta propria -- a entrada e
 * a saida sao sempre caminhos explicitos passados por quem chama.
 *
 * Nao e chamado por run-weekly.mjs nem por nenhum script da esteira semanal.
 */
import { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeRecord,
  validateHistory,
  loadAndValidateHistoryFile,
  readHistoryFile,
  SCHEMA_VERSION,
} from "./formulated-price-history.mjs";
import { converterCsvParaRegistros } from "./formulated-price-csv.mjs";

export const DESCRICAO_PADRAO_SAIDA = "Base privada de precos historicos de fertilizantes formulados. Nao versionar.";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const CAMINHO_BASE_PUBLICA = join(__dirname, "data", "formulated-prices-history.json");

function erro(type, message, extra = {}) {
  return { type, message, ...extra };
}

/**
 * Regra de seguranca sobre o caminho de saida (etapa 4 do prompt): nunca a base
 * publica conhecida; sempre precisa terminar em ".private.json". "data/private/"
 * e so RECOMENDADO na documentacao -- a regra tecnicamente aplicada, mais simples
 * e dificil de burlar sem perceber, e o sufixo do nome do arquivo (a mesma regra
 * que ja protege esse padrao no .gitignore, "*.private.json").
 */
export function validarCaminhoSaida(caminhoAbsoluto) {
  if (caminhoAbsoluto === CAMINHO_BASE_PUBLICA) {
    return { ok: false, motivo: "SAIDA_E_BASE_PUBLICA", mensagem: "a saida nao pode ser a base publica (data/formulated-prices-history.json)" };
  }
  if (!caminhoAbsoluto.endsWith(".private.json")) {
    return { ok: false, motivo: "SAIDA_NAO_PRIVADA", mensagem: 'a saida precisa terminar em ".private.json"' };
  }
  return { ok: true };
}

/** Ordena por dataCotacao crescente, depois id crescente para desempate (regra de ordenacao determinstica). */
export function ordenarRegistros(records) {
  return [...records].sort((a, b) => {
    const da = a.dataCotacao ?? "";
    const db = b.dataCotacao ?? "";
    if (da !== db) return da < db ? -1 : 1;
    const ia = a.id ?? "";
    const ib = b.id ?? "";
    if (ia !== ib) return ia < ib ? -1 : 1;
    return 0;
  });
}

/** Compara dois registros ja normalizados, ignorando ordem de chaves. */
export function registrosEstruturalmenteIguais(a, b) {
  const chavesOrdenadas = (o) => Object.keys(o).sort().reduce((acc, k) => { acc[k] = o[k]; return acc; }, {});
  return JSON.stringify(chavesOrdenadas(a)) === JSON.stringify(chavesOrdenadas(b));
}

/**
 * Monta o plano de importacao: le o CSV (texto ja carregado), converte, normaliza,
 * valida (reusando validateHistory, que ja cobre duplicidade de id DENTRO do CSV de
 * graca) e decide, registro a registro, se e novo / ja existente / conflito contra
 * `saidaExistente`. NAO faz I/O nenhum -- 100% funcao pura, testavel em memoria.
 *
 * `saidaExistente` (opcional): null quando o arquivo de saida ainda nao existe, ou
 * { existe:true, valido:boolean, data, errors } quando ja existe (o chamador decide
 * como carregar/validar -- normalmente via loadAndValidateHistoryFile + o data bruto).
 *
 * Retorna um objeto rico o bastante para tanto o resumo do dry-run quanto a escrita.
 */
export function planImport({ csvText, saidaExistente = null }) {
  const csv = converterCsvParaRegistros(csvText);
  const linhasLidas = csv.totalLinhasDados + csv.blankLinesSkipped;

  if (csv.errors.length) {
    return {
      ok: false,
      linhasLidas,
      linhasVaziasIgnoradas: csv.blankLinesSkipped,
      registrosConvertidos: csv.registrosConvertidos,
      registrosValidos: 0,
      registrosInvalidos: linhasLidas - csv.blankLinesSkipped,
      novos: [],
      jaExistentes: [],
      conflitos: [],
      saidaExistenteInvalida: false,
      outputFinal: null,
      errors: csv.errors,
    };
  }

  if (saidaExistente?.existe && !saidaExistente.valido) {
    return {
      ok: false,
      linhasLidas,
      linhasVaziasIgnoradas: csv.blankLinesSkipped,
      registrosConvertidos: csv.registrosConvertidos,
      registrosValidos: 0,
      registrosInvalidos: 0,
      novos: [],
      jaExistentes: [],
      conflitos: [],
      saidaExistenteInvalida: true,
      outputFinal: null,
      errors: [erro("SAIDA_EXISTENTE_INVALIDA", "o arquivo de saida ja existe mas nao passou na validacao -- nada foi alterado"), ...(saidaExistente.errors ?? [])],
    };
  }

  const normalizados = csv.records.map(normalizeRecord);
  const validacao = validateHistory({ schemaVersion: SCHEMA_VERSION, description: "validacao temporaria do lote importado", records: normalizados });

  // separa os erros de validacao por registro dos erros de conversao (ja tratados acima)
  const errosPorRegistro = validacao.errors;
  const idsComErro = new Set(errosPorRegistro.filter((e) => e.id != null).map((e) => e.id));
  const registrosValidosCandidatos = normalizados.filter((r) => !idsComErro.has(r.id));
  const registrosInvalidos = normalizados.length - registrosValidosCandidatos.length;

  const existentesPorId = new Map((saidaExistente?.data?.records ?? []).map((r) => [r.id, r]));
  const novos = [];
  const jaExistentes = [];
  const conflitos = [];

  for (const candidato of registrosValidosCandidatos) {
    const existente = existentesPorId.get(candidato.id);
    if (!existente) {
      novos.push(candidato);
    } else if (registrosEstruturalmenteIguais(normalizeRecord(existente), candidato)) {
      jaExistentes.push(candidato.id);
    } else {
      conflitos.push({ id: candidato.id });
    }
  }

  const ok = errosPorRegistro.length === 0 && conflitos.length === 0;

  let outputFinal = null;
  if (ok) {
    const raizBase = saidaExistente?.existe
      ? { schemaVersion: saidaExistente.data.schemaVersion, description: saidaExistente.data.description }
      : { schemaVersion: SCHEMA_VERSION, description: DESCRICAO_PADRAO_SAIDA };
    const todosOsRegistros = [...(saidaExistente?.data?.records ?? []), ...novos];
    outputFinal = { ...raizBase, records: ordenarRegistros(todosOsRegistros) };
  }

  const conflitoErrors = conflitos.map((c) => erro("CONFLITO_ID", "registro ja existe na saida com conteudo diferente -- nao sobrescrito", { id: c.id }));

  return {
    ok,
    linhasLidas,
    linhasVaziasIgnoradas: csv.blankLinesSkipped,
    registrosConvertidos: csv.registrosConvertidos,
    registrosValidos: registrosValidosCandidatos.length,
    registrosInvalidos,
    novos,
    jaExistentes,
    conflitos,
    saidaExistenteInvalida: false,
    outputFinal,
    errors: [...errosPorRegistro, ...conflitoErrors],
  };
}

/**
 * Carrega o estado atual do arquivo de saida (se existir) no formato que planImport()
 * espera em `saidaExistente`. Faz I/O (unica funcao deste modulo, fora do bloco de
 * CLI, que le disco) -- separada de planImport() para manter o merge 100% puro.
 */
export function carregarSaidaExistente(caminhoAbsoluto) {
  if (!existsSync(caminhoAbsoluto)) return null;
  const resultado = loadAndValidateHistoryFile(caminhoAbsoluto);
  if (!resultado.valid) {
    return { existe: true, valido: false, data: null, errors: resultado.errors };
  }
  const lido = readHistoryFile(caminhoAbsoluto);
  return { existe: true, valido: true, data: lido.data, errors: [] };
}

/**
 * Escrita atomica: grava num arquivo temporario no MESMO diretorio do destino,
 * valida o temporario com o proprio validador do projeto, e so entao renomeia por
 * cima do destino. Remove o temporario se qualquer passo falhar. Cria o diretorio
 * de destino se necessario (ex.: data/private/), mas nunca cria arquivo de backup.
 */
export function escreverSaidaAtomica(caminhoFinal, dataObj) {
  const dir = dirname(caminhoFinal);
  mkdirSync(dir, { recursive: true });
  const tmpPath = join(dir, `.${basename(caminhoFinal)}.tmp-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(tmpPath, JSON.stringify(dataObj, null, 2) + "\n", "utf-8");
    const validado = loadAndValidateHistoryFile(tmpPath);
    if (!validado.valid) {
      throw new Error("validacao do arquivo temporario falhou antes da gravacao final (isso nao deveria acontecer -- indica bug no importador)");
    }
    renameSync(tmpPath, caminhoFinal);
  } catch (e) {
    try { rmSync(tmpPath, { force: true }); } catch { /* melhor esforco */ }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// CLI -- so roda quando este arquivo e executado diretamente.
// ---------------------------------------------------------------------------
const executadoDiretamente = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (executadoDiretamente) {
  main();
}

function log(msg) { console.log(`[import:formulated-history] ${msg}`); }

function main() {
  const argsPosicionais = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
  const write = flags.has("--write");
  const hideIds = flags.has("--hide-ids");

  const [entradaArg, saidaArg] = argsPosicionais;
  if (!entradaArg || !saidaArg) {
    console.error("[import:formulated-history] uso: node import-formulated-history.mjs <entrada.csv> <saida.private.json> [--write] [--hide-ids]");
    process.exit(1);
  }

  const caminhoEntrada = resolve(process.cwd(), entradaArg);
  const caminhoSaida = resolve(process.cwd(), saidaArg);

  log(`entrada: ${caminhoEntrada}`);
  log(`saida: ${caminhoSaida}${write ? " (modo --write)" : " (dry-run -- nada sera gravado)"}`);

  const caminhoValido = validarCaminhoSaida(caminhoSaida);
  if (!caminhoValido.ok) {
    log(`saida rejeitada [${caminhoValido.motivo}]: ${caminhoValido.mensagem}`);
    process.exit(1);
  }

  let csvText;
  try {
    csvText = readFileSync(caminhoEntrada, "utf-8");
  } catch (e) {
    log(`nao foi possivel ler o arquivo de entrada: ${e.code === "ENOENT" ? "arquivo nao encontrado" : "erro de leitura"}`);
    process.exit(1);
  }

  const saidaExistente = carregarSaidaExistente(caminhoSaida);
  const plano = planImport({ csvText, saidaExistente });

  log(`linhas lidas: ${plano.linhasLidas}`);
  log(`linhas vazias ignoradas: ${plano.linhasVaziasIgnoradas}`);
  log(`registros convertidos: ${plano.registrosConvertidos}`);
  log(`registros validos: ${plano.registrosValidos}`);
  log(`registros invalidos: ${plano.registrosInvalidos}`);
  log(`registros novos: ${plano.novos.length}`);
  log(`registros ja existentes (identicos, nao duplicados): ${plano.jaExistentes.length}`);
  log(`conflitos de id: ${plano.conflitos.length}`);

  if (plano.errors.length) {
    log(`${plano.errors.length} erro(s):`);
    for (const e of plano.errors) {
      const local = e.line != null ? `linha ${e.line}` : (e.id != null && !hideIds ? `id="${e.id}"` : "—");
      const campo = e.field ? `, campo "${e.field}"` : "";
      console.log(`  - [${e.type}] ${local}${campo}: ${e.message}`);
    }
  }

  if (!write) {
    log("dry-run: nada foi gravado.");
    process.exit(plano.ok ? 0 : 1);
  }

  if (!plano.ok) {
    log("--write: importacao invalida ou com conflito -- nada foi gravado.");
    process.exit(1);
  }

  try {
    escreverSaidaAtomica(caminhoSaida, plano.outputFinal);
  } catch (e) {
    log(`falha ao gravar a saida: ${e.message}`);
    process.exit(1);
  }
  log(`gravado com sucesso: ${plano.outputFinal.records.length} registro(s) no total em ${caminhoSaida}`);
  process.exit(0);
}
