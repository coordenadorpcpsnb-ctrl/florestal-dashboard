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
// TABELA DE PADROES DE STATUS COMPROVADOS (Etapa 5.1 -- re-auditada linha a
// linha em fetch-data.mjs e fetch-fertilizers.mjs; nada aqui foi inventado).
//
// Sucesso (sempre comeca literalmente com "ok ("):
//   cambio: "ok (BCB PTAX)" | "ok (Frankfurter)" | "ok (AwesomeAPI)"
//   soja:   "ok (Noticias Agricolas / CEPEA-PR <data>)" | "ok (CEPEA direto)"
//   sojaRegional: "ok (<praca>)" (texto da praca vem da tabela raspada, nao e
//                 uma lista fechada -- so a forma "ok (...)" e evidencia)
//   bdi:    "ok (HANDYBULK)" | "ok (HANDYBULK, <ref>)" [+ sufixo ATENCAO] | "ok (stooq)"
//   gas:    "ok (EIA Henry Hub)" | "ok (stooq — futuro NG)"
//   ureia/map/kcl: "ok (ComexStat <ref>)"
//
// Falha (sempre comeca literalmente com "falha", MAS NEM TODA falha comeca
// assim -- ver excecao de gas abaixo):
//   cambio/soja/sojaRegional/bdi: "falha: " + erros.join(" | ")
//   ureia/map/kcl: "falha: <motivo>" | "falha: NCM ausente..." | "falha: valor implausivel (...)"
//   gas: "falha EIA: <msg>" | "falha stooq: <msg>" | "falha EIA: <msg> | falha stooq: <msg>"
//   EXCECAO COMPROVADA: quando EIA_API_KEY nao esta configurada E o fallback
//   stooq tambem falha, o status vira "SEM EIA_API_KEY configurada | falha
//   stooq: <msg>" -- NAO comeca com "falha". Tratado como status nao
//   reconhecido (NAO_IDENTIFICAVEL), de proposito: nao alargamos o regex so
//   para cobrir esse caso, porque isso reabriria a porta para "busca textual
//   vaga" que esta etapa foi pedida para eliminar.
//
// Evidencia DIRETA de fallback/override (mensagem controlada, reconhecida,
// escrita pelo proprio codigo) -- comprovada SOMENTE para sojaTO, em
// fetch-data.mjs linhas ~272-284:
//   status.sojaRegional += " -> usando valor manual do override"   (OVERRIDE)
//   status.sojaRegional += " -> usando estimativa (95,7% do CEPEA)" (nem um nem outro -- estimativa derivada)
//   status.sojaRegional += " -> usando leitura anterior"            (FALLBACK)
// Nenhum outro indicador tem um marcador equivalente no codigo hoje -- por
// isso FALLBACK_ULTIMO_CONHECIDO so pode ser atribuido para sojaTO nesta
// etapa (ver classificarProveniencia). Forcar essa categoria para os outros
// indicadores via igualdade de valor seria exatamente o erro que a Etapa 5.1
// foi pedida para corrigir.
//
// fertilizers-override.json cobre TODOS os 8 indicadores (nao so
// fertilizantes): chaves dolar/ureia/map/kcl/gasNatural/bdi/soja/sojaTO. A
// funcao escolher() de fetch-data.mjs decide a precedencia:
//   nao-forcado: auto ?? manual ?? anterior
//   forceManual=true: manual ?? auto ?? anterior
// Ou seja, quando forceManual esta ativo E o override tem valor para aquele
// indicador, o override VENCE mesmo que a busca automatica tenha tido
// sucesso -- por isso um status "ok" sozinho NAO basta como prova quando essa
// condicao se aplica (ver classificarProveniencia, passo 1).
//
// check-status.mjs (so leitura, nao alterado) compara `valor === "ok"`
// (igualdade estrita) para decidir "fonte OK" -- como nenhum status real e
// literalmente "ok" (sempre tem o "(<fonte>)" junto), essa comparacao nunca
// bate na pratica. E uma inconsistencia pre-existente do proprio
// check-status.mjs, fora do escopo desta etapa; nao serviu de modelo aqui.
// ---------------------------------------------------------------------------

/** Categorias fixas e sanitizadas de sourceMessage -- nunca o texto bruto do
 *  status (que pode ter fragmento de HTML/URL de uma resposta de erro real). */
