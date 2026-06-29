---
id: MOD-CAP-08
titulo: "CAP-08 — Performance e Autogestão"
versao: "2.0.0"
status: aprovado
categoria: Commercial-OS-Module
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-29
dependencias:
  - ARC-ENG-000
  - ARC-ENG-002
  - ARC-ENG-003
  - ARC-ENG-006
  - ARC-ENG-009
  - MOD-CAP-01
  - MOD-CAP-02
  - MOD-CAP-03
  - MOD-CAP-04
  - MOD-CAP-05
  - MOD-CAP-06
  - MOD-CAP-07
  - MOD-CAP-09
tags: [commercial-os, cap-08, performance, okr, scorecard, ritmo-operacional, autogestao, forecast, decisao]
---

# CAP-08 — Performance e Autogestão

> **Módulo do Commercial Operating System**
> Infraestrutura compartilhada: `docs/02-architecture/engine-autogestao/`
> Contrato de integração: `ENGINE-CONTRATO-DE-INTEGRACAO.md` (ARC-ENG-099)

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| **ID do Módulo** | CAP-08 |
| **Nome** | Performance e Autogestão |
| **Domínio** | Orquestração e Inteligência Executiva do Commercial OS |
| **Versão** | 2.0.0 |
| **Tier** | Meta-módulo — agrega e orquestra todos os outros |
| **Posição na cadeia** | Downstream de todos os módulos; upstream de decisões estratégicas |
| **Registro na Engine** | `ENGINE-REGISTRATION.yaml` (seção 16) |

---

## 2. Objetivo

Ser o **painel de controle e o ritmo operacional** do Commercial OS — consolidando a visão unificada de performance de todos os módulos, estabelecendo o ciclo de gestão (reuniões, dashboards, revisões), gerenciando metas e OKRs do núcleo comercial, e garantindo que o sistema seja capaz de se auto-regular com mínima intervenção humana.

O CAP-08 não gera leads, não vende, não retém. Ele garante que todos os módulos que fazem essas coisas estejam **calibrados, coordenados e funcionando como um sistema coerente**. Quando um módulo desvia, CAP-08 detecta, diagnostica (via ENG-04) e coordena a correção. É o sistema nervoso central do Commercial OS.

---

## 3. Escopo

### 3.1 Dentro do Escopo
- Definição e gestão de metas do núcleo comercial (OKRs, metas de receita, metas de KPI)
- Dashboard consolidado de performance (todos os módulos em uma visão)
- Ritmo operacional: daily, weekly, monthly, quarterly, annual
- Revisão de performance e tomada de decisão baseada em dados
- Gestão de OKRs trimestrais do núcleo comercial
- Registro de decisões estratégicas no DECISION_LOG (ENG-09)
- Publicação de metas para todos os módulos
- Identificação de desvios sistêmicos e coordenação de planos de correção
- Relatório executivo do Commercial OS

### 3.2 Fora do Escopo
- Execução dos processos dos módulos individuais
- Análise detalhada de causa raiz → ENG-04
- Planos de ação detalhados → ENG-05

---

## 4. Responsabilidades

| # | Responsabilidade | Frequência |
|---|-----------------|-----------|
| R-01 | Manter e publicar metas do núcleo comercial | Por planejamento |
| R-02 | Consolidar KPIs de todos os módulos em dashboard único | Tempo real |
| R-03 | Conduzir o ritmo operacional (daily, weekly, monthly, QBR, annual) | Por cadência |
| R-04 | Identificar desvios de meta e coordenar diagnóstico e correção | Por desvio detectado |
| R-05 | Registrar decisões no DECISION_LOG da ENG-09 | Por decisão |
| R-06 | Produzir relatório executivo mensal e trimestral | Mensal/Trimestral |
| R-07 | Publicar metas atualizadas para os módulos quando houver revisão | Por mudança |
| R-08 | Monitorar saúde global do Commercial OS (todos os KPIs críticos) | Contínuo |

