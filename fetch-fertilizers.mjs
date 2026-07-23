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
/**
 * Executa um POST no /general com o corpo informado.
 * Retenta em caso de HTTP 429 (limite de requisições).
 */
async function postar(body, status, etiqueta) {
  const esperas = [0, 15000, 30000];
  let ultimoErro = "";

  for (let i = 0; i < esperas.length; i++) {
    if (esperas[i]) {
      status._comexRetry = `aguardando ${esperas[i] / 1000}s apos 429 (${etiqueta}, tentativa ${i + 1})`;
      await dormir(esperas[i]);
    }
    try {
      const r = await fetch(`${BASE}/general?language=pt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA, Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
      });
      const txt = await r.text();
      if (r.status === 429) { ultimoErro = "HTTP 429"; continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status} :: ${cortar(txt, 100)}`);
      let json;
      try { json = JSON.parse(txt); } catch { throw new Error(`nao-JSON :: ${cortar(txt, 100)}`); }
      return { json, txt };
    } catch (e) {
      ultimoErro = e.message;
      if (!/429/.test(ultimoErro)) break;
    }
  }
  throw new Error(ultimoErro || "falha desconhecida");
}

/** Agrupa as linhas por produto e calcula US$/t do mês mais recente com volume */
function precosPorProduto(linhas) {
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
      if (kg > 1_000_000) {
        out[produto] = { preco: Math.round((fob / (kg / 1000)) * 10) / 10, ref: meses[i] };
        break;
      }
    }
  }
  return out;
}

/** Lista os NCMs presentes na resposta, para diagnóstico */
function ncmsPresentes(linhas) {
  const vistos = new Map();
  for (const l of linhas) {
    const { ncm, kg } = normalizar(l);
    if (!ncm) continue;
    vistos.set(ncm, (vistos.get(ncm) ?? 0) + (kg ?? 0));
  }
  return [...vistos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n).join(",");
}

export async function buscarFertilizantes(status) {
  const out = { ureia: null, map: null, kcl: null, refs: {} };
  const hoje = new Date();

  // Períodos a tentar (a defasagem de publicação varia de 1 a 4 meses)
  const periodos = [1, 2, 3].map(back => ({ from: ym(hoje, -back - 11), to: ym(hoje, -back) }));

  // Variantes de consulta, da mais específica para a mais ampla.
  // A variante "heading" filtra pela posição HS4 (3102/3104/3105) em vez do NCM de 8 dígitos:
  // é imune a divergências no código NCM e devolve o NCM em cada linha, o que permite
  // selecionar os produtos do nosso lado.
  const variantes = [
    { nome: "ncm-numero", filtro: () => [{ filter: "ncm", values: TODOS_NCM }] },
    { nome: "ncm-texto",  filtro: () => [{ filter: "ncm", values: TODOS_NCM.map(String) }] },
    { nome: "heading",    filtro: () => [{ filter: "heading", values: [3102, 3104, 3105] }] },
  ];

  let linhas = null, usado = "", ultimoErro = "", primeiroVazio = "";

  busca:
  for (const v of variantes) {
    for (const p of periodos) {
      try {
        const body = {
          flow: "import",
          monthDetail: true,
          period: { from: p.from, to: p.to },
          filters: v.filtro(),
          details: ["ncm"],
          metrics: ["metricFOB", "metricKG"],
        };
        const { json, txt } = await postar(body, status, v.nome);
        const achadas = acharLinhas(json);
        if (achadas?.length) {
          linhas = achadas;
          usado = `${v.nome} | ${p.from} a ${p.to} | ${achadas.length} linhas`;
          break busca;
        }
        if (!primeiroVazio) primeiroVazio = `vazio: ${v.nome} ${p.from}..${p.to} :: ${cortar(txt, 110)}`;
        ultimoErro = `vazio (${v.nome}, ${p.from} a ${p.to})`;
      } catch (e) {
        ultimoErro = `${v.nome}: ${e.message}`;
        if (/429/.test(ultimoErro)) await dormir(20000);
      }
      await dormir(6000);          // respiro entre consultas (limite da API)
    }
  }

  if (!linhas) {
    status._comexDiag = primeiroVazio || ultimoErro;
    for (const p of ["ureia", "map", "kcl"]) status[p] = "falha: " + ultimoErro;
    return out;
  }

  status._comexPeriodo = usado;
  status._comexNcmsEncontrados = ncmsPresentes(linhas);

  const precos = precosPorProduto(linhas);
  for (const produto of ["ureia", "map", "kcl"]) {
    const r = precos[produto];
    if (!r) { status[produto] = `falha: NCM nao veio na resposta (encontrados: ${status._comexNcmsEncontrados})`; continue; }
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
    const prefixo = chave ? status.gas + " | " : "SEM EIA_API_KEY configurada | ";
    status.gas = prefixo + "falha stooq: " + e.message;
    return null;
  }
}
