/**
 * validate-formulated-history.mjs — CLI: valida data/formulated-prices-history.json.
 *
 * Uso: npm run validate:formulated-history   (ou: node validate-formulated-history.mjs)
 *
 * Nao e chamado por run-weekly.mjs nem por nenhum outro script da esteira semanal --
 * e uma verificacao independente, pensada para rodar manualmente ou num workflow
 * separado no futuro. Uma base vazia (records: []) e reportada como valida.
 *
 * Saida: exit 0 quando valida, exit 1 quando invalida ou quando o arquivo nao existe
 * / nao e um JSON valido.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadAndValidateHistoryFile } from "./formulated-price-history.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARQUIVO = join(__dirname, "data", "formulated-prices-history.json");

function log(msg) { console.log(`[validate:formulated-history] ${msg}`); }

log(`arquivo: ${ARQUIVO}`);

const resultado = loadAndValidateHistoryFile(ARQUIVO);

log(`registros encontrados: ${resultado.recordCount}`);
if (resultado.recordCount === 0 && resultado.valid) {
  log("base vazia — considerada valida.");
}

if (resultado.errors.length) {
  log(`${resultado.errors.length} erro(s):`);
  for (const e of resultado.errors) {
    const local = e.id != null ? `id="${e.id}" (indice ${e.index})` : (e.index != null ? `indice ${e.index}` : "raiz");
    const campo = e.field ? `, campo "${e.field}"` : "";
    console.log(`  - [${e.type}] ${local}${campo}: ${e.message}`);
  }
}

log(resultado.summary);
process.exit(resultado.valid ? 0 : 1);
