# tcc_experimento — Victor Cavalcante

## Avaliação de Técnicas de Contextualização para Geração de Modelos SSN com LLMs

Experimento do Trabalho de Conclusão de Curso que investiga o impacto de diferentes níveis de contextualização em prompts na capacidade de LLMs gerarem modelos de Software Social Network (SSN) a partir de descrições de ecossistemas de software (ECOS).

---

## Estrutura do projeto

```
tcc_experimento/
├── modelos_referencia/
│   ├── skinnerbox_referencia.json   ← modelo SSN de referência (SkinnerBox)
│   ├── sippa_referencia.json        ← modelo SSN de referência (SIPPA v1 web)
│   └── solar_referencia.json        ← modelo SSN de referência (SOLAR)
├── prompts/
│   └── prompts_G1_a_G4.md          ← texto completo dos 4 grupos de prompt
├── scripts/
│   ├── executor_experimento.ts      ← executa as chamadas às APIs
│   ├── calcular_metricas.ts         ← calcula PA, RA, F1-A, PR, TA
│   ├── converter_todos.ts           ← converte saídas JSON para XML
│   ├── json2xml.ts                  ← utilitário de conversão JSON → XML
│   └── resultados_metricas/
│       ├── metricas_individuais.json
│       └── metricas_medias_por_grupo.json
├── execucoes/                       ← saídas JSON brutas das execuções
├── xmls/                            ← saídas XML geradas pelo conversor
├── package.json
├── tsconfig.json
└── README.md
```

---

## Modelos LLM utilizados

| ID no experimento | Modelo | Provedor |
|---|---|---|
| `gemini-3.5-flash` | Gemini 3.5 Flash | Google AI (API) |
| `nvidia-kimi-k3` | Kimi K3 | NVIDIA NIM (API) |
| `nvidia-deepseek-v4-pro-0813` | DeepSeek V4 Pro 0813 | NVIDIA NIM (API) |
| `nvidia-nemotron-3-ultra-550b-a55b` | Nemotron 3 Ultra 550B A55B | NVIDIA NIM (API) |
| `groq-gpt-oss-120b` | GPT-OSS 120B | Groq (API) |
| `groq-qwen-3.6-27b` | Qwen 3.6 27B | Groq (API) |

---

## Variáveis do experimento

| Variável | Valor |
|---|---|
| ECOSs avaliados | SkinnerBox, SIPPA, SOLAR |
| Grupos de prompt | G1 (baseline), G2, G3, G4 |
| Repetições por unidade | 3 |
| Total de execuções por modelo | 36 |
| **Total geral** | **216** |
| Temperatura | 0.0 (determinístico) |
| Métrica principal | F1-A (média harmônica entre PA e RA) |
| Teste estatístico | Kruskal-Wallis (entre grupos G1–G4) |

---

## Métricas calculadas

| Métrica | Significado |
|---|---|
| PA | Precisão de Atores: dos atores gerados, quantos estão corretos? |
| RA | Recall de Atores: dos atores de referência, quantos foram encontrados? |
| F1-A | Média harmônica entre PA e RA |
| PR | Precisão de Relações: das relações geradas, quantas são corretas? |
| TA | Taxa de Alucinação: proporção de elementos gerados (atores + relações) que não correspondem à referência |

Os gateways são registrados para diagnóstico, mas não entram nas métricas quantitativas
PA, RA, F1-A, PR e TA. O cálculo também separa divergências de tipo de ator e de
tipo de fluxo das alucinações ou ausências puras.

---

## Passo a passo para reprodução

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar as chaves de API

Crie um arquivo `.env` na raiz do projeto:

```env
GEMINI_API_KEY=sua_chave_gemini
GROQ_API_KEY=sua_chave_groq
NVIDIA_API_KEY=sua_chave_nvidia
```

Os modelos NVIDIA são acessados pelo endpoint NVIDIA NIM. O Qwen usado pelo
experimento é o `qwen/qwen3.6-27b` via Groq; não é necessário instalar Ollama.

### 3. Executar o piloto (recomendado antes do experimento completo)

```bash
npm run piloto
```

O script atualmente não implementa um subconjunto específico para o piloto: o
argumento `--piloto` é aceito pelo comando npm, mas o executor percorre todos os
ECOSs, grupos, modelos e repetições. Para um piloto real, limite temporariamente
as listas no executor ou use arquivos de execução já existentes.

### 4. Executar o experimento completo

```bash
npm run executar
```

Tempo estimado: aproximadamente 44 minutos ou mais (216 chamadas, com intervalo
de 12,2 segundos entre elas, além de retries de API).

### 5. Converter saídas JSON para XML

```bash
npx ts-node scripts/converter_todos.ts
```

Por padrão, o script lê `execucoes/`, grava em `xmls/` e converte apenas arquivos
cujo nome contém `gemini-3.5-flash`. Para converter todos os modelos, use:

```bash
npx ts-node scripts/converter_todos.ts execucoes xmls ""
```

Também é possível informar uma pasta de entrada, uma pasta de saída e um filtro
de modelo nessa ordem.

### 6. Calcular as métricas

```bash
npm run metricas
```

Os resultados são salvos em `scripts/resultados_metricas/`:
- `metricas_individuais.json` — métricas por execução
- `metricas_medias_por_grupo.json` — médias agrupadas por ECOS × grupo × modelo

---

## Observações

- Os modelos de referência em JSON foram extraídos manualmente das figuras do TCC. **Revise-os** antes de rodar o experimento completo.
- O SOLAR possui 3 CoIs (SOLAR web, SOLAR MOBILE, SOLAR MOOC) — verifique se os LLMs os identificaram corretamente como CoIs distintos.
- Os arquivos de saída em `execucoes/` devem ser disponibilizados como material suplementar da pesquisa.
- As execuções são retomáveis: arquivos JSON com status `ok` são pulados pelo executor.
- O cálculo de métricas aceita filtros em pares, por exemplo:

	```bash
	npx ts-node scripts/calcular_metricas.ts --ecos SIPPA --grupo G2 --modelo gemini-3.5-flash
	```
- As métricas calculadas ficam em `scripts/resultados_metricas/`; os XMLs ficam em `xmls/` quando gerados pelo conversor.
