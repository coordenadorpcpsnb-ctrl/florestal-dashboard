/**
 * extract-market-driver-history.mjs — Extrator historico controlado: reconstroi,
 * a partir do historico Git LOCAL de data.json, uma serie temporal estruturada
 * dos direcionadores PUBLICOS de mercado (schema em
 * schemas/market-driver-history.schema.json, contrato em market-driver-history.mjs).
 *
 * Le SOMENTE o historico Git local (git log/git show, nunca checkout/reset/
 * rebase/branch/worktree/stash). NUNCA consulta API externa, NUNCA acessa
 * data/private/, *.private.json nem qualquer dado de formulados (preco,
 * fornecedor, volume, prazo, contrato, cotacao interna). NAO cruza
 * direcionadores com formulados, NAO calcula correlacao/peso/regressao/
 * previsao, NAO define faixa de negociacao, NAO recomenda compra.
 *
 * === Principio central (nunca tratar automaticamente) ===
 * commit != observacao economica; updatedAt != referenceDate; previous != "uma
 * semana atras"; conteudo diferente != nova observacao de TODOS os indicadores;
 * fallback != preco novo; valor congelado != atualizacao de mercado. Cada uma
 * dessas equivalencias falsas so e aceita quando ha evidencia explicita no
 * proprio repositorio (ver classificarStatusFonte/calcularReferencia abaixo) --
 * na ausencia de evidencia, o resultado e NAO_IDENTIFICAVEL/NAO_RASTREAVEL, nunca
 * uma suposicao.
 *
 * === Separacao de dominios (emenda arquitetural da Etapa 5) ===
 * Ver cabecalho de market-driver-history.mjs. Este extrator so le data.json (a
 * fotografia de mercado) e, so para checar evidencia de override,
 * fertilizers-override.json -- nunca nenhum arquivo de formulados.
 *
 * === Testabilidade ===
 * Toda a logica de leitura do Git fica atras de um "adaptador" injetavel
 * ({listarCommits, lerArquivoNoCommit}) -- criarAdaptadorGitReal() usa
 * spawnSync (so leitura); os testes usam um adaptador fictício em memoria, sem
 * rede nem dependencia do historico real. As funcoes de parsing/classificacao/
 * deduplicacao/cobertura sao puras (recebem dados, devolvem dados).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SCHEMA_VERSION,
  STATUS_OBSERVACAO,
  CONFIANCA_EXTRACAO,
  TIPOS_CONFLITO,
  INDICADORES_SUPORTADOS,
  INDICADOR_UNIDADE,
  isValidIsoDate,
  isValidYearMonth,
  loadAndValidateHistoryFile,
} from "./market-driver-history.mjs";

export const DESCRICAO_SERIE =
  "Serie historica reconstruida a partir do historico Git LOCAL de data.json -- " +
  "so direcionadores PUBLICOS de mercado (cambio, fertilizantes FOB, gas natural, " +
  "frete, soja). NAO contem dados de formulados (preco/fornecedor/volume/prazo/ " +
  "contrato). NAO e previsao, NAO calcula correlacao, peso ou regressao, NAO " +
  "define faixa de negociacao, NAO recomenda compra, NAO foi cruzada com o " +
  "historico privado de formulados. commit != observacao economica -- ver " +
  "sourceStatus/extractionConfidence de cada observacao antes de usar o valor.";

// === indicador -> chave de status/override em data.json / fertilizers-override.json ===
// Evidenciado em check-status.mjs (tabela FONTES) e em fetch-data.mjs (objeto `ov`).
// sojaTO usa "sojaRegional" no status e "sojaTO" no override; gas usa "gas" no
// status mas "gasNatural" no override -- as duas excecoes reais do repositorio,
// nao inventadas.
const INDICADOR_STATUS_KEY = Object.freeze({
  dolar: "cambio", ureia: "ureia", map: "map", kcl: "kcl",
  gas: "gas", bdi: "bdi", soja: "soja", sojaTO: "sojaRegional",
});
const INDICADOR_OVERRIDE_KEY = Object.freeze({
  dolar: "dolar", ureia: "ureia", map: "map", kcl: "kcl",
  gas: "gasNatural", bdi: "bdi", soja: "soja", sojaTO: "sojaTO",
});
const INDICADORES_MENSAIS = Object.freeze(["ureia", "map", "kcl"]);
const INDICADORES_COM_DATA_EM_TEXTO = Object.freeze(["bdi", "soja"]);

const naoNuloNumero = (v) => typeof v === "number" && Number.isFinite(v);

// ---------------------------------------------------------------------------
// Hash de commit: truncamento FIXO e deterministico (nunca o %h do Git, que
// muda de tamanho conforme o repositorio cresce).
// ---------------------------------------------------------------------------
export function truncarHash(hashCompleto) {
  if (typeof hashCompleto !== "string" || hashCompleto.length < 10) {
    throw new Error("hash de commit invalido para truncar (esperado >= 10 caracteres hex)");
  }
  return hashCompleto.slice(0, 10).toLowerCase();
}

// ---------------------------------------------------------------------------
// Adaptador Git real (so leitura: git log / git show). Interface:
//   listarCommits(caminhoRelativo) -> [{ hash, commitDate }]
//   lerArquivoNoCommit(hashCompleto, caminhoRelativo) -> string | null
// ---------------------------------------------------------------------------
export function criarAdaptadorGitReal(repoRoot) {
  return {
    listarCommits(caminhoRelativo) {
      const r = spawnSync("git", ["log", "--follow", "--format=%H|%aI", "--", caminhoRelativo], { cwd: repoRoot, encoding: "utf-8" });
      if (r.status !== 0) throw new Error(`git log falhou: ${(r.stderr || "").trim()}`);
      return r.stdout.trim().split("\n").filter(Boolean).map((linha) => {
        const [hash, commitDate] = linha.split("|");
        return { hash, commitDate };
      });
    },
    lerArquivoNoCommit(hashCompleto, caminhoRelativo) {
      const r = spawnSync("git", ["show", `${hashCompleto}:${caminhoRelativo}`], { cwd: repoRoot, encoding: "utf-8" });
      if (r.status !== 0) return null; // arquivo nao existia nesse commit (nunca lanca por isso)
      return r.stdout;
    },
  };
}

/** Ordena commits cronologicamente (commitDate asc), com hash como desempate --
 *  deterministico para a mesma lista de entrada, em qualquer ordem que o adaptador devolva. */
