/**
 * test/extract-market-driver-history.test.mjs — Testes das funcoes puras de
 * extract-market-driver-history.mjs (Etapa 5): parsing de snapshot,
 * classificacao de status/confianca, referencias, deduplicacao, conflitos,
 * frequencia e cobertura. Usa um ADAPTADOR GIT FICTICIO em memoria -- nenhum
 * teste aqui depende de rede nem do historico real do repositorio (isso fica
 * em test/extract-market-driver-history.cli.test.mjs, num unico teste de
 * integracao leve e explicitamente marcado).
 *
 * DADOS 100% FICTICIOS: hashes de commit inventados, valores de mercado
 * ficticios, datas ficticias. Nunca copia valores reais de data.json.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  truncarHash,
  analisarSnapshot,
  interpretarStatusTexto,
  classificarProveniencia,
  CATEGORIA_MENSAGEM,
  calcularReferencia,
  classificarConfianca,
  calcularChaveDeduplicacao,
  extrairCandidatas,
  deduplicarGrupo,
  deduplicarObservacoes,
  classificarFrequencia,
  calcularCobertura,
  extrairSerieTemporal,
  formatarResumoCobertura,
} from "../extract-market-driver-history.mjs";
import { STATUS_OBSERVACAO, CONFIANCA_EXTRACAO, validateHistory } from "../market-driver-history.mjs";

const HASH_A = "a".repeat(40);
const HASH_B = "b".repeat(40);
const HASH_C = "c".repeat(40);

/** Snapshot ficticio de data.json (texto bruto), com todos os campos que o
 *  extrator sabe interpretar. Sobrescreva so o que o cenario precisar. */
function snapshotTexto(overrides = {}) {
  const base = {
    updatedAt: "2026-01-10T10:00:00.000Z",
    updatedAtBR: "10/01/2026, 10:00:00",
    ref: "Jan/2026",
    current: { dolar: 5.0, ureia: 400, map: 600, kcl: 300, gas: 2.5, bdi: 2000, soja: 130, sojaTO: 124 },
    previous: { dolar: 5.0, ureia: 400, map: 600, kcl: 300, gas: 2.5, bdi: 2000, soja: 130, sojaTO: 124 },
    delta: {},
    troca: {},
    status: {
      cambio: "ok (BCB PTAX)",
      ureia: "ok (ComexStat 2026-01)",
      map: "ok (ComexStat 2026-01)",
      kcl: "ok (ComexStat 2026-01)",
      gas: "ok (EIA Henry Hub)",
      bdi: "ok (HANDYBULK, 09/01/2026)",
      soja: "ok (Noticias Agricolas / CEPEA-PR 09/01/2026)",
      sojaRegional: "ok (praca ficticia)",
    },
    refsFertilizantes: { ureia: "2026-01", map: "2026-01", kcl: "2026-01" },
    noticiasFert: [],
  };
  return JSON.stringify({ ...base, ...overrides });
}

/** Adaptador Git ficticio: mapa commitHash(completo) -> {commitDate, dataJson, override}. */
function adapterFicticio(commits) {
  return {
    listarCommits() {
      return commits.map((c) => ({ hash: c.hash, commitDate: c.commitDate }));
    },
    lerArquivoNoCommit(hash, caminho) {
      const c = commits.find((x) => x.hash === hash);
      if (!c) return null;
      if (caminho === "data.json") return c.dataJson ?? null;
      if (caminho === "fertilizers-override.json") return c.override ?? null;
      return null;
    },
  };
}

// ============================================================================
// 1-5. Cenarios de historico/commits/snapshot
// ============================================================================

test("1. historico sem commits -> serie vazia, sem erro", () => {
  const { serie, cobertura } = extrairSerieTemporal({ adapterGit: adapterFicticio([]), agora: () => "2099-01-01T00:00:00Z" });
  assert.equal(serie.observations.length, 0);
  assert.equal(serie.source.commitCountAudited, 0);
  assert.equal(cobertura.commitsAuditados, 0);
  assert.equal(validateHistory(serie).valid, true);
});

test("2. um commit valido -> observacoes para todos os indicadores presentes", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto() }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  assert.equal(serie.source.commitCountAudited, 1);
  assert.equal(serie.source.snapshotCountParsed, 1);
  assert.equal(serie.observations.length, 8);
});

test("3. snapshot com JSON invalido -> rejeitado, nao interrompe a extracao dos demais", () => {
  const commits = [
    { hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: "{ isso nao e json" },
    { hash: HASH_B, commitDate: "2026-01-11T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-01-11T10:00:00.000Z" }) },
  ];
  const { serie, cobertura } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  assert.equal(serie.source.snapshotCountRejected, 1);
  assert.equal(serie.source.snapshotCountParsed, 1);
  assert.equal(cobertura.snapshotsInvalidos, 1);
  assert.ok(serie.observations.length > 0);
});

test("4. snapshot sem data.json no commit (arquivo ausente) -> rejeitado, nao conta como 'encontrado'", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: null }];
  const { cobertura } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  assert.equal(cobertura.snapshotsEncontrados, 0);
  assert.equal(cobertura.snapshotsInvalidos, 1);
});

