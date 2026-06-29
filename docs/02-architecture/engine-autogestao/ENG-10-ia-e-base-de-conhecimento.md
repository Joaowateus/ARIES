---
id: ARC-ENG-010
titulo: "ENG-10 — Engine de IA e Base de Conhecimento"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-002
  - ARC-ENG-004
  - ARC-ENG-009
tags: [engine, ia, inteligencia-artificial, base-de-conhecimento, memoria-institucional, ml, llm, predicao, aprendizado]
---

# ENG-10 — Engine de IA e Base de Conhecimento

---

## 1. Objetivo

Fornecer **memória institucional estruturada** e **capacidades de inteligência artificial** ao SOE — transformando a experiência acumulada da empresa em conhecimento acessível, e usando esse conhecimento para antecipar problemas, sugerir ações, reduzir o tempo de diagnóstico, e progressivamente aproximar o sistema de um estado de autogestão genuína.

A ENG-10 é o **sistema de aprendizagem** do SOE: enquanto as outras Engines operam no presente (executar, medir, alertar, corrigir), a ENG-10 opera na dimensão temporal — acumulando o passado para melhorar o futuro.

Há dois componentes integrados nesta Engine:

1. **Base de Conhecimento (BK):** repositório estruturado de tudo que o SOE aprendeu — diagnósticos, planos que funcionaram, padrões identificados, decisões tomadas, retrospectivas.
2. **Camada de IA:** modelos e capacidades que consomem a Base de Conhecimento e os dados do SOE para gerar previsões, sugestões, classificações e análises.

---

## 2. Responsabilidades

### Base de Conhecimento
- **Indexar** automaticamente todo conhecimento gerado pelo SOE: diagnósticos concluídos, planos eficazes e ineficazes, alertas resolvidos, retrospectivas, DECISION_LOG
- **Estruturar** o conhecimento em categorias pesquisáveis (por módulo, por tipo de problema, por causa raiz, por solução aplicada)
- **Disponibilizar** o conhecimento para consulta por qualquer Engine ou por usuários humanos
- **Versionar** o conhecimento — o que era verdade há 2 anos pode não ser mais relevante
- **Rastrear** a proveniência de cada peça de conhecimento (de onde veio, quando, com que nível de confiança)

### Camada de IA
- **Prever** KPIs futuros com base em padrões históricos (ex: probabilidade de churn, forecast de MRR)
- **Classificar** situações com base em padrões conhecidos (ex: tipo de objeção de venda, categoria de causa raiz de um desvio)
- **Sugerir** diagnósticos e hipóteses com base em casos similares anteriores
- **Sugerir** planos de ação com base em planos que foram eficazes em situações similares
- **Gerar** sumários e análises narrativas (relatórios, resumos de KPIs, briefings)
- **Identificar** padrões invisíveis a humanos (correlações entre KPIs, anomalias sazonais, sinais de risco)
- **Responder** perguntas em linguagem natural sobre os dados do SOE

---

## 3. Entradas

### 3.1 Entradas Contínuas — Alimentação da Base de Conhecimento
| Fonte | Conteúdo | Frequência |
|-------|----------|-----------|
| ENG-04 (Diagnóstico) | Sessões concluídas: sintoma, causa raiz, categoria, evidência, confiança | Por conclusão |
| ENG-05 (Planos de Ação) | Planos com resultado verificado: o que foi feito, se funcionou | Por verificação |
| ENG-06 (Auditoria) | Relatórios de auditoria: NCs, índices, tendências | Por execução |
| ENG-09 (Melhoria Contínua) | Ciclos PDCA concluídos, retrospectivas, aprendizados | Por ciclo |
| ENG-02 (KPIs) | Série histórica completa de todos os KPIs | Contínuo |
| ENG-01 (Processos) | Histórico de instâncias: duração, etapas, SLAs, taxas de sucesso | Contínuo |
| ENG-03 (Alertas) | Histórico de alertas: frequência, tempo de resolução, soluções aplicadas | Contínuo |
| DECISION_LOG | Todas as decisões estratégicas e táticas registradas | Por evento |

