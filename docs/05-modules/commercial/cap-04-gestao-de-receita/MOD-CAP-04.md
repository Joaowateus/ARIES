---
id: MOD-CAP-04
titulo: "CAP-04 — Gestão de Receita"
versao: "2.0.0"
status: aprovado
categoria: Commercial-OS-Module
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-29
dependencias:
  - ARC-ENG-000
  - ARC-ENG-001
  - ARC-ENG-002
  - ARC-ENG-003
  - ARC-ENG-004
  - ARC-ENG-005
  - ARC-ENG-006
  - ARC-ENG-007
  - ARC-ENG-008
  - MOD-CAP-03
  - MOD-CAP-05
  - MOD-CAP-06
tags: [commercial-os, cap-04, receita, mrr, arr, nrr, faturamento, cobranca, inadimplencia, financeiro]
---

# CAP-04 — Gestão de Receita

> **Módulo do Commercial Operating System**
> Infraestrutura compartilhada: `docs/02-architecture/engine-autogestao/`
> Contrato de integração: `ENGINE-CONTRATO-DE-INTEGRACAO.md` (ARC-ENG-099)

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| **ID do Módulo** | CAP-04 |
| **Nome** | Gestão de Receita |
| **Domínio** | Financeiro Comercial — Faturamento, Cobrança e Reconhecimento de Receita |
| **Versão** | 2.0.0 |
| **Tier** | Core |
| **Posição na cadeia** | Downstream de CAP-03; Paralelo a CAP-05 |
| **Registro na Engine** | `ENGINE-REGISTRATION.yaml` (seção 16) |

---

## 2. Objetivo

Garantir que toda receita contratada seja **reconhecida, faturada, cobrada e reconciliada** de forma precisa e no tempo correto — mantendo o MRR/ARR como a métrica mais confiável do sistema e protegendo a saúde financeira da operação através de controle rigoroso de inadimplência e receita recorrente.

O CAP-04 é a camada de conversão entre compromisso contratual e caixa real. Ele fecha o ciclo comercial: o que CAP-03 fechou, CAP-04 transforma em receita reconhecida e paga. Sem CAP-04 operando com precisão, a empresa tem vendas sem dinheiro — ou dinheiro sem visibilidade de onde veio.

**O CAP-04 não vende nem retém. Ele garante que o que foi vendido vira receita — e que a receita é mensurada com exatidão.**

---

## 3. Escopo

### 3.1 Dentro do Escopo
- Reconhecimento de receita a partir de contratos assinados (MRR/ARR)
- Faturamento recorrente e pontual
- Gestão do ciclo de cobrança (dunning)
- Controle e gestão de inadimplência
- Reconciliação financeira entre faturado e recebido
- Cálculo e reporte de MRR Bridge (New + Expansion − Churn − Contraction)
- Monitoramento de NRR (Net Revenue Retention) e GRR (Gross Revenue Retention)
- Gestão de reembolsos e estornos
- Integração com sistema ERP/financeiro

### 3.2 Fora do Escopo
- Definição de preços e condições comerciais → CAP-06
- Negociação de contratos → CAP-03
- Onboarding de clientes → CAP-05
- Gestão de churn → CAP-05
- Expansão de receita → CAP-05
- Contabilidade e fiscal → Sistema ERP externo

---

## 4. Responsabilidades

| # | Responsabilidade | Frequência |
|---|-----------------|-----------|
| R-01 | Reconhecer MRR/ARR ao receber `oportunidade.ganha` de CAP-03 | Por contrato |
| R-02 | Emitir fatura no prazo correto para cada cliente ativo | Por competência |
| R-03 | Executar ciclo de cobrança (dunning) para faturas em atraso | Por fatura vencida |
| R-04 | Manter inadimplência dentro do limite definido | Contínuo |
| R-05 | Calcular e publicar MRR Bridge mensalmente | Mensal |
| R-06 | Calcular NRR e GRR por coorte de clientes | Mensal |
| R-07 | Reconciliar faturamento com recebimentos do ERP | Mensal |
| R-08 | Atualizar MRR ao receber eventos de expansão ou contração de CAP-05 | Por evento |
| R-09 | Publicar `receita.mrr_atualizado` ao processar qualquer mudança de receita | Por mudança |

---

## 5. Capacidades Internas

### CAP-04.1 — Reconhecimento de Receita

Processo de transformação de contratos em MRR/ARR reconhecido pelo sistema.

**MRR Bridge — a identidade contábil da receita recorrente:**
```
MRR_FINAL = MRR_INICIAL
           + NEW_MRR          (novos contratos)
           + EXPANSION_MRR    (expansões de clientes existentes)
           − CHURN_MRR        (cancelamentos)
           − CONTRACTION_MRR  (reduções de contrato)
```

