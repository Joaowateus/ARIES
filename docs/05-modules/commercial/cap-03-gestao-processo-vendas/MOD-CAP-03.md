---
id: MOD-CAP-03
titulo: "Módulo Operacional — Gestão do Processo de Vendas"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - MOD-CAP-01
  - MOD-CAP-02
  - MOD-CAP-04
  - MOD-CAP-06
tags: [vendas, processo, pipeline, proposta, negociacao, fechamento, contrato]
---

# MOD-CAP-03 — Gestão do Processo de Vendas

> **Nota:** Este módulo contempla também CAP-03.5 (Gestão de Contratos) como subprocesso final integrado ao ciclo de vendas.

---

## 1. Objetivo da Capacidade

Conduzir oportunidades comerciais qualificadas desde o primeiro contato até o fechamento e formalização contratual, através de um processo estruturado, reproduzível e mensurável que maximize a taxa de conversão, minimize o ciclo de vendas e garanta a entrega de valor prometida ao cliente antes mesmo da assinatura.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | Pipeline convertido em receita | Taxa de fechamento (SQL → Cliente) ≥ meta definida em CAP-08 |
| R2 | Ciclo de vendas dentro do SLA | Ciclo médio ≤ benchmark por segmento definido em CAP-01 |
| R3 | Proposta entregue dentro do prazo | 100% das propostas entregues em até [SLA definido por segmento] dias após reunião de discovery |
| R4 | Processo registrado no CRM | 100% das etapas e interações registradas; nenhuma oportunidade "na cabeça" do vendedor |
| R5 | Contratos formalizados antes do início | 0% de clientes em operação sem contrato assinado |

**Definição de Sucesso:** Qualquer oportunidade pode ser auditada a qualquer momento no CRM, com histórico completo de todas as interações, etapa atual, próxima ação e data prevista de fechamento.

---

## 3. Entradas Necessárias

### 3.1 Entradas Primárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| SQL qualificado com contexto de qualificação | CAP-02 (Gestão de Demanda) | CRM | Por evento |
| Portfólio de soluções e tabela de preços | CAP-06 (Oferta e Precificação) | Documento | Por atualização |
| Inteligência competitiva e materiais de apoio | CAP-01 (Inteligência Comercial) | Documento/CRM | Por atualização |
| Capacidade de atendimento pós-venda | CAP-05 (Gestão de Clientes) | Estruturado | Mensal |

### 3.2 Entradas por Etapa do Processo
| Etapa | Entrada Necessária |
|-------|-------------------|
| Discovery | ICP Document, roteiro de perguntas de discovery |
| Proposta | Tabela de preços, template de proposta, autorização de desconto |
| Negociação | Limites de desconto aprovados, BATNA documentado |
| Fechamento | Proposta aceita, dados do cliente para contrato |
| Contrato | Template de contrato, dados fiscais do cliente, condições negociadas |

---

## 4. Saídas Obrigatórias

### 4.1 Saídas Principais
| Saída | Destinatário | SLA |
|-------|-------------|-----|
| Contrato assinado | CAP-04 (Receita) + CAP-05 (Clientes) | Até 3 dias úteis após aceite da proposta |
| Briefing de onboarding | CAP-05 (Gestão de Clientes) | Junto com o contrato assinado |
| Registro completo da oportunidade no CRM | Todos os módulos | Atualizado em tempo real |
| Win/loss analysis | CAP-01 (Inteligência Comercial) | 48h após fechamento |

### 4.2 Dados Obrigatórios no CRM por Oportunidade
- Histórico de todas as interações (ligações, reuniões, e-mails, WhatsApp)
- Proposta(s) enviada(s) com versão e data
- Objeções levantadas e respostas dadas
- Decisores identificados e mapeados
- Motivo de ganho ou perda (ao fechar)
- Valor contratado e condições acordadas

---

## 5. Regras de Negócio