---

## 5. Capacidades Internas

### CAP-08.1 — Estrutura de Metas do Núcleo Comercial

```yaml
meta_structure:
  ciclo: "anual com revisão trimestral"

  meta_nivel_1:  # Meta máster
    mrr_alvo_ano: 0.0
    arr_alvo_ano: 0.0
    nrr_alvo: 100  # percentual

  meta_nivel_2:  # Por módulo
    CAP-02:
      sqls_mes: 0
      cobertura_pipeline: 3.0
    CAP-03:
      taxa_conversao_sql_ganho: 0.0
      ticket_medio: 0.0
      ciclo_medio_dias: 0
    CAP-04:
      mrr_churn_rate: 0.02
      inadimplencia: 0.03
    CAP-05:
      churn_rate: 0.02
      nps: 40
      expansion_mrr_rate: 0.05

  okr_trimestral:
    objetivo: "texto do objetivo"
    key_results:
      - descricao: "KR1"
        metrica_ref: "KPI-ID"
        valor_atual: null
        valor_alvo: null
        prazo: "data"
        status: "nao_iniciado | em_andamento | atingido | atrasado"
```

### CAP-08.2 — Dashboard de Performance

O dashboard consolida os KPIs mais críticos de todos os módulos em tempo real.

**KPIs primários do Commercial OS (para o dashboard):**
```yaml
dashboard_kpis:
  saude_receita:
    - KPI-RV-01  # MRR
    - KPI-RV-07  # NRR
    - KPI-RV-06  # MRR Churn Rate

  saude_aquisicao:
    - KPI-DM-06  # Cobertura de pipeline
    - KPI-VP-01  # Taxa de conversão SQL→Ganho
    - KPI-VP-02  # Ciclo médio de venda

  saude_clientes:
    - KPI-CS-01  # Churn Rate
    - KPI-CS-06  # Distribuição Health Score
    - KPI-CS-04  # NPS

  saude_equipe:
    - KPI-EC-02  # Utilização de capacidade
    - KPI-EC-05  # Performance média do time

  metricas_financeiras_avancadas:
    - KPI-PA-CAC: "Custo de Aquisição de Cliente = total_investimento_comercial / novos_clientes"
    - KPI-PA-LTV: "Lifetime Value = ticket_medio * margem * (1 / churn_rate)"
    - KPI-PA-LTVCAC: "LTV/CAC ratio = LTV / CAC"
    - KPI-PA-PAYBACK: "Meses para recuperar CAC = CAC / MRR_médio_por_cliente"
```

### CAP-08.3 — Ritmo Operacional

O ritmo operacional é o conjunto de cadências que mantém o sistema auto-regulado.