**Regras de reconhecimento:**
```yaml
regras_reconhecimento:
  novo_contrato:
    trigger: "oportunidade.ganha"
    tipo: "new_mrr"
    valor: "contrato.valor_mensal_recorrente"
    data_inicio: "contrato.data_inicio"

  expansao:
    trigger: "cliente.expandido"
    tipo: "expansion_mrr"
    valor: "delta_mrr_positivo"
    data_inicio: "data_efetiva_expansao"

  reducao:
    trigger: "cliente.contrato_reduzido"
    tipo: "contraction_mrr"
    valor: "delta_mrr_negativo (absoluto)"
    data_inicio: "data_efetiva_reducao"

  cancelamento:
    trigger: "cliente.cancelamento.confirmado"
    tipo: "churn_mrr"
    valor: "contrato.valor_mensal_recorrente"
    data_fim: "data_efetiva_cancelamento"

  reconhecimento_proporcional:
    regra: "contrato iniciado no meio do mês é reconhecido pro-rata"
    formula: "mrr_mensal * (dias_restantes_mes / dias_no_mes)"
```

### CAP-04.2 — Faturamento Recorrente

Geração e envio de faturas para clientes ativos.

```yaml
fatura:
  id: "FAT-ID"
  cliente_id: "CLI-ID"
  contrato_id: "CTR-ID"
  competencia: "YYYY-MM"
  status: "gerada | enviada | visualizada | paga | em_atraso | cancelada | estornada"

  valor_bruto: 0.0
  impostos_json: {}         # cálculo de impostos pelo ERP
  valor_liquido: 0.0
  valor_pago: 0.0
  valor_pendente: 0.0

  data_vencimento: ""
  data_pagamento: null
  dias_em_atraso: 0

  forma_pagamento: "boleto | cartao_recorrente | pix | transferencia | cheque"
  codigo_barras: null
  link_pagamento: null

  tentativas_cobranca: 0
  proxima_tentativa: null

  gerada_em: ""
  enviada_em: null
  paga_em: null
```

### CAP-04.3 — Ciclo de Cobrança (Dunning)

Processo estruturado de recuperação de faturas em atraso.

```yaml
dunning_policy:
  D0:
    evento: "fatura emitida"
    acao: "enviar fatura ao cliente com link de pagamento"
    canal: "email + portal do cliente"

  D_plus_1:
    gatilho: "1 dia após vencimento sem pagamento"
    acao: "lembrete gentil de fatura em aberto"
    canal: "email"
    tom: "informativo"

  D_plus_5:
    gatilho: "5 dias em atraso"
    acao: "lembrete de urgência com opção de negociação"
    canal: "email + mensageria"
    tom: "urgente"

  D_plus_15:
    gatilho: "15 dias em atraso"
    acao: "contato ativo do time financeiro; oferta de parcelamento"
    canal: "ligação + email"
    tom: "formal"
    escalacao_interna: "CS do cliente (via CAP-05) é notificado"

  D_plus_30:
    gatilho: "30 dias em atraso"
    acao: "notificação de suspensão de serviço; escalação para gestor"
    canal: "email formal + mensageria"
    tom: "legal"
    escalacao_interna: "gestor comercial + CS"
    risco_churn: "alto — publicar alerta para CAP-05"

  D_plus_60:
    gatilho: "60 dias em atraso"
    acao: "suspensão de serviço conforme contrato; encaminhar para cobrança externa"
    canal: "notificação formal"
    escalacao: "jurídico / cobrança externa"
```

### CAP-04.4 — NRR e GRR (Net/Gross Revenue Retention)

Métricas de retenção de receita por coorte de clientes.

```yaml
nrr_calculation:
  formula: "(MRR_inicio_periodo + Expansion_MRR - Churn_MRR - Contraction_MRR) / MRR_inicio_periodo * 100"
  benchmark_saas: "> 100%"
  benchmark_servicos: "> 95%"
  frequencia: "mensal e rolling 12 meses"
  dimensoes:
    - por_segmento
    - por_coorte_mes_contratacao
    - por_plano

grr_calculation:
  formula: "(MRR_inicio_periodo - Churn_MRR - Contraction_MRR) / MRR_inicio_periodo * 100"
  nota: "GRR mede retenção sem expansão — indica saúde de retenção pura"
  frequencia: "mensal"
```

### CAP-04.5 — Reconciliação Financeira

Processo de comparação entre faturamento emitido e recebimentos confirmados no ERP.

