---
id: MOD-CAP-07
titulo: "CAP-07 — Gestão da Equipe Comercial"
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
  - ARC-ENG-005
  - ARC-ENG-006
  - ARC-ENG-009
  - MOD-CAP-02
  - MOD-CAP-03
tags: [commercial-os, cap-07, equipe, headcount, ramp-up, comissao, coaching, capacidade, treinamento]
---

# CAP-07 — Gestão da Equipe Comercial

> **Módulo do Commercial Operating System**
> Infraestrutura compartilhada: `docs/02-architecture/engine-autogestao/`
> Contrato de integração: `ENGINE-CONTRATO-DE-INTEGRACAO.md` (ARC-ENG-099)

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| **ID do Módulo** | CAP-07 |
| **Nome** | Gestão da Equipe Comercial |
| **Domínio** | People Operations Comercial |
| **Versão** | 2.0.0 |
| **Tier** | Core |
| **Posição na cadeia** | Habilitador transversal — serve CAP-02, CAP-03, CAP-05, CAP-09 |
| **Registro na Engine** | `ENGINE-REGISTRATION.yaml` (seção 16) |

---

## 2. Objetivo

Garantir que o Commercial OS opere com a **capacidade, competência e motivação** corretas em todos os papéis comerciais — dimensionando o time de forma adequada às metas, acelerando o tempo de produtividade de novos membros e mantendo a performance individual dentro dos padrões esperados.

O CAP-07 trata o time comercial como um ativo gerenciado: não apenas contrata e demite, mas planeja capacidade, acelera ramp-up, mede performance individual, administra incentivos e executa intervenções de coaching antes que problemas se tornem irreversíveis.

---

## 3. Escopo

### 3.1 Dentro do Escopo
- Planejamento de capacidade do time (headcount vs. metas)
- Gestão do ciclo de ramp-up de novos membros
- Modelo de comissões e incentivos comerciais
- Acompanhamento de performance individual por papel
- Identificação de gaps de competência e coaching
- Planejamento de treinamentos e capacitações
- Gestão de turnover e impacto na operação

### 3.2 Fora do Escopo
- Contratação e demissão formal → RH/gestão
- Definição de metas → CAP-08
- Auditoria de processo de vendas → CAP-03
- Definição de ICP → CAP-01

---

## 4. Responsabilidades

| # | Responsabilidade | Frequência |
|---|-----------------|-----------|
| R-01 | Calcular capacidade necessária vs. headcount atual | Mensal |
| R-02 | Publicar `equipe.capacidade_insuficiente` quando headcount é insuficiente | Por cálculo |
| R-03 | Gerir ramp-up de novos membros com milestones e critérios | Por novo membro |
| R-04 | Calcular e comunicar comissões mensalmente | Mensal |
| R-05 | Monitorar performance individual e identificar low performers | Mensal |
| R-06 | Executar planos de coaching para membros abaixo da meta | Por identificação |
| R-07 | Planejar e executar treinamentos com base em gaps identificados | Trimestral |
| R-08 | Reportar impacto de turnover na capacidade operacional | Por saída |

---

## 5. Capacidades Internas

### CAP-07.1 — Planejamento de Capacidade

```yaml
capacidade_model:
  formula_headcount_necessario:
    descricao: "meta_sqls_mes / sqls_por_rep_mes / (1 - taxa_ramp)"
    variaveis:
      meta_sqls_mes: "de CAP-08 / CAP-02"
      sqls_por_rep_mes: "benchmark por papel em ramp completo"
      taxa_ramp: "percentual do time ainda em ramp-up"
      utilizacao_maxima: 0.80  # não usar 100% da capacidade

  papeis:
    - papel: "SDR"
      responsabilidade: "qualificação de leads (MQL → SQL)"
      capacidade_padrao: "X MQLs/mês → Y SQLs/mês"
      tempo_ramp_meses: 3

    - papel: "Executivo_de_Contas"
      responsabilidade: "condução do funil E1-E6"
      capacidade_padrao: "X SQLs/mês; Y pipeline simultâneo"
      tempo_ramp_meses: 6

    - papel: "CS"
      responsabilidade: "onboarding e retenção"
      capacidade_padrao: "X clientes por CS (ratio cliente:CS)"
      tempo_ramp_meses: 2

    - papel: "Gestor_Comercial"
      responsabilidade: "liderança e coaching do time"
      span_of_control: "6-8 ICs por gestor"
      tempo_ramp_meses: 3
```

