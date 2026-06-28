---
id: MOD-CAP-05
titulo: "Módulo Operacional — Gestão de Clientes"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - MOD-CAP-03
  - MOD-CAP-04
  - MOD-CAP-06
  - MOD-CAP-08
tags: [clientes, customer-success, onboarding, retencao, churn, nps, expansao, relacionamento]
---

# MOD-CAP-05 — Gestão de Clientes

---

## 1. Objetivo da Capacidade

Garantir que cada cliente alcance e perceba o valor contratado, maximize o uso da solução ao longo do tempo, renove e expanda o relacionamento, e se torne um promotor ativo da empresa — reduzindo churn, aumentando NRR e construindo uma base de clientes saudável e crescente.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | Onboarding concluído dentro do prazo | 100% dos clientes com onboarding finalizado dentro do SLA contratual |
| R2 | Adoção medida e crescente | Uso mensurado para ≥ 90% dos clientes ativos; adoção mínima de [X]% dos itens contratados |
| R3 | Churn controlado | Churn rate ≤ meta de CAP-08; todo churn com causa documentada |
| R4 | NPS positivo e em crescimento | NPS ≥ [meta]; aplicado sistematicamente conforme cadência |
| R5 | Expansão de receita gerada | Expansion MRR ≥ meta definida em CAP-08; identificação proativa de oportunidades |

**Definição de Sucesso:** Cada cliente tem um responsável designado (CS), um health score calculado, um plano de sucesso documentado e está ativamente monitorado para riscos e oportunidades.

---

## 3. Entradas Necessárias

### 3.1 Entradas Primárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| Briefing de onboarding do novo cliente | CAP-03 (Processo de Vendas) | Documento + CRM | Por evento (novo cliente) |
| Contrato com escopo e condições | CAP-03 / CAP-04 | Documento | Por evento |
| MRR e dados de faturamento do cliente | CAP-04 (Gestão de Receita) | Estruturado | Mensal |
| Portfólio de soluções | CAP-06 (Oferta e Precificação) | Documento | Por atualização |
| Metas de NRR e Churn | CAP-08 (Performance) | Estruturado | Mensal |

### 3.2 Entradas de Operação
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| Dados de uso/adoção do produto/serviço | Sistema / relatórios | Estruturado | Semanal / mensal |
| Tickets de suporte e reclamações | Sistema de suporte | Estruturado | Contínua |
| NPS e feedbacks de satisfação | Pesquisas ativas | Estruturado | Trimestral / por evento |
| Feedbacks em reuniões de acompanhamento | CS (registro manual) | Semiestruturado | Por evento |

---

## 4. Saídas Obrigatórias

### 4.1 Saídas para Clientes
| Saída | Prazo / SLA |
|-------|------------|
| Plano de Onboarding entregue ao cliente | Até [X] dias após assinatura do contrato |
| Check-in regular (reunião ou relatório) | Conforme cadência definida no plano de sucesso |
| Relatório de resultados periódico | Mensal ou conforme contrato |
| NPS survey enviado | Trimestral (ou após marcos críticos) |

### 4.2 Saídas para Módulos Internos
| Saída | Destinatário | SLA |
|-------|-------------|-----|
| Oportunidade de expansão identificada | CAP-02 + CAP-03 | Imediato ao identificar |
| Risco de churn sinalizado | CAP-04 + Liderança | Imediato ao identificar |
| Customer Health Score por cliente | CAP-08 (Performance) | Atualizado mensalmente |
| Dados de NPS e satisfação | CAP-01 (Inteligência Comercial) | Trimestral |
| Solicitação de cancelamento | CAP-04 (Gestão de Receita) | Imediato ao receber |

---

## 5. Regras de Negócio

### RN-01: Designação de CS (Customer Success)
- Todo cliente ativo DEVE ter um CS designado e registrado no CRM
- A capacidade máxima por CS é de [N] clientes (definir conforme complexidade do produto)
- Rebalanceamento de carteira DEVE ocorrer quando desvio de >20% entre CSs da equipe

### RN-02: Onboarding
- O processo de onboarding DEVE ser iniciado em até [X] dias após a assinatura do contrato
- O onboarding tem prazo máximo de [N] dias para ser concluído
- "Onboarding concluído" é definido por: [critérios específicos de adoção inicial]
- Atraso no onboarding além de [X] dias DEVE escalar automaticamente para o gerente de CS

### RN-03: Cadência de Contato
- Clientes em onboarding: contato semanal
- Clientes em uso normal: contato conforme health score:
  - Health Score ≥ 8 (verde): Contato mensal
  - Health Score 5–7 (amarelo): Contato quinzenal
  - Health Score < 5 (vermelho): Contato semanal + plano de ação ativo
