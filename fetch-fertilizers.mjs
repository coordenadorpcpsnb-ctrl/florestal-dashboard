/**
 * fetch-fertilizers.mjs — Fertilizantes (ComexStat) e gás natural.
 *
 * CORREÇÕES desta versão (após diagnóstico HTTP 429):
 *  1. UMA ÚNICA requisição para os 4 NCMs (antes eram até 7 chamadas seguidas,
 *     o que estourava o limite do ComexStat: "Você excedeu o limite de solicitações").
 *  2. Se ainda vier 429, espera e tenta de novo (15s, depois 30s).
 *  3. Período fixo: últimos 12 meses terminando no MÊS ANTERIOR.
 *     A detecção automática de data pegava a data de atualização do banco
 *     (mês corrente), que ainda não tem dados publicados.
 *  4. As linhas são separadas por NCM para calcular cada produto.
 */

const UA = "Mozilla/5.0 (compatible; florestal-dashboard/1.0; +https://github.com)";
const BASE = "https://api-comexstat.mdic.gov.br";

const FAIXAS = { ureia: [150, 1200], map: [200, 1500], kcl: [100, 1200] };

/** NCM -> produto (confirmados na tabela NCM/TIPI) */
const NCM_PRODUTO = {
  31021010: "ureia",   // Ureia com mais de 45% de nitrogênio
  31054000: "map",     // MAP — diidrogeno-ortofosfato de amônio
  31042010: "kcl",     // Cloreto de potássio, K2O <= 60%
  31042090: "kcl",     // Cloreto de potássio, outros
};
const TODOS_NCM = Object.keys(NCM_PRODUTO).map(Number);

