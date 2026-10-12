import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Groq from "groq-sdk";

import * as dotenv from "dotenv";
dotenv.config();

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
  direcao: "split" | "join";
  logica: "OU" | "XOU";
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

const TEMPERATURA = 0.0;
const MAX_TOKENS = 16384;
const REPETICOES = 3;
const OUTPUT_DIR = "execucoes";

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

const SCHEMA_BASE = `{
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome de um ator já listado em 'atores'>", "direcao": "<split|join>", "logica": "<OU|XOU>", "descricao": "<descricao>"}]
}
Importante:
- Se não houver gateways, use "gateways": [].
- O campo "ator" de um gateway DEVE ser o nome de um ator já presente em "atores". Nunca invente um ator do tipo "Gateway X" apenas para representar o ponto de convergência/divergência — o split ou join é uma propriedade de um ator que já existe no modelo.
- "direcao": "split" = o ator distribui para múltiplos destinos; "join" = o ator recebe de múltiplas origens e consolida em um destino.
- "logica": "XOU" = exatamente um relacionamento ocorre por vez (exclusivo); "OU" = um, vários ou todos os relacionamentos podem ocorrer simultaneamente (inclusivo).`;

const SCHEMA_G4 = `{
  "raciocinio_cot": "<Seu raciocínio passo a passo aqui>",
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome de um ator já listado em 'atores'>", "direcao": "<split|join>", "logica": "<OU|XOU>", "descricao": "<descricao>"}]
}
Importante:
- Se não houver gateways, use "gateways": [].
- O campo "ator" de um gateway DEVE ser o nome de um ator já presente em "atores". Nunca invente um ator do tipo "Gateway X" apenas para representar o ponto de convergência/divergência — o split ou join é uma propriedade de um ator que já existe no modelo.
- "direcao": "split" = o ator distribui para múltiplos destinos; "join" = o ator recebe de múltiplas origens e consolida em um destino.
- "logica": "XOU" = exatamente um relacionamento ocorre por vez (exclusivo); "OU" = um, vários ou todos os relacionamentos podem ocorrer simultaneamente (inclusivo).`;