```yaml
ritmo_operacional:
  daily:
    nome: "Daily Comercial"
    duracao_minutos: 15
    participantes: ["time comercial"]
    pauta:
      - "O que fechei ontem?"
      - "O que farei hoje?"
      - "Há algum bloqueio?"
    metricas_de_referencia: ["pipeline do dia", "SQLs do dia", "SLA violações"]

  weekly:
    nome: "Pipeline Review"
    duracao_minutos: 60
    participantes: ["time comercial", "gestores"]
    pauta:
      - "Revisão de forecast vs. meta da semana"
      - "Oportunidades paradas: decidir ou encerrar"
      - "Pipeline de entrada: volume e qualidade"
      - "Alertas da semana: o que precisa de atenção?"
    metricas_de_referencia: ["KPI-DM-06", "KPI-VP-04", "forecast.atualizado"]

  monthly:
    nome: "Monthly Performance Review"
    duracao_minutos: 120
    participantes: ["gestores", "liderança"]
    pauta:
      - "Fechamento do mês: MRR, NRR, Churn"
      - "Performance por módulo vs. meta"
      - "Desvios identificados: diagnóstico e planos"
      - "OKRs: status e riscos"
      - "Decisões do mês que precisam de registro"
    metricas_de_referencia: ["todos os KPIs críticos do dashboard"]
    output: "relatório mensal + DECISION_LOG atualizado"

  quarterly:
    nome: "Quarterly Business Review (QBR)"
    duracao_minutos: 180
    participantes: ["liderança", "stakeholders"]
    pauta:
      - "Retrospectiva do trimestre (ENG-09)"
      - "OKRs do trimestre: atingidos/parciais/perdidos"
      - "Definição de OKRs do próximo trimestre"
      - "Revisão de ICP e segmentação (CAP-01)"
      - "Revisão de metas para o próximo período"
    output: "novos OKRs + metas revisadas + DECISION_LOG"

  annual:
    nome: "Planejamento Anual Comercial"
    duracao_horas: 8
    participantes: ["liderança", "heads de cada módulo"]
    pauta:
      - "Retrospectiva do ano (ENG-09)"
      - "Revisão de ICP e estratégia go-to-market"
      - "Definição de metas anuais por módulo"
      - "Revisão de estrutura de pricing (CAP-06)"
      - "Plano de capacidade do time (CAP-07)"
      - "Revisão de portfólio de parceiros (CAP-09)"
    output: "metas anuais + OKRs Q1 + plano de headcount"
```

### CAP-08.4 — Métricas Financeiras Avançadas

| ID | Métrica | Fórmula | Interpretação |
|----|---------|---------|--------------|
| KPI-PA-01 | CAC | `total_custo_comercial / novos_clientes` | Quanto custa adquirir um cliente |
| KPI-PA-02 | LTV | `ticket_medio × margem_bruta / churn_rate` | Quanto um cliente gera ao longo da vida |
| KPI-PA-03 | LTV/CAC | `LTV / CAC` | Meta: ≥ 3× (viabilidade do modelo) |
| KPI-PA-04 | Payback Period | `CAC / mrr_medio_por_cliente` | Meses para recuperar o investimento |
| KPI-PA-05 | Burn Multiple | `queima_de_caixa / new_arr` | Eficiência de crescimento (early stage) |
| KPI-PA-06 | Rule of 40 | `crescimento_arr% + margem_ebitda%` | Saúde geral do negócio |

---

## 6. Fluxo Operacional

```
[FLUXO A — RITMO SEMANAL AUTOMÁTICO]

[TRIGGER: sistema.periodo_encerrado (semanal)]
│
├─► Consolidar KPIs da semana (via ENG-02):
│   ├─ Cobertura de pipeline (KPI-DM-06)
│   ├─ SQLs gerados vs. meta
│   ├─ Forecast atualizado (KPI-VP forecast)
│   ├─ SLA violations (KPI-DM-07)
│   └─ Health Scores da base (KPI-CS-06)
│
├─► Identificar desvios vs. meta e alertas críticos ativos
│
├─► Gerar relatório de pipeline review automático
│
└─► Publicar: performance.relatorio_semanal
    └─► Notificar gestores com link para o relatório


[FLUXO B — REVISÃO MENSAL]

[TRIGGER: sistema.periodo_encerrado (mensal)]
│
├─► Consolidar todos os KPIs do mês (todos os módulos via ENG-02)
│
├─► Comparar vs. metas e OKRs:
│   ├─► KPIs dentro da meta → registrar como positivo
│   └─► KPIs fora da meta → solicitar diagnóstico via ENG-04
│
├─► Calcular métricas avançadas: CAC, LTV, LTV/CAC, Payback
│
├─► Gerar relatório executivo mensal
│
├─► Identificar decisões a registrar no DECISION_LOG (ENG-09)
│
└─► Publicar: performance.relatorio_mensal
    └─► Distribuir para liderança e stakeholders


[FLUXO C — DESVIO DE META CRÍTICO]

[TRIGGER: kpi.limiar.cruzado de qualquer módulo com severidade CRITICAL]
│
├─► Classificar o desvio: qual módulo, qual KPI, qual o desvio em relação à meta
│
├─► Solicitar diagnóstico via ENG-04:
│   └─► Qual a causa raiz? É pontual ou sistêmico?
│
├─► Baseado no diagnóstico:
│   ├─► Desvio pontual → responsável do módulo trata
│   ├─► Desvio sistêmico → coordenar plano de ação cross-módulo
│   └─► Desvio com impacto em meta anual → revisão de meta ou plano de recuperação
│
└─► Registrar diagnóstico e decisão no DECISION_LOG (ENG-09)


[FLUXO D — REVISÃO TRIMESTRAL DE METAS (QBR)]

[TRIGGER: sistema.periodo_encerrado (trimestral)]
│
├─► Preparar pauta do QBR com dados do trimestre
├─► OKRs do trimestre: calcular % de conclusão de cada KR
├─► Definir OKRs do próximo trimestre com base em:
│   ├─ Performance real do trimestre
│   ├─ Capacidade do time (CAP-07)
│   ├─ Pipeline disponível (CAP-02/CAP-03)
│   └─ Aprendizados da ENG-09
│
├─► Publicar metas do próximo trimestre
│   └─► Publicar: performance.metas_atualizadas → todos os módulos recebem
│
└─► Registrar OKRs aprovados no DECISION_LOG
```

