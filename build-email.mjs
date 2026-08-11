/**
 * build-email.mjs — Monta o corpo (HTML) do e-mail semanal a partir do data.json.
 *
 * Saída: email-body.html  (usado pelo workflow em `html_body: file://email-body.html`)
 *        email-subject.txt (assunto, com destaque quando há gatilho acionado)
 *
 * O e-mail é um resumo; o detalhamento vai no PDF anexado.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data.json");

if (!existsSync(DATA)) { console.error("[email] data.json não encontrado."); process.exit(1); }

const d = JSON.parse(readFileSync(DATA, "utf-8"));
const c = d.current ?? {}, delta = d.delta ?? {}, troca = d.troca ?? {}, refs = d.refsFertilizantes ?? {};

const NAVY = "#1E2A44", EMER = "#2F8A5F", BORD = "#B23636", MUTE = "#6B7585", LINE = "#DDDDDD";

const brl = (v, dec = 2) => v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const int = (v) => v == null ? "—" : Math.round(v).toLocaleString("pt-BR");
const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const refCurta = (r) => { const m = /^(\d{4})-(\d{2})$/.exec(r ?? ""); return m ? `${MES[+m[2]-1]}/${m[1].slice(2)}` : "—"; };

/** célula de variação: colorida, ou "—" quando não houve novo fechamento */
function varCell(x, invertido = false) {
  if (x == null) return `<td style="padding:7px 10px;text-align:right;color:${MUTE};border-bottom:1px solid ${LINE}">—</td>`;
  const alta = x > 0;
  const ruim = invertido ? !alta : alta;                 // custo subindo = ruim
  const cor = Math.abs(x) < 0.3 ? MUTE : (ruim ? BORD : EMER);
  const txt = (alta ? "+" : "") + x.toFixed(1).replace(".", ",") + "%";
  return `<td style="padding:7px 10px;text-align:right;font-weight:600;color:${cor};border-bottom:1px solid ${LINE}">${txt}</td>`;
}
const cel = (t, extra = "") => `<td style="padding:7px 10px;border-bottom:1px solid ${LINE};${extra}">${t}</td>`;
const num = (t) => cel(t, "text-align:right;font-variant-numeric:tabular-nums;");

function tabela(titulo, linhas) {
  return `<h3 style="font:600 14px Arial,sans-serif;color:${NAVY};margin:22px 0 8px">${titulo}</h3>
<table style="width:100%;border-collapse:collapse;font:13px Arial,sans-serif">
<tr style="background:${NAVY};color:#fff">
  <th style="padding:7px 10px;text-align:left;font-size:12px">Indicador</th>
  <th style="padding:7px 10px;text-align:right;font-size:12px">Atual</th>
  <th style="padding:7px 10px;text-align:right;font-size:12px">Var.</th>
</tr>
${linhas.join("\n")}
</table>`;
}

// ---- gatilhos acionados ----
const gatilhos = [];
if (c.ureia > 430)  gatilhos.push(`Ureia FOB em US$ ${int(c.ureia)}/t (gatilho: US$ 430/t)`);
if (c.map > 650)    gatilhos.push(`MAP FOB em US$ ${int(c.map)}/t (gatilho: US$ 650/t)`);
if (c.dolar > 5.60) gatilhos.push(`Dólar em R$ ${brl(c.dolar)} (gatilho: R$ 5,60)`);
if (c.gas > 3.0)    gatilhos.push(`Gás natural em US$ ${brl(c.gas)}/MMBtu (gatilho: US$ 3,00)`);
if (c.bdi > 2300)   gatilhos.push(`BDI em ${int(c.bdi)} pts (gatilho: 2.300 pts)`);
if (c.diesel > 7.60)gatilhos.push(`Diesel em R$ ${brl(c.diesel)}/L (gatilho: R$ 7,60/L)`);
if (c.soja < 125)   gatilhos.push(`Soja CEPEA em R$ ${brl(c.soja)}/saca (gatilho: abaixo de R$ 125,00)`);
if ((troca.map ?? 0) > 30) gatilhos.push(`Relação de troca soja/MAP em ${brl(troca.map,1)} sacas/t (gatilho: 30)`);

// ---- fontes com falha (ignorando as declaradas manuais) ----
let manuais = [];
try {
  const ov = join(__dirname, "fertilizers-override.json");
  if (existsSync(ov)) manuais = JSON.parse(readFileSync(ov, "utf-8")).fontesManuais ?? [];
} catch { /* ignora */ }
const falhas = Object.entries(d.status ?? {})
  .filter(([k, v]) => !k.startsWith("_") && !manuais.includes(k) && typeof v === "string" && v.startsWith("falha"))
  .map(([k]) => k);