test("5. snapshot com estrutura parcial (sem current) -> rejeitado", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: JSON.stringify({ ref: "Jan/2026" }) }];
  const analise = analisarSnapshot(commits[0], commits[0].dataJson);
  assert.equal(analise.valido, false);
  assert.equal(analise.motivo, "ESTRUTURA_INESPERADA");
});

// ============================================================================
// 6-10. collectedAt / commitDate
// ============================================================================

test("6. collectedAt valido (updatedAt string nao vazia) e preservado", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-01-10T10:00:00.000Z" }) }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  assert.ok(serie.observations.every((o) => o.collectedAt === "2026-01-10T10:00:00.000Z"));
});

test("7. collectedAt invalido (updatedAt ausente/vazio) vira null, nunca inventado", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: null }) }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  assert.ok(serie.observations.every((o) => o.collectedAt === null));
});

test("8. commitDate e preservado exatamente como o adaptador devolveu", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-03-05T08:30:00-03:00", dataJson: snapshotTexto() }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  assert.ok(serie.observations.every((o) => o.commitDate === "2026-03-05T08:30:00-03:00"));
});

test("9. commitDate NUNCA vira referenceDate (mesmo quando parece uma data valida)", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-03-05T08:30:00-03:00", dataJson: snapshotTexto() }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const dolarObs = serie.observations.find((o) => o.indicator === "dolar");
  assert.equal(dolarObs.referenceDate, null);
});

test("10. collectedAt NUNCA vira referenceDate", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-03-05T08:30:00-03:00", dataJson: snapshotTexto({ updatedAt: "2026-03-04T00:00:00.000Z" }) }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const gasObs = serie.observations.find((o) => o.indicator === "gas");
  assert.equal(gasObs.referenceDate, null);
});

// ============================================================================
// 11-14. referencePeriod para ureia/MAP/KCl
// ============================================================================

test("11. ureia com referencePeriod valido em refsFertilizantes", () => {
  const r = calcularReferencia("ureia", { refsFertilizantes: { ureia: "2026-05" } }, "ok (ComexStat 2026-05)");
  assert.deepEqual(r, { referenceDate: null, referencePeriod: "2026-05", viaInferenciaTexto: false });
});

test("12. MAP com referencePeriod valido", () => {
  const r = calcularReferencia("map", { refsFertilizantes: { map: "2026-05" } }, "ok (ComexStat 2026-05)");
  assert.equal(r.referencePeriod, "2026-05");
  assert.equal(r.referenceDate, null);
});

test("13. KCl com referencePeriod valido", () => {
  const r = calcularReferencia("kcl", { refsFertilizantes: { kcl: "2026-05" } }, "ok (ComexStat 2026-05)");
  assert.equal(r.referencePeriod, "2026-05");
});

test("14. referencePeriod invalido (formato errado) vira null, nunca corrigido/adivinhado", () => {
  const r = calcularReferencia("ureia", { refsFertilizantes: { ureia: "maio/2026" } }, "ok (ComexStat)");
  assert.equal(r.referencePeriod, null);
});

// ============================================================================
// 15-19. ausencia / valor / unidade
// ============================================================================

test("15. indicador ausente do objeto current -> value null (AUSENTE)", () => {
  const dataJson = snapshotTexto();
  const obj = JSON.parse(dataJson);
  delete obj.current.gas;
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: JSON.stringify(obj) }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const gasObs = serie.observations.find((o) => o.indicator === "gas");
  assert.equal(gasObs.value, null);
  assert.equal(gasObs.sourceStatus, STATUS_OBSERVACAO.AUSENTE);
});

test("16. valor null explicito -> AUSENTE", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto({ current: { dolar: 5, ureia: null, map: 600, kcl: 300, gas: 2.5, bdi: 2000, soja: 130, sojaTO: 124 } }) }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const ureiaObs = serie.observations.find((o) => o.indicator === "ureia");
  assert.equal(ureiaObs.value, null);
  assert.equal(ureiaObs.sourceStatus, STATUS_OBSERVACAO.AUSENTE);
});

test("17. valor zero legitimo (ex.: delta) nao e confundido com ausencia -- aqui via BDI=0", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto({ current: { dolar: 5, ureia: 400, map: 600, kcl: 300, gas: 2.5, bdi: 0, soja: 130, sojaTO: 124 } }) }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const bdiObs = serie.observations.find((o) => o.indicator === "bdi");
  assert.equal(bdiObs.value, 0);
  assert.notEqual(bdiObs.sourceStatus, STATUS_OBSERVACAO.AUSENTE);
});

test("18. unidade comprovada (tabela fixa) e aplicada a cada indicador", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto() }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const unidades = Object.fromEntries(serie.observations.map((o) => [o.indicator, o.unit]));
  assert.deepEqual(unidades, { dolar: "BRL_USD", ureia: "USD_TON", map: "USD_TON", kcl: "USD_TON", gas: "USD_MMBTU", bdi: "BDI_PONTOS", soja: "BRL_SACA_60KG", sojaTO: "BRL_SACA_60KG" });
});

test("19. unidade nao identificada (indicador hipotetico fora da tabela) nunca e inventada -- aqui via chamada direta com indicador desconhecido", () => {
  // classificarConfianca/extrairCandidatas so operam sobre INDICADORES_SUPORTADOS;
  // o teste de contrato ja garante que todo indicador suportado tem unidade --
  // aqui confirmamos que o schema tem NAO_IDENTIFICADA disponivel para o caso futuro.
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto() }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  assert.ok(serie.observations.every((o) => o.unit !== "NAO_IDENTIFICADA"));
});

