---
id: ARC-ENG-006
titulo: "ENG-06 — Engine de Auditoria"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-001
  - ARC-ENG-002
tags: [engine, auditoria, conformidade, checklist, verificacao, compliance, governanca]
---

# ENG-06 — Engine de Auditoria

---

## 1. Objetivo

Verificar **sistematicamente e periodicamente** se todos os módulos operacionais estão executando seus processos conforme documentado, registrando o que devem registrar, respeitando as regras de negócio definidas, e atingindo os critérios de aceitação estabelecidos — gerando evidência formal de conformidade ou não-conformidade para cada módulo.

A ENG-06 é o **mecanismo de prestação de contas** do SOE: ela garante que o sistema não apenas defina o que deve ser feito (ENG-01) e meça se está sendo feito (ENG-02), mas também **verifique formalmente** se a realidade corresponde às definições — com trilha de auditoria imutável.

---

## 2. Responsabilidades

- **Registrar** checklists de auditoria para cada módulo em cada nível (operacional, gerencial, estratégico)
- **Executar** auditorias conforme a cadência definida (semanal, mensal, trimestral, anual)
- **Coletar** evidências automaticamente de ENG-01 (processos), ENG-02 (KPIs), e bases de dados
- **Verificar** cada item do checklist e classificar como: `conforme`, `não conforme`, `não aplicável`, `sem evidência`
- **Registrar** o resultado de cada auditoria como documento imutável
- **Emitir alertas** para ENG-03 quando não-conformidades são detectadas
- **Rastrear** a resolução de não-conformidades
- **Calcular** índices de conformidade por módulo e por toda a empresa
- **Alimentar** ENG-09 com tendências de conformidade para melhoria contínua

---

## 3. Entradas

### 3.1 Entradas de Configuração (Design Time)
```yaml
auditoria_checklist:
  id: "AUD-CAP01-MENSAL"
  modulo: "CAP-01"
  nivel: "mensal"                        # semanal | mensal | trimestral | anual
  nome: "Auditoria Mensal — Inteligência Comercial"
  responsavel_auditor: "Gerente Comercial"
  itens:
    - id: "AUD-CAP01-001"
      descricao: "100% das oportunidades fechadas no mês têm win/loss analysis registrada"
      fonte_verificacao: "CRM.oportunidades"
      query_verificacao: "SELECT COUNT(*) FROM oportunidades WHERE fechada_em >= periodo_inicio AND win_loss IS NULL"
      criterio_conforme: "resultado == 0"
      automatico: true                   # verificação automática vs. manual
      categoria: "Completude de Dados"
    - id: "AUD-CAP01-002"
      descricao: "Mapa competitivo sem dados com >30 dias de defasagem"
      fonte_verificacao: "Manual — Responsável de IC"
      automatico: false
      categoria: "Atualidade da Inteligência"
    - id: "AUD-CAP01-003"
      descricao: "ICP Document está na versão vigente"
      fonte_verificacao: "Repositório de documentos"
      query_verificacao: "doc_version WHERE doc_id = 'ICP-DOC-001' AND status = 'aprovado'"
      criterio_conforme: "resultado != null"
      automatico: true
      categoria: "Governança Documental"
  meta_indice_conformidade: 90           # % mínimo de itens conformes para passar
```

### 3.2 Entradas de Execução (Run Time)
| Entrada | Origem | Quando |
|---------|--------|--------|
| Trigger agendado | Scheduler | Conforme cadência do checklist |
| Resultados de queries automáticas | CRM, ERP, Repositório | Ao executar auditoria |
| Resposta manual do auditor | Responsável (interface) | Itens não automatizados |
| Dados de processos concluídos | ENG-01 | Contínuo |
| Histórico de KPIs | ENG-02 | Ao executar auditoria |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Relatório de auditoria (imutável) | Repositório oficial + ENG-09 | Por execução de auditoria |
| Evento `auditoria.concluida` | CAP-08 (Performance) | Por execução |
| Evento `auditoria.nao_conformidade_detectada` | ENG-03 (Alertas) | Por não-conformidade encontrada |
| Índice de conformidade por módulo | Dashboard de governança | Por execução |
| Índice de conformidade global (SOE) | Dashboard de liderança | Por execução |
| Relatório de tendência de conformidade | ENG-09 (Melhoria Contínua) | Mensal / trimestral |

---

## 5. Regras Gerais

### RG-01: Imutabilidade dos Relatórios
Todo relatório de auditoria emitido é **imutável**. O que foi verificado em uma data não pode ser alterado retroativamente. Se houve erro na auditoria, a correção ocorre na próxima auditoria — documentada como tal.