```yaml
reconciliacao:
  frequencia: "mensal (até dia 5 do mês seguinte)"
  fontes:
    - "faturas emitidas pelo CAP-04"
    - "recebimentos confirmados no ERP (via CONN-ERP-FINANCEIRO)"
    - "recebimentos no gateway de pagamento (via CONN-GATEWAY-PAGAMENTO)"

  processo:
    - "listar todas as faturas do mês com status"
    - "cruzar com recebimentos do ERP e gateway"
    - "identificar divergências: fatura paga mas não baixada | recebimento sem fatura | valor divergente"
    - "registrar divergências para tratamento"
    - "produzir relatório de reconciliação aprovado"

  sla: "reconciliação concluída até dia 5 do mês seguinte"
```

---

## 6. Fluxo Operacional

```
[FLUXO A — RECONHECIMENTO DE RECEITA E FATURAMENTO]

[TRIGGER: oportunidade.ganha recebido de CAP-03]
│
├─► Criar registro de receita recorrente:
│   ├─ tipo: new_mrr
│   ├─ valor: contrato.mrr
│   └─ data_inicio: contrato.data_inicio
│
├─► Atualizar MRR Bridge: + new_mrr
│
├─► Agendar ciclo de faturamento recorrente (via ENG-07):
│   ├─ competência e data de vencimento conforme contrato
│   └─ forma de pagamento configurada
│
├─► Publicar: receita.mrr_atualizado
│
└─► [CICLO MENSAL — para cada cliente ativo]
    ├─► Gerar fatura (ENG-07 trigger: dia do faturamento)
    ├─► Calcular impostos (via CONN-ERP-FINANCEIRO)
    ├─► Enviar fatura ao cliente (CONN-EMAIL-TRANSACIONAL + portal)
    └─► Iniciar monitoramento de pagamento


[FLUXO B — COBRANÇA E DUNNING]

[TRIGGER: fatura.vencida (data_vencimento < hoje e status ≠ paga)]
│
├─► D+1: lembrete de vencimento → email automático
│
├─► D+5: alerta de atraso → email + mensageria
│
├─► D+15:
│   ├─► Contato ativo do time financeiro
│   └─► Notificar CS do cliente (via evento `receita.inadimplencia.nivel_alerta_atingido`)
│       └─► CAP-05 recebe e registra risco financeiro no health score do cliente
│
├─► D+30:
│   ├─► Notificação formal de suspensão
│   ├─► Escalar para gestor + CS
│   └─► Publicar: receita.inadimplencia.escalada → CAP-05 aplica protocolo de retenção de emergência
│
└─► D+60:
    ├─► Executar suspensão conforme contrato
    └─► Encaminhar para cobrança externa / jurídico


[FLUXO C — ATUALIZAÇÃO DE MRR POR EVENTO DE CLIENTE]

[TRIGGER: cliente.expandido | cliente.contrato_reduzido | cliente.cancelamento.confirmado]
│
├─► cliente.expandido:
│   ├─► Registrar expansion_mrr = delta_mrr_positivo
│   └─► Atualizar MRR Bridge: + expansion_mrr
│
├─► cliente.contrato_reduzido:
│   ├─► Registrar contraction_mrr = delta_mrr_negativo
│   └─► Atualizar MRR Bridge: − contraction_mrr
│
└─► cliente.cancelamento.confirmado:
    ├─► Registrar churn_mrr = contrato.mrr
    ├─► Atualizar MRR Bridge: − churn_mrr
    ├─► Cancelar ciclo de faturamento recorrente
    └─► Emitir nota de cancelamento se aplicável
│
[Em todos os casos] → Publicar: receita.mrr_atualizado


[FLUXO D — RECONCILIAÇÃO MENSAL]

[TRIGGER: sistema.periodo_encerrado (mensal)]
│
├─► Coletar: faturas emitidas do mês (status por fatura)
├─► Coletar: recebimentos do ERP (CONN-ERP-FINANCEIRO)
├─► Coletar: confirmações do gateway de pagamento (CONN-GATEWAY-PAGAMENTO)
├─► Cruzar e identificar divergências
├─► Tratar divergências (baixar pagamentos, ajustar status de faturas)
├─► Produzir relatório de reconciliação
└─► Publicar: receita.reconciliacao_concluida
```

---

## 7. Estados

### 7.1 Estados da Fatura

```
GERADA → ENVIADA → [VISUALIZADA] → PAGA
                         │
                    EM_ATRASO (vencida sem pagamento)
                         │
              D+1 → D+5 → D+15 → D+30 → D+60
                                            │
                                     SUSPENSA | CANCELADA | ESTORNADA
```