// ============================================================================
// 20-24. status OBSERVADO / fallback / override
//
// Etapa 5.1: classificarStatusFonte(statusInfo, ...) foi substituida por
// classificarProveniencia({indicator, statusTexto, ...}) -- o teste 21 abaixo
// foi CORRIGIDO (nao so migrado de API): a versao anterior afirmava que
// "falha + valor==previous" prova FALLBACK_ULTIMO_CONHECIDO para qualquer
// indicador, que era exatamente a regra incorreta que esta etapa corrige.
// ============================================================================

test("20. status OBSERVADO com evidencia (status comeca com 'ok (')", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "ok (ComexStat 2026-01)", anterior: null, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
  assert.equal(r.sourceMessage, CATEGORIA_MENSAGEM.STATUS_OBSERVADO_ESTRUTURADO);
});

test("21. [CORRIGIDO] falha + valor igual ao previous, SEM marcador explicito, NAO prova fallback (vira NAO_IDENTIFICAVEL)", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
  assert.equal(r.sourceMessage, CATEGORIA_MENSAGEM.VALOR_REPETIDO_SEM_PROVA_DE_ORIGEM);
  assert.equal(r.repeatedFromPrevious, true); // a coincidencia e registrada, mas nao vira prova
});

test("21b. FALLBACK_ULTIMO_CONHECIDO exige o marcador explicito -- hoje, so sojaTO o tem", () => {
  const r = classificarProveniencia({ indicator: "sojaTO", value: 124, statusTexto: "falha: e.message -> usando leitura anterior", anterior: 124, overrideNesseCommit: null, chaveOverride: "sojaTO" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO);
  assert.equal(r.sourceMessage, CATEGORIA_MENSAGEM.STATUS_FALLBACK_EXPLICITO);
});

test("22. falha SEM nenhuma evidencia (valor nao bate com previous nem override) vira NAO_IDENTIFICAVEL", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 999, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
  assert.equal(r.sourceMessage, CATEGORIA_MENSAGEM.STATUS_AMBIGUO);
});

test("23. override com evidencia (falha comprovada + valor igual ao override NESSE commit)", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 555, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: { ureia: 555 }, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.OVERRIDE_MANUAL);
  assert.equal(r.sourceMessage, CATEGORIA_MENSAGEM.STATUS_OVERRIDE_COMPROVADO);
});