- Nenhum cliente pode ficar sem contato por >60 dias

### RN-04: Health Score
- O Health Score DEVE ser calculado mensalmente para todos os clientes ativos
- O Health Score considera (pesos a definir): NPS, uso do produto, cumprimento de prazo de pagamento, tickets abertos, engajamento com o CS
- Mudança de faixa (verde→amarelo, amarelo→vermelho) aciona alerta automático

### RN-05: Expansão e Upsell
- CS DEVE identificar e registrar oportunidades de expansão no CRM
- Oportunidade de expansão validada é transferida formalmente para CAP-03 (não tratada diretamente pelo CS sem o processo comercial)
- CS não pode fechar expansão sem envolver o processo de CAP-03 e a emissão de aditivo contratual (CAP-04)

### RN-06: Cancelamento
- Toda solicitação de cancelamento DEVE ser recebida formalmente e registrada no CRM imediatamente
- Protocolo de retenção DEVE ser executado antes de aceitar o cancelamento (salvo cancelamento com justa causa)
- Motivo do cancelamento DEVE ser documentado com categoria padronizada (lista fechada)
- CS responsável NÃO pode aceitar cancelamento verbal sem registro

---

## 6. Fluxo Operacional Completo

```
ENTRADA
│
└─► Novo cliente (briefing de onboarding de CAP-03)
│
▼
FASE 1 — ONBOARDING
│
├─► Designar CS responsável (RN-01)
├─► Agendar kickoff meeting com cliente
├─► Criar Plano de Sucesso do Cliente (metas, marcos, critérios de sucesso)
├─► Executar onboarding conforme plano (treinamentos, configurações, entregas)
├─► Validar critérios de conclusão do onboarding
└─► Comunicar conclusão → CRM atualizado; cliente entra em fase de "Uso Ativo"
│
▼
FASE 2 — USO ATIVO E ACOMPANHAMENTO (ciclo mensal)
│
├─► [Coleta de dados de uso/adoção] — semanal ou por integração
├─► [Cálculo do Health Score] — mensal
├─► [Reunião / check-in conforme cadência do health score] (RN-03)
├─► [Pesquisa NPS trimestral]
└─► [Identificação de oportunidades e riscos]
│
▼
DECISÃO — Status do Cliente
│
├─► [Health Score VERDE → manter cadência; buscar oportunidades de expansão]
├─► [Health Score AMARELO → intensificar contato; identificar causa; plano de ação]
└─► [Health Score VERMELHO → acionar protocolo de salvamento; escalar se necessário]
│
▼
EVENTO — Expansão Identificada
│
├─► CS documenta oportunidade no CRM
├─► Transfere para CAP-03 (Processo de Vendas) como nova oportunidade
└─► Monitora evolução → se fechada, atualiza MRR em CAP-04
│
▼
EVENTO — Risco de Churn / Solicitação de Cancelamento
│
├─► Registrar imediatamente no CRM
├─► Identificar motivo (conversa + categoria padronizada)
├─► Executar protocolo de retenção:
│     ├─ Reunião de diagnóstico com cliente
│     ├─ Proposta de plano de ação para resolver o problema raiz
│     └─ Envolver liderança se necessário
├─► [Retido] → Atualizar plano de sucesso + intensificar acompanhamento
└─► [Churned] → Registrar motivo + notificar CAP-04 + Win/Loss para CAP-01
│
▼
RENOVAÇÃO (60 dias antes do vencimento)
│
├─► Alerta automático para CS
├─► Apresentar resultados obtidos no período (Business Review)
├─► Negociar renovação com condições atualizadas
└─► Transferir renovação/expansão para CAP-03 para formalização
│
▼
REGISTRO E AUDITORIA
│
└─► Todos os contatos, planos, NPS, health scores e eventos registrados no CRM
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPIs de Retenção
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-CS-01 | Churn Rate (clientes) | Clientes cancelados / Total clientes início do período × 100 | ≤ [meta] | Mensal |
| KPI-CS-02 | Logo Retention Rate | (Clientes início − Churns) / Clientes início × 100 | ≥ [meta] | Mensal |
| KPI-CS-03 | Tempo médio de vida do cliente | Média de meses entre início e cancelamento | ≥ [meta] | Trimestral |

### 7.2 KPIs de Satisfação
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-CS-04 | NPS (Net Promoter Score) | % Promotores − % Detratores | ≥ [meta] | Trimestral |
| KPI-CS-05 | CSAT (Customer Satisfaction Score) | Média das notas de satisfação de atendimentos | ≥ [meta] / 10 | Por evento |

### 7.3 KPIs de Sucesso do Cliente
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-CS-06 | Onboarding concluído no prazo | Clientes com onboarding no SLA / Total novos clientes × 100 | ≥ 95% | Mensal |
| KPI-CS-07 | Taxa de adoção | % dos itens contratados em uso ativo | ≥ [meta] por segmento | Mensal |
| KPI-CS-08 | Health Score médio da base | Média ponderada dos health scores | ≥ 7 | Mensal |
| KPI-CS-09 | % Clientes em zona de risco (vermelho) | Clientes com HS < 5 / Total × 100 | ≤ [meta]% | Mensal |

### 7.4 KPIs de Expansão
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-CS-10 | Expansion MRR gerado pelo CS | Soma do MRR de expansões originadas pelo CS | Meta de CAP-08 | Mensal |
| KPI-CS-11 | Taxa de expansão na base | Clientes com expansão no período / Total × 100 | ≥ [meta]% | Trimestral |

---

## 8. Gatilhos e Alertas Operacionais

| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-CS-01 | Novo cliente sem CS designado após 24h | Alerta para gerente de CS | Sistema |
| ALT-CS-02 | Onboarding com atraso > SLA definido | Escalonamento para gerente de CS | Sistema |
| ALT-CS-03 | Health Score cai para faixa AMARELA | Alerta para CS + agenda contato quinzenal | Sistema |
| ALT-CS-04 | Health Score cai para faixa VERMELHA | Alerta urgente para CS + Gerente; ativar protocolo de salvamento | Sistema |
| ALT-CS-05 | Cliente sem contato há >45 dias | Alerta para CS responsável | Sistema |
| ALT-CS-06 | NPS ≤ 6 (detrator identificado) | Contato imediato do CS em até 24h para entender e tratar | CS + Gerente |
| ALT-CS-07 | Solicitação de cancelamento recebida | Notificação imediata: CS + Gerente + CAP-04 | Sistema |
| ALT-CS-08 | Contrato vence em 60 dias | Alerta para CS iniciar processo de renovação | Sistema |
| ALT-CS-09 | Fatura em atraso >5 dias (de CAP-04) | CS contacta cliente para entender e facilitar pagamento | CAP-04 → CS |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

| Desvio Observado | Possíveis Causas Raiz | Método de Diagnóstico |
|-----------------|----------------------|----------------------|
| Churn acima da meta | Baixa adoção; expectativas não atendidas; problemas de entrega; concorrência; preço | Análise de motivos de churn por categoria; entrevistas com clientes churned |
| NPS baixo | Problemas de entrega; expectativas criadas na venda ≠ realidade; CS ineficaz; produto inadequado | Análise de comentários; separar promotores vs. detratores por segmento |
| Onboarding atrasado | Falta de recursos internos; cliente não engajado; processo mal definido; handoff ruim de vendas | Auditoria de onboardings atrasados; análise do handoff CAP-03 → CAP-05 |
| Baixa adoção | Produto complexo; falta de treinamento; benefício não percebido; champion interno fraco | Análise de uso; sessões de QBR com clientes de baixa adoção |
| Expansão abaixo da meta | CS não identifica oportunidades; timing ruim; base de clientes pequena; produto sem expansibilidade | Análise de carteira: quantos clientes têm potencial não explorado |

---

## 10. Planos de Ação Padronizados

### PA-CS-01: Protocolo de Salvamento (Cliente em Risco de Churn)
```
Dia 1: CS agenda reunião de diagnóstico urgente com cliente (dentro de 48h)
Dia 2-3: Reunião de diagnóstico — entender causa raiz da insatisfação
Dia 4: Elaborar plano de ação específico para resolver o problema raiz
Dia 5: Apresentar plano ao cliente; acordo sobre marcos e prazos
Semanas 2-4: Execução do plano com check-ins semanais
Dia 30: Avaliação: cliente retido? → manter cadência intensificada; não retido → aceitar churn com documentação
```

### PA-CS-02: Churn Rate Acima da Meta por 2 Meses
```
Semana 1: Análise de todos os churns do período — categorizar motivos
Semana 2: Entrevistas (se possível) com 5 clientes que churnou nos últimos 60 dias
Semana 3: Identificar padrão — é produto, entrega, valor, preço ou fit?
Semana 4: Plano de ação específico baseado na causa encontrada
Mês 2: Implementação do plano; monitorar churn semanalmente
```

### PA-CS-03: Onboarding Sistematicamente Atrasado
```
Imediato: Auditar todos os onboardings ativos — quais estão em atraso e por quê
Semana 1: Revisar o processo de handoff de CAP-03 → CAP-05
Semana 2: Verificar se há gargalo de recursos (capacidade da equipe de CS)
Semana 3: Simplificar e documentar o processo de onboarding; criar checklists automatizados
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Semanal (CS — Auto-auditoria)
**Checklist:**
- [ ] Todos os clientes na carteira têm próxima ação definida
- [ ] Nenhum cliente em zona vermelha sem plano de ação ativo
- [ ] Todos os alertas do sistema foram tratados

