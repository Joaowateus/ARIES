---
id: MOD-CAP-09
titulo: "Módulo Operacional — Gestão de Canais e Parcerias"
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
  - MOD-CAP-06
  - MOD-CAP-08
tags: [canais, parcerias, parceiros, revendas, indicadores, co-venda, ecosistema, channel]
---

# MOD-CAP-09 — Gestão de Canais e Parcerias

> **Classificação:** Módulo de Evolução — Este módulo é ativado quando a empresa decide expandir através de canais indiretos e parceiros. Pode operar em modo reduzido (apenas parcerias de indicação) em estágio inicial.

---

## 1. Objetivo da Capacidade

Estruturar, operar e escalar um ecossistema de canais indiretos e parcerias estratégicas que ampliem o alcance comercial da empresa — gerando leads, receita e valor para clientes através de terceiros — com governança clara, remuneração justa e qualidade de entrega preservada.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | Canal de parceiros gerando receita consistente | Receita via parceiros ≥ [meta]% da receita total |
| R2 | Parceiros ativados e engajados | ≥ [X]% dos parceiros cadastrados geraram ao menos 1 lead qualificado nos últimos 90 dias |
| R3 | Qualidade dos leads de parceiros validada | Taxa de conversão SQL→Cliente de leads de parceiros ≥ [benchmark direto] |
| R4 | Remuneração de parceiros correta e no prazo | 0% de erros de cálculo de comissão de parceiros; pagamento dentro do prazo |
| R5 | Parceiros satisfeitos | NPS de parceiros ≥ [meta] |

**Definição de Sucesso:** O canal de parcerias funciona como um multiplicador de receita que opera com a mesma qualidade e previsibilidade do canal direto, sem exigir gestão intensa de cada transação individual.

---

## 3. Entradas Necessárias

### 3.1 Entradas Primárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| ICP e critérios de qualificação | CAP-01 (Inteligência Comercial) | Documento | Por atualização |
| Portfólio de soluções e condições para parceiros | CAP-06 (Oferta e Precificação) | Documento | Por atualização |
| Metas de receita via canal | CAP-08 (Performance) | Estruturado | Anual / trimestral |
| Capacidade de atendimento de novos clientes | CAP-05 (Gestão de Clientes) | Estruturado | Mensal |

---

## 4. Saídas Obrigatórias

### 4.1 Saídas Operacionais
| Saída | Destinatário | Periodicidade |
|-------|-------------|--------------|
| Leads qualificados de parceiros | CAP-02 (Gestão de Demanda) | Por evento |
| Relatório de performance de parceiros | Liderança + CAP-08 | Mensal |
| Pagamento de comissões de parceiros | Financeiro + Parceiro | Mensal (conforme política) |
| Contrato de parceria assinado | CAP-04 + repositório oficial | Por evento (novo parceiro) |

---

## 5. Regras de Negócio

### RN-01: Critérios de Elegibilidade de Parceiros
- Para ser parceiro da empresa, o candidato DEVE atender a: [critérios específicos — ex: atuar no segmento do ICP, ter carteira de clientes relevante, não ser concorrente direto, ter capacidade de representar a marca adequadamente]
- Parceiro DEVE assinar contrato de parceria antes de qualquer atividade comercial em nome da empresa
- Parceiro NÃO PODE oferecer condições diferentes das aprovadas pela empresa (preço, escopo, prazo)

### RN-02: Tipos de Parceria
A empresa PODE operar os seguintes modelos (definir quais ativar):
- **Indicação:** Parceiro indica leads; empresa executa a venda; parceiro recebe comissão de indicação
- **Revenda:** Parceiro vende em nome da empresa com treinamento e credenciamento; comissão maior
- **Co-venda:** Parceiro complementa a oferta da empresa; deal conjunto; divisão de receita negociada
- **Integração:** Parceiro tecnológico que se integra ao produto; modelo de parceria específico

### RN-03: Remuneração de Parceiros
- A política de comissão de parceiros DEVE estar documentada no contrato de parceria
- Comissão DEVE ser calculada com base em critérios objetivos e auditáveis
- Pagamento de comissão DEVE ser realizado até [data] do mês seguinte ao fechamento
- Parceiro recebe comissão somente após pagamento do cliente (exceto se acordado diferente no contrato)

