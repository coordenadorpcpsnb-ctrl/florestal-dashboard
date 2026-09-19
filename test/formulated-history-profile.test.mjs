/**
 * test/formulated-history-profile.test.mjs — Testes do modulo puro
 * formulated-history-profile.mjs (Etapa 3: analise exploratoria/qualidade da base
 * PRIVADA de historico de formulados).
 *
 * Usa node:test (nativo, sem framework externo). DADOS 100% FICTICIOS, com
 * marcadores inequivocos (PRODUTO_SIGILOSO_FICTICIO, FORNECEDOR_SIGILOSO_FICTICIO,
 * DESTINO_SIGILOSO_FICTICIO, 987654.32) para poder confirmar, por busca de texto,
 * que nenhum deles aparece onde nao deveria. Nunca grava em disco -- o modulo sob
 * teste nao faz I/O nenhum.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA_VERSION_PROFILE,
  TIPOS_ALERTA,
  CLASSIFICACAO_SUFICIENCIA,
  normalizarTexto,
  normalizarSuperficialParaComparacao,
  chaveSerieExata,
  medianaDeOrdenado,
  quartis,
  limitesOutlier,
  classificarSuficiencia,
  perfilarBase,
} from "../formulated-history-profile.mjs";

/** Registro ficticio completo. Sobrescreva so o que o cenario precisar. */
function registro(overrides = {}) {
  return {
    id: overrides.id ?? "fp-ficticio-001",
    dataCotacao: "2024-01-10",
    dataCompra: null,
    anoReferencia: 2024,
    produto: "PRODUTO_SIGILOSO_FICTICIO",
    formula: "06-30-06",
    categoriaFormula: "NPK",
    fornecedor: "FORNECEDOR_SIGILOSO_FICTICIO",
    preco: 1000,
    moeda: "BRL",
    unidadePreco: "BRL_TON",
    modalidadeEntrega: "CIF_DESTINO",
    destino: "DESTINO_SIGILOSO_FICTICIO",
    volumeToneladas: 10,
    prazoPagamentoDias: 30,
    validadeProposta: null,
    fonteRegistro: "COTACAO",
    observacoes: null,
    ...overrides,
  };
}

function base(records) {
  return { schemaVersion: 1, description: "base ficticia de teste", records };
}

// ============================================================================
// Normalizacao
// ============================================================================

test("normalizarTexto: trim + colapsa espacos internos + caixa alta", () => {
  assert.equal(normalizarTexto("  Produto   Ficticio  "), "PRODUTO FICTICIO");
});

test("normalizarTexto: nao mexe em digitos, zeros a esquerda nem hifens", () => {
  assert.equal(normalizarTexto("06-30-06"), "06-30-06");
  assert.equal(normalizarTexto("6-30-6"), "6-30-6");
  assert.notEqual(normalizarTexto("06-30-06"), normalizarTexto("6-30-6"));
});

test("normalizarTexto: nao remove nem interpreta marcadores quimicos (MICRO/Zn/B/Cu/S)", () => {
  assert.equal(normalizarTexto("Formulado + MICRO (Zn, B, Cu, S)"), "FORMULADO + MICRO (ZN, B, CU, S)");
});

test("normalizarSuperficialParaComparacao: remove espacos ao redor de hifen, alem do que normalizarTexto ja faz", () => {
  assert.equal(normalizarSuperficialParaComparacao("06 - 30 - 06"), "06-30-06");
  assert.equal(normalizarSuperficialParaComparacao("06-30-06"), "06-30-06");
});

test("normalizarSuperficialParaComparacao: ainda assim NAO iguala 06-30-06 a 6-30-6", () => {
  assert.notEqual(normalizarSuperficialParaComparacao("06-30-06"), normalizarSuperficialParaComparacao("6-30-6"));
});

// ============================================================================
// Identidade de serie (chaveSerieExata)
// ============================================================================