### 3.2 Entradas de Consulta (Run Time)
| Consulta | Origem | Tipo |
|----------|--------|------|
| "Quais casos similares existem para este diagnóstico?" | ENG-04 | Busca semântica |
| "Qual a probabilidade de churn deste cliente?" | CAP-05 | Predição de ML |
| "Qual será o MRR do próximo mês?" | CAP-04/CAP-08 | Previsão de série temporal |
| "Que plano de ação funcionou melhor para causa raiz = ICP desatualizado?" | ENG-05 | Busca na BK |
| "Gere o sumário do relatório mensal de CAP-03 com os dados deste mês" | CAP-08 | Geração de texto |
| "Por que o win rate caiu?" | Usuário humano (linguagem natural) | Análise e busca |

---

## 4. Saídas

| Saída | Destino | Quando |
|-------|---------|--------|
| `ia.casos_similares_encontrados` | ENG-04 (Diagnóstico) | Ao abrir sessão de diagnóstico |
| `ia.hipoteses_geradas` | ENG-04 (Diagnóstico) | Ao iniciar sessão |
| `ia.planos_similares_encontrados` | ENG-05 (Planos de Ação) | Ao criar plano |
| `ia.predicao_churn` | CAP-05 | Mensal (para todos os clientes ativos) |
| `ia.predicao_mrr` | CAP-04, CAP-08 | Semanal (rolling forecast) |
| `ia.score_probabilidade_fechamento` | CAP-03 | Por oportunidade (atualizado com cada interação) |
| `ia.anomalia_detectada` | ENG-03 (Alertas) | Ao detectar padrão anômalo |
| `ia.sumario_gerado` | CAP-08 (relatórios) | Por solicitação |
| Resultado de consulta em linguagem natural | Interface do usuário | Por consulta |
| Relatório de saúde da Base de Conhecimento | Administrador SOE | Mensal |

---

## 5. Regras Gerais

### RG-01: IA Assiste, Não Decide
A ENG-10 NUNCA toma decisões autônomas que afetam operações. Ela sugere, prevê, classifica e analisa — mas a decisão final é sempre humana. Outputs de IA são marcados como `sugestão_ia` e o humano deve confirmar antes de qualquer ação crítica.

### RG-02: Proveniência e Rastreabilidade de Todo Conhecimento
Cada peça de conhecimento na Base de Conhecimento DEVE ter registrado: (a) de onde veio (evento, Engine, módulo), (b) quando foi gerado, (c) nível de confiança (alto/médio/baixo), e (d) quantas vezes foi validado na prática. Conhecimento sem proveniência é descartado.

### RG-03: Decaimento Temporal do Conhecimento
Conhecimento sobre o negócio tem validade. Um diagnóstico de 3 anos atrás pode não ser relevante hoje. A ENG-10 aplica decaimento temporal: conhecimento não validado recentemente perde peso nas sugestões. O período de decaimento padrão é de 18 meses, configurável por tipo de conhecimento.

### RG-04: Separação entre Dados Operacionais e Dados de Treinamento
Dados usados para treinar modelos de ML DEVEM ser anonimizados quando contêm informação pessoal de clientes (LGPD). O pipeline de treinamento usa dados com PII removido ou pseudonimizado.

### RG-05: Explicabilidade Mínima
Para qualquer predição ou sugestão, a ENG-10 DEVE ser capaz de fornecer uma explicação em linguagem humana: "Esta previsão se baseia em [X] casos históricos similares onde [Y] foi observado e [Z] aconteceu." Modelos de caixa-preta sem explicabilidade não são aceitos em contextos operacionais críticos.

### RG-06: Feedback Loop Obrigatório
Toda predição ou sugestão DEVE ter seu resultado coletado. Se o modelo previu churn com 80% de confiança e o cliente não churnou, isso alimenta o retreinamento do modelo. A ENG-10 monitora a acurácia dos seus outputs continuamente e reporta degradação de performance.

### RG-07: Custo-Benefício de IA
Nem tudo precisa de IA. A ENG-10 aplica IA onde o valor marginal supera o custo e a complexidade. Regras simples e determinísticas são preferíveis a modelos de ML quando o resultado é igualmente bom — simplicidade é uma vantagem de manutenção.

---

## 6. Interfaces com os Módulos

### 6.1 Capacidades por Módulo

