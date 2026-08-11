/**
 * fetch-noticias.mjs — Busca as notícias recentes de fertilizantes.
 *
 * Fonte: página de tag do Notícias Agrícolas (mesmo site da soja, não bloqueia
 * servidores de datacenter). A lista vem agrupada por data:
 *
 *   <h3>04/08/2026</h3>
 *   <a href=".../425868-titulo.html">12:41 Título da notícia</a>
 *
 * Retorna as N notícias mais recentes com { data, titulo, url } — conteúdo real,
 * verificável e com link. NÃO sintetiza nem interpreta (evita inventar fatos).
 */
import * as cheerio from "cheerio";

const UA = "Mozilla/5.0 (compatible; florestal-dashboard/1.0)";
const URL = "https://www.noticiasagricolas.com.br/tags/fertilizantes/";

const cortar = (t, n = 160) => String(t).replace(/\s+/g, " ").trim().slice(0, n);

/** É um link de artigo/vídeo de notícia? (termina em NNNNNN-slug.html) */
function ehLinkNoticia(href) {
  return /\/(noticias|videos)\/[^\s]*\/\d{5,}-[^\s]*\.html?$/i.test(href || "");
}

export async function buscarNoticiasFertilizantes(status, limite = 4) {
  try {
    const r = await fetch(URL, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9", Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const $ = cheerio.load(await r.text());

    const itens = [];
    let dataAtual = null;
    let coletando = false;

    // Percorre títulos e links em ordem de documento.
    $("h1, h2, h3, h4, a").each((_i, el) => {
      const $el = $(el);
      const tag = el.tagName?.toLowerCase();
      const txt = $el.text().replace(/\s+/g, " ").trim();

      if (/^h[1-4]$/.test(tag)) {
        // início da lista da tag
        if (/tag:\s*fertilizantes/i.test(txt)) { coletando = true; return; }
        // fim: sidebars e rodapé
        if (/mais lidas|mais comentadas|siga nossas|chicago|sobre n[óo]s/i.test(txt)) { coletando = false; return; }
        // cabeçalho de data DD/MM/AAAA
        const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(txt);
        if (m) dataAtual = `${m[1]}/${m[2]}/${m[3]}`;
        return;
      }

      // link de notícia dentro da área de coleta
      if (coletando && tag === "a") {
        const href = $el.attr("href") || "";
        if (!ehLinkNoticia(href)) return;
        // texto vem como "HH:MM Título" — separa a hora do título
        const mt = /^(\d{1,2}:\d{2})\s+(.*)$/.exec(txt);
        const titulo = mt ? mt[2] : txt;
        if (!titulo || titulo.length < 12) return;
        const url = href.startsWith("http") ? href : "https://www.noticiasagricolas.com.br" + href;
        // evita duplicatas
        if (itens.some(x => x.url === url)) return;
        itens.push({ data: dataAtual, titulo: cortar(titulo, 140), url });
      }
    });

    if (!itens.length) throw new Error("nenhuma noticia extraida (layout pode ter mudado)");

    status.noticias = `ok (${itens.length} de ${cortar(URL, 60)})`;
    return itens.slice(0, limite);
  } catch (e) {
    status.noticias = "falha: " + e.message;
    return [];
  }
}
