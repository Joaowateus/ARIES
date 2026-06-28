---
id: MOD-CAP-07
titulo: "Módulo Operacional — Gestão da Equipe Comercial"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - MOD-CAP-08
tags: [equipe, comercial, vendedores, recrutamento, treinamento, onboarding, remuneracao, comissao, coaching, capacidade]
---

# MOD-CAP-07 — Gestão da Equipe Comercial

---

## 1. Objetivo da Capacidade

Recrutar, desenvolver, reter e gerir a equipe comercial de forma que cada integrante opere com máxima performance, tenha clareza sobre metas e critérios de sucesso, receba o suporte necessário para atingi-los, e seja remunerado de forma justa e alinhada aos objetivos da empresa.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | Equipe dimensionada corretamente | Capacidade de atendimento da equipe ≥ volume de demanda gerada (CAP-02 + CAP-05) |
| R2 | Ramp-up de novos integrantes dentro do prazo | 100% dos novos membros atingem quota mínima até o fim do período de ramp-up |
| R3 | Time treinado e certificado | 100% da equipe com treinamento de portfólio, processo e ferramentas completo |
| R4 | Remuneração correta e no prazo | 0% de erros de cálculo de comissão; pagamento dentro do prazo acordado |
| R5 | Turnover controlado | Turnover voluntário da equipe comercial ≤ [meta]% ao ano |

**Definição de Sucesso:** A empresa consegue escalar ou redirecionar a equipe comercial em resposta a mudanças de mercado, sem dependência de pessoas-chave insubstituíveis.

---

## 3. Entradas Necessárias

### 3.1 Entradas Primárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| Metas de receita e capacidade necessária | CAP-08 (Performance) | Estruturado | Anual / revisão |
| Volume de demanda gerada | CAP-02 (Gestão de Demanda) | Estruturado | Mensal |
| Portfólio atualizado e política de descontos | CAP-06 (Oferta e Precificação) | Documento | Por versão |
| ICP Document e inteligência de mercado | CAP-01 (Inteligência Comercial) | Documento | Trimestral |
| Performance individual (KPIs) | CAP-08 + CRM | Estruturado | Mensal |

---

## 4. Saídas Obrigatórias

### 4.1 Saídas para Operação
| Saída | Destinatário | Periodicidade |
|-------|-------------|--------------|
| Capacidade de atendimento disponível | CAP-02 + CAP-05 | Mensal |
| Resultado individual de comissões | Cada integrante + Financeiro | Mensal |
| Plano de desenvolvimento individual (PDI) | Cada integrante | Trimestral |
| Relatório de capacidade e headcount | Liderança + CAP-08 | Mensal |

---

## 5. Regras de Negócio

### RN-01: Dimensionamento de Equipe
- O número de vendedores/SDRs/CSs DEVE ser calculado com base na capacidade de atendimento necessária vs. volume de demanda
- A empresa NÃO PODE operar com capacidade >80% por >2 meses consecutivos sem iniciar processo de contratação
- Fórmula de capacidade: [volume de SQLs esperado por mês] / [SQLs por vendedor por mês] = nº mínimo de vendedores

### RN-02: Ramp-up de Novos Integrantes
- Todo novo integrante da equipe comercial DEVE passar por programa de ramp-up estruturado antes de operar de forma independente
- Período de ramp-up: [N] meses (a definir conforme complexidade do produto/venda)
- Durante o ramp-up, o novo integrante opera com meta proporcional: [X]% no mês 1, [Y]% no mês 2, etc.
- Se não atingir a meta mínima ao final do ramp-up, ativar PDI de correção (não demitir imediatamente sem processo)

### RN-03: Estrutura de Remuneração
- A política de comissionamento DEVE ser documentada e comunicada antes do início do período de avaliação
- Comissão DEVE ser calculada com base em critérios objetivos e auditáveis registrados no CRM
- Nenhuma mudança de regra de comissão pode ser retroativa
- Comissão é devida no mês de fechamento/faturamento conforme política definida (não pode haver "calote" de comissão por motivos não previstos na política)

