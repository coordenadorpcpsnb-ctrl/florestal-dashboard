/**
 * formulated-history-profile.mjs — Analise exploratoria e de qualidade da base
 * historica PRIVADA de precos de fertilizantes formulados.
 *
 * Modulo PURO: nao faz I/O nenhum (nao le arquivo, nao imprime nada, nao decide o
 * que e privado ou publico). Recebe o objeto ja carregado e validado por
 * loadAndValidateHistoryFile/validateHistory ({schemaVersion, description, records})
 * e devolve um objeto de analise. Quem decide o que aparece no console (sanitizado)
 * e o que vai para o relatorio privado e o CLI (profile-formulated-history.mjs).
 *
 * NAO faz: indice de pressao de materias-primas, cruzamento com data.json/ureia/
 * MAP/KCl, preco historico "corrigido", estimativa de preco atual, regressao,
 * machine learning, previsao, faixa de negociacao, recomendacao de compra, custo
 * industrial do fabricante nem custo por hectare. So descreve o que ja esta na base.
 *
 * === Identidade de serie (serieExata) ===
 * Uma "serie" agrupa registros que sao comparaveis entre si por produto/formula/
 * condicao comercial -- NAO por nome parecido. A chave e determinística e usa so
 * campos nao numericos: produto normalizado, formula normalizada (ou o marcador
 * SEM_FORMULA quando ausente), modalidadeEntrega, e destino normalizado -- MAS SO
 * quando modalidadeEntrega === CIF_DESTINO (para as demais modalidades, destino nao
 * participa da chave; decisao explicita, ver README secao 12, testada no item 19
 * da Etapa 3). fornecedor, preco, volume, prazo, data e observacoes NUNCA entram
 * na chave.
 *
 * fonteRegistro, prazoPagamentoDias e a existencia de dataCompra tambem nao
 * fragmentam a serie (isso destruiria a comparabilidade util) -- viram alertas de
 * mistura (MISTURA_DE_*) aplicados sobre a serie ja agrupada.
 *
 * === Normalizacao ===
 * normalizarTexto(): trim + espacos internos multiplos colapsados para um + caixa
 * alta. NAO mexe em digitos, zeros a esquerda nem hifens -- "6-30-6" e "06-30-06"
 * permanecem textos diferentes (e portanto series diferentes) de proposito. Nao
 * remove nem interpreta quimicamente textos como MICRO/Zn/B/Cu/S/"formulacao
 * especial". Nunca corrige o registro original -- so calcula uma chave derivada.
 *
 * Uma segunda normalizacao, mais agressiva (normalizarSuperficialParaComparacao),
 * tambem remove espacos ao redor de hifen -- usada SO para detectar
 * POSSIVEL_VARIACAO_NOME entre series diferentes que ficam parecidas por causa de
 * caixa/espacos/hifen. Nunca usada para unir series automaticamente.
 */

export const SCHEMA_VERSION_PROFILE = 1;