---

## 7. Estados

### 7.1 Estados dos OKRs

```
NAO_INICIADO → EM_ANDAMENTO → ATINGIDO | PARCIALMENTE_ATINGIDO | NAO_ATINGIDO
```

### 7.2 Estados das Metas

```
PROPOSTA → APROVADA → VIGENTE → EM_REVISAO → REVISADA | ENCERRADA
```

---

## 8. Regras de Negócio

### RN-01 — Uma Meta de MRR é a Referência de Todos os Módulos
O MRR alvo do período é a referência que todos os módulos usam para dimensionar suas metas derivadas. Toda meta derivada (SQLs, cobertura de pipeline, conversão, churn) deve ser coerente com a meta de MRR. Metas incoerentes geram expectativas impossíveis.

### RN-02 — OKRs Trimestrais São Imutáveis Durante o Trimestre
OKRs aprovados no início do trimestre não podem ser alterados durante o trimestre — exceto em caso de mudança material do contexto externo (crise de mercado, mudança regulatória). Alteração de OKR sem evidência sólida é ilusão de gestão. Ao final do trimestre, OKRs são avaliados honestamente — não ajustados retroativamente.

### RN-03 — Decisões Nível 2+ São Registradas no DECISION_LOG
Toda decisão que afeta metas, estrutura de produto, política comercial ou definição estratégica (nível 2 ou acima) DEVE ser registrada no DECISION_LOG da ENG-09. Decisões operacionais rotineiras (nível 1) não precisam de registro. O DECISION_LOG é o repositório de decisões importantes do Commercial OS.

### RN-04 — LTV/CAC ≥ 3 É a Viabilidade do Modelo
O ratio LTV/CAC abaixo de 3 indica modelo comercial insustentável — o custo de aquisição supera o retorno ao longo da vida do cliente. Qualquer LTV/CAC < 3 por 2 trimestres consecutivos exige revisão estrutural: pricing, custo de aquisição, churn, ou ticket médio.

### RN-05 — Ritmo Operacional Não É Opcional
As cadências do ritmo operacional (daily, weekly, monthly, quarterly, annual) são parte do contrato operacional do Commercial OS. Cadências não executadas são não-conformidades registradas pela ENG-06. O sistema que não se reúne para revisar perde sua capacidade de auto-regulação.

### RN-06 — Relatórios São Baseados em Dados, Não em Percepção
Todo relatório produzido pelo CAP-08 é baseado em KPIs calculados pela ENG-02 — não em percepções subjetivas. Dados divergentes entre o relatório e a percepção da equipe devem ser investigados: ou o KPI está errado, ou a percepção está errada. Nunca substituir o dado pela percepção.

