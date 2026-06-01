/**
 * calcular_metricas.ts
 * TCC Victor Cavalcante — Cálculo das Métricas de Avaliação (TypeScript)
 *
 * Compara cada modelo SSN gerado pelos LLMs com o modelo de referência.
 * Calcula: PA, RA, F1-A, PR, TA
 *
 * Uso:
 * npx ts-node calcular_metricas.ts
 * npx ts-node calcular_metricas.ts --ecos SIPPA --grupo G2 --modelo gpt-4o
 */

import fs from "fs";
import path from "path";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AtorRef {
  id: string;
  nome: string;
  tipo: string;
}

interface RelacaoRef {
  id: string;
  origem: string;   // ID do ator
  destino: string;  // ID do ator
  tipo: string;     // ex: "P", "Ser", "Comp"
  fluxo?: string;   // ex: "P.1" — campo auxiliar, NÃO usado na comparação
}

interface GatewayRef {
  id: string;
  ator_id: string;  // ID do ator dono do gateway
  tipo: "split" | "join";
  descricao?: string;
}

interface ModeloReferencia {
  ecos: string;
  atores: AtorRef[];
  relacoes: RelacaoRef[];
  gateways: GatewayRef[];  // podem existir no gabarito mas NÃO são avaliados nas métricas
}

interface AtorGerado {
  nome: string;
  tipo: string;
}

interface RelacaoGerada {
  origem: string;      // nome do ator
  destino: string;     // nome do ator
  tipo_fluxo: string;
}

interface GatewayGerado {
  ator: string;        // nome do ator
  tipo: "split" | "join";
  descricao?: string;
}

interface ResultadoGerado {
  atores?: AtorGerado[];
  relacoes?: RelacaoGerada[];
  gateways?: GatewayGerado[];  // capturado mas NÃO avaliado nas métricas quantitativas
}

interface Metricas {
  PA: number;
  RA: number;
  F1_A: number;
  PR: number;
  TA: number;
  total_atores_ref: number;
  total_atores_gerado: number;
  atores_corretos: number;
  total_relacoes_ref: number;
  total_relacoes_gerado: number;
  relacoes_corretas: number;
  // Diagnóstico de divergências
  atores_alucinados: string[];   // gerados mas ausentes no gabarito
  atores_ausentes: string[];     // no gabarito mas não gerados
  relacoes_alucinadas: string[]; // geradas mas ausentes no gabarito
  relacoes_ausentes: string[];   // no gabarito mas não geradas
  // Info sobre gateways (não entram nas métricas quantitativas)
  gateways_gerados: number;
  gateways_ref: number;
}

interface ResultadoMetrica {
  id_execucao: string;
  ecos: string;
  grupo: string;
  modelo: string;
  repeticao: number;
  status: string;
  conformidade_formato: string;
  metricas: Metricas | null;
}

// ─── Dicionários de Normalização ─────────────────────────────────────────────

const NORM_TIPO_ATOR: Record<string, string> = {
  // CoI
  coi: "CoI", "core of interest": "CoI", core: "CoI",
  "plataforma central": "CoI", "sistema central": "CoI",
  // Fornecedor
  fornecedor: "Fornecedor", supplier: "Fornecedor",
  framework: "Fornecedor", biblioteca: "Fornecedor",
  tecnologia: "Fornecedor", ferramenta: "Fornecedor",
  infraestrutura: "Fornecedor",
  // Cliente
  cliente: "Cliente", client: "Cliente",
  usuario: "Cliente", "usuário": "Cliente", user: "Cliente",
  consumidor: "Cliente",
  // Intermediario
  intermediario: "Intermediario", "intermediário": "Intermediario",
  intermediary: "Intermediario", distribuidor: "Intermediario",
  loja: "Intermediario", store: "Intermediario",
  // Coordenador
  coordenador: "Coordenador", coordinator: "Coordenador", gestor: "Coordenador",
  // Agregador
  agregador: "Agregador", aggregator: "Agregador",
  // ClienteDoCliente
  clientedocliente: "ClienteDoCliente", "cliente do cliente": "ClienteDoCliente",
  "end user": "ClienteDoCliente", "usuario final": "ClienteDoCliente",
};

const NORM_TIPO_FLUXO: Record<string, string> = {
  p: "P", produto: "P", product: "P", componente: "P",
  ser: "Ser", "serviço": "Ser", servico: "Ser", service: "Ser",
  req: "Req", requisito: "Req", requirement: "Req",
  des: "Des", desenvolvimento: "Des", development: "Des",
  comp: "Comp", "compensação": "Comp", compensacao: "Comp", payment: "Comp",
  sys: "Sys", sistema: "Sys", system: "Sys", "integração": "Sys",
};

// ─── Helpers de Normalização ──────────────────────────────────────────────────

function normTipoAtor(tipo: string): string {
  return NORM_TIPO_ATOR[tipo.trim().toLowerCase()] ?? tipo.trim();
}

