---
id: ARC-ENG-011
titulo: "ENG-11 — Decision Engine (Motor Cognitivo)"
versao: "1.0.0"
status: aprovado
categoria: C1-Fundacional
autor: Guardião da Documentação Técnica
criado-em: 2026-07-01
atualizado-em: 2026-07-01
dependencias:
  - ARC-ENG-000
  - ARC-ENG-002
  - ARC-ENG-003
  - ARC-ENG-004
  - ARC-ENG-005
  - ARC-ENG-009
  - ARC-ENG-010
  - ARC-FOB-001
tags:
  [
    engine,
    decisao,
    cognitivo,
    priorizacao,
    diagnostico,
    escalonamento,
    aprendizado,
    catalogo,
    eventos,
    taxonomia,
  ]
---

# ENG-11 — Decision Engine (Motor Cognitivo)

---

## 1. Objetivo

Ser o **sistema cognitivo central** do SOE — a inteligência que determina *quando agir*, *como priorizar*, *qual ação escolher*, *quando escalar*, *quando encerrar* e *como transformar cada decisão em aprendizado permanente*.

As engines ENG-01 a ENG-10 fornecem os mecanismos operacionais: rastrear processos, medir KPIs, disparar alertas, diagnosticar causas, gerar planos de ação, auditar, automatizar workflows, aprender. A ENG-11 é a camada acima de todas elas: a inteligência que **orquestra** essas capacidades em respostas coerentes, priorizadas e fundamentadas.

Sem a ENG-11, o sistema reage. Com ela, o sistema **decide**.

---

## 2. Responsabilidades

- **Receber** eventos de todas as engines e módulos do SOE
- **Classificar** cada situação dentro da hierarquia universal de decisões
- **Priorizar** usando a Matriz Universal de Priorização (MUP)
- **Coordenar** o fluxo cognitivo completo: Detectar → Classificar → Priorizar → Diagnosticar → Escolher Resposta → Executar → Auditar → Aprender → Atualizar Conhecimento → Encerrar
- **Selecionar** a resposta correta a partir do Catálogo Universal de Ações (CUA)
- **Gerenciar** o Motor de Escalonamento (quando mudar de dono, quando subir de nível, quando fechar)
- **Alimentar** o Motor de Aprendizado com o resultado de cada decisão tomada
- **Manter** a Biblioteca Universal de Decisões (BUD) — taxonomia de problemas com respostas padrão
- **Publicar** o Catálogo Universal de Eventos (CUE) como contrato de eventos do sistema inteiro
- **Garantir** que nenhum alerta, desvio ou incidente seja descartado ou ignorado sem registro formal de justificativa

---

## 3. Posição na Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    MÓDULOS CAP-01 a CAP-09               │
│         (produzem eventos, executam ações, reportam)    │
└──────────────────────────┬──────────────────────────────┘
                           │ eventos
                           ▼