export const TIPOS_ALERTA = Object.freeze({
  BASE_VAZIA: "BASE_VAZIA",
  FORMULA_AUSENTE: "FORMULA_AUSENTE",
  CATEGORIA_AUSENTE: "CATEGORIA_AUSENTE",
  MODALIDADE_NAO_INFORMADA: "MODALIDADE_NAO_INFORMADA",
  DESTINO_AUSENTE_PARA_CIF: "DESTINO_AUSENTE_PARA_CIF",
  DATA_COMPRA_AUSENTE_EM_COMPRA: "DATA_COMPRA_AUSENTE_EM_COMPRA",
  DATA_COMPRA_PRESENTE_EM_COTACAO: "DATA_COMPRA_PRESENTE_EM_COTACAO",
  COMPRA_ANTES_DA_COTACAO: "COMPRA_ANTES_DA_COTACAO",
  VALIDADE_ANTES_DA_COTACAO: "VALIDADE_ANTES_DA_COTACAO",
  VOLUME_AUSENTE: "VOLUME_AUSENTE",
  PRAZO_PAGAMENTO_AUSENTE: "PRAZO_PAGAMENTO_AUSENTE",
  POSSIVEL_VARIACAO_NOME: "POSSIVEL_VARIACAO_NOME",
  SERIE_COM_UM_REGISTRO: "SERIE_COM_UM_REGISTRO",
  SERIE_COM_APENAS_UM_ANO: "SERIE_COM_APENAS_UM_ANO",
  MISTURA_DE_FONTES_NA_SERIE: "MISTURA_DE_FONTES_NA_SERIE",
  MISTURA_DE_FORNECEDORES_NA_SERIE: "MISTURA_DE_FORNECEDORES_NA_SERIE",
  MISTURA_DE_PRAZOS_NA_SERIE: "MISTURA_DE_PRAZOS_NA_SERIE",
  POSSIVEL_DUPLICIDADE_SEMANTICA: "POSSIVEL_DUPLICIDADE_SEMANTICA",
  PRECO_POTENCIALMENTE_EXTREMO: "PRECO_POTENCIALMENTE_EXTREMO",
});

/** Fontes de registro que representam uma compra ja efetivada (nao so cotacao). */
const FONTES_DE_COMPRA = Object.freeze(["PEDIDO_COMPRA", "NOTA_FISCAL", "CONTRATO"]);

/** Classificacoes de disponibilidade de dados -- NUNCA "suficiente para previsao".
 *  Sao so uma triagem descritiva da quantidade de dados, nao um nivel de confianca
 *  estatistica e nao autorizam previsao nenhuma. */
export const CLASSIFICACAO_SUFICIENCIA = Object.freeze({
  INSUFICIENTE: "INSUFICIENTE",
  LIMITADA: "LIMITADA",
  EXPLORATORIA: "EXPLORATORIA",
});

const naoNulo = (v) => v !== null && v !== undefined;

// --------------------------------------------------------------------------
// Normalizacao
// --------------------------------------------------------------------------

/** trim + colapsa espacos internos multiplos + caixa alta. Nao mexe em digitos/hifens. */
export function normalizarTexto(texto) {
  return String(texto).trim().replace(/\s+/g, " ").toUpperCase();
}

/** Normalizacao mais agressiva, usada SO para detectar possivel variacao de nome
 *  entre series diferentes (nunca para unir series). Alem de normalizarTexto,
 *  remove espacos imediatamente ao redor de um hifen ("6 - 30 - 6" -> "6-30-6"). */
export function normalizarSuperficialParaComparacao(texto) {
  return normalizarTexto(texto).replace(/\s*-\s*/g, "-");
}

const MARCADOR_SEM_FORMULA = "SEM_FORMULA";
const MARCADOR_SEM_DESTINO = "SEM_DESTINO";
const MARCADOR_DESTINO_NA = "N/A_FORA_DE_CIF"; // destino nao participa da chave fora de CIF_DESTINO

/**
 * Componentes normalizados usados na identidade da serie (e na comparacao
 * superficial). Centralizado aqui para que chaveSerieExata() e a deteccao de
 * POSSIVEL_VARIACAO_NOME usem exatamente a mesma logica de "o que entra".
 */
function componentesDeSerie(registro, normalizador) {
  const produto = normalizador(registro.produto);
  const formula = naoNulo(registro.formula) ? normalizador(registro.formula) : MARCADOR_SEM_FORMULA;
  const modalidade = registro.modalidadeEntrega;
  let destinoComponente;
  if (modalidade === "CIF_DESTINO") {
    destinoComponente = naoNulo(registro.destino) ? normalizador(registro.destino) : MARCADOR_SEM_DESTINO;
  } else {
    // Decisao explicita: para modalidades que nao sao CIF_DESTINO (inclusive
    // FOB_FABRICA), o destino informado NAO participa da identidade da serie --
    // o preco "na fabrica" nao muda por causa de para onde o produto vai depois.
    destinoComponente = MARCADOR_DESTINO_NA;
  }
  return { produto, formula, modalidade, destinoComponente };
}