test("chaveSerieExata: dois registros identicos em produto/formula/modalidade/destino caem na mesma chave", () => {
  const a = registro({ id: "a" });
  const b = registro({ id: "b" });
  assert.equal(chaveSerieExata(a), chaveSerieExata(b));
});

test("chaveSerieExata: fornecedor/preco/volume/prazo/data/observacoes/id NUNCA entram na chave", () => {
  const a = registro({ id: "a", fornecedor: "FORNECEDOR_A_FICTICIO", preco: 100, volumeToneladas: 1, prazoPagamentoDias: 10, dataCotacao: "2024-01-01", observacoes: "x" });
  const b = registro({ id: "b", fornecedor: "FORNECEDOR_B_FICTICIO", preco: 999, volumeToneladas: 99, prazoPagamentoDias: 90, dataCotacao: "2025-06-01", observacoes: "y" });
  assert.equal(chaveSerieExata(a), chaveSerieExata(b));
});

test("chaveSerieExata: modalidade CIF_DESTINO com destinos diferentes gera chaves diferentes", () => {
  const a = registro({ modalidadeEntrega: "CIF_DESTINO", destino: "CIDADE_FICTICIA_X" });
  const b = registro({ modalidadeEntrega: "CIF_DESTINO", destino: "CIDADE_FICTICIA_Y" });
  assert.notEqual(chaveSerieExata(a), chaveSerieExata(b));
});

test("chaveSerieExata: fora de CIF_DESTINO, destino NAO participa da chave (mesmo produto/formula = mesma serie)", () => {
  const a = registro({ modalidadeEntrega: "FOB_ORIGEM", destino: "CIDADE_FICTICIA_X" });
  const b = registro({ modalidadeEntrega: "FOB_ORIGEM", destino: "CIDADE_FICTICIA_Y" });
  const c = registro({ modalidadeEntrega: "FOB_ORIGEM", destino: null });
  assert.equal(chaveSerieExata(a), chaveSerieExata(b));
  assert.equal(chaveSerieExata(a), chaveSerieExata(c));
});

test("chaveSerieExata: mesmo destino em CIF_DESTINO vs FOB_ORIGEM gera chaves diferentes (modalidade entra na chave)", () => {
  const a = registro({ modalidadeEntrega: "CIF_DESTINO", destino: "CIDADE_FICTICIA_X" });
  const b = registro({ modalidadeEntrega: "FOB_ORIGEM", destino: "CIDADE_FICTICIA_X" });
  assert.notEqual(chaveSerieExata(a), chaveSerieExata(b));
});

test("chaveSerieExata: formula ausente (null) usa um marcador estavel, distinto de qualquer formula real", () => {
  const semFormula1 = registro({ formula: null });
  const semFormula2 = registro({ formula: undefined });
  const comFormula = registro({ formula: "06-30-06" });
  assert.equal(chaveSerieExata(semFormula1), chaveSerieExata(semFormula2));
  assert.notEqual(chaveSerieExata(semFormula1), chaveSerieExata(comFormula));
});

test("chaveSerieExata: '06-30-06' e '6-30-6' sao series DIFERENTES (nao merge numerico)", () => {
  const a = registro({ formula: "06-30-06" });
  const b = registro({ formula: "6-30-6" });
  assert.notEqual(chaveSerieExata(a), chaveSerieExata(b));
});

test("chaveSerieExata: produtos com so diferenca de caixa/espaco colapsam na mesma serie (normalizacao conservadora ainda assim iguala texto igual)", () => {
  const a = registro({ produto: "Produto Ficticio A" });
  const b = registro({ produto: "  produto   ficticio a  " });
  assert.equal(chaveSerieExata(a), chaveSerieExata(b));
});

// ============================================================================
// Estatistica: mediana / quartis / IQR
// ============================================================================

