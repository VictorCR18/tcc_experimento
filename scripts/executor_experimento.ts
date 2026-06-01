/**
 * executor_experimento.ts
 * TCC Victor Cavalcante — Executor dos Experimentos SSN (TypeScript)
 *
 * Executa os 4 grupos de prompt (G1-G4) nos 3 ecossistemas
 * em cada um dos 3 LLMs. Cada unidade é repetida 3 vezes.
 * Total: 3 ECOSs × 4 grupos × 3 modelos × 3 repetições = 108 execuções
 *
 * Instalação:
 * npm install typescript ts-node @types/node
 * npm install @anthropic-ai/sdk openai @google/genai
 *
 * Uso:
 * export GEMINI_API_KEY="..."
 * export ANTHROPIC_API_KEY="..."
 * export OPENAI_API_KEY="..."
 * npx ts-node executor_experimento.ts
 */

import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Ator {
  nome: string;
  tipo: string;
}

interface Relacao {
  origem: string;
  destino: string;
  tipo_fluxo: string;
}

interface Gateway {
  ator: string;
  tipo: "split" | "join";
  descricao: string;
}

interface ResultadoSSN {
  raciocinio_cot?: string; // Fundamental para o G4
  ecos: string;
  atores: Ator[];
  relacoes: Relacao[];
  gateways: Gateway[];
}

interface Execucao {
  id_execucao: string;
  ecos: string;
  grupo: string;
  modelo: string;
  repeticao: number;
  timestamp: string;
  duracao_seg: number;
  status: "ok" | "erro_api" | "erro_parse";
  conformidade_formato: "ok" | "falha";
  resposta_bruta: string;
  resultado_parseado: ResultadoSSN | { erro_parse: string; resposta_bruta: string };
}

// ─── Configurações ────────────────────────────────────────────────────────────

const TEMPERATURA = 0.0;
const MAX_TOKENS = 4096;
const REPETICOES = 3;
const OUTPUT_DIR = "execucoes";

// ─── Descrições dos ECOSs ─────────────────────────────────────────────────────

const DESCRICOES: Record<string, string> = {
  SkinnerBox:
    "SkinnerBox é um simulador de experimentos de condicionamento operante, utilizado no " +
    "curso de Psicologia da Universidade Federal do Ceará (UFC) e outros cursos para " +
    "atividades da disciplina de análise comportamental. O simulador é desenvolvido " +
    "utilizando as ferramentas Unity (motor de jogo), Maya 3D (modelagem 3D) e Adobe " +
    "(design). O Departamento de Psicologia da UFC fornece os requisitos e o contexto " +
    "educacional. Os arquivos do simulador são disponibilizados via Google Drive para " +
    "dois públicos: Professores (que utilizam nas disciplinas) e Alunos (que realizam " +
    "os experimentos).",

  SIPPA:
    "SIPPA (Sistema de Presença e Plano de Aula) é uma plataforma web da Universidade " +
    "Federal do Ceará para gestão de presenças e planos de aula. É desenvolvido com " +
    "JavaScript, HTML e CSS (frontend), Java com Spring Boot (backend), PostgreSQL " +
    "(banco de dados), Linux (sistema operacional), Docker (conteinerização), Git e " +
    "GitLab (controle de versão), Servidor web, SIGAA (integração com sistema acadêmico) " +
    "e NTIC (infraestrutura). Os serviços são disponibilizados para: Desenvolvedores, " +
    "Professores, Alunos, Coordenadores, Secretários, Pró-reitores de Graduação, " +
    "Responsáveis pelo RU, Sistemas corporativos, Administradores e sistemas integrados " +
    "SISAC, SIPAC e SAVI.",

  SOLAR:
    "SOLAR é o Ambiente Virtual de Aprendizagem (AVA) da Universidade Federal do Ceará " +
    "(UFC), composto por três módulos principais: SOLAR (web), SOLAR MOBILE e SOLAR MOOC. " +
    "O módulo web usa Ruby on Rails, PostgreSQL, Linux, NGINX, UNICORN, ChatServer Mono, " +
    "GIT, Github, Text To Speech, SIGAA e Módulo Acadêmico. O módulo mobile usa Android " +
    "SDK, SIGAA, Facebook, Twitter e GIT. O módulo MOOC usa Componente MOOC. Um Coordenador " +
    "Técnico do SOLAR gerencia o ecossistema. A Play Store distribui o app mobile. Uma " +
    "Equipe de Desenvolvimento e um Comitê de Pesquisa atuam como intermediários. Os " +
    "clientes incluem: Usuários Desenvolvedores, Módulo Acadêmico, Professores, Editores, " +
    "Administradores, Coordenadores, Alunos, Tutores, UFC, UAB e Pesquisadores. Os " +
    "Desenvolvedores possuem Clientes próprios (ClienteDoCliente).",
};