/** Chave exata e determinística da serie -- usa so produto/formula/modalidade/
 *  destino(quando CIF) normalizados. Nunca inclui fornecedor/preco/volume/prazo/
 *  data/observacoes/id. */
export function chaveSerieExata(registro) {
  const { produto, formula, modalidade, destinoComponente } = componentesDeSerie(registro, normalizarTexto);
  return JSON.stringify([produto, formula, modalidade, destinoComponente]);
}

/** Mesma composicao de chaveSerieExata(), mas com a normalizacao mais agressiva --
 *  usada so para achar pares de series DIFERENTES que parecem a mesma coisa. */
function chaveComparacaoSuperficial(registro) {
  const { produto, formula, modalidade, destinoComponente } = componentesDeSerie(registro, normalizarSuperficialParaComparacao);
  return JSON.stringify([produto, formula, modalidade, destinoComponente]);
}

/**
 * Versao legivel (nao opaca) dos mesmos criterios de chaveSerieExata(), para
 * identificar uma serie no relatorio PRIVADO (que pode conter produto/formula/
 * destino -- ver README secao 12). O CLI decide separadamente o que entra no
 * console (sempre redigido) e o que entra no relatorio privado (pode incluir
 * isto). formula/destino ficam null quando o marcador de ausencia/nao-aplicavel
 * foi usado, em vez de vazar o texto do marcador interno.
 */
function criteriosLegiveisDeSerie(registro) {
  const { produto, formula, modalidade, destinoComponente } = componentesDeSerie(registro, normalizarTexto);
  return {
    produto,
    formula: formula === MARCADOR_SEM_FORMULA ? null : formula,
    modalidadeEntrega: modalidade,
    destino: destinoComponente === MARCADOR_SEM_DESTINO || destinoComponente === MARCADOR_DESTINO_NA ? null : destinoComponente,
  };
}

// --------------------------------------------------------------------------
// Estatistica: mediana / quartis / IQR
//
// Metodologia (documentada e fixa, nao mistura outra convencao): ordena os
// valores; mediana e a mediana classica (media dos dois centrais se par, valor
// central se impar); para Q1/Q3, quando a quantidade e impar o elemento central
// (a propria mediana) e EXCLUIDO das duas metades antes de calcular a mediana de
// cada metade (metodo de Tukey / Moore-McCabe). Q1 = mediana da metade inferior;
// Q3 = mediana da metade superior; IQR = Q3 - Q1.
// --------------------------------------------------------------------------

/** Mediana classica de um array JA ORDENADO de numeros. */
export function medianaDeOrdenado(valoresOrdenados) {
  const n = valoresOrdenados.length;
  if (n === 0) return null;
  const meio = Math.floor(n / 2);
  return n % 2 === 0 ? (valoresOrdenados[meio - 1] + valoresOrdenados[meio]) / 2 : valoresOrdenados[meio];
}

/** Q1/mediana/Q3/IQR de um array de numeros (nao precisa vir ordenado). */
export function quartis(valores) {
  const ordenado = [...valores].sort((a, b) => a - b);
  const n = ordenado.length;
  if (n === 0) return { q1: null, mediana: null, q3: null, iqr: null };
  const med = medianaDeOrdenado(ordenado);
  const meio = Math.floor(n / 2);
  const metadeInferior = ordenado.slice(0, meio);
  const metadeSuperior = n % 2 === 0 ? ordenado.slice(meio) : ordenado.slice(meio + 1);
  const q1 = medianaDeOrdenado(metadeInferior);
  const q3 = medianaDeOrdenado(metadeSuperior);
  return { q1, mediana: med, q3, iqr: q1 != null && q3 != null ? q3 - q1 : null };
}

/**
 * Limites de outlier (Tukey, fator 1.5). So aplica quando ha pelo menos 4 valores
 * (pedido explicito) -- com menos, retorna null. Quando o IQR e zero, NAO calcula
 * limites (retornaria um intervalo degenerado que sinalizaria qualquer desvio) --
 * regra explicita: IQR zero nao sinaliza automaticamente.
 */
