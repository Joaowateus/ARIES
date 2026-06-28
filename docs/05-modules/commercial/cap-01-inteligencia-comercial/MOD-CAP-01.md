---
id: MOD-CAP-01
titulo: "Módulo Operacional — Inteligência Comercial"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - MOD-CAP-02
  - MOD-CAP-06
  - MOD-CAP-08
tags: [inteligencia-comercial, icp, mercado, prospeccao, estrategia]
---

# MOD-CAP-01 — Inteligência Comercial

---

## 1. Objetivo da Capacidade

Produzir conhecimento sistemático sobre mercado, concorrência, perfil de cliente ideal (ICP) e oportunidades de negócio, transformando dados brutos em inteligência acionável que orienta todas as decisões comerciais do SOE.

A Inteligência Comercial é a fundação epistêmica do Núcleo Comercial: sem ela, as demais capacidades operam com base em suposições, gerando desperdício de esforço comercial, precificação inadequada e abordagem de clientes errados.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | ICP atualizado e validado | Revisado no mínimo trimestralmente com dados reais de clientes ganhos/perdidos |
| R2 | Mapa competitivo ativo | Monitoramento contínuo de pelo menos 5 concorrentes diretos |
| R3 | Segmentação de mercado viva | Segmentos priorizados com TAM/SAM/SOM calculados |
| R4 | Inteligência de mercado distribuída | Equipe comercial consome e contribui com inteligência semanalmente |
| R5 | Ciclo de retroalimentação funcional | Win/loss analysis executada em 100% das oportunidades fechadas |

**Definição de Sucesso:** A equipe comercial é capaz de identificar e qualificar um lead dentro do ICP em menos de 15 minutos, com base em critérios documentados e disponíveis no CRM.

---

## 3. Entradas Necessárias

### 3.1 Entradas Primárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| Base histórica de clientes | CRM / Financeiro | Estruturado | Contínua |
| Dados de win/loss por oportunidade | Processo de Vendas (CAP-03) | Estruturado | Por evento |
| Feedbacks de reuniões e propostas | Equipe Comercial | Semiestruturado | Por evento |
| Dados de churn e expansão | Gestão de Clientes (CAP-05) | Estruturado | Mensal |
| NPS e pesquisas de satisfação | CAP-05 | Estruturado | Trimestral |

### 3.2 Entradas Secundárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| Relatórios de setor / tendências | Fontes externas, consultorias | Não estruturado | Mensal |
| Monitoramento de redes sociais e mídia | Ferramentas de monitoramento | Semiestruturado | Semanal |
| Dados de comportamento em website/marketing | Marketing | Estruturado | Semanal |
| Movimentações de concorrentes | Pesquisa ativa, alertas | Semiestruturado | Semanal |
| Benchmarks de mercado | Associações, relatórios | Não estruturado | Semestral |

### 3.3 Pré-condições
- CRM operacional com histórico de pelo menos 6 meses
- Equipe comercial treinada para registrar dados de qualificação padronizados
- Acesso a pelo menos uma fonte de inteligência de mercado externa

---

## 4. Saídas Obrigatórias

### 4.1 Documentos e Artefatos
| Saída | Destinatário | Periodicidade | SLA |
|-------|-------------|--------------|-----|
| ICP Document (Perfil Ideal de Cliente) | Toda a equipe comercial | Trimestral (ou por evento crítico) | 5 dias úteis após trigger |
| Competitive Intelligence Report | Liderança + Comercial | Mensal | Dia 5 do mês seguinte |
| Market Segmentation Map | Liderança estratégica | Semestral | 10 dias úteis após período |
| Win/Loss Analysis por oportunidade | Gerente Comercial + CAP-08 | Por evento | 48h após fechamento |
| Weekly Intelligence Digest | Equipe Comercial | Semanal | Segunda-feira 9h |