function ordenarCommits(commitsBrutos) {
  return [...commitsBrutos].sort((a, b) => {
    const da = a.commitDate ?? "", db = b.commitDate ?? "";
    if (da !== db) return da < db ? -1 : 1;
    return a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0;
  });
}

// ---------------------------------------------------------------------------
// Snapshot: analisa o conteudo bruto de um commit. Nunca lanca excecao para
// dado invalido -- so bugs no proprio modulo devem lancar.
// ---------------------------------------------------------------------------
export function analisarSnapshot(commitMeta, conteudoBruto) {
  if (conteudoBruto === null || conteudoBruto === undefined) {
    return { valido: false, motivo: "ARQUIVO_AUSENTE_NO_COMMIT", commitMeta };
  }
  let dados;
  try {
    dados = JSON.parse(conteudoBruto);
  } catch {
    return { valido: false, motivo: "JSON_INVALIDO", commitMeta };
  }
  if (dados === null || typeof dados !== "object" || Array.isArray(dados)) {
    return { valido: false, motivo: "ESTRUTURA_INESPERADA", commitMeta };
  }
  if (dados.current === null || typeof dados.current !== "object" || Array.isArray(dados.current)) {
    return { valido: false, motivo: "ESTRUTURA_INESPERADA", commitMeta };
  }
  return { valido: true, commitMeta, dados };
}

// ---------------------------------------------------------------------------
// Interpretacao SANITIZADA do texto de status: nunca devolve o texto bruto.
// sourceName vem de uma lista fixa de fontes conhecidas (evidenciadas no
// codigo de fetch-data.mjs/fetch-fertilizers.mjs); sourceMessage e sempre uma
// categoria fixa, nunca o texto completo (que pode conter fragmento de HTML de
// uma resposta de erro, como ja aconteceu em status.gas no historico real).
// ---------------------------------------------------------------------------
const FONTES_CONHECIDAS = Object.freeze([
  "BCB PTAX", "Frankfurter", "AwesomeAPI",
  "HANDYBULK", "stooq",
  "Noticias Agricolas", "CEPEA",
  "EIA Henry Hub", "ComexStat",
]);

export function interpretarStatusTexto(statusTexto) {
  if (typeof statusTexto !== "string" || statusTexto.trim() === "") {
    return { sourceName: null, sourceMessage: null, comecaOk: false, comecaFalha: false };
  }
  const texto = statusTexto.trim();
  const sourceName = FONTES_CONHECIDAS.find((f) => texto.includes(f)) ?? null;
  const comecaOk = /^ok\b/i.test(texto);
  const comecaFalha = /^falha/i.test(texto);

  let sourceMessage;
  if (comecaOk) sourceMessage = "ok";
  else if (comecaFalha) {
    if (/http\s*\d/i.test(texto)) sourceMessage = "falha_http";
    else if (/pars/i.test(texto)) sourceMessage = "falha_parse";
    else if (/implausivel/i.test(texto)) sourceMessage = "falha_valor_implausivel";
    else if (/timeout|abort/i.test(texto)) sourceMessage = "falha_timeout";
    else if (/eia_api_key/i.test(texto)) sourceMessage = "falha_sem_chave_configurada";
    else sourceMessage = "falha_outro";
  } else {
    sourceMessage = "status_nao_reconhecido";
  }
  return { sourceName, sourceMessage, comecaOk, comecaFalha };
}

