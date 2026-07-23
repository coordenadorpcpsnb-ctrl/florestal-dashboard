// run-weekly.mjs — orquestra a atualização semanal
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
function run(file){
  console.log(`\n=== ${file} ===`);
  const r = spawnSync(process.execPath, [join(__dirname, file)], { stdio: "inherit" });
  if (r.status !== 0) { console.error(`Falha em ${file} (código ${r.status}).`); process.exit(r.status || 1); }
}
console.log("Atualização semanal —", new Date().toLocaleString("pt-BR"));
run("fetch-data.mjs");
run("patch-dashboard.mjs");
run("build-report.mjs");
console.log("\n✅ Concluído. Dashboard e relatório atualizados.");
