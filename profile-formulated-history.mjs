/**
 * profile-formulated-history.mjs — CLI: roda a analise exploratoria/de qualidade
 * (formulated-history-profile.mjs) sobre uma base PRIVADA de historico de precos de
 * fertilizantes formulados.
 *
 * Uso:
 *   node profile-formulated-history.mjs caminho/base.private.json
 *   node profile-formulated-history.mjs caminho/base.private.json --output caminho/relatorio.profile.private.json
 *   npm run profile:formulated-history -- caminho/base.private.json [--output ...]
 *
 * Caminho de entrada e SEMPRE explicito (argv), resolvido a partir de process.cwd().
 * Este script NUNCA procura um arquivo privado sozinho, NUNCA cai de volta na base
 * publica, e recusa tanto a base publica conhecida quanto qualquer caminho que nao
 * termine em ".private.json" -- reusando validarCaminhoSaida() de
 * import-formulated-history.mjs (mesma regra ja usada para saida la, aqui aplicada
 * a entrada) em vez de duplicar a checagem.
 *
 * SEGURANCA / CONSOLE: o resumo impresso aqui NUNCA mostra produto, formula,
 * fornecedor, preco, volume, destino, prazo ou observacoes -- so contagens, datas,
 * percentuais, contagem por tipo de alerta e ids anonimizados de serie (serie-NNN).
 * Nao imprime recordId individual no resumo padrao (so contagens).
 *
 * O objeto retornado por perfilarBase() PODE conter produto/formula/destino (em
 * series[].criterios) e as estatisticas de preco agregadas por serie -- isso e
 * intencional, para uso exclusivo no relatorio PRIVADO opcional (--output), nunca
 * impresso no console. Ver README secao 12 e o cabecalho de
 * formulated-history-profile.mjs.
 *
 * NAO faz: indice de pressao de materias-primas, cruzamento com data.json/ureia/
 * MAP/KCl, preco "corrigido", estimativa de preco atual, regressao, machine
 * learning, previsao, faixa de negociacao, recomendacao de compra, custo industrial
 * nem custo por hectare -- so descreve o que ja esta na base (ver
 * formulated-history-profile.mjs).
 *
 * Nao e chamado por run-weekly.mjs nem por nenhum script da esteira semanal.
 */
import { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { dirname, basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAndValidateHistoryFile, readHistoryFile } from "./formulated-price-history.mjs";
import { validarCaminhoSaida } from "./import-formulated-history.mjs";
import { perfilarBase, SCHEMA_VERSION_PROFILE } from "./formulated-history-profile.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CAMINHO_TEMPLATES = join(__dirname, "templates");

export const DESCRICAO_RELATORIO =
  "Relatorio PRIVADO de analise exploratoria e de qualidade da base historica de " +
  "precos de fertilizantes formulados. CONFIDENCIAL -- nao commitar, nao publicar, " +
  "nao anexar a e-mail ou canal externo. Analise EXPLORATORIA/DESCRITIVA: nao " +
  "constitui previsao de preco, faixa de negociacao, recomendacao de compra, custo " +
  "industrial, custo por hectare, nem indice de pressao de materias-primas (ureia/ " +
  "MAP/KCl). Nao foi cruzada com data.json. Requer revisao humana antes de qualquer uso.";

/**
 * Regra de caminho para o relatorio de saida (--output): reusa validarCaminhoSaida()
 * (mesma funcao usada pela entrada, e pela saida de import-formulated-history.mjs) e
 * soma a restricao especifica desta etapa -- nunca gravar dentro de templates/.
 */
export function validarCaminhoRelatorio(caminhoAbsoluto) {
  const base = validarCaminhoSaida(caminhoAbsoluto);
  if (!base.ok) return base;
  if (caminhoAbsoluto === CAMINHO_TEMPLATES || caminhoAbsoluto.startsWith(CAMINHO_TEMPLATES + sep)) {
    return { ok: false, motivo: "SAIDA_EM_TEMPLATES", mensagem: "a saida nao pode ficar dentro de templates/" };
  }
  return { ok: true };
}

function relatorioValidoMinimo(obj) {
  return (
    obj != null &&
    typeof obj === "object" &&
    obj.schemaVersion === SCHEMA_VERSION_PROFILE &&
    typeof obj.generatedAt === "string" &&
    typeof obj.description === "string" &&
    obj.source != null &&
    typeof obj.source === "object" &&
    obj.quality != null &&
    typeof obj.quality === "object" &&
    Array.isArray(obj.series) &&
    Array.isArray(obj.alerts)
  );
}

/**
 * Monta o objeto do relatorio privado a partir do resultado de perfilarBase().
 * NUNCA inclui caminho absoluto de entrada, usuario ou informacao de ambiente --
 * so o conteudo derivado da propria base (generatedAt e a unica informacao "externa",
 * e e so um timestamp).
 */
export function montarRelatorio(perfil) {
  return {
    schemaVersion: SCHEMA_VERSION_PROFILE,
    generatedAt: new Date().toISOString(),
    description: DESCRICAO_RELATORIO,
    source: perfil.source,
    quality: perfil.quality,
    countsByFonteRegistro: perfil.countsByFonteRegistro,
    countsByModalidadeEntrega: perfil.countsByModalidadeEntrega,
    unidadesConfirmadas: perfil.unidadesConfirmadas,
    series: perfil.series,
    alerts: perfil.alerts,
  };
}

function carregarRelatorioExistente(caminhoAbsoluto) {
  if (!existsSync(caminhoAbsoluto)) return { existe: false };
  try {
    const bruto = readFileSync(caminhoAbsoluto, "utf-8");
    return { existe: true, valido: relatorioValidoMinimo(JSON.parse(bruto)) };
  } catch {
    return { existe: true, valido: false };
  }
}

/**
 * Escrita atomica do relatorio: grava num temporario no mesmo diretorio, valida a
 * estrutura minima do temporario, e so entao renomeia por cima do destino. Nunca
 * sobrescreve silenciosamente um arquivo de saida existente que nao pareca um
 * relatorio valido deste CLI -- para nesse caso, sem tocar no arquivo existente.
 */
export function escreverRelatorioAtomico(caminhoFinal, relatorio) {
  const existente = carregarRelatorioExistente(caminhoFinal);
  if (existente.existe && !existente.valido) {
    throw new Error(
      "RELATORIO_EXISTENTE_INVALIDO: ja existe um arquivo nesse caminho e ele nao parece um relatorio valido deste CLI -- nada foi sobrescrito"
    );
  }
  const dir = dirname(caminhoFinal);
  mkdirSync(dir, { recursive: true });
  const tmpPath = join(dir, `.${basename(caminhoFinal)}.tmp-${process.pid}-${Date.now()}`);
  try {
    writeFileSync(tmpPath, JSON.stringify(relatorio, null, 2) + "\n", "utf-8");
    const conteudoTmp = JSON.parse(readFileSync(tmpPath, "utf-8"));
    if (!relatorioValidoMinimo(conteudoTmp)) {
      throw new Error("validacao minima do relatorio temporario falhou antes da gravacao final (bug no gerador)");
    }
    renameSync(tmpPath, caminhoFinal);
  } catch (e) {
    try { rmSync(tmpPath, { force: true }); } catch { /* melhor esforco */ }
    throw e;
  }
}

/** Resumo 100% sanitizado: nunca produto/formula/fornecedor/preco/volume/destino/
 *  prazo/observacoes/recordId. So contagens, datas, percentuais e ids de serie. */
export function formatarResumo(perfil) {
  const linhas = [];
  linhas.push(`registros: ${perfil.source.recordCount}`);
  linhas.push(`periodo: ${perfil.source.firstDate ?? "—"} a ${perfil.source.lastDate ?? "—"}`);
  linhas.push(`anos distintos: ${perfil.source.distinctYears.length ? perfil.source.distinctYears.join(", ") : "—"}`);
  linhas.push(`series identificadas: ${perfil.series.length}`);

  linhas.push("cobertura de campos opcionais:");
  for (const [campo, fracao] of Object.entries(perfil.quality.optionalFieldCoverage)) {
    linhas.push(`  - ${campo}: ${(fracao * 100).toFixed(1)}%`);
  }

  linhas.push(`total de alertas: ${perfil.quality.totalAlerts}`);
  for (const tipo of Object.keys(perfil.quality.alertsByType).sort()) {
    linhas.push(`  - ${tipo}: ${perfil.quality.alertsByType[tipo]}`);
  }

  const porClassificacao = {};
  for (const s of perfil.series) porClassificacao[s.classificacaoSuficiencia] = (porClassificacao[s.classificacaoSuficiencia] ?? 0) + 1;
  linhas.push("classificacao de suficiencia das series (contagem, nao e confianca estatistica nem autoriza previsao):");
  for (const classe of Object.keys(porClassificacao).sort()) {
    linhas.push(`  - ${classe}: ${porClassificacao[classe]}`);
  }

  if (!perfil.unidadesConfirmadas.consistente) {
    linhas.push("ATENCAO: mais de uma moeda ou unidade de preco na base -- verifique antes de comparar series entre si.");
  }

  return linhas.join("\n");
}

// ---------------------------------------------------------------------------
// CLI -- so roda quando este arquivo e executado diretamente.
// ---------------------------------------------------------------------------
const executadoDiretamente = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (executadoDiretamente) {
  main();
}

function log(msg) { console.log(`[profile:formulated-history] ${msg}`); }

function main() {
  const argv = process.argv.slice(2);
  const outputIndex = argv.indexOf("--output");
  const outputArg = outputIndex !== -1 ? argv[outputIndex + 1] : null;
  const argsPosicionais = argv.filter((a, i) => !a.startsWith("--") && (outputIndex === -1 || i !== outputIndex + 1));

  const [entradaArg] = argsPosicionais;
  if (!entradaArg) {
    console.error("[profile:formulated-history] uso: node profile-formulated-history.mjs <base.private.json> [--output relatorio.profile.private.json]");
    process.exit(1);
  }
  if (outputIndex !== -1 && !outputArg) {
    console.error("[profile:formulated-history] --output precisa de um caminho de arquivo");
    process.exit(1);
  }

  const caminhoEntrada = resolve(process.cwd(), entradaArg);
  const entradaValida = validarCaminhoSaida(caminhoEntrada);
  if (!entradaValida.ok) {
    log(`entrada rejeitada [${entradaValida.motivo}]: ${entradaValida.mensagem}`);
    process.exit(1);
  }
  log(`entrada: ${caminhoEntrada}`);

  const carregado = loadAndValidateHistoryFile(caminhoEntrada);
  if (!carregado.valid) {
    log(`base invalida (${carregado.errors.length} erro(s)) -- analise abortada, nada foi lido alem da validacao`);
    for (const e of carregado.errors) {
      const local = e.id != null ? `id="${e.id}" (indice ${e.index})` : e.index != null ? `indice ${e.index}` : "raiz";
      const campo = e.field ? `, campo "${e.field}"` : "";
      console.log(`  - [${e.type}] ${local}${campo}: ${e.message}`);
    }
    process.exit(1);
  }

  // loadAndValidateHistoryFile() so confirma validade -- nao devolve os dados (mesmo
  // padrao de carregarSaidaExistente() em import-formulated-history.mjs). Le de novo
  // com readHistoryFile() agora que sabemos que e valido.
  const lido = readHistoryFile(caminhoEntrada);
  const perfil = perfilarBase(lido.data);
  log(`registros carregados: ${carregado.recordCount}`);
  console.log(formatarResumo(perfil));

  if (outputArg) {
    const caminhoSaida = resolve(process.cwd(), outputArg);
    const saidaValida = validarCaminhoRelatorio(caminhoSaida);
    if (!saidaValida.ok) {
      log(`saida do relatorio rejeitada [${saidaValida.motivo}]: ${saidaValida.mensagem}`);
      process.exit(1);
    }
    const relatorio = montarRelatorio(perfil);
    try {
      escreverRelatorioAtomico(caminhoSaida, relatorio);
    } catch (e) {
      log(`falha ao gravar o relatorio: ${e.message}`);
      process.exit(1);
    }
    log(`relatorio privado gravado em ${caminhoSaida}`);
  }

  process.exit(0);
}
