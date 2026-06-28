---
id: MOD-CAP-04
titulo: "Módulo Operacional — Gestão de Receita"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - MOD-CAP-03
  - MOD-CAP-05
  - MOD-CAP-06
  - MOD-CAP-08
tags: [receita, faturamento, cobranca, mrr, arr, nrr, churn, expansion, revenue]
---

# MOD-CAP-04 — Gestão de Receita

---

## 1. Objetivo da Capacidade

Garantir que toda receita contratada seja cobrada corretamente, no tempo certo, e que o crescimento da receita recorrente seja maximizado através do controle rigoroso de MRR/ARR, redução do churn de receita, expansão de contas existentes e previsão confiável de receita futura.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | Faturamento 100% correto e no prazo | 0% de contratos não faturados; ≤ 2% de erros de faturamento por mês |
| R2 | Inadimplência controlada | Taxa de inadimplência (>30 dias) ≤ [X]% da receita mensal |
| R3 | NRR (Net Revenue Retention) acima da meta | NRR ≥ [meta definida em CAP-08] — tipicamente ≥ 100% para SaaS/serviços recorrentes |
| R4 | Previsão de receita confiável | Desvio entre forecast e receita realizada ≤ 10% |
| R5 | Churn de receita monitorado e tratado | MRR Churn ≤ meta mensal; todo churn com causa documentada |

**Definição de Sucesso:** A empresa tem visibilidade completa de toda a receita contratada, recorrente e previsível, com 0% de oportunidade de cobrança perdida e NRR crescente mês a mês.

---

## 3. Entradas Necessárias

### 3.1 Entradas Primárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| Contrato assinado com condições | CAP-03 (Processo de Vendas) | Documento + CRM | Por evento |
| Dados de entrega e satisfação do cliente | CAP-05 (Gestão de Clientes) | Estruturado | Mensal |
| Solicitações de expansão (upsell/cross-sell) | CAP-05 (Gestão de Clientes) | CRM | Por evento |
| Avisos de cancelamento ou churn | CAP-05 (Gestão de Clientes) | CRM + Alerta | Por evento |
| Tabela de preços vigente | CAP-06 (Oferta e Precificação) | Documento | Por atualização |
| Metas de receita | CAP-08 (Performance) | Estruturado | Mensal |

---

## 4. Saídas Obrigatórias

### 4.1 Saídas Operacionais
| Saída | Destinatário | SLA |
|-------|-------------|-----|
| Nota fiscal / Fatura emitida | Cliente + Financeiro | Conforme data de vencimento contratual |
| Relatório de MRR/ARR | Liderança + CAP-08 | Até dia 5 do mês seguinte |
| Relatório de NRR | Liderança + CAP-08 | Mensal |
| Alerta de inadimplência | Gerente Comercial + CAP-05 | Imediato ao vencimento |
| Revenue Forecast | Liderança + CAP-08 | Semanal (rolling 3 meses) |

### 4.2 Métricas Calculadas e Publicadas
- MRR (Monthly Recurring Revenue) — total e por tipo (New, Expansion, Churn, Contraction)
- ARR (Annual Recurring Revenue)
- NRR (Net Revenue Retention)
- GRR (Gross Revenue Retention)
- MRR Churn Rate
- ARPU (Average Revenue per Unit/Customer)

---

## 5. Regras de Negócio

### RN-01: Faturamento Baseado em Contrato
- Todo faturamento DEVE ser baseado em contrato assinado vigente
- NENHUM valor pode ser cobrado sem contrato (exceto com aprovação formal da liderança)
- Condições de pagamento no boleto/fatura DEVEM espelhar exatamente o contrato

### RN-02: Calendário de Faturamento
- Faturas recorrentes DEVEM ser emitidas [X] dias antes do vencimento
- Fatura em atraso por erro interno (não emitida no prazo) NÃO pode gerar multa ou juros ao cliente — a responsabilidade é interna
- Faturamento de serviços adicionais DEVE ser feito no ciclo normal mais próximo, nunca retroativo sem aprovação

### RN-03: Gestão de Inadimplência
- Dia +1 após vencimento: e-mail automático de lembrete
- Dia +5: contato manual pelo responsável da conta (CAP-05)
- Dia +15: escalonamento para gerente comercial
- Dia +30: avaliação de suspensão do serviço (conforme contrato) + juridico
- Baixa de crédito DEVE ser aprovada pela liderança