// ---------------------------------------------------------------------------
// Classificacao de sourceStatus (5 valores fixos). So promove alem de
// NAO_IDENTIFICAVEL/AUSENTE quando ha evidencia estrutural real:
//   - OBSERVADO: status comeca com "ok".
//   - OVERRIDE_MANUAL: o valor bate com fertilizers-override.json NESSE MESMO
//     commit (forceManual explicito, ou valor igual ao override quando a busca
//     falhou) -- nunca so por o override "existir" hoje.
//   - FALLBACK_ULTIMO_CONHECIDO: a busca falhou E o valor bate com
//     `previous` do PROPRIO snapshot (evidencia auto-contida, reflete
//     exatamente a funcao escolher() de fetch-data.mjs).
//   - AUSENTE: value === null.
//   - NAO_IDENTIFICAVEL: qualquer outro caso (inclusive status ausente/
//     nao reconhecido, ou falha sem nenhuma das duas evidencias acima).
// ---------------------------------------------------------------------------
export function classificarStatusFonte({ value, statusInfo, anterior, overrideNesseCommit, chaveOverride }) {
  if (value === null) return STATUS_OBSERVACAO.AUSENTE;

  const overrideValor = overrideNesseCommit && naoNuloNumero(overrideNesseCommit[chaveOverride])
    ? overrideNesseCommit[chaveOverride] : null;
  const overrideForcado = overrideNesseCommit?.forceManual === true;

  // forceManual ativo nesse commit e o valor bate com o override desse commit:
  // a esteira usaria o override mesmo que a busca automatica tivesse ido bem.
  if (overrideForcado && overrideValor !== null && value === overrideValor) {
    return STATUS_OBSERVACAO.OVERRIDE_MANUAL;
  }

  if (!statusInfo.comecaOk && !statusInfo.comecaFalha) return STATUS_OBSERVACAO.NAO_IDENTIFICAVEL;
  if (statusInfo.comecaOk) return STATUS_OBSERVACAO.OBSERVADO;

  // comecaFalha:
  if (overrideValor !== null && value === overrideValor) return STATUS_OBSERVACAO.OVERRIDE_MANUAL;
  if (naoNuloNumero(anterior) && value === anterior) return STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO;
  return STATUS_OBSERVACAO.NAO_IDENTIFICAVEL;
}

// ---------------------------------------------------------------------------
// referenceDate / referencePeriod. Nunca deriva de commitDate/collectedAt.
//   - ureia/map/kcl: referencePeriod de refsFertilizantes (YYYY-MM valido),
//     referenceDate SEMPRE null (nunca inventa um dia do mes).
//   - bdi/soja (nacional): referenceDate extraida do texto de status SOMENTE
//     quando exatamente UMA data DD/MM/AAAA aparece no texto -- ambiguo (0 ou
//     2+ datas) fica null, conservador.
//   - dolar/gas/sojaTO: sem evidencia de referencia economica hoje (auditado
//     na Etapa 4: 0/29 commits com data identificavel para estes tres) --
//     sempre null.
// ---------------------------------------------------------------------------
const RE_DATA_BR = /(\d{2})\/(\d{2})\/(\d{4})/g;

function extrairDataDeTextoStatus(statusTexto) {
  if (typeof statusTexto !== "string") return null;
  const ocorrencias = [...statusTexto.matchAll(RE_DATA_BR)];
  if (ocorrencias.length !== 1) return null;
  const [, dd, mm, aaaa] = ocorrencias[0];
  const iso = `${aaaa}-${mm}-${dd}`;
  return isValidIsoDate(iso) ? iso : null;
}

export function calcularReferencia(indicator, dados, statusTexto) {
  if (INDICADORES_MENSAIS.includes(indicator)) {
    const periodo = dados?.refsFertilizantes?.[indicator];
    if (typeof periodo === "string" && isValidYearMonth(periodo)) {
      return { referenceDate: null, referencePeriod: periodo, viaInferenciaTexto: false };
    }
    return { referenceDate: null, referencePeriod: null, viaInferenciaTexto: false };
  }
  if (INDICADORES_COM_DATA_EM_TEXTO.includes(indicator)) {
    const data = extrairDataDeTextoStatus(statusTexto);
    return { referenceDate: data, referencePeriod: null, viaInferenciaTexto: data !== null };
  }
  return { referenceDate: null, referencePeriod: null, viaInferenciaTexto: false };
}

