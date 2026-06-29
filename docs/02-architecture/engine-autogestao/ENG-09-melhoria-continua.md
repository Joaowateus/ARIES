---
id: ARC-ENG-009
titulo: "ENG-09 — Engine de Melhoria Contínua"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-002
  - ARC-ENG-004
  - ARC-ENG-005
  - ARC-ENG-006
tags: [engine, melhoria-continua, pdca, retrospectiva, kaizen, aprendizado, ciclo, evolucao]
---

# ENG-09 — Engine de Melhoria Contínua

---

## 1. Objetivo

Executar **ciclos sistemáticos de aprendizagem e aprimoramento** em todos os módulos do SOE — transformando dados de performance, alertas recorrentes, auditorias, planos de ação e retrospectivas em melhorias concretas nos processos, regras, KPIs e estruturas do sistema.

A ENG-09 é o **mecanismo de evolução** do SOE: ela garante que o sistema não apenas detecte e corrija desvios pontuais, mas aprenda com eles — tornando-se progressivamente mais eficiente, mais preciso nas metas, e menos dependente de intervenção humana para se auto-regular.

Sem a ENG-09, o SOE corrige mas não aprende. Com ela, cada problema resolvido torna o sistema menos propenso ao mesmo problema no futuro.

---

## 2. Responsabilidades

- **Agregar** sinais de melhoria de todas as outras Engines (alertas recorrentes, planos ineficazes, NCs recorrentes, desvios sistêmicos)
- **Executar** a cadência de retrospectivas por módulo e do SOE como um todo
- **Facilitar** o ciclo PDCA (Plan–Do–Check–Act) para cada melhoria identificada
- **Priorizar** melhorias por impacto estimado, urgência e viabilidade
- **Registrar** decisões de melhoria no DECISION_LOG (via ENG-01 ou diretamente)
- **Propor** atualizações em blueprints de processos, definições de KPI, templates de alerta e checklists de auditoria
- **Rastrear** se as melhorias implementadas produziram o efeito esperado
- **Alimentar** a ENG-10 com os aprendizados validados — transformando experiência em conhecimento institucional
- **Gerar** o relatório periódico de saúde evolutiva do SOE

---

## 3. Entradas

### 3.1 Sinais de Melhoria Recebidos de Outras Engines
| Sinal | Origem | Descrição |
|-------|--------|-----------|
| Alerta recorrente (>3× em 90 dias) | ENG-03 | Mesmo problema não foi resolvido estruturalmente |
| Plano de ação ineficaz | ENG-05 | Ação tomada não resolveu o problema |
| NC recorrente em auditoria | ENG-06 | Mesmo item reprovado em múltiplas auditorias |
| Diagnóstico com causa raiz recorrente | ENG-04 | Mesma categoria de causa raiz aparece repetidamente |
| KPI com tendência de queda (3+ períodos) | ENG-02 | Deterioração estrutural, não desvio pontual |
| Frequência de erros em conector | ENG-08 | Sistema externo pouco confiável |

### 3.2 Entradas de Cadência (Ativas — Agendadas)
| Cadência | Escopo | Quando |
|----------|--------|--------|
| Retrospectiva mensal por módulo | 1 módulo por vez | Até dia 10 do mês seguinte |
| Retrospectiva trimestral do Núcleo Comercial | Todos os módulos | 2 semanas após o trimestre |
| Retrospectiva anual do SOE | Sistema inteiro | Janeiro do ano seguinte |
| Revisão de metas (calibração) | Por módulo afetado | Por gatilho de ENG-02 ou planejamento |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Backlog de melhorias priorizado | Dashboard de Melhoria Contínua | Atualizado por evento |
| Proposta de atualização de processo | ENG-01 (novo blueprint) | Por melhoria aprovada |
| Proposta de atualização de KPI ou meta | ENG-02 | Por melhoria aprovada |
| Proposta de novo template de alerta | ENG-03 | Por melhoria aprovada |
| Proposta de atualização de checklist | ENG-06 | Por melhoria aprovada |
| Registro de aprendizado na base de conhecimento | ENG-10 | Por ciclo PDCA concluído |
| Evento `melhoria.implementada` | ENG-10, barramento SOE | Por melhoria executada |
| Relatório de Saúde Evolutiva do SOE | Liderança / Conselho | Trimestral |
| DECISION_LOG atualizado | Repositório oficial | Por decisão de melhoria aprovada |

