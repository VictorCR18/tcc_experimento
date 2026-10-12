import fs from "fs";
import path from "path";

interface AtorRef {
  id: string;
  nome: string;
  tipo: string;
}

interface RelacaoRef {
  id: string;
  origem: string;
  destino: string;
  tipo: string;
  fluxo?: string;
}

interface GatewayRef {
  id: string;
  ator_id: string;
  direcao: "split" | "join";
  descricao?: string;
}

interface ModeloReferencia {
  ecos: string;
  atores: AtorRef[];
  relacoes: RelacaoRef[];
  gateways: GatewayRef[];
}

interface AtorGerado {
  nome: string;
  tipo: string;
}

interface RelacaoGerada {
  origem: string;
  destino: string;
  tipo_fluxo: string;
}

interface GatewayGerado {
  ator: string;
  direcao: "split" | "join";
  logica?: "OU" | "XOU";
  descricao?: string;
}

interface ResultadoGerado {
  atores?: AtorGerado[];
  relacoes?: RelacaoGerada[];
  gateways?: GatewayGerado[];
}

interface ErroTipoAtor {
  nome: string;
  tipo_gerado: string;
  tipo_esperado: string;
}

interface ErroFluxoRelacao {
  origem: string;
  destino: string;
  fluxo_gerado: string;
  fluxo_esperado: string;
}

