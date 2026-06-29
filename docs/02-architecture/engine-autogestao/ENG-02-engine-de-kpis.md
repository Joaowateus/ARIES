---
id: ARC-ENG-002
titulo: "ENG-02 — Engine de KPIs"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-001
tags: [engine, kpis, metricas, medicao, dashboard, performance, scorecard]
---

# ENG-02 — Engine de KPIs

---

## 1. Objetivo

Fornecer o mecanismo único pelo qual **qualquer indicador de desempenho de qualquer módulo** é definido, coletado, calculado, armazenado, publicado e comparado com suas metas — garantindo que existe uma única fonte de verdade para cada número do SOE e que qualquer stakeholder possa confiar nos dados sem verificar a planilha de outra pessoa.

A ENG-02 é a **consciência quantitativa** do SOE: o sistema só pode se autogerir se souber exatamente onde está, em relação a onde deveria estar.

---

## 2. Responsabilidades

- **Registrar** a definição de qualquer KPI de qualquer módulo (catálogo central de KPIs)
- **Conectar** cada KPI à sua fonte de dados (CRM, ERP, planilha, API externa)
- **Executar** o cálculo de cada KPI na frequência definida
- **Armazenar** o histórico de todos os valores calculados (série temporal imutável)
- **Comparar** o valor realizado com a meta vigente e calcular o desvio
- **Publicar** os valores nos dashboards e relatórios de cada módulo e da liderança
- **Alimentar** a ENG-03 (Alertas) quando um KPI cruza um limiar crítico
- **Fornecer** dados históricos para a ENG-04 (Diagnóstico) e ENG-10 (IA)
- **Registrar** mudanças de meta com data de vigência e justificativa (imutável)

---

## 3. Entradas

### 3.1 Entradas de Configuração (Design Time)
```yaml
kpi_definition:
  id: "KPI-IC-01"                         # identificador único global
  modulo: "CAP-01"
  nome: "Cobertura de Win/Loss Analysis"
  descricao: "% de oportunidades fechadas com análise registrada"
  formula: "COUNT(oportunidades WHERE win_loss_preenchido = true AND fechada_em >= periodo_inicio) / COUNT(oportunidades WHERE fechada_em >= periodo_inicio) * 100"
  unidade: "%"
  direcao: "maximizar"                    # maximizar | minimizar | manter_intervalo
  frequencia_calculo: "mensal"            # tempo_real | diario | semanal | mensal | trimestral
  fonte_dados:
    tipo: "CRM_query"
    conexao: "crm_principal"
    query_id: "QRY-WINLOSS-COVERAGE"
  meta_atual:
    valor: 95
    vigente_desde: "2026-01-01"
    aprovado_por: "Gerente Comercial"
  limiares_alerta:
    - nivel: "warning"
      condicao: "valor < 80"
    - nivel: "critical"
      condicao: "valor < 70"
  dono: "Gerente Comercial"
  visibilidade: ["CAP-01", "CAP-08", "liderança"]
  dimensoes: ["por_vendedor", "por_segmento"]  # cortes analíticos disponíveis
```

### 3.2 Entradas de Execução (Run Time)
| Entrada | Origem | Quando |
|---------|--------|--------|
| Trigger de coleta agendado | Scheduler interno | Conforme frequência de cada KPI |
| Dados brutos de fonte | CRM / ERP / API | Ao executar coleta |
| Nova meta aprovada | Processo de planejamento | Por evento (mudança de meta) |
| Solicitação de recálculo | ENG-04, ENG-09 | Ad hoc (diagnóstico, retrospectiva) |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Valor calculado do KPI (com timestamp) | `kpi_valores` (série temporal) | Por ciclo de cálculo |
| Evento `kpi.calculado` | ENG-03 (avaliação de limiar) | Por cálculo |
| Evento `kpi.limiar_cruzado` | ENG-03 (Alertas) | Quando desvio detectado |
| Dashboard de KPIs por módulo | Interfaces de usuário | Tempo real (após cada cálculo) |
| Scorecard do SOE | ENG-08 (Autogestão), Liderança | Diário / mensal |
| Série histórica para análise | ENG-04 (Diagnóstico), ENG-10 (IA) | Sob demanda |
| Relatório de metas vs. realizado | CAP-08, Liderança | Mensal |

---

## 5. Regras Gerais

### RG-01: Uma Única Fonte de Verdade
Cada KPI tem **uma única definição oficial** registrada na ENG-02. Se dois relatórios mostram valores diferentes para o mesmo KPI, há uma inconsistência que DEVE ser investigada — e a ENG-02 é a fonte autorizada.