### RN-04: Treinamento e Certificação
- Equipe DEVE ser treinada sempre que: (a) novo produto/solução lançado, (b) processo de vendas atualizado significativamente, (c) novo membro ingressa na equipe
- Certificação de portfólio é obrigatória antes de o integrante poder vender de forma independente
- Treinamentos DEVEM ser documentados com lista de presença e avaliação de aprendizagem

### RN-05: Feedback e Coaching
- Gerente comercial DEVE realizar reunião 1:1 com cada integrante no mínimo mensalmente
- Revisão de pipeline em grupo DEVE ocorrer semanalmente
- Integrante com performance abaixo de [X]% da meta por 2 meses DEVE ter PDI formal ativado
- PDI DEVE ter metas claras, prazo e critérios de avaliação

### RN-06: Desligamento
- Desligamento por performance DEVE ser precedido de PDI ativado, documentado e com prazo justo
- Processo de offboarding DEVE garantir a transferência de carteira e o registro de todas as oportunidades ativas

---

## 6. Fluxo Operacional Completo

```
CICLO 1 — CONTRATAÇÃO E INTEGRAÇÃO (por evento)
│
├─► [Identificação da necessidade de contratação]
│     └─ Capacidade da equipe < volume necessário (RN-01)
│
├─► [Recrutamento]
│     ├─ Definir perfil do cargo (baseado no ICP e processo de vendas)
│     ├─ Divulgar vaga e selecionar candidatos
│     └─ Entrevistas + avaliações técnicas e comportamentais
│
├─► [Onboarding Estruturado]
│     ├─ Semana 1: Cultura, propósito, estrutura da empresa
│     ├─ Semana 2: Portfólio de soluções (CAP-06) + Ferramenta CRM
│     ├─ Semana 3: Processo de vendas (CAP-03) + roleplay
│     ├─ Semana 4: ICP e Inteligência Comercial (CAP-01) + primeiros clientes acompanhados
│     └─ Certificação: avaliação prática antes de operar independentemente
│
├─► [Período de Ramp-up] — meses 1 a N com meta proporcional
└─► [Full quota] — integrante operando com meta completa
│
▼
CICLO 2 — GESTÃO CONTÍNUA (mensal)
│
├─► [Distribuição de leads/oportunidades] — conforme CAP-02
├─► [Pipeline Review semanal] — gerente + equipe
├─► [1:1 mensal] — gerente + cada integrante
│     ├─ Revisão de KPIs individuais
│     ├─ Identificação de obstáculos
│     └─ Feedback e direcionamento
├─► [Cálculo e pagamento de comissões] — até dia [N] do mês seguinte
└─► [Atualização do PDI se necessário]
│
▼
CICLO 3 — DESENVOLVIMENTO (trimestral)
│
├─► [Avaliação de performance trimestral]
├─► [Atualização do PDI — metas de desenvolvimento]
├─► [Treinamentos planejados] — portfólio, habilidades, ferramentas
└─► [Calibração de metas para próximo trimestre]
│
▼
EVENTO — Desempenho Abaixo da Meta
│
├─► 1 mês abaixo: feedback no 1:1 + ajuste de abordagem
├─► 2 meses abaixo: ativação formal do PDI
└─► PDI não cumprido: processo de desligamento com documentação
│
▼
REGISTRO
│
├─► Todos os treinamentos registrados com data, participantes e avaliação
├─► Todos os 1:1s registrados (resumo + compromissos) no sistema de RH ou CRM
└─► Cálculos de comissão arquivados por mês com memória de cálculo
│
▼
AUDITORIA
│
└─► Mensal: capacidade da equipe, ramp-up em andamento, comissões calculadas
    Trimestral: PDIs ativos, turnover, treinamentos concluídos
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPIs de Capacidade
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-EC-01 | Utilização da capacidade | SQLs recebidos / Capacidade máxima da equipe × 100 | 60–80% (faixa ideal) | Mensal |
| KPI-EC-02 | Headcount disponível vs. necessário | Nº de vendedores ativos / Nº necessário para atingir meta | ≥ 100% | Mensal |

### 7.2 KPIs de Performance Individual
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-EC-03 | Atingimento de quota individual | Receita fechada / Quota × 100 | ≥ 100% | Mensal |
| KPI-EC-04 | % da equipe acima de quota | Nº membros ≥ 100% quota / Total × 100 | ≥ 70% | Mensal |
| KPI-EC-05 | Ramp-up concluído no prazo | Novos membros que atingiram quota mínima no ramp-up / Total novos × 100 | ≥ 80% | Por coorte |

### 7.3 KPIs de Retenção e Desenvolvimento
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-EC-06 | Turnover voluntário | Saídas voluntárias / Headcount médio × 100 | ≤ [meta]% ao ano | Trimestral |
| KPI-EC-07 | Cobertura de treinamento | Membros com treinamento concluído / Total × 100 | 100% (treinamentos obrigatórios) | Por evento |
| KPI-EC-08 | PDIs ativos vs. resolvidos | PDIs abertos / PDIs ativados nos últimos 6 meses | ≤ [X] PDIs abertos simultaneamente | Mensal |

### 7.4 KPIs de Remuneração
| Código | Indicador | Meta | Frequência |
|--------|-----------|------|-----------|
| KPI-EC-09 | Acuracidade de cálculo de comissão | 0 erros de cálculo por mês | Mensal |
| KPI-EC-10 | Pagamento de comissão dentro do prazo | 100% no prazo | Mensal |

---

## 8. Gatilhos e Alertas Operacionais

| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-EC-01 | Utilização da equipe >80% por 2 meses | Iniciar processo de recrutamento | Gerente + Liderança |
| ALT-EC-02 | Membro da equipe com quota < 70% por 2 meses | Ativar PDI formal | Gerente |
| ALT-EC-03 | < 50% da equipe acima de quota por 2 meses | Revisão do processo comercial e/ou das metas | Liderança + Gerente |
| ALT-EC-04 | Novo membro sem completar onboarding em >4 semanas | Alerta para gerente + revisão do plano de onboarding | Gerente |
| ALT-EC-05 | Turnover acumulado >10% em 3 meses | Investigação de causas + plano de retenção emergencial | Liderança |
| ALT-EC-06 | 1:1 mensal não realizado com algum membro | Alerta para gerente | Sistema |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

| Desvio Observado | Possíveis Causas Raiz | Método de Diagnóstico |
|-----------------|----------------------|----------------------|
| Equipe abaixo de quota | Metas irreais; processo inadequado; treinamento insuficiente; qualidade dos leads; produto fraco | Análise por etapa do funil individual; comparação com peer group |
| Alto turnover | Remuneração abaixo do mercado; cultura; metas inalcançáveis; falta de reconhecimento; má gestão | Entrevistas de desligamento; pesquisa de clima |
| Ramp-up lento | Treinamento inadequado; onboarding mal estruturado; produto muito complexo; metas de ramp irreais | Análise de coorte de novas contratações |
| Erros de comissão | Processo manual; dados do CRM incorretos; regras de comissão ambíguas | Auditoria do processo de cálculo; revisão das regras |

---

## 10. Planos de Ação Padronizados

### PA-EC-01: Equipe com < 50% Acima de Quota por 2 Meses
```
Semana 1: Análise individual — quem está abaixo e em qual etapa do funil está o problema
Semana 2: Diagnóstico — é processo, metas, leads, produto, ou treinamento?
Semana 3: Se metas irreais → recalibrar com liderança (com dados)
           Se processo → workshop de revisão com a equipe
           Se treinamento → programa de capacitação intensivo