┌─────────────────────────────────────────────────────────┐
│              BARRAMENTO DE EVENTOS SOE                   │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│         ENG-11 — DECISION ENGINE (Motor Cognitivo)       │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Hierarq. │ │   MUP    │ │  Motor   │ │  Motor   │  │
│  │Decisões  │ │Priorizaç.│ │Diagnóst. │ │Correção  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │  Motor   │ │  Motor   │ │   CUA    │ │   BUD    │  │
│  │Escalon.  │ │Aprendiz. │ │(Ações)   │ │(Taxonomia│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                    ┌──────────┐                         │
│                    │   CUE    │                         │
│                    │(Eventos) │                         │
│                    └──────────┘                         │
└──────────────────────────┬──────────────────────────────┘
                           │ orquestração
                           ▼
┌─────────────────────────────────────────────────────────┐
│              ENG-01 a ENG-10 (Execução)                  │
│  ENG-01:Processos │ ENG-03:Alertas │ ENG-04:Diagnóstico  │
│  ENG-05:Planos    │ ENG-07:Workflows│ ENG-09:Melhoria    │
│  ENG-10:IA/Base   │ ENG-06:Auditoria│ ENG-08:Automação   │
└─────────────────────────────────────────────────────────┘
```

A ENG-11 **não substitui** as engines inferiores — ela as **orquestra**. Toda ação concreta ainda é executada pela engine especializada. A ENG-11 decide *qual* engine acionar, *quando*, *com qual prioridade* e *em qual sequência*.

---

## 4. Sistema 1 — Hierarquia Universal de Decisões

### 4.1 Definição

Toda decisão no SOE pertence a exatamente um nível hierárquico. O nível determina: quem decide, em qual prazo, com qual processo, com qual documentação obrigatória.

### 4.2 Os Cinco Níveis

```
┌─────────────────────────────────────────────────────────────────┐
│  NÍVEL D0 — AUTOMÁTICO                                          │
│  Executado pelo sistema sem intervenção humana                  │
│  Exemplos: calcular ICP score, enviar notificação de SLA,       │
│            registrar transição de etapa, atualizar health score │
│  Responsável: SOE (sistema)   Prazo: imediato (<1 min)          │
│  Documentação: log automático em ENG-06                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  NÍVEL D1 — OPERACIONAL                                         │
│  Decisão individual do responsável direto pelo processo         │
│  Exemplos: avançar etapa no funil, escolher canal de contato,   │
│            registrar motivo de perda, acionar plano de ação     │
│  Responsável: colaborador designado   Prazo: ≤ SLA da etapa     │
│  Documentação: registro no processo (ENG-01)                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  NÍVEL D2 — TÁTICO                                              │
│  Decisão que afeta mais de uma pessoa, processo ou recurso      │
│  Exemplos: redistribuir carteira, ajustar meta do período,      │
│            escalar incidente, reprovar auditoria, abrir PDI     │
│  Responsável: gestor da área   Prazo: ≤ 24h                     │
│  Documentação: DECISION_LOG obrigatório                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  NÍVEL D3 — ESTRATÉGICO                                         │
│  Decisão com impacto financeiro, estrutural ou de longo prazo   │
│  Exemplos: revisar ICP, alterar política de preço, encerrar     │
│            parceria, reestruturar território, mudar meta anual  │
│  Responsável: diretoria   Prazo: ≤ 72h                          │
│  Documentação: DECISION_LOG + RFC + aprovação registrada        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  NÍVEL D4 — FUNDACIONAL                                         │
│  Decisão que altera a arquitetura do sistema ou modelo de       │
│  negócio; requer revisão completa de impactos                   │
│  Exemplos: mudar modelo de go-to-market, criar ou encerrar      │
│            canal de vendas, adquirir ou descontinuar produto    │
│  Responsável: fundadores / board   Prazo: ciclo deliberativo    │
│  Documentação: RFC + DECISION_LOG + ata de aprovação            │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Regras da Hierarquia

**HD-R01 — Nível Mínimo Correto:** Toda decisão deve ser tomada no nível mais baixo competente. Escalar uma decisão D1 para D2 sem necessidade é ineficiência registrada.

**HD-R02 — Escalada Formal:** Quando o responsável de um nível não consegue decidir no prazo, a escalada é automática e documentada pelo Motor de Escalonamento.

**HD-R03 — Indelegabilidade de Nível D3/D4:** Decisões D3 e D4 não podem ser delegadas para baixo sem aprovação explícita do nível superior. A delegação é registrada no DECISION_LOG.

**HD-R04 — Recusa é Decisão:** Optar por não agir diante de um problema identificado é uma decisão de nível equivalente. Deve ser registrada com justificativa formal. Silêncio não é válido.

**HD-R05 — Retroação Proibida:** Nenhuma decisão pode alterar registros históricos de outras decisões. Correções são novas decisões com referência à decisão original.

---

## 5. Sistema 2 — Matriz Universal de Priorização (MUP)

### 5.1 Definição

A MUP é o algoritmo que transforma qualquer situação em uma **prioridade calculada e objetiva**, eliminando a subjetividade de "isso parece urgente" e garantindo que os recursos de atenção humana e computacional sejam alocados na ordem correta.

### 5.2 As Cinco Dimensões

| Dimensão | Descrição | Escala | Peso |
|----------|-----------|--------|------|
| **Impacto (I)** | Magnitude do efeito no resultado do negócio se não tratado | 1–5 | 30% |
| **Urgência (U)** | Velocidade com que o problema piora sem intervenção | 1–5 | 25% |
| **Frequência (F)** | Número de ocorrências ou repetições no período de referência | 1–5 | 20% |
| **Tendência (T)** | Direção: o problema está melhorando, estável ou piorando? | -1 / 0 / +1 → 1–5 | 15% |
| **Risco (R)** | Probabilidade de cascata ou contaminação de outras áreas | 1–5 | 10% |

### 5.3 Tabelas de Pontuação

**Impacto (I):**
| Pontuação | Critério |
|-----------|----------|
| 5 | Impacto direto em receita ≥ 10% MRR ou em cliente estratégico (tier A) |
| 4 | Impacto em receita 5-10% MRR ou em múltiplos clientes tier B |
| 3 | Impacto em KPI estratégico sem efeito imediato em receita |
| 2 | Impacto em KPI tático ou eficiência operacional |
| 1 | Impacto cosmético, de processo interno ou de baixa visibilidade |

**Urgência (U):**
| Pontuação | Critério |
|-----------|----------|
| 5 | Requer resolução em < 1 hora (risco de perda irreversível) |
| 4 | Requer resolução em < 4 horas |
| 3 | Requer resolução em < 24 horas |
| 2 | Requer resolução em < 72 horas |
| 1 | Pode aguardar próximo ciclo semanal ou mensal |

**Frequência (F):**
| Pontuação | Critério |
|-----------|----------|
| 5 | Ocorre diariamente ou múltiplas vezes por semana |
| 4 | Ocorre semanalmente |
| 3 | Ocorre mensalmente |
| 2 | Ocorre trimestralmente |
| 1 | Ocorrência isolada ou rara |

**Tendência (T):**
| Pontuação | Critério |
|-----------|----------|
| 5 | Piorando rapidamente (>20% de deterioração no período) |
| 4 | Piorando moderadamente (10-20% de deterioração) |
| 3 | Estável (variação < 10%) |
| 2 | Melhorando moderadamente |
| 1 | Melhorando rapidamente (problema provavelmente auto-resolúvel) |

**Risco (R):**
| Pontuação | Critério |
|-----------|----------|
| 5 | Alta probabilidade de cascata para ≥ 3 módulos ou ≥ 5 clientes |
| 4 | Risco de cascata para 2 módulos ou 2-4 clientes |
| 3 | Risco confinado a 1 módulo com potencial de expansão |
| 2 | Risco confinado a 1 módulo sem probabilidade de expansão |
| 1 | Risco isolado, sem potencial de cascata |

### 5.4 Fórmula de Pontuação

```
MUP_SCORE = (I × 0.30) + (U × 0.25) + (F × 0.20) + (T × 0.15) + (R × 0.10)
```

### 5.5 Classificação de Prioridade

| Faixa MUP_SCORE | Prioridade | Cor | SLA de Resposta | SLA de Resolução |
|-----------------|------------|-----|-----------------|------------------|
| 4.5 – 5.0 | **EMERGENCIAL** | 🔴 | ≤ 15 min | ≤ 4 horas |
| 3.5 – 4.4 | **CRÍTICA** | 🟠 | ≤ 1 hora | ≤ 24 horas |
| 2.5 – 3.4 | **ALTA** | 🟡 | ≤ 4 horas | ≤ 72 horas |
| 1.5 – 2.4 | **MÉDIA** | 🔵 | ≤ 24 horas | ≤ 7 dias |
| 1.0 – 1.4 | **BAIXA** | ⚪ | ≤ 72 horas | Próximo ciclo |

### 5.6 Modificadores Automáticos

Situações que elevam a prioridade calculada em +1 nível independentemente do score:
- Problema envolve cliente classificado como tier A
- Desvio > 30% em KPI com meta de OKR estratégico
- Segunda ocorrência do mesmo problema após plano de ação já aplicado
- Problema identificado em período de fechamento (últimos 3 dias úteis do mês)

Situações que reduzem a prioridade em -1 nível:
- Problema já tem plano de ação ativo em execução dentro do SLA
- Desvio é explicado por sazonalidade documentada no calendário do sistema

### 5.7 Estrutura de Dados da Priorização

```yaml
priorizacao:
  id: "PRIO-[UUID]"
  evento_origem_id: "[UUID do evento que gerou a situação]"
  calculada_em: "[timestamp ISO 8601]"
  dimensoes:
    impacto: 4
    urgencia: 5
    frequencia: 3
    tendencia: 4
    risco: 3
  score_bruto: 3.95
  modificadores_aplicados:
    - tipo: "cliente_tier_a"
      efeito: "+1_nivel"
      justificativa: "Cliente ACME Corp — tier A confirmado"
  prioridade_final: "EMERGENCIAL"
  nivel_decisao_requerido: "D2"
  responsavel_designado: "[ID do responsável]"
  sla_resposta_ate: "[timestamp]"
  sla_resolucao_ate: "[timestamp]"
```

---

## 6. Sistema 3 — Motor de Diagnóstico

### 6.1 Definição

O Motor de Diagnóstico coordena a investigação estruturada da causa raiz de qualquer situação priorizada como ALTA, CRÍTICA ou EMERGENCIAL. Ele não realiza o diagnóstico sozinho — ele **estrutura o fluxo lógico** que o responsável humano e a ENG-10 (IA) seguem juntos.

### 6.2 Fluxo de Investigação em 6 Camadas

```
CAMADA 1 — CONTEXTUALIZAÇÃO AUTOMÁTICA (< 2 min, sistema)
│
├─► Coletar histórico do KPI afetado (últimas 12 semanas)
├─► Identificar eventos recentes no módulo dono (últimas 72h)
├─► Listar alertas ativos correlacionados (mesmo módulo ou mesma entidade)
├─► Verificar alterações recentes: processos, pessoas, dados, sistemas
└─► Checar se problema já ocorreu antes (base histórica ENG-10)

CAMADA 2 — CLASSIFICAÇÃO DA CAUSA (framework de categorias)
│
└─► O responsável classifica a causa provável em uma das 6 categorias:
    ┌─────────────────────────────────────────────────────────┐
    │ PROCESSO  — Fluxo, etapa, critério, SLA, handoff        │
    │ PESSOA    — Habilidade, conhecimento, motivação, carga  │
    │ DADO      — Qualidade, completude, atualização, acesso  │
    │ FERRAMENTA — Sistema, integração, automação, CRM/ERP    │
    │ ESTRATÉGIA — ICP, posicionamento, preço, proposta       │
    │ EXTERNO   — Mercado, concorrência, sazonalidade, macro  │
    └─────────────────────────────────────────────────────────┘

CAMADA 3 — INVESTIGAÇÃO POR 5 PORQUÊS (estruturado)
│
└─► Sistema provê template:
    POR QUÊ 1: [Sintoma visível no KPI] aconteceu porque...
    POR QUÊ 2: Isso aconteceu porque...
    POR QUÊ 3: Isso aconteceu porque...
    POR QUÊ 4: Isso aconteceu porque...
    POR QUÊ 5: A causa raiz é...
    └─► Responsável preenche; ENG-10 sugere com base em padrões históricos

CAMADA 4 — VALIDAÇÃO DE HIPÓTESE
│
└─► A causa raiz identificada é validável com dados disponíveis?
    ├─► SIM → Apresentar evidências que confirmam; registrar como confirmada
    └─► NÃO → Registrar como hipótese; iniciar coleta de dados adicionais
        └─► SLA de coleta: 24h para retornar com evidências

CAMADA 5 — CLASSIFICAÇÃO DE ORIGEM SISTÊMICA
│
└─► A causa raiz já existia antes deste problema?
    ├─► Primeira ocorrência → origem: NOVO
    ├─► Recorrência (causa já conhecida) → origem: RECORRENTE
    │   └─► Se recorrente: o plano de ação anterior foi insuficiente ou não implementado?
    │       ├─► Não implementado → escalar para D2 (gestor); abrir incidente de governança
    │       └─► Implementado e ineficaz → plano anterior marcado como INEFICAZ; novo diagnóstico necessário
    └─► Causa sistêmica (afeta múltiplos módulos) → origem: SISTÊMICA
        └─► Escalar automaticamente para D3

CAMADA 6 — REGISTRO DO DIAGNÓSTICO (imutável)
│
└─► Registrar:
    - Categoria da causa
    - Causa raiz declarada
    - Evidências apresentadas
    - Status de validação
    - Origem sistêmica
    - Responsável que diagnosticou
    - Timestamp
    └─► Emitir evento: decisao.diagnostico_concluido
```

### 6.3 Estrutura de Dados do Diagnóstico

```yaml
diagnostico:
  id: "DIAG-[UUID]"
  priorizacao_id: "PRIO-[UUID]"
  alerta_origem_id: "[UUID]"
  iniciado_em: "[timestamp]"
  concluido_em: "[timestamp]"
  responsavel_id: "[ID]"
  contexto_automatico:
    historico_kpi: "[referência ao conjunto de dados coletado]"
    eventos_recentes: ["[UUID]", "[UUID]"]
    alertas_correlacionados: ["[UUID]"]
    ocorrencias_historicas: 2
  categoria_causa: "PROCESSO"
  cinco_porques:
    - nivel: 1
      pergunta: "Por que a taxa de conversão de SQL caiu 18%?"
      resposta: "Porque os leads estão chegando em estágios mais iniciais do funil"
    - nivel: 2
      pergunta: "Por que os leads chegam mais cedo no funil?"
      resposta: "Porque a régua de nutrição foi reduzida de 5 para 2 toques"
    - nivel: 3
      pergunta: "Por que a régua foi reduzida?"
      resposta: "Porque o time de marketing testou nova cadência sem validar com vendas"
    - nivel: 4
      pergunta: "Por que o teste foi feito sem alinhamento?"
      resposta: "Porque não existe processo formal de alinhamento de campanhas entre CAP-02 e marketing"
    - nivel: 5
      pergunta: "Por que não existe esse processo?"
      resposta: "Causa raiz: ausência de handoff documentado entre marketing e SDR"
  causa_raiz: "Ausência de protocolo de alinhamento entre marketing e SDR para mudanças na régua de nutrição"
  validacao_evidencias: "CONFIRMADA"
  evidencias: ["Taxa de MQL com score < 6 subiu de 12% para 31% no período", "Volume de leads inalterado"]
  origem_sistemica: "NOVO"
  sugestoes_ia: ["Criar SLA de handoff CAP-02 ↔ marketing", "Implementar gate de aprovação no workflow de campanhas"]
```

---

## 7. Sistema 4 — Motor de Correção

### 7.1 Definição

O Motor de Correção transforma o diagnóstico em uma **ação ou conjunto de ações selecionadas** a partir do Catálogo Universal de Ações (CUA). Ele não inventa respostas — ele mapeia a causa raiz identificada para as ações com maior probabilidade de eficácia, com base em histórico e na Biblioteca Universal de Decisões (BUD).

### 7.2 Algoritmo de Seleção de Resposta

```
[INPUT] Diagnóstico concluído com:
 - Categoria de causa (PROCESSO / PESSOA / DADO / FERRAMENTA / ESTRATÉGIA / EXTERNO)
 - Causa raiz específica
 - Prioridade (BAIXA / MÉDIA / ALTA / CRÍTICA / EMERGENCIAL)
 - Nível de decisão requerido (D0-D4)

[PASSO 1] Filtrar CUA por categoria de causa
  └─► Resultado: subconjunto de ações candidatas

[PASSO 2] Filtrar por compatibilidade com a prioridade
  └─► Ações com custo de implementação desproporcional à prioridade são filtradas

[PASSO 3] Ranquear por taxa de eficácia histórica (ENG-10)
  └─► Para causas raiz similares já diagnosticadas antes:
      qual ação gerou resultado marcado como EFICAZ?

[PASSO 4] Apresentar top 3 ações recomendadas ao responsável
  └─► Cada ação exibe:
      - Descrição da ação
      - Taxa de eficácia histórica para causas similares (se disponível)
      - Nível de esforço estimado (BAIXO / MÉDIO / ALTO)
      - SLA de implementação
      - Dependências (outras ações ou aprovações necessárias)

[PASSO 5] Responsável seleciona ação (ou combinação de ações)
  └─► Seleção registrada com justificativa

[PASSO 6] Motor cria plano de ação formal via ENG-05
  └─► Plano vinculado ao diagnóstico e ao evento de origem
  └─► Emite evento: decisao.correcao_selecionada
```

### 7.3 Política de Ação Não Disponível no Catálogo

Quando o responsável determina que nenhuma ação do CUA é adequada:

1. Registrar a nova ação com todos os campos obrigatórios
2. Classificar como `tipo: CUSTOM`
3. Executar normalmente via ENG-05
4. Após encerramento: Motor de Aprendizado avalia eficácia
5. Se eficácia = EFICAZ e frequência de recorrência ≥ 2: proposta automática de inclusão no CUA

### 7.4 Política de Ação Múltipla

Quando o diagnóstico identifica causa raiz multidimensional (ex: PROCESSO + PESSOA):

- Máximo de 3 ações simultâneas no plano principal
- Demais ações vão para backlog de melhoria (ENG-09) com prioridade calculada
- Regra: a ação de maior impacto imediato tem prioridade sobre ações estruturais

---

## 8. Sistema 5 — Motor de Escalonamento

### 8.1 Definição

O Motor de Escalonamento determina com precisão: **quando um problema muda de dono, quando sobe de nível hierárquico, quando retorna ao nível original, quando é encerrado e em qual condição pode ser ignorado formalmente**.

### 8.2 Condições de Escalada (Automática)

| Gatilho | Condição | Escalada Para | Prazo da Escalada |
|---------|----------|--------------|-------------------|
| SLA de resposta vencido | Responsável não registrou ação no prazo | Gestor imediato (D2) | Imediata |
| SLA de resolução vencido | Plano de ação não encerrou no prazo | Gestor + ENG-03 alerta CRÍTICO | Imediata |
| Prioridade elevada por modificador | Score mudou para CRÍTICA ou EMERGENCIAL | Gestor (D2) ou Diretoria (D3) | Imediata |
| Segunda falha do mesmo plano de ação | Plano marcado como INEFICAZ pela segunda vez | Gestor + abertura de revisão estrutural | Automática no ato do fechamento |
| Cascata detectada | Problema afetou ≥ 2 módulos ou ≥ 3 clientes | Diretoria (D3) | Imediata |
| Incidente ativo > 72h sem resolução | Plano ativo com status não encerrado | Diretoria (D3) | Ao cruzar 72h |

### 8.3 Condições de Desescalada (Retorno ao Nível Original)

| Condição | Ação |
|----------|------|
| Causa raiz resolvida e validada | Encerrar no nível de decisão atual; retornar monitoramento ao responsável original |
| SLA resolvido antes de atingir escalada superior | Cancelar escalada pendente; registrar como resolvida no nível correto |
| Problema reclassificado para prioridade menor após novo contexto | Atualizar nível de decisão; notificar todos os níveis envolvidos |

### 8.4 Condições de Encerramento de Incidente

Um incidente pode ser encerrado SOMENTE quando:

```
CONDIÇÃO 1: Plano de ação associado tem status = ENCERRADO
     E
CONDIÇÃO 2: Verificação de eficácia registrada (EFICAZ / INEFICAZ / PARCIALMENTE_EFICAZ)
     E
CONDIÇÃO 3: KPI afetado retornou a ≥ 90% da meta (ou justificativa formal de por que não)
     E
CONDIÇÃO 4: Motor de Aprendizado registrou o incidente na base de conhecimento
```

Encerramento sem satisfazer todas as 4 condições requer aprovação D3 com justificativa registrada.

### 8.5 Registro Formal de Ignorar um Alerta

Ignorar formalmente um alerta é uma decisão de nível D2 (mínimo). Requer:

```yaml
ignorar_alerta:
  alerta_id: "[UUID]"
  responsavel_decisao_id: "[ID]"
  nivel_decisao: "D2"
  justificativa: "[texto obrigatório, mínimo 50 caracteres]"
  condicao_de_revisao: "[quando este alerta será reavaliado — data ou evento]"
  aprovador_id: "[ID do gestor que aprovou ignorar]"
  registrado_em: "[timestamp]"
```

Após ignorar: o alerta permanece no histórico com status `DESCONSIDERADO_FORMALMENTE`. É incluído na próxima auditoria para revisão.

### 8.6 Matriz de Escalada por Prioridade

```
EMERGENCIAL ─────────────────────────────────────────────────────►
  Resposta: responsável → gestor (simultas)
  Sem resposta em 15min: diretoria + alert EMERGENCIAL ENG-03
  Sem resposta em 30min: abertura de incidente crítico formal

CRÍTICA ──────────────────────────────────────────────────────────►
  Resposta: responsável (1h)
  Sem resposta em 1h: gestor assumindo
  Sem resolução em 24h: diretoria notificada

ALTA ─────────────────────────────────────────────────────────────►
  Resposta: responsável (4h)
  Sem resposta em 4h: lembrete automático
  Sem resposta em 8h: gestor notificado
  Sem resolução em 72h: gestor assume ownership

MÉDIA ────────────────────────────────────────────────────────────►
  Resposta: responsável (24h)
  Sem resposta em 24h: lembrete automático (2x)
  Sem resposta em 48h: gestor notificado
  Sem resolução em 7 dias: revisão no rito semanal

BAIXA ────────────────────────────────────────────────────────────►
  Entra no backlog de melhoria (ENG-09)
  Revisada no rito mensal
  Sem ação em 30 dias: reavaliação de prioridade
```

---

## 9. Sistema 6 — Motor de Aprendizado

### 9.1 Definição

O Motor de Aprendizado garante que **toda decisão tomada — bem ou mal sucedida — se converta em melhoria permanente** do sistema. Nenhum incidente encerrado pode ser "esquecido". Todo encerramento alimenta pelo menos um dos 5 destinos de conhecimento.

### 9.2 Os Cinco Destinos do Aprendizado

```
┌─────────────────────────────────────────────────────────────────┐
│  DESTINO 1 — PLAYBOOK                                           │
│  Quando: causa raiz nova + ação eficaz documentada              │
│  Ação: criar ou atualizar registro no playbook do módulo dono   │
│  Formato: problema → causa → ação → resultado → aprendizado     │
│  Owner: ENG-10 (Base de Conhecimento)                           │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  DESTINO 2 — PROCESSO                                           │
│  Quando: causa raiz = PROCESSO + mesma causa ocorreu ≥ 2x      │
│  Ação: propor revisão do blueprint do processo via ENG-01       │
│  Formato: RFC de processo com referência ao incidente           │
│  Owner: responsável do módulo + D3 para aprovação              │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  DESTINO 3 — KPI                                                │
│  Quando: incidente revelou que um KPI não capturava o problema  │
│  Ação: propor novo KPI ou ajuste em KPI existente via ENG-02    │
│  Formato: proposta com hipótese de detecção antecipada          │
│  Owner: ENG-11 → ENG-02 → aprovação D3                         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  DESTINO 4 — AUDITORIA                                          │
│  Quando: causa raiz deveria ter sido detectada por auditoria    │
│  Ação: atualizar checklist de auditoria do módulo em ENG-06     │
│  Formato: novo item de verificação com origem documentada       │
│  Owner: ENG-11 → ENG-06                                         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  DESTINO 5 — ENGINE / CATÁLOGO                                  │
│  Quando: ação nova foi eficaz e pode ser reutilizada            │
│  Ação: incluir no CUA (Catálogo Universal de Ações)             │
│  Formato: entrada padronizada com categoria, SLA, eficácia      │
│  Owner: ENG-11 (curador do CUA)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Fluxo do Aprendizado

```
[ENCERRAMENTO DO INCIDENTE]
│
├─► Verificar eficácia: EFICAZ / PARCIALMENTE_EFICAZ / INEFICAZ
│
├─► Se EFICAZ:
│   └─► Motor verifica se causa raiz + ação já estão no playbook
│       ├─► Não estão → Criar entrada no playbook (DESTINO 1)
│       └─► Estão → Atualizar contagem de confirmação (reforço)
│
├─► Se INEFICAZ:
│   └─► Registrar ação como ineficaz para esta causa no histórico
│       └─► Reduzir taxa de eficácia da ação para causa similar
│           └─► Não será sugerida como top-3 novamente para o mesmo tipo
│
├─► Se PARCIALMENTE_EFICAZ:
│   └─► Registrar com nota de contexto (o que funcionou, o que não funcionou)
│
├─► Verificar destinos adicionais (2-5) com base na causa raiz
│
└─► Emitir evento: decisao.aprendizado_registrado
    └─► ENG-10 atualiza base de conhecimento
```

### 9.4 KPIs do Motor de Aprendizado

| KPI | Definição | Meta |
|-----|-----------|------|
| Taxa de Conversão em Playbook | % incidentes que geraram entrada no playbook | ≥ 80% |
| Redução de Recorrência | % causas raiz que repetiram após plano eficaz | ≤ 15% |
| Tempo até Aprendizado | Dias entre encerramento e atualização da base | ≤ 5 dias |
| Eficácia do Catálogo | % planos usando CUA com resultado EFICAZ | ≥ 65% |

---

## 10. Sistema 7 — Biblioteca Universal de Decisões (BUD)

### 10.1 Definição

A BUD é a **taxonomia completa de problemas** que o sistema pode encontrar, com as decisões padrão associadas a cada categoria. É o "manual de decisões" do SOE — construído progressivamente com base em ocorrências reais, mas com uma estrutura pré-definida que cobre os domínios fundamentais.

### 10.2 Taxonomia de Problemas

```
PROBLEMAS DE PESSOAS
├── Desempenho individual abaixo da meta
│   ├── Decisão padrão: diagnóstico de gap → PDI ou retreinamento
│   └── Aciona: PROC-CAP07-PDI, CUA-P-04
├── Alta rotatividade (turnover acima do limiar)
│   ├── Decisão padrão: entrevistas de saída → revisão de causa → ajuste estrutural
│   └── Aciona: D3, RFC, CUA-P-07
├── Sobrecarga de equipe (capacidade esgotada)
│   ├── Decisão padrão: redistribuição de carga ou contratação emergencial
│   └── Aciona: D2, CUA-P-03, CUA-P-08
└── Lacuna de conhecimento generalizada (>1 pessoa com mesmo gap)
    ├── Decisão padrão: programa de capacitação coletiva
    └── Aciona: D2, CUA-P-01

PROBLEMAS DE PROCESSO
├── SLA de etapa sistematicamente violado
│   ├── Decisão padrão: revisão do SLA ou do processo de execução
│   └── Aciona: ENG-01, CUA-PR-02, RFC
├── Handoff falhando entre módulos
│   ├── Decisão padrão: criar ou atualizar protocolo de handoff
│   └── Aciona: CUA-PR-05, D2
├── Exit criteria bloqueando avanço sem motivo legítimo
│   ├── Decisão padrão: revisar critérios; ajustar ou criar exceção formal
│   └── Aciona: CUA-PR-03, D2
└── Processo não seguido (desvio de compliance)
    ├── Decisão padrão: reforço de treinamento + auditoria imediata
    └── Aciona: ENG-06, CUA-P-01, CUA-PR-06

PROBLEMAS DE DEMANDA
├── Volume de leads abaixo do mínimo
│   ├── Decisão padrão: ativar plano de geração de demanda (orgânico + pago)
│   └── Aciona: D2, CUA-D-01, CUA-D-02
├── Qualidade de leads degradada (ICP score médio caindo)
│   ├── Decisão padrão: revisar ICP e critérios de qualificação
│   └── Aciona: D3, CUA-D-03, CUA-D-05
├── Canal de aquisição saturado ou com ROI negativo
│   ├── Decisão padrão: redistribuir investimento; testar novo canal
│   └── Aciona: D3, CUA-D-04
└── Sazonalidade não mapeada causando shortfall
    ├── Decisão padrão: ajuste de expectativa + plano de antecipação para próximo ciclo
    └── Aciona: D2, CUA-D-06

PROBLEMAS DE QUALIDADE
├── Taxa de erro em entrega ou produto acima do limiar
│   ├── Decisão padrão: inspeção de processo de entrega; correção de causa raiz
│   └── Aciona: D2, CUA-Q-01
├── NPS / CSAT abaixo da meta por segmento
│   ├── Decisão padrão: mapeamento de momentos de insatisfação; plano de CX
│   └── Aciona: D2, CUA-Q-02, CUA-CS-03
├── Retrabalho > limiar definido
│   ├── Decisão padrão: análise de causas de retrabalho; revisão de critérios de aceite
│   └── Aciona: D2, CUA-Q-03
└── Auditoria com ICO ou ICG abaixo da meta
    ├── Decisão padrão: plano de ação de compliance com prazo ≤ 30 dias
    └── Aciona: ENG-06, CUA-PR-06, D2

PROBLEMAS FINANCEIROS
├── MRR abaixo da meta (churn > new business)
│   ├── Decisão padrão: ativar protocolo de salvamento + revisão da estratégia de aquisição
│   └── Aciona: D3, CUA-F-01, CUA-CS-01
├── Inadimplência acima do limiar
│   ├── Decisão padrão: ativar régua de cobrança + análise de perfil dos inadimplentes
│   └── Aciona: ENG-07, CUA-F-02
├── CAC acima do limiar de viabilidade
│   ├── Decisão padrão: revisão de eficiência de canais + ajuste de quota
│   └── Aciona: D3, CUA-F-03, CUA-D-04
└── LTV/CAC abaixo do mínimo estratégico
    ├── Decisão padrão: revisão de pricing + estratégia de expansão
    └── Aciona: D3, CUA-F-04, CUA-F-05

PROBLEMAS ESTRATÉGICOS
├── Win Rate sistematicamente abaixo da meta
│   ├── Decisão padrão: análise de win/loss + revisão de posicionamento e ICP
│   └── Aciona: D3, CUA-E-01, CUA-D-03
├── Churn de clientes estratégicos (tier A)
│   ├── Decisão padrão: post-mortem imediato + revisão do modelo de sucesso
│   └── Aciona: D3, CUA-CS-01, CUA-E-02
├── Novo concorrente afetando pipeline
│   ├── Decisão padrão: atualizar inteligência competitiva + ajustar battle cards
│   └── Aciona: D3, CUA-E-03
└── Meta estratégica em risco (OKR off-track)
    ├── Decisão padrão: revisão de plano estratégico no próximo QBR antecipado
    └── Aciona: D3, CUA-E-04
```

### 10.3 Estrutura de Entrada na BUD

```yaml
bud_entrada:
  id: "BUD-[CATEGORIA]-[SEQUENCIAL]"
  categoria: "PROCESSO"           # PESSOAS | PROCESSO | DEMANDA | QUALIDADE | FINANCEIRO | ESTRATEGICO
  subcategoria: "Handoff falhando entre módulos"
  descricao: "Transferência de responsabilidade entre dois módulos está gerando perda de contexto, atrasos ou retrabalho"
  gatilhos_tipicos:
    - "alerta de SLA em etapa de handoff"
    - "reclamação registrada de responsável receptor"
    - "auditoria identifica dados faltantes na transferência"
  nivel_decisao_padrao: "D2"
  acoes_recomendadas:
    - id: "CUA-PR-05"
      taxa_eficacia: 0.78
      esforco: "MEDIO"
    - id: "CUA-P-01"
      taxa_eficacia: 0.62
      esforco: "BAIXO"
  destinos_aprendizado: ["PLAYBOOK", "PROCESSO"]
  historico_ocorrencias: 7
  ultima_ocorrencia: "2026-06-15"
  versao: "1.2.0"
  atualizado_em: "2026-06-30"
```

---

## 11. Sistema 8 — Fluxo Cognitivo Universal

### 11.1 Definição

O Fluxo Cognitivo Universal é a **sequência canônica de processamento** que toda situação atravessa desde a detecção até o encerramento e aprendizado. É o "pensamento" do sistema — o algoritmo que garante que nenhuma etapa seja pulada e que toda decisão seja fundamentada.

### 11.2 O Fluxo em 12 Passos

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 1 — DETECTAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Evento do Catálogo Universal de Eventos (CUE)
Ação:   ENG-11 recebe e registra o evento
        Verifica se já existe incidente ativo para o mesmo
        contexto (evitar duplicata — deduplicação por event_id)
Output: Evento registrado; ID de situação gerado
        OU referência ao incidente já ativo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 2 — CLASSIFICAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Evento registrado
Ação:   Mapear para categoria na BUD (PESSOAS / PROCESSO /
        DEMANDA / QUALIDADE / FINANCEIRO / ESTRATÉGICO)
        Determinar nível de decisão inicial (D0-D4)
        Verificar histórico de ocorrências similares em ENG-10
Output: Situação classificada com categoria e subcategoria

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 3 — PRIORIZAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Situação classificada
Ação:   Aplicar MUP (I × U × F × T × R com pesos)
        Aplicar modificadores automáticos
        Determinar prioridade final e SLAs
Output: Registro de priorização (PRIO-[UUID])
        Responsável designado notificado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 4 — DIAGNOSTICAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Priorização concluída (prioridade ≥ ALTA)
Ação:   Ativar Motor de Diagnóstico (6 camadas)
        ENG-10 sugere hipóteses baseadas em histórico
        Responsável conduz investigação estruturada
Output: Diagnóstico registrado com causa raiz e evidências

        [Para prioridade BAIXA ou MÉDIA: diagnóstico simplificado
         — apenas categoria de causa + causa declarada]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 5 — ESCOLHER RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Diagnóstico concluído
Ação:   Motor de Correção filtra CUA por categoria
        Ranqueia por eficácia histórica via ENG-10
        Apresenta top 3 ações ao responsável
        Responsável seleciona ação(ões)
Output: Ação(ões) selecionada(s) com justificativa

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 6 — PLANEJAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Ação(ões) selecionada(s)
Ação:   ENG-05 cria plano de ação formal
        Vinculado ao diagnóstico e ao evento de origem
        SLA e responsável definidos
Output: Plano de ação ativo (PLAN-[UUID])

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 7 — EXECUTAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Plano de ação ativo
Ação:   Responsável executa; atualizações registradas em ENG-05
        ENG-07 (workflows) e ENG-08 (automação) apóiam onde aplicável
        Motor de Escalonamento monitora SLAs continuamente
Output: Plano em andamento → status atualizado por etapa

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 8 — MONITORAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Plano em execução
Ação:   ENG-02 monitora KPI afetado durante o período de ação
        ENG-11 verifica se situação está melhorando, estável ou piorando
        Reclassificação de prioridade se contexto mudar
Output: Dashboard de progresso; alertas de desvio se plano não avança

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 9 — AUDITAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Plano encerrado
Ação:   ENG-06 registra incidente no log de auditoria
        Verificação das 4 condições de encerramento
        Classificação de eficácia (EFICAZ / PARCIALMENTE / INEFICAZ)
Output: Incidente encerrado formalmente com classificação de eficácia

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 10 — APRENDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Incidente encerrado com classificação de eficácia
Ação:   Motor de Aprendizado determina destinos (1-5)
        ENG-10 recebe e incorpora na base de conhecimento
Output: Aprendizado registrado; BUD atualizada; playbook atualizado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 11 — ATUALIZAR CONHECIMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Aprendizado do passo 10
Ação:   Atualizar CUA (se nova ação eficaz identificada)
        Atualizar BUD (se nova subcategoria ou nova decisão padrão)
        Atualizar checklist de auditoria em ENG-06 (se aplicável)
        Propor RFC de processo se causa = PROCESSO recorrente
Output: Sistema atualizado; versão dos catálogos incrementada

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 12 — ENCERRAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Input:  Conhecimento atualizado
Ação:   Emitir evento decisao.incidente_encerrado
        Notificar todos os stakeholders envolvidos
        Disponibilizar relatório de incidente (read-only)
Output: Ciclo encerrado; situação arquivada com rastreabilidade completa
```

---

## 12. Sistema 9 — Catálogo Universal de Ações (CUA)

### 12.1 Definição

O CUA é o repositório central de todas as ações disponíveis no sistema. **Nenhum módulo inventa ações do zero** — eles consomem o CUA, que é mantido e evoluído pela ENG-11. Isso garante padronização, rastreabilidade e aprendizado acumulado sobre a eficácia de cada ação.

### 12.2 Estrutura de uma Entrada no CUA

```yaml
cua_acao:
  id: "CUA-[PREFIXO]-[SEQUENCIAL]"   # prefixo: P/PR/D/Q/F/CS/E/G (ver domínios)
  nome: "[Nome curto e descritivo da ação]"
  descricao: "[O que exatamente esta ação faz e qual o seu objetivo]"
  categoria: "[PESSOAS | PROCESSO | DEMANDA | QUALIDADE | FINANCEIRO | CLIENTE | ESTRATEGIA | GOVERNANCA]"
  tipo: "[CORRETIVA | PREVENTIVA | ESTRUTURAL | ESCALONAMENTO | TREINAMENTO | REVISAO]"
  nivel_decisao_minimo: "D1"          # nível mínimo para autorizar
  esforco: "MEDIO"                    # BAIXO | MEDIO | ALTO
  sla_implementacao_dias: 7
  responsavel_tipico: "[papel padrão que executa]"
  aciona_engines: ["ENG-05", "ENG-07"]
  metricas_de_sucesso:
    - kpi: "[KPI que deve melhorar]"
      direcao: "SUBIR"
      prazo_dias: 30
  taxa_eficacia_global: 0.74          # atualizada automaticamente pelo Motor de Aprendizado
  historico_aplicacoes: 23
  categorias_causa_raiz:
    - "PROCESSO:handoff_falha"
    - "PROCESSO:sla_violado"
  versao: "1.1.0"
  criado_em: "2026-07-01"
  atualizado_em: "2026-07-01"
```

### 12.3 Catálogo Inicial

#### Domínio PESSOAS (CUA-P)

| ID | Nome | Tipo | Esforço | SLA | Nível |
|----|------|------|---------|-----|-------|
| CUA-P-01 | Capacitação Individual | TREINAMENTO | MÉDIO | 15 dias | D1 |
| CUA-P-02 | Capacitação de Grupo | TREINAMENTO | ALTO | 30 dias | D2 |
| CUA-P-03 | Redistribuição de Carga | CORRETIVA | BAIXO | 2 dias | D2 |
| CUA-P-04 | Abertura de PDI | ESTRUTURAL | MÉDIO | 7 dias | D2 |
| CUA-P-05 | Sessão de Alinhamento | CORRETIVA | BAIXO | 1 dia | D1 |
| CUA-P-06 | Mentoring Pontual | CORRETIVA | MÉDIO | 7 dias | D1 |
| CUA-P-07 | Revisão de Estrutura de Equipe | ESTRUTURAL | ALTO | 30 dias | D3 |
| CUA-P-08 | Contratação Emergencial | ESTRUTURAL | ALTO | 45 dias | D3 |
| CUA-P-09 | Ramp-up Acelerado | TREINAMENTO | MÉDIO | 30 dias | D2 |

#### Domínio PROCESSO (CUA-PR)

| ID | Nome | Tipo | Esforço | SLA | Nível |
|----|------|------|---------|-----|-------|
| CUA-PR-01 | Revisão de SLA de Etapa | REVISAO | MÉDIO | 10 dias | D2 |
| CUA-PR-02 | Atualização de Blueprint de Processo | ESTRUTURAL | ALTO | 15 dias | D2 |
| CUA-PR-03 | Revisão de Exit Criteria | REVISAO | MÉDIO | 7 dias | D2 |
| CUA-PR-04 | Criação de Exceção Formal | CORRETIVA | BAIXO | 1 dia | D2 |
| CUA-PR-05 | Criação de Protocolo de Handoff | ESTRUTURAL | MÉDIO | 10 dias | D2 |
| CUA-PR-06 | Plano de Compliance Emergencial | CORRETIVA | ALTO | 30 dias | D2 |
| CUA-PR-07 | Automação de Etapa Manual | ESTRUTURAL | ALTO | 30 dias | D2 |
| CUA-PR-08 | Simplificação de Processo | ESTRUTURAL | MÉDIO | 15 dias | D2 |

#### Domínio DEMANDA (CUA-D)

| ID | Nome | Tipo | Esforço | SLA | Nível |
|----|------|------|---------|-----|-------|
| CUA-D-01 | Ativação de Canal de Geração de Demanda | CORRETIVA | MÉDIO | 7 dias | D2 |
| CUA-D-02 | Campanha de Aceleração de Pipeline | CORRETIVA | ALTO | 14 dias | D2 |
| CUA-D-03 | Revisão de ICP | ESTRUTURAL | ALTO | 21 dias | D3 |
| CUA-D-04 | Redistribuição de Investimento em Canais | ESTRATÉGICO | MÉDIO | 7 dias | D3 |
| CUA-D-05 | Atualização de Critérios de Qualificação | REVISAO | MÉDIO | 10 dias | D2 |
| CUA-D-06 | Plano de Antecipação Sazonal | PREVENTIVA | MÉDIO | 30 dias | D2 |
| CUA-D-07 | Ativação de Parceiros para Geração de Leads | CORRETIVA | MÉDIO | 14 dias | D2 |

#### Domínio QUALIDADE (CUA-Q)

| ID | Nome | Tipo | Esforço | SLA | Nível |
|----|------|------|---------|-----|-------|
| CUA-Q-01 | Inspeção de Processo de Entrega | CORRETIVA | MÉDIO | 5 dias | D2 |
| CUA-Q-02 | Programa de Melhoria de CX | ESTRUTURAL | ALTO | 30 dias | D2 |
| CUA-Q-03 | Revisão de Critérios de Aceite | REVISAO | MÉDIO | 10 dias | D2 |
| CUA-Q-04 | Atualização de Checklist de Auditoria | ESTRUTURAL | BAIXO | 5 dias | D2 |
| CUA-Q-05 | Plano de Retrabalho Zero | PREVENTIVA | ALTO | 21 dias | D2 |

#### Domínio FINANCEIRO (CUA-F)

| ID | Nome | Tipo | Esforço | SLA | Nível |
|----|------|------|---------|-----|-------|
| CUA-F-01 | Ativação de Protocolo de Salvamento de Receita | CORRETIVA | ALTO | 7 dias | D3 |
| CUA-F-02 | Ativação de Régua de Cobrança | CORRETIVA | BAIXO | 1 dia | D2 |
| CUA-F-03 | Revisão de Eficiência de Canal (CAC) | REVISAO | MÉDIO | 14 dias | D3 |
| CUA-F-04 | Revisão de Pricing | ESTRUTURAL | ALTO | 30 dias | D3 |
| CUA-F-05 | Estratégia de Expansão de Conta (Upsell) | PREVENTIVA | MÉDIO | 21 dias | D2 |
| CUA-F-06 | Ajuste de Quota de Vendas | REVISAO | MÉDIO | 10 dias | D3 |
| CUA-F-07 | Renegociação de Contrato | CORRETIVA | MÉDIO | 14 dias | D2 |

#### Domínio CLIENTE/SUCESSO (CUA-CS)

| ID | Nome | Tipo | Esforço | SLA | Nível |
|----|------|------|---------|-----|-------|
| CUA-CS-01 | Ativação de Protocolo de Salvamento de Cliente | CORRETIVA | ALTO | 24h (início) | D2 |
| CUA-CS-02 | Revisão de Plano de Sucesso do Cliente | CORRETIVA | MÉDIO | 5 dias | D1 |
| CUA-CS-03 | Plano de Resposta a NPS Detrator | CORRETIVA | MÉDIO | 7 dias | D1 |
| CUA-CS-04 | Onboarding Revisado | ESTRUTURAL | ALTO | 30 dias | D2 |
| CUA-CS-05 | Executive Business Review Emergencial | CORRETIVA | MÉDIO | 5 dias | D2 |
| CUA-CS-06 | Escalonamento para Gerente de Conta | ESCALONAMENTO | BAIXO | 4h | D1 |

#### Domínio ESTRATÉGICO (CUA-E)

| ID | Nome | Tipo | Esforço | SLA | Nível |
|----|------|------|---------|-----|-------|
| CUA-E-01 | Análise de Win/Loss Aprofundada | REVISAO | MÉDIO | 14 dias | D3 |
| CUA-E-02 | Post-mortem de Perda de Cliente Estratégico | CORRETIVA | ALTO | 7 dias | D3 |
| CUA-E-03 | Atualização de Intelligence Competitiva | PREVENTIVA | MÉDIO | 10 dias | D2 |
| CUA-E-04 | QBR Antecipado (fora de ciclo) | REVISAO | ALTO | 7 dias | D3 |
| CUA-E-05 | Revisão de Posicionamento | ESTRUTURAL | ALTO | 30 dias | D4 |
| CUA-E-06 | Atualização de Estratégia de GTM | ESTRUTURAL | ALTO | 45 dias | D4 |

#### Domínio GOVERNANÇA (CUA-G)

| ID | Nome | Tipo | Esforço | SLA | Nível |
|----|------|------|---------|-----|-------|
| CUA-G-01 | Abertura de Incidente de Governança | CORRETIVA | BAIXO | Imediato | D2 |
| CUA-G-02 | Revisão de RFC | REVISAO | MÉDIO | 10 dias | D2 |
| CUA-G-03 | Atualização de Playbook | ESTRUTURAL | BAIXO | 5 dias | D1 |
| CUA-G-04 | Atualização de KPI (parâmetros) | REVISAO | MÉDIO | 10 dias | D3 |
| CUA-G-05 | Atualização de Catálogo de Ações (CUA) | ESTRUTURAL | BAIXO | 5 dias | D2 |
| CUA-G-06 | Proposta de Novo KPI | ESTRUTURAL | MÉDIO | 15 dias | D3 |
| CUA-G-07 | Escalonamento Formal para Diretoria | ESCALONAMENTO | BAIXO | 1h | D2 |
| CUA-G-08 | Encerramento de Incidente com Exceção | CORRETIVA | MÉDIO | 1 dia | D3 |

---

## 13. Sistema 10 — Catálogo Universal de Eventos (CUE)

### 13.1 Definição

O CUE é o **contrato oficial de todos os eventos** que podem circular no barramento do SOE. Todo módulo e toda engine deve publicar apenas eventos listados no CUE (ou solicitar adição via RFC). Isso garante que o sistema inteiro funcione como um ecossistema coerente e que a ENG-11 possa processar qualquer evento com semântica conhecida.

### 13.2 Convenção de Nomenclatura

```
[dominio].[entidade].[acao_passado]
│          │          └─► verbo no particípio (criado, atualizado, cancelado, detectado...)
│          └─────────────► substantivo no singular
└────────────────────────► domínio do módulo dono
```

### 13.3 Catálogo por Domínio

#### Domínio: `lead` (CAP-02)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `lead.criado` | CAP-02 | Lead registrado no sistema | ENG-07, ENG-11 |
| `lead.qualificado` | CAP-02 | Lead passou para MQL | ENG-07, CAP-03 |
| `lead.desqualificado` | CAP-02 | Lead descartado (fora do ICP) | ENG-10, CAP-01 |
| `lead.convertido` | CAP-02 | Lead virou SQL | ENG-01, CAP-03 |
| `lead.inatividade.detectada` | CAP-02 | Lead sem interação > limiar | ENG-07, ENG-03 |

#### Domínio: `oportunidade` (CAP-03)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `oportunidade.criada` | CAP-03 | SQL convertido em oportunidade ativa | ENG-01, ENG-07 |
| `oportunidade.etapa_avancada` | CAP-03 | Oportunidade avançou no funil | ENG-01, ENG-02 |
| `oportunidade.proposta_enviada` | CAP-03 | Proposta comercial enviada ao cliente | ENG-07 |
| `oportunidade.ganha` | CAP-03 | Contrato fechado com sucesso | CAP-04, CAP-05, ENG-01, ENG-07, ENG-11 |
| `oportunidade.perdida` | CAP-03 | Oportunidade encerrada sem conversão | CAP-01, ENG-02, ENG-10 |
| `oportunidade.cancelada` | CAP-03 | Oportunidade encerrada por desistência | ENG-01, ENG-10 |

#### Domínio: `receita` (CAP-04)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `receita.mrr_calculado` | CAP-04 | MRR do período apurado | ENG-02, CAP-08 |
| `receita.fatura_emitida` | CAP-04 | Fatura gerada para cliente | ENG-07 |
| `receita.pagamento_confirmado` | CAP-04 | Pagamento processado com sucesso | ENG-02, CAP-05 |
| `receita.inadimplencia.nivel_alerta_atingido` | CAP-04 | Pagamento vencido (nivel: D1\|D5\|D15\|D30) | ENG-07, ENG-03 |
| `receita.inadimplencia.escalada` | CAP-04 | Inadimplência ≥ D30 sem resolução | ENG-07, ENG-03, ENG-11 |
| `receita.suspensao_executada` | CAP-04 | Serviço suspenso por inadimplência | CAP-05, ENG-06 |
| `receita.expansion_registrada` | CAP-04 | Upsell ou cross-sell confirmado | ENG-02, CAP-08 |
| `receita.contraction_registrada` | CAP-04 | Redução de contrato confirmada | ENG-02, ENG-03 |

#### Domínio: `cliente` (CAP-05)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `cliente.ativado` | CAP-05 | Onboarding concluído; cliente ativo | ENG-01, ENG-02 |
| `cliente.health_score_atualizado` | CAP-05 | Health score recalculado | ENG-02, ENG-03, ENG-11 |
| `cliente.churn_risco_detectado` | CAP-05 | Health score caiu para vermelho | ENG-07, ENG-03, ENG-11 |
| `cliente.cancelamento_solicitado` | CAP-05 | Cliente sinalizou intenção de cancelar | ENG-07, ENG-01, ENG-11 |
| `cliente.cancelamento.confirmado` | CAP-05 | Cancelamento efetivado | ENG-01, ENG-02, CAP-04, ENG-10, CAP-01 |
| `cliente.nps_respondido` | CAP-05 | NPS coletado e registrado | ENG-07, ENG-03, ENG-11 |
| `cliente.tier_alterado` | CAP-05 | Classificação de tier mudou | ENG-07, ENG-02 |
| `cliente.contrato_renovado` | CAP-05 | Renovação formalizada | CAP-04, ENG-01 |

#### Domínio: `mercado` (CAP-01)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `mercado.inteligencia_atualizada` | CAP-01 | Atualização de competitive intelligence | ENG-10, CAP-03 |
| `mercado.icp_revisado` | CAP-01 | Definição de ICP atualizada | ENG-07, CAP-02, CAP-03 |
| `mercado.analise_resultado.registrada` | CAP-01 | Win/loss analysis concluída | ENG-10, CAP-03 |
| `mercado.analise_resultado.padrao_identificado` | CAP-01 | Padrão sistêmico em win/loss detectado | ENG-11, CAP-03 |
| `mercado.territorio_definido` | CAP-01 | Segmentação de território atualizada | CAP-02, CAP-07 |

#### Domínio: `demanda` (CAP-02)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `demanda.pipeline.minimo_violado` | CAP-02 | Pipeline abaixo do volume mínimo | ENG-03, ENG-11 |
| `demanda.sql.criado` | CAP-02 | SQL criado e pronto para vendas | ENG-01, CAP-03 |
| `demanda.icp_score_calculado` | CAP-02 | ICP score atribuído ao lead | ENG-07 |
| `demanda.canal.performance_atualizada` | CAP-02 | Performance de canal de aquisição atualizada | ENG-02, CAP-08 |

#### Domínio: `performance` (CAP-08)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `performance.metas_atualizadas` | CAP-08 | Metas do período definidas ou revisadas | CAP-02, CAP-03, CAP-04, CAP-05, CAP-07, CAP-09 |
| `performance.okrs.atualizados` | CAP-08 | OKRs do ciclo atualizados | ENG-02, ENG-11 |
| `performance.desvio.detectado` | CAP-08 | Desvio de meta identificado (severidade: ALERTA\|CRITICO) | ENG-03, ENG-11 |
| `performance.relatorio_publicado` | CAP-08 | Relatório de performance do período emitido | ENG-10, todos os módulos |

#### Domínio: `parceiro` (CAP-09)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `parceiro.lead_indicado` | CAP-09 | Lead recebido via canal parceiro | CAP-02, ENG-01 |
| `parceiro.ativado` | CAP-09 | Parceiro concluiu onboarding | ENG-01, ENG-02 |
| `parceiro.desativado` | CAP-09 | Parceiro encerrou relação | ENG-01, ENG-10 |
| `parceiro.tier_alterado` | CAP-09 | Tier de parceiro mudou | ENG-07, ENG-02 |
| `parceiro.comissao_calculada` | CAP-09 | Comissão do período calculada | ENG-06, ENG-08 |
| `parceiro.inatividade.detectada` | CAP-09 | Parceiro sem atividade > limiar | ENG-07, ENG-03 |
| `parceiro.pip.iniciado` | CAP-09 | Performance improvement plan aberto | ENG-01, ENG-07 |
| `parceiro.ativacao.falhou` | CAP-09 | Parceiro não completou ativação no prazo | ENG-03, ENG-11 |
| `parceiro.certificacao_vencida` | CAP-09 | Certificação expirada | ENG-07, ENG-03 |
| `parceiro.avaliacao_trimestral_concluida` | CAP-09 | QBR de parceiro realizado | ENG-10 |
| `ecossistema.relatorio_publicado` | CAP-09 | Relatório do ecossistema de canais emitido | ENG-10, CAP-08 |
| `parceiro.contrato_renovado` | CAP-09 | Contrato de parceria renovado | ENG-01, ENG-06 |

#### Domínio: `colaborador` (CAP-07)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `colaborador.contratado` | CAP-07 | Novo colaborador incorporado | ENG-01, ENG-07 |
| `colaborador.meta_abaixo_limiar` | CAP-07 | Performance abaixo do mínimo por N períodos | ENG-03, ENG-11 |
| `colaborador.rampup_concluido` | CAP-07 | Período de ramp-up finalizado | ENG-01, ENG-02 |
| `colaborador.pdi_concluido` | CAP-07 | PDI encerrado com avaliação | ENG-10, ENG-09 |
| `colaborador.desligado` | CAP-07 | Colaborador encerrou vínculo | ENG-01, ENG-07 |
| `colaborador.treinamento_concluido` | CAP-07 | Treinamento registrado como concluído | ENG-10 |

#### Domínio: `processo` (ENG-01)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `processo.instancia_criada` | ENG-01 | Nova instância de processo iniciada | ENG-07, ENG-11 |
| `processo.etapa_concluida` | ENG-01 | Transição de etapa bem-sucedida | ENG-07, ENG-02 |
| `processo.exit_criteria_falhou` | ENG-01 | Critério de saída não satisfeito | ENG-03, ENG-11 |
| `processo.sla_violado` | ENG-01 | SLA de etapa ultrapassado | ENG-03, ENG-11 |
| `processo.instancia_concluida` | ENG-01 | Processo finalizado com sucesso | ENG-06, ENG-10 |
| `processo.instancia_cancelada` | ENG-01 | Processo encerrado antes do fim | ENG-10, ENG-11 |
| `processo.sem_responsavel` | ENG-01 | Instância sem responsável designado | ENG-03, ENG-11 |

#### Domínio: `decisao` (ENG-11)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `decisao.situacao_detectada` | ENG-11 | Evento classificado e priorizado | ENG-03, módulo dono |
| `decisao.diagnostico_concluido` | ENG-11 | Causa raiz identificada e registrada | ENG-05, ENG-10 |
| `decisao.correcao_selecionada` | ENG-11 | Ação ou plano de ação selecionado | ENG-05 |
| `decisao.escalonamento_ativado` | ENG-11 | Problema escalado para nível superior | ENG-03, responsável escalado |
| `decisao.incidente_encerrado` | ENG-11 | Ciclo completo encerrado com aprendizado | ENG-06, ENG-10 |
| `decisao.aprendizado_registrado` | ENG-11 | Conhecimento incorporado na base | ENG-10, ENG-09 |
| `decisao.cua_atualizado` | ENG-11 | Nova ação adicionada ao catálogo | ENG-10 |
| `decisao.bud_atualizada` | ENG-11 | Taxonomia de problemas atualizada | ENG-10 |

#### Domínio: `sistema` (SOE-SYS-SCHEDULER)

| Evento | Módulo Dono | Quando | Consumidores Típicos |
|--------|-------------|--------|----------------------|
| `sistema.periodo_encerrado` | SOE-SYS-SCHEDULER | Fim de período (diário/semanal/mensal/trimestral/anual) | CAP-04, CAP-08, ENG-02, ENG-06, ENG-11 |
| `sistema.sla_vencendo` | SOE-SYS-SCHEDULER | SLA atingirá limite em X horas | ENG-03, ENG-11 |
| `sistema.auditoria_programada` | SOE-SYS-SCHEDULER | Auditoria agendada se aproximando | ENG-06, módulo alvo |

---

## 14. Estrutura de Dados

### 14.1 Tabela: `decisao_situacoes`
```
id                      UUID PRIMARY KEY
evento_origem_id        UUID                        -- event_id do CUE
evento_tipo             TEXT                        -- tipo do evento
modulo_dono             TEXT
categoria_bud           TEXT                        -- PESSOAS|PROCESSO|...
subcategoria_bud        TEXT
nivel_decisao           TEXT                        -- D0|D1|D2|D3|D4
status                  ENUM(detectada, classificada, priorizada, em_diagnostico,
                             em_correcao, em_execucao, em_auditoria, encerrada,
                             desconsiderada)
responsavel_id          TEXT
criado_em               TIMESTAMP
atualizado_em           TIMESTAMP
encerrado_em            TIMESTAMP
correlacao_id           UUID
```

### 14.2 Tabela: `decisao_priorizacoes`
```
id                      UUID PRIMARY KEY
situacao_id             UUID REFERENCES decisao_situacoes
impacto                 SMALLINT
urgencia                SMALLINT
frequencia              SMALLINT
tendencia               SMALLINT
risco                   SMALLINT
score_bruto             DECIMAL(4,2)
modificadores_json      JSONB
prioridade_final        TEXT
sla_resposta_ate        TIMESTAMP
sla_resolucao_ate       TIMESTAMP
calculado_em            TIMESTAMP
```

### 14.3 Tabela: `decisao_diagnosticos`
```
id                      UUID PRIMARY KEY
situacao_id             UUID REFERENCES decisao_situacoes
priorizacao_id          UUID REFERENCES decisao_priorizacoes
responsavel_id          TEXT
categoria_causa         TEXT                        -- PROCESSO|PESSOA|DADO|...
cinco_porques_json      JSONB
causa_raiz              TEXT
validacao_evidencias    TEXT                        -- CONFIRMADA|HIPOTESE
evidencias_json         JSONB
origem_sistemica        TEXT                        -- NOVO|RECORRENTE|SISTEMICA
sugestoes_ia_json       JSONB                       -- da ENG-10
iniciado_em             TIMESTAMP
concluido_em            TIMESTAMP
```

### 14.4 Tabela: `decisao_incidentes` (registro consolidado)
```
id                      UUID PRIMARY KEY
situacao_id             UUID REFERENCES decisao_situacoes
diagnostico_id          UUID REFERENCES decisao_diagnosticos
plano_acao_id           UUID                        -- referência à ENG-05
eficacia                TEXT                        -- EFICAZ|PARCIALMENTE_EFICAZ|INEFICAZ
kpi_retornou_meta       BOOLEAN
excecao_encerramento    BOOLEAN
excecao_aprovador_id    TEXT
aprendizado_json        JSONB                       -- destinos registrados (1-5)
encerrado_em            TIMESTAMP
encerrado_por_id        TEXT
```

### 14.5 Tabela: `cua_acoes` (Catálogo Universal de Ações)
```
id                      TEXT PRIMARY KEY
nome                    TEXT
descricao               TEXT
categoria               TEXT
tipo                    TEXT
nivel_decisao_minimo    TEXT
esforco                 TEXT
sla_implementacao_dias  INTEGER
responsavel_tipico      TEXT
aciona_engines_json     JSONB
metricas_sucesso_json   JSONB
taxa_eficacia_global    DECIMAL(4,2)                -- atualizado pelo Motor de Aprendizado
historico_aplicacoes    INTEGER
categorias_causa_json   JSONB                       -- ["PROCESSO:handoff", ...]
ativo                   BOOLEAN
versao                  TEXT
criado_em               TIMESTAMP
atualizado_em           TIMESTAMP
```

### 14.6 Tabela: `bud_entradas` (Biblioteca Universal de Decisões)
```
id                      TEXT PRIMARY KEY
categoria               TEXT
subcategoria            TEXT
descricao               TEXT
gatilhos_tipicos_json   JSONB
nivel_decisao_padrao    TEXT
acoes_recomendadas_json JSONB
destinos_aprendizado    TEXT[]
historico_ocorrencias   INTEGER
ultima_ocorrencia       TIMESTAMP
versao                  TEXT
criado_em               TIMESTAMP
atualizado_em           TIMESTAMP
```

---

## 15. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `decisao.situacao_detectada` | Evento classificado e priorizado | `{situacao_id, categoria, prioridade, responsavel, sla_resposta_ate}` |
| `decisao.diagnostico_concluido` | Causa raiz registrada | `{situacao_id, diagnostico_id, categoria_causa, causa_raiz, origem_sistemica}` |
| `decisao.correcao_selecionada` | Ação selecionada do CUA | `{situacao_id, diagnostico_id, acoes_selecionadas, plano_acao_id}` |
| `decisao.escalonamento_ativado` | Escalada para nível superior | `{situacao_id, nivel_anterior, nivel_novo, motivo, responsavel_escalado}` |
| `decisao.incidente_encerrado` | Ciclo completo encerrado | `{situacao_id, incidente_id, eficacia, duracao_total_horas, aprendizado_destinos}` |
| `decisao.aprendizado_registrado` | Conhecimento incorporado | `{situacao_id, destinos_atualizados, kpi_impactado, playbook_atualizado}` |
| `decisao.cua_atualizado` | Nova ação adicionada ao catálogo | `{acao_id, nome, categoria, taxa_eficacia_inicial}` |
| `decisao.bud_atualizada` | Taxonomia de problemas atualizada | `{bud_id, categoria, subcategoria, tipo_alteracao}` |

---

## 16. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `kpi.limiar_cruzado` | ENG-02 | Iniciar Fluxo Cognitivo (passo 1) |
| `alerta.criado` | ENG-03 | Verificar se já existe situação ativa; iniciar ou vincular |
| `processo.sla_violado` | ENG-01 | Iniciar Fluxo Cognitivo com urgência elevada |
| `processo.exit_criteria_falhou` | ENG-01 | Classificar e priorizar; notificar responsável |
| `processo.sem_responsavel` | ENG-01 | Iniciar Motor de Escalonamento imediatamente |
| `cliente.churn_risco_detectado` | CAP-05 | Iniciar Fluxo Cognitivo com modificador tier-A se aplicável |
| `cliente.cancelamento.confirmado` | CAP-05 | Acionar Motor de Aprendizado; post-mortem obrigatório |
| `receita.inadimplencia.escalada` | CAP-04 | Iniciar Fluxo Cognitivo; nível D2 mínimo |
| `performance.desvio.detectado` | CAP-08 | Classificar por severidade; priorizar via MUP |
| `mercado.analise_resultado.padrao_identificado` | CAP-01 | Classificar como ESTRATÉGICO; nível D3 |
| `parceiro.ativacao.falhou` | CAP-09 | Iniciar diagnóstico no contexto de PROCESSO |
| `workflow.falhou` | ENG-07 | Registrar como situação; acionar diagnóstico técnico |
| `sistema.periodo_encerrado` | SOE-SYS-SCHEDULER | Executar ciclo de revisão de situações abertas |

---

## 17. Regras Gerais

**ENG11-R01 — Nenhum Evento Sem Decisão:** Todo evento recebido pela ENG-11 deve resultar em uma de três saídas: (a) início do Fluxo Cognitivo, (b) vinculação a situação já ativa, ou (c) descarte formal com justificativa registrada. Eventos "silenciados" sem registro são violação de governança.

**ENG11-R02 — MUP é Obrigatória:** Toda situação DEVE ser pontuada pela MUP antes de qualquer ação ser tomada. Pular a priorização por "urgência percebida" é permitido apenas em nível EMERGENCIAL, e neste caso a MUP é executada em paralelo à resposta inicial.

**ENG11-R03 — BUD antes do CUA:** O Motor de Correção DEVE consultar a BUD antes de recorrer ao CUA. A BUD contém decisões padrão validadas; o CUA é a execução. A ordem é: classificar na BUD → obter decisão padrão → confirmar com CUA → executar via ENG-05.

**ENG11-R04 — Aprendizado Não É Opcional:** O passo 10 (Aprender) do Fluxo Cognitivo não pode ser pulado. Encerrar um incidente sem registrar aprendizado requer aprovação D3 com justificativa formal.

**ENG11-R05 — Catálogos São Versionados:** CUA e BUD têm versão SemVer. Adição de nova entrada = MINOR. Correção de entrada existente = PATCH. Remoção ou mudança de estrutura = MAJOR. Mudanças MAJOR requerem RFC.

**ENG11-R06 — ENG-11 Não Executa:** A ENG-11 decide e orquestra. A execução de ações concretas é sempre delegada às engines ENG-01 a ENG-10. A ENG-11 não escreve dados em módulos CAP diretamente — ela emite eventos que as engines consomem.

**ENG11-R07 — Rastreabilidade Total:** Toda situação carrega um `correlacao_id` que permite rastrear todos os eventos, diagnósticos, planos de ação, escaladas e aprendizados derivados desde a detecção até o encerramento.

**ENG11-R08 — CUE é Contrato:** Nenhum módulo pode publicar eventos com tipos não listados no CUE sem aprovação de RFC. A adição de novos eventos ao CUE é versionada e comunicada a todos os consumidores.

---

## 18. Interfaces com as Engines

| Engine | Como a ENG-11 Usa |
|--------|------------------|
| ENG-01 (Processos) | Instancia processos de diagnóstico e acompanhamento; recebe eventos de violação de SLA e exit criteria |
| ENG-02 (KPIs) | Recebe eventos de limiar cruzado; consulta histórico de KPIs para contextualização do diagnóstico |
| ENG-03 (Alertas) | Delega emissão de alertas de escalonamento; consome alertas como ponto de entrada do Fluxo Cognitivo |
| ENG-04 (Diagnóstico) | Aciona para diagnósticos técnicos de causa raiz; recebe diagnóstico estruturado para incorporar ao incidente |
| ENG-05 (Planos de Ação) | Cria planos de ação com ações selecionadas do CUA; monitora status dos planos para alimentar o Motor de Escalonamento |
| ENG-06 (Auditoria) | Registra incidentes encerrados; atualiza checklists de auditoria com aprendizados do Motor de Aprendizado |
| ENG-07 (Workflows) | Delega execução de sequências automatizadas de resposta; aciona workflows padrão para categorias BUD conhecidas |
| ENG-08 (Automação) | Executa integrações externas necessárias a ações do CUA (ex: notificações, atualizações em CRM) |
| ENG-09 (Melhoria Contínua) | Envia para o backlog de melhoria situações com prioridade BAIXA ou ações estruturais identificadas |
| ENG-10 (IA/Conhecimento) | Consulta para sugestões de hipóteses no diagnóstico; envia aprendizados para incorporação; solicita atualização de playbooks |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-07-01 | Guardião da Documentação Técnica | Criação da especificação da ENG-11 |