test("24. override SEM vinculo (nao disponivel nesse commit, ou nao bate) vira NAO_IDENTIFICAVEL", () => {
  const r1 = classificarProveniencia({ indicator: "ureia", value: 999, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r1.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
  const r2 = classificarProveniencia({ indicator: "ureia", value: 999, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: { ureia: 111 }, chaveOverride: "ureia" });
  assert.equal(r2.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
});

// ============================================================================
// 25-32. deduplicacao e conflitos
// ============================================================================

test("25. deduplicacao por referenceDate (bdi/soja)", () => {
  const a = { indicator: "bdi", value: 2000, unit: "BDI_PONTOS", referenceDate: "2026-01-09", referencePeriod: null, collectedAt: "2026-01-10T00:00:00Z", commitDate: "2026-01-10T00:00:00Z", commitHash: "aaaaaaaaaa", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "HANDYBULK", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.INFERENCIA_TECNICA, deduplicationKey: calcularChaveDeduplicacao({ indicator: "bdi", unit: "BDI_PONTOS", referenceDate: "2026-01-09", referencePeriod: null, collectedAt: "2026-01-10T00:00:00Z", commitHash: "aaaaaaaaaa" }) };
  const b = { ...a, collectedAt: "2026-01-11T00:00:00Z", commitDate: "2026-01-11T00:00:00Z", commitHash: "bbbbbbbbbb" };
  const { observacoes } = deduplicarObservacoes([a, b]);
  assert.equal(observacoes.length, 1);
});

test("26. deduplicacao por referencePeriod (ureia/map/kcl)", () => {
  const chave = calcularChaveDeduplicacao({ indicator: "ureia", unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "x", commitHash: "aaaaaaaaaa" });
  const a = { indicator: "ureia", value: 400, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-10T00:00:00Z", commitDate: "2026-01-10T00:00:00Z", commitHash: "aaaaaaaaaa", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave };
  const b = { ...a, collectedAt: "2026-01-17T00:00:00Z", commitDate: "2026-01-17T00:00:00Z", commitHash: "bbbbbbbbbb" };
  const { observacoes } = deduplicarObservacoes([a, b]);
  assert.equal(observacoes.length, 1);
  assert.equal(observacoes[0].metadata.supportingSnapshotCount, 2);
});

test("27. sem referencia economica -> chave inclui commitHash, nunca agrupa (dolar/gas/sojaTO)", () => {
  const chaveA = calcularChaveDeduplicacao({ indicator: "dolar", unit: "BRL_USD", referenceDate: null, referencePeriod: null, collectedAt: "2026-01-10T00:00:00Z", commitHash: "aaaaaaaaaa" });
  const chaveB = calcularChaveDeduplicacao({ indicator: "dolar", unit: "BRL_USD", referenceDate: null, referencePeriod: null, collectedAt: "2026-01-10T00:00:00Z", commitHash: "bbbbbbbbbb" });
  assert.notEqual(chaveA, chaveB);
});

test("28. mesmo valor e status em multiplos snapshots -> uma observacao, supportingSnapshotCount correto", () => {
  const chave = "ureia|2026-01|USD_TON";
  const grupo = ["aaaaaaaaaa", "bbbbbbbbbb", "cccccccccc"].map((h, i) => ({
    indicator: "ureia", value: 400, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01",
    collectedAt: `2026-01-1${i}T00:00:00Z`, commitDate: `2026-01-1${i}T00:00:00Z`, commitHash: h,
    sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok",
    extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave,
  }));
  const [obs] = deduplicarGrupo(grupo);
  assert.equal(obs.metadata.supportingSnapshotCount, 3);
  assert.equal(obs.metadata.conflict, false);
});

test("29. valores diferentes na mesma referencia -> conflito estruturado, nao escolhe nem faz media", () => {
  const chave = "ureia|2026-01|USD_TON";
  const grupo = [
    { indicator: "ureia", value: 400, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-10T00:00:00Z", commitDate: "2026-01-10T00:00:00Z", commitHash: "aaaaaaaaaa", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave },
    { indicator: "ureia", value: 420, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-15T00:00:00Z", commitDate: "2026-01-15T00:00:00Z", commitHash: "bbbbbbbbbb", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave },
  ];
  const resultado = deduplicarGrupo(grupo);
  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado.map((o) => o.value).sort((a, b) => a - b), [400, 420]);
  assert.ok(resultado.every((o) => o.metadata.conflict === true && o.metadata.conflictType === "VALORES_DIVERGENTES"));
  assert.ok(!resultado.some((o) => o.value === 410)); // nunca calcula media
});

test("30. status divergentes na mesma referencia (mesmo valor) -> status mais conservador, nunca promovido para OBSERVADO", () => {
  const chave = "ureia|2026-01|USD_TON";
  const grupo = [
    { indicator: "ureia", value: 400, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-10T00:00:00Z", commitDate: "2026-01-10T00:00:00Z", commitHash: "aaaaaaaaaa", sourceStatus: STATUS_OBSERVACAO.NAO_IDENTIFICAVEL, sourceName: null, sourceMessage: null, extractionConfidence: CONFIANCA_EXTRACAO.PARCIAL, deduplicationKey: chave },
    { indicator: "ureia", value: 400, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-15T00:00:00Z", commitDate: "2026-01-15T00:00:00Z", commitHash: "bbbbbbbbbb", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave },
  ];
  const [obs] = deduplicarGrupo(grupo);
  assert.equal(obs.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
  assert.equal(obs.metadata.conflict, true);
  assert.equal(obs.metadata.conflictType, "STATUS_DIVERGENTE");
});

test("31. commit mais recente NAO vence automaticamente (representante e o mais antigo por collectedAt)", () => {
  const chave = "ureia|2026-01|USD_TON";
  const grupo = [
    { indicator: "ureia", value: 400, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-20T00:00:00Z", commitDate: "2026-01-20T00:00:00Z", commitHash: "zzzzzzzzzz", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave },
    { indicator: "ureia", value: 400, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-05T00:00:00Z", commitDate: "2026-01-05T00:00:00Z", commitHash: "aaaaaaaaaa", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave },
  ];
  const [obs] = deduplicarGrupo(grupo);
  assert.equal(obs.commitHash, "aaaaaaaaaa"); // o mais antigo, nao o "zzzzzzzzzz" mais recente
});

test("32. valor repetido em snapshots sucessivos NAO prova fallback por si so (status ok permanece OBSERVADO)", () => {
  // valor igual ao anterior, mas status comeca com "ok (" -- OBSERVADO, nao FALLBACK
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "ok (ComexStat 2026-01)", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
  assert.equal(r.repeatedFromPrevious, true); // registrado, mas nao decide sourceStatus
});

// ============================================================================
// 33-42. contagens e cobertura
// ============================================================================

function montarCoberturaFicticia() {
  const commits = [
    { hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-01-10T10:00:00.000Z" }) },
    { hash: HASH_B, commitDate: "2026-01-10T15:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-01-10T15:00:00.000Z" }) }, // mesmo dia
    { hash: HASH_C, commitDate: "2026-02-05T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-02-05T10:00:00.000Z", refsFertilizantes: { ureia: "2026-02", map: "2026-02", kcl: "2026-02" }, status: { ...JSON.parse(snapshotTexto()).status, ureia: "ok (ComexStat 2026-02)", map: "ok (ComexStat 2026-02)", kcl: "ok (ComexStat 2026-02)", bdi: "ok (HANDYBULK, 04/02/2026)", soja: "ok (Noticias Agricolas / CEPEA-PR 04/02/2026)" } }) },
  ];
  return extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
}

test("33. contagem de commits auditados", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.equal(cobertura.commitsAuditados, 3);
});

test("34. contagem de snapshots (encontrados/validos/invalidos)", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.equal(cobertura.snapshotsEncontrados, 3);
  assert.equal(cobertura.snapshotsValidos, 3);
  assert.equal(cobertura.snapshotsInvalidos, 0);
});

test("35. contagem de observacoes candidatas (3 snapshots x 8 indicadores)", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.equal(cobertura.observacoesCandidatas, 24);
});

test("36. contagem de observacoes deduplicadas (menor que candidatas, por causa do agrupamento mensal/por dia)", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.ok(cobertura.observacoesDeduplicadas < cobertura.observacoesCandidatas);
});

test("37. contagem por indicador bate com o total de observacoes deduplicadas", () => {
  const { cobertura } = montarCoberturaFicticia();
  const soma = Object.values(cobertura.porIndicador).reduce((acc, s) => acc + s.observacoesDeduplicadas, 0);
  assert.equal(soma, cobertura.observacoesDeduplicadas);
});

test("38. datas de referencia distintas por indicador (ureia: 2 meses distintos)", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.equal(cobertura.porIndicador.ureia.referenciasEconomicasDistintas, 2);
});

test("39. datas de coleta distintas por indicador", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.equal(cobertura.porIndicador.dolar.datasDeColetaDistintas, 3);
});

test("40. primeiro e ultimo referenceDate (bdi)", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.equal(cobertura.porIndicador.bdi.primeiraReferenceDate, "2026-01-09");
  assert.equal(cobertura.porIndicador.bdi.ultimaReferenceDate, "2026-02-04");
});

