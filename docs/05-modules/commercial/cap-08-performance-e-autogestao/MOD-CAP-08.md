---
id: MOD-CAP-08
titulo: "Módulo Operacional — Gestão de Performance e Autogestão"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - MOD-CAP-01
  - MOD-CAP-02
  - MOD-CAP-03
  - MOD-CAP-04
  - MOD-CAP-05
  - MOD-CAP-06
  - MOD-CAP-07
tags: [performance, autogestao, kpis, metas, okr, dashboard, decisao, ciclo-pdca, governanca]
---

# MOD-CAP-08 — Gestão de Performance e Autogestão

---

## 1. Objetivo da Capacidade

Consolidar, analisar e distribuir os dados de performance de todo o Núcleo Comercial de forma que a empresa opere com visibilidade completa, tome decisões baseadas em dados e execute ciclos de melhoria contínua — reduzindo a dependência de decisões intuitivas e aproximando a operação de um sistema de autogestão empresarial.

Este módulo é o **sistema nervoso central** do Núcleo Comercial: recebe dados de todos os outros módulos, calcula metas, detecta desvios, aciona alertas e gera o ciclo de aprendizagem organizacional.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | Visibilidade completa em tempo real | Dashboard de performance atualizado diariamente; nenhum KPI crítico sem dado |
| R2 | Metas definidas, comunicadas e monitoradas | 100% dos KPIs com meta definida, responsável e frequência de monitoramento |
| R3 | Ciclo de revisão executado sistematicamente | Reuniões de performance realizadas conforme cadência definida (semanal, mensal, trimestral) |
| R4 | Desvios identificados e tratados | 100% dos desvios críticos com plano de ação registrado em até 5 dias úteis |
| R5 | Aprendizagem organizacional documentada | Decisões estratégicas registradas no DECISION_LOG; retrospectivas executadas trimestralmente |

**Definição de Sucesso:** Qualquer stakeholder (líder, gerente, investidor) consegue entender a performance atual do Núcleo Comercial em menos de 5 minutos, com dados confiáveis e atualizados.

---

## 3. Entradas Necessárias

### 3.1 Dados Recebidos de Cada Módulo
| Módulo | Dados Recebidos | Frequência |
|--------|----------------|-----------|
| CAP-01 Inteligência Comercial | Win rate por segmento, cobertura win/loss, atualidade do mapa competitivo | Mensal |
| CAP-02 Gestão de Demanda | Volume de leads, SQLs, taxa de conversão, CPL, pipeline total (R$) | Semanal |
| CAP-03 Processo de Vendas | Win rate, ciclo médio, ticket médio, desconto médio, new MRR | Mensal |
| CAP-04 Gestão de Receita | MRR, ARR, NRR, GRR, Churn MRR, forecast de receita | Mensal |
| CAP-05 Gestão de Clientes | Churn rate, NPS, health score médio, expansion MRR, onboarding SLA | Mensal |
| CAP-06 Oferta e Precificação | Ticket médio realizado, margem bruta, aderência ao portfólio | Trimestral |
| CAP-07 Equipe Comercial | Atingimento individual de quota, capacidade, headcount, turnover | Mensal |

### 3.2 Entradas Estratégicas
| Entrada | Fonte | Frequência |
|---------|-------|-----------|
| Metas anuais e trimestrais (OKRs) | Liderança / Planejamento estratégico | Anual + revisão trimestral |
| Orçamento comercial | Financeiro | Anual |
| Benchmarks de mercado | CAP-01 + fontes externas | Trimestral |

---

## 4. Saídas Obrigatórias

### 4.1 Relatórios e Dashboards
| Saída | Destinatário | Periodicidade | SLA |
|-------|-------------|--------------|-----|
| Dashboard de Performance (tempo real) | Toda a equipe comercial | Contínua | Atualização diária |
| Relatório Semanal de Pipeline | Gerente + Liderança | Semanal | Segunda-feira 9h |
| Relatório Mensal de Performance | Liderança + Conselho | Mensal | Dia 7 do mês seguinte |
| Relatório Trimestral (Business Review) | Liderança + Conselho | Trimestral | 10 dias após o trimestre |
| Revenue Forecast (rolling 3M) | Liderança | Semanal | Segunda-feira |
| DECISION_LOG atualizado | Repositório / Equipe | Por evento de decisão | Até 24h após a decisão |