### CAP-07.2 — Ramp-Up de Novos Membros

```yaml
ramp_up_plan:
  id: "RAMP-ID"
  membro_id: "MEMBRO-ID"
  papel: "SDR | Executivo_de_Contas | CS | Gestor"
  data_inicio: ""
  status: "em_ramp | concluido | em_risco | encerrado"

  milestones:
    - semana: 1
      descricao: "onboarding cultural e de processos"
      criterios: ["leu todos os playbooks", "entende o ICP", "conhece o produto"]

    - semana: 2
      descricao: "shadowing e certificação técnica"
      criterios: ["assistiu X demos", "passou na certificação de produto"]

    - mes: 1
      descricao: "primeiros resultados"
      criterios:
        SDR: ["X MQLs qualificados", "Y touchpoints de cadência executados"]
        Executivo: ["X reuniões de descoberta realizadas", "pipeline de R$Y aberto"]
        CS: ["X clientes mapeados", "Y kickoffs realizados"]

    - mes: 3
      descricao: "produtividade parcial (50%)"
      meta_percentual_da_meta_full: 50

    - mes: 6:  # ou conforme papel
      descricao: "ramp concluído — produtividade plena"
      meta_percentual_da_meta_full: 100
      criterio_encerramento_ramp: "atingiu 80% da meta em 2 meses consecutivos"
```

### CAP-07.3 — Modelo de Comissões

```yaml
comissao_model:
  principios:
    - "comissão é imutável após fechamento do mês — sem ajustes retroativos"
    - "calculada com base apenas em receita efetivamente faturada e paga"
    - "transparente: cada membro pode calcular sua própria comissão a qualquer momento"

  estrutura_padrao:
    base_calculo: "receita_nova_faturada_no_mes"
    percentual_base: null  # configurado por empresa/papel

    aceleradores:
      - condicao: "meta_100%_atingida"
        multiplicador: 1.0
      - condicao: "meta_110%_atingida"
        multiplicador: 1.25
      - condicao: "meta_125%_atingida"
        multiplicador: 1.5

    bonos_adicionais:
      - descricao: "bônus de produto estratégico"
        valor_adicional_por_contrato: null
      - descricao: "bônus de novo segmento"
        condicao: "primeiro contrato em segmento novo"

    claw_back:
      regra: "churn do cliente em < 90 dias → estorno de X% da comissão"
      percentual_estorno: null
```

### CAP-07.4 — Performance Individual

```yaml
performance_model:
  frequencia_avaliacao: "mensal"
  metricas_por_papel:
    SDR:
      - id: "KPI-EC-SDR-01"
        nome: "SQLs gerados no mês"
        peso: 0.50
      - id: "KPI-EC-SDR-02"
        nome: "SLA de primeiro contato atingido"
        peso: 0.20
      - id: "KPI-EC-SDR-03"
        nome: "Taxa de conversão MQL→SQL"
        peso: 0.30

    Executivo_de_Contas:
      - id: "KPI-EC-EA-01"
        nome: "Receita nova no mês"
        peso: 0.50
      - id: "KPI-EC-EA-02"
        nome: "Win rate"
        peso: 0.25
      - id: "KPI-EC-EA-03"
        nome: "Ciclo médio de venda"
        peso: 0.25

  classificacao:
    top_performer: "≥ 110% da meta"
    on_track: "90-110% da meta"
    below_target: "70-90% da meta"
    low_performer: "< 70% da meta por 2 meses"

  protocolo_low_performer:
    mes_1: "conversa de alinhamento com gestor"
    mes_2: "PIP (Performance Improvement Plan) formal"
    mes_3: "decisão: manter (com evidência de melhora) ou desligar"
```

---

## 6. Fluxo Operacional