### RN-04: Qualidade e Compliance
- Parceiro é responsável pela qualidade da prospecção que realiza em nome da empresa
- 3 leads desqualificados consecutivos de um parceiro resultam em revisão da parceria
- Parceiro NÃO PODE fazer promessas de funcionalidade, prazo ou preço que não estejam no portfólio oficial

### RN-05: Exclusividade
- Acordos de exclusividade geográfica ou setorial DEVEM ser aprovados pela liderança e formalizados em contrato
- Exclusividade NÃO é concedida a parceiros não-ativos (sem lead qualificado nos últimos 90 dias)

### RN-06: Revisão e Descredenciamento
- Parceiros são revisados trimestralmente com base em KPIs de performance
- Parceiro com 0 leads qualificados em 90 dias recebe notificação de inatividade
- Parceiro com 180 dias sem atividade é descredenciado automaticamente (salvo acordo específico)

---

## 6. Fluxo Operacional Completo

```
CICLO 1 — RECRUTAMENTO E ONBOARDING DE PARCEIROS (por evento)
│
├─► [Identificação de parceiro potencial]
│     ├─ Prospecção ativa: empresa busca parceiros estratégicos
│     └─ Entrada inbound: candidato se candidata a ser parceiro
│
├─► [Avaliação e qualificação do parceiro]
│     ├─ Verificar critérios de elegibilidade (RN-01)
│     └─ Reunião de alinhamento e apresentação mútua
│
├─► [Formalização]
│     ├─ Negociar termos: tipo de parceria, comissão, exclusividade
│     └─ Assinar contrato de parceria
│
├─► [Onboarding do Parceiro]
│     ├─ Treinamento: portfólio, ICP, processo de indicação, ferramentas
│     ├─ Acesso ao material de apoio (apresentações, proposta de valor)
│     └─ Definir canal de comunicação e gestor responsável
│
└─► Parceiro ativo → entra no ciclo de gestão contínua
│
▼
CICLO 2 — OPERAÇÃO CONTÍNUA (mensal)
│
├─► [Recebimento de leads de parceiros]
│     ├─ Parceiro envia lead via formulário/CRM/e-mail (conforme processo definido)
│     ├─ Registrar lead com tag de origem (parceiro específico) no CRM
│     └─ Lead entra no pipeline de CAP-02 para qualificação
│
├─► [Processo comercial]
│     └─ Lead qualificado segue para CAP-03 (vendas) como qualquer SQL
│
├─► [Comunicação com parceiro]
│     ├─ Parceiro é notificado do status do seu lead (conforme política)
│     └─ Relatório mensal de performance do parceiro enviado
│
├─► [Cálculo e pagamento de comissões]
│     ├─ Levantar todos os fechamentos de leads de parceiros no mês
│     ├─ Calcular comissão conforme contrato
│     └─ Pagar até data acordada
│
└─► [Reunião mensal/trimestral com parceiros estratégicos]
│
▼
CICLO 3 — REVISÃO DE PERFORMANCE (trimestral)
│
├─► Calcular KPIs de cada parceiro
├─► Classificar parceiros: Ativos, Em risco, Inativos
├─► Reunião de revisão com parceiros estratégicos (QBR de parcerias)
└─► Descredenciar inativos; desenvolver os em risco; investir nos ativos
│
▼
REGISTRO
│
├─► Contratos de parceria no repositório oficial
├─► Leads de parceiros com tag de origem no CRM
├─► Memória de cálculo de comissões arquivada
└─► Performance de parceiros registrada historicamente
│
▼
AUDITORIA
│
└─► Mensal: comissões corretas e no prazo, qualidade de leads por parceiro
    Trimestral: performance geral do canal, parceiros ativos vs. total, NPS de parceiros
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPIs de Volume
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-CP-01 | Leads gerados por parceiros | Contagem de leads via canal de parceiros | Meta mensal | Mensal |
| KPI-CP-02 | SQLs gerados por parceiros | Leads de parceiros que viraram SQL | Meta mensal | Mensal |
| KPI-CP-03 | Receita fechada via parceiros | Soma de contratos de leads de parceiros | Meta mensal / % do total | Mensal |

### 7.2 KPIs de Qualidade
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-CP-04 | Taxa de conversão de leads de parceiros | SQLs parceiros / Leads parceiros × 100 | ≥ taxa do canal direto | Mensal |
| KPI-CP-05 | Win rate de oportunidades de parceiros | Fechamentos / SQLs de parceiros × 100 | ≥ win rate do canal direto | Trimestral |
| KPI-CP-06 | Ticket médio de clientes via parceiros | Receita via parceiros / Nº de clientes | ≥ ticket médio geral | Trimestral |

### 7.3 KPIs de Ecossistema
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-CP-07 | Taxa de ativação de parceiros | Parceiros com ≥1 lead nos últimos 90 dias / Total | ≥ [X]% | Trimestral |
| KPI-CP-08 | NPS de parceiros | % Promotores − % Detratores (pesquisa com parceiros) | ≥ [meta] | Semestral |
| KPI-CP-09 | Concentração do canal | % da receita do maior parceiro sobre total via canal | ≤ 40% | Trimestral |

### 7.4 KPIs de Remuneração
| Código | Indicador | Meta | Frequência |
|--------|-----------|------|-----------|
| KPI-CP-10 | Acuracidade de comissão de parceiros | 0 erros por mês | Mensal |
| KPI-CP-11 | Pagamento de comissão dentro do prazo | 100% | Mensal |

---

## 8. Gatilhos e Alertas Operacionais

| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-CP-01 | Parceiro sem lead qualificado há 60 dias | Contato proativo para reativar parceiro | Gestor de Parcerias |
| ALT-CP-02 | Parceiro sem lead há 90 dias | Notificação de inatividade; risco de descredenciamento | Gestor de Parcerias |
| ALT-CP-03 | 3 leads desqualificados consecutivos de um parceiro | Revisão do processo de indicação do parceiro + retrain | Gestor de Parcerias |
| ALT-CP-04 | Receita via canal abaixo de [meta] por 2 meses | Revisão de estratégia de canais + ativação de parceiros | Liderança + Gestor |
| ALT-CP-05 | Concentração em 1 parceiro acima de 40% | Alerta de risco de dependência → diversificar | Liderança |
| ALT-CP-06 | Parceiro oferecendo condições não autorizadas ao mercado | Ação imediata: comunicação ao parceiro + investigação | Gestor de Parcerias |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

| Desvio Observado | Possíveis Causas Raiz | Método de Diagnóstico |
|-----------------|----------------------|----------------------|
| Baixo volume de leads via canal | Parceiros não engajados; onboarding ruim; material insuficiente; sem incentivo claro | Auditoria de atividade por parceiro; pesquisa qualitativa com parceiros |
| Baixa qualidade de leads de parceiros | Parceiro não entende o ICP; sem treinamento adequado; qualquer lead é enviado sem filtro | Análise de motivos de desqualificação de leads de parceiros |
| Alta taxa de churn de parceiros | Processo burocrático; comissão inadequada; falta de suporte; concorrência mais atrativa | Entrevistas de desengajamento; pesquisa de NPS de parceiros |
| Concentração excessiva em 1 parceiro | Falta de estratégia de diversificação; parceiros não prospectados ativamente | Análise do portfólio de parceiros; plano de recrutamento ativo |

---

## 10. Planos de Ação Padronizados

### PA-CP-01: Canal de Parcerias Abaixo da Meta de Receita
```
Semana 1: Auditoria do portfólio de parceiros — quem está ativo vs. inativo
Semana 2: Contato com todos os parceiros inativos (reativação)
Semana 3: Avaliar se há necessidade de recrutar novos parceiros
Semana 4: Revisar materiais de suporte e processo de indicação (é fácil o suficiente?)
Mês 2: Lançar campanha de incentivo para parceiros com meta e prêmio
```

### PA-CP-02: Qualidade de Leads de Parceiros Baixa
```
Semana 1: Analisar os últimos 10 leads desqualificados de parceiros — qual o padrão?
Semana 2: Identificar os parceiros responsáveis pela maioria dos leads ruins
Semana 3: Realizar sessão de (re)treinamento com esses parceiros sobre o ICP e qualificação
Semana 4: Implementar formulário de pré-qualificação obrigatório para indicação de leads
```

### PA-CP-03: Parceiro Estratégico em Risco de Desengajamento
```
Imediato: Reunião de diagnóstico urgente com o parceiro
Semana 1: Entender causa raiz da insatisfação
Semana 2: Propor plano de melhoria específico (pode envolver: suporte, comissão, simplificação do processo)
Semana 3: Acordo formal de retomada com metas claras
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Mensal (Gestor de Parcerias)
**Checklist:**
- [ ] Todos os leads de parceiros rastreados por origem no CRM
- [ ] Comissões calculadas corretamente (KPI-CP-10)
- [ ] Comissões pagas no prazo (KPI-CP-11)
- [ ] Parceiros inativos identificados e notificados