---

## 5. Regras Gerais

### RG-01: Cadência É Inegociável
As retrospectivas agendadas são parte do contrato operacional do SOE. Uma retrospectiva não executada é uma não-conformidade registrada pela ENG-06. O sistema de autogestão que não se auto-avalia periodicamente perde sua capacidade de evoluir.

### RG-02: Melhoria Precisa de Hipótese Testável
Toda melhoria proposta DEVE ter: (a) problema observado com dados, (b) hipótese de melhoria ("se fizermos X, esperamos Y"), (c) métrica de sucesso específica, e (d) prazo para verificação. Melhorias sem hipótese testável são registradas como `indefinidas` e não são implementadas.

### RG-03: Separação entre Melhoria de Processo e Melhoria de Meta
Há dois tipos de ajuste distintos:
- **Melhoria de processo**: o processo está errado, mal definido, ou mal seguido — mudar o processo
- **Recalibração de meta**: o processo está certo mas a meta era irrealista — ajustar a meta
Misturar os dois é uma das formas mais comuns de ilusão de melhoria. A ENG-09 exige que cada proposta declare explicitamente qual dos dois tipos é.

### RG-04: O Act do PDCA Atualiza o Sistema
Quando um ciclo PDCA conclui com sucesso, a ENG-09 NÃO apenas registra o aprendizado — ela propõe formalmente a atualização do artefato correspondente: blueprint de processo (ENG-01), definição de KPI (ENG-02), template de alerta (ENG-03), checklist de auditoria (ENG-06), ou plano de ação padronizado (ENG-05). A melhoria só se torna permanente quando o artefato é atualizado.

### RG-05: Priorização por Impacto × Esforço
O backlog de melhorias é priorizado automaticamente pela ENG-09 usando a matriz impacto × esforço:
- **Impacto**: baseado no KPI afetado, frequência do problema, custo estimado do desvio
- **Esforço**: estimado pelo responsável da melhoria

Melhorias de alto impacto e baixo esforço (quick wins) têm prioridade automática.

### RG-06: Retrospectiva Não É Culpa — É Diagnóstico
A retrospectiva do SOE segue o princípio de segurança psicológica: o objetivo é aprender, não punir. Os registros de retrospectiva NÃO identificam indivíduos como responsáveis por falhas — identificam processos, sistemas e estruturas como causas. Isso é fundamental para que as retrospectivas sejam honestas.

---

## 6. Interfaces com os Módulos

A ENG-09 interage com **todos os módulos** através de sinais agregados:

| Módulo | Sinais de Melhoria Típicos |
|--------|---------------------------|
| CAP-01 | ICP sempre desatualizado → processo de revisão do ICP mal estruturado |
| CAP-02 | CPL sempre acima do limite → mix de canais inadequado |
| CAP-03 | Ciclo de vendas sistematicamente longo → etapa específica com gargalo estrutural |
| CAP-04 | Inadimplência sempre acima da meta → processo de onboarding financeiro falho |
| CAP-05 | Churn recorrente em determinado segmento → fit de produto inadequado para segmento |
| CAP-06 | Desconto médio sempre alto → proposta de valor não comunicada eficientemente |
| CAP-07 | Ramp-up sistematicamente longo → material de onboarding insuficiente |
| CAP-08 | Forecast sempre impreciso → metodologia de forecast inadequada |
| CAP-09 | Parceiros sempre inativos → modelo de parceria não incentiva adequadamente |

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `melhoria_backlog`
```
id                      UUID PRIMARY KEY
modulo                  TEXT
titulo                  TEXT
problema_observado      TEXT
evidencia_json          JSONB               -- dados e referências que comprovam o problema
tipo                    ENUM(melhoria_processo, recalibracao_meta, novo_artefato, descontinuacao)
hipotese                TEXT
metrica_sucesso         TEXT
prazo_verificacao_dias  INTEGER
origem                  TEXT               -- "ENG-03:recorrente", "retrospectiva:mensal", etc.
status                  ENUM(identificada, priorizada, em_andamento, implementada, verificada, descartada)
impacto_estimado        ENUM(baixo, medio, alto, critico)
esforco_estimado        ENUM(baixo, medio, alto)
prioridade_score        DECIMAL            -- calculado: impacto × (1/esforço)
responsavel             TEXT
criado_em               TIMESTAMP
atualizado_em           TIMESTAMP
```

