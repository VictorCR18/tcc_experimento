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
import OpenAI from "openai";
import Groq from "groq-sdk";

import * as dotenv from "dotenv";
dotenv.config();

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
  raciocinio_cot?: string;
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
  resultado_parseado:
    | ResultadoSSN
    | { erro_parse: string; resposta_bruta: string };
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
  "gateways": [{"ator": "<nome do ator que possui o gateway>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}
Importante: se não houver gateways, use "gateways": [].`;

const SCHEMA_G4 = `{
  "raciocinio_cot": "<Seu raciocínio passo a passo aqui>",
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome do ator que possui o gateway>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}
Importante: se não houver gateways, use "gateways": [].`;

const DEFINICOES_SSN = `## Definições da Notação SSN

**Tipos de Atores:**
- CoI (Core of Interest): software/plataforma central — pode haver múltiplos módulos autônomos, cada um modelado como um CoI separado
- Fornecedor: fornece produtos (tecnologias, componentes) ao CoI
- Cliente: consome serviços do CoI
- Intermediario: distribui serviços entre CoI e Clientes (ex: lojas de apps, IDEs)
- Agregador: agrega serviços de múltiplos fornecedores ou módulos antes de repassar
- ClienteDoCliente: recebe serviços indiretamente via outro Cliente

**Tipos de Fluxo:**
- P: produto (tecnologia/componente fornecido ao CoI)
- Ser: serviço prestado pelo CoI ou Intermediario aos Clientes
- Req: requisito/solicitação feita ao CoI
- Des: atividade de desenvolvimento realizada sobre o CoI
- Comp: compensação financeira entre atores
- Sys: integração sistêmica entre plataformas, módulos ou agregadores

**Gateways:**
- split (XOU): o ator distribui serviços para EXATAMENTE UM dos destinos por vez
- join: o ator recebe de múltiplas origens e consolida para um único destino
- Se um ator distribui para UM OU MAIS destinos simultaneamente, indique isso na descrição do gateway como "OU Gateway: distribui para um ou mais destinos"
- Se não houver gateway, omita o ator da lista (use "gateways": [])

**Regras Semânticas Obrigatórias:**
1. Todo Fornecedor DEVE ter relação apontando para o CoI com tipo P
2. O CoI DEVE ter relações de saída (tipo Ser ou Sys)
3. Intermediarios recebem do CoI (ou Agregador) e repassam para Clientes — nunca recebem diretamente do CoI se houver um Agregador no caminho
4. Não modele relações diretas de Fornecedores para Clientes
5. Se houver módulos (web, mobile, MOOC), cada um é um CoI separado
6. Agregadores ficam entre o CoI e os Intermediarios; o CoI aponta para o Agregador (Sys), e o Agregador aponta para os Intermediarios (Sys)`;

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
    {"ator": "Plataformas e IDEs", "tipo": "split", "descricao": "Distribui o pacote Pandas para múltiplos tipos de clientes"}
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
    {"origem": "Github", "destino": "VSCode (Plataforma)", "tipo_fluxo": "Sys"},
    {"origem": "Github", "destino": "Copilot", "tipo_fluxo": "Sys"},
    {"origem": "VSCode (Plataforma)", "destino": "Estudantes", "tipo_fluxo": "Ser"},
    {"origem": "VSCode (Plataforma)", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "VSCode (Plataforma)", "destino": "Equipe de Devs", "tipo_fluxo": "Ser"},
    {"origem": "Copilot", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "Copilot", "destino": "Equipe de Devs", "tipo_fluxo": "Ser"},
    {"origem": "Desenvolvedor", "destino": "Revisores", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "Github", "tipo": "split", "descricao": "OU Gateway: distribui para VSCode (Plataforma) e Copilot simultaneamente"},
    {"ator": "VSCode (Plataforma)", "tipo": "split", "descricao": "Distribui ambiente de desenvolvimento para múltiplos tipos de clientes"},
    {"ator": "Copilot", "tipo": "split", "descricao": "Distribui assistência de IA para múltiplos tipos de clientes"}
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
    {"ator": "Integradores de API", "tipo": "split", "descricao": "Distribui integrações para múltiplos tipos de clientes"}
  ]
}
  
## Exemplo 4 (Netflix)
Saída:
{
  "ecos": "Netflix",
  "atores": [
    {"nome": "NETFLIX (EMPRESA)", "tipo": "CoI"},
    {"nome": "NETFLIX (PC)", "tipo": "CoI"},
    {"nome": "NETFLIX (MOBILE)", "tipo": "CoI"},
    {"nome": "PRODUTORAS DE MÍDIAS", "tipo": "Fornecedor"},
    {"nome": "BANCO DE DADOS", "tipo": "Fornecedor"},
    {"nome": "SERVIDORES", "tipo": "Fornecedor"},
    {"nome": "VENDEDOR DE PC", "tipo": "Fornecedor"},
    {"nome": "VENDEDOR DE SMARTPHONES", "tipo": "Fornecedor"},
    {"nome": "INTERNET", "tipo": "Intermediario"},
    {"nome": "NAVEGADORES DE INTERNET", "tipo": "Intermediario"},
    {"nome": "APP STORE", "tipo": "Intermediario"},
    {"nome": "PLAY STORE", "tipo": "Intermediario"},
    {"nome": "USUÁRIOS", "tipo": "Cliente"}
  ],
  "relacoes": [
    {"origem": "PRODUTORAS DE MÍDIAS", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "N/A"},
    {"origem": "BANCO DE DADOS", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "N/A"},
    {"origem": "SERVIDORES", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "N/A"},
    {"origem": "NETFLIX (EMPRESA)", "destino": "INTERNET", "tipo_fluxo": "N/A"},
    {"origem": "INTERNET", "destino": "NETFLIX (PC)", "tipo_fluxo": "N/A"},
    {"origem": "INTERNET", "destino": "NETFLIX (MOBILE)", "tipo_fluxo": "N/A"},
    {"origem": "NETFLIX (PC)", "destino": "NAVEGADORES DE INTERNET", "tipo_fluxo": "N/A"},
    {"origem": "NETFLIX (MOBILE)", "destino": "APP STORE", "tipo_fluxo": "N/A"},
    {"origem": "NETFLIX (MOBILE)", "destino": "PLAY STORE", "tipo_fluxo": "N/A"},
    {"origem": "NAVEGADORES DE INTERNET", "destino": "Gateway OR 1", "tipo_fluxo": "S.1"},
    {"origem": "APP STORE", "destino": "Gateway OR 2", "tipo_fluxo": "S.2"},
    {"origem": "PLAY STORE", "destino": "Gateway OR 2", "tipo_fluxo": "S.2"},
    {"origem": "Gateway OR 2", "destino": "Gateway OR 1", "tipo_fluxo": "N/A"},
    {"origem": "Gateway OR 1", "destino": "USUÁRIOS", "tipo_fluxo": "N/A"},
    {"origem": "VENDEDOR DE PC", "destino": "USUÁRIOS", "tipo_fluxo": "P.1"},
    {"origem": "VENDEDOR DE SMARTPHONES", "destino": "USUÁRIOS", "tipo_fluxo": "P.2"}
  ],
  "gateways": [
    {"ator": "INTERNET", "tipo": "split", "descricao": "Distribui o sinal da Netflix (Empresa) para as plataformas PC e Mobile"},
    {"ator": "NETFLIX (MOBILE)", "tipo": "split", "descricao": "Distribui o acesso mobile para as lojas de aplicativos App Store e Play Store"},
    {"ator": "Gateway OR 2", "tipo": "OUGateway", "descricao": "Losango preto inferior: Unifica os fluxos de aplicativos mobile (S.2) vindos da App Store e Play Store"},
    {"ator": "Gateway OR 1", "tipo": "OUGateway", "descricao": "Losango preto superior: Unifica o fluxo web (S.1) com os fluxos mobile do Gateway OR 2, entregando o serviço aos Usuários"}
  ]
}`;

const EXEMPLOS_G4 = `## Exemplo 1 (Pandas)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é Pandas. Passo 2: Fornecedores (Contribuidores, Mantenedores, Statsmodels, Distribuidores, Xorbits, Featuretools) apontam com P para Pandas. Passo 3: Clientes são Softwares/Frameworks, Cientistas, Usuário/Dev. 'Clientes' recebe de Softwares/Frameworks, portanto é ClienteDoCliente. Passo 4: Comunidade open-source atua como Agregador (recebe Sys do CoI e repassa Sys ao Intermediario). Plataformas e IDEs é Intermediario (recebe Sys do Agregador e distribui Ser para Clientes). Passo 5: Plataformas e IDEs serve múltiplos Clientes — requer gateway split. Passo 6: Todos os atores estão conectados e as regras semânticas estão satisfeitas.",
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
    {"ator": "Plataformas e IDEs", "tipo": "split", "descricao": "Distribui o pacote Pandas para múltiplos tipos de clientes"}
  ]
}

## Exemplo 2 (VSCode)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é VSCode. Passo 2: Fornecedores (GitHub Copilot, OpenAI, IDEs, Microsoft, Devs de Extensões) fornecem P ao CoI. Passo 3: Clientes são Estudantes, Desenvolvedor e Equipe de Devs. Revisores recebem serviço de Desenvolvedor, sendo ClienteDoCliente. Passo 4: Github é o Agregador (Vermelho) — recebe Sys do CoI e distribui Sys para ambos os Intermediarios: VSCode (Plataforma) e Copilot. Nenhuma relação direta do CoI para os Intermediarios — tudo passa pelo Agregador. Passo 5: Github distribui para dois Intermediarios simultaneamente — OU Gateway no Github. VSCode (Plataforma) e Copilot servem múltiplos Clientes — split em cada um. Passo 6: Todos os atores conectados, regras semânticas satisfeitas.",
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
    {"origem": "Github", "destino": "VSCode (Plataforma)", "tipo_fluxo": "Sys"},
    {"origem": "Github", "destino": "Copilot", "tipo_fluxo": "Sys"},
    {"origem": "VSCode (Plataforma)", "destino": "Estudantes", "tipo_fluxo": "Ser"},
    {"origem": "VSCode (Plataforma)", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "VSCode (Plataforma)", "destino": "Equipe de Devs", "tipo_fluxo": "Ser"},
    {"origem": "Copilot", "destino": "Desenvolvedor", "tipo_fluxo": "Ser"},
    {"origem": "Copilot", "destino": "Equipe de Devs", "tipo_fluxo": "Ser"},
    {"origem": "Desenvolvedor", "destino": "Revisores", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "Github", "tipo": "split", "descricao": "OU Gateway: distribui para VSCode (Plataforma) e Copilot simultaneamente"},
    {"ator": "VSCode (Plataforma)", "tipo": "split", "descricao": "Distribui ambiente de desenvolvimento para múltiplos tipos de clientes"},
    {"ator": "Copilot", "tipo": "split", "descricao": "Distribui assistência de IA para múltiplos tipos de clientes"}
  ]
}

## Exemplo 3 (LangChain)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é LangChain. Passo 2: Fornecedores (APIs LLMs, OpenAI, Anthropic, IDEs, Google, Infraestrutura Cloud, Comunidade/Fórum) fornecem P ao CoI. Passo 3: Clientes são Startups, Desenvolvedor e Empresas de Automação. Usuários finais recebem serviço dos Clientes, sendo ClienteDoCliente. Passo 4: APIs/LLMs é o Agregador — recebe Sys do CoI e repassa Sys ao Intermediario (Integradores de API). Passo 5: Integradores de API servem múltiplos Clientes — requer gateway split. Passo 6: Todos os atores conectados, regras semânticas satisfeitas.",
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
    {"ator": "Integradores de API", "tipo": "split", "descricao": "Distribui integrações para múltiplos tipos de clientes"}
  ]
}
  
## Exemplo 4 (Netflix)
Saída:
{
  "raciocinio_cot": "Passo 1: A CoI (Azul) é representada em três blocos: NETFLIX (EMPRESA), NETFLIX (PC) e NETFLIX (MOBILE). Passo 2: Os Fornecedores (Laranja) PRODUTORAS DE MÍDIAS, BANCO DE DADOS e SERVIDORES fornecem para a NETFLIX (EMPRESA). VENDEDOR DE PC e VENDEDOR DE SMARTPHONES fornecem diretamente ao Cliente. Passo 3: O Cliente (Amarelo) é USUÁRIOS. Passo 4: Os Intermediários (Verde) são INTERNET, NAVEGADORES DE INTERNET, APP STORE e PLAY STORE. Passo 5: O diagrama apresenta fluxos de split implícitos na INTERNET e na NETFLIX (MOBILE). Passo 6: Diferente dos modelos anteriores, este utiliza as figuras corretas de OUGateways (losangos pretos com a inscrição 'OR') para consolidar os caminhos (fluxos S.1 e S.2) antes de entregá-los aos USUÁRIOS.",
  "ecos": "Netflix",
  "atores": [
    {"nome": "NETFLIX (EMPRESA)", "tipo": "CoI"},
    {"nome": "NETFLIX (PC)", "tipo": "CoI"},
    {"nome": "NETFLIX (MOBILE)", "tipo": "CoI"},
    {"nome": "PRODUTORAS DE MÍDIAS", "tipo": "Fornecedor"},
    {"nome": "BANCO DE DADOS", "tipo": "Fornecedor"},
    {"nome": "SERVIDORES", "tipo": "Fornecedor"},
    {"nome": "VENDEDOR DE PC", "tipo": "Fornecedor"},
    {"nome": "VENDEDOR DE SMARTPHONES", "tipo": "Fornecedor"},
    {"nome": "INTERNET", "tipo": "Intermediario"},
    {"nome": "NAVEGADORES DE INTERNET", "tipo": "Intermediario"},
    {"nome": "APP STORE", "tipo": "Intermediario"},
    {"nome": "PLAY STORE", "tipo": "Intermediario"},
    {"nome": "USUÁRIOS", "tipo": "Cliente"}
  ],
  "relacoes": [
    {"origem": "PRODUTORAS DE MÍDIAS", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "N/A"},
    {"origem": "BANCO DE DADOS", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "N/A"},
    {"origem": "SERVIDORES", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "N/A"},
    {"origem": "NETFLIX (EMPRESA)", "destino": "INTERNET", "tipo_fluxo": "N/A"},
    {"origem": "INTERNET", "destino": "NETFLIX (PC)", "tipo_fluxo": "N/A"},
    {"origem": "INTERNET", "destino": "NETFLIX (MOBILE)", "tipo_fluxo": "N/A"},
    {"origem": "NETFLIX (PC)", "destino": "NAVEGADORES DE INTERNET", "tipo_fluxo": "N/A"},
    {"origem": "NETFLIX (MOBILE)", "destino": "APP STORE", "tipo_fluxo": "N/A"},
    {"origem": "NETFLIX (MOBILE)", "destino": "PLAY STORE", "tipo_fluxo": "N/A"},
    {"origem": "NAVEGADORES DE INTERNET", "destino": "Gateway OR 1", "tipo_fluxo": "S.1"},
    {"origem": "APP STORE", "destino": "Gateway OR 2", "tipo_fluxo": "S.2"},
    {"origem": "PLAY STORE", "destino": "Gateway OR 2", "tipo_fluxo": "S.2"},
    {"origem": "Gateway OR 2", "destino": "Gateway OR 1", "tipo_fluxo": "N/A"},
    {"origem": "Gateway OR 1", "destino": "USUÁRIOS", "tipo_fluxo": "N/A"},
    {"origem": "VENDEDOR DE PC", "destino": "USUÁRIOS", "tipo_fluxo": "P.1"},
    {"origem": "VENDEDOR DE SMARTPHONES", "destino": "USUÁRIOS", "tipo_fluxo": "P.2"}
  ],
  "gateways": [
    {"ator": "INTERNET", "tipo": "split", "descricao": "Distribui o sinal da Netflix (Empresa) para as plataformas PC e Mobile"},
    {"ator": "NETFLIX (MOBILE)", "tipo": "split", "descricao": "Distribui o acesso mobile para as lojas de aplicativos App Store e Play Store"},
    {"ator": "Gateway OR 2", "tipo": "OUGateway", "descricao": "Losango preto inferior: Unifica os fluxos de aplicativos mobile (S.2) vindos da App Store e Play Store"},
    {"ator": "Gateway OR 1", "tipo": "OUGateway", "descricao": "Losango preto superior: Unifica o fluxo web (S.1) com os fluxos mobile do Gateway OR 2, entregando o serviço aos Usuários"}
  ]
}`;

// ─── Construtores de Prompt ───────────────────────────────────────────────────

function buildPrompt(grupo: string, ecos: string): string {
  const desc = DESCRICOES[ecos];
  const instrucaoBase =
    `Retorne SOMENTE um objeto JSON válido, sem texto adicional, ` +
    `sem markdown, sem backticks. Se não houver gateways, use "gateways": [].\n` +
    `O JSON deve seguir exatamente este schema:\n${SCHEMA_BASE}\n\n` +
    `Ecossistema: ${desc}`;

  const instrucaoG4 =
    `Retorne SOMENTE um objeto JSON válido, sem texto adicional, ` +
    `sem markdown, sem backticks. Certifique-se de preencher a chave "raciocinio_cot" antes de montar os arrays. ` +
    `Se não houver gateways, use "gateways": [].\n` +
    `O JSON deve seguir exatamente este schema:\n${SCHEMA_G4}\n\n` +
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
        '\n\n## Protocolo de Raciocínio (escreva detalhadamente no campo "raciocinio_cot" do JSON)\n' +
        "Etapa 1 — Identificar o(s) CoI: Qual é o software central? Se houver múltiplos módulos autônomos, cada um é um CoI.\n" +
        "Etapa 2 — Mapear Fornecedores: Quais tecnologias/componentes apontam com P para o CoI?\n" +
        "Etapa 3 — Mapear Clientes e ClienteDoCliente: Quem consome direta e indiretamente?\n" +
        "Etapa 4 — Identificar Agregadores e Intermediarios: O CoI aponta (Sys) para o Agregador; o Agregador aponta (Sys) para os Intermediarios. Nunca modele relação direta CoI→Intermediario se houver Agregador no caminho.\n" +
        "Etapa 5 — Verificar Gateways: Há splits (XOU: exatamente um destino) ou OU Gateways (um ou mais destinos simultâneos)? Se não houver, use gateways: [].\n" +
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

// async function chamarGemini(prompt: string): Promise<string> {
//   const apiKey = process.env.GEMINI_API_KEY;
//   if (!apiKey) throw new Error("GEMINI_API_KEY não definida");

//   const ai = new GoogleGenAI({ apiKey });
//   const response = await ai.models.generateContent({
//     model: "gemini-3.5-flash",
//     contents: prompt,
//     config: { temperature: TEMPERATURA },
//   });

//   return response.text ?? "";
// }

// ── Claude ────────────────────────────────────────────────────────────────────
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

// ── GPT-4o ────────────────────────────────────────────────────────────────────
// npm install openai
// const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// async function chamarGPT4o(prompt: string): Promise<string> {
//   const response = await client.chat.completions.create({
//     model: "gpt-5.4-mini",
//     temperature: TEMPERATURA,
//     max_tokens: MAX_TOKENS,
//     messages: [{ role: "user", content: prompt }],
//   });
//   return response.choices[0].message.content ?? "";
// }

// ── Ollama (modelo local) ─────────────────────────────────────────────────────
// async function chamarOllama(prompt: string): Promise<string> {
//   let response: Response;
//   try {
//     response = await fetch("http://127.0.0.1:11434/api/chat", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         model: "qwen3.6:latest",
//         think: false,
//         stream: false,
//         options: {
//           temperature: TEMPERATURA,
//           num_predict: 4096,
//           num_ctx: 16384,
//         },
//         messages: [{ role: "user", content: prompt }],
//       }),
//     });
//   } catch (e) {
//     console.error("FETCH ERROR DETALHADO:", e);
//     throw e;
//   }
//   if (!response.ok) {
//     throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
//   }

//   const data = (await response.json()) as any;
//   return data.message?.content ?? "";
// }

// ── Groq (llama-3.3-70b-versatile) ───────────────────────────────────────────

async function chamarGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não definida");

  const client = new Groq({ apiKey });

  const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: TEMPERATURA,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0].message.content ?? "";
}

const MODELOS: Record<string, (p: string) => Promise<string>> = {
  // "gemini-3.5-flash": chamarGemini,
  // "claude-sonnet-4-5": chamarClaude,
  // "gpt-5.4-mini": chamarGPT4o,
  // "ollama-qwen3.6": chamarOllama,
  "groq-llama-3.3-70b": chamarGroq,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonSeguro(texto: string) {
  let t = texto.trim();
  t = t.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (t.startsWith("```")) {
    t = t.split("\n").slice(1, -1).join("\n");
  }
  const match = t.match(/\{[\s\S]*\}/);
  if (match) t = match[0];
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

async function chamarComRetry(
  fn: (p: string) => Promise<string>,
  prompt: string,
): Promise<string> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      return await fn(prompt);
    } catch (e) {
      const msg = String(e);
      const is503 =
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand");
      if (is503 && tentativa < MAX_TENTATIVAS) {
        const espera = tentativa * 15000;
        console.log(
          `\n  ⚠ Servidor sobrecarregado. Tentativa ${tentativa}/${MAX_TENTATIVAS - 1}. Aguardando ${espera / 1000}s...`,
        );
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
  repeticao: number,
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
  const resultadoParseado =
    status === "ok"
      ? parseJsonSeguro(respostaBruta)
      : { erro_parse: "api_error", resposta_bruta: respostaBruta };
  const conformidadeFormato: "ok" | "falha" =
    "atores" in resultadoParseado && "relacoes" in resultadoParseado
      ? "ok"
      : "falha";

  return {
    id_execucao: `${ecos}_${grupo}_${modelo}_R${repeticao}`,
    ecos,
    grupo,
    modelo,
    repeticao,
    timestamp: new Date().toISOString(),
    duracao_seg: duracaoSeg,
    status,
    conformidade_formato: conformidadeFormato,
    resposta_bruta: respostaBruta,
    resultado_parseado: resultadoParseado,
  };
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const grupos = ["G1", "G2", "G3", "G4"];
  const ecosLista = Object.keys(DESCRICOES);
  const modelosLista = Object.keys(MODELOS);
  const total =
    ecosLista.length * grupos.length * modelosLista.length * REPETICOES;

  const log: Array<{
    id: string;
    status: string;
    conformidade: string;
    duracao: number;
  }> = [];
  let contador = 0;
  const RPD_LIMITE = 2000; 
  let reqFeitas = 0;

  for (const ecos of ecosLista) {
    for (const grupo of grupos) {
      for (const modelo of modelosLista) {
        for (let rep = 1; rep <= REPETICOES; rep++) {
          contador++;
          const fname = path.join(
            OUTPUT_DIR,
            `${ecos}_${grupo}_${modelo}_R${rep}.json`,
          );

          if (fs.existsSync(fname)) {
            console.log(`[${contador}/${total}] ... PULADO (já existe)`);
            continue;
          }

          process.stdout.write(
            `[${contador}/${total}] ${ecos} | ${grupo} | ${modelo} | R${rep} ... `,
          );

          const resultado = await executarUnidade(ecos, grupo, modelo, rep);

          log.push({
            id: resultado.id_execucao,
            status: resultado.status,
            conformidade: resultado.conformidade_formato,
            duracao: resultado.duracao_seg,
          });

          fs.writeFileSync(fname, JSON.stringify(resultado, null, 2), "utf-8");
          console.log(
            `${resultado.status} | conformidade=${resultado.conformidade_formato} | ${resultado.duracao_seg}s`,
          );

          reqFeitas++;
          if (reqFeitas >= RPD_LIMITE) {
            console.log(
              `\n⚠ Limite diário atingido (${RPD_LIMITE} req). Rode novamente amanhã.`,
            );
            process.exit(0);
          }

          await sleep(12_200); // respeita 5 RPM
        }
      }
    }
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "_log_execucoes.json"),
    JSON.stringify(log, null, 2),
    "utf-8",
  );

  console.log(
    `\n✓ Experimento concluído. ${contador} execuções salvas em '${OUTPUT_DIR}/'`,
  );
}

main().catch(console.error);
