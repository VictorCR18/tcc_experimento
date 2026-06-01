/**
 * json2xml.ts
 * Conversor de resultados JSON (LLMs) para o formato XML do ECOS Modeling (mxGraphModel)
 *
 * Suporta dois formatos de entrada:
 *   1. Arquivo de execução LLM: { resultado_parseado: { atores, relacoes, gateways[] com campo "ator" } }
 *   2. Arquivo de referência:   { atores, relacoes, gateways[] com campo "ator_id" (ID) }
 *
 * Uso:
 * npx ts-node json2xml.ts <arquivo_entrada.json> <arquivo_saida.xml>
 */

import * as fs from "fs";
import * as path from "path";

// ─── Dicionários de Estilo e Layout ──────────────────────────────────────────

const ESTILOS_SSN: Record<string, string> = {
  coi: "fillColor=blue;strokeColor=black;fontColor=white;tipo=empresa",
  fornecedor:
    "shape=singleArrow;fillColor=orange;strokeColor=black;fontColor=black;tipo=fornecedor;",
  intermediario:
    "shape=doubleArrow;fillColor=LimeGreen;strokeColor=black;fontColor=black;tipo=intermediario",
  cliente:
    "shape=singleArrow;fillColor=yellow;strokeColor=black;fontColor=black;flipH=1;tipo=cliente1",
  clientedocliente:
    "shape=step;fillColor=LightGrey;strokeColor=black;fontColor=black;flipH=1;tipo=cliente2",
  agregador:
    "shape=parallelogram;fillColor=red;strokeColor=black;fontColor=black;tipo=agregador",
  gateway_split:
    "shape=rhombus;fillColor=black;strokeColor=black;fontColor=white;tipo=ou",
  gateway_join:
    "shape=rhombus;fillColor=black;strokeColor=black;fontColor=white;tipo=xou",
  fluxo:
    "shape=singleArrow;fillColor=white;strokeColor=black;fontColor=black;tipo=relacao",
};