```
[FLUXO A — AVALIAÇÃO MENSAL DE CAPACIDADE]

[TRIGGER: sistema.periodo_encerrado (mensal)]
│
├─► Coletar: meta de SQLs do período (de CAP-08 / CAP-02)
├─► Calcular: headcount necessário = meta / capacidade_por_rep / (1 - taxa_ramp)
├─► Comparar com headcount atual e em ramp
│
├─► Se headcount suficiente (utilização ≤ 80%): OK — monitorar
├─► Se headcount insuficiente (utilização > 80%):
│   ├─► Publicar: equipe.capacidade_insuficiente
│   └─► Criar item de ação para planejamento de contratação
└─► Atualizar KPI-EC-08 (utilização de capacidade)


[FLUXO B — RAMP-UP DE NOVO MEMBRO]

[TRIGGER: equipe.novo_membro_contratado]
│
├─► Criar plano de ramp-up (template por papel)
├─► Designar buddy/mentor
├─► Executar onboarding semana a semana (ENG-07 → milestones)
│
├─► [Para cada milestone]
│   ├─► Verificar critérios de conclusão
│   ├─► Milestone atrasado → notificar gestor
│   └─► Ramp concluído (80% da meta em 2 meses) → publicar: equipe.membro_em_producao
│
└─► Incluir membro no cálculo de capacidade como "em produção"


[FLUXO C — AVALIAÇÃO MENSAL DE PERFORMANCE]

[TRIGGER: sistema.periodo_encerrado (mensal)]
│
├─► Calcular performance de cada membro (KPIs por papel vs. meta)
├─► Classificar: top / on_track / below / low_performer
│
├─► Para low_performers (< 70% por 2 meses):
│   ├─► Publicar: equipe.low_performer_identificado
│   └─► Iniciar protocolo de PIP (plano de ação via ENG-05)
│
└─► Calcular comissões do mês → publicar: equipe.comissoes_calculadas


[FLUXO D — TREINAMENTO E COACHING]

[TRIGGER: gap de competência identificado OU solicitação do gestor]
│
├─► Identificar gap: individual (avaliação de performance) ou sistêmico (KPI de módulo)
├─► Planejar treinamento: formato, facilitador, conteúdo, data
├─► Executar e registrar participação
└─► Medir impacto após 30 dias: KPI melhorou?
```

---

## 7. Estados

### 7.1 Estados do Membro da Equipe

```
CONTRATADO → EM_RAMP → EM_PRODUCAO → [EM_PIP] → ATIVO | DESLIGADO
```

### 7.2 Estados do Plano de Ramp-Up

```
CRIADO → EM_ANDAMENTO → CONCLUIDO | EM_RISCO | INTERROMPIDO
```

### 7.3 Estados do PIP

```
CRIADO → EM_ANDAMENTO → APROVADO (membro recuperado) | ENCERRADO (desligamento)
```

---

## 8. Regras de Negócio

### RN-01 — Capacidade Máxima de 80%
O time comercial não deve operar acima de 80% da capacidade teórica. O excedente é reserva para variações, doença, férias e ramp-up. Utilização acima de 80% por 2 meses consecutivos aciona planejamento de contratação.

### RN-02 — Ramp-Up com Milestones Definidos por Papel
Todo novo membro tem plano de ramp-up formal com milestones e critérios de conclusão. Ramp sem plano formal é não-conformidade. O gestor é responsável pela execução do ramp-up do seu time.

### RN-03 — Comissão É Imutável Após Fechamento
A comissão do mês é calculada e comunicada até o dia 10 do mês seguinte. Após comunicada, não há ajuste retroativo — exceto para claw-back por churn em < 90 dias. A imutabilidade da comissão é fundamental para a confiança do time.

### RN-04 — Low Performer Tem Protocolo, Não Punição
Membro com < 70% da meta por 2 meses consecutivos não é desligado imediatamente. O protocolo é: conversa de alinhamento → PIP formal → decisão baseada em evidência. O objetivo é recuperar, não punir.

### RN-05 — Turnover É Calculado e Monitorado
O turnover do time comercial é KPI primário. Turnover de top performers é especialmente crítico. Todo desligamento tem motivo estruturado registrado.

### RN-06 — Span of Control Monitorado
O número de ICs por gestor é monitorado. Span of control acima de 8 por mais de 2 meses é alerta — gestores sobrecarregados têm menor qualidade de coaching, o que impacta performance do time.

---