---

## 9. Eventos Publicados

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `performance.metas_atualizadas` | Novas metas aprovadas para o período | `{periodo, meta_mrr, meta_por_modulo_json, okrs_json}` |
| `performance.relatorio_semanal` | Pipeline review semanal gerado | `{semana, kpis_criticos_json, desvios[], alertas_ativos[]}` |
| `performance.relatorio_mensal` | Relatório mensal consolidado gerado | `{mes, todos_kpis_json, cac, ltv, ltvcac, payback, okrs_status_json}` |
| `performance.relatorio_trimestral` | QBR concluído | `{trimestre, okrs_resultado_json, metas_proximo_trimestre_json, decisoes_registradas[]}` |
| `performance.desvio_critico_detectado` | KPI crítico fora da meta por 2+ períodos | `{kpi_id, modulo, valor_atual, meta, desvio_percentual, periodos_fora}` |
| `performance.okr.atualizado` | Status de OKR atualizado | `{okr_id, key_result_id, valor_anterior, valor_atual, status}` |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `kpi.limiar.cruzado` | ENG-02 (de qualquer módulo) | Registrar desvio; avaliar se requer diagnóstico ou revisão de meta |
| `kpi.valor.calculado` | ENG-02 | Atualizar dashboard em tempo real |
| `forecast.atualizado` | CAP-03 | Incorporar no dashboard; comparar com meta de MRR |
| `receita.mrr_bridge.calculado` | CAP-04 | Atualizar KPI-PA-01 a KPI-PA-06 |
| `melhoria.retrospectiva.concluida` | ENG-09 | Incorporar aprendizados no planejamento |
| `sistema.periodo_encerrado` | Scheduler | Disparar geração de relatório (semanal, mensal, trimestral, anual) |
| `equipe.capacidade_insuficiente` | CAP-07 | Avaliar impacto nas metas; considerar ajuste de meta ou contratação |

---

## 11. KPIs

> O CAP-08 monitora os KPIs de todos os módulos. KPIs próprios do módulo:

| ID | Nome | Fórmula | Meta | Frequência |
|----|------|---------|------|-----------|
| KPI-PA-01 | CAC | `custo_comercial_total / novos_clientes` | Tendência decrescente | Mensal |
| KPI-PA-02 | LTV | `ticket_medio × margem_bruta / churn_rate_anual` | Tendência crescente | Mensal |
| KPI-PA-03 | LTV/CAC | `LTV / CAC` | ≥ 3× | Mensal |
| KPI-PA-04 | Payback Period | `CAC / mrr_medio_por_cliente` | ≤ 18 meses | Mensal |
| KPI-PA-05 | Rule of 40 | `crescimento_arr_percentual + margem_ebitda_percentual` | ≥ 40 | Trimestral |
| KPI-PA-06 | % OKRs Atingidos | `key_results_atingidos / total_key_results × 100` | ≥ 70% | Trimestral |
| KPI-PA-07 | Aderência ao Ritmo Operacional | `cadencias_executadas / cadencias_programadas × 100` | 100% | Mensal |
| KPI-PA-08 | Desvios Críticos Não Resolvidos | `alertas_critical_abertos > 30 dias` | Zero | Mensal |

---

## 12. Alertas

| ID | Condição | Severidade | Ação |
|----|---------|-----------|------|
| ALT-PA-01 | LTV/CAC < 3 por 2 trimestres | CRITICAL | Revisão estrutural do modelo comercial |
| ALT-PA-02 | Payback Period > 24 meses | WARNING | Revisar CAC ou churn |
| ALT-PA-03 | % OKRs atingidos < 40% ao final do trimestre | WARNING | Retrospectiva de OKRs; revisar metodologia de definição |
| ALT-PA-04 | Cadência de ritmo operacional não executada | WARNING | NC no ENG-06; reagendar imediatamente |
| ALT-PA-05 | Alerta crítico aberto há > 30 dias sem plano de ação | CRITICAL | Escalar para liderança; plano de ação obrigatório |
| ALT-PA-06 | MRR com crescimento < 0% por 2 meses (negativo) | CRITICAL | Reunião emergencial; revisão completa do sistema |