// ─── Schemas JSON ─────────────────────────────────────────────────────────────

const SCHEMA_BASE = `{
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}`;

const SCHEMA_G4 = `{
  "raciocinio_cot": "<Seu raciocínio passo a passo aqui>",
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}`;

// ─── Definições e Exemplos Multi-Shot ─────────────────────────────────────────

const DEFINICOES_SSN = `## Definições da Notação SSN

**Tipos de Atores:**
- CoI (Core of Interest): software/plataforma central — pode haver múltiplos módulos autônomos
- Fornecedor: fornece produtos (tecnologias, componentes) ao CoI
- Cliente: consome serviços do CoI
- Intermediario: distribui serviços entre CoI e Clientes (ex: lojas de apps, IDEs)
- Agregador: agrega serviços de múltiplos fornecedores
- ClienteDoCliente: recebe serviços indiretamente via outro Cliente

**Tipos de Fluxo:**
- P: produto (tecnologia/componente fornecido ao CoI)
- Ser: serviço prestado pelo CoI ou Intermediario
- Req: requisito/solicitação
- Des: atividade de desenvolvimento
- Comp: compensação financeira
- Sys: integração de sistemas

**Regras Semânticas Obrigatórias:**
1. Todo Fornecedor DEVE ter relação apontando para o CoI com tipo P
2. O CoI DEVE ter relações de saída (tipo Ser ou Sys)
3. Intermediarios recebem do CoI (ou Agregador) e repassam para Clientes
4. Não modele relações diretas de Fornecedores para Clientes
5. Se houver módulos (web, mobile, MOOC), cada um é um CoI separado`;