### 4.2 Dados Alimentados no CRM
- ICP score por lead/conta
- Tags de segmento de mercado
- Posicionamento competitivo relevante por conta
- Atualizações de contexto de setor por conta

### 4.3 Saídas para Outros Módulos
| Módulo Destino | Saída Fornecida |
|---------------|----------------|
| CAP-02 (Gestão de Demanda) | Critérios de ICP para qualificação de leads |
| CAP-03 (Processo de Vendas) | Inteligência competitiva para objeções |
| CAP-06 (Oferta e Precificação) | Benchmarks de preço e posicionamento |
| CAP-08 (Performance) | Dados de mercado para metas e contexto |

---

## 5. Regras de Negócio

### RN-01: Definição e Atualização do ICP
- O ICP DEVE ser definido com base em dados reais de clientes, não em suposições
- O ICP DEVE ser revisado sempre que: (a) taxa de win rate cair >15% em 2 meses consecutivos, (b) surgir novo segmento com >3 clientes ativos, (c) ocorrer mudança estratégica na empresa
- O ICP DEVE conter obrigatoriamente: setor, porte (faturamento e headcount), maturidade digital, dores primárias, tomador de decisão, critério de compra, tempo médio de ciclo de venda

### RN-02: Protocolo de Win/Loss Analysis
- TODA oportunidade fechada (ganha ou perdida) DEVE ter win/loss analysis registrada no CRM
- Win/loss analysis DEVE ser feita pelo vendedor responsável em até 48h após o fechamento
- Oportunidades acima de R$ [THRESHOLD_DEFINIDO_EM_CAP-06] DEVEM ter análise validada pelo gerente

### RN-03: Curadoria de Inteligência Competitiva
- Concorrentes diretos DEVEM ser monitorados semanalmente (alertas de Google, LinkedIn, site)
- Qualquer mudança crítica de concorrente (novo produto, mudança de preço, case novo) DEVE ser comunicada à equipe em até 24h via canal dedicado
- O mapa competitivo NÃO PODE ter dados com mais de 90 dias sem atualização

### RN-04: Propriedade e Acesso
- O ICP Document é de propriedade do Gerente Comercial e DEVE ser aprovado pela Liderança antes de distribuição
- Todo dado de inteligência DEVE ser centralizado no CRM ou repositório oficial (NUNCA em spreadsheets pessoais)

### RN-05: Confidencialidade
- Dados de inteligência competitiva DEVEM ser marcados como confidenciais
- Análises de win/loss com dados de clientes específicos DEVEM respeitar acordos de confidencialidade

---

## 6. Fluxo Operacional Completo

