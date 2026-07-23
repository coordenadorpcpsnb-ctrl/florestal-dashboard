/**
 * fetch-data.mjs — Busca os indicadores macro e monta o data.json
 *
 * Auto-buscados:  Câmbio (AwesomeAPI), Soja CEPEA (scrape), Diesel S10 (scrape ANP), BDI (stooq),
 *                 Ureia/MAP/KCl (ComexStat — API oficial MDIC), Gás Natural (EIA ou stooq)
 *
 * fertilizers-override.json continua funcionando como:
 *   - fallback quando a busca automática falha
 *   - trava manual, se o arquivo tiver "forceManual": true
 *
 * Cada fonte tem fallback: se a busca falhar, mantém o último valor conhecido (de data.json anterior)
 * e registra o status. O job NUNCA quebra por falha de uma fonte — apenas degrada e loga.
 *
 * Saída: data.json (current + previous + delta % + trocas + status por fonte)
 */
import * as cheerio from "cheerio";
import { buscarFertilizantes, buscarGasNatural } from "./fetch-fertilizers.mjs";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data.json");
const OVERRIDE = join(__dirname, "fertilizers-override.json");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const status = {};

function log(msg) { console.log(`[fetch] ${msg}`); }

const cortar = (t, n = 160) => String(t).replace(/\s+/g, " ").slice(0, n);

/** Câmbio: BCB PTAX (oficial) -> Frankfurter -> AwesomeAPI. */
async function getCambio() {
  const erros = [];

  // 1) Banco Central (PTAX) — oficial, sem chave, tolerante a datacenter
  try {
    const p = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
    const hoje = new Date();
    const ini = new Date(hoje.getTime() - 12 * 864e5);          // 12 dias atrás (cobre feriados)
    const url = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/"
      + `CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)`
      + `?@dataInicial='${p(ini)}'&@dataFinalCotacao='${p(hoje)}'`
      + "&$format=json&$orderby=dataHoraCotacao%20desc&$top=1";
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = parseFloat(JSON.parse(txt)?.value?.[0]?.cotacaoVenda);
    if (Number.isNaN(v) || v < 1 || v > 30) throw new Error(`valor implausivel :: ${cortar(txt, 120)}`);
    status.cambio = "ok (BCB PTAX)";
    return Math.round(v * 100) / 100;
  } catch (e) { erros.push("BCB: " + e.message); }

  // 2) Frankfurter — gratuito, sem chave
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=BRL",
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = parseFloat((await r.json())?.rates?.BRL);
    if (Number.isNaN(v) || v < 1 || v > 30) throw new Error("valor implausivel");
    status.cambio = "ok (Frankfurter)";
    return Math.round(v * 100) / 100;
  } catch (e) { erros.push("Frankfurter: " + e.message); }

  // 3) AwesomeAPI — pode retornar 429 em IP de datacenter
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL",
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = parseFloat((await r.json()).USDBRL.bid);
    if (Number.isNaN(v)) throw new Error("parse falhou");
    status.cambio = "ok (AwesomeAPI)";
    return Math.round(v * 100) / 100;
  } catch (e) { erros.push("AwesomeAPI: " + e.message); }

  status.cambio = "falha: " + erros.join(" | ");
  return null;
}

/**
 * Soja — Indicador CEPEA/ESALQ Paraná (R$/saca 60kg).
 * Fonte primária: Notícias Agrícolas, que republica o indicador do CEPEA e,
 * ao contrário do site do CEPEA, não bloqueia servidores de datacenter.
 * Fallback: site do CEPEA direto.
 */