### 7.2 Estados da Receita por Contrato

```
RECONHECIDA → ATIVA → [EXPANDED | CONTRACTED] → CHURNED
```

### 7.3 Estados da Reconciliação

```
PENDENTE → EM_ANDAMENTO → CONCLUIDA_COM_DIVERGENCIAS | CONCLUIDA_OK
```

---

## 8. Regras de Negócio

### RN-01 — Reconhecimento de MRR Vinculado ao Contrato Assinado
MRR só é reconhecido após receber o evento `oportunidade.ganha` de CAP-03, que transporta o contrato assinado e todos os dados financeiros. Não existe receita reconhecida sem contrato formalizado. MRR de contratos sem assinatura é proibido.

### RN-02 — Faturamento no Prazo Contratual
A fatura DEVE ser gerada e enviada no prazo definido no contrato (geralmente no início ou no final do período de competência). Fatura enviada com atraso de mais de 3 dias úteis é uma não-conformidade operacional.

### RN-03 — Dunning Automatizado e Imutável
O ciclo de dunning (D+1, D+5, D+15, D+30, D+60) é automatizado e não pode ser pulado manualmente sem aprovação do gestor financeiro e registro no DECISION_LOG. A consistência do dunning é fundamental para a previsibilidade de recebimento.

### RN-04 — Inadimplência Comunicada ao CS em D+15
Em D+15 de atraso, o CS responsável pelo cliente DEVE ser notificado. A inadimplência financeira é um sinal de risco de churn. CAP-05 e CAP-04 cooperam neste ponto via evento, não por integração direta.

### RN-05 — NRR É Calculado por Coorte, Não Apenas Global
O NRR global mascara problemas por segmento. O CAP-04 DEVE calcular NRR por: segmento de cliente, coorte de mês de contratação, e plano/produto. NRR apenas global é métrica insuficiente para diagnóstico.

### RN-06 — Reconciliação Mensal Obrigatória
A reconciliação financeira DEVE ser concluída até o dia 5 do mês seguinte. Reconciliação não executada é não-conformidade. Divergências identificadas na reconciliação DEVEM ser tratadas antes do fechamento do período.

### RN-07 — MRR Bridge É a Fonte de Verdade
O MRR Bridge (New + Expansion − Churn − Contraction) é o único cálculo oficial de MRR. Qualquer outra forma de calcular MRR deve ser alinhada ao Bridge antes de ser comunicada. Divergências entre o MRR do Bridge e o MRR reportado são não-conformidades.

### RN-08 — Reembolso Requer Aprovação e Registro
Todo reembolso ou estorno DEVE ser aprovado pelo gestor financeiro ou comercial (conforme valor) e registrado com motivo estruturado. Reembolso não registrado impacta o NRR sem justificativa visível.

### RN-09 — Suspensão de Serviço em D+60 É Automática
Após 60 dias de inadimplência, a suspensão do serviço é executada automaticamente conforme cláusula contratual. A suspensão não é negociável sem um acordo de parcelamento formal aprovado pelo gestor — e o acordo deve ser registrado com novo plano de pagamento.

---

## 9. Eventos Publicados

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `receita.mrr_atualizado` | Qualquer mudança no MRR | `{tipo: new\|expansion\|contraction\|churn, valor_delta, mrr_total_novo, cliente_id, contrato_id}` |
| `receita.fatura_emitida` | Fatura gerada e enviada | `{fatura_id, cliente_id, valor, competencia, data_vencimento, forma_pagamento}` |
| `receita.fatura_paga` | Pagamento confirmado | `{fatura_id, cliente_id, valor_pago, data_pagamento, forma_pagamento}` |
| `receita.inadimplencia.nivel_alerta_atingido` | Fatura em atraso — nível de alerta atingido (D1, D5, D15, D30) | `{fatura_id, cliente_id, valor, dias_atraso, nivel: D1\|D5\|D15\|D30, cs_responsavel?}` |
| `receita.inadimplencia.escalada` | Fatura 30+ dias em atraso — protocolo de suspensão ativado | `{fatura_id, cliente_id, valor, dias_atraso, nivel: D60, risco_churn: alto}` |
| `receita.mrr_bridge.calculado` | MRR Bridge do mês calculado | `{periodo, mrr_inicial, new_mrr, expansion_mrr, churn_mrr, contraction_mrr, mrr_final, nrr}` |
| `receita.reconciliacao_concluida` | Reconciliação mensal finalizada | `{periodo, faturas_total, recebimentos_confirmados, divergencias_count, status: ok\|com_divergencias}` |
| `receita.suspensao_executada` | Serviço suspenso por inadimplência | `{cliente_id, contrato_id, dias_atraso, valor_pendente}` |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `oportunidade.ganha` | CAP-03 | Reconhecer new_mrr a partir do campo `mrr` do payload; agendar faturamento recorrente |
| `cliente.expandido` | CAP-05 | Reconhecer expansion_mrr; atualizar faturamento |
| `cliente.contrato_reduzido` | CAP-05 | Reconhecer contraction_mrr; ajustar faturamento |
| `cliente.cancelamento.confirmado` | CAP-05 | Reconhecer churn_mrr; cancelar faturamento recorrente |
| `oferta.tabela_precos.atualizada` | CAP-06 | Atualizar base de cálculo para novos contratos |
| `sistema.periodo_encerrado` | Scheduler (mensal) | Iniciar reconciliação; calcular MRR Bridge; calcular NRR/GRR |
| `melhoria.item.implementado` | ENG-09 | Revisar processos impactados |