// ---------------------------------------------------------------------------
// extractionConfidence: rastreabilidade da EXTRACAO, nunca confianca de
// previsao/qualidade de preco.
// ---------------------------------------------------------------------------
export function classificarConfianca({ referenceDate, referencePeriod, viaInferenciaTexto, sourceStatus, collectedAt }) {
  if (viaInferenciaTexto && referenceDate !== null) return CONFIANCA_EXTRACAO.INFERENCIA_TECNICA;
  const referenciaEstruturada = referencePeriod !== null;
  const statusDeterminado = sourceStatus !== STATUS_OBSERVACAO.NAO_IDENTIFICAVEL;
  if (referenciaEstruturada && statusDeterminado) return CONFIANCA_EXTRACAO.ESTRUTURADA;
  if (referenciaEstruturada || statusDeterminado || collectedAt !== null) return CONFIANCA_EXTRACAO.PARCIAL;
  return CONFIANCA_EXTRACAO.NAO_RASTREAVEL;
}

// ---------------------------------------------------------------------------
// deduplicationKey -- ver regras da Etapa 5 (referenceDate > referencePeriod >
// fallback por collectedAt+commitHash, este ultimo sempre "un-groupavel").
// ---------------------------------------------------------------------------
export function calcularChaveDeduplicacao({ indicator, unit, referenceDate, referencePeriod, collectedAt, commitHash }) {
  if (referenceDate) return `${indicator}|${referenceDate}|${unit}`;
  if (referencePeriod) return `${indicator}|${referencePeriod}|${unit}`;
  return `${indicator}|${collectedAt ?? "SEM_COLLECTEDAT"}|${unit}|${commitHash}`;
}

// ---------------------------------------------------------------------------
// Candidatas (pre-deduplicacao): uma por indicador presente em `current`, para
// cada snapshot valido.
// ---------------------------------------------------------------------------
export function extrairCandidatas(snapshotValido, overrideNesseCommit) {
  const { commitMeta, dados } = snapshotValido;
  const collectedAt = typeof dados.updatedAt === "string" && dados.updatedAt.trim() !== "" ? dados.updatedAt : null;
  const commitDate = commitMeta.commitDate ?? null;
  const commitHash = truncarHash(commitMeta.hash);

  const candidatas = [];
  for (const indicator of INDICADORES_SUPORTADOS) {
    const value = naoNuloNumero(dados.current?.[indicator]) ? dados.current[indicator] : null;
    const statusKey = INDICADOR_STATUS_KEY[indicator];
    const statusTexto = typeof dados.status?.[statusKey] === "string" ? dados.status[statusKey] : null;
    const statusInfo = interpretarStatusTexto(statusTexto);
    const anterior = naoNuloNumero(dados.previous?.[indicator]) ? dados.previous[indicator] : null;
    const chaveOverride = INDICADOR_OVERRIDE_KEY[indicator];

    const sourceStatus = classificarStatusFonte({ value, statusInfo, anterior, overrideNesseCommit, chaveOverride });
    const { referenceDate, referencePeriod, viaInferenciaTexto } = calcularReferencia(indicator, dados, statusTexto);
    const unit = INDICADOR_UNIDADE[indicator];
    const extractionConfidence = classificarConfianca({ referenceDate, referencePeriod, viaInferenciaTexto, sourceStatus, collectedAt });
    const deduplicationKey = calcularChaveDeduplicacao({ indicator, unit, referenceDate, referencePeriod, collectedAt, commitHash });

    candidatas.push({
      indicator, value, unit, referenceDate, referencePeriod, collectedAt, commitDate, commitHash,
      sourceStatus, sourceName: statusInfo.sourceName, sourceMessage: statusInfo.sourceMessage,
      extractionConfidence, deduplicationKey,
    });
  }
  return candidatas;
}

// ---------------------------------------------------------------------------
// Deduplicacao / conflitos.
// ---------------------------------------------------------------------------
const ORDEM_STATUS_CONSERVADOR = Object.freeze({
  [STATUS_OBSERVACAO.NAO_IDENTIFICAVEL]: 0,
  [STATUS_OBSERVACAO.AUSENTE]: 1,
  [STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO]: 2,
  [STATUS_OBSERVACAO.OVERRIDE_MANUAL]: 3,
  [STATUS_OBSERVACAO.OBSERVADO]: 4,
});
const ORDEM_CONFIANCA_CONSERVADORA = Object.freeze({
  [CONFIANCA_EXTRACAO.NAO_RASTREAVEL]: 0,
  [CONFIANCA_EXTRACAO.PARCIAL]: 1,
  [CONFIANCA_EXTRACAO.INFERENCIA_TECNICA]: 2,
  [CONFIANCA_EXTRACAO.ESTRUTURADA]: 3,
});
function maisConservador(valoresPresentes, ordem) {
  return [...valoresPresentes].sort((a, b) => ordem[a] - ordem[b])[0];
}

