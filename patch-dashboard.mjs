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
const tr = (x) => x == null ? "stable" : x > 0.5 ? "up" : x < -0.5 ? "down" : "stable";

/** "2026-06" -> "jun/26" */
const MES_ABREV = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function refCurta(ref) {
  const m = /^(\d{4})-(\d{2})$/.exec(ref ?? "");
  return m ? `${MES_ABREV[Number(m[2]) - 1]}/${m[1].slice(2)}` : (ref ?? "");
}

function kpiLine(id, label, value, unit, variation, alert, threshold, spark, vs) {
  const v = variation == null ? "null" : variation;
  const vsTxt = vs ? `, vs:"${vs}"` : "";
  return `  { id:"${id}", label:"${label}", value:"${value}", unit:"${unit}", variation:${v}, trend:"${tr(variation)}", alert:"${alert}", threshold:"${threshold}", spark:${spark}${vsTxt} },`;
}

// Rotulo dos fertilizantes: quando nao houve novo fechamento, explica o motivo
const refs = d.refsFertilizantes ?? {};
const vsFert = (k) => delta[k] == null
  ? `fechamento ${refCurta(refs[k])}`
  : `vs ${refCurta(refs[k])}`;

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
  kpiLine("ureia","Ureia FOB", int(c.ureia), "US$/t", delta.ureia, aUreia, "> US$ 430/t", "fert.ureia", vsFert("ureia")),
  kpiLine("map","MAP FOB", int(c.map), "US$/t", delta.map, aMap, "> US$ 650/t", "fert.map", vsFert("map")),
  kpiLine("gas","Gás Natural", brl(c.gas), "US$/MMBtu", delta.gas ?? 0, aGas, "> US$ 3,00", "macro.gas"),
  kpiLine("bdi","Frete Marítimo (BDI)", int(c.bdi), "pontos", delta.bdi ?? 0, aBdi, "> 2.300 pts", "macro.bdi"),
  kpiLine("diesel","Diesel S10", brl(c.diesel), "R$/L", delta.diesel ?? 0, aDiesel, "> R$ 7,60/L", "macro.diesel"),
  kpiLine("soja","Soja CEPEA (Nacional)", brl(c.soja), "R$/saca", delta.soja ?? 0, aSoja, "< R$ 125,00", "soy.soja"),
  kpiLine("sojaTO","Soja Oeste BA (AIBA)", brl(c.sojaTO), "R$/saca", delta.sojaTO ?? 0, aSojaTO, "> R$ 140,00", "soy.sojaTO"),
  kpiLine("trocaMap","Troca Soja/MAP", brl(troca.map, 1), "sacas/t", delta.trocaMap ?? 0, aTroca, "> 30 sacas/t", "soy.trocaMap"),
  "]",
].join("\n");

let html = readFileSync(HTML, "utf-8");

// ---------------------------------------------------------------------------
// 1) Bloco LIVE — valores usados nos textos e cartões das demais abas
// ---------------------------------------------------------------------------
const MESES_EXT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const mRef = /^([A-Za-zç]+)\/(\d{4})$/.exec(d.ref ?? "");
const MES_IDX = { jan:0, fev:1, mar:2, abr:3, mai:4, jun:5, jul:6, ago:7, set:8, out:9, nov:10, dez:11 };
const refMes = mRef && MES_IDX[mRef[1].toLowerCase().slice(0,3)] != null
  ? `${MESES_EXT[MES_IDX[mRef[1].toLowerCase().slice(0,3)]]} ${mRef[2]}`
  : (d.ref ?? "");

const refFert = refCurta(refs.ureia ?? refs.map ?? refs.kcl);
const spread = (c.soja != null && c.sojaTO != null) ? brl(c.soja - c.sojaTO) : "—";

const liveBlock = `const LIVE = {
  refMes:"${refMes}", refFert:"${refFert}", fertFechado:${delta.ureia != null},
  dolar:"${brl(c.dolar)}", ureia:"${int(c.ureia)}", map:"${int(c.map)}", kcl:"${int(c.kcl)}", gas:"${brl(c.gas)}",
  bdi:"${int(c.bdi)}", diesel:"${brl(c.diesel)}", soja:"${brl(c.soja)}", sojaTO:"${brl(c.sojaTO)}",
  trocaMap:"${brl(troca.map, 1)}", trocaUreia:"${brl(troca.ureia, 1)}", spread:"${spread}",
};`;

const reLive = /\/\* LIVE-START \*\/[\s\S]*?\/\* LIVE-END \*\//;
if (reLive.test(html)) {
  html = html.replace(reLive, `/* LIVE-START */\n// Valores da ultima leitura, reescritos pela automacao (patch-dashboard.mjs).\n${liveBlock}\n/* LIVE-END */`);
  console.log("[patch] bloco LIVE atualizado.");
}