---

## 11. KPIs

| ID | Nome | Fórmula | Meta | Frequência |
|----|------|---------|------|-----------|
| KPI-RV-01 | MRR (Monthly Recurring Revenue) | `MRR_Bridge` | Crescente | Mensal |
| KPI-RV-02 | ARR (Annual Recurring Revenue) | `MRR × 12` | Crescente | Mensal |
| KPI-RV-03 | New MRR | `soma(new_mrr_do_mes)` | Por plano | Mensal |
| KPI-RV-04 | Expansion MRR | `soma(expansion_mrr_do_mes)` | Crescente | Mensal |
| KPI-RV-05 | Churn MRR | `soma(churn_mrr_do_mes)` | Decrescente | Mensal |
| KPI-RV-06 | MRR Churn Rate | `churn_mrr / mrr_inicio_periodo × 100` | < 2% | Mensal |
| KPI-RV-07 | NRR (Net Revenue Retention) | `(MRR_inicio + Exp − Churn − Contr) / MRR_inicio × 100` | > 100% | Mensal |
| KPI-RV-08 | GRR (Gross Revenue Retention) | `(MRR_inicio − Churn − Contr) / MRR_inicio × 100` | > 90% | Mensal |
| KPI-RV-09 | Taxa de Inadimplência | `valor_em_atraso / mrr × 100` | < 3% | Mensal |
| KPI-RV-10 | Days Sales Outstanding (DSO) | `(contas_a_receber / receita_periodo) × dias` | < 30 dias | Mensal |
| KPI-RV-11 | Taxa de Recuperação de Inadimplentes | `valor_recuperado / valor_em_atraso × 100` | > 70% | Mensal |
| KPI-RV-12 | Acurácia da Reconciliação | `faturas_sem_divergencia / total_faturas × 100` | 100% | Mensal |

---

## 12. Alertas

| ID | Condição | Severidade | Ação |
|----|---------|-----------|------|
| ALT-RV-01 | MRR Churn Rate > 3% no mês | CRITICAL | Escalar para liderança; acionar protocolo retenção em CAP-05 |
| ALT-RV-02 | NRR < 95% no mês | WARNING | Diagnóstico: churn alto ou expansão insuficiente? |
| ALT-RV-03 | NRR < 90% no mês | CRITICAL | Escalar para liderança; plano de retenção emergencial |
| ALT-RV-04 | Taxa de inadimplência > 5% | CRITICAL | Acionar revisão do dunning; escalar para gestor |
| ALT-RV-05 | Fatura em atraso D+30 | WARNING | Escalar para CS + gestor; protocolo de suspensão ativado |
| ALT-RV-06 | MRR com queda por 2 meses consecutivos | CRITICAL | Diagnóstico ENG-04: churn > new_mrr ou expansion insuficiente? |
| ALT-RV-07 | Reconciliação com divergências > 2% do faturamento | WARNING | Investigar e tratar antes do fechamento |
| ALT-RV-08 | DSO > 45 dias | WARNING | Revisar eficácia do dunning; verificar formas de pagamento |

---

## 13. Planos de Ação Automáticos

### PA-RV-01 — MRR em Queda (Gatilho: ALT-RV-06)
```yaml
plano_acao:
  tipo: diagnostico_e_correcao
  prazo_dias: 30
  tarefas:
    - "Decompor MRR Bridge: queda vem de churn_mrr alto, expansion insuficiente, ou new_mrr baixo?"
    - "Se churn alto: acionar CAP-05 com alerta prioritário para protocolo de retenção"
    - "Se expansion baixa: verificar com CAP-05 se oportunidades de expansão estão sendo trabalhadas"
    - "Se new_mrr baixo: verificar funil de CAP-02 e CAP-03 (volume de SQLs e conversão)"
  metrica_sucesso: "MRR retorna a crescimento em 60 dias"
```