const EXEMPLOS_G3 = `## Exemplo 1 (Pandas)
Saída:
{
  "ecos": "Pandas",
  "atores": [
    {"nome": "Pandas", "tipo": "CoI"},
    {"nome": "Contribuidores", "tipo": "Fornecedor"},
    {"nome": "Mantenedores", "tipo": "Fornecedor"},
    {"nome": "Statsmodels", "tipo": "Fornecedor"},
    {"nome": "Distribuidores de Pacotes", "tipo": "Fornecedor"},
    {"nome": "Xorbits", "tipo": "Fornecedor"},
    {"nome": "Featuretools", "tipo": "Fornecedor"},
    {"nome": "Comunidade open-source", "tipo": "Agregador"},
    {"nome": "Plataformas e IDEs", "tipo": "Intermediario"},
    {"nome": "Softwares/Frameworks", "tipo": "Cliente"},
    {"nome": "Cientistas de Dados", "tipo": "Cliente"},
    {"nome": "Usuário/Desenvolvedor", "tipo": "Cliente"},
    {"nome": "Clientes", "tipo": "ClienteDoCliente"}
  ],
  "relacoes": [
    {"origem": "Contribuidores", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Mantenedores", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Statsmodels", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Distribuidores de Pacotes", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Xorbits", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Featuretools", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Pandas", "destino": "Comunidade open-source", "tipo_fluxo": "Sys"},
    {"origem": "Comunidade open-source", "destino": "Plataformas e IDEs", "tipo_fluxo": "Sys"},
    {"origem": "Plataformas e IDEs", "destino": "Softwares/Frameworks", "tipo_fluxo": "Ser"},
    {"origem": "Plataformas e IDEs", "destino": "Cientistas de Dados", "tipo_fluxo": "Ser"},
    {"origem": "Plataformas e IDEs", "destino": "Usuário/Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "Softwares/Frameworks", "destino": "Clientes", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "Plataformas e IDEs", "tipo": "split", "descricao": "Distribui o pacote Pandas"}
  ]
}

## Exemplo 2 (VSCode)
Saída:
{
  "ecos": "VSCode",
  "atores": [
    {"nome": "VSCode", "tipo": "CoI"},
    {"nome": "GitHub Copilot", "tipo": "Fornecedor"},
    {"nome": "OpenAI", "tipo": "Fornecedor"},
    {"nome": "IDEs", "tipo": "Fornecedor"},
    {"nome": "Microsoft", "tipo": "Fornecedor"},
    {"nome": "Devs de Extensões", "tipo": "Fornecedor"},
    {"nome": "Github", "tipo": "Agregador"},
    {"nome": "VSCode (Plataforma)", "tipo": "Intermediario"},
    {"nome": "Copilot", "tipo": "Intermediario"},
    {"nome": "Estudantes", "tipo": "Cliente"},
    {"nome": "Desenvolvedor", "tipo": "Cliente"},
    {"nome": "Equipe de Devs", "tipo": "Cliente"},
    {"nome": "Revisores", "tipo": "ClienteDoCliente"}
  ],
  "relacoes": [
    {"origem": "GitHub Copilot", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "OpenAI", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "IDEs", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "Microsoft", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "Devs de Extensões", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "VSCode", "destino": "Github", "tipo_fluxo": "Sys"},
    {"origem": "VSCode", "destino": "VSCode (Plataforma)", "tipo_fluxo": "Sys"},
    {"origem": "Github", "destino": "Copilot", "tipo_fluxo": "Sys"},
    {"origem": "VSCode (Plataforma)", "destino": "Estudantes", "tipo_fluxo": "Ser"},
    {"origem": "VSCode (Plataforma)", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "VSCode (Plataforma)", "destino": "Equipe de Devs", "tipo_fluxo": "Ser"},
    {"origem": "Copilot", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "Copilot", "destino": "Equipe de Devs", "tipo_fluxo": "Ser"},
    {"origem": "Desenvolvedor", "destino": "Revisores", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "VSCode (Plataforma)", "tipo": "split", "descricao": "Distribui ambiente para clientes"},
    {"ator": "Copilot", "tipo": "split", "descricao": "Distribui assistencia para devs"}
  ]
}

## Exemplo 3 (LangChain)
Saída:
{
  "ecos": "LangChain",
  "atores": [
    {"nome": "LangChain", "tipo": "CoI"},
    {"nome": "APIs LLMs", "tipo": "Fornecedor"},
    {"nome": "OpenAI", "tipo": "Fornecedor"},
    {"nome": "Anthropic", "tipo": "Fornecedor"},
    {"nome": "IDEs", "tipo": "Fornecedor"},
    {"nome": "Google", "tipo": "Fornecedor"},
    {"nome": "Infraestrutura Cloud", "tipo": "Fornecedor"},
    {"nome": "Comunidade/Fórum", "tipo": "Fornecedor"},
    {"nome": "APIs/LLMs", "tipo": "Agregador"},
    {"nome": "Integradores de API", "tipo": "Intermediario"},
    {"nome": "Startups", "tipo": "Cliente"},
    {"nome": "Desenvolvedor", "tipo": "Cliente"},
    {"nome": "Empresas de Automação", "tipo": "Cliente"},
    {"nome": "Usuários final", "tipo": "ClienteDoCliente"}
  ],
  "relacoes": [
    {"origem": "APIs LLMs", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "OpenAI", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "Anthropic", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "IDEs", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "Google", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "Infraestrutura Cloud", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "Comunidade/Fórum", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "LangChain", "destino": "APIs/LLMs", "tipo_fluxo": "Sys"},
    {"origem": "APIs/LLMs", "destino": "Integradores de API", "tipo_fluxo": "Sys"},
    {"origem": "Integradores de API", "destino": "Startups", "tipo_fluxo": "Ser"},
    {"origem": "Integradores de API", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "Integradores de API", "destino": "Empresas de Automação", "tipo_fluxo": "Ser"},
    {"origem": "Startups", "destino": "Usuários final", "tipo_fluxo": "Ser"},
    {"origem": "Empresas de Automação", "destino": "Usuários final", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "Integradores de API", "tipo": "split", "descricao": "Distribui integrações para os clientes"}
  ]
}`;

