---
id: MOD-CAP-02
titulo: "Módulo Operacional — Gestão de Demanda"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - MOD-CAP-01
  - MOD-CAP-03
  - MOD-CAP-06
tags: [demanda, leads, prospeccao, qualificacao, pipeline, mql, sql]
---

# MOD-CAP-02 — Gestão de Demanda

---

## 1. Objetivo da Capacidade

Gerar, capturar, qualificar e distribuir fluxo contínuo e previsível de oportunidades comerciais alinhadas ao ICP, abastecendo o pipeline de vendas com leads que tenham alta probabilidade de conversão, minimizando desperdício de esforço comercial e garantindo previsibilidade de receita.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | Pipeline de vendas sempre abastecido | Volume de SQLs ≥ meta mensal de novas oportunidades |
| R2 | Qualidade de leads validada | ≥ 70% dos SQLs aderentes ao ICP (ICP Score ≥ 7) |
| R3 | Fontes de demanda diversificadas | Nenhuma fonte representa >50% dos leads qualificados |
| R4 | Custo por lead controlado | CPL (Custo por Lead Qualificado) dentro do intervalo definido em CAP-06 |
| R5 | Tempo de resposta a leads garantido | 100% dos inbound leads contactados em até 1h útil |

**Definição de Sucesso:** O pipeline possui sempre volume mínimo de SQLs equivalente a 3× a meta de fechamentos do mês, com pelo menos 70% dentro do ICP.

---

## 3. Entradas Necessárias

### 3.1 Entradas Primárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| ICP Document atualizado | CAP-01 (Inteligência Comercial) | Documento | Trimestral / por evento |
| Meta de receita e volume de clientes | CAP-08 (Performance) | Estruturado | Mensal |
| Critérios de qualificação (BANT/MEDDIC) | CAP-01 + CAP-03 | Documento | Trimestral |
| Capacidade de atendimento da equipe | CAP-07 (Equipe Comercial) | Estruturado | Mensal |

### 3.2 Entradas de Execução
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| Formulários de interesse (inbound) | Website, landing pages, eventos | Estruturado | Contínua |
| Listas de prospecção ativa | Pesquisa, ferramentas (Apollo, LinkedIn) | Semiestruturado | Semanal |
| Indicações e referências | Clientes ativos, parceiros | Semiestruturado | Por evento |
| Leads de parceiros | CAP-09 (Canais e Parcerias) | Estruturado | Por evento |
| Oportunidades de expansão | CAP-05 (Gestão de Clientes) | Estruturado | Mensal |

### 3.3 Pré-condições
- ICP Document aprovado e vigente (CAP-01)
- CRM configurado com campos de qualificação padronizados
- Framework de qualificação definido (ex: BANT, MEDDIC, CHAMP) e documentado
- Processo de distribuição de leads para a equipe de vendas definido

---

## 4. Saídas Obrigatórias

### 4.1 Saídas Principais
| Saída | Destinatário | Periodicidade | SLA |
|-------|-------------|--------------|-----|
| SQL (Sales Qualified Lead) | CAP-03 (Processo de Vendas) | Contínua | Distribuído ao vendedor em até 4h |
| Pipeline de Demanda atualizado | Gerente Comercial + CAP-08 | Tempo real (CRM) | — |
| Relatório de Geração de Demanda | Liderança + CAP-08 | Mensal | Dia 5 do mês seguinte |
| Lead rejeitado com motivo registrado | CAP-01 (para análise de fonte) | Por evento | Até 24h após descarte |

### 4.2 Dados Obrigatórios por Lead no CRM
- Nome, empresa, cargo, contato
- Fonte do lead
- Data de entrada
- ICP Score calculado
- Framework de qualificação preenchido (BANT/MEDDIC)
- Status: MQL → SQL → Distribuído / Descartado
- Motivo de descarte (quando aplicável)

---

## 5. Regras de Negócio

### RN-01: Critério de Passagem de MQL para SQL
- Um lead só se torna SQL quando possui: Budget confirmado OU capacidade de pagamento validada, Autoridade do tomador de decisão confirmada, Necessidade real identificada, e Timing de compra ≤ 6 meses
- O framework de qualificação adotado é [BANT ou MEDDIC — definir em ADR específico] e DEVE ser seguido sem exceções
- Vendedor NÃO PODE receber lead não qualificado como SQL