// ---------------------------------------------------------------------------
// 2) Gatilhos (aba Gatilhos)
// ---------------------------------------------------------------------------
const st = (a) => a === "critical" ? "critical" : a === "warning" ? "warning" : "ok";
const alertsBlock = `const alerts = [
  { indicador:"Dólar", valor:"R$ ${brl(c.dolar)}", gatilho:"> R$ 5,60", status:"${st(aDolar)}", acao:"${aDolar === "ok" ? "Monitorar" : "Câmbio pressiona custo de importação"}" },
  { indicador:"Ureia FOB", valor:"US$ ${int(c.ureia)}/t", gatilho:"> US$ 430/t", status:"${st(aUreia)}", acao:"${aUreia === "ok" ? "Monitorar" : "Avaliar antecipação de compra / trava de preço"}" },
  { indicador:"MAP FOB", valor:"US$ ${int(c.map)}/t", gatilho:"> US$ 650/t", status:"${st(aMap)}", acao:"${aMap === "ok" ? "Monitorar" : "Acima do gatilho — reavaliar programação"}" },
  { indicador:"Gás Natural", valor:"US$ ${brl(c.gas)}/MMBtu", gatilho:"> US$ 3,00", status:"${st(aGas)}", acao:"${aGas === "ok" ? "Monitorar" : "Pressão sobre nitrogenados"}" },
  { indicador:"Frete Marítimo (BDI)", valor:"${int(c.bdi)} pts", gatilho:"> 2.300 pts", status:"${st(aBdi)}", acao:"${aBdi === "ok" ? "Monitorar" : "Elevado — encarece importação"}" },
  { indicador:"Diesel S10", valor:"R$ ${brl(c.diesel)}/L", gatilho:"> R$ 7,60/L", status:"${st(aDiesel)}", acao:"${aDiesel === "ok" ? "Monitorar" : "Pressiona frete rodoviário"}" },
  { indicador:"Soja CEPEA", valor:"R$ ${brl(c.soja)}/saca", gatilho:"< R$ 125,00", status:"${st(aSoja)}", acao:"${aSoja === "ok" ? "Monitorar" : "Queda pode atrasar compras do agro"}" },
  { indicador:"Troca Soja/MAP", valor:"${brl(troca.map, 1)} sacas/t", gatilho:"> 30 sacas/t", status:"${st(aTroca)}", acao:"${aTroca === "ok" ? "Monitorar" : "Risco de demanda concentrada no 2º sem."}" },
]`;

const reAlerts = /\/\* ALERTS-START \*\/[\s\S]*?\/\* ALERTS-END \*\//;
if (reAlerts.test(html)) {
  html = html.replace(reAlerts, `/* ALERTS-START */\n${alertsBlock}; /* ALERTS-END */`);
  console.log("[patch] gatilhos atualizados.");
}

// ---------------------------------------------------------------------------
// 3) Séries históricas — acrescenta um ponto quando o mês vira
// ---------------------------------------------------------------------------
const ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const hoje = new Date();
const rotuloMes = `${ABREV[hoje.getMonth()]}/${String(hoje.getFullYear()).slice(2)}`;

const mMonths = /const MONTHS = \[([^\]]*)\];/.exec(html);
if (mMonths) {
  const ultimo = mMonths[1].split(",").pop().replace(/["\s]/g, "");
  if (ultimo !== rotuloMes) {
    const push = (nome, valor) => {
      const re = new RegExp(`(\\b${nome}:\\[)([^\\]]*)(\\])`);
      const m = re.exec(html);
      if (!m || valor == null) return;
      html = html.replace(re, `$1$2,${valor}$3`);
    };
    html = html.replace(/const MONTHS = \[([^\]]*)\];/, `const MONTHS = [$1,"${rotuloMes}"];`);
    push("ureia", c.ureia); push("map", c.map); push("kcl", c.kcl);
    push("dolar", c.dolar); push("gas", c.gas); push("diesel", c.diesel); push("bdi", c.bdi);
    push("soja", c.soja); push("trocaMap", troca.map); push("trocaUreia", troca.ureia);
    console.log(`[patch] série histórica estendida com ${rotuloMes}.`);
  } else {
    console.log(`[patch] série já contém ${rotuloMes} — nada a acrescentar.`);
  }
}

// 1) substitui bloco entre marcadores
const re = /\/\* KPIS-START \*\/[\s\S]*?\/\* KPIS-END \*\//;
if (!re.test(html)) { console.error("[patch] marcadores KPIS-START/END não encontrados no HTML."); process.exit(1); }
html = html.replace(re, `/* KPIS-START */\n${kpisBlock}; /* KPIS-END */`);

// 2) atualiza selo de referência
html = html.replace(/Dados base · [^<]*/, `Dados base · ${d.ref}`);

writeFileSync(HTML, html, "utf-8");
console.log(`[patch] dashboard.html atualizado (ref ${d.ref}).`);