/** Ordena por collectedAt (nulls por ultimo), depois commitDate, depois hash --
 *  usado para escolher um "representante" deterministico dentro de um grupo. */
function ordenarPorTempo(candidatas) {
  return [...candidatas].sort((a, b) => {
    const ca = a.collectedAt ?? "￿", cb = b.collectedAt ?? "￿";
    if (ca !== cb) return ca < cb ? -1 : 1;
    const da = a.commitDate ?? "￿", db = b.commitDate ?? "￿";
    if (da !== db) return da < db ? -1 : 1;
    return a.commitHash < b.commitHash ? -1 : a.commitHash > b.commitHash ? 1 : 0;
  });
}

function mesclarSubgrupo(subgrupo, conflict, conflictType) {
  const ordenado = ordenarPorTempo(subgrupo);
  const representante = ordenado[0];
  const collectedAtsValidos = ordenado.map((o) => o.collectedAt).filter((v) => v != null).sort();
  const statusEscolhido = maisConservador(new Set(ordenado.map((o) => o.sourceStatus)), ORDEM_STATUS_CONSERVADOR);
  const confiancaEscolhida = maisConservador(new Set(ordenado.map((o) => o.extractionConfidence)), ORDEM_CONFIANCA_CONSERVADORA);
  return {
    indicator: representante.indicator,
    value: representante.value,
    unit: representante.unit,
    referenceDate: representante.referenceDate,
    referencePeriod: representante.referencePeriod,
    collectedAt: representante.collectedAt,
    commitDate: representante.commitDate,
    commitHash: representante.commitHash,
    sourceStatus: statusEscolhido,
    sourceName: representante.sourceName,
    sourceMessage: representante.sourceMessage,
    extractionConfidence: confiancaEscolhida,
    deduplicationKey: representante.deduplicationKey,
    metadata: {
      supportingSnapshotCount: ordenado.length,
      firstCollectedAt: collectedAtsValidos[0] ?? null,
      lastCollectedAt: collectedAtsValidos[collectedAtsValidos.length - 1] ?? null,
      commitHashes: [...new Set(ordenado.map((o) => o.commitHash))].sort(),
      conflict,
      conflictType: conflict ? conflictType : null,
    },
  };
}

/**
 * Deduplica um unico grupo (mesma deduplicationKey). Regras:
 *   A. mesmo valor, mesmo status -> 1 observacao, conflict:false.
 *   B. valores diferentes -> 1 observacao POR VALOR distinto, todas com
 *      conflict:true/VALORES_DIVERGENTES -- nunca escolhe uma, nunca calcula media.
 *   C. mesmo valor, status diferentes -> 1 observacao com o status MAIS
 *      CONSERVADOR entre os presentes (nunca promove para OBSERVADO),
 *      conflict:true/STATUS_DIVERGENTE.
 * Commit mais recente NUNCA vence automaticamente em nenhum dos casos -- a
 * escolha de "representante" (so para copiar campos identificatorios como
 * commitHash/commitDate/sourceName) usa o MAIS ANTIGO por collectedAt, so por
 * determinismo, nao por ser "mais correto".
 */
export function deduplicarGrupo(candidatasDoGrupo) {
  const porValor = new Map();
  for (const c of candidatasDoGrupo) {
    const chaveValor = JSON.stringify(c.value);
    if (!porValor.has(chaveValor)) porValor.set(chaveValor, []);
    porValor.get(chaveValor).push(c);
  }

  if (porValor.size === 1) {
    const unico = [...porValor.values()][0];
    const statusesDistintos = new Set(unico.map((o) => o.sourceStatus));
    if (statusesDistintos.size === 1) return [mesclarSubgrupo(unico, false, null)];
    return [mesclarSubgrupo(unico, true, TIPOS_CONFLITO.STATUS_DIVERGENTE)];
  }

  const saida = [];
  for (const subgrupo of porValor.values()) {
    saida.push(mesclarSubgrupo(subgrupo, true, TIPOS_CONFLITO.VALORES_DIVERGENTES));
  }
  return saida;
}

function ordenarObservacoesFinal(observacoes) {
  return [...observacoes].sort((a, b) => {
    if (a.indicator !== b.indicator) return a.indicator < b.indicator ? -1 : 1;
    const ra = a.referenceDate ?? a.referencePeriod ?? "￿";
    const rb = b.referenceDate ?? b.referencePeriod ?? "￿";
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (a.deduplicationKey !== b.deduplicationKey) return a.deduplicationKey < b.deduplicationKey ? -1 : 1;
    return a.commitHash < b.commitHash ? -1 : a.commitHash > b.commitHash ? 1 : 0;
  });
}

