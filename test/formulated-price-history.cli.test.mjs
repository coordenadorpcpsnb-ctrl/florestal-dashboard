/**
 * test/formulated-price-history.cli.test.mjs — Testes do CLI validate-formulated-history.mjs
 * via subprocesso, e checagens de arquivo relacionadas (gitignore, base publica real).
 *
 * Nao depende de rede. Nao grava nada na base publica real -- os casos que precisam
 * de um arquivo usam node:os.tmpdir(), criado e apagado dentro do proprio teste. Os
 * fixtures usados sao explicitamente FICTICIOS (ver nomes tipo "-DE-TESTE").
 */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const CLI_PATH = join(REPO_ROOT, "validate-formulated-history.mjs");
const BASE_PUBLICA_PATH = join(REPO_ROOT, "data", "formulated-prices-history.json");

function rodarCli(args = []) {
  const r = spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: "utf-8", cwd: REPO_ROOT });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// === 11. CLI usa a base publica quando nenhum caminho e informado ===
test("CLI sem argumentos valida a base publica padrao e termina com exit 0", () => {
  const { status, stdout } = rodarCli([]);
  assert.equal(status, 0);
  assert.match(stdout, /base publica padrao/);
  assert.match(stdout, /formulated-prices-history\.json/);
  assert.doesNotMatch(stdout, /private/);
});

// === 12. CLI aceita caminho explicito valido ===
test("CLI com caminho explicito valido (arquivo existente) processa e termina com exit 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "formulated-history-cli-test-"));
  const arquivo = join(dir, "base-explicita-valida.json");
  writeFileSync(arquivo, JSON.stringify({
    schemaVersion: 1,
    description: "Base ficticia de teste do CLI, valida e vazia.",
    records: [],
  }), "utf-8");
  try {
    const { status, stdout } = rodarCli([arquivo]);
    assert.equal(status, 0);
    assert.match(stdout, /caminho explicito/);
    assert.match(stdout, /base-explicita-valida\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// === 13. CLI falha para caminho explicito inexistente ===
test("CLI com caminho explicito inexistente falha, sem cair de volta na base publica", () => {
  const dir = mkdtempSync(join(tmpdir(), "formulated-history-cli-test-"));
  const arquivoInexistente = join(dir, "nao-existe.json");
  try {
    const { status, stdout } = rodarCli([arquivoInexistente]);
    assert.notEqual(status, 0);
    assert.match(stdout, /ARQUIVO_INEXISTENTE/);
    // nao pode ter validado silenciosamente a base publica em vez do caminho pedido
    assert.doesNotMatch(stdout, /base publica padrao/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// teste extra: confirma end-to-end (via subprocesso real) que nenhum valor de
// registro (preco, fornecedor, observacoes) aparece na saida do CLI, mesmo quando
// o registro e invalido e gera erro para esses campos.
test("CLI nunca imprime preco, fornecedor ou observacoes de um registro invalido", () => {
  const dir = mkdtempSync(join(tmpdir(), "formulated-history-cli-test-"));
  const arquivo = join(dir, "base-com-erro-sensivel.json");
  writeFileSync(arquivo, JSON.stringify({
    schemaVersion: 1,
    description: "Base ficticia de teste do CLI, com um registro invalido de proposito.",
    records: [{
      id: "cli-teste-redacao",
      dataCotacao: "2026-03-10",
      anoReferencia: 2026,
      produto: "Produto Ficticio CLI",
      fornecedor: "FORNECEDOR-SIGILOSO-DE-TESTE-CLI",
      preco: -12345.67,
      moeda: "BRL",
      unidadePreco: "BRL_TON",
      modalidadeEntrega: "NAO_INFORMADO",
      fonteRegistro: "COTACAO",
      observacoes: "OBSERVACAO-SIGILOSA-DE-TESTE-CLI",
    }],
  }), "utf-8");
  try {
    const { status, stdout, stderr } = rodarCli([arquivo]);
    assert.notEqual(status, 0); // preco negativo deve reprovar
    const saidaCompleta = stdout + stderr;
    assert.doesNotMatch(saidaCompleta, /-12345\.67/);
    assert.doesNotMatch(saidaCompleta, /FORNECEDOR-SIGILOSO-DE-TESTE-CLI/);
    assert.doesNotMatch(saidaCompleta, /OBSERVACAO-SIGILOSA-DE-TESTE-CLI/);
    // mas o campo e o id continuam aparecendo, para o erro ser acionavel
    assert.match(saidaCompleta, /preco/);
    assert.match(saidaCompleta, /cli-teste-redacao/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// === 14. .gitignore protege o caminho privado recomendado ===
test(".gitignore contem as regras que protegem data/private/ e *.private.json", () => {
  const gitignore = readFileSync(join(REPO_ROOT, ".gitignore"), "utf-8");
  const linhas = gitignore.split("\n").map((l) => l.trim());
  assert.ok(linhas.includes("/data/private/"), ".gitignore deveria conter a linha /data/private/");
  assert.ok(linhas.includes("*.private.json"), ".gitignore deveria conter a linha *.private.json");
});

// === 15. a base publica real permanece com records vazio ===
test("a base publica real (data/formulated-prices-history.json) continua com records: []", () => {
  const conteudo = JSON.parse(readFileSync(BASE_PUBLICA_PATH, "utf-8"));
  assert.equal(conteudo.schemaVersion, 1);
  assert.deepEqual(conteudo.records, []);
});

test("a base publica real, validada pelo modulo, e valida", () => {
  const { status } = rodarCli([]);
  assert.equal(status, 0);
});
