/**
 * check-status.mjs — Analisa o data.json e prepara o alerta de fontes indisponíveis.
 *
 * Saídas (para o GitHub Actions):
 *   - GITHUB_OUTPUT: has_failures=true|false  e  failed_count=N
 *   - issue-body.md: corpo da Issue (só é escrito quando há falhas)
 *
 * Rodando localmente (fora do Actions), apenas imprime o diagnóstico no terminal.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data.json");
const OVERRIDE = join(__dirname, "fertilizers-override.json");

if (!existsSync(DATA)) {
  console.error("[check] data.json não encontrado.");
  process.exit(1);
}

const d = JSON.parse(readFileSync(DATA, "utf-8"));
const status = d.status ?? {};
const current = d.current ?? {};

// Nomes amigáveis e a qual indicador cada fonte corresponde
const FONTES = {
  cambio:  { nome: "Câmbio (AwesomeAPI)",      campo: "dolar",  unidade: "R$/US$" },
  soja:    { nome: "Soja (CEPEA/ESALQ)",       campo: "soja",   unidade: "R$/saca" },
  diesel:  { nome: "Diesel S10 (ANP)",         campo: "diesel", unidade: "R$/L" },
  bdi:     { nome: "Frete Marítimo (stooq)",   campo: "bdi",    unidade: "pontos" },
  ureia:   { nome: "Ureia (ComexStat)",        campo: "ureia",  unidade: "US$/t" },
  map:     { nome: "MAP (ComexStat)",          campo: "map",    unidade: "US$/t" },
  kcl:     { nome: "KCl (ComexStat)",          campo: "kcl",    unidade: "US$/t" },
  gas:     { nome: "Gás Natural (EIA/stooq)",  campo: "gas",    unidade: "US$/MMBtu" },
  sojaRegional: { nome: "Soja Oeste BA (AIBA)", campo: "sojaTO", unidade: "R$/saca" },
};

// Fontes que o usuario declarou como manuais nao geram alerta
let manuais = [];
try {
  if (existsSync(OVERRIDE)) manuais = JSON.parse(readFileSync(OVERRIDE, "utf-8")).fontesManuais ?? [];
} catch { /* ignora */ }
if (manuais.length) console.log(`[check] fontes declaradas manuais (sem alerta): ${manuais.join(", ")}`);

const falhas = Object.entries(status)
  .filter(([chave]) => !manuais.includes(chave))
  .filter(([chave, valor]) => FONTES[chave] && typeof valor === "string" && valor.startsWith("falha"))
  .map(([chave, valor]) => ({ chave, motivo: valor.replace(/^falha:\s*/, ""), ...FONTES[chave] }));

const ok = Object.entries(status)
  .filter(([chave, valor]) => FONTES[chave] && valor === "ok")
  .map(([chave]) => FONTES[chave].nome);

// --- diagnóstico no log ---
console.log(`[check] fontes OK: ${ok.length ? ok.join(", ") : "nenhuma"}`);
console.log(`[check] fontes com falha: ${falhas.length}`);
falhas.forEach(f => console.log(`  - ${f.nome}: ${f.motivo}`));

// --- saídas para o Actions ---
const out = process.env.GITHUB_OUTPUT;
if (out) {
  appendFileSync(out, `has_failures=${falhas.length > 0}\n`);
  appendFileSync(out, `failed_count=${falhas.length}\n`);
}

if (falhas.length === 0) process.exit(0);

// --- corpo da Issue ---
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null;

const fmt = (v) => v == null ? "—" : v.toLocaleString("pt-BR");

const linhas = [
  `A atualização automática de **${d.updatedAtBR ?? new Date().toLocaleString("pt-BR")}** não conseguiu buscar ${falhas.length === 1 ? "uma fonte" : `${falhas.length} fontes`}.`,
  "",
  "> O dashboard e o relatório **foram gerados normalmente**, mas os indicadores abaixo estão exibindo o **último valor conhecido** (congelado), não o valor atual.",
  "",
  "### Fontes indisponíveis",
  "",
  "| Fonte | Indicador | Último valor usado | Motivo |",
  "|---|---|---|---|",
  ...falhas.map(f => `| ${f.nome} | \`${f.campo}\` | ${fmt(current[f.campo])} ${f.unidade} | \`${f.motivo}\` |`),
  "",
];

if (ok.length) {
  linhas.push(`### Fontes que funcionaram`, "", ...ok.map(n => `- ${n}`), "");
}

linhas.push(
  "### O que fazer",
  "",
  "1. **Falha pontual** (instabilidade do site): normalmente se resolve sozinha na próxima execução. Se a próxima semana vier OK, esta Issue fecha automaticamente.",
  "2. **Falha repetida** (2+ semanas seguidas): o site da fonte provavelmente mudou de layout ou passou a bloquear acessos de datacenter. Nesse caso o scraper precisa de ajuste.",
  "3. **Enquanto isso**, o valor pode ser corrigido manualmente editando o `data.json` (campo `current`) ou, no caso dos fertilizantes, o `fertilizers-override.json`.",
  "",
);

if (runUrl) linhas.push(`[Ver log completo desta execução](${runUrl})`);

writeFileSync(join(__dirname, "issue-body.md"), linhas.join("\n"), "utf-8");
console.log("[check] issue-body.md gerado.");