/** Agrupa todas as candidatas por deduplicationKey e deduplica cada grupo.
 *  Retorna { observacoes (ordenadas deterministicamente), conflitos (numero de
 *  chaves de deduplicacao distintas que geraram algum conflito) }. */
export function deduplicarObservacoes(candidatasTodas) {
  const grupos = new Map();
  for (const c of candidatasTodas) {
    if (!grupos.has(c.deduplicationKey)) grupos.set(c.deduplicationKey, []);
    grupos.get(c.deduplicationKey).push(c);
  }
  let observacoes = [];
  let conflitos = 0;
  for (const grupo of grupos.values()) {
    const resultado = deduplicarGrupo(grupo);
    if (resultado.some((o) => o.metadata.conflict)) conflitos++;
    observacoes.push(...resultado);
  }
  return { observacoes: ordenarObservacoesFinal(observacoes), conflitos };
}

// ---------------------------------------------------------------------------
// Frequencia observada -- descritiva, nunca "diaria/semanal/mensal" so pela
// divisao do intervalo. Usa as CANDIDATAS (pre-deduplicacao) de um indicador,
// porque a deduplicacao pode colapsar varios commits do mesmo dia numa unica
// observacao, escondendo o sinal de rajada.
// ---------------------------------------------------------------------------
export function classificarFrequencia(candidatasDoIndicador, indicator) {
  if (INDICADORES_MENSAIS.includes(indicator)) return "MENSAL_POR_REFERENCIA";
  const dias = candidatasDoIndicador.map((c) => (c.commitDate ?? "").slice(0, 10)).filter(Boolean);
  if (dias.length === 0) return "INDETERMINADA";
  const diasUnicos = [...new Set(dias)];
  if (dias.length > diasUnicos.length) return "MULTIPLAS_NO_MESMO_DIA";
  if (diasUnicos.length < 2) return "INDETERMINADA";
  return "IRREGULAR";
}

// ---------------------------------------------------------------------------
// Relatorio de cobertura (nao faz parte do schema persistido -- e o resumo
// que o CLI imprime, sanitizado, e que os testes verificam).
// ---------------------------------------------------------------------------
export function calcularCobertura({ commitsAuditados, snapshotsEncontrados, snapshotsValidos, snapshotsInvalidos, candidatasTodas, observacoesFinal, conflitos }) {
  const porIndicador = {};
  for (const indicator of INDICADORES_SUPORTADOS) {
    const candidatasDoIndicador = candidatasTodas.filter((c) => c.indicator === indicator);
    const obsDoIndicador = observacoesFinal.filter((o) => o.indicator === indicator);
    const referenciasDistintas = new Set(obsDoIndicador.map((o) => o.referenceDate ?? o.referencePeriod).filter(Boolean)).size;
    const collectedAtDistintos = new Set(candidatasDoIndicador.map((c) => c.collectedAt).filter(Boolean)).size;

    const statusContagem = {};
    for (const s of Object.values(STATUS_OBSERVACAO)) statusContagem[s] = obsDoIndicador.filter((o) => o.sourceStatus === s).length;

    const datasRef = obsDoIndicador.map((o) => o.referenceDate).filter(Boolean).sort();
    const periodosRef = obsDoIndicador.map((o) => o.referencePeriod).filter(Boolean).sort();
    const collectedAts = candidatasDoIndicador.map((c) => c.collectedAt).filter(Boolean).sort();

    porIndicador[indicator] = {
      observacoesDeduplicadas: obsDoIndicador.length,
      referenciasEconomicasDistintas: referenciasDistintas,
      datasDeColetaDistintas: collectedAtDistintos,
      valoresAusentes: statusContagem[STATUS_OBSERVACAO.AUSENTE],
      statusContagem,
      primeiraReferenceDate: datasRef[0] ?? null,
      ultimaReferenceDate: datasRef[datasRef.length - 1] ?? null,
      primeiroReferencePeriod: periodosRef[0] ?? null,
      ultimoReferencePeriod: periodosRef[periodosRef.length - 1] ?? null,
      primeiroCollectedAt: collectedAts[0] ?? null,
      ultimoCollectedAt: collectedAts[collectedAts.length - 1] ?? null,
      frequenciaObservada: classificarFrequencia(candidatasDoIndicador, indicator),
    };
  }
  return {
    commitsAuditados, snapshotsEncontrados, snapshotsValidos, snapshotsInvalidos,
    observacoesCandidatas: candidatasTodas.length,
    observacoesDeduplicadas: observacoesFinal.length,
    conflitos,
    porIndicador,
  };
}