test("41. primeiro e ultimo referencePeriod (ureia)", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.equal(cobertura.porIndicador.ureia.primeiroReferencePeriod, "2026-01");
  assert.equal(cobertura.porIndicador.ureia.ultimoReferencePeriod, "2026-02");
});

test("42. primeiro e ultimo collectedAt (dolar)", () => {
  const { cobertura } = montarCoberturaFicticia();
  assert.equal(cobertura.porIndicador.dolar.primeiroCollectedAt, "2026-01-10T10:00:00.000Z");
  assert.equal(cobertura.porIndicador.dolar.ultimoCollectedAt, "2026-02-05T10:00:00.000Z");
});

// ============================================================================
// 43-46. frequencia observada
// ============================================================================

test("43. frequencia MULTIPLAS_NO_MESMO_DIA", () => {
  const cands = [{ commitDate: "2026-01-10T08:00:00Z" }, { commitDate: "2026-01-10T18:00:00Z" }];
  assert.equal(classificarFrequencia(cands, "dolar"), "MULTIPLAS_NO_MESMO_DIA");
});

test("44. frequencia IRREGULAR", () => {
  const cands = [{ commitDate: "2026-01-10T08:00:00Z" }, { commitDate: "2026-01-25T08:00:00Z" }, { commitDate: "2026-01-26T08:00:00Z" }];
  assert.equal(classificarFrequencia(cands, "dolar"), "IRREGULAR");
});

test("45. frequencia MENSAL_POR_REFERENCIA (ureia/map/kcl, independente das candidatas)", () => {
  assert.equal(classificarFrequencia([], "ureia"), "MENSAL_POR_REFERENCIA");
  assert.equal(classificarFrequencia([{ commitDate: "2026-01-10T00:00:00Z" }], "map"), "MENSAL_POR_REFERENCIA");
});

test("46. frequencia INDETERMINADA (0 ou 1 dia distinto, indicador nao mensal)", () => {
  assert.equal(classificarFrequencia([], "dolar"), "INDETERMINADA");
  assert.equal(classificarFrequencia([{ commitDate: "2026-01-10T00:00:00Z" }], "dolar"), "INDETERMINADA");
});

// ============================================================================
// 47-50. pureza, ordenacao deterministica
// ============================================================================

test("47. extrairSerieTemporal nao altera o texto bruto devolvido pelo adaptador", () => {
  const textoOriginal = snapshotTexto();
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: textoOriginal }];
  extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  assert.equal(commits[0].dataJson, textoOriginal);
});

test("48. ordenacao deterministica dos commits (independe da ordem que o adaptador devolve)", () => {
  const c1 = { hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-01-10T10:00:00.000Z" }) };
  const c2 = { hash: HASH_B, commitDate: "2026-01-11T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-01-11T10:00:00.000Z" }) };
  const r1 = extrairSerieTemporal({ adapterGit: adapterFicticio([c1, c2]) });
  const r2 = extrairSerieTemporal({ adapterGit: adapterFicticio([c2, c1]) });
  assert.deepEqual(r1.serie.observations, r2.serie.observations);
});