### RG-02: Separação entre Auditor e Auditado
A auditoria deve ser conduzida pelo responsável do módulo, mas os critérios e o registro são governados pela ENG-06 — não pelo próprio módulo. O módulo não pode "aprovar sua própria auditoria" sem seguir o checklist definido pela Engine.

### RG-03: Evidência Obrigatória para Itens Manuais
Itens de checklist não automatizados DEVEM ter uma evidência anexada pelo auditor (screenshot, link, número de referência). Item manual sem evidência é classificado como `sem evidência` — não como `conforme`.

### RG-04: Não-Conformidade é Obrigação de Melhoria
Não-conformidade detectada DEVE gerar alerta em ENG-03. A não-conformidade só é encerrada quando o responsável registra a correção realizada. Não-conformidades recorrentes (> 2 auditorias consecutivas) geram alerta para a liderança.

### RG-05: Índice Mínimo de Conformidade
Cada checklist define um `meta_indice_conformidade`. Se o índice realizado for inferior à meta, o relatório é classificado como `reprovado` — além de emitir alerta, isso é registrado no histórico do módulo.

### RG-06: Auditorias Não Executadas São Não-Conformidades
Se uma auditoria agendada não é executada até 5 dias após a data prevista, o sistema registra automaticamente uma não-conformidade de `ausência de auditoria` e emite alerta para o responsável e para a liderança.

---

## 6. Interfaces com os Módulos

| Módulo | Checklists Registrados |
|--------|----------------------|
| CAP-01 | Semanal (digest publicado?), Mensal (win/loss, mapa competitivo, KPIs), Trimestral (ICP revisado, win rate por segmento) |
| CAP-02 | Semanal (SLA de LRT, pipeline mínimo), Mensal (fontes, CPL, aderência ao ICP), Trimestral (ROI por canal) |
| CAP-03 | Semanal (oportunidades paradas, forecast), Mensal (KPIs de conversão, contratos), Trimestral (processo, templates) |
| CAP-04 | Mensal (reconciliação bancária, 0 contratos sem fatura, NRR, inadimplentes), Trimestral (cohort de churn, ARR projetado) |
| CAP-05 | Semanal (HS ≥ meta, contatos em dia), Mensal (churn, NPS, onboarding SLA, expansion MRR), Trimestral (capacidade CS) |
| CAP-06 | Mensal (ticket médio, desconto médio, portfólio completo), Trimestral (win rate por preço, margem bruta) |
| CAP-07 | Mensal (quota, comissões, 1:1, capacidade), Trimestral (PDIs, turnover, treinamentos), Anual (política de comissão) |
| CAP-08 | Mensal (KPIs calculados, reunião realizada, DECISION_LOG), Trimestral (Business Review, qualidade de dados) |
| CAP-09 | Mensal (leads rastreados, comissões, parceiros inativos), Trimestral (performance, NPS, concentração) |

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `auditoria_checklists`
```
id                  TEXT PRIMARY KEY    -- "AUD-CAP01-MENSAL"
modulo              TEXT
nivel               ENUM(semanal, mensal, trimestral, anual)
nome                TEXT
responsavel_auditor TEXT
itens_json          JSONB               -- lista de itens com id, descrição, fonte, critério
meta_indice         DECIMAL             -- % mínimo de itens conformes
agendamento         TEXT                -- cron expression
ativo               BOOLEAN
```

### 7.2 Tabela: `auditoria_execucoes` (imutável — append only)
```
id                  UUID PRIMARY KEY
checklist_id        TEXT REFERENCES auditoria_checklists
modulo              TEXT
periodo_referencia  DATE
status              ENUM(pendente, em_andamento, concluida, reprovada, ausente)
auditor             TEXT
total_itens         INTEGER
itens_conformes     INTEGER
itens_nao_conformes INTEGER
itens_sem_evidencia INTEGER
itens_na            INTEGER             -- não aplicável
indice_conformidade DECIMAL             -- conformes / (total - na) * 100
resultado           ENUM(aprovado, reprovado, parcial)
iniciada_em         TIMESTAMP
concluida_em        TIMESTAMP
```

### 7.3 Tabela: `auditoria_itens_resultado` (imutável — por execução)
```
id                  UUID PRIMARY KEY
execucao_id         UUID REFERENCES auditoria_execucoes
item_id             TEXT                -- ID do item no checklist
descricao           TEXT
resultado           ENUM(conforme, nao_conforme, sem_evidencia, nao_aplicavel)
evidencia           TEXT                -- URL, screenshot, referência
valor_coletado      TEXT                -- resultado da query ou resposta manual
observacoes         TEXT
nao_conformidade_id UUID               -- referência na tabela de NCs
```