const DEFINICOES_SSN = `## Definições da Notação SSN

Baseado em Boucharas, Jansen e Brinkkemper (2009), com a extensão do ator
Agregador proposta por Costa et al. (2013).
 
**Tipos de Atores:**
- CoI (Company of Interest / Companhia de Interesse): software/plataforma central sob avaliação — pode haver múltiplos módulos autônomos, cada um modelado como um CoI separado
- Fornecedor: fornece produtos e/ou serviços ao CoI
- Cliente: consome, direta ou indiretamente, o produto/serviço do CoI
- Intermediario: revendedor, distribuidor ou canal que atua entre o CoI (ou um Agregador) e os Clientes
- ClienteDoCliente: recebe produto/serviço indiretamente, através de outro Cliente
- Agregador: consolida fluxos vindos do CoI (ou de múltiplos módulos/CoIs) antes de repassá-los aos Intermediarios — extensão de Costa et al. (2013), não presente no artigo original de 2009
 
**Tipos de Fluxo (convenção deste projeto):**
Boucharas et al. (2009) definem Fluxo de forma genérica — produto, serviço,
financeiro ou de conteúdo, no formato X.Y. Para tornar os modelos comparáveis
entre diferentes ECOS, usamos os seguintes códigos fixos:
- P: produto (tecnologia/componente fornecido ao CoI). Por convenção, mesmo quando o fornecimento tem caráter de serviço, use P nas relações Fornecedor→CoI.
- Ser: serviço prestado pelo CoI, Agregador ou Intermediario aos Clientes
- Req: requisito/solicitação feita ao CoI
- Des: atividade de desenvolvimento realizada sobre o CoI
- Comp: compensação financeira entre atores
- Sys: integração sistêmica entre plataformas, módulos, CoIs ou Agregadores
 
**Gateways:**
Boucharas et al. (2009) definem dois tipos de gateway, ortogonais à direção do fluxo:
- OU Gateway: permite que um, vários ou todos os relacionamentos de entrada/saída ocorram simultaneamente (lógica inclusiva)
- XOU Gateway: permite exatamente um relacionamento de entrada/saída por vez (lógica exclusiva)
 
No JSON, represente cada gateway com dois campos independentes:
- "direcao": "split" (o ator distribui para múltiplos destinos) ou "join" (o ator recebe de múltiplas origens e consolida em um destino)
- "logica": "OU" ou "XOU", conforme as definições acima
 
O gateway é sempre associado a um ator que já existe em "atores" — nunca crie
um ator fictício do tipo "Gateway X" só para representar o ponto de
convergência ou divergência; represente-o apenas pelas relações de
entrada/saída do próprio ator, mais o registro em "gateways".
 
Se não houver gateway, omita o ator da lista (use "gateways": []).
 
**Regras Semânticas Obrigatórias:**
1. Todo Fornecedor DEVE ter relação apontando para o CoI com tipo_fluxo P (convenção deste projeto — ver acima)
2. O CoI DEVE ter relações de saída (tipo Ser ou Sys)
3. Intermediarios recebem do CoI (ou Agregador) e repassam para Clientes — nunca recebem diretamente do CoI se houver um Agregador no caminho
4. Não modele relações diretas de Fornecedores para Clientes
5. Se houver módulos (web, mobile, MOOC), cada um é um CoI separado
6. Agregadores ficam entre o CoI e os Intermediarios; o CoI aponta para o Agregador (Sys), e o Agregador aponta para os Intermediarios (Sys)
7. Todo "ator" referenciado em "gateways" DEVE existir em "atores"`;

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
    {"ator": "Plataformas e IDEs", "direcao": "split", "logica": "OU", "descricao": "Distribui o pacote Pandas simultaneamente para múltiplos tipos de clientes"}
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
    {"ator": "Github", "direcao": "split", "logica": "OU", "descricao": "Distribui simultaneamente para VSCode (Plataforma) e Copilot"},
    {"ator": "VSCode (Plataforma)", "direcao": "split", "logica": "OU", "descricao": "Distribui ambiente de desenvolvimento simultaneamente para múltiplos tipos de clientes"},
    {"ator": "Copilot", "direcao": "split", "logica": "OU", "descricao": "Distribui assistência de IA simultaneamente para múltiplos tipos de clientes"}
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
    {"ator": "Integradores de API", "direcao": "split", "logica": "OU", "descricao": "Distribui integrações simultaneamente para múltiplos tipos de clientes"}
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
    {"origem": "PRODUTORAS DE MÍDIAS", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "P"},
    {"origem": "BANCO DE DADOS", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "P"},
    {"origem": "SERVIDORES", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "P"},
    {"origem": "NETFLIX (EMPRESA)", "destino": "INTERNET", "tipo_fluxo": "Sys"},
    {"origem": "INTERNET", "destino": "NETFLIX (PC)", "tipo_fluxo": "Sys"},
    {"origem": "INTERNET", "destino": "NETFLIX (MOBILE)", "tipo_fluxo": "Sys"},
    {"origem": "NETFLIX (PC)", "destino": "NAVEGADORES DE INTERNET", "tipo_fluxo": "Sys"},
    {"origem": "NETFLIX (MOBILE)", "destino": "APP STORE", "tipo_fluxo": "Sys"},
    {"origem": "NETFLIX (MOBILE)", "destino": "PLAY STORE", "tipo_fluxo": "Sys"},
    {"origem": "NAVEGADORES DE INTERNET", "destino": "USUÁRIOS", "tipo_fluxo": "Ser"},
    {"origem": "APP STORE", "destino": "USUÁRIOS", "tipo_fluxo": "Ser"},
    {"origem": "PLAY STORE", "destino": "USUÁRIOS", "tipo_fluxo": "Ser"},
    {"origem": "VENDEDOR DE PC", "destino": "USUÁRIOS", "tipo_fluxo": "P"},
    {"origem": "VENDEDOR DE SMARTPHONES", "destino": "USUÁRIOS", "tipo_fluxo": "P"}
  ],
  "gateways": [
    {"ator": "INTERNET", "direcao": "split", "logica": "OU", "descricao": "Distribui o sinal da Netflix (Empresa) simultaneamente para as plataformas PC e Mobile"},
    {"ator": "NETFLIX (MOBILE)", "direcao": "split", "logica": "OU", "descricao": "Distribui o acesso mobile simultaneamente para App Store e Play Store"},
    {"ator": "USUÁRIOS", "direcao": "join", "logica": "OU", "descricao": "Consolida o serviço de streaming recebido por Navegador, App Store ou Play Store, podendo vir de um ou mais canais simultaneamente"}
  ]
}`;

const EXEMPLOS_G4 = `## Exemplo 1 (Pandas)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é Pandas. Passo 2: Fornecedores (Contribuidores, Mantenedores, Statsmodels, Distribuidores, Xorbits, Featuretools) apontam com P para Pandas (convenção do projeto). Passo 3: Clientes são Softwares/Frameworks, Cientistas, Usuário/Dev. 'Clientes' recebe de Softwares/Frameworks, portanto é ClienteDoCliente. Passo 4: Comunidade open-source atua como Agregador (extensão de Costa et al. 2013) — recebe Sys do CoI e repassa Sys ao Intermediario. Plataformas e IDEs é Intermediario (recebe Sys do Agregador e distribui Ser para Clientes). Passo 5: Plataformas e IDEs serve múltiplos Clientes simultaneamente — gateway split/OU nesse próprio ator, sem criar nó fictício. Passo 6: Todos os atores referenciados em gateways existem em atores; regras semânticas satisfeitas.",
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
    {"ator": "Plataformas e IDEs", "direcao": "split", "logica": "OU", "descricao": "Distribui o pacote Pandas simultaneamente para múltiplos tipos de clientes"}
  ]
}
 