export function limitesOutlier(valores) {
  if (valores.length < 4) return null;
  const { q1, q3, iqr } = quartis(valores);
  if (iqr == null || iqr === 0) return null;
  return { limiteInferior: q1 - 1.5 * iqr, limiteSuperior: q3 + 1.5 * iqr };
}

// --------------------------------------------------------------------------
// Classificacao de disponibilidade (nao autoriza previsao, nao e "confianca")
// --------------------------------------------------------------------------

export function classificarSuficiencia(quantidadeRegistros, anosDistintos) {
  if (quantidadeRegistros < 4 || anosDistintos < 2) return CLASSIFICACAO_SUFICIENCIA.INSUFICIENTE;
  if (quantidadeRegistros <= 11) return CLASSIFICACAO_SUFICIENCIA.LIMITADA;
  return CLASSIFICACAO_SUFICIENCIA.EXPLORATORIA;
}

// --------------------------------------------------------------------------
// Perfil completo
// --------------------------------------------------------------------------

function anoDe(dataIso) { return dataIso.slice(0, 4); }

function contarPor(registros, campo) {
  const mapa = {};
  for (const r of registros) {
    const chave = r[campo];
    mapa[chave] = (mapa[chave] ?? 0) + 1;
  }
  return mapa;
}

/** Fracao (0..1) de registros em que `campo` esta preenchido (nao ausente, nao null). */
function coberturaDeCampo(registros, campo) {
  if (registros.length === 0) return 0;
  const preenchidos = registros.filter((r) => naoNulo(r[campo])).length;
  return preenchidos / registros.length;
}

const CAMPOS_OPCIONAIS = ["dataCompra", "formula", "categoriaFormula", "destino", "volumeToneladas", "prazoPagamentoDias", "validadeProposta", "observacoes"];

/** Gera os alertas por registro (regras de data, ausencia de campo, etc). */
function alertasPorRegistro(registros, serieIdPorRegistro) {
  const alertas = [];
  for (const r of registros) {
    const serieId = serieIdPorRegistro.get(r.id);
    const add = (type) => alertas.push({ type, scope: "record", recordId: r.id, serieId });

    if (!naoNulo(r.formula)) add(TIPOS_ALERTA.FORMULA_AUSENTE);
    if (!naoNulo(r.categoriaFormula)) add(TIPOS_ALERTA.CATEGORIA_AUSENTE);
    if (r.modalidadeEntrega === "NAO_INFORMADO") add(TIPOS_ALERTA.MODALIDADE_NAO_INFORMADA);
    if (r.modalidadeEntrega === "CIF_DESTINO" && !naoNulo(r.destino)) add(TIPOS_ALERTA.DESTINO_AUSENTE_PARA_CIF);

    if (FONTES_DE_COMPRA.includes(r.fonteRegistro) && !naoNulo(r.dataCompra)) add(TIPOS_ALERTA.DATA_COMPRA_AUSENTE_EM_COMPRA);
    if (r.fonteRegistro === "COTACAO" && naoNulo(r.dataCompra)) add(TIPOS_ALERTA.DATA_COMPRA_PRESENTE_EM_COTACAO);

    if (naoNulo(r.dataCompra) && r.dataCompra < r.dataCotacao) add(TIPOS_ALERTA.COMPRA_ANTES_DA_COTACAO);
    if (naoNulo(r.validadeProposta) && r.validadeProposta < r.dataCotacao) add(TIPOS_ALERTA.VALIDADE_ANTES_DA_COTACAO);

    if (!naoNulo(r.volumeToneladas)) add(TIPOS_ALERTA.VOLUME_AUSENTE);
    if (!naoNulo(r.prazoPagamentoDias)) add(TIPOS_ALERTA.PRAZO_PAGAMENTO_AUSENTE);
  }
  return alertas;
}