### RN-01: Etapas Obrigatórias do Funil de Vendas
O processo de vendas possui [N] etapas padronizadas que DEVEM ser seguidas sequencialmente:
```
[1] Primeiro Contato → [2] Discovery → [3] Análise de Fit →
[4] Proposta → [5] Negociação → [6] Fechamento → [7] Contrato
```
- Não é permitido "pular" etapas sem justificativa documentada no CRM
- Cada etapa tem critérios de saída (exit criteria) que DEVEM ser atendidos antes de avançar

### RN-02: Limites de Desconto
- Descontos de até [X]% podem ser concedidos pelo próprio vendedor
- Descontos entre [X+1]% e [Y]% requerem aprovação do gerente comercial
- Descontos acima de [Y]% requerem aprovação da liderança
- NENHUM desconto é válido se não estiver registrado na proposta oficial

### RN-03: Prazo de Validade da Proposta
- Toda proposta emitida tem validade de [15/30] dias
- Proposta vencida NÃO pode ser executada sem nova aprovação
- Reemissão de proposta com condições alteradas DEVE ser feita com nova numeração e versão

### RN-04: Formalização Contratual (CAP-03.5)
- NENHUM serviço ou produto pode ser iniciado sem contrato assinado pelas duas partes
- Contratos DEVEM utilizar apenas os templates aprovados pelo jurídico (se aplicável)
- Alterações de escopo pós-contrato DEVEM ser formalizadas via aditivo contratual
- Contrato original DEVE ser arquivado em repositório oficial (não apenas em e-mail)

### RN-05: Múltiplos Decisores
- Em oportunidades com ticket acima de [THRESHOLD], DEVE ser mapeado o comitê de compra (todos os influenciadores e decisores)
- A proposta DEVE ser apresentada ao decisor final (não apenas ao influenciador)

### RN-06: Atualização de Pipeline
- Toda oportunidade DEVE ter a data de "próxima ação" atualizada no CRM
- Oportunidade sem atualização por >5 dias úteis gera alerta automático
- Forecast (previsão de fechamento) DEVE ser revisado semanalmente pelo gerente

---

## 6. Fluxo Operacional Completo

