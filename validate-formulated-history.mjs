/**
 * validate-formulated-history.mjs — CLI: valida uma base de historico de precos de
 * formulados no formato de data/formulated-prices-history.json.
 *
 * Uso:
 *   npm run validate:formulated-history                     -> valida a base publica padrao
 *   node validate-formulated-history.mjs                     -> idem
 *   node validate-formulated-history.mjs caminho/arquivo.json -> valida um arquivo especifico
 *   npm run validate:formulated-history -- caminho/arquivo.json -> idem, via npm
 *
 * O caminho explicito e resolvido a partir do diretorio atual (process.cwd()), como
 * qualquer CLI Node convencional -- serve para validar, por exemplo, um arquivo privado
 * em data/private/ (nunca versionado, ver .gitignore e README secao 10) sem precisar
 * movê-lo para dentro do repositorio. Este script NUNCA procura um arquivo privado
 * sozinho e NUNCA cai de volta na base publica se o caminho explicito nao existir --
 * isso seria um fallback silencioso que poderia mascarar erro de digitação no caminho.
 *
 * Nao imprime o conteudo de nenhum registro (fornecedor, preco, observacoes, etc.) --
 * so tipo de erro, indice, id e nome do campo. Isso vale tanto para a base publica
 * quanto para qualquer caminho privado passado explicitamente.
 *
 * Nao e chamado por run-weekly.mjs nem por nenhum outro script da esteira semanal --
 * e uma verificacao independente, pensada para rodar manualmente ou num workflow
 * separado no futuro. Uma base vazia (records: []) e reportada como valida.
 *
 * Saida: exit 0 quando valida, exit 1 quando invalida ou quando o arquivo nao existe
 * / nao e um JSON valido.
 */
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { loadAndValidateHistoryFile } from "./formulated-price-history.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARQUIVO_PADRAO = join(__dirname, "data", "formulated-prices-history.json");

const caminhoExplicito = process.argv[2];
const ARQUIVO = caminhoExplicito ? resolve(process.cwd(), caminhoExplicito) : ARQUIVO_PADRAO;

function log(msg) { console.log(`[validate:formulated-history] ${msg}`); }

log(`arquivo: ${ARQUIVO}${caminhoExplicito ? " (caminho explicito)" : " (base publica padrao)"}`);

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