Semana 4: Implementar ação prioritária
Mês 2: Monitorar semanalmente
```

### PA-EC-02: Turnover Acima da Meta
```
Imediato: Entrevista de desligamento aprofundada (últimas saídas)
Semana 1: Pesquisa de clima com equipe atual (anônima)
Semana 2: Análise comparativa de remuneração vs. mercado
Semana 3: Plano de ação específico (pode ser remuneração, cultura, processo, gestão)
Mês 2: Implementar e monitorar satisfação da equipe
```

### PA-EC-03: Ativação de PDI
```
Reunião 1: Gerente apresenta dados objetivos de performance abaixo da meta
Acordo: Metas específicas para os próximos [30/60/90] dias
Suporte: Coaching semanal, acompanhamento de calls, revisão de propostas
Avaliação: Reunião de avaliação ao final do prazo
Desfecho: PDI cumprido → seguir; não cumprido → processo de desligamento
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Mensal (Gerente Comercial)
**Checklist:**
- [ ] Atingimento de quota de cada integrante calculado e registrado
- [ ] Comissões calculadas com memória de cálculo documentada
- [ ] Comissões pagas dentro do prazo
- [ ] 1:1 mensal realizado com todos os integrantes
- [ ] Capacidade da equipe vs. volume de demanda calculados