### RN-04: Reconhecimento de Receita
- Receita recorrente é reconhecida no período de competência (mês de prestação do serviço)
- Receita de implantação/setup é reconhecida conforme entregáveis definidos no contrato
- Contratos anuais pagos à vista DEVEM ser reconhecidos como MRR proporcional mensalmente (não como receita única)

### RN-05: Expansão de Receita
- Toda expansão (upsell/cross-sell) DEVE gerar aditivo contratual ou novo contrato
- Expansão informalmente acordada sem formalização contratual NÃO pode ser reconhecida como receita

### RN-06: Cancelamento e Churn
- Solicitação de cancelamento DEVE ser recebida formalmente (e-mail ou formulário)
- Período de aviso prévio definido no contrato DEVE ser respeitado
- MRR Churn de contratos cancelados DEVE ser registrado na data de vigência do cancelamento (não da solicitação)

---

## 6. Fluxo Operacional Completo

```
ENTRADA
│
└─► Contrato assinado recebido de CAP-03
│
▼
REGISTRO DO CONTRATO NO SISTEMA DE RECEITA
│
├─► Cadastrar cliente no sistema de faturamento
├─► Configurar recorrência conforme contrato (mensal/anual/trimestral)
├─► Definir datas de vencimento
├─► Registrar no CRM como "Cliente Ativo" com MRR correspondente
└─► Atualizar MRR total (New MRR)
│
▼
CICLO MENSAL — FATURAMENTO
│
├─► [Dia -X do vencimento] Gerar e emitir fatura/NF
├─► Conferir se condições da fatura = condições do contrato
├─► Enviar fatura ao cliente (e-mail + portal se disponível)
└─► Registrar emissão no sistema
│
▼
MONITORAMENTO DE PAGAMENTO
│
├─► [Dia 0 — vencimento] Verificar status do pagamento
│
├─► [PAGO]
│     ├─ Registrar pagamento no sistema
│     ├─ Reconciliar com extrato bancário
│     └─ Atualizar status no CRM
│
└─► [NÃO PAGO]
      ├─ Dia +1: Lembrete automático (e-mail)
      ├─ Dia +5: Contato manual pelo CS (CAP-05)
      ├─ Dia +15: Escalonamento gerente
      └─ Dia +30: Avaliação de suspensão / jurídico
│
▼
EVENTOS DE RECEITA (PARALELO)
│
├─► [Expansão recebida de CAP-05]
│     ├─ Gerar aditivo / novo contrato (CAP-03.5)
│     ├─ Atualizar MRR (Expansion MRR)
│     └─ Atualizar NRR
│
├─► [Cancelamento recebido de CAP-05]
│     ├─ Registrar data de vigência do cancelamento
│     ├─ Emitir fatura final conforme aviso prévio
│     └─ Atualizar MRR (Churn MRR)
│
└─► [Contração — redução de escopo]
      ├─ Formalizar via aditivo contratual
      └─ Atualizar MRR (Contraction MRR)
│
▼
CONSOLIDAÇÃO MENSAL
│
├─► Calcular MRR bridge (New + Expansion − Churn − Contraction)
├─► Calcular NRR e GRR
├─► Gerar Revenue Forecast (rolling 3 meses)
├─► Publicar relatório para liderança e CAP-08
└─► Comparar forecast vs. realizado do mês anterior
│
▼
REGISTRO
│
├─► Todos os movimentos de receita registrados com data e tipo
├─► Contratos, faturas e comprovantes arquivados no repositório oficial
└─► MRR histórico preservado para análise de tendência
│
▼
AUDITORIA
│
└─► Verificação mensal: reconciliação bancária,
    0 contratos sem fatura, NRR calculado, forecast atualizado
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPIs de Receita Recorrente
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-RV-01 | MRR Total | Soma de toda receita recorrente mensal ativa | Meta de CAP-08 | Mensal |
| KPI-RV-02 | New MRR | MRR de contratos novos no mês | Meta de CAP-08 | Mensal |
| KPI-RV-03 | Expansion MRR | MRR adicional de expansões no mês | Meta de CAP-08 | Mensal |
| KPI-RV-04 | Churn MRR | MRR perdido por cancelamentos no mês | ≤ Meta de CAP-08 | Mensal |
| KPI-RV-05 | MRR Net Growth | New MRR + Expansion MRR − Churn MRR − Contraction MRR | Positivo (crescimento) | Mensal |
| KPI-RV-06 | ARR | MRR × 12 | Meta anual | Mensal |

### 7.2 KPIs de Retenção
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-RV-07 | NRR (Net Revenue Retention) | (MRR início + Expansion − Churn − Contraction) / MRR início × 100 | ≥ [meta] — idealmente ≥ 100% | Mensal |
| KPI-RV-08 | GRR (Gross Revenue Retention) | (MRR início − Churn − Contraction) / MRR início × 100 | ≥ [meta] — idealmente ≥ 85% | Mensal |
| KPI-RV-09 | MRR Churn Rate | Churn MRR / MRR total × 100 | ≤ [meta] | Mensal |

### 7.3 KPIs de Faturamento e Cobrança
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-RV-10 | Taxa de inadimplência | Faturas em atraso >30 dias / Receita total × 100 | ≤ [X]% | Mensal |
| KPI-RV-11 | Acuracidade do faturamento | (1 − Erros de fatura / Total faturas) × 100 | ≥ 98% | Mensal |
| KPI-RV-12 | Acuracidade do forecast | (1 − |Forecast − Realizado| / Realizado) × 100 | ≥ 90% | Mensal |

---

## 8. Gatilhos e Alertas Operacionais

| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-RV-01 | Fatura não paga no vencimento | Lembrete automático ao cliente | Sistema |
| ALT-RV-02 | Fatura em atraso >5 dias | Notificação para CS responsável (CAP-05) | Sistema |
| ALT-RV-03 | Fatura em atraso >15 dias | Escalonamento para Gerente Comercial | Sistema |
| ALT-RV-04 | Fatura em atraso >30 dias | Alerta para liderança + avaliação jurídica | Sistema + Gerente |
| ALT-RV-05 | MRR Churn Rate acima da meta por 2 meses | Reunião emergencial: CAP-04 + CAP-05 + Liderança | Liderança |
| ALT-RV-06 | NRR abaixo de 95% no mês | Análise de causa raiz imediata + plano de expansão acelerado | Gerente + CAP-05 |
| ALT-RV-07 | Contrato vence em 30 dias sem sinal de renovação | Alerta para CS + início de processo de renovação | Sistema → CAP-05 |
| ALT-RV-08 | Desvio forecast vs. realizado >15% | Revisão da metodologia de forecast | Responsável de Receita |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

| Desvio Observado | Possíveis Causas Raiz | Método de Diagnóstico |
|-----------------|----------------------|----------------------|
| NRR abaixo de 100% | Churn alto; ausência de expansão; contração de contratos | Decomposição do MRR bridge; análise de motivos de churn |
| Alta inadimplência | Fluxo de caixa dos clientes; problemas com a fatura; processo de cobrança ineficaz | Análise por segmento, por faixa de valor, por tipo de cliente |
| Forecast impreciso | Critérios de pipeline mal definidos; oportunidades superavaliadas; sazonalidade não considerada | Análise de forecast vs. realizado histórico por fonte de dados |
| Erro de faturamento alto | Processo manual; dados do contrato mal cadastrados; múltiplos sistemas desconectados | Auditoria de processo de cadastro e emissão de fatura |
| Churn MRR crescente | Baixo valor percebido; problemas de entrega (CAP-05); concorrência; preço | Análise de motivos de cancelamento + NPS dos churned customers |

---

## 10. Planos de Ação Padronizados

### PA-RV-01: NRR Abaixo de 100% por 2 Meses Consecutivos
```
Semana 1: Decomposição completa do MRR bridge dos últimos 2 meses
Semana 2: Análise detalhada dos motivos de churn (entrevistas com churned customers)
Semana 3: Identificar 10 clientes com maior risco de churn (CAP-05) → intervenção proativa
Semana 4: Lançar iniciativa de expansão nas 20 maiores contas ativas
Mês 2: Monitorar NRR semanalmente
```

### PA-RV-02: Inadimplência Acima de [Meta]
```
Imediato: Listar todas as faturas em atraso + responsável por conta
Semana 1: Contato direto em todas as faturas >15 dias (CAP-05)
Semana 2: Renegociação de prazo para faturas >30 dias (com aprovação da liderança)
Semana 3: Avaliação jurídica para faturas >60 dias
Paralelo: Revisar processo de cobrança e canais de pagamento disponíveis
```

### PA-RV-03: Forecast Desvio >15%
```
Semana 1: Revisar critérios de probabilidade por etapa do funil
Semana 2: Recalibrar pesos do modelo de forecast com base em dados históricos
Semana 3: Implementar revisão semanal de forecast (não apenas mensal)
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Mensal (Responsável de Receita / Financeiro)
**Checklist:**
- [ ] Reconciliação bancária: pagamentos recebidos vs. faturas emitidas
- [ ] 0 contratos ativos sem fatura emitida no mês
- [ ] MRR bridge calculado e publicado (New, Expansion, Churn, Contraction)
- [ ] NRR e GRR calculados
- [ ] Lista de inadimplentes atualizada (>30 dias) com status de tratamento
- [ ] Forecast do próximo mês publicado