### 11.2 Auditoria Mensal (Gerente de CS)
**Checklist:**
- [ ] Churn do mês calculado e registrado com motivos (KPI-CS-01)
- [ ] Health Score calculado para 100% da base
- [ ] NPS enviado conforme cadência (se mês de envio)
- [ ] Expansion MRR gerado pela carteira registrado
- [ ] Onboardings em andamento: dentro do SLA?
- [ ] Nenhum cliente há >60 dias sem contato documentado
- [ ] Relatório de status da base publicado para liderança

### 11.3 Auditoria Trimestral (Liderança)
**Checklist:**
- [ ] NPS consolidado e analisado por segmento
- [ ] Tendência de churn (3 meses) avaliada
- [ ] Capacidade de CS vs. carteira atual: equipe está sobrecarregada?
- [ ] Top 10 maiores clientes: todos com plano de sucesso atualizado?
- [ ] Análise de cohort: clientes do mesmo período — qual a taxa de sobrevivência?

---

## 12. Possibilidades de Automação

### 12.1 CRM e Customer Success
| Automação | Trigger | Ação |
|-----------|---------|------|
| Health Score automático | Mensal (dados coletados) | Calcula e atualiza HS por cliente; aciona alertas por mudança de faixa |
| Sequência de onboarding | Novo cliente ativado | Cria tarefas automáticas do checklist de onboarding no CRM |
| NPS automático | Trimestral ou marco de uso | Envia pesquisa NPS por e-mail e registra resposta no CRM |
| Alerta de renovação | 60 dias antes do vencimento | Cria tarefa e notifica CS |
| Relatório mensal automático | Dia 1 do mês | Gera draft do relatório de resultados do cliente com dados do mês |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Previsão de churn | ML identifica clientes com >X% de probabilidade de churn no próximo mês com base em padrões de comportamento |
| Identificação de oportunidade de expansão | IA analisa uso + histórico e identifica o melhor momento e produto para upsell |
| Sumarização de interações | IA resume histórico de interações com o cliente para o CS novo que assumir a carteira |
| Análise de sentimento em tickets | IA classifica tickets por urgência e sentimento; priorizando os mais críticos |