/** Detecta pares de registros com possivel duplicidade semantica (nao remove nada). */
function alertasDuplicidadeSemantica(registros) {
  const alertas = [];
  const porChave = new Map();
  for (const r of registros) {
    const chave = JSON.stringify([
      r.dataCotacao,
      normalizarTexto(r.produto),
      naoNulo(r.formula) ? normalizarTexto(r.formula) : MARCADOR_SEM_FORMULA,
      normalizarTexto(r.fornecedor),
      r.preco,
      r.modalidadeEntrega,
      naoNulo(r.destino) ? normalizarTexto(r.destino) : MARCADOR_SEM_DESTINO,
      r.fonteRegistro,
    ]);
    if (!porChave.has(chave)) porChave.set(chave, []);
    porChave.get(chave).push(r.id);
  }
  for (const ids of porChave.values()) {
    if (ids.length < 2) continue;
    const ordenados = [...ids].sort();
    for (let i = 0; i < ordenados.length; i++) {
      for (let j = i + 1; j < ordenados.length; j++) {
        alertas.push({ type: TIPOS_ALERTA.POSSIVEL_DUPLICIDADE_SEMANTICA, scope: "record-pair", recordIdA: ordenados[i], recordIdB: ordenados[j] });
      }
    }
  }
  return alertas;
}

/** Detecta pares de series DIFERENTES cujo produto/formula ficam identicos sob a
 *  normalizacao superficial (caixa/espacos duplicados/espaco ao redor de hifen/
 *  espacos externos) -- alerta, nunca une. */
function alertasVariacaoNome(gruposPorChaveExata) {
  const porChaveSuperficial = new Map(); // chaveSuperficial -> Set(serieId)
  for (const [, grupo] of gruposPorChaveExata) {
    const chaveSuperficial = chaveComparacaoSuperficial(grupo.registros[0]);
    if (!porChaveSuperficial.has(chaveSuperficial)) porChaveSuperficial.set(chaveSuperficial, new Set());
    porChaveSuperficial.get(chaveSuperficial).add(grupo.serieId);
  }
  const alertas = [];
  for (const serieIds of porChaveSuperficial.values()) {
    if (serieIds.size < 2) continue;
    const ordenados = [...serieIds].sort();
    for (let i = 0; i < ordenados.length; i++) {
      for (let j = i + 1; j < ordenados.length; j++) {
        alertas.push({ type: TIPOS_ALERTA.POSSIVEL_VARIACAO_NOME, scope: "series-pair", serieIdA: ordenados[i], serieIdB: ordenados[j] });
      }
    }
  }
  return alertas;
}

function estatisticasDaSerie(registros) {
  const precos = registros.map((r) => r.preco).filter((p) => typeof p === "number" && Number.isFinite(p));
  const { q1, mediana, q3, iqr } = quartis(precos);
  const min = precos.length ? Math.min(...precos) : null;
  const max = precos.length ? Math.max(...precos) : null;
  const media = precos.length ? precos.reduce((a, b) => a + b, 0) / precos.length : null;

  const comVolume = registros.filter((r) => typeof r.volumeToneladas === "number" && Number.isFinite(r.volumeToneladas));
  let mediaPonderadaPorVolume = null;
  if (registros.length > 0 && comVolume.length === registros.length) {
    const somaVolumes = comVolume.reduce((acc, r) => acc + r.volumeToneladas, 0);
    if (somaVolumes > 0) {
      const somaPonderada = comVolume.reduce((acc, r) => acc + r.preco * r.volumeToneladas, 0);
      mediaPonderadaPorVolume = somaPonderada / somaVolumes;
    }
  }

  const anos = new Set(registros.map((r) => anoDe(r.dataCotacao)));
  const datas = registros.map((r) => r.dataCotacao).sort();

  return {
    recordCount: registros.length,
    firstDate: datas[0] ?? null,
    lastDate: datas[datas.length - 1] ?? null,
    distinctYears: [...anos].sort(),
    distinctFornecedores: new Set(registros.map((r) => normalizarTexto(r.fornecedor))).size,
    distinctFontesRegistro: new Set(registros.map((r) => r.fonteRegistro)).size,
    distinctModalidades: new Set(registros.map((r) => r.modalidadeEntrega)).size,
    distinctDestinos: new Set(registros.map((r) => (naoNulo(r.destino) ? normalizarTexto(r.destino) : MARCADOR_SEM_DESTINO))).size,
    distinctPrazos: new Set(registros.filter((r) => naoNulo(r.prazoPagamentoDias)).map((r) => r.prazoPagamentoDias)).size,
    min, max, media, mediana, q1, q3, iqr,
    mediaPonderadaPorVolume,
    registrosSemVolume: registros.length - comVolume.length,
    classificacaoSuficiencia: classificarSuficiencia(registros.length, anos.size),
  };
}