### 11.2 Auditoria Trimestral (Gerente + Liderança)
**Checklist:**
- [ ] Avaliação de performance trimestral realizada para todos
- [ ] PDIs ativos revisados e atualizados
- [ ] Treinamentos planejados para o trimestre seguinte
- [ ] Turnover calculado e analisado
- [ ] Satisfação da equipe verificada (pesquisa ou 1:1 aprofundado)
- [ ] Capacidade prevista vs. metas do próximo trimestre: precisa contratar?

### 11.3 Auditoria Anual (Liderança + RH)
**Checklist:**
- [ ] Política de comissionamento revisada e validada
- [ ] Benchmark de remuneração realizado
- [ ] Análise de coorte de contratações do ano
- [ ] Plano de headcount para o próximo ano definido
- [ ] Top performers identificados e com plano de retenção específico

---

## 12. Possibilidades de Automação

### 12.1 CRM e Sistemas de RH
| Automação | Trigger | Ação |
|-----------|---------|------|
| Cálculo automático de comissão | Oportunidade marcada como "Ganha" | Calcula comissão do vendedor conforme regras da política e gera relatório |
| Tracking de quota | Mensal | Dashboard individual com atingimento em tempo real |
| Alerta de desempenho | Performance < [X]% da quota | Notificação automática para gerente |
| Checklist de onboarding | Novo membro cadastrado | Cria trilha de onboarding com tarefas e prazos no sistema |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Coaching assistido por IA | IA analisa gravações de reuniões de vendas e gera feedback estruturado para o gerente dar no 1:1 |
| Previsão de atingimento | ML prevê probabilidade de cada vendedor atingir quota no mês com base no pipeline atual |
| Identificação de padrão de top performer | IA identifica comportamentos dos top performers para replicar com a equipe |

### 12.3 Dashboards
| Dashboard | Métricas | Público |
|-----------|---------|---------|
| Team Performance | Quota × realizado por vendedor, ranking | Gerente (tempo real) |
| Individual Dashboard | Pipeline, atividades, forecast pessoal | Vendedor (diário) |
| Headcount Planning | Capacidade atual vs. necessária, projeção | Liderança (mensal) |

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 Matriz de Interfaces

| Módulo | Tipo | CAP-07 Fornece | CAP-07 Recebe |
|--------|------|----------------|---------------|
| CAP-01 Inteligência Comercial | Recebe | — | Treinamento em ICP e inteligência competitiva |
| CAP-02 Gestão de Demanda | Fornece | Capacidade de atendimento disponível | — |
| CAP-03 Processo de Vendas | Recebe | Equipe treinada e certificada no processo | — |
| CAP-05 Gestão de Clientes | Fornece | Capacidade de CS disponível | — |
| CAP-06 Oferta e Precificação | Recebe | Equipe treinada no portfólio e política de descontos | — |
| CAP-08 Performance e Autogestão | Bilateral | KPIs individuais e de equipe; headcount; capacidade | Metas individuais e coletivas; relatórios de performance |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-07 |