### RG-02: Imutabilidade da Série Histórica
Valores calculados não podem ser alterados retroativamente. Se houve erro de cálculo, registra-se um valor corrigido com flag `correcao = true`, data e justificativa — o valor original permanece no histórico.

### RG-03: Metas com Vigência
Uma meta NÃO pode ser mudada informalmente. Toda mudança de meta DEVE ser registrada na ENG-02 com: novo valor, data de vigência, aprovador e justificativa. O histórico de metas é preservado.

### RG-04: KPI Sem Dado É Diferente de KPI Zero
Se a coleta de dados falha (fonte indisponível), o KPI registra status `sem_dado` — diferente de `0`. Isso impede que falhas de coleta sejam interpretadas como performance zero.

### RG-05: Dimensões de Análise
KPIs podem ser calculados em múltiplas dimensões (por vendedor, por segmento, por canal). O valor "global" é sempre calculado; valores dimensionados são opcionais conforme definição do KPI.

### RG-06: Dependência entre KPIs
KPIs derivados (ex: LTV/CAC = LTV / CAC) DEVEM declarar seus KPIs-fonte. Se um KPI-fonte falha na coleta, o KPI derivado também registra `sem_dado` — não calcula com dados parciais.

---

## 6. Interfaces com os Módulos

| Módulo | KPIs Registrados (exemplos representativos) |
|--------|---------------------------------------------|
| CAP-01 | KPI-IC-01 a KPI-IC-09 (cobertura win/loss, ICP adherence, win rate) |
| CAP-02 | KPI-DM-01 a KPI-DM-10 (volume de leads, SQLs, CPL, LRT) |
| CAP-03 | KPI-PV-01 a KPI-PV-12 (win rate, ciclo, ticket médio, conformidade contratual) |
| CAP-04 | KPI-RV-01 a KPI-RV-12 (MRR, ARR, NRR, GRR, churn, forecast accuracy) |
| CAP-05 | KPI-CS-01 a KPI-CS-11 (churn rate, NPS, health score, onboarding SLA, expansion) |
| CAP-06 | KPI-OP-01 a KPI-OP-08 (ticket médio, desconto médio, margem, aderência portfólio) |
| CAP-07 | KPI-EC-01 a KPI-EC-11 (quota attainment, ramp-up, turnover, comissão) |
| CAP-08 | KPI-PA-01 a KPI-PA-13 (scorecard consolidado: MRR, NRR, CAC, LTV, LTV/CAC) |
| CAP-09 | KPI-CP-01 a KPI-CP-11 (leads canal, conversão parceiros, NPS parceiros) |

**Protocolo:** Todo módulo DEVE registrar seus KPIs na ENG-02 antes de operar. KPIs não registrados não existem para o sistema.

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `kpi_definicoes`
```
id                  TEXT PRIMARY KEY    -- "KPI-IC-01"
modulo              TEXT
nome                TEXT
descricao           TEXT
formula             TEXT                -- expressão ou referência à query
unidade             TEXT
direcao             ENUM(maximizar, minimizar, manter_intervalo)
frequencia          ENUM(tempo_real, diario, semanal, mensal, trimestral)
fonte_dados_json    JSONB               -- conexão, query, tipo
dimensoes_json      JSONB               -- cortes analíticos disponíveis
dono                TEXT
visibilidade_json   JSONB               -- quem pode ver
ativo               BOOLEAN
criado_em           TIMESTAMP
```

### 7.2 Tabela: `kpi_metas` (histórico imutável)
```
id                  UUID PRIMARY KEY
kpi_id              TEXT REFERENCES kpi_definicoes
valor_meta          DECIMAL
intervalo_min       DECIMAL             -- para direcao = manter_intervalo
intervalo_max       DECIMAL
vigente_desde       DATE
vigente_ate         DATE                -- null = vigente atual
aprovado_por        TEXT
justificativa       TEXT
criado_em           TIMESTAMP
```

### 7.3 Tabela: `kpi_valores` (série temporal — append only)
```
id                  UUID PRIMARY KEY
kpi_id              TEXT REFERENCES kpi_definicoes
periodo_referencia  DATE                -- "2026-06-01" para mensal
dimensao            TEXT                -- null = global; "vendedor:joao" = por dimensão
valor               DECIMAL
status_coleta       ENUM(ok, sem_dado, erro_coleta, correcao)
correcao_de_id      UUID               -- referência ao valor original se for correção
meta_no_momento     DECIMAL             -- meta vigente no momento do cálculo
desvio_absoluto     DECIMAL             -- valor - meta
desvio_percentual   DECIMAL             -- (valor - meta) / meta * 100
calculado_em        TIMESTAMP
fonte_hash          TEXT                -- hash dos dados brutos usados (auditabilidade)
```