/**
 * Funcao principal do modulo. Recebe { schemaVersion, description, records } JA
 * VALIDADO (chame loadAndValidateHistoryFile/validateHistory antes) e devolve o
 * objeto de analise completo. NAO faz I/O, NAO decide o que e sanitizado -- isso
 * e trabalho do CLI.
 */
export function perfilarBase(baseValidada) {
  const registros = baseValidada?.records ?? [];

  if (registros.length === 0) {
    return {
      source: { recordCount: 0, firstDate: null, lastDate: null, distinctYears: [] },
      quality: {
        optionalFieldCoverage: Object.fromEntries(CAMPOS_OPCIONAIS.map((c) => [c, 0])),
        alertsByType: { [TIPOS_ALERTA.BASE_VAZIA]: 1 },
        totalAlerts: 1,
      },
      countsByFonteRegistro: {},
      countsByModalidadeEntrega: {},
      unidadesConfirmadas: { moedas: [], unidadesPreco: [], consistente: true },
      series: [],
      alerts: [{ type: TIPOS_ALERTA.BASE_VAZIA, scope: "base" }],
    };
  }

  // agrupa por chaveSerieExata, numerando serie-001.. em ordem alfabetica da chave
  // (deterministico para a mesma base -- ver README).
  const registrosPorChave = new Map();
  for (const r of registros) {
    const chave = chaveSerieExata(r);
    if (!registrosPorChave.has(chave)) registrosPorChave.set(chave, []);
    registrosPorChave.get(chave).push(r);
  }
  const chavesOrdenadas = [...registrosPorChave.keys()].sort();
  const gruposPorChaveExata = new Map(); // chave -> { serieId, registros }
  const serieIdPorRegistro = new Map(); // recordId -> serieId
  chavesOrdenadas.forEach((chave, indice) => {
    const serieId = `serie-${String(indice + 1).padStart(3, "0")}`;
    const registrosDaSerie = registrosPorChave.get(chave);
    gruposPorChaveExata.set(chave, { serieId, registros: registrosDaSerie });
    for (const r of registrosDaSerie) serieIdPorRegistro.set(r.id, serieId);
  });

  const alertasRegistro = alertasPorRegistro(registros, serieIdPorRegistro);
  const alertasDuplicidade = alertasDuplicidadeSemantica(registros);
  const alertasVariacao = alertasVariacaoNome(gruposPorChaveExata);

  const series = chavesOrdenadas.map((chave) => {
    const grupo = gruposPorChaveExata.get(chave);
    const stats = estatisticasDaSerie(grupo.registros);
    const alertasDaSerie = [];
    if (grupo.registros.length === 1) alertasDaSerie.push({ type: TIPOS_ALERTA.SERIE_COM_UM_REGISTRO, scope: "series", serieId: grupo.serieId });
    if (stats.distinctYears.length === 1) alertasDaSerie.push({ type: TIPOS_ALERTA.SERIE_COM_APENAS_UM_ANO, scope: "series", serieId: grupo.serieId });
    if (stats.distinctFontesRegistro > 1) alertasDaSerie.push({ type: TIPOS_ALERTA.MISTURA_DE_FONTES_NA_SERIE, scope: "series", serieId: grupo.serieId });
    if (stats.distinctFornecedores > 1) alertasDaSerie.push({ type: TIPOS_ALERTA.MISTURA_DE_FORNECEDORES_NA_SERIE, scope: "series", serieId: grupo.serieId });
    if (stats.distinctPrazos > 1) alertasDaSerie.push({ type: TIPOS_ALERTA.MISTURA_DE_PRAZOS_NA_SERIE, scope: "series", serieId: grupo.serieId });

    // outliers de preco (Tukey), so quando >=4 precos validos e IQR>0
    const precosComId = grupo.registros
      .filter((r) => typeof r.preco === "number" && Number.isFinite(r.preco))
      .map((r) => ({ id: r.id, preco: r.preco }));
    const limites = limitesOutlier(precosComId.map((p) => p.preco));
    const alertasOutlier = [];
    if (limites) {
      for (const { id, preco } of precosComId) {
        if (preco < limites.limiteInferior) alertasOutlier.push({ type: TIPOS_ALERTA.PRECO_POTENCIALMENTE_EXTREMO, scope: "record", recordId: id, serieId: grupo.serieId, direction: "abaixo" });
        else if (preco > limites.limiteSuperior) alertasOutlier.push({ type: TIPOS_ALERTA.PRECO_POTENCIALMENTE_EXTREMO, scope: "record", recordId: id, serieId: grupo.serieId, direction: "acima" });
      }
    }

    return {
      serieId: grupo.serieId,
      criterios: criteriosLegiveisDeSerie(grupo.registros[0]),
      recordIds: grupo.registros.map((r) => r.id),
      ...stats,
      alertCount: alertasDaSerie.length + alertasOutlier.length,
      _alertasDaSerie: alertasDaSerie,
      _alertasOutlier: alertasOutlier,
    };
  });

  const alertasSerie = series.flatMap((s) => s._alertasDaSerie);
  const alertasOutlierTodos = series.flatMap((s) => s._alertasOutlier);
  const seriesLimpo = series.map(({ _alertasDaSerie, _alertasOutlier, ...resto }) => resto);

  const todosOsAlertas = [...alertasRegistro, ...alertasSerie, ...alertasOutlierTodos, ...alertasDuplicidade, ...alertasVariacao];
  // ordenacao deterministica: por tipo, depois pelo primeiro identificador disponivel
  const idDoAlerta = (a) => a.recordId ?? a.recordIdA ?? a.serieId ?? a.serieIdA ?? "";
  todosOsAlertas.sort((a, b) => (a.type !== b.type ? a.type.localeCompare(b.type) : idDoAlerta(a).localeCompare(idDoAlerta(b))));

  const alertsByType = {};
  for (const a of todosOsAlertas) alertsByType[a.type] = (alertsByType[a.type] ?? 0) + 1;

  const anosGlobais = new Set(registros.map((r) => anoDe(r.dataCotacao)));
  const datasGlobais = registros.map((r) => r.dataCotacao).sort();
  const moedas = [...new Set(registros.map((r) => r.moeda))];
  const unidadesPreco = [...new Set(registros.map((r) => r.unidadePreco))];

  return {
    source: {
      recordCount: registros.length,
      firstDate: datasGlobais[0] ?? null,
      lastDate: datasGlobais[datasGlobais.length - 1] ?? null,
      distinctYears: [...anosGlobais].sort(),
    },
    quality: {
      optionalFieldCoverage: Object.fromEntries(CAMPOS_OPCIONAIS.map((c) => [c, coberturaDeCampo(registros, c)])),
      alertsByType,
      totalAlerts: todosOsAlertas.length,
    },
    countsByFonteRegistro: contarPor(registros, "fonteRegistro"),
    countsByModalidadeEntrega: contarPor(registros, "modalidadeEntrega"),
    unidadesConfirmadas: { moedas, unidadesPreco, consistente: moedas.length <= 1 && unidadesPreco.length <= 1 },
    series: seriesLimpo,
    alerts: todosOsAlertas,
  };
}