### RN-02: Tempo de Resposta (Lead Response Time)
- Leads inbound DEVEM ser contactados em até 1 hora útil após a entrada no CRM
- Após 1 hora sem contato, alerta automático é disparado para o gerente
- Após 4 horas sem contato, o lead pode ser redistribuído

### RN-03: Distribuição de Leads
- Distribuição segue critérios definidos: [round-robin / especialização por segmento / por região — definir]
- Vendedor com taxa de resposta < 80% dentro do SLA perde prioridade na distribuição pelo período de [1 semana]
- Lead de conta existente (cliente ativo) SEMPRE vai para o responsável pela conta (CAP-05)

### RN-04: Descarte de Leads
- Leads descartados DEVEM ter motivo registrado em campo padronizado (lista fechada de motivos)
- Lead pode ser reativado após [90 dias] se houver novo contexto
- Descarte de lead com ICP Score ≥ 8 DEVE ser aprovado pelo gerente

### RN-05: Prospecção Ativa
- Toda lista de prospecção ativa DEVE ser validada contra critérios do ICP antes de uso
- Cada representante de vendas DEVE realizar [X] tentativas de contato antes de marcar como "não-respondeu"
- Sequências de cadência DEVEM ser padronizadas e registradas no CRM

### RN-06: Volume Mínimo de Pipeline
- O pipeline qualificado de oportunidades abertas DEVE representar no mínimo 3× a meta de fechamento do mês
- Se o pipeline cair abaixo de 2×, o alerta ALT-DM-03 é acionado automaticamente

---

## 6. Fluxo Operacional Completo