| Módulo | Capacidade de IA Fornecida |
|--------|---------------------------|
| CAP-01 | Sumarização automática de win/loss; detecção de padrão de objeções; competitive monitoring |
| CAP-02 | ICP scoring preditivo; identificação de lookalike accounts; enriquecimento automático de leads |
| CAP-03 | Score de probabilidade de fechamento por oportunidade; sugestão de próxima ação; análise de sentimento em e-mails |
| CAP-04 | Previsão de MRR (rolling 3M); identificação de clientes com risco de inadimplência |
| CAP-05 | Previsão de churn (próximos 30 dias); identificação de oportunidade de expansão; sumarização de histórico do cliente |
| CAP-06 | Sugestão de preço por oportunidade; detecção de gap de portfólio |
| CAP-07 | Previsão de atingimento de quota; análise de gravações de reuniões (coaching) |
| CAP-08 | Geração automática de relatório narrativo; forecast de OKRs; detecção de anomalia em KPIs |
| CAP-09 | Identificação de parceiros potenciais (lookalike); classificação de qualidade de lead por parceiro |

### 6.2 Capacidades para as Engines

| Engine | Capacidade Fornecida |
|--------|---------------------|
| ENG-04 | Casos similares de diagnóstico; hipóteses iniciais baseadas em histórico |
| ENG-05 | Planos de ação que funcionaram em situações similares |
| ENG-03 | Detecção de anomalia estatística (alertas baseados em padrão, não apenas limiar fixo) |
| ENG-09 | Identificação de padrões de melhoria de alto impacto |

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `conhecimento_base` (Base de Conhecimento)
```
id                      UUID PRIMARY KEY
tipo                    ENUM(diagnostico, plano_eficaz, plano_ineficaz, retrospectiva_aprendizado,
                              decisao, padrao_alerta, processo_benchmark, regra_negocio)
modulo                  TEXT
titulo                  TEXT
conteudo_json           JSONB               -- conteúdo estruturado do conhecimento
conteudo_texto          TEXT                -- versão em texto para busca semântica
tags_json               JSONB               -- palavras-chave, categoria, KPI, causa raiz
proveniencia_tipo       TEXT               -- "ENG-04:sessao_id", "ENG-09:ciclo_id"
proveniencia_id         UUID
nivel_confianca         ENUM(alto, medio, baixo)
vezes_validado          INTEGER DEFAULT 0  -- quantas vezes foi confirmado na prática
score_relevancia        DECIMAL            -- calculado: confiança × validações × frescor
criado_em               TIMESTAMP
ultima_validacao_em     TIMESTAMP
embedding_vector        VECTOR(1536)       -- vetor semântico para busca por similaridade
```

### 7.2 Tabela: `ia_modelos`
```
id                      TEXT PRIMARY KEY   -- "MODELO-CHURN-V3"
nome                    TEXT
tipo                    ENUM(classificacao, regressao, serie_temporal, nlp_geracao, nlp_classificacao, busca_semantica)
modulo_alvo             TEXT
kpi_alvo                TEXT               -- o que este modelo prevê
versao                  TEXT
status                  ENUM(treinando, producao, depreciado)
acuracia_atual          DECIMAL            -- % de acerto nas últimas N predições
data_ultimo_treino      TIMESTAMP
features_json           JSONB              -- quais variáveis usa para predizer
threshold_retreino      DECIMAL            -- acurácia mínima antes de retreinar
```

### 7.3 Tabela: `ia_predicoes` (série temporal — imutável)
```
id                      UUID PRIMARY KEY
modelo_id               TEXT REFERENCES ia_modelos
entidade_tipo           TEXT               -- "cliente", "oportunidade", "modulo"
entidade_id             TEXT
predicao_tipo           TEXT               -- "churn_30d", "mrr_proximo_mes"
valor_predito           DECIMAL
confianca               DECIMAL            -- 0 a 1
intervalo_min           DECIMAL
intervalo_max           DECIMAL
features_usadas_json    JSONB
explicacao              TEXT
criada_em               TIMESTAMP
-- Feedback loop
valor_real              DECIMAL            -- preenchido quando o futuro chegou
erro_absoluto           DECIMAL
acertou                 BOOLEAN
feedback_registrado_em  TIMESTAMP
```

### 7.4 Tabela: `ia_consultas_nl` (log de perguntas em linguagem natural)
```
id                      UUID PRIMARY KEY
usuario                 TEXT
pergunta                TEXT
contexto_json           JSONB              -- módulo, período, filtros
intencao_detectada      TEXT               -- "diagnostico", "previsao", "busca", "sumario"
fontes_consultadas_json JSONB              -- quais tabelas/knowledge items foram usados
resposta                TEXT
confianca               DECIMAL
tempo_resposta_ms       INTEGER
feedback_usuario        ENUM(util, nao_util, incorreto)
criada_em               TIMESTAMP
```