## 9. Eventos Publicados

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `equipe.capacidade_insuficiente` | Headcount insuficiente para a meta | `{headcount_atual, headcount_necessario, deficit, utilizacao_atual}` |
| `equipe.novo_membro_contratado` | Novo membro registrado | `{membro_id, papel, data_inicio, gestor_id}` |
| `equipe.membro_em_producao` | Ramp-up concluído | `{membro_id, papel, duracao_ramp_dias, meta_atingida_percentual}` |
| `equipe.low_performer_identificado` | Membro < 70% por 2 meses | `{membro_id, papel, performance_percentual, meses_abaixo}` |
| `equipe.comissoes_calculadas` | Comissões do mês calculadas | `{periodo, total_comissoes, detalhes_por_membro_json}` |
| `equipe.membro_desligado` | Membro saiu do time | `{membro_id, papel, motivo_estruturado, tipo: voluntario\|involuntario, impacto_capacidade}` |
| `equipe.treinamento_concluido` | Treinamento realizado | `{treinamento_id, participantes[], tema, impacto_esperado}` |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `sistema.periodo_encerrado` | Scheduler (mensal) | Calcular capacidade, performance individual e comissões |
| `kpi.limiar.cruzado` | ENG-02 | Se KPI é de conversão ou ciclo de venda: identificar gap de competência |
| `melhoria.item.implementado` | ENG-09 | Revisar processos impactados |

---

## 11. KPIs

| ID | Nome | Fórmula | Meta | Frequência |
|----|------|---------|------|-----------|
| KPI-EC-01 | Headcount Atual vs. Necessário | `headcount_em_producao / headcount_necessario × 100` | ≥ 90% | Mensal |
| KPI-EC-02 | Utilização de Capacidade | `demanda_atual / capacidade_disponivel × 100` | ≤ 80% | Mensal |
| KPI-EC-03 | Tempo Médio de Ramp-Up | `média(dias_em_producao - data_contratacao)` | Por papel | Mensal |
| KPI-EC-04 | Taxa de Conclusão de Ramp no Prazo | `ramps_concluidos_no_prazo / total_ramps × 100` | ≥ 80% | Mensal |
| KPI-EC-05 | Performance Média do Time | `média(performance_individual_percentual)` | ≥ 90% da meta | Mensal |
| KPI-EC-06 | Percentual de Low Performers | `low_performers / total_time × 100` | < 10% | Mensal |
| KPI-EC-07 | Turnover Anualizado | `saidas_12m / headcount_medio × 100` | < 15% | Mensal |
| KPI-EC-08 | Turnover de Top Performers | `saidas_top / total_top × 100` | < 5% | Anual |
| KPI-EC-09 | Span of Control | `ics_por_gestor` | 6-8 | Mensal |
| KPI-EC-10 | % do Time Acima da Meta | `membros_acima_meta / total_time × 100` | > 60% | Mensal |

---

## 12. Alertas

| ID | Condição | Severidade | Ação |
|----|---------|-----------|------|
| ALT-EC-01 | Utilização de capacidade > 85% | WARNING | Iniciar planejamento de contratação |
| ALT-EC-02 | Utilização de capacidade > 95% | CRITICAL | Contratar ou reduzir metas; escalar para diretoria |
| ALT-EC-03 | % low performers > 15% | CRITICAL | Revisão do time; diagnóstico de causa raiz |
| ALT-EC-04 | Turnover anualizado > 20% | WARNING | Pesquisa de clima; revisão de remuneração e cultura |
| ALT-EC-05 | Top performer sai do time | WARNING | Investigar causa; plano de retenção para demais top performers |
| ALT-EC-06 | Ramp-up atrasado > 30 dias | WARNING | Identificar bloqueio; apoio do gestor |
| ALT-EC-07 | Span of control > 10 por gestor | WARNING | Contratar gestor adicional |

---

## 13. Planos de Ação Automáticos

### PA-EC-01 — Alto Percentual de Low Performers (Gatilho: ALT-EC-03)
```yaml
plano_acao:
  tipo: diagnostico_e_coaching
  prazo_dias: 45
  tarefas:
    - "ENG-04: analisar se low performance é sistêmica (processo, ferramentas, ICP) ou individual"
    - "Se sistêmica: corrigir processo via CAP-02/CAP-03; não penalizar indivíduos"
    - "Se individual: verificar se ramp-up foi adequado e se houve coaching suficiente"
    - "Iniciar PIP individual para cada low performer com plano específico"
    - "Revisar qualidade do coaching dos gestores (span of control, 1:1s)"
  metrica_sucesso: "< 10% low performers em 60 dias"
```