```
ENTRADA
│
├─► [Canal Inbound]
│     ├─ Formulário web, landing page, evento
│     └─ Lead entra no CRM como "Novo Lead"
│
├─► [Canal Outbound / Prospecção Ativa]
│     ├─ SDR pesquisa e identifica contatos dentro do ICP
│     └─ Lead cadastrado no CRM como "Prospectado"
│
├─► [Indicações e Parcerias (CAP-09)]
│     └─ Lead entra com tag de origem e responsável pelo parceiro
│
▼
PROCESSAMENTO — Qualificação
│
├─► [Pré-qualificação automática — ICP Score]
│     ├─ CRM calcula ICP Score com base nos dados de empresa
│     ├─ Score ≥ 7 → avança para qualificação humana
│     └─ Score < 5 → descartado automaticamente (motivo: fora do ICP)
│
├─► [Qualificação humana — framework BANT/MEDDIC]
│     ├─ SDR ou vendedor realiza contato qualificador
│     ├─ Preenche campos obrigatórios no CRM
│     └─ Tomada de decisão: MQL → SQL ou Descarte
│
▼
DECISÃO
│
├─► [Lead qualificado como SQL?]
│     ├─ SIM → Distribuir para vendedor responsável (RN-03)
│     └─ NÃO → Registrar motivo + Nurturing ou Descarte
│
├─► [Lead pode ser nutrido (nurturing)?]
│     ├─ SIM → Manter em fluxo de nutrição com requalificação em [30/60/90 dias]
│     └─ NÃO → Descartar com motivo
│
▼
SAÍDA
│
├─► SQL distribuído para vendedor → CAP-03 (Processo de Vendas)
├─► Pipeline atualizado em tempo real no CRM
└─► Métricas enviadas para CAP-08 (Performance)
│
▼
REGISTRO
│
├─► Toda movimentação de lead registrada com timestamp e responsável
├─► Fonte de lead registrada (para análise de ROI por canal)
└─► Motivos de descarte registrados para retroalimentação de CAP-01
│
▼
AUDITORIA
│
└─► Verificação semanal: SLA de resposta, volume de SQL gerado,
    qualidade do pipeline, taxa de conversão por fonte
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPIs de Volume
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-DM-01 | Leads gerados (total) | Contagem de novos leads no período | Meta por canal | Semanal |
| KPI-DM-02 | MQLs gerados | Leads que passaram para MQL | Meta mensal | Mensal |
| KPI-DM-03 | SQLs gerados | MQLs que se tornaram SQL | ≥ Meta de pipeline (3× fechamentos) | Mensal |
| KPI-DM-04 | Volume de pipeline (R$) | Soma do valor estimado dos SQLs abertos | ≥ 3× meta de receita mensal | Semanal |

### 7.2 KPIs de Qualidade
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-DM-05 | Taxa de conversão Lead → MQL | MQLs / Total leads × 100 | Meta por canal | Mensal |
| KPI-DM-06 | Taxa de conversão MQL → SQL | SQLs / MQLs × 100 | ≥ 40% | Mensal |
| KPI-DM-07 | Aderência ao ICP dos SQLs | SQLs com ICP Score ≥ 7 / Total SQLs × 100 | ≥ 70% | Mensal |
| KPI-DM-08 | Lead Response Time | Tempo médio entre entrada do lead e primeiro contato | ≤ 1h útil (100% dos casos) | Semanal |

### 7.3 KPIs de Eficiência
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-DM-09 | CPL (Custo por Lead Qualificado) | Custo total de geração / SQLs gerados | Dentro do intervalo de CAP-06 | Mensal |
| KPI-DM-10 | Diversificação de fontes | % do canal com maior volume sobre total | ≤ 50% em um único canal | Mensal |

---

## 8. Gatilhos e Alertas Operacionais

| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-DM-01 | Lead inbound sem contato após 1h útil | Notificação automática para vendedor e gerente | Sistema / Gerente |
| ALT-DM-02 | MQL → SQL abaixo de 30% por 3 semanas | Revisão do processo de qualificação + reunião de diagnóstico | Gerente Comercial |
| ALT-DM-03 | Pipeline < 2× meta de fechamento | Acionamento de prospecção ativa intensificada | Gerente + CAP-01 |
| ALT-DM-04 | CPL acima do limite por 2 meses | Revisão de canais de geração de leads | Gerente + Marketing |
| ALT-DM-05 | Um único canal responde por >60% dos SQLs | Alerta de concentração de risco → diversificar fontes | Liderança Comercial |
| ALT-DM-06 | Taxa de aderência ao ICP < 50% | Revisão de critérios de qualificação + alinhamento com CAP-01 | Gerente + IC |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

| Desvio Observado | Possíveis Causas Raiz | Método de Diagnóstico |
|-----------------|----------------------|----------------------|
| Volume de SQLs abaixo da meta | Poucos leads entrando; baixa taxa de qualificação; ICP muito restritivo | Funil de conversão por etapa; análise por canal |
| Baixa qualidade dos SQLs | ICP Score não reflete realidade; framework de qualificação mal aplicado; pressão para "forçar" SQLs | Auditoria de SQLs + correlação com win rate |
| Lead Response Time alto | Sobrecarga da equipe; processo de notificação falho; falta de prioridade | Análise de logs do CRM por vendedor |
| Pipeline concentrado em 1 canal | Falta de estratégia multi-canal; dependência histórica de uma fonte | Análise histórica de fontes; ausência de estratégia outbound |
| Alto CPL | Canal caro; baixa conversão; processo ineficiente | Decomposição do custo por etapa do funil por canal |

---

## 10. Planos de Ação Padronizados

### PA-DM-01: Pipeline Abaixo do Volume Mínimo
```
Imediato: Acionar prospecção ativa intensificada (modo "sprint de pipeline")
Semana 1: SDRs focados em 100% em outbound; reunião diária de pipeline
Semana 2: Revisar e expandir lista de ICP target accounts
Semana 3: Verificar se metas de fechamento precisam ser recalibradas (CAP-08)
Mês seguinte: Avaliar se é problema estrutural de geração ou ciclo sazonal
```

### PA-DM-02: Taxa de Conversão MQL → SQL Baixa
```
Semana 1: Auditar últimos 30 SQLs rejeitados — padrão de motivos de descarte
Semana 2: Revisar e recalibrar critérios do framework de qualificação
Semana 3: Realizar calibração em par (gerente + vendedor) em 5 leads ao vivo
Semana 4: Retreinar equipe nos critérios atualizados
```

### PA-DM-03: Lead Response Time Acima de 1h
```
Imediato: Identificar o bottleneck (notificação? disponibilidade? processo?)
Semana 1: Implementar alerta em tempo real no CRM + WhatsApp/Slack para o vendedor
Semana 2: Revisar escala de cobertura da equipe para horários de pico de entrada de leads
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Semanal (SDR Lead / Gerente)
**Checklist:**
- [ ] SLA de Lead Response Time foi cumprido em ≥ 95% dos casos
- [ ] Todos os leads da semana têm ICP Score calculado
- [ ] Pipeline está acima de 3× meta de fechamento do mês
- [ ] Nenhum lead ficou parado (sem movimentação) por >5 dias úteis