---

## 13. Planos de Ação Automáticos

### PA-PA-01 — LTV/CAC Abaixo de 3 (Gatilho: ALT-PA-01)
```yaml
plano_acao:
  tipo: revisao_estrutural
  prazo_dias: 45
  tarefas:
    - "Decompor: LTV/CAC < 3 vem de CAC alto, LTV baixo, ou ambos?"
    - "Se CAC alto: revisar eficiência dos canais de aquisição (CAP-02); comparar CPL por canal"
    - "Se LTV baixo: revisar churn (CAP-05) ou ticket médio (CAP-06)"
    - "Modelar: qual alavanca tem maior impacto? (análise de sensibilidade)"
    - "Propor e aprovar plano de melhoria específico para a alavanca identificada"
    - "Registrar decisão no DECISION_LOG"
  metrica_sucesso: "LTV/CAC ≥ 3 em 2 trimestres"
```

---

## 14. Automações

| ID | Trigger | Ação Automatizada | Conector |
|----|---------|-----------------|---------|
| AUT-PA-01 | `sistema.periodo_encerrado` (semanal) | Consolidar KPIs; gerar relatório semanal; distribuir para gestores | ENG-02, CONN-EMAIL-TRANSACIONAL |
| AUT-PA-02 | `sistema.periodo_encerrado` (mensal) | Consolidar todos os KPIs; calcular métricas avançadas; gerar relatório mensal | ENG-02, CONN-EMAIL-TRANSACIONAL |
| AUT-PA-03 | `sistema.periodo_encerrado` (trimestral) | Calcular % OKRs; preparar pauta QBR; atualizar status dos OKRs | ENG-02, CONN-MENSAGERIA |
| AUT-PA-04 | `kpi.limiar.cruzado` (severidade CRITICAL) | Registrar desvio; solicitar diagnóstico ENG-04; notificar liderança | ENG-04, CONN-MENSAGERIA |
| AUT-PA-05 | `receita.mrr_bridge.calculado` | Calcular CAC, LTV, LTV/CAC, Payback; atualizar dashboard | ENG-02 |

---

## 15. Auditoria Operacional

### Checklist Mensal — CAP-08-AUD-MENSAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Todas as cadências do mês executadas | KPI-PA-07 | 100% |
| 2 | Relatório mensal gerado e distribuído | Evento `performance.relatorio_mensal` | Registro e confirmação de entrega |
| 3 | Desvios críticos com plano de ação ativo | KPI-PA-08 | Zero alertas críticos > 30 dias sem plano |
| 4 | DECISION_LOG atualizado com decisões do mês | ENG-09 | Registros do período |
| 5 | LTV/CAC calculado e dentro do limite | KPI-PA-03 | ≥ 3 |
| 6 | OKRs com status atualizado | Status dos OKRs | 100% atualizados |

### Checklist Trimestral — CAP-08-AUD-TRIMESTRAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | QBR realizado com pauta e output documentados | Ata do QBR | Documento datado |
| 2 | OKRs do trimestre avaliados honestamente | Relatório de OKRs | % atingido calculado |
| 3 | OKRs do próximo trimestre definidos e publicados | Evento `performance.metas_atualizadas` | Evento registrado |
| 4 | Todos os módulos receberam metas atualizadas | Log de eventos recebidos por módulo | 100% dos módulos |

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml — CAP-08 Performance e Autogestão
# Ref: ARC-ENG-099

modulo:
  id: "CAP-08"
  nome: "Performance e Autogestão"
  versao: "2.0.0"
  tier: "meta-modulo"
  status: "ativo"