### PA-RV-02 — Inadimplência Alta (Gatilho: ALT-RV-04)
```yaml
plano_acao:
  tipo: correcao_operacional
  prazo_dias: 30
  tarefas:
    - "Listar todos os clientes em atraso por faixa (D+1 a D+60)"
    - "Para clientes D+15: verificar se CS foi notificado e está agindo"
    - "Para clientes D+30+: reunião semanal de cobrança com gestor"
    - "Analisar se inadimplência está concentrada em segmento/produto específico"
    - "Se problema sistêmico: revisar processo de onboarding financeiro (forma de pagamento, recorrência)"
  metrica_sucesso: "Taxa de inadimplência < 3% em 60 dias"
```

---

## 14. Automações

| ID | Trigger | Ação Automatizada | Conector |
|----|---------|-----------------|---------|
| AUT-RV-01 | `oportunidade.ganha` recebido | Reconhecer MRR; criar ciclo de faturamento recorrente | CONN-ERP-FINANCEIRO |
| AUT-RV-02 | Dia de faturamento do cliente | Gerar fatura; calcular impostos; enviar ao cliente | CONN-ERP-FINANCEIRO, CONN-EMAIL-TRANSACIONAL |
| AUT-RV-03 | Fatura D+1 sem pagamento | Enviar lembrete de vencimento | CONN-EMAIL-TRANSACIONAL |
| AUT-RV-04 | Fatura D+5 sem pagamento | Enviar alerta de urgência + mensageria | CONN-EMAIL-TRANSACIONAL, CONN-MENSAGERIA |
| AUT-RV-05 | Fatura D+15 sem pagamento | Notificar CS do cliente; publicar `receita.inadimplencia.nivel_alerta_atingido` | CONN-MENSAGERIA, Barramento SOE |
| AUT-RV-06 | Fatura D+30 sem pagamento | Publicar `receita.inadimplencia.escalada`; notificação formal de suspensão | Barramento SOE, CONN-EMAIL-TRANSACIONAL |
| AUT-RV-07 | Fatura D+60 sem pagamento | Comandar suspensão de acesso via CONN-PLATAFORMA-PRODUTO; publicar `receita.suspensao_executada` somente após confirmação do conector | CONN-PLATAFORMA-PRODUTO, Barramento SOE |
| AUT-RV-08 | `cliente.expandido` recebido | Atualizar MRR; ajustar faturamento futuro | CONN-ERP-FINANCEIRO |
| AUT-RV-09 | `cliente.cancelamento.confirmado` recebido | Registrar churn_mrr; cancelar faturamento recorrente | CONN-ERP-FINANCEIRO |
| AUT-RV-10 | `sistema.periodo_encerrado` (mensal) | Calcular MRR Bridge; calcular NRR/GRR; iniciar reconciliação | ENG-02 |

---

## 15. Auditoria Operacional

### Checklist Mensal — CAP-04-AUD-MENSAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | MRR Bridge calculado e publicado | Evento `receita.mrr_bridge.calculado` | Registro do evento com valores |
| 2 | 100% das faturas geradas no prazo contratual | Log de faturamento | Zero faturas com atraso > 3 dias úteis |
| 3 | Ciclo de dunning executado conforme política | Log de ações por fatura em atraso | 100% das faturas com dunning correto |
| 4 | Reconciliação concluída até dia 5 do mês | `receita.reconciliacao_concluida` | Evento registrado com data |
| 5 | Taxa de inadimplência dentro do limite | KPI-RV-09 | < 3% |
| 6 | NRR calculado por segmento e coorte | KPI-RV-07 com dimensões | Relatório com breakdown |
| 7 | Clientes D+15+ têm CS notificado | Log de eventos `receita.inadimplencia.nivel_alerta_atingido` | 100% dos casos com CS notificado |
| 8 | Alertas tratados dentro do SLA da ENG-03 | Taxa de resolução | ≥ 90% no SLA |

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml — CAP-04 Gestão de Receita
# Ref: ARC-ENG-099

modulo:
  id: "CAP-04"
  nome: "Gestão de Receita"
  versao: "2.0.0"
  tier: "core"
  status: "ativo"