### 7.2 Tabela: `ciclos_pdca`
```
id                      UUID PRIMARY KEY
melhoria_id             UUID REFERENCES melhoria_backlog
modulo                  TEXT
fase_atual              ENUM(plan, do, check, act)
-- PLAN
plano_descricao         TEXT
acoes_json              JSONB
-- DO
execucao_inicio         DATE
execucao_fim            DATE
execucao_descricao      TEXT
-- CHECK
kpi_antes_json          JSONB              -- snapshot de KPIs antes
kpi_depois_json         JSONB              -- snapshot de KPIs depois
resultado               ENUM(eficaz, parcialmente_eficaz, ineficaz, inconclusivo)
-- ACT
acao_ato                ENUM(padronizar, rever, escalar, descartar)
artefatos_atualizados_json JSONB           -- lista de artefatos atualizados (blueprint, KPI, etc.)
aprendizado             TEXT               -- enviado para ENG-10
concluido_em            TIMESTAMP
```

### 7.3 Tabela: `retrospectivas`
```
id                      UUID PRIMARY KEY
tipo                    ENUM(mensal_modulo, trimestral_nucleo, anual_soe)
modulo                  TEXT               -- null para nucleo e soe
periodo_referencia      DATE
facilitador             TEXT
participantes_json      JSONB
o_que_funcionou_json    JSONB              -- lista de itens positivos
o_que_nao_funcionou_json JSONB
o_que_aprender_json     JSONB
melhorias_geradas_json  JSONB              -- IDs de melhorias criadas a partir desta retro
realizada_em            TIMESTAMP
```

### 7.4 Tabela: `decision_log` (imutável — append only)
```
id                      UUID PRIMARY KEY
data_decisao            DATE
decisao                 TEXT
contexto                TEXT
alternativas_consideradas TEXT
responsavel             TEXT
impacto_esperado        TEXT
modulos_afetados_json   JSONB
criado_em               TIMESTAMP
```

---

## 8. Fluxo Operacional