async function getSoja() {
  const erros = [];

  // 1) Notícias Agrícolas — página do indicador CEPEA/ESALQ Paraná
  try {
    const url = "https://www.noticiasagricolas.com.br/cotacoes/soja/indicador-cepea-esalq-soja-parana";
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    const $ = cheerio.load(html);

    // Procura a primeira linha de tabela no formato: DD/MM/AAAA | 135,73 | +1,21
    let preco = null, dataRef = null;
    $("table tr").each((_i, tr) => {
      if (preco !== null) return;
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      const c0 = $(tds[0]).text().trim();
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(c0)) return;
      const v = parseFloat($(tds[1]).text().trim().replace(/\./g, "").replace(",", "."));
      if (!Number.isNaN(v) && v > 30 && v < 500) { preco = v; dataRef = c0; }
    });

    if (preco === null) throw new Error(`parse falhou :: ${cortar(html.replace(/<[^>]+>/g, " "), 140)}`);
    status.soja = `ok (Noticias Agricolas / CEPEA-PR ${dataRef})`;
    return preco;
  } catch (e) { erros.push("NoticiasAgricolas: " + e.message); }

  // 2) CEPEA direto (costuma bloquear datacenter, mas tentamos)
  try {
    const r = await fetch("https://www.cepea.esalq.usp.br/br/indicador/soja.aspx",
      { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const $ = cheerio.load(await r.text());
    let preco = 0;
    $("#imagenet-indicador1 tbody tr").first().find("td").each((i, td) => {
      if (i === 1) preco = parseFloat($(td).text().trim().replace(".", "").replace(",", "."));
    });
    if (!preco || isNaN(preco)) throw new Error("parse falhou");
    status.soja = "ok (CEPEA direto)";
    return preco;
  } catch (e) { erros.push("CEPEA: " + e.message); }

  status.soja = "falha: " + erros.join(" | ");
  return null;
}

/**
 * Soja regional — mercado físico do Oeste da Bahia (AIBA), na tabela
 * "Soja - Mercado Físico" do Notícias Agrícolas.
 * Referência mais próxima do MATOPIBA disponível publicamente
 * (a fonte não publica cotação de Tocantins).
 */
async function getSojaRegional() {
  try {
    const r = await fetch("https://www.noticiasagricolas.com.br/cotacoes/soja", {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const $ = cheerio.load(await r.text());

    // procura a linha cuja 1a celula contenha "Oeste da Bahia"
    let preco = null, praca = null;
    $("table tr").each((_i, tr) => {
      if (preco !== null) return;
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      const nome = $(tds[0]).text().trim();
      if (!/oeste\s+da\s+bahia/i.test(nome)) return;
      const bruto = $(tds[1]).text().trim();
      if (/s\/\s*cota/i.test(bruto)) return;                 // "s/ cotação"
      const v = parseFloat(bruto.replace(/\./g, "").replace(",", "."));
      if (!Number.isNaN(v) && v > 30 && v < 500) { preco = v; praca = nome; }
    });

    if (preco === null) throw new Error("linha 'Oeste da Bahia' nao encontrada");
    status.sojaRegional = `ok (${praca})`;
    return preco;
  } catch (e) {
    status.sojaRegional = "falha: " + e.message;
    return null;
  }
}

/**
 * Diesel S10 (R$/L, preço ao consumidor final).
 * 1) Petrobras — média Brasil, elaborada a partir de dados da ANP. Oficial e atualizada semanalmente.
 * 2) Portal Canaã — média do Tocantins (regional), usado se a Petrobras falhar.
 * A coleta é datada; se estiver muito antiga, o status avisa.
 */
async function getDiesel() {
  const erros = [];
  const hoje = new Date();

  /** calcula a idade, em dias, de uma data DD/MM/AAAA */
  const idadeDias = (txt) => {
    const m = txt?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Math.round((hoje - d) / 864e5);
  };

  // 1) Petrobras — média Brasil
  try {
    const r = await fetch("https://precos.petrobras.com.br/precos-diesel", {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const texto = cheerio.load(await r.text()).text().replace(/\s+/g, " ");

    // tenta os formatos em que o valor aparece na página
    const padroes = [
      /Pre[çc]o\s+M[ée]dio\s+do\s+Brasil[:\s]*R?\$?\s*(\d{1,2}[,.]\d{2})/i,
      /Pre[çc]o\s+M[ée]dio\s*>?\s*BR\s*(\d{1,2}[,.]\d{2})/i,
    ];
    let preco = null;
    for (const p of padroes) {
      const m = texto.match(p);
      if (m) { preco = parseFloat(m[1].replace(",", ".")); break; }
    }
    if (preco === null || Number.isNaN(preco) || preco < 3 || preco > 15)
      throw new Error(`parse falhou :: ${cortar(texto, 160)}`);

    const per = texto.match(/Per[íi]odo\s+de\s+coleta\s+de\s+([\d/]+)\s+a\s+([\d/]+)/i);
    const idade = per ? idadeDias(per[2]) : null;
    status.diesel = `ok (Petrobras, media Brasil${per ? `, coleta ate ${per[2]}` : ""})`;
    if (idade != null && idade > 45) status.diesel += ` [ATENCAO: coleta com ${idade} dias]`;
    return preco;
  } catch (e) { erros.push("Petrobras: " + e.message); }

  // 2) Portal Canaã — média do Tocantins
  try {
    const r = await fetch("https://combustivel.portalcanaa.com.br/?estado=tocantins", {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    const $ = cheerio.load(html);

    let preco = null;
    $("table tr").each((_i, tr) => {
      if (preco !== null) return;
      const tds = $(tr).find("td");
      if (tds.length < 2) return;
      if (!/diesel\s*s\s*-?\s*10/i.test($(tds[0]).text())) return;
      const bruto = $(tds[1]).text().trim().replace(/R\$\s*/i, "");
      // a página usa ponto como separador decimal (ex.: 7.31)
      const v = parseFloat(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
      if (!Number.isNaN(v) && v > 3 && v < 15) preco = v;
    });
    if (preco === null) throw new Error("linha 'Diesel S10' nao encontrada");

    const coleta = cheerio.load(html).text().match(/[ÚU]ltima\s+coleta[:\s]*([\d/]+)/i);
    const idade = coleta ? idadeDias(coleta[1]) : null;
    status.diesel = `ok (Portal Canaa, Tocantins${coleta ? `, coleta ${coleta[1]}` : ""})`;
    if (idade != null && idade > 45) status.diesel += ` [ATENCAO: coleta com ${idade} dias]`;
    return preco;
  } catch (e) { erros.push("PortalCanaa: " + e.message); }

  status.diesel = "falha: " + erros.join(" | ");
  return null;
}

/**
 * BDI (Baltic Dry Index) — HANDYBULK publica o índice diariamente em texto corrido.
 * Site estático, sem bloqueio de bot. Formato das entradas:
 *   "21-July-2026"
 *   "The Baltic Dry Index (BDI) decreased by 1 point to reach 2,670 points."
 * Fallback: stooq (hoje devolve pagina de bloqueio, mas fica como segunda opcao).
 */
async function getBdi() {
  const erros = [];
  const MESES = { january:1, february:2, march:3, april:4, may:5, june:6,
                  july:7, august:8, september:9, october:10, november:11, december:12 };

  try {
    const r = await fetch("https://www.handybulk.com/baltic-dry-index/", {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const texto = cheerio.load(await r.text()).text().replace(/\s+/g, " ");

    // primeira ocorrencia = entrada mais recente
    const m = texto.match(/Baltic Dry Index \(BDI\)[^.]*?(?:to reach|unchanged at)\s+([\d.,]+)\s+points/i);
    if (!m) throw new Error(`padrao nao encontrado :: ${cortar(texto, 160)}`);

    const v = parseInt(m[1].replace(/[.,]/g, ""), 10);
    if (Number.isNaN(v) || v < 300 || v > 12000) throw new Error(`valor implausivel (${v})`);

    // data da entrada: procura "DD-Mes-AAAA" antes do trecho encontrado
    let ref = null, idade = null;
    const antes = texto.slice(0, m.index);
    const datas = [...antes.matchAll(/(\d{1,2})-([A-Za-z]+)-(\d{4})/g)];
    const d = datas[datas.length - 1];
    if (d && MESES[d[2].toLowerCase()]) {
      const dt = new Date(Number(d[3]), MESES[d[2].toLowerCase()] - 1, Number(d[1]));
      ref = `${String(d[1]).padStart(2, "0")}/${String(MESES[d[2].toLowerCase()]).padStart(2, "0")}/${d[3]}`;
      idade = Math.round((new Date() - dt) / 864e5);
    }

    status.bdi = `ok (HANDYBULK${ref ? `, ${ref}` : ""})`;
    if (idade != null && idade > 15) status.bdi += ` [ATENCAO: dado com ${idade} dias]`;
    return v;
  } catch (e) { erros.push("HANDYBULK: " + e.message); }

  // fallback: stooq
  try {
    const r = await fetch("https://stooq.com/q/d/l/?s=bdi&i=d&l=2",
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const bruto = await r.text();
    const lines = bruto.trim().split("\n").filter(l => !/^date/i.test(l));
    const v = parseFloat(lines[lines.length - 1]?.split(",")[4]);
    if (isNaN(v) || v < 300) throw new Error(`valor implausivel :: resposta="${cortar(bruto, 100)}"`);
    status.bdi = "ok (stooq)";
    return Math.round(v);
  } catch (e) { erros.push("stooq: " + e.message); }

  status.bdi = "falha: " + erros.join(" | ");
  return null;
}

// --- principal ---
const prev = existsSync(DATA) ? JSON.parse(readFileSync(DATA, "utf-8")) : null;
const prevCur = prev?.current ?? {};
const fb = (v, key) => (v == null ? (prevCur[key] ?? null) : v); // fallback ao último valor

log("buscando câmbio, soja, diesel, BDI...");
const [cambio, soja, sojaRegional, diesel, bdi] = await Promise.all([getCambio(), getSoja(), getSojaRegional(), getDiesel(), getBdi()]);

log("buscando fertilizantes (ComexStat) e gás natural...");
const fert = await buscarFertilizantes(status);
const gasAuto = await buscarGasNatural(status);

// override manual: fallback quando a automação falha, ou trava se forceManual = true
let ov = {};
if (existsSync(OVERRIDE)) ov = JSON.parse(readFileSync(OVERRIDE, "utf-8"));
const travado = ov.forceManual === true;
if (travado) {
  status.override = "forceManual ativo — valores manuais tem prioridade";
  log("AVISO: forceManual=true, os valores do override sobrepoem a busca automatica.");
}

/** ordem: trava manual > automático > override (fallback) > leitura anterior */
const escolher = (auto, manual, anterior) =>
  travado ? (manual ?? auto ?? anterior ?? null)
          : (auto ?? manual ?? anterior ?? null);

const current = {
  dolar:     escolher(cambio, ov.dolar, prevCur.dolar),
  ureia:     escolher(fert.ureia, ov.ureia, prevCur.ureia),
  map:       escolher(fert.map,   ov.map,   prevCur.map),
  kcl:       escolher(fert.kcl,   ov.kcl,   prevCur.kcl),
  gas:       escolher(gasAuto,    ov.gasNatural, prevCur.gas),
  bdi:       escolher(bdi,    ov.bdi,    prevCur.bdi),
  diesel:    escolher(diesel, ov.diesel, prevCur.diesel),
  soja:      escolher(soja,   ov.soja,   prevCur.soja),
};
// Soja regional: valor real (AIBA Oeste da Bahia) > override > estimativa (95,7% do CEPEA) > leitura anterior
if (sojaRegional != null) {
  current.sojaTO = sojaRegional;
} else if (ov.sojaTO != null) {
  current.sojaTO = ov.sojaTO;
  status.sojaRegional += " -> usando valor manual do override";
} else if (current.soja != null) {
  current.sojaTO = Math.round(current.soja * 0.957 * 100) / 100;
  status.sojaRegional += " -> usando estimativa (95,7% do CEPEA)";
} else {
  current.sojaTO = prevCur.sojaTO ?? null;
  status.sojaRegional += " -> usando leitura anterior";
}

// relação de troca (preço FOB convertido a R$ ÷ preço soja)
const troca = {};
if (current.map && current.soja && current.dolar)   troca.map   = Math.round(((current.map  * current.dolar + 120) / current.soja) * 10) / 10;
if (current.ureia && current.soja && current.dolar) troca.ureia = Math.round(((current.ureia* current.dolar + 100) / current.soja) * 10) / 10;

// deltas % vs leitura anterior
const delta = {};
for (const k of Object.keys(current)) {
  if (prevCur[k] != null && current[k] != null && prevCur[k] !== 0) {
    delta[k] = Math.round(((current[k] - prevCur[k]) / prevCur[k]) * 1000) / 10;
  } else delta[k] = 0;
}

// Fertilizantes fecham uma vez por mes. Se o mes de referencia nao mudou desde a
// leitura anterior, nao houve novo fechamento: delta = null (em vez de 0,0%, que
// daria a entender "estavel na semana").
const refsAnteriores = prev?.refsFertilizantes ?? {};
for (const k of ["ureia", "map", "kcl"]) {
  const refAtual = fert.refs?.[k] ?? null;
  const refAnterior = refsAnteriores[k] ?? null;
  if (refAtual && refAnterior && refAtual === refAnterior) delta[k] = null;
}
if (prev?.troca?.map != null && troca.map != null && prev.troca.map !== 0)
  delta.trocaMap = Math.round(((troca.map - prev.troca.map) / prev.troca.map) * 1000) / 10;
else delta.trocaMap = 0;

const now = new Date();
const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const out = {
  updatedAt: now.toISOString(),
  updatedAtBR: now.toLocaleString("pt-BR"),
  ref: `${meses[now.getMonth()]}/${now.getFullYear()}`,
  current, previous: prevCur, delta, troca, status,
  refsFertilizantes: { ...refsAnteriores, ...(fert.refs ?? {}) },
};
writeFileSync(DATA, JSON.stringify(out, null, 2), "utf-8");

log("status das fontes: " + JSON.stringify(status));
log(`câmbio=${current.dolar} soja=${current.soja} diesel=${current.diesel} bdi=${current.bdi} | ureia=${current.ureia} map=${current.map} kcl=${current.kcl} gás=${current.gas}`);
log("data.json gravado.");