dependencias:
  modulos:
    - id: "CAP-03"
      uso: "receber contratos assinados para reconhecimento de MRR"
    - id: "CAP-05"
      uso: "receber eventos de expansão, contração e churn; notificar CS sobre inadimplência"
    - id: "CAP-06"
      uso: "tabela de preços vigente para cálculo de faturamento"
  engines:
    - id: "ENG-01"
      uso: "instâncias de faturamento e ciclos de cobrança"
    - id: "ENG-02"
      uso: "KPIs KPI-RV-01 a KPI-RV-12"
    - id: "ENG-03"
      uso: "alertas ALT-RV-01 a ALT-RV-08"
    - id: "ENG-04"
      uso: "diagnóstico de queda de MRR e inadimplência"
    - id: "ENG-05"
      uso: "planos de ação PA-RV-01 a PA-RV-02"
    - id: "ENG-06"
      uso: "auditoria mensal"
    - id: "ENG-07"
      uso: "workflows AUT-RV-01 a AUT-RV-10"
    - id: "ENG-08"
      uso: "ERP financeiro, gateway de pagamento, email transacional, mensageria"

eventos_publicados:
  - evento: "receita.mrr_atualizado"
    condicao: "qualquer mudança no MRR"
  - evento: "receita.fatura_emitida"
    condicao: "fatura gerada e enviada"
  - evento: "receita.fatura_paga"
    condicao: "pagamento confirmado"
  - evento: "receita.inadimplencia.nivel_alerta_atingido"
    condicao: "fatura em atraso — atingiu nível D1, D5, D15 ou D30 (campo nivel no payload)"
  - evento: "receita.inadimplencia.escalada"
    condicao: "fatura 30+ dias em atraso"
  - evento: "receita.mrr_bridge.calculado"
    condicao: "MRR Bridge mensal calculado"
  - evento: "receita.reconciliacao_concluida"
    condicao: "reconciliação mensal finalizada"
  - evento: "receita.suspensao_executada"
    condicao: "serviço suspenso por inadimplência D+60"

eventos_consumidos:
  - evento: "oportunidade.ganha"
    origem: "CAP-03"
    acao: "reconhecer new_mrr a partir do campo mrr do payload; agendar faturamento recorrente"
  - evento: "cliente.expandido"
    origem: "CAP-05"
    acao: "reconhecer expansion_mrr; atualizar faturamento"
  - evento: "cliente.contrato_reduzido"
    origem: "CAP-05"
    acao: "reconhecer contraction_mrr; ajustar faturamento"
  - evento: "cliente.cancelamento.confirmado"
    origem: "CAP-05"
    acao: "reconhecer churn_mrr; cancelar faturamento"
  - evento: "oferta.tabela_precos.atualizada"
    origem: "CAP-06"
    acao: "atualizar base de cálculo para novos contratos"
  - evento: "sistema.periodo_encerrado"
    origem: "Scheduler"
    acao: "calcular MRR Bridge, NRR, GRR; iniciar reconciliação"
  - evento: "melhoria.item.implementado"
    origem: "ENG-09"
    acao: "revisar processos impactados"
  - evento: "performance.metas_atualizadas"
    origem: "CAP-08"
    acao: "atualizar meta de MRR de referência; recalibrar limiares de alerta de inadimplência e churn"

kpis_registrados:
  - id: "KPI-RV-01"
    nome: "MRR"
    formula: "mrr_bridge_valor_final"
    unidade: "moeda"
    frequencia_calculo: "mensal"
  - id: "KPI-RV-02"
    nome: "ARR"
    formula: "mrr * 12"
    unidade: "moeda"
    frequencia_calculo: "mensal"
  - id: "KPI-RV-03"
    nome: "New MRR"
    formula: "soma(new_mrr_do_mes)"
    unidade: "moeda"
    frequencia_calculo: "mensal"
  - id: "KPI-RV-04"
    nome: "Expansion MRR"
    formula: "soma(expansion_mrr_do_mes)"
    unidade: "moeda"
    frequencia_calculo: "mensal"
  - id: "KPI-RV-05"
    nome: "Churn MRR"
    formula: "soma(churn_mrr_do_mes)"
    unidade: "moeda"
    frequencia_calculo: "mensal"
  - id: "KPI-RV-06"
    nome: "MRR Churn Rate"
    formula: "churn_mrr / mrr_inicio_periodo * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 2
    limiar_warning: 3
    limiar_critical: 5
  - id: "KPI-RV-07"
    nome: "NRR"
    formula: "(mrr_inicio + expansion - churn - contraction) / mrr_inicio * 100"
    unidade: "percentual"
    dimensoes: ["global", "segmento_id", "coorte_mes"]
    frequencia_calculo: "mensal"
    meta_padrao: 100
    limiar_warning: 95
    limiar_critical: 90
  - id: "KPI-RV-08"
    nome: "GRR"
    formula: "(mrr_inicio - churn - contraction) / mrr_inicio * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 90
    limiar_warning: 85
  - id: "KPI-RV-09"
    nome: "Taxa de Inadimplência"
    formula: "valor_em_atraso / mrr * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 3
    limiar_warning: 5
  - id: "KPI-RV-10"
    nome: "DSO"
    formula: "(contas_a_receber / receita_periodo) * dias_periodo"
    unidade: "dias"
    frequencia_calculo: "mensal"
    meta_padrao: 30
    limiar_warning: 45
  - id: "KPI-RV-11"
    nome: "Taxa de Recuperação de Inadimplentes"
    formula: "valor_recuperado / valor_em_atraso * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 70
  - id: "KPI-RV-12"
    nome: "Acurácia da Reconciliação"
    formula: "faturas_sem_divergencia / total_faturas * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 100

