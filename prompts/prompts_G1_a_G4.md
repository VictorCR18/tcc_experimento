# PROMPTS DO EXPERIMENTO — TCC
# Estrutura: G1 a G4 aplicados a cada ECOS

## SCHEMA JSON ESPERADO (G1, G2 e G3)
{
  "ecos": "<nome>",
  "atores": [
    { "nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>" }
  ],
  "relacoes": [
    { "origem": "<nome do ator>", "destino": "<nome do ator>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>" }
  ],
  "gateways": [
    { "ator": "<nome do ator que possui o gateway>", "tipo": "<split|join>", "descricao": "<descrição>" }
  ]
}
Importante: se não houver gateways, use "gateways": [].

---

## G1 — Baseline (Zero-Shot, sem contexto)

Gere um modelo SSN (Software Supply Network) para o ecossistema de software descrito abaixo.

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem backticks.
Se não houver gateways, use "gateways": [].
O JSON deve seguir exatamente este schema:
{
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome do ator que possui o gateway>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}
Importante: se não houver gateways, use "gateways": [].

Ecossistema: {{DESCRICAO_ECOS}}

---

## G2 — Contexto Estruturado Básico

Você deve gerar um modelo SSN (Software Supply Network) para o ecossistema de software descrito abaixo.

## Definições da Notação SSN

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
6. Agregadores ficam entre o CoI e os Intermediarios; o CoI aponta para o Agregador (Sys), e o Agregador aponta para os Intermediarios (Sys)

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem backticks.
Se não houver gateways, use "gateways": [].
O JSON deve seguir exatamente este schema:
{
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome do ator que possui o gateway>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}
Importante: se não houver gateways, use "gateways": [].

Ecossistema: {{DESCRICAO_ECOS}}

---

## G3 — Prompt Engineering Avançado (Persona + Template + Few-Shot)

Você é um especialista em modelagem de Ecossistemas de Software (ECOS) com domínio avançado na notação SSN (Software Supply Network). Sua tarefa é gerar um modelo SSN estruturalmente preciso para o ecossistema descrito.

## Definições da Notação SSN

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
6. Agregadores ficam entre o CoI e os Intermediarios; o CoI aponta para o Agregador (Sys), e o Agregador aponta para os Intermediarios (Sys)

## Exemplos Completos

## Exemplo 1 (Pandas)
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
}

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem backticks.
Se não houver gateways, use "gateways": [].
O JSON deve seguir exatamente este schema:
{
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome do ator que possui o gateway>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}
Importante: se não houver gateways, use "gateways": [].

Ecossistema: {{DESCRICAO_ECOS}}

---

## G4 — Chain-of-Thought (Raciocínio em Cadeia)

Você é um especialista em modelagem de Ecossistemas de Software (ECOS) com domínio avançado na notação SSN. Antes de gerar o modelo final, raciocine passo a passo conforme as etapas abaixo.

## Definições da Notação SSN

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
6. Agregadores ficam entre o CoI e os Intermediarios; o CoI aponta para o Agregador (Sys), e o Agregador aponta para os Intermediarios (Sys)

## Protocolo de Raciocínio (escreva detalhadamente no campo "raciocinio_cot" do JSON)

Etapa 1 — Identificar o(s) CoI: Qual é o software central? Se houver múltiplos módulos autônomos, cada um é um CoI.
Etapa 2 — Mapear Fornecedores: Quais tecnologias/componentes apontam com P para o CoI?
Etapa 3 — Mapear Clientes e ClienteDoCliente: Quem consome direta e indiretamente?
Etapa 4 — Identificar Agregadores e Intermediarios: O CoI aponta (Sys) para o Agregador; o Agregador aponta (Sys) para os Intermediarios. Nunca modele relação direta CoI→Intermediario se houver Agregador no caminho.
Etapa 5 — Verificar Gateways: Há splits (XOU: exatamente um destino) ou OU Gateways (um ou mais destinos simultâneos)? Se não houver, use gateways: [].
Etapa 6 — Validar Completude: Todos conectados segundo as regras?

## Exemplos Completos

## Exemplo 1 (Pandas)
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
}

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem backticks. Certifique-se de preencher a chave "raciocinio_cot" antes de montar os arrays.
Se não houver gateways, use "gateways": [].
O JSON deve seguir exatamente este schema:
{
  "raciocinio_cot": "<Seu raciocínio passo a passo aqui>",
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>"}],
  "gateways": [{"ator": "<nome do ator que possui o gateway>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}
Importante: se não houver gateways, use "gateways": [].

Ecossistema: {{DESCRICAO_ECOS}}