### 4.2 Metas e Objetivos Distribuídos
| Saída | Destinatário | Periodicidade |
|-------|-------------|--------------|
| Metas mensais individuais e de equipe | CAP-07 (Equipe Comercial) | Mensal |
| Metas de geração de demanda | CAP-02 | Mensal |
| Metas de receita e retenção | CAP-04 + CAP-05 | Mensal |
| Limites de CPL e ticket mínimo | CAP-06 | Por atualização estratégica |

---

## 5. Regras de Negócio

### RN-01: Definição de Metas
- Metas DEVEM ser definidas com base em dados históricos + benchmarks de mercado + ambição estratégica
- Metas DEVEM ser SMART: Específicas, Mensuráveis, Atingíveis, Relevantes e Temporais
- Nenhuma meta pode ser alterada durante o período de vigência sem aprovação da liderança e registro no DECISION_LOG
- Metas individuais DEVEM ser comunicadas a cada integrante antes do início do período

### RN-02: Cadência de Revisão (Ritmo Operacional)
```
DIÁRIO:   Dashboard atualizado; alertas críticos monitorados
SEMANAL:  Pipeline Review (30 min — equipe + gerente)
MENSAL:   Reunião de performance mensal (90 min — análise de KPIs + decisões táticas)
TRIMESTRAL: Business Review (3h — análise estratégica + revisão de metas + planejamento)
ANUAL:    Planejamento estratégico do Núcleo Comercial (1 dia)
```

### RN-03: Registro de Decisões
- Toda decisão que afeta o Núcleo Comercial DEVE ser registrada no DECISION_LOG com: data, decisão, contexto, responsável, impacto esperado
- Decisões sem registro são consideradas informais e não vinculantes
- O DECISION_LOG é imutável (não se altera o que foi decidido — se mudar, registra nova decisão)

### RN-04: Qualidade dos Dados
- Um KPI sem fonte confiável não pode ser publicado como dado oficial
- Dados do CRM são fonte primária; planilhas pessoais NÃO são fontes válidas para KPIs oficiais
- Responsável pelo módulo que alimenta o dado é responsável pela qualidade do mesmo

### RN-05: Resposta a Desvios
- Desvio crítico (KPI abaixo de [X]% da meta) DEVE ter plano de ação documentado em até 5 dias úteis
- Plano de ação DEVE conter: causa raiz identificada, ações específicas, responsável, prazo e KPI de controle
- Desvio crítico recorrente (>2 meses) DEVE ser escalado para liderança com análise aprofundada

### RN-06: Retrospectiva Obrigatória
- Ao final de cada trimestre, DEVE ser realizada retrospectiva do Núcleo Comercial: o que funcionou, o que não funcionou, o que aprender
- Resultado da retrospectiva DEVE ser documentado e alimentar o planejamento do próximo trimestre

---

## 6. Fluxo Operacional Completo