test("medianaDeOrdenado: array vazio -> null; impar -> elemento central; par -> media dos dois centrais", () => {
  assert.equal(medianaDeOrdenado([]), null);
  assert.equal(medianaDeOrdenado([5]), 5);
  assert.equal(medianaDeOrdenado([1, 2, 3]), 2);
  assert.equal(medianaDeOrdenado([1, 2, 3, 4]), 2.5);
});

test("quartis: exemplo classico impar (Moore-McCabe), mediana central excluida das metades", () => {
  const { q1, mediana, q3, iqr } = quartis([1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual({ q1, mediana, q3, iqr }, { q1: 2, mediana: 4, q3: 6, iqr: 4 });
});

test("quartis: exemplo par, sem elemento central a excluir", () => {
  const { q1, mediana, q3, iqr } = quartis([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual({ q1, mediana, q3, iqr }, { q1: 2.5, mediana: 4.5, q3: 6.5, iqr: 4 });
});

test("quartis: nao depende da ordem de entrada", () => {
  const ordenado = quartis([1, 2, 3, 4, 5, 6, 7]);
  const embaralhado = quartis([5, 1, 7, 3, 2, 6, 4]);
  assert.deepEqual(embaralhado, ordenado);
});

test("quartis: array vazio -> tudo null", () => {
  assert.deepEqual(quartis([]), { q1: null, mediana: null, q3: null, iqr: null });
});

test("limitesOutlier: menos de 4 valores -> null (regra explicita, mesmo com valores discrepantes)", () => {
  assert.equal(limitesOutlier([1, 2, 3]), null);
  assert.notEqual(limitesOutlier([1, 2, 3, 1000]), null); // sanity: com 4 valores ja calcula limites
});

test("limitesOutlier: IQR zero NAO gera limites (nao sinaliza qualquer desvio automaticamente)", () => {
  assert.equal(limitesOutlier([5, 5, 5, 5]), null);
  assert.equal(limitesOutlier([5, 5, 5, 5, 5, 5]), null);
});

test("limitesOutlier: calcula limites de Tukey (1.5x IQR) corretamente", () => {
  const lim = limitesOutlier([1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(lim, { limiteInferior: 2 - 6, limiteSuperior: 6 + 6 });
});

// ============================================================================
// Classificacao de suficiencia (nunca "confianca estatistica")
// ============================================================================

test("classificarSuficiencia: limites exatos entre INSUFICIENTE / LIMITADA / EXPLORATORIA", () => {
  assert.equal(classificarSuficiencia(3, 5), CLASSIFICACAO_SUFICIENCIA.INSUFICIENTE); // poucos registros
  assert.equal(classificarSuficiencia(50, 1), CLASSIFICACAO_SUFICIENCIA.INSUFICIENTE); // 1 ano so
  assert.equal(classificarSuficiencia(4, 2), CLASSIFICACAO_SUFICIENCIA.LIMITADA);
  assert.equal(classificarSuficiencia(11, 2), CLASSIFICACAO_SUFICIENCIA.LIMITADA);
  assert.equal(classificarSuficiencia(12, 2), CLASSIFICACAO_SUFICIENCIA.EXPLORATORIA);
});

test("classificarSuficiencia: nenhum dos tres valores menciona previsao/confianca no texto", () => {
  for (const v of Object.values(CLASSIFICACAO_SUFICIENCIA)) {
    assert.doesNotMatch(v, /PREVIS|CONFIANC/i);
  }
});

// ============================================================================
// perfilarBase — base vazia
// ============================================================================

test("perfilarBase: base vazia gera exatamente um alerta BASE_VAZIA e nenhuma serie", () => {
  const perfil = perfilarBase(base([]));
  assert.equal(perfil.source.recordCount, 0);
  assert.equal(perfil.series.length, 0);
  assert.deepEqual(perfil.alerts, [{ type: TIPOS_ALERTA.BASE_VAZIA, scope: "base" }]);
});

// ============================================================================
// perfilarBase — numeracao deterministica de serie
// ============================================================================

test("perfilarBase: numeracao serie-NNN e deterministica para a mesma base (mesma entrada -> mesma saida)", () => {
  const registros = [
    registro({ id: "fp-1", produto: "PRODUTO_B_FICTICIO" }),
    registro({ id: "fp-2", produto: "PRODUTO_A_FICTICIO" }),
  ];
  const p1 = perfilarBase(base(registros));
  const p2 = perfilarBase(base(registros));
  assert.deepEqual(
    p1.series.map((s) => s.serieId),
    p2.series.map((s) => s.serieId)
  );
  // ordem alfabetica da chave (produto normalizado entra primeiro na chave)
  assert.equal(p1.series.find((s) => s.criterios.produto === "PRODUTO_A_FICTICIO").serieId, "serie-001");
  assert.equal(p1.series.find((s) => s.criterios.produto === "PRODUTO_B_FICTICIO").serieId, "serie-002");
});

// ============================================================================
// perfilarBase — alertas por registro
// ============================================================================

test("alerta FORMULA_AUSENTE + CATEGORIA_AUSENTE quando formula/categoriaFormula sao null", () => {
  const perfil = perfilarBase(base([registro({ formula: null, categoriaFormula: null })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.FORMULA_AUSENTE));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.CATEGORIA_AUSENTE));
});

test("alerta MODALIDADE_NAO_INFORMADA quando modalidadeEntrega === NAO_INFORMADO", () => {
  const perfil = perfilarBase(base([registro({ modalidadeEntrega: "NAO_INFORMADO", destino: null })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.MODALIDADE_NAO_INFORMADA));
});

test("alerta DESTINO_AUSENTE_PARA_CIF quando CIF_DESTINO sem destino", () => {
  const perfil = perfilarBase(base([registro({ modalidadeEntrega: "CIF_DESTINO", destino: null })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.DESTINO_AUSENTE_PARA_CIF));
});

test("alerta DATA_COMPRA_AUSENTE_EM_COMPRA quando fonteRegistro e de compra efetivada sem dataCompra", () => {
  for (const fonte of ["PEDIDO_COMPRA", "NOTA_FISCAL", "CONTRATO"]) {
    const perfil = perfilarBase(base([registro({ fonteRegistro: fonte, dataCompra: null })]));
    assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.DATA_COMPRA_AUSENTE_EM_COMPRA), `deveria alertar para fonteRegistro=${fonte}`);
  }
});

test("alerta DATA_COMPRA_PRESENTE_EM_COTACAO quando fonteRegistro=COTACAO mas ha dataCompra", () => {
  const perfil = perfilarBase(base([registro({ fonteRegistro: "COTACAO", dataCompra: "2024-01-11" })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.DATA_COMPRA_PRESENTE_EM_COTACAO));
});

test("alerta COMPRA_ANTES_DA_COTACAO quando dataCompra < dataCotacao", () => {
  const perfil = perfilarBase(base([registro({ dataCotacao: "2024-05-10", dataCompra: "2024-05-01", fonteRegistro: "NOTA_FISCAL" })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.COMPRA_ANTES_DA_COTACAO));
});

test("alerta VALIDADE_ANTES_DA_COTACAO quando validadeProposta < dataCotacao", () => {
  const perfil = perfilarBase(base([registro({ dataCotacao: "2024-05-10", validadeProposta: "2024-05-01" })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.VALIDADE_ANTES_DA_COTACAO));
});

test("alerta VOLUME_AUSENTE e PRAZO_PAGAMENTO_AUSENTE quando os respectivos campos sao null", () => {
  const perfil = perfilarBase(base([registro({ volumeToneladas: null, prazoPagamentoDias: null })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.VOLUME_AUSENTE));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.PRAZO_PAGAMENTO_AUSENTE));
});

// ============================================================================
// perfilarBase — alertas por serie
// ============================================================================

test("alerta SERIE_COM_UM_REGISTRO quando a serie tem so um registro", () => {
  const perfil = perfilarBase(base([registro({ id: "fp-1" })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.SERIE_COM_UM_REGISTRO));
});

test("alerta SERIE_COM_APENAS_UM_ANO quando todos os registros da serie sao do mesmo ano", () => {
  const perfil = perfilarBase(
    base([registro({ id: "fp-1", dataCotacao: "2024-01-10" }), registro({ id: "fp-2", dataCotacao: "2024-06-10" })])
  );
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.SERIE_COM_APENAS_UM_ANO));
});

test("SERIE_COM_APENAS_UM_ANO NAO aparece quando a serie cobre 2+ anos", () => {
  const perfil = perfilarBase(
    base([registro({ id: "fp-1", dataCotacao: "2024-01-10" }), registro({ id: "fp-2", dataCotacao: "2025-01-10" })])
  );
  assert.ok(!perfil.alerts.some((a) => a.type === TIPOS_ALERTA.SERIE_COM_APENAS_UM_ANO));
});

test("alerta MISTURA_DE_FONTES_NA_SERIE quando a mesma serie tem fonteRegistro diferentes", () => {
  const perfil = perfilarBase(
    base([registro({ id: "fp-1", fonteRegistro: "COTACAO" }), registro({ id: "fp-2", fonteRegistro: "NOTA_FISCAL", dataCompra: "2024-06-11" })])
  );
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.MISTURA_DE_FONTES_NA_SERIE));
});

test("alerta MISTURA_DE_FORNECEDORES_NA_SERIE quando a mesma serie tem fornecedores diferentes", () => {
  const perfil = perfilarBase(
    base([registro({ id: "fp-1", fornecedor: "FORNECEDOR_A_FICTICIO" }), registro({ id: "fp-2", fornecedor: "FORNECEDOR_B_FICTICIO" })])
  );
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.MISTURA_DE_FORNECEDORES_NA_SERIE));
});

test("alerta MISTURA_DE_PRAZOS_NA_SERIE quando a mesma serie tem prazoPagamentoDias diferentes", () => {
  const perfil = perfilarBase(base([registro({ id: "fp-1", prazoPagamentoDias: 30 }), registro({ id: "fp-2", prazoPagamentoDias: 60 })]));
  assert.ok(perfil.alerts.some((a) => a.type === TIPOS_ALERTA.MISTURA_DE_PRAZOS_NA_SERIE));
});

test("fonteRegistro/prazoPagamentoDias/dataCompra NUNCA fragmentam a serie (viram alerta, nao series separadas)", () => {
  const perfil = perfilarBase(
    base([
      registro({ id: "fp-1", fonteRegistro: "COTACAO", prazoPagamentoDias: 30 }),
      registro({ id: "fp-2", fonteRegistro: "NOTA_FISCAL", dataCompra: "2024-06-11", prazoPagamentoDias: 60 }),
    ])
  );
  assert.equal(perfil.series.length, 1);
  assert.equal(perfil.series[0].recordIds.length, 2);
});

// ============================================================================
// perfilarBase — duplicidade semantica e variacao de nome
// ============================================================================

test("alerta POSSIVEL_DUPLICIDADE_SEMANTICA para dois registros iguais nos 8 campos relevantes, id diferente", () => {
  const a = registro({ id: "fp-1" });
  const b = registro({ id: "fp-2" });
  const perfil = perfilarBase(base([a, b]));
  const dup = perfil.alerts.find((al) => al.type === TIPOS_ALERTA.POSSIVEL_DUPLICIDADE_SEMANTICA);
  assert.ok(dup);
  assert.deepEqual([dup.recordIdA, dup.recordIdB].sort(), ["fp-1", "fp-2"]);
});

test("POSSIVEL_DUPLICIDADE_SEMANTICA nao aparece quando os registros diferem em preco (nao sao a mesma cotacao)", () => {
  const perfil = perfilarBase(base([registro({ id: "fp-1", preco: 1000 }), registro({ id: "fp-2", preco: 1100 })]));
  assert.ok(!perfil.alerts.some((a) => a.type === TIPOS_ALERTA.POSSIVEL_DUPLICIDADE_SEMANTICA));
});

test("duplicidade semantica nunca remove/escolhe registros — ambos continuam na serie e nas contagens", () => {
  const perfil = perfilarBase(base([registro({ id: "fp-1" }), registro({ id: "fp-2" })]));
  assert.equal(perfil.source.recordCount, 2);
  assert.equal(perfil.series[0].recordIds.length, 2);
});

test("alerta POSSIVEL_VARIACAO_NOME entre duas series diferentes que colapsam sob normalizacao superficial (espaco ao redor do hifen)", () => {
  const a = registro({ id: "fp-1", formula: "06-30-06" });
  const b = registro({ id: "fp-2", formula: "06 - 30 - 06" });
  const perfil = perfilarBase(base([a, b]));
  assert.equal(perfil.series.length, 2, "sao duas series EXATAS distintas (normalizacao conservadora nao as une)");
  assert.ok(perfil.alerts.some((al) => al.type === TIPOS_ALERTA.POSSIVEL_VARIACAO_NOME));
});

test("POSSIVEL_VARIACAO_NOME nunca funde as series automaticamente, mesmo quando disparado", () => {
  const a = registro({ id: "fp-1", formula: "06-30-06" });
  const b = registro({ id: "fp-2", formula: "06 - 30 - 06" });
  const perfil = perfilarBase(base([a, b]));
  const idsDasSeries = perfil.series.map((s) => s.recordIds.length);
  assert.deepEqual(idsDasSeries.sort(), [1, 1]);
});

test("POSSIVEL_VARIACAO_NOME NAO dispara para series genuinamente diferentes (06-30-06 vs 6-30-6)", () => {
  const a = registro({ id: "fp-1", formula: "06-30-06" });
  const b = registro({ id: "fp-2", formula: "6-30-6" });
  const perfil = perfilarBase(base([a, b]));
  assert.ok(!perfil.alerts.some((al) => al.type === TIPOS_ALERTA.POSSIVEL_VARIACAO_NOME));
});

// ============================================================================
// perfilarBase — outliers de preco (Tukey / IQR)
// ============================================================================

test("PRECO_POTENCIALMENTE_EXTREMO so avalia quando a serie tem >= 4 precos validos", () => {
  const registros = [1000, 1010, 1020].map((preco, i) => registro({ id: `fp-${i}`, preco }));
  const perfil = perfilarBase(base(registros));
  assert.ok(!perfil.alerts.some((a) => a.type === TIPOS_ALERTA.PRECO_POTENCIALMENTE_EXTREMO));
});

test("PRECO_POTENCIALMENTE_EXTREMO dispara para um preco muito acima dos demais na mesma serie (>=4 registros)", () => {
  // 6 precos proximos + 1 muito acima; com poucos pontos o proprio outlier pode
  // distorcer o quartil que o contem, entao o cluster precisa ser grande o
  // bastante para o limite superior (Q3 + 1.5*IQR) ainda ficar abaixo dele.
  const registros = [1000, 1010, 1020, 1030, 1040, 1050, 50000].map((preco, i) => registro({ id: `fp-${i}`, preco }));
  const perfil = perfilarBase(base(registros));
  const outlier = perfil.alerts.find((a) => a.type === TIPOS_ALERTA.PRECO_POTENCIALMENTE_EXTREMO);
  assert.ok(outlier);
  assert.equal(outlier.direction, "acima");
});

test("PRECO_POTENCIALMENTE_EXTREMO nao dispara quando IQR=0 mesmo com >=4 registros (regra explicita)", () => {
  const registros = [1000, 1000, 1000, 1000, 1000].map((preco, i) => registro({ id: `fp-${i}`, preco }));
  const perfil = perfilarBase(base(registros));
  assert.ok(!perfil.alerts.some((a) => a.type === TIPOS_ALERTA.PRECO_POTENCIALMENTE_EXTREMO));
});

// ============================================================================
// perfilarBase — media ponderada por volume (tudo ou nada)
// ============================================================================

test("mediaPonderadaPorVolume: null quando QUALQUER registro da serie nao tem volume", () => {
  const perfil = perfilarBase(
    base([registro({ id: "fp-1", preco: 1000, volumeToneladas: 10 }), registro({ id: "fp-2", preco: 1100, volumeToneladas: null })])
  );
  assert.equal(perfil.series[0].mediaPonderadaPorVolume, null);
});

test("mediaPonderadaPorVolume: calculada quando TODOS os registros da serie tem volume", () => {
  const perfil = perfilarBase(
    base([registro({ id: "fp-1", preco: 1000, volumeToneladas: 10 }), registro({ id: "fp-2", preco: 1100, volumeToneladas: 30 })])
  );
  // (1000*10 + 1100*30) / 40 = 1075
  assert.equal(perfil.series[0].mediaPonderadaPorVolume, 1075);
});

// ============================================================================
// Redacao / conteudo sensivel
// ============================================================================

test("fornecedor e observacoes NUNCA aparecem em lugar nenhum do objeto de perfil", () => {
  const registros = [
    registro({ id: "fp-1", fornecedor: "FORNECEDOR_SIGILOSO_FICTICIO", observacoes: "OBSERVACAO_SIGILOSA_FICTICIA" }),
    registro({ id: "fp-2", fornecedor: "FORNECEDOR_SIGILOSO_FICTICIO", preco: 987654.32, observacoes: null }),
  ];
  const perfil = perfilarBase(base(registros));
  const serializado = JSON.stringify(perfil);
  assert.doesNotMatch(serializado, /FORNECEDOR_SIGILOSO_FICTICIO/);
  assert.doesNotMatch(serializado, /OBSERVACAO_SIGILOSA_FICTICIA/);
});

test("alertas de registro/par/serie nunca carregam campos alem de type/scope/ids/direction", () => {
  const registros = [registro({ id: "fp-1", formula: null }), registro({ id: "fp-2", formula: null })];
  const perfil = perfilarBase(base(registros));
  const CAMPOS_PERMITIDOS = new Set(["type", "scope", "recordId", "recordIdA", "recordIdB", "serieId", "serieIdA", "serieIdB", "direction"]);
  for (const alerta of perfil.alerts) {
    for (const campo of Object.keys(alerta)) {
      assert.ok(CAMPOS_PERMITIDOS.has(campo), `campo inesperado "${campo}" em um alerta`);
    }
  }
});

// ============================================================================
// Pureza do modulo (sem I/O, sem mutar a entrada)
// ============================================================================

test("perfilarBase nao muta o objeto de entrada (registros congelados nao geram erro nem sao alterados)", () => {
  const registros = [Object.freeze(registro({ id: "fp-1" })), Object.freeze(registro({ id: "fp-2" }))];
  const entrada = Object.freeze({ schemaVersion: 1, description: "d", records: Object.freeze(registros) });
  assert.doesNotThrow(() => perfilarBase(entrada));
});

test("perfilarBase e deterministico: mesma entrada gera exatamente o mesmo resultado (JSON identico)", () => {
  const registros = [registro({ id: "fp-1" }), registro({ id: "fp-2", produto: "OUTRO_PRODUTO_FICTICIO" })];
  const p1 = JSON.stringify(perfilarBase(base(registros)));
  const p2 = JSON.stringify(perfilarBase(base(registros)));
  assert.equal(p1, p2);
});

test("SCHEMA_VERSION_PROFILE e um numero inteiro positivo", () => {
  assert.ok(Number.isInteger(SCHEMA_VERSION_PROFILE) && SCHEMA_VERSION_PROFILE > 0);
});

test("TIPOS_ALERTA tem exatamente os 19 tipos enumerados na Etapa 3", () => {
  assert.equal(Object.keys(TIPOS_ALERTA).length, 19);
});