---

## 14. Automações

| ID | Trigger | Ação Automatizada | Conector |
|----|---------|-----------------|---------|
| AUT-EC-01 | `equipe.novo_membro_contratado` | Criar plano de ramp-up; agendar onboarding; designar buddy | CONN-MENSAGERIA |
| AUT-EC-02 | `sistema.periodo_encerrado` (mensal) | Calcular performance individual; identificar low performers; calcular comissões | ENG-02 |
| AUT-EC-03 | `equipe.low_performer_identificado` | Notificar gestor; criar tarefa de conversa de alinhamento | CONN-MENSAGERIA |
| AUT-EC-04 | `sistema.periodo_encerrado` (mensal) | Calcular e comunicar comissões ao time | CONN-EMAIL-TRANSACIONAL |

---

## 15. Auditoria Operacional

### Checklist Mensal — CAP-07-AUD-MENSAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Utilização de capacidade ≤ 80% | KPI-EC-02 | Valor do KPI |
| 2 | Performance individual calculada para todos os membros | Log de avaliações | 100% dos membros avaliados |
| 3 | Low performers identificados têm protocolo iniciado | Lista de PIPs ativos | 100% com protocolo |
| 4 | Comissões calculadas e comunicadas até dia 10 | Log de comunicação | Data de envio ≤ dia 10 |
| 5 | Planos de ramp-up ativos com milestones em dia | Status dos planos | Zero planos sem milestone atualizado |
| 6 | Alertas tratados dentro do SLA | Taxa de resolução | ≥ 90% |

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml — CAP-07 Gestão da Equipe Comercial
# Ref: ARC-ENG-099

modulo:
  id: "CAP-07"
  nome: "Gestão da Equipe Comercial"
  versao: "2.0.0"
  tier: "core"
  status: "ativo"

dependencias:
  engines:
    - id: "ENG-02"
      uso: "KPIs KPI-EC-01 a KPI-EC-10"
    - id: "ENG-03"
      uso: "alertas ALT-EC-01 a ALT-EC-07"
    - id: "ENG-05"
      uso: "PIPs (Performance Improvement Plans)"
    - id: "ENG-06"
      uso: "auditoria mensal"
    - id: "ENG-07"
      uso: "workflows AUT-EC-01 a AUT-EC-04"
    - id: "ENG-09"
      uso: "melhoria contínua de processos de people ops comercial"

eventos_publicados:
  - evento: "equipe.capacidade_insuficiente"
    condicao: "headcount insuficiente para a meta"
  - evento: "equipe.novo_membro_contratado"
    condicao: "novo membro registrado"
  - evento: "equipe.membro_em_producao"
    condicao: "ramp-up concluído"
  - evento: "equipe.low_performer_identificado"
    condicao: "membro < 70% por 2 meses"
  - evento: "equipe.comissoes_calculadas"
    condicao: "comissões do mês calculadas"
  - evento: "equipe.membro_desligado"
    condicao: "membro saiu do time"
  - evento: "equipe.treinamento_concluido"
    condicao: "treinamento realizado"

eventos_consumidos:
  - evento: "sistema.periodo_encerrado"
    origem: "Scheduler"
    acao: "calcular capacidade, performance e comissões"
  - evento: "kpi.limiar.cruzado"
    origem: "ENG-02"
    acao: "identificar gap de competência se KPI é de conversão"
  - evento: "melhoria.item.implementado"
    origem: "ENG-09"
    acao: "revisar processos impactados"