```
ENTRADA
│
└─► SQL recebido de CAP-02 (com contexto de qualificação)
│
▼
ETAPA 1 — PRIMEIRO CONTATO
│
├─► Vendedor contacta lead em até 4h após recebimento do SQL
├─► Objetivo: confirmar interesse, apresentar brevemente, agendar Discovery
└─► CRM: registra contato, agenda próxima ação
│
▼
ETAPA 2 — DISCOVERY (Reunião de Diagnóstico)
│
├─► Reunião estruturada com roteiro padronizado de perguntas
├─► Mapear: dores, contexto atual, resultados esperados, decisores, orçamento, prazo
├─► Confirmar ou reclassificar o ICP Score
└─► CRM: registra achados, próxima ação, avança etapa
│
▼
DECISÃO — Fit Real?
│
├─► SIM → Avançar para proposta
└─► NÃO → Desqualificar com motivo + Win/Loss + retroalimentar CAP-01
│
▼
ETAPA 3 — PROPOSTA
│
├─► Elaborar proposta personalizada baseada no discovery
├─► Aplicar regras de precificação de CAP-06
├─► Obter aprovação de desconto se necessário (RN-02)
├─► Enviar proposta formal dentro do SLA
└─► CRM: registra envio, versão, validade, próxima ação (apresentação)
│
▼
ETAPA 4 — APRESENTAÇÃO E NEGOCIAÇÃO
│
├─► Apresentar proposta ao(s) decisor(es)
├─► Registrar todas as objeções e respostas no CRM
├─► Negociar dentro dos limites autorizados
└─► CRM: registra posição da negociação, objeções, próximos passos
│
▼
DECISÃO — Proposta Aceita?
│
├─► SIM → Avançar para fechamento
├─► NÃO (objeções tratáveis) → Iterar proposta (max 2 revisões sem aprovação)
└─► NÃO (sem evolução) → Desqualificar + Win/Loss
│
▼
ETAPA 5 — FECHAMENTO
│
├─► Confirmar todos os termos acordados por escrito (e-mail de confirmação)
├─► Formalizar aprovação do cliente
└─► CRM: marcar como "Ganho" com valor e condições
│
▼
ETAPA 6 — CONTRATO (CAP-03.5)
│
├─► Gerar contrato usando template aprovado
├─► Preencher com condições exatas acordadas
├─► Enviar para assinatura do cliente (assinatura eletrônica preferencialmente)
├─► Aguardar retorno assinado
└─► Arquivar contrato assinado no repositório oficial
│
▼
SAÍDA
│
├─► Contrato assinado → CAP-04 (Receita) para faturamento
├─► Briefing de onboarding → CAP-05 (Clientes)
├─► Win/Loss Analysis → CAP-01 (Inteligência)
└─► CRM atualizado com status "Cliente Ativo"
│
▼
REGISTRO
│
├─► Toda a jornada da oportunidade registrada no CRM
├─► Contrato arquivado em repositório oficial com índice
└─► Receita lançada no pipeline de receita (CAP-04)
│
▼
AUDITORIA
│
└─► Verificação mensal: completude do CRM, contratos sem assinatura,
    oportunidades paradas, aderência ao processo por etapa
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPIs de Conversão
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-PV-01 | Win Rate (SQL → Cliente) | Oportunidades ganhas / SQLs recebidos × 100 | Meta por segmento (CAP-01) | Mensal |
| KPI-PV-02 | Taxa de conversão por etapa | Oportunidades que avançam / Total em cada etapa × 100 | Benchmark por etapa | Semanal |
| KPI-PV-03 | Taxa de proposta enviada | SQLs que chegaram à etapa proposta / Total SQLs × 100 | ≥ 60% | Mensal |

### 7.2 KPIs de Velocidade
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-PV-04 | Ciclo médio de vendas | Dias da entrada do SQL ao fechamento (média) | ≤ Benchmark por segmento | Mensal |
| KPI-PV-05 | Tempo até primeiro contato | Minutos/horas entre recebimento do SQL e 1º contato | ≤ 4h (100% dos casos) | Semanal |
| KPI-PV-06 | Tempo até proposta enviada | Dias entre Discovery e envio da proposta | ≤ SLA por segmento | Mensal |

### 7.3 KPIs de Receita
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-PV-07 | Ticket médio por segmento | Receita total / Nº de clientes novos por segmento | Meta definida em CAP-06 | Mensal |
| KPI-PV-08 | Desconto médio concedido | Soma de descontos / Soma do valor cheio × 100 | ≤ [X]% | Mensal |
| KPI-PV-09 | Receita nova mensal (New MRR) | Soma de MRR de novos contratos assinados no mês | Meta de CAP-08 | Mensal |

### 7.4 KPIs de Conformidade (CAP-03.5)
| Código | Indicador | Meta | Frequência |
|--------|-----------|------|-----------|
| KPI-CT-01 | Clientes ativos sem contrato assinado | 0% | Mensal |
| KPI-CT-02 | Contratos assinados dentro do SLA (3 dias úteis após aceite) | ≥ 95% | Mensal |
| KPI-CT-03 | Contratos arquivados no repositório oficial | 100% | Mensal |

---

## 8. Gatilhos e Alertas Operacionais

| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-PV-01 | SQL sem primeiro contato após 4h | Alerta para vendedor + gerente | Sistema |
| ALT-PV-02 | Oportunidade sem atualização no CRM por >5 dias úteis | Alerta para vendedor + revisão de forecast | Sistema |
| ALT-PV-03 | Proposta com mais de [15] dias sem resposta | Alerta para follow-up ativo ou desqualificação | Vendedor |
| ALT-PV-04 | Win Rate abaixo de [meta - 15%] por 6 semanas | Revisão do processo + coaching individual | Gerente |
| ALT-PV-05 | Desconto médio acima de [Y+5]% | Revisão de autorização de descontos + reunião com liderança | Gerente + Liderança |
| ALT-PV-06 | Cliente ativo sem contrato assinado identificado | Regularização imediata obrigatória | Gerente + Jurídico |
| ALT-PV-07 | Proposta enviada há >30 dias sem fechamento | Definir: avançar, renegociar ou desqualificar | Vendedor + Gerente |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

| Desvio Observado | Possíveis Causas Raiz | Método de Diagnóstico |
|-----------------|----------------------|----------------------|
| Win Rate abaixo da meta | Discovery superficial; proposta inadequada; concorrência; qualificação ruim (vem de CAP-02); habilidade de fechamento | Análise de win/loss por etapa de desistência |
| Ciclo longo de vendas | Múltiplos decisores não mapeados; proposta não adequada ao contexto; follow-up insuficiente | Análise do tempo médio por etapa; oportunidades "paradas" |
| Alto desconto médio | Falta de diferenciação de valor; pressão de concorrência; vendedor sem confiança no preço | Análise desconto vs. motivo no CRM |
| Baixa taxa de proposta | Discovery não aprofundado; desqualificação prematura; falta de processo pós-discovery | Funil por etapa; gravação/revisão de reuniões de discovery |
| Contratos sem assinatura | Processo manual; cliente procrastina; sem urgência; template inadequado | Auditoria de contratos abertos; análise de tempo entre envio e assinatura |

---

## 10. Planos de Ação Padronizados

### PA-PV-01: Win Rate Abaixo da Meta por 6+ Semanas
```
Semana 1: Análise de todas as oportunidades perdidas (onde no funil cada uma saiu)
Semana 2: Sessão de diagnóstico colaborativo com a equipe (padrões de objeção)
Semana 3: Revisar roteiro de discovery e proposta com insights encontrados
Semana 4: Coaching individual para vendedores com maior desvio
Mês 2: Medir nova taxa de win rate por vendedor e geral
```

### PA-PV-02: Ciclo de Vendas Acima do Benchmark
```
Imediato: Mapear todas as oportunidades abertas com >2× o ciclo médio esperado
Semana 1: Identificar etapa onde as oportunidades "travam"
Semana 2: Implementar exit criteria mais rigorosos para não avançar sem critério
Semana 3: Definir prazo máximo por etapa com alerta automático
```

### PA-PV-03: Cliente Ativo Sem Contrato Detectado
```
Imediato: Parar entrega até regularização (exceto se comprometer cliente criticamente)
48h: Enviar contrato retroativo para assinatura
Paralelo: Investigar como a situação foi criada; corrigir o processo
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Semanal (Vendedor + Gerente — Pipeline Review)
**Checklist:**
- [ ] Todas as oportunidades têm "próxima ação" definida com data
- [ ] Nenhuma oportunidade parada há >5 dias úteis sem justificativa
- [ ] Forecast do mês atualizado (oportunidades marcadas como provável fechamento)
- [ ] Todos os SQLs recebidos tiveram primeiro contato registrado