### 7.4 Tabela: `kpi_limiares`
```
id                  UUID PRIMARY KEY
kpi_id              TEXT
nivel               ENUM(info, warning, critical)
expressao           TEXT                -- "valor < 80"
alerta_template_id  TEXT               -- template de alerta na ENG-03
ativo               BOOLEAN
```

---

## 8. Fluxo Operacional

```
[1] REGISTRO DO KPI (design time)
│
└─► Módulo submete definição do KPI
    └─► ENG-02 valida (fórmula parseable? fonte acessível? meta definida? dono informado?)
        ├─► Válido → salvar em kpi_definicoes; configurar agendamento conforme frequência
        └─► Inválido → retornar erros; KPI NÃO é ativado

[2] CICLO DE COLETA E CÁLCULO (agendado — frequência do KPI)
│
└─► Scheduler dispara coleta do KPI no período definido
    └─► ENG-02 executa query/conexão na fonte de dados
        ├─► Dados obtidos com sucesso
        │   └─► Executar fórmula → obter valor numérico
        │       └─► Recuperar meta vigente do período
        │           └─► Calcular desvio absoluto e percentual
        │               └─► Salvar em kpi_valores (append only)
        │                   └─► Emitir evento kpi.calculado
        │                       └─► ENG-03 avalia limiares de alerta
        │
        └─► Falha na coleta (fonte indisponível, timeout, erro de query)
            └─► Salvar em kpi_valores com status = sem_dado
                └─► Emitir evento kpi.falha_coleta → ENG-03 (alerta de falha técnica)

[3] AVALIAÇÃO DE LIMIAR (por evento kpi.calculado)
│
└─► ENG-03 recebe evento com valor e meta
    └─► Verifica cada limiar registrado na kpi_limiares
        ├─► Nenhum limiar violado → nenhuma ação
        ├─► Limiar warning violado → ENG-03 cria alerta de nível warning
        └─► Limiar critical violado → ENG-03 cria alerta de nível critical
            └─► ENG-04 (Diagnóstico) é notificada se alerta for crítico

[4] PUBLICAÇÃO (após cada ciclo de cálculo)
│
└─► ENG-02 atualiza estado dos dashboards com novos valores
    └─► Scorecard de módulo atualizado
        └─► Scorecard consolidado de CAP-08 atualizado

[5] MUDANÇA DE META (por evento de planejamento)
│
└─► Liderança / CAP-08 submete nova meta com justificativa e aprovador
    └─► ENG-02 registra em kpi_metas (nova linha; vigente_ate da anterior = hoje - 1)
        └─► Emite evento kpi.meta_atualizada
            └─► Próximo ciclo de cálculo usa a nova meta automaticamente
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `kpi.definicao_registrada` | KPI aprovado e salvo | `{kpi_id, modulo, nome}` |
| `kpi.calculado` | Valor calculado com sucesso | `{kpi_id, periodo, valor, meta, desvio_percentual}` |
| `kpi.falha_coleta` | Falha ao coletar dados | `{kpi_id, periodo, erro_descricao}` |
| `kpi.limiar_cruzado` | Valor viola limiar configurado | `{kpi_id, nivel, valor, meta, limiar_expressao}` |
| `kpi.meta_atualizada` | Meta alterada com aprovação | `{kpi_id, meta_anterior, meta_nova, vigente_desde, aprovado_por}` |
| `kpi.correcao_registrada` | Valor corrigido retroativamente | `{kpi_id, periodo, valor_original, valor_corrigido, justificativa}` |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `processo.instancia_concluida` | ENG-01 | Recalcular KPIs de throughput de processo |
| `processo.sla_violado` | ENG-01 | Incrementar contador de violações de SLA (KPI de conformidade) |
| `plano_acao.concluido` | ENG-05 | Recalcular KPI afetado para verificar se desvio foi corrigido |
| `auditoria.nao_conformidade_detectada` | ENG-06 | Registrar como dado para KPI de conformidade do módulo |
| `workflow.executado` | ENG-07 | Atualizar KPIs de eficiência operacional |
| `sistema.periodo_encerrado` | Scheduler | Disparar coleta e cálculo de todos os KPIs do período |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-02 |