---

## 8. Fluxo Operacional

```
[FLUXO A — INGESTÃO E INDEXAÇÃO DE CONHECIMENTO (contínuo)]
│
└─► Eventos chegam de ENG-04, ENG-05, ENG-06, ENG-09
    └─► ENG-10 extrai conteúdo estruturado do evento
        └─► Classifica tipo de conhecimento e nível de confiança
            └─► Gera texto normalizado para indexação
                └─► Gera embedding vetorial (via modelo de NLP)
                    └─► Salva em conhecimento_base com proveniência
                        └─► Índice de busca semântica atualizado

[FLUXO B — CICLO DE PREDIÇÃO (agendado por modelo)]
│
└─► Scheduler dispara ciclo de predição do modelo (ex: churn mensal)
    └─► Para cada entidade elegível (ex: cada cliente ativo):
        └─► Coletar features mais recentes (histórico de KPIs, eventos)
            └─► Executar modelo → obter predição + intervalo de confiança + explicação
                └─► Salvar em ia_predicoes
                    └─► Emitir evento de predição (ex: ia.predicao_churn)
                        └─► CAP-05 recebe e atualiza health score + cria alerta se necessário

[FLUXO C — ASSISTÊNCIA A ENGINES (sob demanda)]
│
├─► ENG-04 abre diagnóstico e solicita casos similares:
│   └─► ENG-10 busca em conhecimento_base por similaridade semântica (embedding search)
│       └─► Retorna top-5 casos similares com score de similaridade
│           └─► Emite ia.casos_similares_encontrados → ENG-04 apresenta ao responsável
│
├─► ENG-05 solicita planos similares:
│   └─► ENG-10 filtra conhecimento_base por tipo = plano_eficaz AND modulo E causa_raiz similares
│       └─► Ordena por nivel_confianca × vezes_validado
│           └─► Emite ia.planos_similares_encontrados
│
└─► ENG-03 solicita detecção de anomalia estatística:
    └─► ENG-10 analisa série temporal de um KPI
        └─► Detecta se o valor atual desvia mais do que 2σ do padrão sazonal histórico
            └─► Se sim: emite ia.anomalia_detectada → ENG-03 cria alerta

[FLUXO D — CONSULTA EM LINGUAGEM NATURAL (sob demanda)]
│
└─► Usuário faz pergunta: "Por que o win rate caiu em maio?"
    └─► ENG-10 detecta intenção: diagnóstico/análise
        └─► Coleta contexto: valores de KPI-PV-01 em maio vs. histórico
            └─► Busca em conhecimento_base: diagnósticos de win rate nos últimos 2 anos
                └─► Busca correlações: outros KPIs que também deterioraram em maio
                    └─► Gera resposta narrativa com referências à Base de Conhecimento
                        └─► Apresenta resposta + fontes + confiança
                            └─► Registra em ia_consultas_nl para análise de uso

[FLUXO E — FEEDBACK LOOP E RETREINAMENTO]
│
└─► Scheduler verifica predições com data de verificação vencida
    └─► Coleta valor real do KPI/evento predito
        └─► Compara com predição → calcula erro
            └─► Atualiza ia_predicoes (valor_real, erro_absoluto, acertou)
                └─► Atualiza métrica de acurácia do modelo em ia_modelos
                    └─► Acurácia abaixo do threshold?
                        ├─► SIM → emite ia.modelo_degradado → administrador retreina modelo
                        └─► NÃO → continuar monitorando
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `ia.casos_similares_encontrados` | Busca semântica concluída | `{sessao_diagnostico_id, casos: [{id, score, resumo}]}` |
| `ia.hipoteses_geradas` | Hipóteses derivadas do histórico | `{sessao_diagnostico_id, hipoteses: [{texto, confianca, fonte_id}]}` |
| `ia.planos_similares_encontrados` | Busca de planos na BK | `{plano_solicitante_id, planos: [{id, resultado, confianca}]}` |
| `ia.predicao_churn` | Ciclo mensal de churn scoring | `{cliente_id, probabilidade_churn_30d, confianca, explicacao}` |
| `ia.predicao_mrr` | Ciclo semanal de revenue forecast | `{periodo, mrr_predito, intervalo_confianca, features_principais}` |
| `ia.score_fechamento` | Por oportunidade (atualização) | `{oportunidade_id, probabilidade_fechamento, variacao_vs_anterior}` |
| `ia.anomalia_detectada` | Desvio estatístico identificado | `{kpi_id, valor, media_historica, desvio_sigma, periodo}` |
| `ia.sumario_gerado` | Sumário de relatório gerado | `{tipo_relatorio, periodo, modulo, sumario_texto}` |
| `ia.conhecimento_indexado` | Novo item indexado na BK | `{conhecimento_id, tipo, modulo, proveniencia}` |
| `ia.modelo_degradado` | Acurácia abaixo do threshold | `{modelo_id, acuracia_atual, threshold, periodo}` |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `diagnostico.aberto` | ENG-04 | Buscar casos similares + gerar hipóteses; emitir ia.casos_similares_encontrados |
| `plano_acao.criado` | ENG-05 | Buscar planos similares bem-sucedidos |
| `plano_acao.verificado_eficaz` | ENG-05 | Indexar na BK como conhecimento validado de alta confiança |
| `plano_acao.verificado_ineficaz` | ENG-05 | Indexar como conhecimento de baixa confiança; reduzir score de planos similares |
| `melhoria.implementada` | ENG-09 | Indexar aprendizado na BK; atualizar conhecimento afetado |
| `melhoria.retrospectiva_concluida` | ENG-09 | Indexar aprendizados da retrospectiva |
| `kpi.calculado` | ENG-02 | Alimentar série temporal para modelos preditivos; detectar anomalias |
| `processo.instancia_concluida` | ENG-01 | Atualizar dados de benchmark de processo na BK |
| `alerta.resolvido` | ENG-03 | Indexar solução como conhecimento; reforçar padrão |
| `auditoria.concluida` | ENG-06 | Indexar relatório; atualizar benchmarks de conformidade |
| `ia.predicao_churn` | ENG-10 (self) | Após período, coletar resultado real → feedback loop |
| `cliente.cancelou` | CAP-05 | Verificar se havia predição de churn; calcular acurácia do modelo |

---

## Apêndice: Arquitetura Técnica da Camada de IA

```
┌─────────────────────────────────────────────────────────────┐
│                    ENG-10 — Camada de IA                    │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐  │
│  │ Base de Conhecimento │  │    Modelos de ML / LLM      │  │
│  │                     │  │                             │  │
│  │ • Vector Store      │  │ • Churn prediction (RF/XGB) │  │
│  │   (embeddings)      │  │ • Revenue forecast (LSTM)   │  │
│  │ • Structured Store  │  │ • Deal scoring (logistic)   │  │
│  │   (metadados JSON)  │  │ • LLM: sumarização / NLQ    │  │
│  │ • Full-text Index   │  │ • Anomaly detection (STL)   │  │
│  │                     │  │ • NLP: classificação        │  │
│  └──────────┬──────────┘  └──────────────┬──────────────┘  │
│             │                            │                  │
│  ┌──────────▼────────────────────────────▼──────────────┐  │
│  │              Orquestrador de IA                       │  │
│  │  (recebe consultas → decide qual modelo usar →        │  │
│  │   combina BK + modelo → gera resposta explicável)    │  │
│  └──────────────────────────┬───────────────────────────┘  │
│                             │                              │
│                    Barramento de Eventos SOE               │
└─────────────────────────────────────────────────────────────┘
```

### Modelos Iniciais (MVP da Camada de IA)

| Prioridade | Modelo | Método | Dado Mínimo |
|------------|--------|--------|-------------|
| P1 | Churn prediction | Random Forest | 6 meses de histórico de health score + NPS |
| P1 | Revenue forecast | Média móvel → LSTM (após 12 meses de dado) | 6 meses de MRR |
| P1 | Busca semântica na BK | Embeddings (OpenAI / Claude) + Vector DB | Base de conhecimento > 50 itens |
| P2 | Deal scoring | Logistic Regression | 100+ oportunidades fechadas |
| P2 | Sumarização de relatórios | LLM (Claude) | Dados do período disponíveis |
| P3 | NLQ (linguagem natural) | LLM + RAG sobre BK | Base de conhecimento madura |
| P3 | Anomaly detection por KPI | STL decomposition | 18+ meses de histórico |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-10 |
