/**
 * converter_todos.ts
 * Uso: npx ts-node scripts/converter_todos.ts [pasta_entrada] [pasta_saida] [filtro_modelo]
 */

import * as fs from "fs";
import * as path from "path";

import { converterJsonParaXml } from "./json2xml";

const pastaEntrada = process.argv[2] || "execucoes";
const pastaSaida   = process.argv[3] || "xmls";
const filtroModelo = process.argv[4] || "gemini-3.5-flash";

if (!fs.existsSync(pastaSaida)) {
  fs.mkdirSync(pastaSaida, { recursive: true });
}

const arquivos = fs
  .readdirSync(pastaEntrada)
  .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
  .filter((f) => filtroModelo === "" || f.includes(filtroModelo));

if (arquivos.length === 0) {
  console.log(`Nenhum arquivo encontrado em '${pastaEntrada}' com filtro '${filtroModelo}'`);
  process.exit(0);
}

console.log(`Convertendo ${arquivos.length} arquivo(s)...\n`);

let ok = 0;
let erros = 0;
let pulados = 0;

for (const arquivo of arquivos) {
  const entrada = path.join(pastaEntrada, arquivo);
  const saida   = path.join(pastaSaida, arquivo.replace(".json", ".xml"));

  if (fs.existsSync(saida)) {
    console.log(`  PULADO  ${arquivo}`);
    pulados++;
    continue;
  }

  try {
    converterJsonParaXml(entrada, saida);
    ok++;
  } catch (e: any) {
    console.error(`  ✗  ${arquivo} → ERRO: ${e.message}`);
    erros++;
  }
}

console.log(`\nConcluído: ${ok} convertidos, ${erros} erros, ${pulados} pulados.`);