### 11.2 Auditoria Mensal (Gerente Comercial)
**Checklist:**
- [ ] KPIs de conversão (PV-01 a PV-03) calculados e registrados
- [ ] KPIs de velocidade (PV-04 a PV-06) calculados
- [ ] Desconto médio calculado (PV-08)
- [ ] 100% das oportunidades fechadas têm win/loss analysis
- [ ] KPI-CT-01: 0 clientes sem contrato assinado
- [ ] Contratos do mês arquivados no repositório oficial

### 11.3 Auditoria Trimestral (Liderança)
**Checklist:**
- [ ] Análise de tendência de win rate por segmento
- [ ] Comparação de ciclo de vendas vs. benchmark de mercado
- [ ] Avaliação da eficácia do processo (etapas, critérios, templates)
- [ ] Revisão dos templates de proposta e contrato

---

## 12. Possibilidades de Automação

### 12.1 CRM
| Automação | Trigger | Ação |
|-----------|---------|------|
| Alerta de SQL sem contato | SQL criado + 4h sem atividade | Push notification para vendedor + gerente |
| Alerta de oportunidade parada | >5 dias sem atualização | Notificação automática |
| Forecast automático | Probabilidade de fechamento por etapa | Relatório semanal de forecast gerado automaticamente |
| Template de proposta pré-preenchido | Oportunidade avança para etapa "Proposta" | CRM preenche proposta com dados da oportunidade |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Sugestão de próxima ação | IA analisa histórico da oportunidade e sugere melhor próxima ação |
| Análise de sentimento em e-mails | IA avalia tom das respostas do prospect para prever probabilidade de fechamento |
| Resumo de reunião automático | IA transcreve e resume reuniões de discovery; preenche campos do CRM |
| Score preditivo de fechamento | ML calcula probabilidade de fechamento por oportunidade com base em padrões históricos |