function normTipoFluxo(tipo: string): string {
  return NORM_TIPO_FLUXO[tipo.trim().toLowerCase()] ?? tipo.trim().toUpperCase();
}

function normNome(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, " ");
}

// ─── Carregamento de Referências ──────────────────────────────────────────────

const REFERENCIA_DIR   = path.join(__dirname, "..", "modelos_referencia");
const EXECUCOES_DIR    = path.join(__dirname, "..", "execucoes");
const RESULTADOS_DIR   = path.join(__dirname, "resultados_metricas");

function carregarReferencia(ecos: string): ModeloReferencia {
  const fname = path.join(REFERENCIA_DIR, `${ecos.toLowerCase()}_referencia.json`);
  return JSON.parse(fs.readFileSync(fname, "utf-8")) as ModeloReferencia;
}

// ─── Extração de Conjuntos para Comparação ────────────────────────────────────

/** Retorna Set de strings "nome::tipo" para os atores de referência */
function atoresRef(ref: ModeloReferencia): Set<string> {
  return new Set(ref.atores.map((a) => `${normNome(a.nome)}::${normTipoAtor(a.tipo)}`));
}

/**
 * Retorna Set de strings "origem::destino::fluxo" para as relações de referência.
 * Usa o campo "tipo" (ex: "P", "Ser") — o campo "fluxo" (ex: "P.1") é ignorado
 * intencionalmente, pois a numeração é auxiliar e não faz parte do critério de avaliação.
 */
function relacoesRef(ref: ModeloReferencia): Set<string> {
  const idToNome: Record<string, string> = {};
  for (const a of ref.atores) idToNome[a.id] = normNome(a.nome);
  return new Set(
    ref.relacoes.map(
      (r) => `${idToNome[r.origem]}::${idToNome[r.destino]}::${normTipoFluxo(r.tipo)}`
    )
  );
}

/** Retorna Set de strings "nome::tipo" para os atores gerados */
function atoresGerado(resultado: ResultadoGerado): Set<string> {
  return new Set(
    (resultado.atores ?? []).map(
      (a) => `${normNome(a.nome)}::${normTipoAtor(a.tipo)}`
    )
  );
}

/** Retorna Set de strings "origem::destino::fluxo" para as relações geradas */
function relacoesGerado(resultado: ResultadoGerado): Set<string> {
  return new Set(
    (resultado.relacoes ?? []).map(
      (r) => `${normNome(r.origem)}::${normNome(r.destino)}::${normTipoFluxo(r.tipo_fluxo)}`
    )
  );
}

function setIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => b.has(x)));
}

function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)));
}

// ─── Cálculo de Métricas ──────────────────────────────────────────────────────

/**
 * Calcula PA, RA, F1-A, PR e TA conforme a metodologia do TCC.
 *
 * Nota sobre gateways:
 *   Gateways gerados pelo LLM são registrados para diagnóstico, mas NÃO entram
 *   nas métricas quantitativas (PA, RA, F1-A, PR, TA), pois:
 *   (a) a metodologia não define uma métrica de recall para gateways;
 *   (b) gateways incorretos já são capturados indiretamente pela TA de relações
 *       (uma relação que deveria passar por um gateway correto é contabilizada
 *       como relação incorreta).
 */
function calcularMetricas(gerado: ResultadoGerado, ref: ModeloReferencia): Metricas {
  const Aref    = atoresRef(ref);
  const Agerado = atoresGerado(gerado);
  const Rref    = relacoesRef(ref);
  const Rgerado = relacoesGerado(gerado);

  const intersecA = setIntersection(Agerado, Aref);
  const intersecR = setIntersection(Rgerado, Rref);

  const PA  = Agerado.size > 0 ? intersecA.size / Agerado.size : 0;
  const RA  = Aref.size    > 0 ? intersecA.size / Aref.size    : 0;
  const F1A = PA + RA > 0      ? (2 * PA * RA) / (PA + RA)     : 0;
  const PR  = Rgerado.size > 0 ? intersecR.size / Rgerado.size : 0;

  // Taxa de Alucinação: considera atores + relações (sem gateways, conforme metodologia)
  const totalCorretos = intersecA.size + intersecR.size;
  const totalGerados  = Agerado.size + Rgerado.size;
  const TA = totalGerados > 0 ? 1 - (totalCorretos / totalGerados) : 0;

  const round4 = (n: number) => Math.round(n * 10000) / 10000;

  return {
    PA:  round4(PA),
    RA:  round4(RA),
    F1_A: round4(F1A),
    PR:  round4(PR),
    TA:  round4(TA),
    total_atores_ref:      Aref.size,
    total_atores_gerado:   Agerado.size,
    atores_corretos:       intersecA.size,
    total_relacoes_ref:    Rref.size,
    total_relacoes_gerado: Rgerado.size,
    relacoes_corretas:     intersecR.size,
    atores_alucinados:    [...setDifference(Agerado, Aref)].sort(),
    atores_ausentes:      [...setDifference(Aref, Agerado)].sort(),
    relacoes_alucinadas:  [...setDifference(Rgerado, Rref)].sort(),
    relacoes_ausentes:    [...setDifference(Rref, Rgerado)].sort(),
    gateways_gerados:     (gerado.gateways ?? []).length,
    gateways_ref:         (ref.gateways ?? []).length,
  };
}

