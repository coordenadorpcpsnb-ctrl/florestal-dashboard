/**
 * validate-formulated-products-catalog.mjs — CLI: valida um catálogo técnico de
 * formulações no formato de schemas/formulated-products-catalog.schema.json.
 *
 * Uso:
 *   node validate-formulated-products-catalog.mjs caminho/catalog.private.json
 *   node validate-formulated-products-catalog.mjs templates/formulated-products-catalog-template.json
 *   npm run validate:formulated-catalog -- caminho/catalog.private.json
 *
 * O caminho é SEMPRE explícito e obrigatório -- este CLI nunca procura um catálogo
 * sozinho, nunca olha para data/private/ por conta própria, e nunca cai de volta em
 * nenhum arquivo padrão. Isso é proposital: uma etapa futura vai gravar o catálogo
 * operacional real em data/private/formulated-products-catalog.private.json (nunca
 * versionado, ver .gitignore e README), e esse arquivo tem que ser passado
 * explicitamente para ser validado -- nunca descoberto automaticamente.
 *
 * Caminhos aceitos, para não validar por engano um arquivo público qualquer:
 *   1. qualquer caminho cujo nome termine em ".private.json";
 *   2. exclusivamente para demonstração pública, o caminho exato de
 *      templates/formulated-products-catalog-template.json deste repositório.
 * Qualquer outro caminho é rejeitado antes mesmo de tentar ler o arquivo.
 *
 * Console sanitizado: nunca imprime productName, declaredFormula, conteúdo de
 * micronutrientes/composição/notas ou documentReference -- só tipo de erro, índice
 * e nome do campo. formulationId só aparece se a variável de ambiente
 * SHOW_FORMULATION_IDS=1 for definida explicitamente (nunca por padrão).
 *
 * Saída: exit 0 quando válido; exit 1 em qualquer outro caso (caminho ausente,
 * caminho rejeitado, arquivo inexistente, JSON inválido, catálogo inválido).
 */
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
import { loadAndValidateCatalogFile } from "./formulated-products-catalog.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PUBLICO = join(__dirname, "templates", "formulated-products-catalog-template.json");
const MOSTRAR_IDS = process.env.SHOW_FORMULATION_IDS === "1";

function log(msg) { console.log(`[validate:formulated-catalog] ${msg}`); }

const caminhoArgumento = process.argv[2];

if (!caminhoArgumento) {
  log("uso: node validate-formulated-products-catalog.mjs <caminho-explicito.private.json | templates/formulated-products-catalog-template.json>");
  log("nenhum caminho foi informado -- este CLI nunca procura um catálogo automaticamente.");
  process.exit(1);
}

const caminhoResolvido = resolve(process.cwd(), caminhoArgumento);
const ehPrivado = basename(caminhoResolvido).endsWith(".private.json");
const ehTemplatePublico = caminhoResolvido === resolve(TEMPLATE_PUBLICO);

if (!ehPrivado && !ehTemplatePublico) {
  log(`caminho rejeitado: apenas arquivos "*.private.json" ou o template público (${TEMPLATE_PUBLICO}) são aceitos.`);
  process.exit(1);
}

log(`arquivo: ${ehPrivado ? "*.private.json (caminho explícito)" : "template público do repositório"}`);

const resultado = loadAndValidateCatalogFile(caminhoResolvido);

log(`formulações encontradas: ${resultado.formulationCount}`);
if (resultado.formulationCount === 0 && resultado.valid) {
  log("catálogo vazio — considerado válido.");
}

if (resultado.errors.length) {
  log(`${resultado.errors.length} erro(s):`);
  for (const e of resultado.errors) {
    const local = e.index != null ? `índice ${e.index}` : "raiz";
    const campo = e.field ? `, campo "${e.field}"` : "";
    const idTecnico = MOSTRAR_IDS && e.formulationId ? ` (formulationId="${e.formulationId}")` : "";
    console.log(`  - [${e.type}] ${local}${campo}${idTecnico}`);
  }
}

log(resultado.summary);
process.exit(resultado.valid ? 0 : 1);