// ---------------------------------------------------------------------------
// Orquestrador principal. Recebe o adaptador Git (real ou fictício) e um
// relogio injetavel (`agora`), para que os testes controlem generatedAt.
// ---------------------------------------------------------------------------
export function extrairSerieTemporal({ adapterGit, agora = () => new Date().toISOString(), caminhoDataJson = "data.json", caminhoOverride = "fertilizers-override.json" }) {
  const commits = ordenarCommits(adapterGit.listarCommits(caminhoDataJson));

  let snapshotsEncontrados = 0, snapshotsValidos = 0, snapshotsInvalidos = 0;
  const candidatasTodas = [];
  const snapshotsRejeitados = [];

  for (const commit of commits) {
    const conteudo = adapterGit.lerArquivoNoCommit(commit.hash, caminhoDataJson);
    if (conteudo !== null && conteudo !== undefined) snapshotsEncontrados++;

    const analise = analisarSnapshot(commit, conteudo);
    if (!analise.valido) {
      snapshotsInvalidos++;
      snapshotsRejeitados.push({ commitHash: truncarHash(commit.hash), motivo: analise.motivo });
      continue;
    }
    snapshotsValidos++;

    let overrideNesseCommit = null;
    try {
      const overrideTexto = adapterGit.lerArquivoNoCommit(commit.hash, caminhoOverride);
      if (overrideTexto !== null && overrideTexto !== undefined) {
        const parsed = JSON.parse(overrideTexto);
        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) overrideNesseCommit = parsed;
      }
    } catch {
      // override indisponivel/invalido nesse commit -- evidencia so nao existe, nao interrompe nada.
    }

    candidatasTodas.push(...extrairCandidatas(analise, overrideNesseCommit));
  }

  const { observacoes, conflitos } = deduplicarObservacoes(candidatasTodas);

  const serie = {
    schemaVersion: SCHEMA_VERSION,
    description: DESCRICAO_SERIE,
    generatedAt: agora(),
    source: {
      type: "GIT_HISTORY",
      file: "data.json",
      commitCountAudited: commits.length,
      snapshotCountParsed: snapshotsValidos,
      snapshotCountRejected: commits.length - snapshotsValidos,
    },
    observations: observacoes,
  };

  const cobertura = calcularCobertura({
    commitsAuditados: commits.length, snapshotsEncontrados, snapshotsValidos, snapshotsInvalidos,
    candidatasTodas, observacoesFinal: observacoes, conflitos,
  });

  return { serie, cobertura, snapshotsRejeitados };
}

// ---------------------------------------------------------------------------
// CLI -- validacao de caminho de saida, escrita atomica, resumo sanitizado.
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const CAMINHO_DATA_JSON_ABS = join(__dirname, "data.json");
const CAMINHO_BASE_FORMULADOS_ABS = join(__dirname, "data", "formulated-prices-history.json");
const CAMINHO_DATA_PRIVATE_ABS = join(__dirname, "data", "private");
const CAMINHO_TEMPLATES_ABS = join(__dirname, "templates");
const CAMINHO_GITHUB_ABS = join(__dirname, ".github");

/** Regras de caminho de saida: nunca data.json, nunca a base de formulados,
 *  nunca *.private.json, nunca dentro de data/private/, templates/ ou .github/,
 *  sempre terminando em .json. Nenhum caminho padrao implícito -- --output
 *  exige um valor explicito (checado no CLI, nao aqui). */
export function validarCaminhoSaidaExtrator(caminhoAbsoluto) {
  if (caminhoAbsoluto === CAMINHO_DATA_JSON_ABS) {
    return { ok: false, motivo: "SAIDA_E_DATA_JSON", mensagem: "a saida nao pode ser data.json" };
  }
  if (caminhoAbsoluto === CAMINHO_BASE_FORMULADOS_ABS) {
    return { ok: false, motivo: "SAIDA_E_BASE_FORMULADOS", mensagem: "a saida nao pode ser a base publica de formulados" };
  }
  if (!caminhoAbsoluto.endsWith(".json")) {
    return { ok: false, motivo: "SAIDA_NAO_JSON", mensagem: 'a saida precisa terminar em ".json"' };
  }
  if (caminhoAbsoluto.endsWith(".private.json")) {
    return { ok: false, motivo: "SAIDA_PRIVADA_PROIBIDA", mensagem: "a saida nao pode terminar em .private.json (este extrator so produz dados publicos)" };
  }
  if (caminhoAbsoluto === CAMINHO_DATA_PRIVATE_ABS || caminhoAbsoluto.startsWith(CAMINHO_DATA_PRIVATE_ABS + sep)) {
    return { ok: false, motivo: "SAIDA_EM_DATA_PRIVATE", mensagem: "a saida nao pode ficar dentro de data/private/" };
  }
  if (caminhoAbsoluto === CAMINHO_TEMPLATES_ABS || caminhoAbsoluto.startsWith(CAMINHO_TEMPLATES_ABS + sep)) {
    return { ok: false, motivo: "SAIDA_EM_TEMPLATES", mensagem: "a saida nao pode ficar dentro de templates/" };
  }
  if (caminhoAbsoluto === CAMINHO_GITHUB_ABS || caminhoAbsoluto.startsWith(CAMINHO_GITHUB_ABS + sep)) {
    return { ok: false, motivo: "SAIDA_EM_GITHUB", mensagem: "a saida nao pode ficar dentro de .github/" };
  }
  return { ok: true };
}

