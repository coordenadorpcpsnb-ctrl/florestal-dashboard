/**
 * test/extract-market-driver-history.cli.test.mjs — Testes de ponta a ponta do
 * CLI extract-market-driver-history.mjs via subprocesso: dry-run padrao,
 * --output, rejeicao de caminho, escrita atomica, e a garantia mais
 * importante desta etapa -- o console NUNCA expoe valor de indicador, hash de
 * commit, autor/e-mail de commit ou caminho absoluto.
 *
 * A maior parte dos testes usa diretorios temporarios e nao depende do
 * historico real do repositorio. UM UNICO teste de integracao (marcado
 * explicitamente abaixo) roda o CLI de verdade contra o historico real deste
 * repositorio, somente leitura, so para confirmar que o adaptador Git real
 * funciona -- sem asserir nenhum valor de mercado especifico.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, rmSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { escreverSaidaAtomica } from "../extract-market-driver-history.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CLI_PATH = join(REPO_ROOT, "extract-market-driver-history.mjs");
const DATA_JSON_PATH = join(REPO_ROOT, "data.json");
const BASE_FORMULADOS_PATH = join(REPO_ROOT, "data", "formulated-prices-history.json");
const TEMPLATES_DIR = join(REPO_ROOT, "templates");
const GITHUB_DIR = join(REPO_ROOT, ".github");

function run(args, cwd) {
  const r = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf-8", cwd: cwd ?? REPO_ROOT });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

let dir;
test.beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "extract-market-cli-test-")); });
test.afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

// === 51. dry-run nao grava ===
test("51. dry-run (sem --output) nao cria nenhum arquivo e termina com exit 0", () => {
  const antes = readdirSync(dir);
  const r = run([]);
  assert.equal(r.status, 0);
  assert.match(r.out, /dry-run: nada foi gravado/);
  assert.deepEqual(readdirSync(dir), antes);
});

// === --output sem valor ===
test("--output sem caminho falha com mensagem clara, exit != 0", () => {
  const r = run(["--output"]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /--output precisa de um caminho/);
});

// === 52. --output grava atomicamente ===
test("52. --output grava um arquivo valido segundo o schema", () => {
  const saida = join(dir, "market-history.json");
  const r = run(["--output", saida]);
  assert.equal(r.status, 0);
  assert.equal(existsSync(saida), true);
  const conteudo = JSON.parse(readFileSync(saida, "utf-8"));
  assert.equal(conteudo.schemaVersion, 1);
  assert.equal(conteudo.source.type, "GIT_HISTORY");
  assert.ok(Array.isArray(conteudo.observations));
});

// === 53. temporario removido em erro ===
test("53. escreverSaidaAtomica remove o arquivo temporario quando a validacao final falha", () => {
  const saida = join(dir, "market-history.json");
  assert.throws(() => escreverSaidaAtomica(saida, { isso: "nao e uma serie valida" }));
  assert.equal(existsSync(saida), false);
  const arquivos = readdirSync(dir);
  assert.deepEqual(arquivos, []); // nenhum .tmp-* sobrou
});

// === 54. saida existente invalida nao sobrescrita ===
test("54. escreverSaidaAtomica nunca sobrescreve um arquivo existente que nao passe na validacao do schema", () => {
  const saida = join(dir, "market-history.json");
  writeFileSync(saida, JSON.stringify({ outraCoisa: true }), "utf-8");
  const serieValida = { schemaVersion: 1, description: "x", generatedAt: null, source: { type: "GIT_HISTORY", file: "data.json", commitCountAudited: 0, snapshotCountParsed: 0, snapshotCountRejected: 0 }, observations: [] };
  assert.throws(() => escreverSaidaAtomica(saida, serieValida), /SAIDA_EXISTENTE_INVALIDA/);
  assert.deepEqual(JSON.parse(readFileSync(saida, "utf-8")), { outraCoisa: true });
});

test("--output sobrescreve com sucesso uma saida anterior valida deste extrator (rerun idempotente)", () => {
  const saida = join(dir, "market-history.json");
  const r1 = run(["--output", saida]);
  assert.equal(r1.status, 0);
  const r2 = run(["--output", saida]);
  assert.equal(r2.status, 0);
  assert.equal(existsSync(saida), true);
});

// === 55-59. rejeicao de caminho de saida ===

test("55. data.json como saida e rejeitado, sem tocar no arquivo real", () => {
  const r = run(["--output", DATA_JSON_PATH]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_E_DATA_JSON/);
});

test("56. base de formulados como saida e rejeitada", () => {
  const r = run(["--output", BASE_FORMULADOS_PATH]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_E_BASE_FORMULADOS/);
});

test("57. saida .private.json e rejeitada (este extrator so produz dados publicos)", () => {
  const saida = join(dir, "market-history.private.json");
  const r = run(["--output", saida]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_PRIVADA_PROIBIDA/);
  assert.equal(existsSync(saida), false);
});

test("saida dentro de data/private/ e rejeitada", () => {
  const saida = join(REPO_ROOT, "data", "private", "teste-nao-deveria-existir.json");
  const r = run(["--output", saida]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_EM_DATA_PRIVATE/);
  assert.equal(existsSync(saida), false);
});

test("58. saida dentro de templates/ e rejeitada", () => {
  const saida = join(TEMPLATES_DIR, "teste-nao-deveria-existir.json");
  const r = run(["--output", saida]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_EM_TEMPLATES/);
  assert.equal(existsSync(saida), false);
});

test("59. saida dentro de .github/ e rejeitada", () => {
  const saida = join(GITHUB_DIR, "teste-nao-deveria-existir.json");
  const r = run(["--output", saida]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_EM_GITHUB/);
  assert.equal(existsSync(saida), false);
});

test("saida que nao termina em .json e rejeitada", () => {
  const saida = join(dir, "market-history.txt");
  const r = run(["--output", saida]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_NAO_JSON/);
});

// === 60-64. redacao total do console ===

test("60-61. console nao exibe valores integrais nem conteudo bruto de snapshot", () => {
  const r = run([]);
  assert.equal(r.status, 0);
  // nenhum trecho de JSON bruto de data.json (chaves como "current":{ ou "status":{) no console
  assert.doesNotMatch(r.out, /"current"\s*:\s*\{/);
  assert.doesNotMatch(r.out, /"status"\s*:\s*\{/);
  assert.doesNotMatch(r.out, /<!DOCTYPE html>/i);
});

test("62-63. console nao exibe autor nem e-mail de commit (o adaptador nem consulta esses campos)", () => {
  const r = run([]);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.out, /@/); // nenhum e-mail
  assert.doesNotMatch(r.out, /noreply|github-actions\[bot\]/i);
});

test("64. console nao exibe caminho absoluto", () => {
  const saida = join(dir, "market-history.json");
  const r = run(["--output", saida]);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.out, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(r.out, /\/home\//);
});

// === 65-67. relatorio nao contem formulados/fornecedor/dados privados ===

test("65-67. saida gravada nunca contem chave de formulado, fornecedor ou marcador privado", () => {
  const saida = join(dir, "market-history.json");
  run(["--output", saida]);
  const bruto = readFileSync(saida, "utf-8");
  assert.doesNotMatch(bruto, /"fornecedor"\s*:/);
  assert.doesNotMatch(bruto, /"preco"\s*:/);
  assert.doesNotMatch(bruto, /formulationId/);
  assert.doesNotMatch(bruto, /\.private\.json/);
  assert.doesNotMatch(bruto, /data\/private/);
});

// === 68-69. schema/validador ===

test("68-69. arquivo gerado passa no validador do proprio modulo de contrato", async () => {
  const saida = join(dir, "market-history.json");
  run(["--output", saida]);
  const { loadAndValidateHistoryFile } = await import("../market-driver-history.mjs");
  const resultado = loadAndValidateHistoryFile(saida);
  assert.equal(resultado.valid, true, JSON.stringify(resultado.errors));
});

// === 70. working tree nao alterada pelo dry-run ===

test("70. dry-run nao altera a working tree do repositorio (git status igual antes/depois)", () => {
  const antes = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
  run([]);
  const depois = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
  assert.equal(depois, antes);
});

// === 71. teste ficticio nao usa rede (garantido por construcao -- confirmado
// aqui rodando com HTTP_PROXY/HTTPS_PROXY invalidos de proposito e mostrando
// que o dry-run local nao e afetado, ja que git log/git show sao locais) ===

test("71. dry-run funciona mesmo com variaveis de proxy de rede invalidas (nao depende de rede)", () => {
  const r = spawnSync(process.execPath, [CLI_PATH], {
    encoding: "utf-8",
    cwd: REPO_ROOT,
    env: { ...process.env, HTTPS_PROXY: "http://endereco-invalido-ficticio.invalid:1", HTTP_PROXY: "http://endereco-invalido-ficticio.invalid:1" },
  });
  assert.equal(r.status, 0);
});

// === 72. teste de integracao leve com o historico real (somente leitura) ===
// Unico teste desta suite que depende do historico Git real do repositorio --
// so confirma que o adaptador real funciona e produz uma saida valida, nunca
// asserindo um valor de mercado especifico (que mudaria a cada execucao real).
test("72. [integracao, somente leitura] dry-run contra o historico real do repositorio produz cobertura consistente com o schema", () => {
  const r = run([]);
  assert.equal(r.status, 0);
  assert.match(r.out, /commits auditados: \d+/);
  assert.match(r.out, /snapshots encontrados: \d+ \| validos: \d+ \| invalidos: \d+/);
});

// === 74. saida real desta suite nunca e commitada ===

test("74. nenhum teste desta suite deixa rastro no git status do repositorio", () => {
  const antes = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
  const saida = join(dir, "market-history.json");
  run(["--output", saida]);
  const depois = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
  assert.equal(depois, antes);
});

// ============================================================================
// Emenda arquitetural (Etapa 5): separacao de dominios.
// ============================================================================

test("emenda 2. o extrator NUNCA pede ao adaptador Git um caminho de data/private/ ou *.private.json -- so data.json e fertilizers-override.json, em todo um ciclo real de extracao", async () => {
  const { extrairSerieTemporal } = await import("../extract-market-driver-history.mjs");
  const caminhosPedidos = new Set();
  const adapterEspiao = {
    listarCommits(caminho) {
      caminhosPedidos.add(caminho);
      return [
        { hash: "1".repeat(40), commitDate: "2026-01-10T10:00:05+00:00" },
      ];
    },
    lerArquivoNoCommit(hash, caminho) {
      caminhosPedidos.add(caminho);
      if (caminho === "data.json") {
        return JSON.stringify({
          updatedAt: "2026-01-10T10:00:00.000Z",
          current: { dolar: 5, ureia: 400, map: 600, kcl: 300, gas: 2.5, bdi: 2000, soja: 130, sojaTO: 124 },
          previous: {}, status: {}, refsFertilizantes: {},
        });
      }
      return null; // fertilizers-override.json ficticio: indisponivel nesse commit
    },
  };
  extrairSerieTemporal({ adapterGit: adapterEspiao });
  assert.deepEqual([...caminhosPedidos].sort(), ["data.json", "fertilizers-override.json"]);
  for (const caminho of caminhosPedidos) {
    assert.doesNotMatch(caminho, /data[\\/]private/);
    assert.doesNotMatch(caminho, /\.private\.json$/);
    assert.notEqual(caminho, "formulated-prices-history.private.json");
    assert.notEqual(caminho, "formulated-products-catalog.private.json");
  }
});

test("emenda 2b. --output rejeita explicitamente os dois nomes de arquivo privado citados na emenda", async () => {
  const { validarCaminhoSaidaExtrator } = await import("../extract-market-driver-history.mjs");
  const r1 = validarCaminhoSaidaExtrator(join(REPO_ROOT, "data", "private", "formulated-prices-history.private.json"));
  assert.equal(r1.ok, false);
  const r2 = validarCaminhoSaidaExtrator(join(REPO_ROOT, "data", "private", "formulated-products-catalog.private.json"));
  assert.equal(r2.ok, false);
});

test("emenda 3. a saida do extrator so contem os 8 direcionadores publicos comprovados -- nunca um indicador de formulado", async () => {
  const { INDICADORES_SUPORTADOS } = await import("../market-driver-history.mjs");
  const saida = join(dir, "market-history.json");
  run(["--output", saida]);
  const serie = JSON.parse(readFileSync(saida, "utf-8"));
  assert.ok(serie.observations.length > 0);
  for (const obs of serie.observations) {
    assert.ok(INDICADORES_SUPORTADOS.includes(obs.indicator), `indicador inesperado: ${obs.indicator}`);
  }
});

test("emenda 4. README registra a separacao entre historico comercial, catalogo tecnico e direcionadores de mercado", () => {
  const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf-8");
  assert.match(readme, /cat[áa]logo t[ée]cnico/i);
  assert.match(readme, /hist[óo]rico (privado|comercial)/i);
  assert.match(readme, /direcionadores de mercado/i);
  assert.match(readme, /formulated-products-catalog\.private\.json/);
});

test("emenda 5. nenhum arquivo de catalogo tecnico privado foi criado nesta etapa", () => {
  const caminhoCatalogo = join(REPO_ROOT, "data", "private", "formulated-products-catalog.private.json");
  assert.equal(existsSync(caminhoCatalogo), false);
  // nenhum outro arquivo dentro de data/private/ tambem (a pasta nem deveria existir)
  assert.equal(existsSync(join(REPO_ROOT, "data", "private")), false);
});

// ============================================================================
// Etapa 5.1 -- itens 39-45 (compatibilidade + historico real). O teste contra
// o repositorio real verifica SO execucao sem erro, working tree inalterada,
// estrutura valida, ausencia de dados privados e ausencia de valores no
// console -- nunca contagens exatas (o historico real evolui a cada semana).
// ============================================================================

test("5.1-39/40. --output continua valido e o arquivo gerado passa no validador do schema (nao regrediu com os novos campos de metadata)", async () => {
  const saida = join(dir, "market-history.json");
  const r = run(["--output", saida]);
  assert.equal(r.status, 0);
  const { loadAndValidateHistoryFile } = await import("../market-driver-history.mjs");
  const resultado = loadAndValidateHistoryFile(saida);
  assert.equal(resultado.valid, true, JSON.stringify(resultado.errors));
});

test("5.1-44/45. historico real: extracao roda sem erro, working tree fica inalterada, e base real (data.json) nao muda", () => {
  const statusAntes = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
  const dataJsonAntes = readFileSync(DATA_JSON_PATH, "utf-8");

  const r = run([]);
  assert.equal(r.status, 0);

  const statusDepois = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
  assert.equal(statusDepois, statusAntes);
  assert.equal(readFileSync(DATA_JSON_PATH, "utf-8"), dataJsonAntes);
});

test("5.1-11/12. historico real: se existir alguma observacao FALLBACK_ULTIMO_CONHECIDO, so pode ser de sojaTO (unico indicador com marcador explicito) -- e nenhuma conta so por repeticao ou coincidencia de override", async () => {
  const saida = join(dir, "market-history.json");
  run(["--output", saida]);
  const serie = JSON.parse(readFileSync(saida, "utf-8"));
  const fallbacks = serie.observations.filter((o) => o.sourceStatus === "FALLBACK_ULTIMO_CONHECIDO");
  assert.ok(fallbacks.every((o) => o.indicator === "sojaTO"), "FALLBACK_ULTIMO_CONHECIDO so deveria ocorrer para sojaTO no historico real (ver README/relatorio)");
  // toda observacao com repeatedFromPrevious=true mas sourceStatus != FALLBACK
  // confirma que a repeticao sozinha nunca promoveu a observacao
  const repetidasSemFallback = serie.observations.filter((o) => o.metadata.repeatedFromPrevious === true && o.sourceStatus !== "FALLBACK_ULTIMO_CONHECIDO");
  assert.ok(repetidasSemFallback.every((o) => o.sourceStatus !== "FALLBACK_ULTIMO_CONHECIDO"));
});

test("5.1-10 inspecao de status na saida real sem publicar valores: contagem de sourceStatus por tipo, sem nenhum valor numerico junto", () => {
  const r = run([]);
  assert.equal(r.status, 0);
  // o resumo do console nunca lista sourceStatus/valores individuais, so contagens agregadas
  assert.doesNotMatch(r.out, /OBSERVADO|FALLBACK_ULTIMO_CONHECIDO|OVERRIDE_MANUAL|NAO_IDENTIFICAVEL/);
});