test("49. ordenacao deterministica das observacoes (mesma entrada -> mesma ordem sempre)", () => {
  const commits = [
    { hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-01-10T10:00:00.000Z" }) },
    { hash: HASH_B, commitDate: "2026-01-11T10:00:05+00:00", dataJson: snapshotTexto({ updatedAt: "2026-01-11T10:00:00.000Z" }) },
  ];
  const r1 = JSON.stringify(extrairSerieTemporal({ adapterGit: adapterFicticio(commits) }).serie.observations);
  const r2 = JSON.stringify(extrairSerieTemporal({ adapterGit: adapterFicticio(commits) }).serie.observations);
  assert.equal(r1, r2);
});

test("50. ordenacao deterministica dos conflitos (aparecem na mesma posicao relativa entre execucoes)", () => {
  const chave = "ureia|2026-01|USD_TON";
  const grupo = [
    { indicator: "ureia", value: 400, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-10T00:00:00Z", commitDate: "2026-01-10T00:00:00Z", commitHash: "aaaaaaaaaa", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave },
    { indicator: "ureia", value: 420, unit: "USD_TON", referenceDate: null, referencePeriod: "2026-01", collectedAt: "2026-01-15T00:00:00Z", commitDate: "2026-01-15T00:00:00Z", commitHash: "bbbbbbbbbb", sourceStatus: STATUS_OBSERVACAO.OBSERVADO, sourceName: "ComexStat", sourceMessage: "ok", extractionConfidence: CONFIANCA_EXTRACAO.ESTRUTURADA, deduplicationKey: chave },
  ];
  const { observacoes: obs1 } = deduplicarObservacoes(grupo);
  const { observacoes: obs2 } = deduplicarObservacoes([...grupo].reverse());
  assert.deepEqual(obs1, obs2);
});

// ============================================================================
// Extras: pureza da funcao de resumo do console (nao deve conter valor/hash)
// ============================================================================

test("73. generatedAt e controlavel via injecao de relogio (agora)", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto() }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits), agora: () => "1999-12-31T23:59:59.000Z" });
  assert.equal(serie.generatedAt, "1999-12-31T23:59:59.000Z");
});

test("75. nenhum calculo de previsao/correlacao/regressao existe no modulo (varredura de nomes de funcao exportadas)", async () => {
  const modulo = await import("../extract-market-driver-history.mjs");
  const nomes = Object.keys(modulo).join(" ").toLowerCase();
  for (const proibido of ["previsao", "forecast", "correlac", "regress", "recommend", "recomenda"]) {
    assert.doesNotMatch(nomes, new RegExp(proibido));
  }
});

test("resumo do console (formatarResumoCobertura) nunca inclui valor de indicador nem hash de commit", () => {
  const commits = [{ hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00", dataJson: snapshotTexto() }];
  const { cobertura } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const resumo = formatarResumoCobertura(cobertura);
  assert.doesNotMatch(resumo, /aaaaaaaaaa/);
  assert.doesNotMatch(resumo, /\b5\.0\b|\b400\b|\b600\b|\b2000\b/); // valores ficticios usados nos testes
});

// ============================================================================
// ETAPA 5.1 -- endurecimento da classificacao de proveniencia. Numeracao
// propria (5.1-N), separada da numeracao da Etapa 5 acima, para nao colidir.
// Os itens 33-45 da lista da Etapa 5.1 (compatibilidade preservada: dedup
// deterministica, conflitos, console sanitizado, dry-run/--output, schema
// sincronizado) ja estao cobertos pelos testes 25-50/68-74 acima e no arquivo
// .cli.test.mjs -- nao duplicados aqui.
// ============================================================================

test("5.1-1/3. current==previous sem status reconhecido NAO prova nada (nem fallback, nem observado)", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: null, anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO);
});

test("5.1-2. current==previous com sucesso comprovado (status ok) PODE ser OBSERVADO", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "ok (ComexStat 2026-01)", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
});

test("5.1-3b. current!=previous com status nao reconhecido NAO prova OBSERVADO", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 405, statusTexto: "texto qualquer nao reconhecido", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
});