```
ENTRADA
│
├─► [Coleta Contínua]
│     ├─ CRM: dados históricos de clientes e oportunidades
│     ├─ Equipe: feedbacks de campo (reuniões, objeções, concorrentes mencionados)
│     ├─ Fontes externas: relatórios, alertas, monitoramento
│     └─ CAP-05: dados de churn, NPS, expansão
│
▼
PROCESSAMENTO
│
├─► [Análise e Síntese — semanal]
│     ├─ Consolidação de sinais de mercado
│     ├─ Atualização do mapa competitivo
│     ├─ Identificação de padrões em win/loss
│     └─ Scoring de ICP vs. base atual
│
├─► [Revisão Periódica — trimestral]
│     ├─ Validação estatística do ICP com base de clientes ativos
│     ├─ Revisão de segmentação e TAM/SAM/SOM
│     ├─ Análise de tendências de setor
│     └─ Benchmark competitivo completo
│
▼
DECISÃO
│
├─► [O ICP mudou?]
│     ├─ SIM → Acionar processo de atualização de ICP (RN-01)
│     └─ NÃO → Manter e distribuir digest semanal
│
├─► [Há ameaça competitiva crítica?]
│     ├─ SIM → Comunicar imediatamente (RN-03) + acionar CAP-06
│     └─ NÃO → Registrar no relatório mensal
│
▼
SAÍDA
│
├─► ICP Document atualizado → distribuído para CAP-02, CAP-03, CAP-06
├─► Intelligence Digest → publicado semanalmente
├─► Win/Loss Analysis → registrada no CRM
└─► Competitive Report → entregue à liderança
│
▼
REGISTRO
│
├─► Todas as análises versionadas no repositório oficial
├─► Histórico de versões do ICP mantido (DocSemVer)
└─► Win/loss registrada no CRM com campos padronizados
│
▼
AUDITORIA
│
└─► Verificação mensal: completude das win/loss, atualidade do mapa competitivo,
    consumo do digest pela equipe, versão ativa do ICP
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPIs Primários
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-IC-01 | Cobertura de Win/Loss Analysis | Oportunidades com análise / Total fechadas × 100 | ≥ 95% | Mensal |
| KPI-IC-02 | Aderência ao ICP (novos clientes) | Clientes dentro do ICP / Total novos clientes × 100 | ≥ 80% | Trimestral |
| KPI-IC-03 | Win Rate geral | Oportunidades ganhas / Total oportunidades qualificadas × 100 | Meta por segmento | Mensal |
| KPI-IC-04 | Win Rate por segmento de ICP | Ganhas em segmento / Total em segmento × 100 | Acima da média geral | Trimestral |

### 7.2 KPIs de Qualidade da Inteligência
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-IC-05 | Atualidade do mapa competitivo | % concorrentes atualizados nos últimos 30 dias | 100% | Mensal |
| KPI-IC-06 | Consumo do Intelligence Digest | % da equipe que abre / acessa o digest | ≥ 80% | Semanal |
| KPI-IC-07 | Precisão do ICP Score | Correlação ICP Score ≥ 7 com clientes que fecharam | ≥ 70% | Trimestral |

### 7.3 KPIs de Impacto Downstream
| Código | Indicador | Meta |
|--------|-----------|------|
| KPI-IC-08 | Redução do ciclo médio de vendas (leads dentro do ICP vs. fora) | ≥ 20% mais curto |
| KPI-IC-09 | Taxa de qualificação de leads (MQL → SQL) | ≥ definida em CAP-02 |

---

## 8. Gatilhos e Alertas Operacionais

### 8.1 Alertas Automáticos
| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-IC-01 | Win rate cai >15% em relação ao mês anterior | Revisão emergencial do ICP + análise de objeções recentes | Gerente Comercial |
| ALT-IC-02 | >20% das oportunidades fechadas sem win/loss analysis em 72h | Notificação para vendedor + escalonamento para gerente | Sistema / Gerente |
| ALT-IC-03 | Concorrente lança produto ou muda preço significativamente | Comunicado urgente para toda equipe + revisão do pitch | Responsável de IC |
| ALT-IC-04 | ICP score médio dos novos leads cai abaixo de 5 por 4 semanas | Revisão de fontes de geração de leads (CAP-02) | Gerente Comercial |
| ALT-IC-05 | Taxa de leads fora do ICP supera 40% | Reunião de revisão de estratégia de prospecção | Liderança + Comercial |

### 8.2 Gatilhos de Revisão
| Gatilho | Ação Disparada |
|---------|---------------|
| Novo segmento com >3 clientes ativos | Inclusão formal do segmento no ICP Document |
| Mudança estratégica da empresa | Revisão completa do ICP e segmentação |
| Saída de cliente estratégico (churn) | Win/loss analysis especial + revisão de critérios |
| Entrada de novo concorrente relevante | Adição ao mapa competitivo + briefing para equipe |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

### 9.1 Mapa de Desvios

| Desvio Observado | Possíveis Causas Raiz | Método de Diagnóstico |
|-----------------|----------------------|----------------------|
| Win rate abaixo da meta | ICP desatualizado; proposta inadequada; concorrência mais agressiva; qualificação ruim | Análise de win/loss últimos 90 dias; comparação com períodos anteriores |
| Alta % de leads fora do ICP | Geração de leads sem critério; marketing desalinhado com ICP; prospecção ativa sem foco | Auditoria da fonte dos leads; revisão do processo em CAP-02 |
| Equipe não consome inteligência | Formato inadequado; sobrecarga; canal errado; conteúdo irrelevante | Pesquisa de utilidade com equipe; análise de abertura/acesso |
| Win/loss incompleto | Cultura de não-registro; falta de tempo; ferramenta difícil; sem consequência por omissão | Revisão do processo e ferramentas; reforço de cultura |
| ICP não reflete a realidade | Critérios subjetivos; dados insuficientes; ausência de validação estatística | Análise de correlação entre ICP score e conversão real |

### 9.2 Protocolo de Diagnóstico (5 Whys)
1. Identificar o desvio com dados concretos (KPI abaixo da meta)
2. Mapear o contexto: quando começou, magnitude, escopo
3. Aplicar 5 Whys com dados (não suposições)
4. Classificar causa raiz: Processo / Pessoa / Ferramenta / Dado / Estratégia
5. Documentar diagnóstico no DECISION_LOG com evidências

---

## 10. Planos de Ação Padronizados para Cada Tipo de Desvio

### PA-IC-01: Win Rate Abaixo da Meta por 2 Meses Consecutivos
```
Semana 1: Levantar todas as win/loss dos últimos 60 dias → identificar padrão de objeções
Semana 2: Convocar equipe para sessão de diagnóstico colaborativo
Semana 3: Revisar ICP e pitch com base nos padrões encontrados
Semana 4: Treinar equipe nas respostas às objeções recorrentes
Mês 2: Monitorar nova taxa de win rate
```

### PA-IC-02: Base de Leads Fora do ICP (>40%)
```
Imediato: Pausar campanhas de prospecção ativa mal segmentadas
Semana 1: Auditar fontes de leads dos últimos 90 dias
Semana 2: Redefinir critérios de ICP Score no CRM
Semana 3: Realinhar com marketing / CAP-02 sobre critérios de geração
Semana 4: Reativar prospecção com novos critérios e monitorar
```

### PA-IC-03: Inteligência Competitiva Desatualizada
```
Imediato: Atualizar mapa competitivo dos 5 principais concorrentes
Semana 1: Configurar alertas automáticos (Google Alerts, LinkedIn)
Semana 2: Definir responsável semanal por curadoria
Semana 3: Criar template padrão de competitive card por concorrente
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Mensal (Interna — Gerente Comercial)
**Checklist:**
- [ ] 100% das oportunidades fechadas no mês têm win/loss analysis registrada
- [ ] Mapa competitivo atualizado (nenhum concorrente com >30 dias sem atualização)
- [ ] ICP Document está na versão vigente e foi comunicado à equipe
- [ ] Todos os KPIs primários foram calculados e registrados
- [ ] Intelligence Digest foi publicado em todas as semanas do mês