```
ENTRADA — Coleta de Dados (automática + manual)
│
├─► CRM: dados de pipeline, oportunidades, win/loss (automático)
├─► CAP-04: MRR, NRR, faturamento (automático ou mensal)
├─► CAP-05: Health Score, Churn, NPS (mensal)
├─► CAP-07: Atingimento individual, headcount (mensal)
└─► CAP-01/02/03/06: dados específicos por frequência definida
│
▼
PROCESSAMENTO — Consolidação e Análise
│
├─► [Dashboard] — atualizado diariamente com dados de CRM
├─► [Relatório Semanal] — consolidação manual/automática às sextas
├─► [Relatório Mensal] — consolidação completa de todos os módulos até dia 5
└─► [Forecast] — atualizado toda segunda com dados de pipeline
│
▼
PUBLICAÇÃO E DISTRIBUIÇÃO
│
├─► Dashboard disponível para todos os stakeholders (self-service)
├─► Relatório enviado por e-mail / canal oficial para destinatários
└─► Alertas enviados quando KPIs cruzam limites críticos
│
▼
CICLO DE REVISÃO — Reunião de Performance
│
├─► [SEMANAL — Pipeline Review]
│     ├─ O que está para fechar esta semana?
│     ├─ Há oportunidades em risco? O que fazer?
│     └─ O pipeline está acima de 3× a meta do mês?
│
├─► [MENSAL — Performance Review]
│     ├─ KPIs do mês vs. metas: o que atingimos? o que não?
│     ├─ Diagnóstico dos desvios: causa raiz
│     ├─ Decisões táticas + registrar no DECISION_LOG
│     └─ Comunicar metas do próximo mês
│
└─► [TRIMESTRAL — Business Review]
      ├─ Análise do trimestre: o que aprendemos?
      ├─ Revisão e calibração de metas do próximo trimestre
      ├─ Retrospectiva: what worked / what didn't / what to change
      └─ Atualizar planejamento estratégico
│
▼
TRATAMENTO DE DESVIOS
│
├─► Desvio identificado → analisar causa raiz (ver seção 9)
├─► Plano de ação criado → documentar + responsável + prazo
├─► Monitoramento semanal do plano
└─► KPI volta ao normal → documentar aprendizado; atualizar processo
│
▼
REGISTRO
│
├─► DECISION_LOG: todas as decisões registradas imutavelmente
├─► Relatórios mensais arquivados no repositório oficial
├─► Retrospectivas trimestrais documentadas
└─► Histórico de KPIs preservado para análise de tendência
│
▼
AUDITORIA
│
└─► Trimestral: qualidade dos dados, aderência ao ritmo operacional,
    completude do DECISION_LOG, retrospectivas realizadas
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPI Master — Scorecard do Núcleo Comercial

> Este módulo consolida e monitora todos os KPIs dos demais módulos. Os KPIs abaixo são os indicadores de nível estratégico do Núcleo Comercial como um todo.

| Perspectiva | Código | Indicador | Meta | Frequência |
|-------------|--------|-----------|------|-----------|
| **Crescimento** | KPI-PA-01 | MRR Total | Meta anual / 12 | Mensal |
| **Crescimento** | KPI-PA-02 | New MRR | Meta mensal | Mensal |
| **Crescimento** | KPI-PA-03 | ARR | Meta anual | Mensal |
| **Eficiência** | KPI-PA-04 | Win Rate global | ≥ meta por segmento | Mensal |
| **Eficiência** | KPI-PA-05 | Ciclo médio de vendas | ≤ benchmark | Mensal |
| **Eficiência** | KPI-PA-06 | CAC (Custo de Aquisição de Cliente) | ≤ [meta] | Mensal |
| **Eficiência** | KPI-PA-07 | LTV (Lifetime Value) | ≥ [meta]; LTV/CAC ≥ 3 | Trimestral |
| **Retenção** | KPI-PA-08 | NRR | ≥ [meta] | Mensal |
| **Retenção** | KPI-PA-09 | Churn Rate | ≤ [meta] | Mensal |
| **Satisfação** | KPI-PA-10 | NPS | ≥ [meta] | Trimestral |
| **Pipeline** | KPI-PA-11 | Pipeline Total (R$) | ≥ 3× meta de fechamento | Semanal |
| **Previsão** | KPI-PA-12 | Acuracidade do Forecast | ≥ 90% | Mensal |
| **Equipe** | KPI-PA-13 | % da equipe acima de quota | ≥ 70% | Mensal |

### 7.2 Fórmulas Estratégicas Derivadas
| Indicador | Fórmula |
|-----------|---------|
| CAC | (Custo total de Sales + Marketing) / Nº de novos clientes no período |
| LTV | ARPU × Margem Bruta × (1 / Churn Rate mensal) |
| LTV/CAC | LTV / CAC — deve ser ≥ 3 para saúde do negócio |
| Payback Period | CAC / (ARPU × Margem Bruta) — meses para recuperar o CAC |

---

## 8. Gatilhos e Alertas Operacionais

| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-PA-01 | Qualquer KPI primário (PA-01 a PA-13) cai >20% vs. meta por 1 mês | Alerta para liderança + análise de causa raiz obrigatória | Responsável de Performance |
| ALT-PA-02 | Pipeline < 2× meta de fechamento | Convocação de reunião emergencial de pipeline | Gerente Comercial |
| ALT-PA-03 | Forecast desvio >15% vs. realizado por 2 meses | Revisão da metodologia de forecast | Responsável de Performance |
| ALT-PA-04 | LTV/CAC cai abaixo de 2 | Alerta crítico para liderança — revisão de estratégia | Liderança |
| ALT-PA-05 | Reunião de performance não realizada em prazo | Alerta para gerente com cobrança de reagendamento | Sistema |
| ALT-PA-06 | Desvio crítico sem plano de ação em >5 dias úteis | Escalonamento para liderança | Sistema |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

### 9.1 Framework de Diagnóstico Sistêmico

Para qualquer desvio de KPI nível PA, seguir:

```
1. IDENTIFICAR: Qual KPI está desviando? Em quanto? Desde quando?
2. ISOLAR: É um problema de todo o Núcleo ou de um módulo específico?
3. DECOMPOR: Decompor o KPI nos seus componentes elementares
4. RASTREAR: Qual módulo é a fonte primária do desvio?
5. DIAGNOSTICAR: Aplicar 5 Whys no módulo responsável
6. DECIDIR: Escolher plano de ação com evidência, não intuição
7. REGISTRAR: DECISION_LOG com diagnóstico + ação + responsável + prazo
```

### 9.2 Mapa de Desvios Estratégicos

| Desvio de KPI | Módulos a Investigar Primeiro |
|---------------|------------------------------|
| MRR abaixo da meta | CAP-03 (win rate), CAP-04 (churn), CAP-02 (volume de SQLs) |
| NRR abaixo de 100% | CAP-04 (churn MRR), CAP-05 (health score, expansão) |
| CAC alto | CAP-02 (CPL, eficiência de qualificação), CAP-03 (ciclo longo) |
| LTV/CAC < 3 | CAP-05 (retenção, tempo de vida), CAP-06 (ticket médio, margem) |
| Win Rate baixo | CAP-01 (qualidade da inteligência), CAP-03 (processo), CAP-06 (preço) |
| Pipeline baixo | CAP-02 (geração de demanda), CAP-07 (capacidade da equipe) |

---

## 10. Planos de Ação Padronizados

### PA-PA-01: MRR Abaixo da Meta por 2 Meses Consecutivos
```
Semana 1: Decomposição do MRR bridge — qual componente é o problema?
  → Se New MRR baixo: investigar CAP-02 e CAP-03
  → Se Churn alto: investigar CAP-04 e CAP-05
  → Se Expansion baixo: investigar CAP-05