export const CATEGORIA_MENSAGEM = Object.freeze({
  VALOR_AUSENTE: "VALOR_AUSENTE",
  STATUS_AUSENTE: "STATUS_AUSENTE",
  STATUS_OBSERVADO_ESTRUTURADO: "STATUS_OBSERVADO_ESTRUTURADO",
  STATUS_FALLBACK_EXPLICITO: "STATUS_FALLBACK_EXPLICITO",
  STATUS_OVERRIDE_COMPROVADO: "STATUS_OVERRIDE_COMPROVADO",
  STATUS_AMBIGUO: "STATUS_AMBIGUO",
  VALOR_REPETIDO_SEM_PROVA_DE_ORIGEM: "VALOR_REPETIDO_SEM_PROVA_DE_ORIGEM",
  CORRESPONDE_A_OVERRIDE_SEM_PROVA_DE_USO: "CORRESPONDE_A_OVERRIDE_SEM_PROVA_DE_USO",
});

// ---------------------------------------------------------------------------
// Interpretacao SANITIZADA do texto de status: nunca devolve o texto bruto.
// sourceName vem de uma lista fixa de fontes conhecidas (tabela acima).
// comecaOk/comecaFalha usam os padroes literais comprovados: "ok (" e
// "falha" -- nunca includes("falha")/includes("erro")/includes("ultimo") sem
// ancorar no inicio do texto, para nao promover status ambiguo.
// ---------------------------------------------------------------------------
const FONTES_CONHECIDAS = Object.freeze([
  "BCB PTAX", "Frankfurter", "AwesomeAPI",
  "HANDYBULK", "stooq",
  "Noticias Agricolas", "CEPEA",
  "EIA Henry Hub", "ComexStat",
]);