**Output:** Relatório de Auditoria Mensal — IC (arquivado no repositório)

### 11.2 Auditoria Trimestral (Gestão — Liderança)
**Checklist:**
- [ ] Win rate por segmento analisado vs. metas
- [ ] Aderência ao ICP calculada para novos clientes do trimestre
- [ ] ICP foi revisado com dados do trimestre
- [ ] Análise de tendências de mercado documentada
- [ ] ROI da função de Inteligência Comercial estimado

**Output:** Relatório de Inteligência Comercial Trimestral

### 11.3 Auditoria Anual (Estratégica — Conselho / Fundadores)
**Checklist:**
- [ ] Evolução histórica do ICP documentada (versões anteriores preservadas)
- [ ] TAM/SAM/SOM revisado com dados do ano
- [ ] Posicionamento competitivo reavaliado
- [ ] Gaps de inteligência identificados e priorizados para o próximo ano

---

## 12. Possibilidades de Automação

### 12.1 CRM
| Automação | Ferramenta | Trigger | Ação |
|-----------|----------|---------|------|
| ICP Scoring automático | CRM (campos customizados + fórmula) | Criação/atualização de lead | Calcula e atualiza ICP Score |
| Alerta de win/loss pendente | CRM | Oportunidade fechada há 48h sem análise | Notificação para vendedor e gerente |
| Tag de segmento automático | CRM | ICP Score calculado | Aplica tag de segmento correspondente |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Sumarização de win/loss | IA processa notas brutas do vendedor e extrai padrões de objeção |
| Competitive monitoring | IA monitora menções de concorrentes e gera alertas classificados por relevância |
| ICP Score preditivo | Modelo de ML treinado com histórico de conversões para scoring em tempo real |
| Geração do Intelligence Digest | IA agrega sinais da semana e gera rascunho do digest para revisão humana |

