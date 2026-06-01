# PROMPTS DO EXPERIMENTO — TCC
# Estrutura: G1 a G4 aplicados a cada ECOS

## SCHEMA JSON ESPERADO (G1, G2 e G3)
{
  "ecos": "<nome do ecossistema>",
  "atores": [
    { "nome": "<nome>", "tipo": "<CoI|Fornecedor|Cliente|Intermediario|Agregador|ClienteDoCliente|Coordenador>" }
  ],
  "relacoes": [
    { "origem": "<nome do ator>", "destino": "<nome do ator>", "tipo_fluxo": "<P|Ser|Req|Des|Comp|Sys>" }
  ],
  "gateways": [
    { "ator": "<nome do ator intermediário>", "tipo": "<split|join>", "descricao": "<descrição>" }
  ]
}

---

## G1 — Baseline (Zero-Shot, sem contexto)

Gere um modelo SSN (Software Supply Network) para o ecossistema de software descrito abaixo.

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem backticks.
O JSON deve seguir exatamente este schema:
{
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<tipo>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<tipo>"}],
  "gateways": [{"ator": "<nome>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}

Ecossistema: {{DESCRICAO_ECOS}}

---

## G2 — Contexto Estruturado Básico

Você deve gerar um modelo SSN (Software Supply Network) para o ecossistema de software descrito abaixo.

## Definições da Notação SSN

Um modelo SSN representa as relações de fornecimento de software entre os atores de um ecossistema. Os elementos da notação são:

**Tipos de Atores:**
- CoI (Core of Interest): o software/plataforma central do ecossistema — pode haver mais de um se o sistema tiver módulos autônomos (ex: versão web e mobile)
- Fornecedor: ator que fornece produtos/tecnologias ao CoI (ex: frameworks, bibliotecas, servidores, ferramentas)
- Cliente: ator que consome serviços do CoI (ex: usuários finais, sistemas integrados)
- Intermediario: ator que distribui ou intermedia serviços entre o CoI e os clientes (ex: lojas de aplicativos)
- Coordenador: ator responsável por coordenar atividades dentro do ecossistema
- Agregador: ator que agrega serviços de múltiplos fornecedores
- ClienteDoCliente: ator que recebe serviços indiretamente, via outro cliente

**Tipos de Fluxo:**
- P (Produto): tecnologia ou componente fornecido ao CoI
- Ser (Serviço): serviço prestado pelo CoI ao cliente
- Req (Requisito): solicitação de serviço
- Des (Desenvolvimento): atividade de desenvolvimento
- Comp (Compensação): pagamento ou contrapartida
- Sys (Sistema): integração entre sistemas

**Regras Semânticas:**
- Fornecedores sempre apontam para o CoI (sentido → CoI)
- O CoI aponta para Clientes e Intermediarios (sentido CoI →)
- Intermediários redistribuem fluxos de saída do CoI para Clientes
- Cada relação deve ter um tipo de fluxo declarado

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem backticks.
O JSON deve seguir exatamente este schema:
{
  "ecos": "<nome>",
  "atores": [{"nome": "<nome>", "tipo": "<tipo>"}],
  "relacoes": [{"origem": "<nome>", "destino": "<nome>", "tipo_fluxo": "<tipo>"}],
  "gateways": [{"ator": "<nome>", "tipo": "<split|join>", "descricao": "<descricao>"}]
}

Ecossistema: {{DESCRICAO_ECOS}}

---

## G3 — Prompt Engineering Avançado (Persona + Template + Few-Shot)

Você é um especialista em modelagem de Ecossistemas de Software (ECOS) com domínio avançado na notação SSN (Software Supply Network). Sua tarefa é gerar um modelo SSN estruturalmente preciso para o ecossistema descrito.

## Definições da Notação SSN

**Tipos de Atores:**
- CoI (Core of Interest): o software/plataforma central — pode haver múltiplos se o sistema tiver módulos autônomos
- Fornecedor: fornece produtos (tecnologias, componentes) ao CoI
- Cliente: consome serviços do CoI
- Intermediario: distribui serviços entre o CoI e Clientes (ex: Play Store)
- Coordenador: coordena atividades do ecossistema
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
1. Todo Fornecedor DEVE ter pelo menos uma relação apontando para o CoI com tipo P
2. O CoI DEVE ter relações de saída (tipo Ser) para Clientes e/ou Intermediarios
3. Intermediarios recebem do CoI e repassam para Clientes
4. Não modele relações diretas de Fornecedores para Clientes
5. Se houver módulos (web, mobile, MOOC), cada um é um CoI separado

## Exemplo Completo (ECOS SkinnerBox)

Descrição: SkinnerBox é um simulador educacional utilizado no curso de Psicologia da UFC para simular experimentos de condicionamento operante. Usa Unity, Maya 3D e Adobe como ferramentas de desenvolvimento. O Depto. de Psicologia fornece requisitos. Os arquivos são distribuídos via Google Drive para Professores e Alunos.

Saída esperada:
{
  "ecos": "SkinnerBox",
  "atores": [
    {"nome": "SkinnerBox", "tipo": "CoI"},
    {"nome": "Unity", "tipo": "Fornecedor"},
    {"nome": "Maya 3D", "tipo": "Fornecedor"},
    {"nome": "Adobe", "tipo": "Fornecedor"},
    {"nome": "Depto. de Psicologia", "tipo": "Fornecedor"},
    {"nome": "Google Drive", "tipo": "Intermediario"},
    {"nome": "Professores", "tipo": "Cliente"},
    {"nome": "Alunos", "tipo": "Cliente"}
  ],
  "relacoes": [
    {"origem": "Unity", "destino": "SkinnerBox", "tipo_fluxo": "P"},
    {"origem": "Maya 3D", "destino": "SkinnerBox", "tipo_fluxo": "P"},
    {"origem": "Adobe", "destino": "SkinnerBox", "tipo_fluxo": "P"},
    {"origem": "Depto. de Psicologia", "destino": "SkinnerBox", "tipo_fluxo": "P"},
    {"origem": "SkinnerBox", "destino": "Google Drive", "tipo_fluxo": "P"},
    {"origem": "Google Drive", "destino": "Professores", "tipo_fluxo": "Ser"},
    {"origem": "Google Drive", "destino": "Alunos", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "Google Drive", "tipo": "split", "descricao": "Distribui serviço para Professores e Alunos"}
  ]
}

## Sua Tarefa

Retorne SOMENTE um objeto JSON válido, sem texto adicional, sem markdown, sem backticks.

Ecossistema: {{DESCRICAO_ECOS}}

---

## G4 — Chain-of-Thought (Raciocínio em Cadeia)

Você é um especialista em modelagem de Ecossistemas de Software (ECOS) com domínio avançado na notação SSN. Antes de gerar o modelo final, raciocine passo a passo conforme as etapas abaixo. 

## Definições e Regras SSN

**Tipos de Atores:** CoI, Fornecedor, Cliente, Intermediario, Coordenador, Agregador, ClienteDoCliente
**Tipos de Fluxo:** P, Ser, Req, Des, Comp, Sys

**Regras Semânticas Obrigatórias:**
1. Todo Fornecedor DEVE ter pelo menos uma relação apontando para o CoI com tipo P
2. O CoI DEVE ter relações de saída (tipo Ser) para Clientes e/ou Intermediarios
3. Intermediarios recebem do CoI e repassam para Clientes
4. Não modele relações diretas de Fornecedores para Clientes
5. Se houver módulos (web, mobile, MOOC), cada um é um CoI separado

## Protocolo de Raciocínio (escreva detalhadamente no campo "raciocinio_cot" do JSON)

Etapa 1 — Identificar o(s) CoI:
  Qual é o software central? Há módulos autônomos (web/mobile/MOOC)? Se sim, cada módulo é um CoI separado.

Etapa 2 — Mapear Fornecedores:
  Quais tecnologias, frameworks, bibliotecas, servidores ou sistemas externos são usados PELO CoI para funcionar?
  Cada um vira um Fornecedor com relação tipo P apontando para o CoI.

Etapa 3 — Mapear Clientes:
  Quem CONSOME serviços do CoI? (usuários, sistemas integrados, outros softwares que dependem do CoI)
  Cada um vira um Cliente com relação tipo Ser saindo do CoI.

Etapa 4 — Identificar Intermediarios:
  Existe algum ator que distribui ou intermedia o serviço do CoI antes de chegar ao cliente final?
  (ex: lojas de apps, portais, coordenadores técnicos)
  Se sim, modele como Intermediario com gateway split/join.

Etapa 5 — Verificar Gateways:
  Existe algum Intermediario que distribui para múltiplos clientes? → gateway split
  Existe algum ponto onde múltiplos fluxos se convergem? → gateway join

Etapa 6 — Validar Completude:
  Todo Fornecedor tem relação → CoI?
  Todo Cliente recebe relação de CoI ou Intermediario?
  Algum ator ficou desconectado?

## Exemplo Completo (ECOS SkinnerBox)

Descrição: SkinnerBox é um simulador educacional utilizado no curso de Psicologia da UFC para simular experimentos de condicionamento operante. Usa Unity, Maya 3D e Adobe como ferramentas de desenvolvimento. O Depto. de Psicologia fornece requisitos. Os arquivos são distribuídos via Google Drive para Professores e Alunos.

Saída esperada:
{
  "raciocinio_cot": "Passo 1: O CoI é o SkinnerBox. Passo 2: Os fornecedores da tecnologia são Unity, Maya 3D e Adobe, e os requisitos vêm do Depto. de Psicologia. Todos apontam para o CoI. Passo 3: Os clientes finais são os Professores e Alunos. Passo 4: O Google Drive atua como intermediário para distribuir os arquivos. Passo 5: O Google Drive precisa de um gateway split para dividir o fluxo entre Professores e Alunos. Passo 6: Todos os atores estão devidamente conectados seguindo as regras SSN.",
  "ecos": "SkinnerBox",
  "atores": [
    {"nome": "SkinnerBox", "tipo": "CoI"},
    {"nome": "Unity", "tipo": "Fornecedor"},
    {"nome": "Maya 3D", "tipo": "Fornecedor"},
    {"nome": "Adobe", "tipo": "Fornecedor"},
    {"nome": "Depto. de Psicologia", "tipo": "Fornecedor"},
    {"nome": "Google Drive", "tipo": "Intermediario"},
    {"nome": "Professores", "tipo": "Cliente"},
    {"nome": "Alunos", "tipo": "Cliente"}
  ],
  "relacoes": [
    {"origem": "Unity", "destino": "SkinnerBox", "tipo_fluxo": "P"},
    {"origem": "Maya 3D", "destino": "SkinnerBox", "tipo_fluxo": "P"},
    {"origem": "Adobe", "destino": "SkinnerBox", "tipo_fluxo": "P"},
    {"origem": "Depto. de Psicologia", "destino": "SkinnerBox", "tipo_fluxo": "P"},
    {"origem": "SkinnerBox", "destino": "Google Drive", "tipo_fluxo": "P"},
    {"origem": "Google Drive", "destino": "Professores", "tipo_fluxo": "Ser"},
    {"origem": "Google Drive", "destino": "Alunos", "tipo_fluxo": "Ser"}
  ],
  "gateways": [
    {"ator": "Google Drive", "tipo": "split", "descricao": "Distribui serviço para Professores e Alunos"}
  ]
}

## Sua Tarefa

Ecossistema: {{DESCRICAO_ECOS}}

Execute o protocolo de raciocínio e retorne SOMENTE o JSON final, sem texto adicional, sem markdown, sem backticks. Certifique-se de preencher a chave "raciocinio_cot" antes de montar os arrays.