dependencias:
  modulos:
    - id: "CAP-01"
      uso: "dados de win rate, market intelligence para planejamento"
    - id: "CAP-02"
      uso: "KPIs de geração de demanda e pipeline"
    - id: "CAP-03"
      uso: "forecast de receita, win rate, ciclo de venda"
    - id: "CAP-04"
      uso: "MRR Bridge, NRR, receita realizada"
    - id: "CAP-05"
      uso: "churn rate, NPS, health score da base"
    - id: "CAP-06"
      uso: "mix de produto, ticket médio, margem"
    - id: "CAP-07"
      uso: "capacidade do time, performance individual"
    - id: "CAP-09"
      uso: "receita de canais e parceiros"
  engines:
    - id: "ENG-02"
      uso: "consolidação de todos os KPIs do sistema; cálculo de métricas avançadas"
    - id: "ENG-03"
      uso: "alertas ALT-PA-01 a ALT-PA-06"
    - id: "ENG-04"
      uso: "diagnóstico de desvios críticos"
    - id: "ENG-06"
      uso: "auditoria de ritmo operacional e do módulo"
    - id: "ENG-09"
      uso: "DECISION_LOG; retrospectivas; melhoria contínua do sistema"

eventos_publicados:
  - evento: "performance.metas_atualizadas"
    condicao: "novas metas aprovadas"
  - evento: "performance.relatorio_semanal"
    condicao: "pipeline review semanal gerado"
  - evento: "performance.relatorio_mensal"
    condicao: "relatório mensal consolidado"
  - evento: "performance.relatorio_trimestral"
    condicao: "QBR concluído"
  - evento: "performance.desvio_critico_detectado"
    condicao: "KPI crítico fora da meta por 2+ períodos"
  - evento: "performance.okr.atualizado"
    condicao: "status de OKR atualizado"

eventos_consumidos:
  - evento: "kpi.limiar.cruzado"
    origem: "ENG-02"
    acao: "registrar desvio; avaliar diagnóstico ou revisão de meta"
  - evento: "kpi.valor.calculado"
    origem: "ENG-02"
    acao: "atualizar dashboard em tempo real"
  - evento: "forecast.atualizado"
    origem: "CAP-03"
    acao: "incorporar no dashboard; comparar com meta"
  - evento: "receita.mrr_bridge.calculado"
    origem: "CAP-04"
    acao: "calcular métricas avançadas (CAC, LTV, LTV/CAC, Payback)"
  - evento: "melhoria.retrospectiva.concluida"
    origem: "ENG-09"
    acao: "incorporar aprendizados no planejamento"
  - evento: "sistema.periodo_encerrado"
    origem: "Scheduler"
    acao: "disparar geração de relatórios por frequência"
  - evento: "equipe.capacidade_insuficiente"
    origem: "CAP-07"
    acao: "avaliar impacto nas metas; considerar ajuste ou contratação"

kpis_registrados:
  - id: "KPI-PA-01"
    nome: "CAC"
    formula: "custo_comercial_total / novos_clientes"
    unidade: "moeda"
    frequencia_calculo: "mensal"
  - id: "KPI-PA-02"
    nome: "LTV"
    formula: "ticket_medio * margem_bruta / churn_rate_anual"
    unidade: "moeda"
    frequencia_calculo: "mensal"
  - id: "KPI-PA-03"
    nome: "LTV/CAC"
    formula: "LTV / CAC"
    unidade: "multiplicador"
    frequencia_calculo: "mensal"
    meta_padrao: 3.0
    limiar_warning: 2.5
    limiar_critical: 2.0
  - id: "KPI-PA-04"
    nome: "Payback Period"
    formula: "CAC / mrr_medio_por_cliente"
    unidade: "meses"
    frequencia_calculo: "mensal"
    meta_padrao: 18
    limiar_warning: 24
  - id: "KPI-PA-05"
    nome: "Rule of 40"
    formula: "crescimento_arr_pct + margem_ebitda_pct"
    unidade: "pontos"
    frequencia_calculo: "trimestral"
    meta_padrao: 40
  - id: "KPI-PA-06"
    nome: "% OKRs Atingidos"
    formula: "key_results_atingidos / total_key_results * 100"
    unidade: "percentual"
    frequencia_calculo: "trimestral"
    meta_padrao: 70
  - id: "KPI-PA-07"
    nome: "Aderência ao Ritmo Operacional"
    formula: "cadencias_executadas / cadencias_programadas * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 100
    limiar_critical: 90
  - id: "KPI-PA-08"
    nome: "Desvios Críticos Não Resolvidos"
    formula: "count(alertas_critical_abertos > 30 dias)"
    unidade: "quantidade"
    frequencia_calculo: "mensal"
    meta_padrao: 0

