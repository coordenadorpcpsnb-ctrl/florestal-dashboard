/**
 * patch-dashboard.mjs — Injeta os valores de data.json no dashboard.html
 *
 * Atualiza apenas o bloco de KPIs (entre os marcadores KPIS-START / KPIS-END)
 * e o selo de referência "Dados base · XXX". O histórico mensal dos gráficos
 * é preservado (atualizado periodicamente, não a cada semana).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data.json");
const HTML = join(__dirname, "dashboard.html");

if (!existsSync(DATA)) { console.error("[patch] data.json não encontrado — rode fetch-data.mjs antes."); process.exit(1); }
if (!existsSync(HTML)) { console.error("[patch] dashboard.html não encontrado nesta pasta."); process.exit(1); }

const d = JSON.parse(readFileSync(DATA, "utf-8"));
const c = d.current, delta = d.delta, troca = d.troca;

const brl = (v, dec = 2) => v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const int = (v) => v == null ? "—" : Math.round(v).toLocaleString("pt-BR");

// trend + alert helpers (mesma lógica de gatilhos do dashboard)
const tr = (x) => x > 0.5 ? "up" : x < -0.5 ? "down" : "stable";
function kpiLine(id, label, value, unit, variation, alert, threshold, spark) {
  return `  { id:"${id}", label:"${label}", value:"${value}", unit:"${unit}", variation:${variation}, trend:"${tr(variation)}", alert:"${alert}", threshold:"${threshold}", spark:${spark} },`;
}

const aUreia  = c.ureia > 470 ? "critical" : c.ureia > 430 ? "warning" : "ok";
const aMap    = c.map > 650 ? "warning" : "ok";
const aGas    = c.gas > 3.0 ? "warning" : "ok";
const aBdi    = c.bdi > 2300 ? "warning" : "ok";
const aDiesel = c.diesel > 7.60 ? "warning" : "ok";
const aDolar  = c.dolar > 5.80 ? "critical" : c.dolar > 5.60 ? "warning" : "ok";
const aSoja   = c.soja < 125 ? "warning" : "ok";
const aSojaTO = c.sojaTO > 140 ? "warning" : "ok";
const aTroca  = (troca.map ?? 0) > 30 ? "warning" : "ok";

const kpisBlock = [
  "let kpis = [",
  kpiLine("dolar","Dólar", brl(c.dolar), "R$/US$", delta.dolar ?? 0, aDolar, "> R$ 5,60", "macro.dolar"),
  kpiLine("ureia","Ureia FOB", int(c.ureia), "US$/t", delta.ureia ?? 0, aUreia, "> US$ 430/t", "fert.ureia"),
  kpiLine("map","MAP FOB", int(c.map), "US$/t", delta.map ?? 0, aMap, "> US$ 650/t", "fert.map"),
  kpiLine("gas","Gás Natural", brl(c.gas), "US$/MMBtu", delta.gas ?? 0, aGas, "> US$ 3,00", "macro.gas"),
  kpiLine("bdi","Frete Marítimo (BDI)", int(c.bdi), "pontos", delta.bdi ?? 0, aBdi, "> 2.300 pts", "macro.bdi"),
  kpiLine("diesel","Diesel S10", brl(c.diesel), "R$/L", delta.diesel ?? 0, aDiesel, "> R$ 7,60/L", "macro.diesel"),
  kpiLine("soja","Soja CEPEA (Nacional)", brl(c.soja), "R$/saca", delta.soja ?? 0, aSoja, "< R$ 125,00", "soy.soja"),
  kpiLine("sojaTO","Soja Oeste BA (AIBA)", brl(c.sojaTO), "R$/saca", delta.sojaTO ?? 0, aSojaTO, "> R$ 140,00", "soy.sojaTO"),
  kpiLine("trocaMap","Troca Soja/MAP", brl(troca.map, 1), "sacas/t", delta.trocaMap ?? 0, aTroca, "> 30 sacas/t", "soy.trocaMap"),
  "]",
].join("\n");

let html = readFileSync(HTML, "utf-8");

// 1) substitui bloco entre marcadores
const re = /\/\* KPIS-START \*\/[\s\S]*?\/\* KPIS-END \*\//;
if (!re.test(html)) { console.error("[patch] marcadores KPIS-START/END não encontrados no HTML."); process.exit(1); }
html = html.replace(re, `/* KPIS-START */\n${kpisBlock}; /* KPIS-END */`);

// 2) atualiza selo de referência
html = html.replace(/Dados base · [^<]*/, `Dados base · ${d.ref}`);

writeFileSync(HTML, html, "utf-8");
console.log(`[patch] dashboard.html atualizado (ref ${d.ref}).`);