kpis_registrados:
  - id: "KPI-EC-01"
    nome: "Headcount Atual vs. Necessário"
    formula: "headcount_em_producao / headcount_necessario * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 90
  - id: "KPI-EC-02"
    nome: "Utilização de Capacidade"
    formula: "demanda_atual / capacidade_disponivel * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 80
    limiar_warning: 85
    limiar_critical: 95
  - id: "KPI-EC-03"
    nome: "Tempo Médio de Ramp-Up"
    formula: "media(dias_em_producao - data_contratacao)"
    unidade: "dias"
    dimensao: "papel"
    frequencia_calculo: "mensal"
  - id: "KPI-EC-04"
    nome: "Taxa de Conclusão de Ramp no Prazo"
    formula: "ramps_concluidos_no_prazo / total_ramps * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 80
  - id: "KPI-EC-05"
    nome: "Performance Média do Time"
    formula: "media(performance_individual_percentual)"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 90
  - id: "KPI-EC-06"
    nome: "Percentual de Low Performers"
    formula: "low_performers / total_time * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 10
    limiar_warning: 15
    limiar_critical: 25
  - id: "KPI-EC-07"
    nome: "Turnover Anualizado"
    formula: "saidas_12m / headcount_medio * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal_rolling_12m"
    meta_padrao: 15
    limiar_warning: 20
  - id: "KPI-EC-08"
    nome: "Turnover de Top Performers"
    formula: "saidas_top / total_top * 100"
    unidade: "percentual"
    frequencia_calculo: "anual"
    meta_padrao: 5
  - id: "KPI-EC-09"
    nome: "Span of Control"
    formula: "ics_por_gestor"
    unidade: "quantidade"
    frequencia_calculo: "mensal"
    meta_padrao: 7
    limiar_warning: 9
    limiar_critical: 11
  - id: "KPI-EC-10"
    nome: "% do Time Acima da Meta"
    formula: "membros_acima_meta / total_time * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 60

alertas_registrados:
  - id: "ALT-EC-01"
    kpi_ref: "KPI-EC-02"
    condicao: "> 85"
    severidade: "warning"
    owner: "gestor_comercial"
  - id: "ALT-EC-02"
    kpi_ref: "KPI-EC-02"
    condicao: "> 95"
    severidade: "critical"
    owner: "diretoria_comercial"
  - id: "ALT-EC-03"
    kpi_ref: "KPI-EC-06"
    condicao: "> 15"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-EC-04"
    kpi_ref: "KPI-EC-07"
    condicao: "> 20"
    severidade: "warning"
    owner: "gestor_comercial"
  - id: "ALT-EC-05"
    condicao: "membro_desligado.classificacao = top_performer"
    severidade: "warning"
    owner: "diretoria_comercial"
  - id: "ALT-EC-06"
    condicao: "ramp_up.dias_atrasado > 30"
    severidade: "warning"
    owner: "gestor_responsavel"
  - id: "ALT-EC-07"
    kpi_ref: "KPI-EC-09"
    condicao: "> 10"
    severidade: "warning"
    owner: "diretoria_comercial"

workflows_registrados:
  - id: "WF-EC-01"
    nome: "Iniciação de Ramp-Up"
    gatilho: "equipe.novo_membro_contratado"
    descricao: "cria plano de ramp-up, agenda onboarding, designa buddy"
  - id: "WF-EC-02"
    nome: "Avaliação Mensal de Performance e Comissões"
    gatilho: "sistema.periodo_encerrado (mensal)"
    descricao: "calcula KPIs individuais, classifica, identifica low performers, calcula comissões"
  - id: "WF-EC-03"
    nome: "Protocolo de Low Performer"
    gatilho: "equipe.low_performer_identificado"
    descricao: "notifica gestor, cria tarefa de conversa, inicia PIP no mês seguinte"

auditoria_checklists:
  - id: "CAP-07-AUD-MENSAL"
    tipo: "mensal"
    itens_count: 6

conectores_utilizados:
  - "CONN-MENSAGERIA"
  - "CONN-EMAIL-TRANSACIONAL"

permissoes_necessarias:
  - recurso: "equipe_membros"
    acoes: ["read", "write"]
  - recurso: "ramp_up_plans"
    acoes: ["read", "write"]
  - recurso: "comissoes"
    acoes: ["read", "write"]
  - recurso: "performance_individual"
    acoes: ["read", "write"]
  - recurso: "kpi_values.KPI-EC-*"
    acoes: ["read", "write_via_eng02"]
  - recurso: "eventos_barramento"
    acoes: ["publish", "subscribe"]
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial |
| 2.0.0 | 2026-06-29 | Guardião da Documentação | Redesenho como microserviço do Commercial OS |