### 11.2 Auditoria Trimestral (Gerente + Liderança)
**Checklist:**
- [ ] Performance por parceiro calculada (leads, SQLs, receita)
- [ ] NPS de parceiros coletado (se trimestre de coleta)
- [ ] Parceiros classificados: ativos, em risco, inativos
- [ ] Concentração do canal avaliada (KPI-CP-09)
- [ ] Estratégia de recrutamento de novos parceiros revista

### 11.3 Auditoria Anual (Liderança)
**Checklist:**
- [ ] Análise do canal: contribuição % de receita via parceiros vs. meta
- [ ] Portfólio de tipos de parceria revisado (indicação, revenda, co-venda)
- [ ] Política de comissão revisada e validada para o próximo ano
- [ ] Plano de expansão do ecossistema de parcerias aprovado

---

## 12. Possibilidades de Automação

### 12.1 CRM e Portal de Parceiros
| Automação | Trigger | Ação |
|-----------|---------|------|
| Tag automática de origem | Lead criado via canal de parceiro | Aplica tag do parceiro específico e rastreia toda a jornada |
| Notificação de status ao parceiro | Mudança de etapa do lead no pipeline | Parceiro recebe update automático via e-mail / portal |
| Cálculo automático de comissão | Oportunidade marcada como "Ganha" (lead de parceiro) | Calcula comissão conforme contrato do parceiro |
| Alerta de inatividade | Parceiro sem lead nos últimos 60 dias | Notificação automática para gestor de parcerias |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Identificação de parceiros potenciais | IA analisa base de contatos e identifica candidatos a parceiros com base em critérios definidos |
| Previsão de atividade de parceiros | ML prevê quais parceiros têm maior probabilidade de enviar leads no próximo mês |
| Análise de qualidade de leads por parceiro | IA classifica a qualidade histórica de cada parceiro para priorizar relacionamento |