interface ErroDirecaoGateway {
  ator: string;
  direcao_gerada: string;
  direcao_esperada: string;
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
  atores_alucinados: string[];
  atores_ausentes: string[];
  relacoes_alucinadas: string[];
  relacoes_ausentes: string[];
  atores_erro_tipo: ErroTipoAtor[];
  relacoes_erro_fluxo: ErroFluxoRelacao[];
  total_atores_erro_tipo: number;
  total_relacoes_erro_fluxo: number;
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

const NORM_TIPO_ATOR: Record<string, string> = {
  coi: "CoI",
  "company of interest": "CoI",
  company: "CoI",
  "plataforma central": "CoI",
  "sistema central": "CoI",
  fornecedor: "Fornecedor",
  supplier: "Fornecedor",
  framework: "Fornecedor",
  biblioteca: "Fornecedor",
  tecnologia: "Fornecedor",
  ferramenta: "Fornecedor",
  infraestrutura: "Fornecedor",
  cliente: "Cliente",
  client: "Cliente",
  usuario: "Cliente",
  usuário: "Cliente",
  user: "Cliente",
  consumidor: "Cliente",
  intermediario: "Intermediario",
  intermediário: "Intermediario",
  intermediary: "Intermediario",
  distribuidor: "Intermediario",
  loja: "Intermediario",
  store: "Intermediario",
  agregador: "Agregador",
  aggregator: "Agregador",
  clientedocliente: "ClienteDoCliente",
  "cliente do cliente": "ClienteDoCliente",
  "end user": "ClienteDoCliente",
  "usuario final": "ClienteDoCliente",
};

const NORM_TIPO_FLUXO: Record<string, string> = {
  p: "P",
  produto: "P",
  product: "P",
  componente: "P",
  ser: "Ser",
  serviço: "Ser",
  servico: "Ser",
  service: "Ser",
  req: "Req",
  requisito: "Req",
  requirement: "Req",
  des: "Des",
  desenvolvimento: "Des",
  development: "Des",
  comp: "Comp",
  compensação: "Comp",
  compensacao: "Comp",
  payment: "Comp",
  sys: "Sys",
  sistema: "Sys",
  system: "Sys",
  integração: "Sys",
};

function normTipoAtor(tipo: string): string {
  return NORM_TIPO_ATOR[tipo.trim().toLowerCase()] ?? tipo.trim();
}

function normTipoFluxo(tipo: string): string {
  return (
    NORM_TIPO_FLUXO[tipo.trim().toLowerCase()] ?? tipo.trim().toUpperCase()
  );
}

function normNome(nome: string): string {
  let n = nome.trim().toLowerCase().replace(/\s+/g, " ");

  let nSemSufixo = n.replace(/\s*\b(web|plataforma|mobile|mooc)\b\s*/g, "");
  nSemSufixo = nSemSufixo.replace(/\s*\(.*?\)\s*/g, "");
  nSemSufixo = nSemSufixo.trim();

  if (nSemSufixo !== "") {
    n = nSemSufixo;
  }

  const aliases: Record<string, string> = {
    "pró-reitor de graduação": "pró-reitor de grad.",
    "pró-reitores de graduação": "pró-reitor de grad.",
    "responsáveis pelo ru": "responsável r.u.",
    "responsável pelo ru": "responsável r.u.",
    "infraestrutura ntic": "ntic",
    "universidade federal do ceará": "ufc",
    "sistemas integrados": "sistemas corporativos",

    "departamento de psicologia da ufc": "departamento de psicologia",
    "departamento de psicologia ufc": "departamento de psicologia",
    "desenvolvedores do simulador": "desenvolvedores",
    "desenvolvedores do skinnerbox": "desenvolvedores",

    "módulo acadêmico consumidor": "módulo acadêmico (cliente)",
    "módulo acadêmico cliente": "módulo acadêmico (cliente)",
    "coordenador técnico": "coordenador tecnico do solar",
    "coordenador técnico do solar": "coordenador tecnico do solar",
  };

  if (aliases[n]) {
    n = aliases[n];
  }

  if (n.endsWith("oes")) {
    n = n.replace(/oes$/, "ao");
  } else if (n.endsWith("es") && !n.endsWith("res") && n !== "redes") {
    n = n.slice(0, -2);
  } else if (n.endsWith("ores")) {
    n = n.slice(0, -1);
  } else if (n.endsWith("s") && !n.endsWith("ss") && !n.endsWith("is")) {
    n = n.slice(0, -1);
  }

  if (n === "professore" || n === "professo") n = "professor";
  if (n === "administradore") n = "administrador";
  if (n === "coordenadore") n = "coordenador";
  if (n === "tutore") n = "tutor";
  if (n === "editore") n = "editor";
  if (n === "pesquisadore") n = "pesquisador";
  if (n === "cliente do cliente") n = "clientedocliente";
  if (n === "desenvolvedore") n = "desenvolvedor";

  let nomeOriginal = nome.toLowerCase().replace(/[()]/g, "");

  if (nomeOriginal.includes("solar mobile")) return "solar mobile";
  if (nomeOriginal.includes("solar mooc")) return "solar mooc";

  if (nomeOriginal.includes("sippa web") || n === "sippa") {
    return "sippa (web)";
  }

  return n;
}

const REFERENCIA_DIR = path.join(__dirname, "..", "modelos_referencia");
const EXECUCOES_DIR = path.join(__dirname, "..", "execucoes");
const RESULTADOS_DIR = path.join(__dirname, "resultados_metricas");

function carregarReferencia(ecos: string): ModeloReferencia {
  const fname = path.join(
    REFERENCIA_DIR,
    `${ecos.toLowerCase()}_referencia.json`,
  );
  return JSON.parse(fs.readFileSync(fname, "utf-8")) as ModeloReferencia;
}

function atoresRef(ref: ModeloReferencia): Set<string> {
  return new Set(
    ref.atores.map((a) => `${normNome(a.nome)}::${normTipoAtor(a.tipo)}`),
  );
}

function relacoesRef(ref: ModeloReferencia): Set<string> {
  const idToNome: Record<string, string> = {};
  for (const a of ref.atores) idToNome[a.id] = normNome(a.nome);
  return new Set(
    ref.relacoes.map(
      (r) =>
        `${idToNome[r.origem]}::${idToNome[r.destino]}::${normTipoFluxo(r.tipo)}`,
    ),
  );
}

function atoresGerado(resultado: ResultadoGerado): Set<string> {
  return new Set(
    (resultado.atores ?? []).map(
      (a) => `${normNome(a.nome)}::${normTipoAtor(a.tipo)}`,
    ),
  );
}

function relacoesGerado(resultado: ResultadoGerado): Set<string> {
  return new Set(
    (resultado.relacoes ?? []).map(
      (r) =>
        `${normNome(r.origem)}::${normNome(r.destino)}::${normTipoFluxo(r.tipo_fluxo)}`,
    ),
  );
}

function setIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => b.has(x)));
}

function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a].filter((x) => !b.has(x)));
}