const COLUNAS_X: Record<string, number> = {
  fornecedor: 100,
  agregador: 400,
  coi: 400,
  intermediario: 700,
  cliente: 1000,
  clientedocliente: 1300,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizarChave(tipo: string): string {
  return tipo.trim().toLowerCase().replace(/\s+/g, "");
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}

// ─── Conversor ───────────────────────────────────────────────────────────────

function converterJsonParaXml(caminhoJson: string, caminhoXmlSaida: string) {
  let dados: any;

  try {
    const rawData = fs.readFileSync(caminhoJson, "utf-8");
    dados = JSON.parse(rawData);
  } catch (e) {
    console.error(`Erro ao ler ou processar o arquivo JSON: ${e}`);
    process.exit(1);
  }

  // Suporta tanto arquivo de execução LLM quanto arquivo de referência diretamente
  const conteudo = dados.resultado_parseado ? dados.resultado_parseado : dados;

  const atores: any[] = conteudo.atores || [];
  const relacoes: any[] = conteudo.relacoes || [];
  const gateways: any[] = conteudo.gateways || [];

  let idCounter = 2;
  const mapaAtores: Record<string, string> = {};
  const coordAtores: Record<string, { x: number; y: number }> = {};

  // Mapa inverso: ID do ator -> nome (para suportar gabaritos que usam ator_id)
  const mapaIdParaNome: Record<string, string> = {};
  for (const ator of atores) {
    if (ator.id) {
      mapaIdParaNome[ator.id] = (ator.nome || "").toLowerCase();
    }
  }

  const posYColunas: Record<number, number> = {};
  for (const x of Object.values(COLUNAS_X)) {
    posYColunas[x] = 100;
  }
  posYColunas[100] = 100;

  const xmlLines: string[] = [];
  xmlLines.push('<?xml version="1.0" encoding="UTF-8"?>');
  xmlLines.push("<mxGraphModel>");
  xmlLines.push("  <root>");
  xmlLines.push('    <mxCell id="0"/>');
  xmlLines.push('    <mxCell id="1" parent="0"/>');

  // 1. Processamento dos Atores
  for (const ator of atores) {
    const nome = ator.nome || "Desconhecido";
    const tipo = normalizarChave(ator.tipo || "coi");

    const estilo =
      ESTILOS_SSN[tipo] ||
      "rounded=1;fillColor=white;strokeColor=red;fontColor=black;tipo=alucinacao";
    const posX = COLUNAS_X[tipo] || 100;

    if (posYColunas[posX] === undefined) posYColunas[posX] = 100;
    const posY = posYColunas[posX];
    posYColunas[posX] += 100;

    const idAtual = String(idCounter++);
    mapaAtores[nome.toLowerCase()] = idAtual;
    coordAtores[nome.toLowerCase()] = { x: posX, y: posY };

    xmlLines.push(
      `    <mxCell id="${idAtual}" value="${escapeXml(nome)}" style="${escapeXml(estilo)}" vertex="1" parent="1">`,
    );
    xmlLines.push(
      `      <mxGeometry x="${posX}" y="${posY}" width="200" height="50" as="geometry">`,
    );
    xmlLines.push(
      `        <mxRectangle width="200" height="50" as="alternateBounds"/>`,
    );
    xmlLines.push(`      </mxGeometry>`);
    xmlLines.push(`    </mxCell>`);
  }

  // 2. Processamento das Relações e Fluxos
  // Suporta campo "tipo_fluxo" (execuções LLM) e "tipo" (gabarito de referência)
  const contadoresFluxo: Record<string, number> = {};

  for (const relacao of relacoes) {
    // Suporta nomes diretos (execução LLM) e IDs (gabarito de referência)
    const origemRaw = relacao.origem || "";
    const destinoRaw = relacao.destino || "";

    // Resolve: tenta como nome primeiro, depois como ID
    const origemNome = mapaIdParaNome[origemRaw]
      ? mapaIdParaNome[origemRaw]
      : origemRaw.toLowerCase();
    const destinoNome = mapaIdParaNome[destinoRaw]
      ? mapaIdParaNome[destinoRaw]
      : destinoRaw.toLowerCase();

    // Suporta campo "tipo_fluxo" (LLM) e "tipo" (gabarito)
    const tipoFluxoBruto = relacao.tipo_fluxo || relacao.tipo || "";

    const origemId = mapaAtores[origemNome];
    const destinoId = mapaAtores[destinoNome];

    if (origemId && destinoId) {
      const edgeId = String(idCounter++);
      const edgeStyle =
        "endArrow=classic;html=1;entryX=0;entryY=0.5;entryDx=0;entryDy=0;exitX=1;exitY=0.5;exitDx=0;exitDy=0;";

      xmlLines.push(
        `    <mxCell id="${edgeId}" value="" style="${escapeXml(edgeStyle)}" edge="1" parent="1" source="${origemId}" target="${destinoId}">`,
      );
      xmlLines.push(`      <mxGeometry relative="1" as="geometry"/>`);
      xmlLines.push(`    </mxCell>`);

      if (tipoFluxoBruto) {
        const chaveContador = tipoFluxoBruto.toUpperCase();
        contadoresFluxo[chaveContador] =
          (contadoresFluxo[chaveContador] || 0) + 1;

        const textoFluxoFormatado = `${chaveContador}:${contadoresFluxo[chaveContador]}`;

        const fluxoId = String(idCounter++);
        const estiloFluxo = ESTILOS_SSN["fluxo"];

        xmlLines.push(
          `    <mxCell id="${fluxoId}" value="${escapeXml(textoFluxoFormatado)}" style="${escapeXml(estiloFluxo)}" vertex="1" connectable="0" parent="${edgeId}">`,
        );
        xmlLines.push(
          `      <mxGeometry x="0" y="0" width="40" height="20" relative="1" as="geometry">`,
        );
        xmlLines.push(`        <mxPoint x="-20" y="-10" as="offset"/>`);
        xmlLines.push(`      </mxGeometry>`);
        xmlLines.push(`    </mxCell>`);
      }
    }
  }

  // 3. Processamento dos Gateways
  // FIX: Suporta campo "ator" (execução LLM, nome do ator) e "ator_id" (gabarito, ID do ator)
  let orphanGwY = 700;

  for (const gw of gateways) {
    const tipoGw = (gw.tipo || "split").toLowerCase();

    // Resolve o nome do ator dono do gateway
    // - Execução LLM: campo "ator" contém o nome (ex: "Google Drive")
    // - Gabarito de referência: campo "ator_id" contém o ID (ex: "A6") -> resolve pelo mapa inverso
    let atorGwNome = "";
    if (gw.ator) {
      atorGwNome = (gw.ator as string).toLowerCase();
    } else if (gw.ator_id && mapaIdParaNome[gw.ator_id]) {
      atorGwNome = mapaIdParaNome[gw.ator_id];
    }

    const idAtual = String(idCounter++);
    const estiloGw =
      tipoGw === "split"
        ? ESTILOS_SSN["gateway_split"]
        : ESTILOS_SSN["gateway_join"];
    const textoValue = tipoGw.toUpperCase();

    let gwX = 0;
    let gwY = 0;

    if (atorGwNome && mapaAtores[atorGwNome]) {
      // Gateway tem dono: posiciona no canto superior direito do ator
      const coordsAtor = coordAtores[atorGwNome];
      gwX = coordsAtor.x + 180;
      gwY = coordsAtor.y - 20;
    } else {
      // Gateway órfão (nome não resolvido ou ator não encontrado): zona de isolamento
      gwX = 50;
      gwY = orphanGwY;
      orphanGwY += 60;
      if (atorGwNome) {
        console.warn(`⚠ Gateway sem ator correspondente: "${gw.ator || gw.ator_id}" → posicionado na zona de isolamento`);
      }
    }

    xmlLines.push(
      `    <mxCell id="${idAtual}" value="${escapeXml(textoValue)}" style="${escapeXml(estiloGw)}" vertex="1" parent="1">`,
    );
    xmlLines.push(
      `      <mxGeometry x="${gwX}" y="${gwY}" width="40" height="40" as="geometry">`,
    );
    xmlLines.push(
      `        <mxRectangle width="40" height="40" as="alternateBounds"/>`,
    );
    xmlLines.push(`      </mxGeometry>`);
    xmlLines.push(`    </mxCell>`);
  }

  // Finaliza o XML
  xmlLines.push("  </root>");
  xmlLines.push("</mxGraphModel>");

  try {
    fs.mkdirSync(path.dirname(path.resolve(caminhoXmlSaida)), {
      recursive: true,
    });
    fs.writeFileSync(caminhoXmlSaida, xmlLines.join("\n"), "utf-8");
    console.log(`✓ Diagrama convertido com sucesso: ${caminhoXmlSaida}`);
  } catch (e) {
    console.error(`Erro ao salvar arquivo XML: ${e}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      "Uso: npx ts-node json2xml.ts <arquivo_entrada.json> <arquivo_saida.xml>",
    );
    console.log(
      "Exemplo: npx ts-node json2xml.ts execucoes/SkinnerBox_G4_gemini-3.5-flash_R1.json diagrama.xml",
    );
    console.log(
      "Exemplo: npx ts-node json2xml.ts modelos_referencia/skinnerbox_referencia.json gabarito.xml",
    );
    process.exit(1);
  }

  converterJsonParaXml(args[0], args[1]);
}