/** Escrita atomica: temporario no mesmo diretorio, validado com
 *  loadAndValidateHistoryFile, so entao renomeado por cima do destino. Nunca
 *  sobrescreve silenciosamente um arquivo existente que nao passe na validacao
 *  deste schema. */
export function escreverSaidaAtomica(caminhoFinal, dataObj) {
  if (existsSync(caminhoFinal)) {
    const existente = loadAndValidateHistoryFile(caminhoFinal);
    if (!existente.valid) {
      throw new Error("SAIDA_EXISTENTE_INVALIDA: ja existe um arquivo nesse caminho que nao passa na validacao deste schema -- nada foi sobrescrito");
    }
  }
  const dir = dirname(caminhoFinal);
  mkdirSync(dir, { recursive: true });
  const tmpPath = join(dir, `.${basename(caminhoFinal)}.tmp-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(tmpPath, JSON.stringify(dataObj, null, 2) + "\n", "utf-8");
    const validado = loadAndValidateHistoryFile(tmpPath);
    if (!validado.valid) {
      throw new Error("validacao do arquivo temporario falhou antes da gravacao final (bug no extrator)");
    }
    renameSync(tmpPath, caminhoFinal);
  } catch (e) {
    try { rmSync(tmpPath, { force: true }); } catch { /* melhor esforco */ }
    throw e;
  }
}

/** Resumo sanitizado impresso no console: so contagens e enums -- nunca valor
 *  de indicador, texto de status bruto, hash de commit, autor, e-mail ou
 *  caminho absoluto. */
export function formatarResumoCobertura(cobertura) {
  const linhas = [];
  linhas.push(`commits auditados: ${cobertura.commitsAuditados}`);
  linhas.push(`snapshots encontrados: ${cobertura.snapshotsEncontrados} | validos: ${cobertura.snapshotsValidos} | invalidos: ${cobertura.snapshotsInvalidos}`);
  linhas.push(`observacoes candidatas: ${cobertura.observacoesCandidatas} | deduplicadas: ${cobertura.observacoesDeduplicadas} | conflitos: ${cobertura.conflitos}`);
  linhas.push("por indicador:");
  for (const [indicador, s] of Object.entries(cobertura.porIndicador)) {
    linhas.push(
      `  - ${indicador}: ${s.observacoesDeduplicadas} observacao(oes), ${s.referenciasEconomicasDistintas} referencia(s) economica(s) distinta(s), ` +
      `${s.datasDeColetaDistintas} data(s) de coleta distinta(s), ${s.valoresAusentes} ausente(s), frequencia observada: ${s.frequenciaObservada}`
    );
  }
  return linhas.join("\n");
}

const executadoDiretamente = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (executadoDiretamente) main();

function log(msg) { console.log(`[extract:market-history] ${msg}`); }

function main() {
  const argv = process.argv.slice(2);
  const outputIndex = argv.indexOf("--output");
  const outputArg = outputIndex !== -1 ? argv[outputIndex + 1] : null;
  if (outputIndex !== -1 && !outputArg) {
    console.error("[extract:market-history] --output precisa de um caminho de arquivo");
    process.exit(1);
  }

  log("auditando o historico Git local de data.json (somente leitura: git log / git show)...");
  const adapterGit = criarAdaptadorGitReal(__dirname);

  let resultado;
  try {
    resultado = extrairSerieTemporal({ adapterGit });
  } catch (e) {
    log(`falha ao auditar o historico Git: ${e.message}`);
    process.exit(1);
  }

  console.log(formatarResumoCobertura(resultado.cobertura));

  if (!outputArg) {
    log("dry-run: nada foi gravado.");
    process.exit(0);
  }

  const caminhoSaida = resolve(process.cwd(), outputArg);
  const valido = validarCaminhoSaidaExtrator(caminhoSaida);
  if (!valido.ok) {
    log(`saida rejeitada [${valido.motivo}]: ${valido.mensagem}`);
    process.exit(1);
  }

  try {
    escreverSaidaAtomica(caminhoSaida, resultado.serie);
  } catch (e) {
    log(`falha ao gravar a saida: ${e.message}`);
    process.exit(1);
  }
  log(`serie gravada com sucesso (${resultado.serie.observations.length} observacao(oes)) no caminho informado em --output.`);
  process.exit(0);
}