### 12.3 Gestão de Contratos (CAP-03.5)
| Automação | Aplicação |
|-----------|----------|
| Assinatura eletrônica | Integração com DocuSign / ClickSign / Assina.Online para envio e captura de assinatura |
| Template automático | Contrato gerado automaticamente com dados do CRM ao marcar oportunidade como "Ganha" |
| Alerta de vencimento | Alerta automático para renovação 60/30/15 dias antes do vencimento |
| Arquivo automático | Contrato assinado arquivado automaticamente no repositório oficial |

### 12.4 Dashboards
| Dashboard | Métricas | Público |
|-----------|---------|---------|
| Pipeline de Vendas | Funil por etapa, valor total, % de probabilidade | Equipe + Gerente (tempo real) |
| Performance Individual | Win rate, ciclo médio, desconto médio por vendedor | Gerente (semanal) |
| Forecast Report | Previsão de receita do mês com % de confiança | Liderança (semanal) |
| Conformidade Contratual | Contratos assinados vs. clientes ativos | Gerente + Jurídico (mensal) |

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 Matriz de Interfaces

| Módulo | Tipo | CAP-03 Fornece | CAP-03 Recebe |
|--------|------|----------------|---------------|
| CAP-01 Inteligência Comercial | Bilateral | Win/loss analysis, objeções de campo | Inteligência competitiva, materiais de apoio |
| CAP-02 Gestão de Demanda | Recebe | Feedback sobre qualidade dos SQLs | SQLs qualificados com contexto |
| CAP-04 Gestão de Receita | Fornece | Contratos assinados, valor e condições de pagamento | — |
| CAP-05 Gestão de Clientes | Fornece | Briefing de onboarding do novo cliente | Capacidade de atendimento disponível |
| CAP-06 Oferta e Precificação | Recebe | Feedback de mercado sobre preço (objeções de preço) | Portfólio, tabela de preços, limites de desconto |
| CAP-07 Equipe Comercial | Recebe | — | Capacidade, disponibilidade e habilidades da equipe |
| CAP-08 Performance e Autogestão | Bilateral | KPIs de vendas (win rate, ciclo, ticket médio) | Metas de fechamento e receita |

### 13.2 Protocolo de Handoff CAP-03 → CAP-05 (Onboarding)
O handoff de vendas para gestão do cliente é crítico e DEVE conter:
- Resumo do processo de vendas (dores identificadas, promessas feitas, expectativas criadas)
- Condições contratuais resumidas (escopo, prazo, valor, forma de pagamento)
- Histórico de interações relevantes (acessível via CRM)
- Próximos passos acordados com o cliente
- Data esperada de início da entrega

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-03 (inclui CAP-03.5 Contratos) |