const EXEMPLOS_G4 = `## Exemplo 1 (Pandas)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é Pandas. Passo 2: Fornecedores (Contribuidores, Mantenedores, Statsmodels, Distribuidores, Xorbits, Featuretools) apontam para Pandas. Passo 3: Clientes são Softwares/Frameworks, Cientistas, Usuário/Dev. 'Clientes' é ClienteDoCliente. Passo 4: Comunidade atua como Agregador e Plataformas/IDEs como Intermediario. Passo 5: Plataformas e IDEs requer gateway split. Passo 6: Regras validadas.",
  "ecos": "Pandas",
  "atores": [
    {"nome": "Pandas", "tipo": "CoI"},
    {"nome": "Contribuidores", "tipo": "Fornecedor"},
    {"nome": "Mantenedores", "tipo": "Fornecedor"},
    {"nome": "Statsmodels", "tipo": "Fornecedor"},
    {"nome": "Distribuidores de Pacotes", "tipo": "Fornecedor"},
    {"nome": "Xorbits", "tipo": "Fornecedor"},
    {"nome": "Featuretools", "tipo": "Fornecedor"},
    {"nome": "Comunidade open-source", "tipo": "Agregador"},
    {"nome": "Plataformas e IDEs", "tipo": "Intermediario"},
    {"nome": "Softwares/Frameworks", "tipo": "Cliente"},
    {"nome": "Cientistas de Dados", "tipo": "Cliente"},
    {"nome": "Usuário/Desenvolvedor", "tipo": "Cliente"},
    {"nome": "Clientes", "tipo": "ClienteDoCliente"}
  ],
  "relacoes": [
    {"origem": "Contribuidores", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Mantenedores", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Statsmodels", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Distribuidores de Pacotes", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Xorbits", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Featuretools", "destino": "Pandas", "tipo_fluxo": "P"},
    {"origem": "Pandas", "destino": "Comunidade open-source", "tipo_fluxo": "Sys"},
    {"origem": "Comunidade open-source", "destino": "Plataformas e IDEs", "tipo_fluxo": "Sys"},
    {"origem": "Plataformas e IDEs", "destino": "Softwares/Frameworks", "tipo_fluxo": "Ser"},
    {"origem": "Plataformas e IDEs", "destino": "Cientistas de Dados", "tipo_fluxo": "Ser"},
    {"origem": "Plataformas e IDEs", "destino": "Usuário/Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "Softwares/Frameworks", "destino": "Clientes", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "Plataformas e IDEs", "tipo": "split", "descricao": "Distribui o pacote Pandas"}
  ]
}

## Exemplo 2 (VSCode)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é VSCode. Passo 2: Mapeados 5 Fornecedores que fornecem P ao VSCode. Passo 3: Clientes (Amarelo) e Revisores (Cliente do Cliente/Cinza). Passo 4: VSCode e Copilot atuam como Intermediarios (Verde) e Github como Agregador (Vermelho). Passo 5: Gateways split nos intermediários. Passo 6: Modelo completo.",
  "ecos": "VSCode",
  "atores": [
    {"nome": "VSCode", "tipo": "CoI"},
    {"nome": "GitHub Copilot", "tipo": "Fornecedor"},
    {"nome": "OpenAI", "tipo": "Fornecedor"},
    {"nome": "IDEs", "tipo": "Fornecedor"},
    {"nome": "Microsoft", "tipo": "Fornecedor"},
    {"nome": "Devs de Extensões", "tipo": "Fornecedor"},
    {"nome": "Github", "tipo": "Agregador"},
    {"nome": "VSCode (Plataforma)", "tipo": "Intermediario"},
    {"nome": "Copilot", "tipo": "Intermediario"},
    {"nome": "Estudantes", "tipo": "Cliente"},
    {"nome": "Desenvolvedor", "tipo": "Cliente"},
    {"nome": "Equipe de Devs", "tipo": "Cliente"},
    {"nome": "Revisores", "tipo": "ClienteDoCliente"}
  ],
  "relacoes": [
    {"origem": "GitHub Copilot", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "OpenAI", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "IDEs", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "Microsoft", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "Devs de Extensões", "destino": "VSCode", "tipo_fluxo": "P"},
    {"origem": "VSCode", "destino": "Github", "tipo_fluxo": "Sys"},
    {"origem": "VSCode", "destino": "VSCode (Plataforma)", "tipo_fluxo": "Sys"},
    {"origem": "Github", "destino": "Copilot", "tipo_fluxo": "Sys"},
    {"origem": "VSCode (Plataforma)", "destino": "Estudantes", "tipo_fluxo": "Ser"},
    {"origem": "VSCode (Plataforma)", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "VSCode (Plataforma)", "destino": "Equipe de Devs", "tipo_fluxo": "Ser"},
    {"origem": "Copilot", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "Copilot", "destino": "Equipe de Devs", "tipo_fluxo": "Ser"},
    {"origem": "Desenvolvedor", "destino": "Revisores", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "VSCode (Plataforma)", "tipo": "split", "descricao": "Distribui ambiente para clientes"},
    {"ator": "Copilot", "tipo": "split", "descricao": "Distribui assistencia para devs"}
  ]
}

## Exemplo 3 (LangChain)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é LangChain. Passo 2: Fornecedores listados apontam para o CoI. Passo 3: Clientes são Startups, Desenvolvedores e Empresas, que atendem os Usuários Finais (ClienteDoCliente). Passo 4: LangChain passa por APIs/LLMs (Agregador) que vai para Integradores (Intermediario). Passo 5: Integradores precisam de split. Passo 6: Regras validadas.",
  "ecos": "LangChain",
  "atores": [
    {"nome": "LangChain", "tipo": "CoI"},
    {"nome": "APIs LLMs", "tipo": "Fornecedor"},
    {"nome": "OpenAI", "tipo": "Fornecedor"},
    {"nome": "Anthropic", "tipo": "Fornecedor"},
    {"nome": "IDEs", "tipo": "Fornecedor"},
    {"nome": "Google", "tipo": "Fornecedor"},
    {"nome": "Infraestrutura Cloud", "tipo": "Fornecedor"},
    {"nome": "Comunidade/Fórum", "tipo": "Fornecedor"},
    {"nome": "APIs/LLMs", "tipo": "Agregador"},
    {"nome": "Integradores de API", "tipo": "Intermediario"},
    {"nome": "Startups", "tipo": "Cliente"},
    {"nome": "Desenvolvedor", "tipo": "Cliente"},
    {"nome": "Empresas de Automação", "tipo": "Cliente"},
    {"nome": "Usuários final", "tipo": "ClienteDoCliente"}
  ],
  "relacoes": [
    {"origem": "APIs LLMs", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "OpenAI", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "Anthropic", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "IDEs", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "Google", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "Infraestrutura Cloud", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "Comunidade/Fórum", "destino": "LangChain", "tipo_fluxo": "P"},
    {"origem": "LangChain", "destino": "APIs/LLMs", "tipo_fluxo": "Sys"},
    {"origem": "APIs/LLMs", "destino": "Integradores de API", "tipo_fluxo": "Sys"},
    {"origem": "Integradores de API", "destino": "Startups", "tipo_fluxo": "Ser"},
    {"origem": "Integradores de API", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "Integradores de API", "destino": "Empresas de Automação", "tipo_fluxo": "Ser"},
    {"origem": "Startups", "destino": "Usuários final", "tipo_fluxo": "Ser"},
    {"origem": "Empresas de Automação", "destino": "Usuários final", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "Integradores de API", "tipo": "split", "descricao": "Distribui integrações para os clientes"}
  ]
}`;

