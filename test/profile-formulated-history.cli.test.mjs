/**
 * test/profile-formulated-history.cli.test.mjs — Testes de ponta a ponta do CLI
 * profile-formulated-history.mjs via subprocesso: contrato de argv, rejeicao de
 * caminho (entrada e --output), escrita atomica do relatorio privado, e a garantia
 * mais importante desta etapa -- o console NUNCA imprime produto/formula/
 * fornecedor/preco/volume/destino/prazo/observacoes, so contagens/percentuais/tipos
 * de alerta/ids de serie anonimos.
 *
 * DADOS 100% FICTICIOS, com marcadores inequivocos e sensiveis so por convencao de
 * teste (PRODUTO_SIGILOSO_FICTICIO, FORNECEDOR_SIGILOSO_FICTICIO,
 * DESTINO_SIGILOSO_FICTICIO, 987654.32) -- nunca sao dados reais da empresa. Toda
 * escrita usa diretorios temporarios do sistema, sempre removidos no afterEach.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, rmSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CLI_PATH = join(REPO_ROOT, "profile-formulated-history.mjs");
const BASE_PUBLICA_PATH = join(REPO_ROOT, "data", "formulated-prices-history.json");
const TEMPLATES_DIR = join(REPO_ROOT, "templates");

function run(args, cwd) {
  const r = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf-8", cwd: cwd ?? REPO_ROOT });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

function registroFicticio(overrides = {}) {
  return {
    id: overrides.id ?? "fp-cli-001",
    dataCotacao: "2024-01-10",
    dataCompra: null,
    anoReferencia: 2024,
    produto: "PRODUTO_SIGILOSO_FICTICIO",
    formula: "06-30-06",
    categoriaFormula: "NPK",
    fornecedor: "FORNECEDOR_SIGILOSO_FICTICIO",
    preco: 987654.32,
    moeda: "BRL",
    unidadePreco: "BRL_TON",
    modalidadeEntrega: "CIF_DESTINO",
    destino: "DESTINO_SIGILOSO_FICTICIO",
    volumeToneladas: 10,
    prazoPagamentoDias: 30,
    validadeProposta: null,
    fonteRegistro: "COTACAO",
    observacoes: "OBSERVACAO_SIGILOSA_FICTICIA",
    ...overrides,
  };
}

function baseFicticia(records) {
  return JSON.stringify({ schemaVersion: 1, description: "base ficticia de teste do CLI", records }, null, 2);
}

const MARCADORES_SENSIVEIS = [
  "PRODUTO_SIGILOSO_FICTICIO",
  "FORNECEDOR_SIGILOSO_FICTICIO",
  "DESTINO_SIGILOSO_FICTICIO",
  "OBSERVACAO_SIGILOSA_FICTICIA",
  "987654.32",
  "987654,32",
];

let dir;
test.beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "profile-cli-test-")); });
test.afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

// === contrato de argv ===

test("sem argumento nenhum: falha com uso, exit != 0, sem tentar procurar arquivo nenhum", () => {
  const r = run([]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /uso:/);
});

test("--output sem valor: falha com mensagem clara, exit != 0", () => {
  const entrada = join(dir, "base.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");
  const r = run([entrada, "--output"]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /--output precisa de um caminho/);
});

// === rejeicao de caminho de entrada ===

test("recusa a base publica conhecida como entrada, sem ler nada dela", () => {
  const r = run([BASE_PUBLICA_PATH]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_E_BASE_PUBLICA/);
});

test("recusa um caminho de entrada que nao termina em .private.json", () => {
  const entrada = join(dir, "base-sem-sufixo.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");
  const r = run([entrada]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_NAO_PRIVADA/);
});

test("nao faz fallback para a base publica quando o caminho explicito nao existe", () => {
  const entradaInexistente = join(dir, "nao-existe.private.json");
  const r = run([entradaInexistente]);
  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.out, /base publica padrao/);
});

// === base invalida ===

test("base de entrada invalida (schema) aborta com erros sanitizados (so tipo/id/indice/campo, nunca conteudo)", () => {
  const entrada = join(dir, "base.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio({ preco: -999.99, fornecedor: "FORNECEDOR-INVALIDO-CLI" })]), "utf-8");
  const r = run([entrada]);
  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.out, /-999,99/);
  assert.doesNotMatch(r.out, /-999\.99/);
  assert.doesNotMatch(r.out, /FORNECEDOR-INVALIDO-CLI/);
});

// === dry-run (sem --output) ===

test("dry-run com base valida termina com exit 0 e nao cria nenhum arquivo novo", () => {
  const entrada = join(dir, "base.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");
  const r = run([entrada]);
  assert.equal(r.status, 0);
  assert.match(r.out, /registros: 1/);
});

test("base vazia (records: []) e tratada com sucesso (exit 0) e alerta BASE_VAZIA", () => {
  const entrada = join(dir, "vazia.private.json");
  writeFileSync(entrada, baseFicticia([]), "utf-8");
  const r = run([entrada]);
  assert.equal(r.status, 0);
  assert.match(r.out, /registros: 0/);
  assert.match(r.out, /BASE_VAZIA/);
});

// === redacao total do console ===

test("console (dry-run) nunca imprime produto/formula/fornecedor/preco/volume/destino/prazo/observacoes", () => {
  const entrada = join(dir, "base.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio({ id: "fp-a" }), registroFicticio({ id: "fp-b", preco: 1000 })]), "utf-8");
  const r = run([entrada]);
  assert.equal(r.status, 0);
  for (const marcador of MARCADORES_SENSIVEIS) {
    assert.doesNotMatch(r.out, new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `vazou "${marcador}" no console`);
  }
});

test("console (com --output) tambem nunca imprime os mesmos campos sensiveis, mesmo gravando o relatorio", () => {
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio({ id: "fp-a" }), registroFicticio({ id: "fp-b", preco: 1000 })]), "utf-8");
  const r = run([entrada, "--output", saida]);
  assert.equal(r.status, 0);
  for (const marcador of MARCADORES_SENSIVEIS) {
    assert.doesNotMatch(r.out, new RegExp(marcador.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `vazou "${marcador}" no console`);
  }
});

test("console nunca imprime recordId individual no resumo padrao (so contagens)", () => {
  const entrada = join(dir, "base.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio({ id: "fp-id-unico-999" })]), "utf-8");
  const r = run([entrada]);
  assert.doesNotMatch(r.out, /fp-id-unico-999/);
});

// === entrada nunca e alterada ===

test("o CLI nunca escreve na entrada -- conteudo byte-a-byte preservado apos dry-run e apos --output", () => {
  const entrada = join(dir, "base.private.json");
  const conteudoOriginal = baseFicticia([registroFicticio()]);
  writeFileSync(entrada, conteudoOriginal, "utf-8");

  run([entrada]);
  assert.equal(readFileSync(entrada, "utf-8"), conteudoOriginal, "entrada mudou apos dry-run");

  const saida = join(dir, "relatorio.profile.private.json");
  run([entrada, "--output", saida]);
  assert.equal(readFileSync(entrada, "utf-8"), conteudoOriginal, "entrada mudou apos --output");
});

// === --output: escrita atomica do relatorio privado ===

test("--output cria o relatorio privado com o schemaVersion/description/source/quality/series/alerts esperados", () => {
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  const r = run([entrada, "--output", saida]);
  assert.equal(r.status, 0);
  assert.equal(existsSync(saida), true);

  const relatorio = JSON.parse(readFileSync(saida, "utf-8"));
  assert.equal(typeof relatorio.schemaVersion, "number");
  assert.equal(typeof relatorio.generatedAt, "string");
  assert.match(relatorio.description, /CONFIDENCIAL/);
  assert.match(relatorio.description, /nao constitui previsao/i);
  assert.ok(relatorio.source);
  assert.ok(relatorio.quality);
  assert.ok(Array.isArray(relatorio.series));
  assert.ok(Array.isArray(relatorio.alerts));
});

test("o relatorio privado (que PODE ter mapeamento completo) contem o produto/formula/destino da serie", () => {
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  run([entrada, "--output", saida]);
  const relatorio = JSON.parse(readFileSync(saida, "utf-8"));
  assert.equal(relatorio.series[0].criterios.produto, "PRODUTO_SIGILOSO_FICTICIO");
  assert.equal(relatorio.series[0].criterios.destino, "DESTINO_SIGILOSO_FICTICIO");
});

test("o relatorio privado NUNCA contem fornecedor nem observacoes (nao entram na identidade de serie nem nas estatisticas)", () => {
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  run([entrada, "--output", saida]);
  const bruto = readFileSync(saida, "utf-8");
  assert.doesNotMatch(bruto, /FORNECEDOR_SIGILOSO_FICTICIO/);
  assert.doesNotMatch(bruto, /OBSERVACAO_SIGILOSA_FICTICIA/);
});

test("o relatorio privado nao contem o caminho absoluto de entrada, nem HOME/usuario", () => {
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  run([entrada, "--output", saida]);
  const bruto = readFileSync(saida, "utf-8");
  assert.doesNotMatch(bruto, new RegExp(entrada.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  if (process.env.HOME) {
    assert.doesNotMatch(bruto, new RegExp(process.env.HOME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("--output nao deixa nenhum arquivo temporario para tras apos sucesso", () => {
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  run([entrada, "--output", saida]);
  const arquivos = readdirSync(dir);
  assert.deepEqual(arquivos.sort(), ["base.private.json", "relatorio.profile.private.json"]);
});

test("--output recusa a base publica como destino, sem tocar nela", () => {
  const entrada = join(dir, "base.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  const r = run([entrada, "--output", BASE_PUBLICA_PATH]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_E_BASE_PUBLICA/);
});

test("--output recusa um caminho que nao termina em .private.json", () => {
  const entrada = join(dir, "base.private.json");
  const saidaErrada = join(dir, "relatorio-sem-sufixo.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  const r = run([entrada, "--output", saidaErrada]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_NAO_PRIVADA/);
  assert.equal(existsSync(saidaErrada), false);
});

test("--output recusa gravar dentro de templates/", () => {
  const entrada = join(dir, "base.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  const caminhoProibido = join(TEMPLATES_DIR, "relatorio-teste-nao-deveria-existir.private.json");
  const r = run([entrada, "--output", caminhoProibido]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_EM_TEMPLATES/);
  assert.equal(existsSync(caminhoProibido), false);
});

test("--output nao sobrescreve silenciosamente um arquivo de saida existente que nao e um relatorio valido deste CLI", () => {
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");
  writeFileSync(saida, JSON.stringify({ outraCoisa: true }), "utf-8");

  const r = run([entrada, "--output", saida]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /RELATORIO_EXISTENTE_INVALIDO/);
  assert.deepEqual(JSON.parse(readFileSync(saida, "utf-8")), { outraCoisa: true }, "arquivo existente invalido nao deveria ter sido tocado");
});

test("--output sobrescreve com sucesso um relatorio anterior valido deste CLI (rerun idempotente)", () => {
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");

  const r1 = run([entrada, "--output", saida]);
  assert.equal(r1.status, 0);
  const r2 = run([entrada, "--output", saida]);
  assert.equal(r2.status, 0);
  assert.equal(existsSync(saida), true);
});

// === git status limpo ao final ===

test("nenhum teste desta suite deixa rastro no git status do repositorio", () => {
  const statusAntes = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
  const entrada = join(dir, "base.private.json");
  const saida = join(dir, "relatorio.profile.private.json");
  writeFileSync(entrada, baseFicticia([registroFicticio()]), "utf-8");
  run([entrada, "--output", saida]);
  const statusDepois = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
  assert.equal(statusDepois, statusAntes);
});