### 11.2 Auditoria Trimestral (Liderança)
**Checklist:**
- [ ] Tendência de NRR (3 meses)
- [ ] Análise de cohort de churn: quais segmentos/perfis churnam mais
- [ ] Revisão da estratégia de expansão de receita
- [ ] ARPU por segmento calculado e comparado com meta de CAP-06
- [ ] ARR projetado para próximos 12 meses

### 11.3 Auditoria Anual (Liderança + Conselho)
**Checklist:**
- [ ] ARR realizado vs. meta do ano
- [ ] Evolução histórica do NRR (12 meses)
- [ ] Análise de concentração de receita (nenhum cliente >20% do total)
- [ ] Previsão de ARR para o próximo ano com premissas documentadas

---

## 12. Possibilidades de Automação

### 12.1 Faturamento e Cobrança
| Automação | Ferramenta | Trigger | Ação |
|-----------|----------|---------|------|
| Emissão automática de NF/fatura | ERP/Financeiro integrado | Data de faturamento do contrato | Emite, envia ao cliente e registra |
| Lembretes automáticos de pagamento | ERP/CRM | +1, +5, +15 dias de atraso | E-mail automático escalonado |
| Cobrança recorrente automática | Gateway de pagamento (Stripe, PagSeguro) | Data de vencimento | Débito automático no cartão/débito |
| Reconciliação bancária automática | ERP + API bancária | Diariamente | Baixa faturas pagas automaticamente |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Previsão de churn por cliente | ML identifica padrões de comportamento que precedem cancelamento |
| Forecast de receita preditivo | Modelo de ML calcula forecast mais preciso que cálculo manual |
| Identificação de oportunidades de expansão | IA identifica clientes com alto potencial de upsell (uso, engajamento, NPS) |