### 12.3 Portal de Parceiros
| Funcionalidade | Descrição |
|---------------|----------|
| Registro de leads | Parceiro registra lead diretamente no portal (sem e-mail/planilha) |
| Tracking de comissões | Parceiro visualiza seus leads, status e comissões acumuladas em tempo real |
| Materiais de apoio | Biblioteca de materiais de vendas, apresentações e treinamentos |
| NPS de parceiros | Pesquisa integrada ao portal para coleta automática de NPS |

### 12.4 Dashboards
| Dashboard | Métricas | Público |
|-----------|---------|---------|
| Channel Performance | Leads, SQLs, receita por parceiro | Gestor de Parcerias (tempo real) |
| Partner Ecosystem | Taxa de ativação, NPS, concentração | Liderança (trimestral) |
| Commission Tracker | Comissões calculadas vs. pagas por mês | Financeiro + Gestor (mensal) |

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 Matriz de Interfaces

| Módulo | Tipo | CAP-09 Fornece | CAP-09 Recebe |
|--------|------|----------------|---------------|
| CAP-01 Inteligência Comercial | Recebe | — | ICP e critérios de qualificação (para treinar parceiros) |
| CAP-02 Gestão de Demanda | Fornece | Leads gerados por parceiros (com tag de origem) | Taxa de conversão de leads de parceiros para feedback |
| CAP-03 Processo de Vendas | Fornece | SQLs de parceiros (oportunidades com contexto de parceria) | Feedback de fechamento e qualidade dos leads recebidos |
| CAP-04 Gestão de Receita | Bilateral | Dados de fechamentos via canal (para cálculo de comissão) | Confirmação de pagamento ao cliente (trigger de comissão) |
| CAP-05 Gestão de Clientes | Recebe | — | Capacidade de atendimento de novos clientes via parceiros |
| CAP-06 Oferta e Precificação | Recebe | — | Portfólio e condições especiais para parceiros |
| CAP-08 Performance e Autogestão | Bilateral | KPIs do canal (volume, receita, qualidade) | Metas de receita via canal; benchmarks |

### 13.2 Sequência de Ativação
```
CAP-09 é ativado como módulo de EVOLUÇÃO quando:
- A empresa tem produto/serviço maduro o suficiente para terceiros venderem
- O canal direto está funcionando (CAP-01 a CAP-08 operacionais)
- Há capacidade interna para suportar novos clientes gerados por parceiros (CAP-05)
- A política de parceria e comissão está documentada e aprovada
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-09 (módulo de evolução) |