export function interpretarStatusTexto(statusTexto) {
  if (typeof statusTexto !== "string" || statusTexto.trim() === "") {
    return { sourceName: null, comecaOk: false, comecaFalha: false };
  }
  const texto = statusTexto.trim();
  const sourceName = FONTES_CONHECIDAS.find((f) => texto.includes(f)) ?? null;
  const comecaOk = /^ok \(/.test(texto); // forma literal comprovada, nunca "ok" sozinho
  const comecaFalha = /^falha/i.test(texto);
  return { sourceName, comecaOk, comecaFalha };
}

/** Evidencia DIRETA de fallback no proprio texto de status -- hoje, so
 *  sojaTO tem essa mensagem controlada e reconhecida (ver tabela acima). */
function temEvidenciaExplicitaDeFallback(indicator, statusTexto) {
  return indicator === "sojaTO" && typeof statusTexto === "string" && statusTexto.includes("-> usando leitura anterior");
}

/** Evidencia DIRETA de override no proprio texto de status -- hoje, so
 *  sojaTO tem essa mensagem controlada e reconhecida. */
function temEvidenciaExplicitaDeOverride(indicator, statusTexto) {
  return indicator === "sojaTO" && typeof statusTexto === "string" && statusTexto.includes("-> usando valor manual do override");
}

// ---------------------------------------------------------------------------
// Classificacao de proveniencia (Etapa 5.1): decide sourceStatus (5 valores
// fixos) E sourceMessage (categoria fixa) juntos, porque os dois dependem da
// mesma evidencia. Tambem calcula os metadados de repeticao/coincidencia
// (repeatedFromPrevious, matchesOverrideValue), que SAO REGISTRADOS SEMPRE,
// independente do resultado de sourceStatus -- servem so para auditoria,
// nunca como prova por si sos.
//
// Regra central (o que a Etapa 5.1 corrigiu): igualdade de valor
// (current === previous, ou current === override) NUNCA e suficiente
// sozinha. FALLBACK_ULTIMO_CONHECIDO exige uma mensagem de status EXPLICITA e
// reconhecida (hoje, so existe para sojaTO); para os demais indicadores, uma
// falha com valor repetido fica NAO_IDENTIFICAVEL, com
// metadata.repeatedFromPrevious=true registrando a coincidencia sem
// apresenta-la como prova.
//
// OVERRIDE_MANUAL e menos restritivo porque o proprio codigo de
// fetch-data.mjs permite reconstruir com certeza quando o override venceu:
//   - forceManual ativo NESSE commit + override presente para o indicador =>
//     o override sempre vence, mesmo com status "ok" (ver escolher()).
//   - status "falha" (a busca automatica comprovadamente nao forneceu valor)
//     + override presente e igual ao valor gravado => so resta a hipotese do
//     override na propria funcao escolher() (auto ?? manual ?? anterior).
// Fora desses dois casos, uma coincidencia de valor com o override vira
// NAO_IDENTIFICAVEL, com metadata.matchesOverrideValue=true registrando a
// coincidencia sem apresenta-la como prova.
// ---------------------------------------------------------------------------
export function classificarProveniencia({ indicator, value, statusTexto, anterior, overrideNesseCommit, chaveOverride }) {
  const repeatedFromPrevious = naoNuloNumero(value) && naoNuloNumero(anterior) && value === anterior;
  const overrideValor = overrideNesseCommit && naoNuloNumero(overrideNesseCommit[chaveOverride]) ? overrideNesseCommit[chaveOverride] : null;
  const matchesOverrideValue = naoNuloNumero(value) && overrideValor !== null && value === overrideValor;

  if (value === null) {
    return { sourceStatus: STATUS_OBSERVACAO.AUSENTE, sourceMessage: CATEGORIA_MENSAGEM.VALOR_AUSENTE, sourceName: null, repeatedFromPrevious, matchesOverrideValue };
  }

  const statusInfo = interpretarStatusTexto(statusTexto);
  const overrideForcado = overrideNesseCommit?.forceManual === true;

  // 1) forceManual ativo NESSE commit com override presente para este
  //    indicador: escolher() usa o override antes do automatico, mesmo que o
  //    automatico tenha tido sucesso -- status "ok" deixa de ser prova
  //    confiavel sozinho nesse caso especifico.
  if (overrideForcado && overrideValor !== null) {
    if (matchesOverrideValue) {
      return { sourceStatus: STATUS_OBSERVACAO.OVERRIDE_MANUAL, sourceMessage: CATEGORIA_MENSAGEM.STATUS_OVERRIDE_COMPROVADO, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
    }
    // forceManual ativo mas o valor gravado NAO bate com o override lido nesse
    // commit -- nao da pra explicar com confianca (override pode ter mudado
    // entre a leitura e a gravacao, ou nosso mapeamento de chave nao se
    // aplica); nunca supor.
    return { sourceStatus: STATUS_OBSERVACAO.NAO_IDENTIFICAVEL, sourceMessage: CATEGORIA_MENSAGEM.STATUS_AMBIGUO, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
  }

  // 2) evidencia DIRETA e reconhecida no proprio texto de status (hoje, so sojaTO).
  if (temEvidenciaExplicitaDeFallback(indicator, statusTexto)) {
    return { sourceStatus: STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO, sourceMessage: CATEGORIA_MENSAGEM.STATUS_FALLBACK_EXPLICITO, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
  }
  if (temEvidenciaExplicitaDeOverride(indicator, statusTexto)) {
    return { sourceStatus: STATUS_OBSERVACAO.OVERRIDE_MANUAL, sourceMessage: CATEGORIA_MENSAGEM.STATUS_OVERRIDE_COMPROVADO, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
  }

  // 3) status nao reconhecido (nem "ok (" nem "falha", ex.: a excecao do gas
  //    documentada na tabela acima, ou status ausente).
  if (!statusInfo.comecaOk && !statusInfo.comecaFalha) {
    return { sourceStatus: STATUS_OBSERVACAO.NAO_IDENTIFICAVEL, sourceMessage: CATEGORIA_MENSAGEM.STATUS_AUSENTE, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
  }

  // 4) sucesso comprovado da busca automatica (o caso de forceManual+override
  //    presente ja foi tratado no passo 1 -- aqui, "ok" e prova valida para
  //    sourceStatus, que permanece OBSERVADO sempre). Uma coincidencia com o
  //    override aqui e so ruido informativo para auditoria -- nunca rebaixa
  //    nem "prova" nada (matchesOverrideValue ja carrega esse fato sozinho);
  //    sourceMessage so sinaliza a coincidencia de forma mais especifica.
  if (statusInfo.comecaOk) {
    const mensagem = matchesOverrideValue ? CATEGORIA_MENSAGEM.CORRESPONDE_A_OVERRIDE_SEM_PROVA_DE_USO : CATEGORIA_MENSAGEM.STATUS_OBSERVADO_ESTRUTURADO;
    return { sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceMessage: mensagem, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
  }

  // 5) comecaFalha=true, sem evidencia direta de fallback/override (passo 2):
  //    a busca automatica comprovadamente nao forneceu valor. Se o valor bate
  //    com o override desse commit, a propria funcao escolher() so pode ter
  //    usado o override (unica fonte no-nula restante) -- OVERRIDE_MANUAL.
  //    Repeticao com o valor anterior NUNCA e promovida a fallback sozinha.
  if (matchesOverrideValue) {
    return { sourceStatus: STATUS_OBSERVACAO.OVERRIDE_MANUAL, sourceMessage: CATEGORIA_MENSAGEM.STATUS_OVERRIDE_COMPROVADO, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
  }
  if (repeatedFromPrevious) {
    return { sourceStatus: STATUS_OBSERVACAO.NAO_IDENTIFICAVEL, sourceMessage: CATEGORIA_MENSAGEM.VALOR_REPETIDO_SEM_PROVA_DE_ORIGEM, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
  }
  return { sourceStatus: STATUS_OBSERVACAO.NAO_IDENTIFICAVEL, sourceMessage: CATEGORIA_MENSAGEM.STATUS_AMBIGUO, sourceName: statusInfo.sourceName, repeatedFromPrevious, matchesOverrideValue };
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
    const anterior = naoNuloNumero(dados.previous?.[indicator]) ? dados.previous[indicator] : null;
    const chaveOverride = INDICADOR_OVERRIDE_KEY[indicator];

    const proveniencia = classificarProveniencia({ indicator, value, statusTexto, anterior, overrideNesseCommit, chaveOverride });
    const { sourceStatus, sourceMessage, sourceName, repeatedFromPrevious, matchesOverrideValue } = proveniencia;
    const { referenceDate, referencePeriod, viaInferenciaTexto } = calcularReferencia(indicator, dados, statusTexto);
    const unit = INDICADOR_UNIDADE[indicator];
    const extractionConfidence = classificarConfianca({ referenceDate, referencePeriod, viaInferenciaTexto, sourceStatus, collectedAt });
    const deduplicationKey = calcularChaveDeduplicacao({ indicator, unit, referenceDate, referencePeriod, collectedAt, commitHash });

    candidatas.push({
      indicator, value, unit, referenceDate, referencePeriod, collectedAt, commitDate, commitHash,
      sourceStatus, sourceName, sourceMessage,
      extractionConfidence, deduplicationKey,
      repeatedFromPrevious, matchesOverrideValue,
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
  // sourceMessage/sourceName precisam vir do MESMO membro cujo sourceStatus foi
  // escolhido (o mais conservador) -- nao do representante por tempo, senao os
  // dois poderiam descrever evidencias de membros diferentes do grupo.
  const membroDoStatusEscolhido = ordenado.find((o) => o.sourceStatus === statusEscolhido);
  // repeatedFromPrevious/matchesOverrideValue sao so auditoria (nunca provam
  // nada sozinhos) -- OR entre o grupo inteiro, para nao esconder uma
  // coincidencia so porque o membro representante nao a tinha.
  const repeatedFromPrevious = ordenado.some((o) => o.repeatedFromPrevious === true);
  const matchesOverrideValue = ordenado.some((o) => o.matchesOverrideValue === true);
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
    sourceName: membroDoStatusEscolhido.sourceName,
    sourceMessage: membroDoStatusEscolhido.sourceMessage,
    extractionConfidence: confiancaEscolhida,
    deduplicationKey: representante.deduplicationKey,
    metadata: {
      supportingSnapshotCount: ordenado.length,
      firstCollectedAt: collectedAtsValidos[0] ?? null,
      lastCollectedAt: collectedAtsValidos[collectedAtsValidos.length - 1] ?? null,
      commitHashes: [...new Set(ordenado.map((o) => o.commitHash))].sort(),
      conflict,
      conflictType: conflict ? conflictType : null,
      repeatedFromPrevious,
      matchesOverrideValue,
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
/**
 * Classificacao PURAMENTE DESCRITIVA da cobertura de um indicador -- nunca
 * qualidade de preco, confianca estatistica, capacidade de previsao nem
 * recomendacao de compra (Etapa 5.2). Regra deterministica:
 *   - SEM_REFERENCIA_ECONOMICA: nenhuma referencia (data ou periodo) jamais
 *     identificada para o indicador (hoje: dolar/gas/sojaTO).
 *   - COBERTURA_NAO_IDENTIFICAVEL: tem alguma referencia, mas toda observacao
 *     deduplicada ficou com sourceStatus NAO_IDENTIFICAVEL.
 *   - COBERTURA_ESTRUTURADA_LIMITADA: referencia vem de campo estruturado
 *     (referencePeriod, hoje so ureia/map/kcl via refsFertilizantes) --
 *     "limitada" porque o numero de referencias distintas no historico real
 *     e pequeno (ver documento de alinhamento temporal).
 *   - COBERTURA_PARCIAL: referencia vem de inferencia de texto (referenceDate
 *     via regra documentada, hoje bdi/soja).
 */
export const CLASSIFICACAO_COBERTURA = Object.freeze({
  COBERTURA_ESTRUTURADA_LIMITADA: "COBERTURA_ESTRUTURADA_LIMITADA",
  COBERTURA_PARCIAL: "COBERTURA_PARCIAL",
  SEM_REFERENCIA_ECONOMICA: "SEM_REFERENCIA_ECONOMICA",
  COBERTURA_NAO_IDENTIFICAVEL: "COBERTURA_NAO_IDENTIFICAVEL",
});

export function classificarCoberturaIndicador(indicator, { referenciasEconomicasDistintas, observacoesDeduplicadas, statusContagem }) {
  if (referenciasEconomicasDistintas === 0) return CLASSIFICACAO_COBERTURA.SEM_REFERENCIA_ECONOMICA;
  const naoIdentificaveis = statusContagem?.[STATUS_OBSERVACAO.NAO_IDENTIFICAVEL] ?? 0;
  if (observacoesDeduplicadas > 0 && naoIdentificaveis === observacoesDeduplicadas) return CLASSIFICACAO_COBERTURA.COBERTURA_NAO_IDENTIFICAVEL;
  if (INDICADORES_MENSAIS.includes(indicator)) return CLASSIFICACAO_COBERTURA.COBERTURA_ESTRUTURADA_LIMITADA;
  return CLASSIFICACAO_COBERTURA.COBERTURA_PARCIAL;
}

export function calcularCobertura({ commitsAuditados, snapshotsEncontrados, snapshotsValidos, snapshotsInvalidos, candidatasTodas, observacoesFinal, conflitos }) {
  const porIndicador = {};
  for (const indicator of INDICADORES_SUPORTADOS) {
    const candidatasDoIndicador = candidatasTodas.filter((c) => c.indicator === indicator);
    const obsDoIndicador = observacoesFinal.filter((o) => o.indicator === indicator);
    const referenciasDistintas = new Set(obsDoIndicador.map((o) => o.referenceDate ?? o.referencePeriod).filter(Boolean)).size;
    const collectedAtDistintos = new Set(candidatasDoIndicador.map((c) => c.collectedAt).filter(Boolean)).size;
    const semReferencia = obsDoIndicador.filter((o) => o.referenceDate === null && o.referencePeriod === null).length;

    const statusContagem = {};
    for (const s of Object.values(STATUS_OBSERVACAO)) statusContagem[s] = obsDoIndicador.filter((o) => o.sourceStatus === s).length;

    const datasRef = obsDoIndicador.map((o) => o.referenceDate).filter(Boolean).sort();
    const periodosRef = obsDoIndicador.map((o) => o.referencePeriod).filter(Boolean).sort();
    const collectedAts = candidatasDoIndicador.map((c) => c.collectedAt).filter(Boolean).sort();

    const statsIndicador = {
      observacoesDeduplicadas: obsDoIndicador.length,
      referenciasEconomicasDistintas: referenciasDistintas,
      semReferenciaEconomica: semReferencia,
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
    statsIndicador.classificacaoCobertura = classificarCoberturaIndicador(indicator, statsIndicador);
    porIndicador[indicator] = statsIndicador;
  }

  // agregados GLOBAIS (todos os indicadores juntos) -- item novo da Etapa 5.2.
  const statusContagemGlobal = {};
  for (const s of Object.values(STATUS_OBSERVACAO)) statusContagemGlobal[s] = observacoesFinal.filter((o) => o.sourceStatus === s).length;
  const confiancaContagemGlobal = {};
  for (const c of Object.values(CONFIANCA_EXTRACAO)) confiancaContagemGlobal[c] = observacoesFinal.filter((o) => o.extractionConfidence === c).length;
  const repeatedFromPreviousCount = observacoesFinal.filter((o) => o.metadata?.repeatedFromPrevious === true).length;
  const matchesOverrideValueCount = observacoesFinal.filter((o) => o.metadata?.matchesOverrideValue === true).length;
  const semReferenciaEconomicaTotal = observacoesFinal.filter((o) => o.referenceDate === null && o.referencePeriod === null).length;

  return {
    commitsAuditados, snapshotsEncontrados, snapshotsValidos, snapshotsInvalidos,
    observacoesCandidatas: candidatasTodas.length,
    observacoesDeduplicadas: observacoesFinal.length,
    conflitos,
    statusContagemGlobal,
    confiancaContagemGlobal,
    repeatedFromPreviousCount,
    matchesOverrideValueCount,
    semReferenciaEconomicaTotal,
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
/**
 * Resumo sanitizado (dry-run/--output imprimem exatamente isto). SO contagens,
 * intervalos de referencia e enums -- NUNCA valor de indicador, autor, e-mail,
 * hash, texto de status bruto, caminho absoluto, conteudo de snapshot, dado
 * privado, produto formulado ou fornecedor (Etapa 5.2).
 */
export function formatarResumoCobertura(cobertura) {
  const linhas = [];
  linhas.push(`commits auditados: ${cobertura.commitsAuditados}`);
  linhas.push(`snapshots encontrados: ${cobertura.snapshotsEncontrados} | validos: ${cobertura.snapshotsValidos} | invalidos: ${cobertura.snapshotsInvalidos}`);
  linhas.push(`observacoes candidatas: ${cobertura.observacoesCandidatas} | deduplicadas: ${cobertura.observacoesDeduplicadas} | conflitos: ${cobertura.conflitos}`);

  linhas.push("contagem por sourceStatus (todos os indicadores):");
  for (const [status, n] of Object.entries(cobertura.statusContagemGlobal)) linhas.push(`  - ${status}: ${n}`);

  linhas.push("contagem por extractionConfidence (todos os indicadores):");
  for (const [conf, n] of Object.entries(cobertura.confiancaContagemGlobal)) linhas.push(`  - ${conf}: ${n}`);

  linhas.push(`repeatedFromPrevious=true: ${cobertura.repeatedFromPreviousCount} (so auditoria -- nunca prova fallback)`);
  linhas.push(`matchesOverrideValue=true: ${cobertura.matchesOverrideValueCount} (so auditoria -- nunca prova override)`);
  linhas.push(`observacoes sem referencia economica (referenceDate e referencePeriod nulos): ${cobertura.semReferenciaEconomicaTotal}`);

  linhas.push("por indicador:");
  for (const [indicador, s] of Object.entries(cobertura.porIndicador)) {
    linhas.push(
      `  - ${indicador}: ${s.observacoesDeduplicadas} observacao(oes), ${s.referenciasEconomicasDistintas} referencia(s) economica(s) distinta(s), ` +
      `${s.semReferenciaEconomica} sem referencia, ${s.datasDeColetaDistintas} data(s) de coleta distinta(s), ${s.valoresAusentes} ausente(s), ` +
      `frequencia observada: ${s.frequenciaObservada}, cobertura: ${s.classificacaoCobertura}`
    );
    if (s.primeiroReferencePeriod || s.ultimoReferencePeriod) {
      linhas.push(`    referencePeriod: ${s.primeiroReferencePeriod ?? "—"} a ${s.ultimoReferencePeriod ?? "—"}`);
    }
    if (s.primeiraReferenceDate || s.ultimaReferenceDate) {
      linhas.push(`    referenceDate: ${s.primeiraReferenceDate ?? "—"} a ${s.ultimaReferenceDate ?? "—"}`);
    }
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