// ─── Construtores de Prompt ───────────────────────────────────────────────────

function buildPrompt(grupo: string, ecos: string): string {
  const desc = DESCRICOES[ecos];
  const instrucaoBase =
    `Retorne SOMENTE um objeto JSON válido, sem texto adicional, ` +
    `sem markdown, sem backticks.\nO JSON deve seguir exatamente este schema:\n${SCHEMA_BASE}\n\n` +
    `Ecossistema: ${desc}`;

  const instrucaoG4 = 
    `Retorne SOMENTE um objeto JSON válido, sem texto adicional, ` +
    `sem markdown, sem backticks. Certifique-se de preencher a chave "raciocinio_cot" antes de montar os arrays.\nO JSON deve seguir exatamente este schema:\n${SCHEMA_G4}\n\n` +
    `Ecossistema: ${desc}`;

  switch (grupo) {
    case "G1":
      return (
        "Gere um modelo SSN (Software Supply Network) para o ecossistema de software descrito abaixo.\n\n" +
        instrucaoBase
      );

    case "G2":
      return (
        "Você deve gerar um modelo SSN (Software Supply Network) para o ecossistema de software descrito abaixo.\n\n" +
        DEFINICOES_SSN +
        "\n\n" +
        instrucaoBase
      );

    case "G3":
      return (
        "Você é um especialista em modelagem de Ecossistemas de Software (ECOS) com domínio " +
        "avançado na notação SSN (Software Supply Network). Sua tarefa é gerar um modelo SSN " +
        "estruturalmente preciso para o ecossistema descrito.\n\n" +
        DEFINICOES_SSN +
        "\n\n## Exemplos Completos\n" +
        EXEMPLOS_G3 +
        "\n\n" +
        instrucaoBase
      );

    case "G4":
      return (
        "Você é um especialista em modelagem de Ecossistemas de Software (ECOS) com domínio " +
        "avançado na notação SSN. Antes de gerar o modelo final, raciocine passo a passo " +
        "conforme as etapas abaixo.\n\n" +
        DEFINICOES_SSN +
        "\n\n## Protocolo de Raciocínio (escreva detalhadamente no campo \"raciocinio_cot\" do JSON)\n" +
        "Etapa 1 — Identificar o(s) CoI: Qual é o software central?\n" +
        "Etapa 2 — Mapear Fornecedores: Quais tecnologias apontam para o CoI?\n" +
        "Etapa 3 — Mapear Clientes e ClienteDoCliente: Quem consome direta e indiretamente?\n" +
        "Etapa 4 — Identificar Intermediarios e Agregadores: Há distribuição via plataformas?\n" +
        "Etapa 5 — Verificar Gateways: Há splits (divisão para múltiplos clientes)?\n" +
        "Etapa 6 — Validar Completude: Todos conectados segundo as regras?\n\n" +
        "## Exemplos Completos\n" +
        EXEMPLOS_G4 +
        "\n\n" +
        instrucaoG4
      );

    default:
      throw new Error(`Grupo desconhecido: ${grupo}`);
  }
}