function calcularMetricas(
  gerado: ResultadoGerado,
  ref: ModeloReferencia,
): Metricas {
  const Aref = atoresRef(ref);
  const Agerado = atoresGerado(gerado);
  const Rref = relacoesRef(ref);
  const Rgerado = relacoesGerado(gerado);

  const intersecA = setIntersection(Agerado, Aref);
  const intersecR = setIntersection(Rgerado, Rref);

  const PA = Agerado.size > 0 ? intersecA.size / Agerado.size : 0;
  const RA = Aref.size > 0 ? intersecA.size / Aref.size : 0;
  const F1A = PA + RA > 0 ? (2 * PA * RA) / (PA + RA) : 0;
  const PR = Rgerado.size > 0 ? intersecR.size / Rgerado.size : 0;

  const totalCorretos = intersecA.size + intersecR.size;
  const totalGerados = Agerado.size + Rgerado.size;
  const TA = totalGerados > 0 ? 1 - totalCorretos / totalGerados : 0;

  const round4 = (n: number) => Math.round(n * 10000) / 10000;

  const atoresErroTipo: ErroTipoAtor[] = [];
  const tiposRefPorNome = new Map<string, string>();
  for (const ator of ref.atores) {
    tiposRefPorNome.set(normNome(ator.nome), normTipoAtor(ator.tipo));
  }
  for (const ator of gerado.atores ?? []) {
    const nome = normNome(ator.nome);
    const tipoGerado = normTipoAtor(ator.tipo);
    const tipoEsperado = tiposRefPorNome.get(nome);
    if (tipoEsperado && tipoEsperado !== tipoGerado) {
      atoresErroTipo.push({
        nome,
        tipo_gerado: tipoGerado,
        tipo_esperado: tipoEsperado,
      });
    }
  }
  atoresErroTipo.sort((a, b) => a.nome.localeCompare(b.nome));

  const relacoesErroFluxo: ErroFluxoRelacao[] = [];
  const idToNomeErroFluxo: Record<string, string> = {};
  for (const a of ref.atores) idToNomeErroFluxo[a.id] = normNome(a.nome);
  const fluxosRefPorPar = new Map<string, string>();
  for (const r of ref.relacoes) {
    const origem = idToNomeErroFluxo[r.origem] ?? "";
    const destino = idToNomeErroFluxo[r.destino] ?? "";
    const nome = `${origem}::${destino}`;
    fluxosRefPorPar.set(nome, normTipoFluxo(r.tipo));
  }
  for (const r of gerado.relacoes ?? []) {
    const origem = normNome(r.origem);
    const destino = normNome(r.destino);
    const fluxoGerado = normTipoFluxo(r.tipo_fluxo);
    const fluxoEsperado = fluxosRefPorPar.get(`${origem}::${destino}`);
    if (fluxoEsperado && fluxoEsperado !== fluxoGerado) {
      relacoesErroFluxo.push({
        origem,
        destino,
        fluxo_gerado: fluxoGerado,
        fluxo_esperado: fluxoEsperado,
      });
    }
  }
  relacoesErroFluxo.sort((a, b) =>
    `${a.origem}::${a.destino}`.localeCompare(`${b.origem}::${b.destino}`),
  );

  const nomesComErroTipo = new Set(atoresErroTipo.map((e) => e.nome));
  const paresComErroFluxo = new Set(
    relacoesErroFluxo.map((e) => `${e.origem}::${e.destino}`),
  );

  const atoresAlucinadosPuros = [...setDifference(Agerado, Aref)]
    .filter((s) => !nomesComErroTipo.has(s.split("::")[0]))
    .sort();
  const atoresAusentesPuros = [...setDifference(Aref, Agerado)]
    .filter((s) => !nomesComErroTipo.has(s.split("::")[0]))
    .sort();
  const relacoesAlucinadasPuras = [...setDifference(Rgerado, Rref)]
    .filter((s) => {
      const [origem, destino] = s.split("::");
      return !paresComErroFluxo.has(`${origem}::${destino}`);
    })
    .sort();
  const relacoesAusentesPuras = [...setDifference(Rref, Rgerado)]
    .filter((s) => {
      const [origem, destino] = s.split("::");
      return !paresComErroFluxo.has(`${origem}::${destino}`);
    })
    .sort();

  return {
    PA: round4(PA),
    RA: round4(RA),
    F1_A: round4(F1A),
    PR: round4(PR),
    TA: round4(TA),
    total_atores_ref: Aref.size,
    total_atores_gerado: Agerado.size,
    atores_corretos: intersecA.size,
    total_relacoes_ref: Rref.size,
    total_relacoes_gerado: Rgerado.size,
    relacoes_corretas: intersecR.size,
    atores_alucinados: atoresAlucinadosPuros,
    atores_ausentes: atoresAusentesPuros,
    relacoes_alucinadas: relacoesAlucinadasPuras,
    relacoes_ausentes: relacoesAusentesPuras,
    atores_erro_tipo: atoresErroTipo,
    relacoes_erro_fluxo: relacoesErroFluxo,
    total_atores_erro_tipo: atoresErroTipo.length,
    total_relacoes_erro_fluxo: relacoesErroFluxo.length,
    gateways_gerados: (gerado.gateways ?? []).length,
    gateways_ref: (ref.gateways ?? []).length,
  };
}

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
  filtros?: Partial<Record<string, string>>,
): ResultadoMetrica | null {
  const execucao: ExecucaoArquivo = JSON.parse(fs.readFileSync(fpath, "utf-8"));

  if (filtros) {
    for (const [chave, valor] of Object.entries(filtros)) {
      if ((execucao as unknown as Record<string, unknown>)[chave] !== valor)
        return null;
    }
  }

  const {
    id_execucao,
    ecos,
    grupo,
    modelo,
    repeticao,
    status,
    conformidade_formato,
    resultado_parseado,
  } = execucao;

  if (status !== "ok" || conformidade_formato !== "ok") {
    return {
      id_execucao,
      ecos,
      grupo,
      modelo,
      repeticao,
      status,
      conformidade_formato,
      metricas: null,
    };
  }

  const ref = carregarReferencia(ecos);
  const metricas = calcularMetricas(resultado_parseado, ref);

  return {
    id_execucao,
    ecos,
    grupo,
    modelo,
    repeticao,
    status,
    conformidade_formato,
    metricas,
  };
}


