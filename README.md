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
│   ├── executor_experimento.ts      ← executa as 108 chamadas às APIs
│   ├── calcular_metricas.ts         ← calcula PA, RA, F1-A, PR, TA
│   ├── converter_todos.ts           ← converte saídas JSON para XML
│   ├── json2xml.ts                  ← utilitário de conversão JSON → XML
│   └── resultados_metricas/
│       ├── metricas_individuais.json
│       └── metricas_medias_por_grupo.json
├── execucoes/                       ← saídas JSON brutas das execuções
├── gemini/                          ← saídas XML do Gemini 2.5 Flash
├── groq_llama/                      ← saídas XML do LLaMA 3.3 70b (via Groq)
├── qwen/                            ← saídas XML do Qwen 3.6 (via Ollama)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Modelos LLM utilizados

| ID no experimento | Modelo | Provedor |
|---|---|---|
| `gemini-3.5-flash` | Gemini 2.5 Flash | Google AI (API) |
| `groq-llama-3.3-70b` | LLaMA 3.3 70b | Groq (API) |
| `ollama-qwen3.6` | Qwen 3 (6B) | Ollama (local) |

---

## Variáveis do experimento

| Variável | Valor |
|---|---|
| ECOSs avaliados | SkinnerBox, SIPPA, SOLAR |
| Grupos de prompt | G1 (baseline), G2, G3, G4 |
| Repetições por unidade | 3 |
| Total de execuções por modelo | 36 |
| **Total geral** | **108** |
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
| TA | Taxa de Alucinação: proporção de atores inexistentes gerados |

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
```

> O Qwen é executado localmente via Ollama — certifique-se de ter o modelo `qwen` disponível (`ollama pull qwen`).

### 3. Executar o piloto (recomendado antes do experimento completo)

```bash
npm run piloto
```

Isso executa apenas G1 no SIPPA com os 3 modelos (9 execuções). Verifique as saídas em `execucoes/` antes de prosseguir.

### 4. Executar o experimento completo

```bash
npm run executar
```

Tempo estimado: ~30–60 minutos (108 chamadas com intervalo entre elas).

### 5. Converter saídas JSON para XML

```bash
npx ts-node scripts/converter_todos.ts
```

Os arquivos XML são gerados nas pastas `gemini/`, `groq_llama/` e `qwen/`.

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
- O experimento já foi executado; as saídas XML estão nas pastas `gemini/`, `groq_llama/` e `qwen/` e as métricas calculadas estão em `scripts/resultados_metricas/`.