## Exemplo 2 (VSCode)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é VSCode. Passo 2: Fornecedores (GitHub Copilot, OpenAI, IDEs, Microsoft, Devs de Extensões) fornecem P ao CoI (convenção do projeto). Passo 3: Clientes são Estudantes, Desenvolvedor e Equipe de Devs. Revisores recebem serviço de Desenvolvedor, sendo ClienteDoCliente. Passo 4: Github é o Agregador (extensão de Costa et al. 2013) — recebe Sys do CoI e distribui Sys para ambos os Intermediarios: VSCode (Plataforma) e Copilot. Nenhuma relação direta do CoI para os Intermediarios — tudo passa pelo Agregador. Passo 5: Github distribui para dois Intermediarios simultaneamente — gateway split/OU em Github. VSCode (Plataforma) e Copilot servem múltiplos Clientes simultaneamente — split/OU em cada um. Passo 6: Todos os atores referenciados em gateways existem em atores; regras semânticas satisfeitas.",
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
    {"ator": "Github", "direcao": "split", "logica": "OU", "descricao": "Distribui simultaneamente para VSCode (Plataforma) e Copilot"},
    {"ator": "VSCode (Plataforma)", "direcao": "split", "logica": "OU", "descricao": "Distribui ambiente de desenvolvimento simultaneamente para múltiplos tipos de clientes"},
    {"ator": "Copilot", "direcao": "split", "logica": "OU", "descricao": "Distribui assistência de IA simultaneamente para múltiplos tipos de clientes"}
  ]
}
 
## Exemplo 3 (LangChain)
Saída:
{
  "raciocinio_cot": "Passo 1: CoI é LangChain. Passo 2: Fornecedores (APIs LLMs, OpenAI, Anthropic, IDEs, Google, Infraestrutura Cloud, Comunidade/Fórum) fornecem P ao CoI (convenção do projeto). Passo 3: Clientes são Startups, Desenvolvedor e Empresas de Automação. Usuários finais recebem serviço dos Clientes, sendo ClienteDoCliente. Passo 4: APIs/LLMs é o Agregador (extensão de Costa et al. 2013) — recebe Sys do CoI e repassa Sys ao Intermediario. Passo 5: Integradores de API serve múltiplos Clientes simultaneamente — gateway split/OU nesse ator. Passo 6: Todos os atores referenciados em gateways existem em atores; regras semânticas satisfeitas.",
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
    {"ator": "Integradores de API", "direcao": "split", "logica": "OU", "descricao": "Distribui integrações simultaneamente para múltiplos tipos de clientes"}
  ]
}
 