```
[FLUXO A — RECEPÇÃO DE SINAIS E CRIAÇÃO DE MELHORIAS]
│
└─► Sinais chegam continuamente de ENG-03, ENG-04, ENG-05, ENG-06
    └─► ENG-09 avalia: este sinal representa um problema sistêmico?
        ├─► Sim (limiar de recorrência atingido) → criar entrada no melhoria_backlog
        └─► Não (ainda dentro da variação normal) → registrar para análise futura

[FLUXO B — CADÊNCIA DE RETROSPECTIVA (agendada)]
│
└─► Scheduler dispara retrospectiva do período
    └─► ENG-09 prepara pauta automaticamente:
        ├─ KPIs do período: o que atingiu a meta? o que não atingiu?
        ├─ Alertas do período: quantos? quais os mais frequentes?
        ├─ Planos de ação: quantos abertos? quantos eficazes?
        ├─ Auditorias: índice de conformidade por módulo?
        └─ Melhorias anteriores: foram implementadas? foram eficazes?
    │
    └─► Facilitador conduz sessão com equipe (formato: o que funcionou / o que não funcionou / o que fazer)
        └─► Resultados registrados em retrospectivas
            └─► Melhorias identificadas adicionadas ao melhoria_backlog
                └─► Emitir melhoria.retrospectiva_concluida

[FLUXO C — CICLO PDCA DE CADA MELHORIA]
│
└─► Melhoria priorizada e atribuída → iniciar ciclo PDCA
    │
    ├─► [PLAN]: Definir hipótese, ações, responsável, prazo, métrica de sucesso
    │
    ├─► [DO]: Executar as ações (pode acionar ENG-01, ENG-05, ou ação direta)
    │         Snapshot de KPIs antes da execução (ENG-02)
    │
    ├─► [CHECK]: Após prazo de verificação, coletar KPIs novamente (ENG-02)
    │            Comparar com snapshot anterior
    │            Classificar resultado: eficaz / parcial / ineficaz
    │
    └─► [ACT]:
        ├─► Eficaz → PADRONIZAR: atualizar artefato do SOE permanentemente
        │   └─► Emitir melhoria.implementada → ENG-10 registra como conhecimento
        ├─► Ineficaz → REVER: novo ciclo PDCA com hipótese diferente
        └─► Inconclusivo → ESCALAR: decisão para liderança

[FLUXO D — ATUALIZAÇÃO DE ARTEFATOS (ao padronizar melhoria)]
│
└─► ENG-09 propõe atualização ao artefato correspondente:
    ├─► Blueprint de processo → ENG-01 recebe proposta de novo blueprint versão X+1
    ├─► Definição de KPI ou meta → ENG-02 recebe proposta de atualização
    ├─► Template de alerta → ENG-03 recebe proposta
    ├─► Checklist de auditoria → ENG-06 recebe proposta
    └─► Template de plano de ação → ENG-05 recebe proposta
        └─► Em todos os casos: mudança requer aprovação do responsável do módulo
            └─► Aprovada → artefato atualizado; versão anterior arquivada; DECISION_LOG registrado
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `melhoria.identificada` | Nova entrada no backlog criada | `{melhoria_id, modulo, origem, impacto, titulo}` |
| `melhoria.priorizada` | Melhoria entra no topo do backlog | `{melhoria_id, prioridade_score}` |
| `melhoria.pdca_iniciado` | Ciclo PDCA começa | `{melhoria_id, ciclo_id, fase: "plan"}` |
| `melhoria.implementada` | Act concluído com padronização | `{melhoria_id, ciclo_id, artefatos_atualizados}` |
| `melhoria.retrospectiva_concluida` | Sessão de retrospectiva finalizada | `{retrospectiva_id, tipo, melhorias_geradas}` |
| `melhoria.artefato_atualizado` | Blueprint/KPI/alerta atualizado | `{artefato_tipo, artefato_id, versao_anterior, versao_nova}` |
| `melhoria.decisao_registrada` | Entrada no DECISION_LOG | `{decision_id, modulos_afetados, responsavel}` |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `alerta.recorrente_detectado` | ENG-03 | Criar ou atualizar entrada no backlog de melhorias |
| `plano_acao.verificado_ineficaz` | ENG-05 | Criar melhoria: causa raiz identificada estava errada |
| `auditoria.nc_recorrente` | ENG-06 | Criar melhoria: processo tem falha estrutural |
| `auditoria.tendencia_queda` | ENG-06 | Criar melhoria urgente: módulo em deterioração |
| `diagnostico.padrao_detectado` | ENG-04 | Criar melhoria: causa raiz sistêmica a tratar |
| `kpi.meta_atualizada` | ENG-02 | Registrar recalibração no DECISION_LOG |
| `sistema.periodo_encerrado` | Scheduler | Disparar retrospectiva do período |
| `plano_acao.verificado_eficaz` | ENG-05 | Registrar como aprendizado positivo; encaminhar para ENG-10 |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-09 |