Semana 2: Diagnóstico aprofundado no módulo responsável
Semana 3: Plano de ação específico + responsável + prazo
Semana 4: Inicio da execução + monitoramento semanal
```

### PA-PA-02: LTV/CAC Caindo Abaixo de 3
```
Semana 1: Recalcular CAC e LTV com dados atualizados
Semana 2: Identificar se é problema de custo de aquisição (CAC alto) ou retenção/expansão (LTV baixo)
Semana 3:
  → CAC alto: revisar eficiência de canais (CAP-02) + ciclo de vendas (CAP-03)
  → LTV baixo: revisar churn (CAP-05) + ticket médio (CAP-06) + margens (CAP-06)
Semana 4: Plano de ação aprovado pela liderança com métricas de controle
```

### PA-PA-03: Ritmo Operacional Quebrado (Reuniões não realizadas)
```
Imediato: Identificar por que a reunião não aconteceu
Semana 1: Reagendar + reforçar compromisso com a cadência
Paralelo: Verificar se é problema estrutural (agenda sobrecarregada, sem facilitador)
Solução: Designar facilitador fixo; blocar agenda como recorrente inamovível
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Semanal (Auto — Dashboard)
**Checklist:**
- [ ] Dashboard atualizado com dados do dia anterior
- [ ] Pipeline Review realizado
- [ ] Alertas ativos monitorados e tratados

### 11.2 Auditoria Mensal (Gerente + Liderança)
**Checklist:**
- [ ] Todos os KPIs do scorecard calculados e publicados
- [ ] Reunião mensal de performance realizada na cadência definida
- [ ] Desvios identificados têm plano de ação documentado
- [ ] DECISION_LOG atualizado com decisões do mês
- [ ] Metas do próximo mês comunicadas a todos os módulos

### 11.3 Auditoria Trimestral (Liderança + Conselho)
**Checklist:**
- [ ] Business Review realizado com todos os stakeholders relevantes
- [ ] Retrospectiva documentada
- [ ] Metas do próximo trimestre definidas com base em dados
- [ ] LTV/CAC calculado e avaliado
- [ ] Qualidade dos dados auditada (fontes, completude, confiabilidade)
- [ ] Processos do ritmo operacional avaliados (reuniões aconteceram? foram eficazes?)

