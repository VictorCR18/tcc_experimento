# Experimento TCC — Victor Cavalcante
## Avaliação de Técnicas de Contextualização para Geração de Modelos SSN com LLMs

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
│   ├── executor_experimento.py      ← executa as 108 chamadas às APIs
│   └── calcular_metricas.py         ← calcula PA, RA, F1-A, PR, TA
├── execucoes/                        ← gerado automaticamente (saídas brutas)
├── resultados_metricas/              ← gerado automaticamente (métricas)
└── README.md
```

---

## Passo a Passo

### 1. Instalar dependências

```bash
pip install google-generativeai anthropic openai
```

### 2. Configurar as chaves de API

```bash
export GEMINI_API_KEY="sua_chave_gemini"
export ANTHROPIC_API_KEY="sua_chave_anthropic"
export OPENAI_API_KEY="sua_chave_openai"
```

No Windows (PowerShell):
```powershell
$env:GEMINI_API_KEY = "sua_chave_gemini"
$env:ANTHROPIC_API_KEY = "sua_chave_anthropic"
$env:OPENAI_API_KEY = "sua_chave_openai"
```

### 3. Executar apenas o piloto G1 (recomendado antes do experimento completo)

Edite o `executor_experimento.py` e mude temporariamente:
```python
grupos = ["G1"]           # só o baseline
ecos_lista = ["SIPPA"]    # só o ECOS mais simples
```

Rode:
```bash
cd scripts
python executor_experimento.py
```

Isso gera 9 arquivos (3 modelos × 3 repetições) em `execucoes/`.

### 4. Calcular métricas do piloto

```bash
python calcular_metricas.py
```

Verifique `resultados_metricas/metricas_medias_por_grupo.json`.

### 5. Expandir o dicionário de normalização

Abra `calcular_metricas.py` e veja os campos `atores_alucinados` nos resultados.
Adicione os termos novos a `NORM_TIPO_ATOR` e `NORM_TIPO_FLUXO`.

### 6. Executar o experimento completo

Restaure os parâmetros originais no `executor_experimento.py`:
```python
grupos = ["G1", "G2", "G3", "G4"]
ecos_lista = ["SkinnerBox", "SIPPA", "SOLAR"]
```

Rode novamente:
```bash
python executor_experimento.py
```

Tempo estimado: ~30-60 minutos (108 chamadas com sleep de 1.5s entre elas).

### 7. Calcular todas as métricas

```bash
python calcular_metricas.py
```

---

## Variáveis do experimento

| Variável | Valor |
|---|---|
| Temperatura | 0.0 (determinístico) |
| Repetições por unidade | 3 |
| Total de execuções por modelo | 36 |
| Total geral | 108 |
| Métrica principal | F1-A (harmônica entre PA e RA) |
| Teste estatístico | Kruskal-Wallis (entre grupos G1-G4) |

## Métricas calculadas

| Métrica | Significado |
|---|---|
| PA | Precisão de Atores: dos atores gerados, quantos estão corretos? |
| RA | Recall de Atores: dos atores de referência, quantos foram encontrados? |
| F1-A | Média harmônica entre PA e RA |
| PR | Precisão de Relações: das relações geradas, quantas são corretas? |
| TA | Taxa de Alucinação: proporção de atores inexistentes gerados |

---

## Observações importantes

- Os modelos de referência em JSON foram extraídos manualmente das figuras do TCC.
  **Revise-os** contra os originais antes de rodar o experimento completo.
- O SOLAR tem 3 CoIs (SOLAR web, SOLAR MOBILE, SOLAR MOOC) — verifique se o LLM
  os identificou corretamente como CoIs separados.
- O SIPPA v2 (com mobile) pode ser adicionado como um quarto ECOS se desejado.
- Os arquivos de saída individuais ficam em `execucoes/<id_execucao>.json` e
  devem ser disponibilizados como material suplementar da pesquisa.
# tcc_experimento