// ─── Chamadas às APIs ─────────────────────────────────────────────────────────

async function chamarGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não definida");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: { temperature: TEMPERATURA }
  });
  
  return response.text ?? "";
}

// ── Para adicionar Claude futuramente: ────────────────────────────────────────
// npm install @anthropic-ai/sdk
// async function chamarClaude(prompt: string): Promise<string> {
//   const { default: Anthropic } = await import("@anthropic-ai/sdk");
//   const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
//   const message = await client.messages.create({
//     model: "claude-sonnet-4-5",
//     max_tokens: MAX_TOKENS,
//     temperature: TEMPERATURA,
//     messages: [{ role: "user", content: prompt }],
//   });
//   const block = message.content[0];
//   if (block.type !== "text") throw new Error("Resposta inesperada do Claude");
//   return block.text;
// }

// ── Para adicionar GPT-4o futuramente: ────────────────────────────────────────
// npm install openai
// async function chamarGPT4o(prompt: string): Promise<string> {
//   const { default: OpenAI } = await import("openai");
//   const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
//   const response = await client.chat.completions.create({
//     model: "gpt-4o",
//     temperature: TEMPERATURA,
//     max_tokens: MAX_TOKENS,
//     messages: [{ role: "user", content: prompt }],
//   });
//   return response.choices[0].message.content ?? "";
// }

// Modelo local via Ollama (compatível com API OpenAI)
async function chamarOllama(prompt: string): Promise<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    baseURL: "http://localhost:11434/v1",
    apiKey: "ollama",  // valor ignorado pelo Ollama, mas o campo é obrigatório
  });
  const response = await client.chat.completions.create({
    model: "llama3.2",  // troque pelo nome exato do modelo que você baixou
    temperature: TEMPERATURA,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0].message.content ?? "";
}