// ─── Processamento de Arquivo ─────────────────────────────────────────────────

interface ExecucaoArquivo {
  id_execucao: string;
  ecos: string;
  grupo: string;
  modelo: string;
  repeticao: number;
  status: string;
  conformidade_formato: string;
  resultado_parseado: ResultadoGerado;
}

function processarArquivo(
  fpath: string,
  filtros?: Partial<Record<string, string>>
): ResultadoMetrica | null {
  const execucao: ExecucaoArquivo = JSON.parse(fs.readFileSync(fpath, "utf-8"));

  if (filtros) {
    for (const [chave, valor] of Object.entries(filtros)) {
      if ((execucao as unknown as Record<string, unknown>)[chave] !== valor) return null;
    }
  }

  const { id_execucao, ecos, grupo, modelo, repeticao, status, conformidade_formato, resultado_parseado } = execucao;

  if (status !== "ok" || conformidade_formato !== "ok") {
    return { id_execucao, ecos, grupo, modelo, repeticao, status, conformidade_formato, metricas: null };
  }

  const ref = carregarReferencia(ecos);
  const metricas = calcularMetricas(resultado_parseado, ref);

  return { id_execucao, ecos, grupo, modelo, repeticao, status, conformidade_formato, metricas };
}

// ─── Médias por Grupo ─────────────────────────────────────────────────────────

type ChaveGrupo = string; // "ECOS_grupo_modelo"
type MetricaKey = "PA" | "RA" | "F1_A" | "PR" | "TA";

function calcularMediasPorGrupo(
  resultados: ResultadoMetrica[]
): Record<ChaveGrupo, Record<MetricaKey, number>> {
  const agrupados: Record<ChaveGrupo, Metricas[]> = {};

  for (const r of resultados) {
    if (!r.metricas) continue;
    const chave: ChaveGrupo = `${r.ecos}_${r.grupo}_${r.modelo}`;
    if (!agrupados[chave]) agrupados[chave] = [];
    agrupados[chave].push(r.metricas);
  }

  const result: Record<ChaveGrupo, Record<MetricaKey, number>> = {};
  const keys: MetricaKey[] = ["PA", "RA", "F1_A", "PR", "TA"];

  for (const [chave, lista] of Object.entries(agrupados)) {
    result[chave] = {} as Record<MetricaKey, number>;
    for (const k of keys) {
      const media = lista.reduce((acc, m) => acc + m[k], 0) / lista.length;
      result[chave][k] = Math.round(media * 10000) / 10000;
    }
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const filtros: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith("--")) filtros[args[i].slice(2)] = args[i + 1];
  }

  if (!fs.existsSync(RESULTADOS_DIR)) fs.mkdirSync(RESULTADOS_DIR, { recursive: true });

  const arquivos = fs
    .readdirSync(EXECUCOES_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => path.join(EXECUCOES_DIR, f))
    .sort();

  console.log(`Processando ${arquivos.length} execuções...\n`);

  const resultados: ResultadoMetrica[] = [];

  for (const fpath of arquivos) {
    const r = processarArquivo(fpath, Object.keys(filtros).length ? filtros : undefined);
    if (!r) continue;
    resultados.push(r);

    const m = r.metricas;
    if (m) {
      console.log(
        `${r.id_execucao.padEnd(50)} | ` +
        `PA=${m.PA.toFixed(4)}  RA=${m.RA.toFixed(4)}  ` +
        `F1=${m.F1_A.toFixed(4)}  PR=${m.PR.toFixed(4)}  ` +
        `TA=${m.TA.toFixed(4)}` +
        (m.gateways_gerados > 0 ? `  GW_gen=${m.gateways_gerados}(ref=${m.gateways_ref})` : "")
      );
    } else {
      console.log(`${r.id_execucao.padEnd(50)} | status=${r.status} conform=${r.conformidade_formato}`);
    }
  }

  // Salva resultados individuais
  const outIndividual = path.join(RESULTADOS_DIR, "metricas_individuais.json");
  fs.writeFileSync(outIndividual, JSON.stringify(resultados, null, 2), "utf-8");

  // Calcula e salva médias por grupo
  const medias = calcularMediasPorGrupo(resultados);
  const outMedias = path.join(RESULTADOS_DIR, "metricas_medias_por_grupo.json");
  fs.writeFileSync(outMedias, JSON.stringify(medias, null, 2), "utf-8");

  console.log(`\n✓ Métricas salvas em '${RESULTADOS_DIR}/'`);
  console.log(`  - metricas_individuais.json: resultados por execução`);
  console.log(`  - metricas_medias_por_grupo.json: médias por (ECOS × Grupo × Modelo)`);
}

main();