### 11.2 Auditoria Mensal (Gerente Comercial)
**Checklist:**
- [ ] KPIs de volume (DM-01 a DM-03) calculados e registrados
- [ ] Análise de conversão por canal realizada
- [ ] CPL calculado por canal
- [ ] Aderência ao ICP dos SQLs gerados calculada
- [ ] Todos os leads descartados têm motivo registrado

### 11.3 Auditoria Trimestral (Liderança)
**Checklist:**
- [ ] Diversificação de fontes avaliada
- [ ] ROI por canal calculado (receita gerada / custo por canal)
- [ ] Estratégia de geração de demanda revisada com base em dados
- [ ] Capacidade de geração de demanda vs. capacidade de atendimento balanceadas

---

## 12. Possibilidades de Automação

### 12.1 CRM
| Automação | Trigger | Ação |
|-----------|---------|------|
| ICP Scoring automático | Lead criado / atualizado | Calcula ICP Score e aplica tag |
| Alerta de SLA | Lead inbound + 1h sem atividade | Notificação push/email para vendedor + gerente |
| Sequência de cadência outbound | Lead adicionado à lista ativa | Sequência automatizada de e-mails + tarefas de ligação |
| Redistribuição por inatividade | SQL sem atividade por 4h após criação | Redistribuição automática com notificação |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Lead scoring preditivo | ML treinado no histórico de conversões para prever probabilidade de fechamento |
| Enriquecimento automático de dados | IA enriquece perfil do lead com dados públicos (LinkedIn, CNPJ, website) |
| Qualificação assistida | IA sugere framework de qualificação preenchido com base em dados disponíveis |
| Identificação de conta ideal (lookalike) | IA identifica empresas similares às dos melhores clientes para prospecção ativa |

### 12.3 Dashboards
| Dashboard | Métricas | Público |
|-----------|---------|---------|
| Funil de Demanda | Leads → MQLs → SQLs → Pipeline value | Gerente Comercial (tempo real) |
| SLA Monitor | Lead Response Time por vendedor | Gerente (tempo real) |
| Canal Performance | Conversão e CPL por canal | Liderança (semanal) |

### 12.4 Integrações
- **Formulários → CRM:** Integração direta (sem intervenção manual)
- **LinkedIn Sales Navigator → CRM:** Importação de prospects qualificados
- **Email sequenciado (Outreach, Lemlist, etc.) → CRM:** Log automático de todas as interações
- **CAP-09 (Parceiros) → CRM:** Canal dedicado para leads de parceiros com tracking separado

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 Matriz de Interfaces

| Módulo | Tipo | CAP-02 Fornece | CAP-02 Recebe |
|--------|------|----------------|---------------|
| CAP-01 Inteligência Comercial | Recebe/Fornece | Dados de conversão por fonte para análise de ICP | ICP Document, critérios de qualificação, segmentos prioritários |
| CAP-03 Processo de Vendas | Fornece | SQLs qualificados com contexto de qualificação no CRM | Feedback de qualidade dos SQLs recebidos; taxa de conversão SQL→Proposta |
| CAP-05 Gestão de Clientes | Bilateral | Leads de expansão identificados | Oportunidades de upsell/cross-sell de clientes ativos |
| CAP-06 Oferta e Precificação | Recebe | — | Limites de CPL por segmento; valor médio por cliente por segmento |
| CAP-07 Equipe Comercial | Recebe | — | Capacidade de atendimento disponível da equipe |
| CAP-08 Performance e Autogestão | Bilateral | KPIs de geração de demanda | Metas de volume de SQLs e pipeline |
| CAP-09 Canais e Parcerias | Recebe/Fornece | Taxa de conversão de leads de parceiros | Leads gerados por parceiros |

### 13.2 Protocolo de Handoff CAP-02 → CAP-03
- SQL é considerado formalmente transferido quando: (a) todos os campos obrigatórios do CRM estão preenchidos, (b) ICP Score está calculado, (c) Framework de qualificação está completo
- Vendedor que recebe o SQL tem até 4 horas para fazer o primeiro contato e registrar no CRM
- Se o vendedor discordar da qualificação, DEVE registrar o motivo e devolver ao processo de qualificação (não descartar silenciosamente)

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-02 |