### 7.4 Tabela: `auditoria_nao_conformidades`
```
id                  UUID PRIMARY KEY
execucao_id         UUID
item_id             TEXT
modulo              TEXT
descricao           TEXT
severidade          ENUM(baixa, media, alta, critica)
status              ENUM(aberta, em_correcao, corrigida, recorrente)
responsavel         TEXT
prazo_correcao      DATE
correcao_descricao  TEXT
corrigido_em        TIMESTAMP
alerta_id           UUID               -- referência na ENG-03
recorrente          BOOLEAN            -- true se mesma NC em auditoria anterior
```

---

## 8. Fluxo Operacional

```
[1] AGENDAMENTO E DISPARO
│
└─► Scheduler dispara auditoria conforme cron do checklist
    └─► ENG-06 cria registro em auditoria_execucoes (status: pendente)
        └─► Notifica auditor responsável (ENG-03: info)

[2] COLETA AUTOMÁTICA (itens com automatico = true)
│
└─► ENG-06 executa queries nos sistemas configurados
    └─► Compara resultado com criterio_conforme
        ├─► Conforme → item_resultado = conforme; salva evidência (valor da query)
        └─► Não conforme → item_resultado = nao_conforme; cria registro de NC
            └─► Emite auditoria.nao_conformidade_detectada → ENG-03 (alerta)

[3] VERIFICAÇÃO MANUAL (itens com automatico = false)
│
└─► Interface apresenta itens manuais ao auditor
    └─► Auditor avalia cada item e registra:
        ├─► conforme + evidência anexada
        ├─► nao_conforme + evidência + observação
        ├─► sem_evidência (não conseguiu verificar)
        └─► não_aplicável (contexto não se aplica)

[4] CONSOLIDAÇÃO E RELATÓRIO
│
└─► Todos os itens respondidos (automáticos + manuais)
    └─► ENG-06 calcula índice de conformidade
        └─► Compara com meta_indice do checklist
            ├─► Índice >= meta → resultado = aprovado
            └─► Índice < meta → resultado = reprovado
                └─► Emite alerta de nível alto para ENG-03
                    └─► Registra execução como imutável
                        └─► Emite auditoria.concluida
                            └─► CAP-08 recebe índice de conformidade atualizado
                                └─► ENG-09 recebe para análise de tendência

[5] ACOMPANHAMENTO DE NÃO-CONFORMIDADES
│
└─► Cada NC criada tem prazo de correção
    └─► Scheduler verifica NCs com prazo vencido e status = aberta
        └─► Emitir alerta de NC vencida → ENG-03
            └─► Na próxima auditoria do mesmo checklist, ENG-06 verifica se NC foi corrigida
                ├─► Corrigida → NC encerrada
                └─► Não corrigida → NC marcada como recorrente + alerta para liderança
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `auditoria.iniciada` | Execução criada | `{execucao_id, checklist_id, modulo, periodo}` |
| `auditoria.nao_conformidade_detectada` | Item avaliado como não conforme | `{nc_id, item_id, modulo, severidade, descricao}` |
| `auditoria.concluida` | Auditoria finalizada | `{execucao_id, indice, resultado, ncs_abertas}` |
| `auditoria.reprovada` | Índice abaixo da meta | `{execucao_id, indice_realizado, meta, modulo}` |
| `auditoria.ausente` | Auditoria não executada no prazo | `{checklist_id, modulo, nivel, prazo_vencido}` |
| `auditoria.nc_recorrente` | Mesma NC em 2+ auditorias | `{nc_id, modulo, item_id, recorrencias}` |
| `auditoria.tendencia_queda` | Índice de conformidade caindo por 3 períodos | `{modulo, nivel, historico_indice}` — para ENG-09 |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `processo.instancia_concluida` | ENG-01 | Registrar como dado de verificação de conformidade de processos |
| `processo.sla_violado` | ENG-01 | Criar NC automática no próximo relatório de auditoria |
| `kpi.calculado` | ENG-02 | Atualizar dados de conformidade de KPIs na execução em andamento |
| `plano_acao.concluido` | ENG-05 | Verificar se NC associada pode ser encerrada |
| `sistema.periodo_encerrado` | Scheduler | Disparar auditorias do período que encerra |
| `alerta.resolvido` | ENG-03 | Atualizar NC correspondente como em_correcao / corrigida |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-06 |