## Exemplo 4 (Netflix)
Saída:
{
  "raciocinio_cot": "Passo 1: A CoI (Azul) é representada em três blocos autônomos: NETFLIX (EMPRESA), NETFLIX (PC) e NETFLIX (MOBILE). Passo 2: Fornecedores (Laranja) PRODUTORAS DE MÍDIAS, BANCO DE DADOS e SERVIDORES fornecem à NETFLIX (EMPRESA) com tipo_fluxo P (convenção do projeto); VENDEDOR DE PC e VENDEDOR DE SMARTPHONES fornecem diretamente ao Cliente, também com P. Passo 3: O Cliente (Amarelo) é USUÁRIOS. Passo 4: Os Intermediários (Verde) são INTERNET, NAVEGADORES DE INTERNET, APP STORE e PLAY STORE; os fluxos entre CoIs e Intermediários são Sys, e o fluxo final ao Cliente é Ser. Passo 5: INTERNET distribui simultaneamente para NETFLIX (PC) e NETFLIX (MOBILE) — gateway split/OU em INTERNET; NETFLIX (MOBILE) distribui simultaneamente para APP STORE e PLAY STORE — gateway split/OU em NETFLIX (MOBILE). Passo 6: USUÁRIOS recebe de três canais que podem ocorrer simultaneamente (NAVEGADORES DE INTERNET, APP STORE, PLAY STORE) — gateway join/OU em USUÁRIOS, sem criar atores fictícios do tipo 'Gateway OR': o join é representado apenas pelas três relações de entrada mais o registro em gateways. Passo 7: Todos os atores referenciados em gateways existem em atores; regras semânticas satisfeitas.",
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
    {"origem": "PRODUTORAS DE MÍDIAS", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "P"},
    {"origem": "BANCO DE DADOS", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "P"},
    {"origem": "SERVIDORES", "destino": "NETFLIX (EMPRESA)", "tipo_fluxo": "P"},
    {"origem": "NETFLIX (EMPRESA)", "destino": "INTERNET", "tipo_fluxo": "Sys"},
    {"origem": "INTERNET", "destino": "NETFLIX (PC)", "tipo_fluxo": "Sys"},
    {"origem": "INTERNET", "destino": "NETFLIX (MOBILE)", "tipo_fluxo": "Sys"},
    {"origem": "NETFLIX (PC)", "destino": "NAVEGADORES DE INTERNET", "tipo_fluxo": "Sys"},
    {"origem": "NETFLIX (MOBILE)", "destino": "APP STORE", "tipo_fluxo": "Sys"},
    {"origem": "NETFLIX (MOBILE)", "destino": "PLAY STORE", "tipo_fluxo": "Sys"},
    {"origem": "NAVEGADORES DE INTERNET", "destino": "USUÁRIOS", "tipo_fluxo": "Ser"},
    {"origem": "APP STORE", "destino": "USUÁRIOS", "tipo_fluxo": "Ser"},
    {"origem": "PLAY STORE", "destino": "USUÁRIOS", "tipo_fluxo": "Ser"},
    {"origem": "VENDEDOR DE PC", "destino": "USUÁRIOS", "tipo_fluxo": "P"},
    {"origem": "VENDEDOR DE SMARTPHONES", "destino": "USUÁRIOS", "tipo_fluxo": "P"}
  ],
  "gateways": [
    {"ator": "INTERNET", "direcao": "split", "logica": "OU", "descricao": "Distribui o sinal da Netflix (Empresa) simultaneamente para as plataformas PC e Mobile"},
    {"ator": "NETFLIX (MOBILE)", "direcao": "split", "logica": "OU", "descricao": "Distribui o acesso mobile simultaneamente para App Store e Play Store"},
    {"ator": "USUÁRIOS", "direcao": "join", "logica": "OU", "descricao": "Consolida o serviço de streaming recebido por Navegador, App Store ou Play Store, podendo vir de um ou mais canais simultaneamente"}
  ]
}`;

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

async function chamarGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não definida");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
    contents: prompt,
    config: {
      temperature: TEMPERATURA,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return response.text ?? "";
}

async function chamarGroqModelo(
  prompt: string,
  model: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY não definida");

  const client = new Groq({ apiKey });
  const isQwenReasoning = model.startsWith("qwen/");
  const isGptOssReasoning = model.startsWith("openai/gpt-oss");

  const response = await client.chat.completions.create({
    model,
    temperature: TEMPERATURA,
    max_completion_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
    ...(isQwenReasoning ? { reasoning_effort: "none" } : {}),
    ...(isGptOssReasoning ? { reasoning_effort: "low" } : {}),
  });

  return response.choices[0].message.content ?? "";
}

type ModoRaciocinio =
  | {
      tipo: "chat_template_kwargs";
      chave: "enable_thinking" | "thinking";
      valor: boolean;
    }
  | { tipo: "reasoning_effort"; valor: "low" | "high" | "max" }
  | { tipo: "nenhum" };

async function chamarNvidiaModelo(
  prompt: string,
  model: string,
  modoRaciocinio: ModoRaciocinio = { tipo: "nenhum" },
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY não definida");

  const client = new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const extra: Record<string, unknown> = {};
  if (modoRaciocinio.tipo === "chat_template_kwargs") {
    extra.chat_template_kwargs = {
      [modoRaciocinio.chave]: modoRaciocinio.valor,
    };
  } else if (modoRaciocinio.tipo === "reasoning_effort") {
    extra.reasoning_effort = modoRaciocinio.valor;
  }

  const stream = (await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: TEMPERATURA,
    top_p: 0.95,
    max_tokens: MAX_TOKENS,
    stream: true,
    ...extra,
  } as any)) as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

  let content = "";
  for await (const chunk of stream) {
    content += chunk.choices[0]?.delta?.content ?? "";
  }

  return content;
}

async function chamarNvidiaNemotron(prompt: string): Promise<string> {
  return chamarNvidiaModelo(prompt, "nvidia/nemotron-3-ultra-550b-a55b", {
    tipo: "chat_template_kwargs",
    chave: "enable_thinking",
    valor: false,
  });
}

async function chamarNvidiaKimi(prompt: string): Promise<string> {
  return chamarNvidiaModelo(prompt, "moonshotai/kimi-k3", {
    tipo: "reasoning_effort",
    valor: "low",
  });
}

async function chamarDeepseekNvidia(prompt: string): Promise<string> {
  return chamarNvidiaModelo(prompt, "deepseek-ai/deepseek-v4-pro-0813", {
    tipo: "chat_template_kwargs",
    chave: "thinking",
    valor: false,
  });
}

async function chamarGroqGptOss120b(prompt: string): Promise<string> {
  return chamarGroqModelo(prompt, "openai/gpt-oss-120b");
}

async function chamarGroqQwen36(prompt: string): Promise<string> {
  return chamarGroqModelo(prompt, "qwen/qwen3.6-27b");
}

const MODELOS: Record<string, (p: string) => Promise<string>> = {
  "gemini-3.5-flash": chamarGemini,
  "nvidia-kimi-k3": chamarNvidiaKimi,
  "nvidia-deepseek-v4-pro-0813": chamarDeepseekNvidia,
  "nvidia-nemotron-3-ultra-550b-a55b": chamarNvidiaNemotron,
  "groq-gpt-oss-120b": chamarGroqGptOss120b,
  "groq-qwen-3.6-27b": chamarGroqQwen36,
};
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
      const isTpmLimit =
        msg.includes("429") ||
        msg.includes("413") ||
        msg.includes("rate_limit_exceeded") ||
        msg.includes("tokens per minute");

      if ((is503 || isTpmLimit) && tentativa < MAX_TENTATIVAS) {
        const espera = isTpmLimit ? 65_000 : tentativa * 15_000;
        console.log(
          `\n  ⚠ ${isTpmLimit ? "Limite de TPM" : "Servidor sobrecarregado"}. Tentativa ${tentativa}/${MAX_TENTATIVAS - 1}. Aguardando ${espera / 1000}s...`,
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
    console.error(`\n  Erro em ${modelo}: ${String(e)}`);
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
            try {
              const existente = JSON.parse(
                fs.readFileSync(fname, "utf-8"),
              ) as Execucao;
              if (existente.status === "ok") {
                console.log(
                  `[${contador}/${total}] ... PULADO (já existe e ok)`,
                );
                continue;
              }
              console.log(
                `[${contador}/${total}] ... reexecutando (status anterior: ${existente.status})`,
              );
            } catch {
              console.log(
                `[${contador}/${total}] ... arquivo corrompido, reexecutando`,
              );
            }
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

          await sleep(12_200);
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