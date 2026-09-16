/**
 * test/import-formulated-history.cli.test.mjs — Testes do CLI import-formulated-history.mjs
 * via subprocesso: comportamento de dry-run/--write, redacao de logs de ponta a ponta,
 * rejeicao de caminho de saida, e as duas checagens de git check-ignore.
 *
 * DADOS FICTICIOS. Nunca grava na base publica real. Usa diretorios temporarios do
 * sistema para toda escrita. Os testes de git check-ignore criam um arquivo vazio
 * temporario, sempre removido no finally, e confirmam a arvore de trabalho limpa
 * no final.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, mkdtempSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { CABECALHO_CANONICO } from "../formulated-price-csv.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CLI_PATH = join(REPO_ROOT, "import-formulated-history.mjs");
const BASE_PUBLICA_PATH = join(REPO_ROOT, "data", "formulated-prices-history.json");

const HEADER = CABECALHO_CANONICO.join(";");
const LINHA_VALIDA_FICTICIA = "fp-cli-teste-001;2026-01-10;;2026;Produto Ficticio CLI;;;Fornecedor Ficticio CLI;150,25;BRL;BRL_TON;NAO_INFORMADO;;;;;COTACAO;";
const LINHA_SENSIVEL_INVALIDA = "fp-cli-teste-002;2026-01-10;;2026;Produto Sigiloso CLI;;;FORNECEDOR-SIGILOSO-CLI;-999,99;BRL;BRL_TON;NAO_INFORMADO;;;;;COTACAO;OBSERVACAO-SIGILOSA-CLI";

function run(args, cwd) {
  const r = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf-8", cwd: cwd ?? REPO_ROOT });
  return { status: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

let dir;
test.beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "import-cli-test-")); });
test.afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

// === 34. dry-run valido nao grava ===
test("dry-run (sem --write) com CSV valido nao cria o arquivo de saida", () => {
  const csv = join(dir, "entrada.csv");
  const saida = join(dir, "saida.private.json");
  writeFileSync(csv, HEADER + "\n" + LINHA_VALIDA_FICTICIA + "\n", "utf-8");

  const r = run([csv, saida]);
  assert.equal(r.status, 0);
  assert.match(r.out, /dry-run: nada foi gravado/);
  assert.equal(existsSync(saida), false);
});

// === 35. dry-run invalido nao grava ===
test("dry-run com CSV invalido tambem nao grava, e termina com exit != 0", () => {
  const csv = join(dir, "entrada.csv");
  const saida = join(dir, "saida.private.json");
  writeFileSync(csv, HEADER + "\n" + LINHA_SENSIVEL_INVALIDA + "\n", "utf-8");

  const r = run([csv, saida]);
  assert.notEqual(r.status, 0);
  assert.equal(existsSync(saida), false);
});

// === 36. --write cria saida privada valida ===
test("--write com CSV valido cria o arquivo de saida", () => {
  const csv = join(dir, "entrada.csv");
  const saida = join(dir, "saida.private.json");
  writeFileSync(csv, HEADER + "\n" + LINHA_VALIDA_FICTICIA + "\n", "utf-8");

  const r = run([csv, saida, "--write"]);
  assert.equal(r.status, 0);
  assert.equal(existsSync(saida), true);
});

// === 43. tentativa de gravar na base publica e rejeitada ===
test("--write recusa explicitamente a base publica como destino, sem tocar nela", () => {
  const csv = join(dir, "entrada.csv");
  writeFileSync(csv, HEADER + "\n" + LINHA_VALIDA_FICTICIA + "\n", "utf-8");

  const r = run([csv, BASE_PUBLICA_PATH, "--write"]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_E_BASE_PUBLICA/);
});

// === 44. saida nao privada e rejeitada ===
test("--write recusa um caminho de saida que nao termina em .private.json", () => {
  const csv = join(dir, "entrada.csv");
  const saidaErrada = join(dir, "saida-sem-sufixo.json");
  writeFileSync(csv, HEADER + "\n" + LINHA_VALIDA_FICTICIA + "\n", "utf-8");

  const r = run([csv, saidaErrada, "--write"]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /SAIDA_NAO_PRIVADA/);
  assert.equal(existsSync(saidaErrada), false);
});

// === 46-49. logs nao expoem preco/fornecedor/observacoes/conteudo bruto ===
test("logs do CLI (dry-run e --write) nunca expoem preco, fornecedor, produto ou observacoes", () => {
  const csv = join(dir, "entrada.csv");
  const saida = join(dir, "saida.private.json");
  writeFileSync(csv, HEADER + "\n" + LINHA_SENSIVEL_INVALIDA + "\n", "utf-8");

  for (const args of [[csv, saida], [csv, saida, "--write"]]) {
    const r = run(args);
    assert.doesNotMatch(r.out, /-999,99/);
    assert.doesNotMatch(r.out, /-999\.99/);
    assert.doesNotMatch(r.out, /FORNECEDOR-SIGILOSO-CLI/);
    assert.doesNotMatch(r.out, /Produto Sigiloso CLI/);
    assert.doesNotMatch(r.out, /OBSERVACAO-SIGILOSA-CLI/);
    // a linha bruta do CSV (com ";") tambem nao pode aparecer inteira
    assert.doesNotMatch(r.out, /fp-cli-teste-002;2026-01-10/);
  }
});

test("--write com CSV valido tambem nao imprime o conteudo dos registros gravados", () => {
  const csv = join(dir, "entrada.csv");
  const saida = join(dir, "saida.private.json");
  writeFileSync(csv, HEADER + "\n" + LINHA_VALIDA_FICTICIA + "\n", "utf-8");

  const r = run([csv, saida, "--write"]);
  assert.equal(r.status, 0);
  assert.doesNotMatch(r.out, /150,25/);
  assert.doesNotMatch(r.out, /Fornecedor Ficticio CLI/);
  assert.doesNotMatch(r.out, /Produto Ficticio CLI/);
});

// === argv: entrada/saida ausentes ===
test("CLI sem os dois argumentos posicionais falha com uso, sem tentar nada", () => {
  const r = run([]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /uso:/);
});

// === 53/54. git check-ignore confirma as regras do .gitignore ===
// Compara o "git status --porcelain" de ANTES e DEPOIS do teste (nao contra uma
// arvore vazia): durante o desenvolvimento desta etapa ha arquivos legitimamente
// novos e ainda nao commitados -- o que estes testes garantem e que ELES MESMOS
// nao deixam nenhum rastro extra, nao que o repositorio inteiro esteja limpo.
function statusAtual() {
  return spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf-8" }).stdout;
}

test("git check-ignore confirma que um arquivo em data/private/ e ignorado", () => {
  const statusAntes = statusAtual();
  const caminhoRelativo = "data/private/teste-check-ignore-vazio.private.json";
  const caminhoAbsoluto = join(REPO_ROOT, caminhoRelativo);
  const pastaPrivateJaExistia = existsSync(join(REPO_ROOT, "data", "private"));
  try {
    mkdirSync(dirname(caminhoAbsoluto), { recursive: true });
    writeFileSync(caminhoAbsoluto, "{}", "utf-8");
    const r = spawnSync("git", ["check-ignore", caminhoRelativo], { cwd: REPO_ROOT, encoding: "utf-8" });
    assert.equal(r.status, 0, "git check-ignore deveria confirmar que o arquivo esta ignorado (status 0)");
    assert.match(r.stdout.trim(), /teste-check-ignore-vazio\.private\.json/);
  } finally {
    rmSync(caminhoAbsoluto, { force: true });
    if (!pastaPrivateJaExistia) rmSync(join(REPO_ROOT, "data", "private"), { recursive: true, force: true });
  }
  assert.equal(statusAtual(), statusAntes, "o teste nao deveria deixar nenhum rastro no git status");
});

test("git check-ignore confirma que um arquivo *.private.json fora de data/private/ tambem e ignorado", () => {
  const statusAntes = statusAtual();
  const caminhoRelativo = "teste-check-ignore-raiz.private.json";
  const caminhoAbsoluto = join(REPO_ROOT, caminhoRelativo);
  try {
    writeFileSync(caminhoAbsoluto, "{}", "utf-8");
    const r = spawnSync("git", ["check-ignore", caminhoRelativo], { cwd: REPO_ROOT, encoding: "utf-8" });
    assert.equal(r.status, 0, "git check-ignore deveria confirmar que *.private.json e ignorado em qualquer lugar");
    assert.match(r.stdout.trim(), /teste-check-ignore-raiz\.private\.json/);
  } finally {
    rmSync(caminhoAbsoluto, { force: true });
  }
  assert.equal(statusAtual(), statusAntes, "o teste nao deveria deixar nenhum rastro no git status");
});