### 12.3 Dashboards
| Dashboard | Métricas | Público |
|-----------|---------|---------|
| Customer Health Board | Health Score por cliente, % em cada faixa, tendência | Gerente de CS (tempo real) |
| CS Individual | Carteira, health scores, tarefas pendentes, churn da carteira | CS (diário) |
| Executive Overview | Churn Rate, NRR, NPS, Expansion MRR | Liderança (mensal) |
| Cohort Analysis | Retenção de clientes por coorte de entrada | Liderança (trimestral) |

### 12.4 Integrações
- **CAP-03 → CAP-05:** Handoff automático: ao fechar oportunidade, cria registro de onboarding no sistema de CS
- **CAP-04 → CAP-05:** Inadimplência ativa notificação automática para o CS responsável
- **CAP-05 → CAP-04:** Churn ou expansão identificada atualiza MRR em CAP-04 automaticamente
- **CAP-05 → CAP-02:** Expansão ou upsell identificado cria oportunidade automaticamente em CAP-02

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 Matriz de Interfaces

| Módulo | Tipo | CAP-05 Fornece | CAP-05 Recebe |
|--------|------|----------------|---------------|
| CAP-01 Inteligência Comercial | Fornece | NPS, churn com motivos, padrões de sucesso/fracasso | ICP refinado, perfil de cliente ideal |
| CAP-02 Gestão de Demanda | Fornece | Oportunidades de expansão → novas oportunidades de pipeline | — |
| CAP-03 Processo de Vendas | Bilateral | Capacidade de atendimento disponível | Briefing de onboarding do novo cliente |
| CAP-04 Gestão de Receita | Bilateral | Eventos de expansão, cancelamento, contração | Alertas de inadimplência, dados de MRR por cliente |
| CAP-06 Oferta e Precificação | Recebe | Feedback sobre adequação da oferta às necessidades reais do cliente | Portfólio atualizado de soluções |
| CAP-07 Equipe Comercial | Recebe | — | Dados de capacidade e habilidades dos CSs |
| CAP-08 Performance e Autogestão | Bilateral | Health Score, Churn Rate, NPS, Expansion MRR | Metas de retenção, churn e NRR |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-05 |