type ChaveGrupo = string;
type MetricaKey = "PA" | "RA" | "F1_A" | "PR" | "TA";

function calcularMediasPorGrupo(
  resultados: ResultadoMetrica[],
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

function main() {
  const args = process.argv.slice(2);
  const filtros: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith("--")) filtros[args[i].slice(2)] = args[i + 1];
  }

  if (!fs.existsSync(RESULTADOS_DIR))
    fs.mkdirSync(RESULTADOS_DIR, { recursive: true });

  const arquivos = fs
    .readdirSync(EXECUCOES_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => path.join(EXECUCOES_DIR, f))
    .sort();

  console.log(`Processando ${arquivos.length} execuções...\n`);

  const resultados: ResultadoMetrica[] = [];

  for (const fpath of arquivos) {
    const r = processarArquivo(
      fpath,
      Object.keys(filtros).length ? filtros : undefined,
    );
    if (!r) continue;
    resultados.push(r);

    const m = r.metricas;
    if (m) {
      console.log(
        `${r.id_execucao.padEnd(50)} | ` +
          `PA=${m.PA.toFixed(4)}  RA=${m.RA.toFixed(4)}  ` +
          `F1=${m.F1_A.toFixed(4)}  PR=${m.PR.toFixed(4)}  ` +
          `TA=${m.TA.toFixed(4)}` +
          (m.gateways_gerados > 0
            ? `  GW_gen=${m.gateways_gerados}(ref=${m.gateways_ref})`
            : ""),
      );
    } else {
      console.log(
        `${r.id_execucao.padEnd(50)} | status=${r.status} conform=${r.conformidade_formato}`,
      );
    }
  }

  const outIndividual = path.join(RESULTADOS_DIR, "metricas_individuais.json");
  fs.writeFileSync(outIndividual, JSON.stringify(resultados, null, 2), "utf-8");

  const medias = calcularMediasPorGrupo(resultados);
  const outMedias = path.join(RESULTADOS_DIR, "metricas_medias_por_grupo.json");
  fs.writeFileSync(outMedias, JSON.stringify(medias, null, 2), "utf-8");

  console.log(`\n✓ Métricas salvas em '${RESULTADOS_DIR}/'`);
  console.log(`  - metricas_individuais.json: resultados por execução`);
  console.log(
    `  - metricas_medias_por_grupo.json: médias por (ECOS × Grupo × Modelo)`,
  );
}

main();