alertas_registrados:
  - id: "ALT-PA-01"
    kpi_ref: "KPI-PA-03"
    condicao: "< 3 por 2 trimestres consecutivos"
    severidade: "critical"
    owner: "diretoria"
  - id: "ALT-PA-02"
    kpi_ref: "KPI-PA-04"
    condicao: "> 24"
    severidade: "warning"
    owner: "gestor_comercial"
  - id: "ALT-PA-03"
    kpi_ref: "KPI-PA-06"
    condicao: "< 40 ao final do trimestre"
    severidade: "warning"
    owner: "diretoria"
  - id: "ALT-PA-04"
    kpi_ref: "KPI-PA-07"
    condicao: "< 100"
    severidade: "warning"
    owner: "responsavel_cap08"
  - id: "ALT-PA-05"
    kpi_ref: "KPI-PA-08"
    condicao: "> 0"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-PA-06"
    kpi_ref: "KPI-RV-01"
    condicao: "crescimento_mensal < 0 por 2 meses"
    severidade: "critical"
    owner: "diretoria"

workflows_registrados:
  - id: "WF-PA-01"
    nome: "Relatório Semanal de Pipeline"
    gatilho: "sistema.periodo_encerrado (semanal)"
    descricao: "consolida KPIs, identifica desvios, gera e distribui relatório"
  - id: "WF-PA-02"
    nome: "Relatório Mensal de Performance"
    gatilho: "sistema.periodo_encerrado (mensal)"
    descricao: "consolida todos os KPIs, calcula métricas avançadas, gera relatório"
  - id: "WF-PA-03"
    nome: "Preparação e Follow-up do QBR"
    gatilho: "sistema.periodo_encerrado (trimestral)"
    descricao: "calcula OKRs, prepara pauta, publica metas do próximo trimestre"
  - id: "WF-PA-04"
    nome: "Escalonamento de Desvio Crítico"
    gatilho: "kpi.limiar.cruzado (severidade CRITICAL)"
    descricao: "registra desvio, solicita diagnóstico, notifica liderança"

auditoria_checklists:
  - id: "CAP-08-AUD-MENSAL"
    tipo: "mensal"
    itens_count: 6
  - id: "CAP-08-AUD-TRIMESTRAL"
    tipo: "trimestral"
    itens_count: 4

conectores_utilizados:
  - "CONN-EMAIL-TRANSACIONAL"
  - "CONN-MENSAGERIA"

permissoes_necessarias:
  - recurso: "metas_anuais"
    acoes: ["read", "write", "version"]
  - recurso: "okrs"
    acoes: ["read", "write"]
  - recurso: "dashboard_config"
    acoes: ["read", "write"]
  - recurso: "kpi_values.*"
    acoes: ["read"]
  - recurso: "kpi_values.KPI-PA-*"
    acoes: ["read", "write_via_eng02"]
  - recurso: "eventos_barramento"
    acoes: ["publish", "subscribe"]
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial |
| 2.0.0 | 2026-06-29 | Guardião da Documentação | Redesenho como meta-módulo do Commercial OS |