### 12.3 Dashboards
| Dashboard | Métricas | Público |
|-----------|---------|---------|
| Revenue Overview | MRR, ARR, NRR, GRR, Churn Rate | Liderança (tempo real) |
| MRR Bridge | New/Expansion/Churn/Contraction visual | Gerente + Liderança (mensal) |
| Cobrança e Inadimplência | Faturas em aberto, tempo médio de pagamento | Financeiro + Gerente (diário) |
| Revenue Forecast | Pipeline de receita por mês (rolling 3M) | Liderança (semanal) |

### 12.4 Integrações
- **CAP-03 (Contratos) → Faturamento:** Contrato assinado aciona automaticamente o cadastro no sistema de faturamento
- **CAP-05 (Clientes) → CAP-04:** Cancelamentos e expansões notificam automaticamente o módulo de receita
- **CAP-04 → CAP-08:** MRR e NRR publicados automaticamente no dashboard de performance

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 Matriz de Interfaces

| Módulo | Tipo | CAP-04 Fornece | CAP-04 Recebe |
|--------|------|----------------|---------------|
| CAP-03 Processo de Vendas | Recebe | — | Contratos assinados com condições de faturamento |
| CAP-05 Gestão de Clientes | Bilateral | Alertas de inadimplência para o CS responsável | Eventos de expansão, cancelamento e contração |
| CAP-06 Oferta e Precificação | Recebe | Dados de ARPU e ticket médio realizado (feedback) | Tabela de preços vigente |
| CAP-08 Performance e Autogestão | Fornece | MRR, ARR, NRR, Forecast, Churn Rate | Metas de receita e crescimento |
| CAP-01 Inteligência Comercial | Fornece | Dados de NRR e churn por segmento | — |

### 13.2 Sequência Crítica de Dependências
```
CAP-03 (Contrato assinado)
    → CAP-04 (Registra MRR + agenda faturamento)
    → CAP-05 (Cliente ativo = ativado para success)
    → CAP-08 (MRR adicionado ao dashboard de performance)
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-04 |