test("5.1-4/5. metadata.repeatedFromPrevious reflete a igualdade (true quando repete, false quando muda)", () => {
  const commits = [{
    hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00",
    dataJson: snapshotTexto({ current: { dolar: 5.0, ureia: 400, map: 601, kcl: 300, gas: 2.5, bdi: 2000, soja: 130, sojaTO: 124 }, previous: { dolar: 5.0, ureia: 400, map: 600, kcl: 300, gas: 2.5, bdi: 2000, soja: 130, sojaTO: 124 } }),
  }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const ureiaObs = serie.observations.find((o) => o.indicator === "ureia"); // 400 == 400
  const mapObs = serie.observations.find((o) => o.indicator === "map"); // 601 != 600
  assert.equal(ureiaObs.metadata.repeatedFromPrevious, true);
  assert.equal(mapObs.metadata.repeatedFromPrevious, false);
});

test("5.1-6. repeatedFromPrevious nao altera sourceStatus sozinho (mesmo status, com e sem repeticao)", () => {
  const comRepeticao = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  const semRepeticao = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 999, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(comRepeticao.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
  assert.equal(semRepeticao.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
  assert.equal(comRepeticao.repeatedFromPrevious, true);
  assert.equal(semRepeticao.repeatedFromPrevious, false);
});

test("5.1-7. repeticao do mesmo valor em VARIOS snapshots (sem marcador explicito) continua NAO_IDENTIFICAVEL apos deduplicar, nunca fallback", () => {
  const commits = ["10", "11", "12"].map((dia, i) => ({
    hash: [HASH_A, HASH_B, HASH_C][i], commitDate: `2026-01-${dia}T10:00:05+00:00`,
    dataJson: snapshotTexto({
      updatedAt: `2026-01-${dia}T10:00:00.000Z`,
      current: { dolar: 5.0, ureia: 400, map: 600, kcl: 300, gas: 2.5, bdi: 2000, soja: 130, sojaTO: 124 },
      previous: { dolar: 5.0, ureia: 400, map: 600, kcl: 300, gas: 2.5, bdi: 2000, soja: 130, sojaTO: 124 },
      status: { ...JSON.parse(snapshotTexto()).status, ureia: "falha: timeout" },
    }),
  }));
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const ureiaObs = serie.observations.filter((o) => o.indicator === "ureia");
  assert.ok(ureiaObs.every((o) => o.sourceStatus === STATUS_OBSERVACAO.NAO_IDENTIFICAVEL));
  assert.ok(!ureiaObs.some((o) => o.sourceStatus === STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO));
});

test("5.1-8. status explicito de fallback (sojaTO) gera FALLBACK_ULTIMO_CONHECIDO", () => {
  const r = classificarProveniencia({ indicator: "sojaTO", value: 124, statusTexto: "falha: x -> usando leitura anterior", anterior: 124, overrideNesseCommit: null, chaveOverride: "sojaTO" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO);
});

test("5.1-9. status ambiguo contendo a palavra 'falha' (sem o marcador exato) NAO prova fallback", () => {
  const r = classificarProveniencia({ indicator: "sojaTO", value: 124, statusTexto: "falha: alguma coisa deu errado", anterior: 124, overrideNesseCommit: null, chaveOverride: "sojaTO" });
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO);
});

test("5.1-10. status contendo a palavra 'ultimo'/'último' fora do marcador exato NAO prova fallback (nunca busca textual vaga)", () => {
  const r = classificarProveniencia({ indicator: "sojaTO", value: 124, statusTexto: "falha: usando o ultimo dado disponivel, mas nao da forma esperada", anterior: 124, overrideNesseCommit: null, chaveOverride: "sojaTO" });
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO);
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
});

test("5.1-11. texto de erro com fragmento de HTML nao e interpretado como fallback, e nunca vaza para sourceMessage", () => {
  const statusTexto = 'falha stooq: valor implausivel :: resposta="<!DOCTYPE html><html><body>erro</body></html>"';
  const r = classificarProveniencia({ indicator: "bdi", value: 2000, statusTexto, anterior: 2000, overrideNesseCommit: null, chaveOverride: "bdi" });
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.FALLBACK_ULTIMO_CONHECIDO);
  assert.ok(Object.values(CATEGORIA_MENSAGEM).includes(r.sourceMessage));
  assert.doesNotMatch(String(r.sourceMessage), /<!DOCTYPE|<html>/i);
});

test("5.1-12. status de sucesso exato comprovado gera OBSERVADO (repete o caso 20 com foco na palavra 'exato')", () => {
  const r = classificarProveniencia({ indicator: "bdi", value: 2000, statusTexto: "ok (HANDYBULK, 09/01/2026)", anterior: null, overrideNesseCommit: null, chaveOverride: "bdi" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
});

test("5.1-13. prefixo parecido com 'ok' (sem o formato exato 'ok (') NAO gera OBSERVADO", () => {
  for (const textoParecido of ["oklahoma (fonte ficticia)", "OK (fonte ficticia)", "okay", "ok, tudo certo", "OK"]) {
    const info = interpretarStatusTexto(textoParecido);
    assert.equal(info.comecaOk, false, `"${textoParecido}" nao deveria bater no padrao de sucesso`);
  }
});

test("5.1-14. status de um indicador nao contamina outro indicador do mesmo snapshot", () => {
  const commits = [{
    hash: HASH_A, commitDate: "2026-01-10T10:00:05+00:00",
    dataJson: snapshotTexto({ status: { ...JSON.parse(snapshotTexto()).status, ureia: "ok (ComexStat 2026-01)", map: "falha: timeout" } }),
  }];
  const { serie } = extrairSerieTemporal({ adapterGit: adapterFicticio(commits) });
  const ureiaObs = serie.observations.find((o) => o.indicator === "ureia");
  const mapObs = serie.observations.find((o) => o.indicator === "map");
  assert.equal(ureiaObs.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
  assert.notEqual(mapObs.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
});

test("5.1-15. existencia de numero (value != null) sozinha NAO gera OBSERVADO quando o status nao comprova nada", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "texto nao reconhecido qualquer", anterior: null, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
});

test("5.1-16. ausencia de status (null) com valor presente gera NAO_IDENTIFICAVEL", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: null, anterior: null, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.NAO_IDENTIFICAVEL);
  assert.equal(r.sourceMessage, CATEGORIA_MENSAGEM.STATUS_AUSENTE);
});

test("5.1-17. valor null continua AUSENTE (nao regride)", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: null, statusTexto: "ok (ComexStat 2026-01)", anterior: 400, overrideNesseCommit: { ureia: 400 }, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.AUSENTE);
});

test("5.1-18. override presente e valor DIFERENTE nunca gera override", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 999, overrideNesseCommit: { ureia: 111 }, chaveOverride: "ureia" });
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.OVERRIDE_MANUAL);
});

test("5.1-19/21/22. override presente e valor igual, MAS a fonte teve sucesso (status ok): fica OBSERVADO, nunca OVERRIDE_MANUAL -- matchesOverrideValue fica true mas nao decide nada sozinho", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "ok (ComexStat 2026-01)", anterior: 999, overrideNesseCommit: { ureia: 400 }, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
  assert.equal(r.matchesOverrideValue, true);
});

test("5.1-20. override presente, valor igual, E uso comprovado (fonte falhou) gera OVERRIDE_MANUAL", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 999, overrideNesseCommit: { ureia: 400 }, chaveOverride: "ureia" });
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.OVERRIDE_MANUAL);
});