const MODELOS: Record<string, (p: string) => Promise<string>> = {
  // "gemini-3.5-flash": chamarGemini,
  // "claude-sonnet-4-5": chamarClaude,  // descomentar quando tiver a chave
  // "gpt-4o":            chamarGPT4o,   // descomentar quando tiver a chave
  "ollama-llama3.2":   chamarOllama,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonSeguro(texto: string): ResultadoSSN | { erro_parse: string; resposta_bruta: string } {
  let t = texto.trim();
  // Remove blocos markdown se presentes
  if (t.startsWith("```")) {
    const linhas = t.split("\n");
    t = linhas.slice(1, -1).join("\n");
  }
  try {
    return JSON.parse(t) as ResultadoSSN;
  } catch (e) {
    return { erro_parse: String(e), resposta_bruta: texto };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ─── Executor Principal ───────────────────────────────────────────────────────

const MAX_TENTATIVAS = 5;

async function chamarComRetry(fn: (p: string) => Promise<string>, prompt: string): Promise<string> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      return await fn(prompt);
    } catch (e) {
      const msg = String(e);
      const is503 = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand");
      if (is503 && tentativa < MAX_TENTATIVAS) {
        const espera = tentativa * 15000;
        console.log(`\n  ⚠ Servidor sobrecarregado. Tentativa ${tentativa}/${MAX_TENTATIVAS - 1}. Aguardando ${espera / 1000}s...`);
        await sleep(espera);
      } else {
        throw e;
      }
    }
  }
  throw new Error("Máximo de tentativas atingido");
}

async function executarUnidade(
  ecos: string,
  grupo: string,
  modelo: string,
  repeticao: number
): Promise<Execucao> {
  const prompt = buildPrompt(grupo, ecos);
  const fn = MODELOS[modelo];
  const inicio = Date.now();

  let respostaBruta = "";
  let status: Execucao["status"] = "ok";

  try {
    respostaBruta = await chamarComRetry(fn, prompt);
  } catch (e) {
    respostaBruta = `ERRO_API: ${String(e)}`;
    status = "erro_api";
  }

  const duracaoSeg = parseFloat(((Date.now() - inicio) / 1000).toFixed(2));
  const resultadoParseado = status === "ok" ? parseJsonSeguro(respostaBruta) : { erro_parse: "api_error", resposta_bruta: respostaBruta };
  const conformidadeFormato: "ok" | "falha" =
    "atores" in resultadoParseado && "relacoes" in resultadoParseado ? "ok" : "falha";

  return {
    id_execucao:        `${ecos}_${grupo}_${modelo}_R${repeticao}`,
    ecos,
    grupo,
    modelo,
    repeticao,
    timestamp:          new Date().toISOString(),
    duracao_seg:        duracaoSeg,
    status,
    conformidade_formato: conformidadeFormato,
    resposta_bruta:     respostaBruta,
    resultado_parseado: resultadoParseado,
  };
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const grupos      = ["G1", "G2", "G3", "G4"];
  const ecosLista   = Object.keys(DESCRICOES);
  const modelosLista = Object.keys(MODELOS);
  const total       = ecosLista.length * grupos.length * modelosLista.length * REPETICOES;

  const log: Array<{ id: string; status: string; conformidade: string; duracao: number }> = [];
  let contador = 0;

  for (const ecos of ecosLista) {
    for (const grupo of grupos) {
      for (const modelo of modelosLista) {
        for (let rep = 1; rep <= REPETICOES; rep++) {
          contador++;
          process.stdout.write(`[${contador}/${total}] ${ecos} | ${grupo} | ${modelo} | R${rep} ... `);

          const resultado = await executarUnidade(ecos, grupo, modelo, rep);

          log.push({
            id:           resultado.id_execucao,
            status:       resultado.status,
            conformidade: resultado.conformidade_formato,
            duracao:      resultado.duracao_seg,
          });

          const fname = path.join(OUTPUT_DIR, `${resultado.id_execucao}.json`);
          fs.writeFileSync(fname, JSON.stringify(resultado, null, 2), "utf-8");

          console.log(
            `${resultado.status} | conformidade=${resultado.conformidade_formato} | ${resultado.duracao_seg}s`
          );

          await sleep(1500); // evita rate limit
        }
      }
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "_log_execucoes.json"),
    JSON.stringify(log, null, 2),
    "utf-8"
  );

  console.log(`\n✓ Experimento concluído. ${contador} execuções salvas em '${OUTPUT_DIR}/'`);
}

main().catch(console.error);
