/**
 * test/validate-formulated-products-catalog.cli.test.mjs — testes do CLI
 * validate-formulated-products-catalog.mjs: caminho obrigatório, tipos de caminho
 * aceitos/rejeitados, código de saída e sanitização do console.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CLI = join(ROOT, "validate-formulated-products-catalog.mjs");
const TEMPLATE = join(ROOT, "templates", "formulated-products-catalog-template.json");

function rodar(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { encoding: "utf-8", ...opts });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status, stdout: e.stdout?.toString() ?? "" };
  }
}

test("[64] CLI contra o template público retorna código 0 (válido)", () => {
  const r = rodar([TEMPLATE]);
  assert.equal(r.code, 0);
});

test("CLI sem argumento retorna código diferente de zero (não procura arquivo sozinho)", () => {
  const r = rodar([]);
  assert.notEqual(r.code, 0);
});

test("CLI contra caminho público não permitido (fora do template) é rejeitado", () => {
  const r = rodar([join(ROOT, "package.json")]);
  assert.notEqual(r.code, 0);
});

test("[65] CLI contra catálogo inválido (*.private.json fictício) retorna código diferente de zero", () => {
  const dir = mkdtempSync(join(tmpdir(), "catalogo-teste-"));
  const caminho = join(dir, "catalogo-teste.private.json");
  writeFileSync(caminho, JSON.stringify({ schemaVersion: 1, description: "d", formulations: [{}] }), "utf-8");
  try {
    const r = rodar([caminho]);
    assert.notEqual(r.code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI contra arquivo *.private.json inexistente retorna código diferente de zero", () => {
  const r = rodar([join(tmpdir(), "definitivamente-nao-existe-catalogo.private.json")]);
  assert.notEqual(r.code, 0);
});

test("CLI contra JSON inválido (*.private.json fictício) retorna código diferente de zero", () => {
  const dir = mkdtempSync(join(tmpdir(), "catalogo-teste-"));
  const caminho = join(dir, "invalido.private.json");
  writeFileSync(caminho, "{ isso nao e json", "utf-8");
  try {
    const r = rodar([caminho]);
    assert.notEqual(r.code, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("[66-70] CLI não imprime productName, declaredFormula, micronutrientes, composição, notas ou documentReference de um catálogo fictício com erro", () => {
  const dir = mkdtempSync(join(tmpdir(), "catalogo-teste-"));
  const caminho = join(dir, "com-conteudo-sensivel.private.json");
  const CONTEUDO_SENSIVEL_1 = "NOME_PRODUTO_QUE_NAO_PODE_APARECER";
  const CONTEUDO_SENSIVEL_2 = "99-88-77";
  const NOTA_SENSIVEL = "NOTA_QUE_NAO_PODE_VAZAR_NO_CONSOLE";
  const DOCUMENTO_SENSIVEL = "DOCUMENTO_QUE_NAO_PODE_VAZAR";
  writeFileSync(caminho, JSON.stringify({
    schemaVersion: 1,
    description: "d",
    formulations: [{
      // formulationId ausente de propósito -> gera erro, mas o resto do conteúdo
      // sensível abaixo não deveria aparecer em nenhuma mensagem do console.
      productName: CONTEUDO_SENSIVEL_1,
      declaredFormula: CONTEUDO_SENSIVEL_2,
      revision: "REV-01",
      validFrom: "2026-01-01",
      status: "ACTIVE",
      macronutrientGuarantees: { unit: "PERCENT", n: null, p2o5: null, k2o: null },
      micronutrients: [{ element: "ZN", value: 1, unit: "PERCENT", sourceNote: "MICRO_SENSIVEL" }],
      physicalComposition: { completenessStatus: "PARTIAL", totalPercent: null, components: [
        { componentId: "c1", componentName: "COMPOSICAO_SENSIVEL", percentage: 10, unit: "PERCENT_MASS", sourceType: "OTHER" },
      ] },
      informationSources: [{ sourceId: "s1", isPrimary: true, type: "OTHER", documentReference: DOCUMENTO_SENSIVEL }],
      informationQuality: "NOT_AVAILABLE",
      notes: NOTA_SENSIVEL,
    }],
  }), "utf-8");
  try {
    const r = rodar([caminho]);
    assert.notEqual(r.code, 0, "catálogo sem formulationId deveria ser inválido");
    for (const conteudo of [CONTEUDO_SENSIVEL_1, CONTEUDO_SENSIVEL_2, NOTA_SENSIVEL, DOCUMENTO_SENSIVEL, "MICRO_SENSIVEL", "COMPOSICAO_SENSIVEL"]) {
      assert.doesNotMatch(r.stdout, new RegExp(conteudo), `conteúdo sensível vazou no console: ${conteudo}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI não imprime formulationId por padrão (sem SHOW_FORMULATION_IDS=1)", () => {
  const dir = mkdtempSync(join(tmpdir(), "catalogo-teste-"));
  const caminho = join(dir, "com-id.private.json");
  writeFileSync(caminho, JSON.stringify({
    schemaVersion: 1, description: "d",
    formulations: [{
      formulationId: "form-nao-deveria-aparecer-sozinho",
      productName: "P", revision: "REV-01", validFrom: "2026-01-01", status: "STATUS_INVALIDO",
      macronutrientGuarantees: { unit: "PERCENT", n: null, p2o5: null, k2o: null },
      informationSources: [{ sourceId: "s1", isPrimary: true, type: "OTHER" }],
      informationQuality: "NOT_AVAILABLE",
    }],
  }), "utf-8");
  try {
    const r = rodar([caminho], { env: { ...process.env, SHOW_FORMULATION_IDS: undefined } });
    assert.notEqual(r.code, 0);
    assert.doesNotMatch(r.stdout, /form-nao-deveria-aparecer-sozinho/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CLI não imprime o conteúdo bruto do JSON de entrada", () => {
  const r = rodar([TEMPLATE]);
  assert.doesNotMatch(r.stdout, /"formulations"\s*:/);
});