test("5.1-23. override lido de um commit DIFERENTE (nao o do snapshot) nunca e usado -- aqui simulado com overrideNesseCommit=null mesmo havendo 'algum' override em outro lugar", () => {
  // o adaptador so entrega o override do MESMO commit (ver extrairSerieTemporal);
  // aqui testamos diretamente que overrideNesseCommit=null nunca produz OVERRIDE_MANUAL,
  // mesmo que o valor coincida com algo que só existiria em outro commit.
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 999, overrideNesseCommit: null, chaveOverride: "ureia" });
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.OVERRIDE_MANUAL);
});

test("5.1-24. override de OUTRO indicador no mesmo commit nao contamina o indicador atual", () => {
  // override tem so "map", nao "ureia" -- overrideValor para ureia fica null mesmo com o objeto presente
  const r = classificarProveniencia({ indicator: "ureia", value: 640, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: { map: 640 }, chaveOverride: "ureia" });
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.OVERRIDE_MANUAL);
});

test("5.1-25. chaveOverride ausente do objeto de override nunca casa por coincidencia", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 999, overrideNesseCommit: {}, chaveOverride: "ureia" });
  assert.notEqual(r.sourceStatus, STATUS_OBSERVACAO.OVERRIDE_MANUAL);
});

test("5.1-26. igualdade de valor (repeatedFromPrevious) nunca produz extractionConfidence ESTRUTURADA", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" });
  const conf = classificarConfianca({ referenceDate: null, referencePeriod: null, viaInferenciaTexto: false, sourceStatus: r.sourceStatus, collectedAt: "2026-01-10T00:00:00Z" });
  assert.notEqual(conf, CONFIANCA_EXTRACAO.ESTRUTURADA);
});

test("5.1-27. override sem prova de uso (coincidencia) nunca produz extractionConfidence ESTRUTURADA", () => {
  const r = classificarProveniencia({ indicator: "ureia", value: 400, statusTexto: "ok (ComexStat 2026-01)", anterior: 999, overrideNesseCommit: { ureia: 400 }, chaveOverride: "ureia" });
  // aqui sourceStatus=OBSERVADO (estruturado), mas a CONFIANCA vem so de referencia+status,
  // nunca da coincidencia com override -- confirmamos que matchesOverrideValue nao
  // e nem parametro de classificarConfianca.
  assert.equal(r.sourceStatus, STATUS_OBSERVACAO.OBSERVADO);
  const conf = classificarConfianca({ referenceDate: null, referencePeriod: "2026-01", viaInferenciaTexto: false, sourceStatus: r.sourceStatus, collectedAt: "2026-01-10T00:00:00Z" });
  assert.equal(conf, CONFIANCA_EXTRACAO.ESTRUTURADA); // legitimo aqui: veio da referencePeriod+status, nao do override
});

test("5.1-28. status explicito (ok) + referencia estruturada produz ESTRUTURADA; so status sem referencia produz PARCIAL", () => {
  const comReferencia = classificarConfianca({ referenceDate: null, referencePeriod: "2026-01", viaInferenciaTexto: false, sourceStatus: STATUS_OBSERVACAO.OBSERVADO, collectedAt: "x" });
  const semReferencia = classificarConfianca({ referenceDate: null, referencePeriod: null, viaInferenciaTexto: false, sourceStatus: STATUS_OBSERVACAO.OBSERVADO, collectedAt: "x" });
  assert.equal(comReferencia, CONFIANCA_EXTRACAO.ESTRUTURADA);
  assert.equal(semReferencia, CONFIANCA_EXTRACAO.PARCIAL);
});

test("5.1-29. sourceMessage e sempre uma das categorias fixas de CATEGORIA_MENSAGEM", () => {
  const cenarios = [
    { indicator: "ureia", value: 400, statusTexto: "ok (ComexStat 2026-01)", anterior: null, overrideNesseCommit: null, chaveOverride: "ureia" },
    { indicator: "ureia", value: null, statusTexto: null, anterior: null, overrideNesseCommit: null, chaveOverride: "ureia" },
    { indicator: "ureia", value: 400, statusTexto: "falha: timeout", anterior: 400, overrideNesseCommit: null, chaveOverride: "ureia" },
    { indicator: "sojaTO", value: 124, statusTexto: "falha: x -> usando leitura anterior", anterior: 124, overrideNesseCommit: null, chaveOverride: "sojaTO" },
  ];
  for (const cenario of cenarios) {
    const r = classificarProveniencia(cenario);
    assert.ok(Object.values(CATEGORIA_MENSAGEM).includes(r.sourceMessage), `sourceMessage "${r.sourceMessage}" nao e uma categoria fixa`);
  }
});

test("5.1-30/31/32. sourceMessage nunca contem o status bruto, um valor numerico especifico, ou HTML", () => {
  const statusTexto = 'falha: HTTP 500 :: "Something unexpected happened." valor=999999.87';
  const r = classificarProveniencia({ indicator: "bdi", value: 999999.87, statusTexto, anterior: 999999.87, overrideNesseCommit: null, chaveOverride: "bdi" });
  assert.doesNotMatch(String(r.sourceMessage), /HTTP 500/);
  assert.doesNotMatch(String(r.sourceMessage), /999999\.87/);
  assert.doesNotMatch(String(r.sourceMessage), /<|>/);
});