const cortar = (t, n = 200) => String(t).replace(/\s+/g, " ").slice(0, n);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function ym(d, offset = 0) {
  const x = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

/** Procura recursivamente o primeiro array de objetos que tenha alguma chave com "fob" */
function acharLinhas(no, prof = 0) {
  if (prof > 6 || no == null) return null;
  if (Array.isArray(no)) {
    if (no.length && typeof no[0] === "object" && no[0] !== null) {
      if (/fob/i.test(Object.keys(no[0]).join(" "))) return no;
    }
    for (const item of no) {
      const r = acharLinhas(item, prof + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof no === "object") {
    for (const v of Object.values(no)) {
      const r = acharLinhas(v, prof + 1);
      if (r) return r;
    }
  }
  return null;
}

/** Extrai ncm, ano, mês, FOB e KG de uma linha, tolerando variações de nomenclatura */
function normalizar(row) {
  let ncm = null, ano = null, mes = null, fob = null, kg = null;
  for (const [chave, valor] of Object.entries(row)) {
    const k = chave.toLowerCase();
    const bruto = String(valor).replace(/[^\d.-]/g, "");
    const num = typeof valor === "number" ? valor : parseFloat(bruto);
    if (ncm === null && /ncm/.test(k) && /^\d{8}$/.test(bruto)) { ncm = bruto; continue; }
    if (Number.isNaN(num)) continue;
    if (fob === null && /fob/.test(k)) fob = num;
    else if (kg === null && /(kg|peso|weight)/.test(k)) kg = num;
    else if (ano === null && /(year|ano)/.test(k) && num > 1990 && num < 2100) ano = num;
    else if (mes === null && /(month|mes)/.test(k) && num >= 1 && num <= 12) mes = num;
  }
  return { ncm, ano, mes, fob, kg };
}

/** POST único com todos os NCMs, com retentativa em caso de 429 */
async function consultarTudo(comoTexto, from, to, status) {
  const body = {
    flow: "import",
    monthDetail: true,
    period: { from, to },
    filters: [{ filter: "ncm", values: comoTexto ? TODOS_NCM.map(String) : TODOS_NCM }],
    details: ["ncm"],
    metrics: ["metricFOB", "metricKG"],
  };

  const esperas = [0, 15000, 30000];          // 1a tentativa imediata; depois 15s e 30s
  let ultimoErro = "";

  for (let i = 0; i < esperas.length; i++) {
    if (esperas[i]) {
      status._comexRetry = `aguardando ${esperas[i] / 1000}s apos HTTP 429 (tentativa ${i + 1})`;
      await dormir(esperas[i]);
    }
    try {
      const r = await fetch(`${BASE}/general?language=pt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA, Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(40000),
      });
      const txt = await r.text();

      if (r.status === 429) { ultimoErro = `HTTP 429 :: ${cortar(txt, 120)}`; continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status} :: ${cortar(txt, 120)}`);

      let json;
      try { json = JSON.parse(txt); } catch { throw new Error(`resposta nao-JSON :: ${cortar(txt, 140)}`); }
      return { json, txt };
    } catch (e) {
      ultimoErro = e.message;
      if (!/429/.test(ultimoErro)) break;      // erro que não é limite: não adianta repetir
    }
  }
  throw new Error(ultimoErro || "falha desconhecida");
}

/** Agrupa as linhas por produto e calcula US$/t do mês mais recente com volume */
function precosPorProduto(linhas) {
  // produto -> mês -> {fob, kg}
  const acc = {};
  for (const l of linhas) {
    const { ncm, ano, mes, fob, kg } = normalizar(l);
    if (ano == null || mes == null || fob == null || kg == null) continue;
    const produto = ncm ? NCM_PRODUTO[Number(ncm)] : null;
    if (!produto) continue;
    const chaveMes = `${ano}-${String(mes).padStart(2, "0")}`;
    acc[produto] ??= new Map();
    const a = acc[produto].get(chaveMes) ?? { fob: 0, kg: 0 };
    a.fob += fob; a.kg += kg;
    acc[produto].set(chaveMes, a);
  }

  const out = {};
  for (const [produto, porMes] of Object.entries(acc)) {
    const meses = [...porMes.keys()].sort();
    for (let i = meses.length - 1; i >= 0; i--) {
      const { fob, kg } = porMes.get(meses[i]);
      if (kg > 1_000_000) {                       // pelo menos ~1.000 t importadas
        out[produto] = { preco: Math.round((fob / (kg / 1000)) * 10) / 10, ref: meses[i] };
        break;
      }
    }
  }
  return out;
}

export async function buscarFertilizantes(status) {
  const out = { ureia: null, map: null, kcl: null, refs: {} };
  const hoje = new Date();

  let linhas = null, ultimoErro = "", amostra = "", periodoUsado = "";

  // A API devolve TUDO vazio se o mês final pedido ainda não foi publicado.
  // Por isso recuamos mês a mês até encontrar dados (a defasagem varia de 1 a 4 meses).
  const tentativas = [];
  for (let back = 1; back <= 4; back++) tentativas.push({ back, comoTexto: false });
  tentativas.push({ back: 2, comoTexto: true });        // última cartada: NCM como texto

  for (let i = 0; i < tentativas.length; i++) {
    const { back, comoTexto } = tentativas[i];
    const to = ym(hoje, -back);
    const from = ym(hoje, -back - 11);                   // janela de 12 meses

    if (i > 0) await dormir(8000);                      // respiro entre tentativas (limite da API)

    try {
      const { json, txt } = await consultarTudo(comoTexto, from, to, status);
      const achadas = acharLinhas(json);
      if (achadas?.length) {
        linhas = achadas;
        amostra = cortar(JSON.stringify(achadas[0]), 200);
        periodoUsado = `${from} a ${to}`;
        break;
      }
      ultimoErro = `vazio para ${from} a ${to}${comoTexto ? " (ncm como texto)" : ""}`;
    } catch (e) {
      ultimoErro = e.message;
      if (/429/.test(ultimoErro)) await dormir(20000);   // limite atingido: espera mais
    }
  }

  status._comexPeriodo = periodoUsado || `nenhum periodo retornou dados (ultimo: ${ultimoErro})`;

  if (!linhas) {
    for (const p of ["ureia", "map", "kcl"]) status[p] = "falha: " + ultimoErro;
    return out;
  }

  const precos = precosPorProduto(linhas);
  for (const produto of ["ureia", "map", "kcl"]) {
    const r = precos[produto];
    if (!r) { status[produto] = `falha: sem dados para o produto :: amostra=${amostra}`; continue; }
    const [min, max] = FAIXAS[produto];
    if (r.preco < min || r.preco > max) { status[produto] = `falha: valor implausivel (${r.preco})`; continue; }
    out[produto] = r.preco;
    out.refs[produto] = r.ref;
    status[produto] = `ok (ComexStat ${r.ref})`;
  }
  return out;
}

/** Gás natural: EIA (chave) -> stooq -> null. */
export async function buscarGasNatural(status) {
  const chave = process.env.EIA_API_KEY;
  if (chave) {
    try {
      const url = "https://api.eia.gov/v2/natural-gas/pri/fut/data/"
        + `?api_key=${chave}&frequency=daily&data[0]=value`
        + "&facets[series][]=RNGWHHD&sort[0][column]=period&sort[0][direction]=desc&length=1";
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      const txt = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status} :: ${cortar(txt, 120)}`);
      const v = parseFloat(JSON.parse(txt)?.response?.data?.[0]?.value);
      if (Number.isNaN(v) || v <= 0 || v > 50) throw new Error(`valor implausivel :: ${cortar(txt, 140)}`);
      status.gas = "ok (EIA Henry Hub)";
      return Math.round(v * 100) / 100;
    } catch (e) { status.gas = "falha EIA: " + e.message; }
  } else {
    status.gas = "sem EIA_API_KEY — tentando stooq";
  }

  try {
    const r = await fetch("https://stooq.com/q/d/l/?s=ng.f&i=d&l=2",
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
    const txt = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const linhas = txt.trim().split("\n").filter(l => !/^date/i.test(l));
    const v = parseFloat(linhas[linhas.length - 1]?.split(",")[4]);
    if (Number.isNaN(v) || v <= 0 || v > 50) throw new Error(`valor implausivel :: resposta="${cortar(txt, 120)}"`);
    status.gas = "ok (stooq — futuro NG)";
    return Math.round(v * 100) / 100;
  } catch (e) {
    status.gas = (status.gas.startsWith("falha") ? status.gas + " | " : "") + "falha stooq: " + e.message;
    return null;
  }
}