### 11.4 Auditoria Anual (Conselho + Founders)
**Checklist:**
- [ ] Análise histórica de KPIs do ano completa
- [ ] Planejamento estratégico do Núcleo Comercial para o próximo ano aprovado
- [ ] Benchmarks de mercado atualizados
- [ ] Metas anuais definidas e comunicadas

---

## 12. Possibilidades de Automação

### 12.1 Coleta e Consolidação de Dados
| Automação | Trigger | Ação |
|-----------|---------|------|
| Coleta automática de KPIs do CRM | Diariamente | Atualiza dashboard com dados do dia anterior |
| Consolidação mensal | Dia 1 do mês | Gera rascunho do relatório mensal com dados dos módulos |
| Alertas de KPI | KPI cruza limite crítico | Notificação em tempo real para responsável |
| Forecast automático | Semanal | Atualiza revenue forecast com dados de pipeline |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Análise preditiva de performance | ML prevê atingimento de metas mensais com 2 semanas de antecedência |
| Diagnóstico automático de desvio | IA identifica qual módulo é a causa raiz de um desvio de KPI master |
| Geração de relatório | IA gera rascunho do relatório mensal com análise narrativa dos dados para revisão humana |
| Detecção de padrões sazonais | ML identifica sazonalidade histórica para calibrar metas com mais precisão |

### 12.3 Dashboards Centrais
| Dashboard | Métricas | Público | Frequência |
|-----------|---------|---------|-----------|
| Executive Scorecard | Todos os KPIs PA-01 a PA-13 | Liderança + Conselho | Tempo real |
| Commercial Operations | Pipeline, win rate, ciclo, equipe | Gerente Comercial | Tempo real |
| Revenue Intelligence | MRR bridge, NRR, forecast, churn | Liderança + Financeiro | Tempo real |
| Customer Health | Health score, NPS, churn, expansion | Liderança + CS | Mensal |

### 12.4 Integrações do Hub de Performance
```
CRM → CAP-08: dados de oportunidades, win/loss, pipeline (automático)
CAP-04 → CAP-08: MRR, NRR, ARR, churn (mensal automático)
CAP-05 → CAP-08: health score, NPS, churn de clientes (mensal)
CAP-07 → CAP-08: atingimento individual, headcount (mensal)
CAP-08 → Todos: metas, KPIs consolidados, alertas (contínuo)
```

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 CAP-08 como Hub Central

```
                          ┌─────────────────────┐
    CAP-01 ──────────────►│                     │
    CAP-02 ──────────────►│      CAP-08         │
    CAP-03 ──────────────►│  Performance e      │
    CAP-04 ──────────────►│  Autogestão         │◄──── Liderança / Conselho
    CAP-05 ──────────────►│                     │
    CAP-06 ──────────────►│  (Hub de Dados +    │
    CAP-07 ──────────────►│   Centro de Decisão)│
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
               Metas p/           Alertas         Relatórios
               todos os         para todos        para todos
               módulos          os módulos        os stakeholders
```

### 13.2 Matriz de Interfaces

| Módulo | CAP-08 Fornece | CAP-08 Recebe |
|--------|----------------|---------------|
| CAP-01 | Metas de win rate, ICP adherence | KPIs de IC (cobertura, win rate) |
| CAP-02 | Metas de volume de SQLs, CPL | KPIs de demanda (volume, conversão, CPL) |
| CAP-03 | Metas de win rate, ciclo, ticket | KPIs de vendas (win rate, ciclo, new MRR) |
| CAP-04 | Metas de MRR, NRR, churn | KPIs de receita (MRR, ARR, NRR, forecast) |
| CAP-05 | Metas de churn, NPS, expansion | KPIs de clientes (health, NPS, churn, expansion) |
| CAP-06 | Metas de ticket médio, margem | KPIs de oferta (ticket médio, margem, desconto) |
| CAP-07 | Metas individuais e de equipe | KPIs de equipe (quota, headcount, turnover) |

### 13.3 Protocolo de Escalação de Decisões
```
Nível 1 (Gerente Comercial): Decisões táticas de KPIs de módulos individuais
Nível 2 (Liderança Comercial): Decisões que afetam múltiplos módulos ou metas
Nível 3 (Conselho/Founders): Decisões que afetam a estratégia do Núcleo Comercial
```
Toda decisão ≥ Nível 2 DEVE ser registrada no DECISION_LOG.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-08 |