### 12.3 Dashboards
| Dashboard | Métricas | Público | Frequência |
|-----------|---------|---------|-----------|
| IC Overview | Win rate, ICP adherence, competitive map | Gerente Comercial | Tempo real |
| Intelligence Health | Cobertura win/loss, atualidade mapa, consumo digest | Liderança | Semanal |
| Segment Performance | Win rate por segmento, ciclo por segmento | Estratégico | Mensal |

### 12.4 Workflows e Integrações
- **CRM → Repositório:** Exportação automática de win/loss consolidado mensalmente
- **Alertas externos → CRM:** Integração com Google Alerts / LinkedIn para alimentar competitive cards
- **NPS → IC:** Dados de satisfação de CAP-05 automaticamente disponíveis para análise de padrão de clientes

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 Diagrama de Dependências

```
                    ┌─────────────────────┐
                    │   CAP-01            │
                    │ Inteligência        │
                    │ Comercial           │
                    └────────┬────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    ┌──────────┐      ┌──────────┐      ┌──────────────┐
    │  CAP-02  │      │  CAP-03  │      │   CAP-06     │
    │ Gestão   │      │ Processo │      │ Oferta e     │
    │ Demanda  │      │ Vendas   │      │ Precificação │
    └──────────┘      └──────────┘      └──────────────┘
                             │
                             ▼
                      ┌──────────┐
                      │  CAP-08  │
                      │Performance│
                      └──────────┘
```

### 13.2 Matriz de Interfaces

| Módulo | Tipo de Relação | CAP-01 Fornece | CAP-01 Recebe |
|--------|----------------|----------------|---------------|
| CAP-02 Gestão de Demanda | Bilateral | Critérios de ICP, segmentos prioritários | Dados de leads qualificados, taxas de conversão MQL→SQL |
| CAP-03 Processo de Vendas | Bilateral | Inteligência competitiva, perfil de comprador | Win/loss bruto, objeções coletadas |
| CAP-04 Gestão de Receita | Recebe | — | Dados de NRR e expansão por segmento |
| CAP-05 Gestão de Clientes | Bilateral | ICP refinado baseado em clientes ativos | NPS, churn, padrões de sucesso e fracasso |
| CAP-06 Oferta e Precificação | Bilateral | Benchmarks competitivos de preço | Dados de win/loss por pricing |
| CAP-07 Equipe Comercial | Fornece | Treinamento em ICP e inteligência competitiva | — |
| CAP-08 Performance e Autogestão | Bilateral | Dados de mercado para contexto de metas | KPIs de IC para dashboard de performance |

### 13.3 Protocolo de Comunicação entre Módulos
- **Formato padrão:** Todos os dados trafegam via CRM ou repositório oficial (nunca e-mail/WhatsApp pessoal)
- **SLA de resposta:** Solicitações de inteligência ad hoc respondidas em até 2 dias úteis
- **Ciclo de sincronização:** Reunião mensal de alinhamento entre responsáveis de CAP-01, CAP-02 e CAP-06

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-01 |