const fertRef = refCurta(refs.ureia ?? refs.map ?? refs.kcl);

const html = `<div style="max-width:640px;margin:0 auto;font:14px/1.5 Arial,sans-serif;color:#222">
  <div style="border-bottom:3px solid ${NAVY};padding-bottom:10px;margin-bottom:18px">
    <div style="font:700 11px Arial;letter-spacing:.08em;color:${MUTE}">INTELIGÊNCIA DE MERCADO</div>
    <div style="font:700 20px Arial;color:${NAVY}">Insumos Florestais — ${d.ref ?? ""}</div>
    <div style="font-size:12px;color:${MUTE}">Equipe de Planejamento, Controle e Pesquisa Florestal · Atualizado em ${d.updatedAtBR ?? ""}</div>
  </div>

  ${gatilhos.length ? `<div style="background:#FDF3F3;border-left:4px solid ${BORD};padding:11px 14px;margin-bottom:16px">
    <div style="font-weight:700;color:${BORD};margin-bottom:5px">Gatilhos acionados (${gatilhos.length})</div>
    <ul style="margin:0;padding-left:18px;font-size:13px">${gatilhos.map(g => `<li>${g}</li>`).join("")}</ul>
  </div>` : `<div style="background:#F3F9F5;border-left:4px solid ${EMER};padding:11px 14px;margin-bottom:16px;font-size:13px">
    Nenhum gatilho acionado nesta leitura.</div>`}

  ${tabela(`Fertilizantes (FOB · fechamento ${fertRef})`, [
    `<tr>${cel("Ureia")}${num(`US$ ${int(c.ureia)}/t`)}${varCell(delta.ureia)}</tr>`,
    `<tr>${cel("MAP")}${num(`US$ ${int(c.map)}/t`)}${varCell(delta.map)}</tr>`,
    `<tr>${cel("Cloreto de Potássio (KCl)")}${num(`US$ ${int(c.kcl)}/t`)}${varCell(delta.kcl)}</tr>`,
  ])}

  ${tabela("Soja e relação de troca", [
    `<tr>${cel("Soja CEPEA (Nacional)")}${num(`R$ ${brl(c.soja)}/sc`)}${varCell(delta.soja, true)}</tr>`,
    `<tr>${cel("Soja Oeste BA (AIBA)")}${num(`R$ ${brl(c.sojaTO)}/sc`)}${varCell(delta.sojaTO, true)}</tr>`,
    `<tr>${cel("Troca Soja/MAP")}${num(`${brl(troca.map,1)} sc/t`)}${varCell(delta.trocaMap)}</tr>`,
  ])}

  ${tabela("Macro", [
    `<tr>${cel("Dólar")}${num(`R$ ${brl(c.dolar)}`)}${varCell(delta.dolar)}</tr>`,
    `<tr>${cel("Gás Natural (Henry Hub)")}${num(`US$ ${brl(c.gas)}`)}${varCell(delta.gas)}</tr>`,
    `<tr>${cel("Frete Marítimo (BDI)")}${num(`${int(c.bdi)} pts`)}${varCell(delta.bdi)}</tr>`,
    `<tr>${cel("Diesel S10")}${num(`R$ ${brl(c.diesel)}/L`)}${varCell(delta.diesel)}</tr>`,
  ])}

  <p style="font-size:13px;margin:20px 0 6px">O relatório executivo completo está <b>anexado em PDF</b>.</p>

  ${falhas.length ? `<p style="font-size:12px;color:${BORD};margin:6px 0">
    Atenção: ${falhas.length} fonte(s) não puderam ser atualizadas (${falhas.join(", ")}). Os valores exibidos são a última leitura conhecida.</p>` : ""}

  <p style="font-size:11px;color:${MUTE};border-top:1px solid ${LINE};padding-top:10px;margin-top:18px">
    Mensagem gerada automaticamente. Fertilizantes: FOB de importação (ComexStat), com fechamento mensal.
    Variações comparam com a leitura anterior registrada.</p>
</div>`;

writeFileSync(join(__dirname, "email-body.html"), html, "utf-8");

const assunto = gatilhos.length
  ? `[ATENÇÃO: ${gatilhos.length} gatilho(s)] Inteligência de Mercado — ${d.ref ?? ""}`
  : `Inteligência de Mercado — Insumos Florestais — ${d.ref ?? ""}`;
writeFileSync(join(__dirname, "email-subject.txt"), assunto, "utf-8");

console.log(`[email] corpo gerado. Assunto: ${assunto}`);
console.log(`[email] gatilhos: ${gatilhos.length} | fontes com falha: ${falhas.length}`);