alertas_registrados:
  - id: "ALT-RV-01"
    kpi_ref: "KPI-RV-06"
    condicao: "> 3"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-RV-02"
    kpi_ref: "KPI-RV-07"
    condicao: "< 95"
    severidade: "warning"
    owner: "responsavel_cap04"
  - id: "ALT-RV-03"
    kpi_ref: "KPI-RV-07"
    condicao: "< 90"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-RV-04"
    kpi_ref: "KPI-RV-09"
    condicao: "> 5"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-RV-05"
    condicao: "fatura.dias_atraso >= 30"
    severidade: "warning"
    owner: "gestor_financeiro + cs_responsavel"
  - id: "ALT-RV-06"
    kpi_ref: "KPI-RV-01"
    condicao: "queda por 2 meses consecutivos"
    severidade: "critical"
    owner: "gestor_comercial"
    acao_automatica: "disparar_diagnostico_eng04"
  - id: "ALT-RV-07"
    condicao: "reconciliacao.divergencias_percentual > 2"
    severidade: "warning"
    owner: "responsavel_cap04"
  - id: "ALT-RV-08"
    kpi_ref: "KPI-RV-10"
    condicao: "> 45"
    severidade: "warning"
    owner: "responsavel_cap04"

workflows_registrados:
  - id: "WF-RV-01"
    nome: "Reconhecimento de Receita e Agendamento de Faturamento"
    gatilho: "oportunidade.ganha"
    descricao: "reconhece MRR, cria ciclo de faturamento recorrente"
  - id: "WF-RV-02"
    nome: "Emissão e Envio de Fatura"
    gatilho: "dia de faturamento do cliente"
    descricao: "gera fatura, calcula impostos, envia ao cliente"
  - id: "WF-RV-03"
    nome: "Ciclo de Dunning"
    gatilho: "fatura.data_vencimento < hoje AND status != paga"
    descricao: "executa D+1, D+5, D+15, D+30, D+60 com ações progressivas"
  - id: "WF-RV-04"
    nome: "Atualização de MRR por Evento"
    gatilho: "cliente.expandido | cliente.contrato_reduzido | cliente.cancelamento.confirmado"
    descricao: "reconhece mudança de MRR, atualiza faturamento"
  - id: "WF-RV-05"
    nome: "Reconciliação Mensal"
    gatilho: "sistema.periodo_encerrado (mensal)"
    descricao: "cruza faturamento com ERP e gateway, trata divergências"

auditoria_checklists:
  - id: "CAP-04-AUD-MENSAL"
    tipo: "mensal"
    itens_count: 8

conectores_utilizados:
  - "CONN-ERP-FINANCEIRO"
  - "CONN-GATEWAY-PAGAMENTO"
  - id: "CONN-PLATAFORMA-PRODUTO"
    tipo: OUTBOUND
    proposito: "Executar suspensão e reativação de acesso ao serviço por inadimplência; receita.suspensao_executada só é publicado após confirmação deste conector"
  - "CONN-EMAIL-TRANSACIONAL"
  - "CONN-MENSAGERIA"
  - "CONN-BANCO"

permissoes_necessarias:
  - recurso: "faturas"
    acoes: ["read", "write", "send", "cancel"]
  - recurso: "receita_reconhecida"
    acoes: ["read", "write"]
  - recurso: "mrr_bridge"
    acoes: ["read", "write"]
  - recurso: "reconciliacoes"
    acoes: ["read", "write"]
  - recurso: "kpi_values.KPI-RV-*"
    acoes: ["read", "write_via_eng02"]
  - recurso: "eventos_barramento"
    acoes: ["publish", "subscribe"]
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial |
| 2.0.0 | 2026-06-29 | Guardião da Documentação | Redesenho como microserviço do Commercial OS — 16 seções, arquitetura orientada a eventos, ENGINE-REGISTRATION.yaml |
