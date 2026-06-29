---
id: ARC-ENG-099
titulo: "Engine de Autogestão — Contrato de Integração e Barramento de Eventos"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
tags: [engine, barramento, eventos, contrato, integracao, protocolo, soe]
---

# Engine de Autogestão — Contrato de Integração e Barramento de Eventos

---

## 1. Propósito deste Documento

Este documento define o **contrato formal de integração** entre as 10 Engines da camada de autogestão e entre as Engines e os Módulos Operacionais — especificando o protocolo de comunicação, os tipos de eventos, as responsabilidades de cada participante, e as regras que garantem que o sistema opere de forma coesa como um único organismo, e não como 10 sistemas independentes.

---

## 2. O Barramento de Eventos do SOE

Todas as Engines e todos os Módulos se comunicam através de um **barramento de eventos centralizado**. Nenhuma Engine chama outra Engine diretamente (acoplamento direto). Toda comunicação é mediada por eventos publicados no barramento e consumidos por quem tem interesse.

```
┌────────────┐    publica evento     ┌──────────────────────────────┐
│  ENG-02    │ ─────────────────────►│                              │
│  (KPIs)    │                       │   BARRAMENTO DE EVENTOS SOE  │
└────────────┘                       │                              │
                                     │  • kpi.limiar_cruzado        │
┌────────────┐   consome evento      │  • processo.sla_violado      │
│  ENG-03    │ ◄─────────────────────│  • alerta.criado             │
│  (Alertas) │                       │  • diagnostico.aberto        │
└────────────┘                       │  • plano_acao.criado         │
                                     │  • auditoria.concluida       │
┌────────────┐   publica + consome   │  • workflow.concluido        │
│  ENG-04    │ ◄────────────────────►│  • automacao.operacao_...    │
│(Diagnóst.) │                       │  • melhoria.implementada     │
└────────────┘                       │  • ia.predicao_churn         │
                                     │  • [...]                     │
                                     └──────────────────────────────┘
```

### 2.1 Princípios do Barramento

| Princípio | Descrição |
|-----------|-----------|
| **Publicação assíncrona** | Quem publica um evento não espera quem vai consumir — desacopla produtor de consumidor |
| **Entrega garantida** | O barramento garante que o evento será entregue ao menos uma vez a cada consumidor registrado |
| **Ordenação por partição** | Eventos relacionados à mesma entidade (ex: mesma instância de processo) são entregues em ordem |
| **Replay** | Consumidores podem pedir o histórico de eventos a partir de um ponto no tempo (útil para recuperação e debug) |
| **Schema registry** | Todo evento tem seu schema versionado registrado — mudanças são feitas de forma retrocompatível |

---

## 3. Catálogo Completo de Eventos do SOE

### 3.1 Convenção de Nomenclatura
```
[dominio].[entidade].[acao_passado]

Exemplos:
  processo.instancia.criada
  kpi.limiar.cruzado
  alerta.alerta.escalonado
  diagnostico.causa_raiz.identificada
  plano_acao.verificacao.concluida
  ia.predicao.gerada
```

### 3.2 Schema Base de Todo Evento
```json
{
  "id": "UUID v4 — identificador único do evento",
  "tipo": "string — nome do evento no formato dominio.entidade.acao",
  "versao_schema": "string — versão do schema do evento (SemVer)",
  "timestamp": "ISO 8601 com timezone",
  "origem": {
    "engine": "string — ENG-01 a ENG-10, ou código do módulo",
    "instancia_id": "UUID — ID da instância de processo, KPI, alerta, etc."
  },
  "correlacao_id": "UUID — ID que rastreia a cadeia de eventos relacionados",
  "payload": "object — dados específicos do tipo de evento",
  "metadata": {
    "ambiente": "producao | staging | desenvolvimento",
    "tenant_id": "string — para multi-tenant futuro"
  }
}
```

### 3.3 Tabela de Todos os Eventos por Engine

#### ENG-01 — Execução de Processos
| Evento | Descrição |
|--------|-----------|
| `processo.blueprint.registrado` | Novo blueprint de processo aprovado |
| `processo.instancia.criada` | Nova instância instanciada por evento gatilho |
| `processo.etapa.concluida` | Transição entre etapas bem-sucedida |
| `processo.exit_criteria.falhou` | Tentativa de avanço com critério não satisfeito |
| `processo.sla.violado` | SLA de etapa ultrapassado |
| `processo.instancia.concluida` | Processo finalizado com sucesso |
| `processo.instancia.cancelada` | Processo encerrado antes do fim |
| `processo.instancia.bloqueada` | Alerta bloqueante associado à instância |
| `processo.responsavel.ausente` | Instância sem responsável designado |

#### ENG-02 — KPIs
| Evento | Descrição |
|--------|-----------|
| `kpi.definicao.registrada` | Nova definição de KPI aprovada |
| `kpi.valor.calculado` | Ciclo de cálculo executado com sucesso |
| `kpi.coleta.falhou` | Falha ao coletar dados da fonte |
| `kpi.limiar.cruzado` | Valor calculado viola limiar configurado |
| `kpi.meta.atualizada` | Meta alterada com aprovação formal |
| `kpi.valor.corrigido` | Valor retroativo corrigido com justificativa |

#### ENG-03 — Alertas
| Evento | Descrição |
|--------|-----------|
| `alerta.alerta.criado` | Novo alerta instanciado |
| `alerta.alerta.reconhecido` | Destinatário confirma recebimento |
| `alerta.alerta.escalonado` | Prazo vencido; escalonado para próximo nível |
| `alerta.alerta.em_tratamento` | Responsável inicia ação |
| `alerta.alerta.resolvido` | Alerta encerrado com evidência |
| `alerta.alerta.suprimido` | Duplicata dentro do período de supressão |
| `alerta.recorrencia.detectada` | Mesmo alerta >3× em 90 dias |
| `alerta.processo.bloqueado` | Alerta bloqueante associado a processo |

#### ENG-04 — Diagnóstico
| Evento | Descrição |
|--------|-----------|
| `diagnostico.sessao.aberta` | Sessão de diagnóstico criada |
| `diagnostico.contexto.coletado` | Dados de contexto automático reunidos |
| `diagnostico.hipotese.confirmada` | Hipótese marcada como confirmada com evidência |
| `diagnostico.causa_raiz.identificada` | Sessão concluída com causa raiz |
| `diagnostico.sessao.vencida` | Prazo sem conclusão ultrapassado |
| `diagnostico.padrao.detectado` | Mesma causa raiz recorrente em múltiplas sessões |

#### ENG-05 — Planos de Ação
| Evento | Descrição |
|--------|-----------|
| `plano_acao.plano.criado` | Plano de ação aprovado e ativado |
| `plano_acao.tarefa.concluida` | Tarefa individual marcada como concluída |
| `plano_acao.tarefa.atrasada` | Prazo de tarefa vencido sem conclusão |
| `plano_acao.plano.concluido` | Todas as tarefas concluídas |
| `plano_acao.verificacao.eficaz` | KPI confirma melhoria pós-plano |
| `plano_acao.verificacao.ineficaz` | KPI não melhorou após conclusão do plano |
| `plano_acao.prazo.vencido` | Prazo total do plano ultrapassado |

#### ENG-06 — Auditoria
| Evento | Descrição |
|--------|-----------|
| `auditoria.execucao.iniciada` | Ciclo de auditoria começou |
| `auditoria.nc.detectada` | Item avaliado como não conforme |
| `auditoria.execucao.concluida` | Auditoria finalizada (com resultado) |
| `auditoria.execucao.reprovada` | Índice de conformidade abaixo da meta |
| `auditoria.execucao.ausente` | Auditoria não executada no prazo |
| `auditoria.nc.recorrente` | Mesma NC em 2+ ciclos consecutivos |
| `auditoria.tendencia.queda` | Índice caindo por 3+ períodos |

#### ENG-07 — Workflows
| Evento | Descrição |
|--------|-----------|
| `workflow.execucao.iniciada` | Instância de workflow criada |
| `workflow.acao.concluida` | Ação individual executada |
| `workflow.execucao.aguardando_humano` | Pausa aguardando intervenção humana |
| `workflow.execucao.concluida` | Todas as ações completadas |
| `workflow.execucao.falhou` | Falha não recuperável |
| `workflow.acao.timeout` | Timeout em chamada externa |

#### ENG-08 — Automação
| Evento | Descrição |
|--------|-----------|
| `automacao.operacao.concluida` | Operação em sistema externo bem-sucedida |
| `automacao.operacao.falhou` | Falha definitiva após retentativas |
| `automacao.sistema.indisponivel` | Health check falhou |
| `automacao.sistema.recuperado` | Sistema externo voltou ao normal |
| `automacao.circuit_breaker.aberto` | Circuit breaker abriu por taxa de erro |
| `automacao.webhook.recebido` | Webhook válido processado |
| `automacao.webhook.suspeito` | Webhook com assinatura inválida |

#### ENG-09 — Melhoria Contínua
| Evento | Descrição |
|--------|-----------|
| `melhoria.item.identificado` | Nova entrada no backlog de melhorias |
| `melhoria.item.priorizado` | Melhoria selecionada para execução |
| `melhoria.pdca.iniciado` | Ciclo PDCA começou |
| `melhoria.item.implementado` | Melhoria padronizada no SOE |
| `melhoria.retrospectiva.concluida` | Sessão de retrospectiva finalizada |
| `melhoria.artefato.atualizado` | Blueprint/KPI/checklist atualizado |
| `melhoria.decisao.registrada` | Entrada no DECISION_LOG |

#### ENG-10 — IA e Base de Conhecimento
| Evento | Descrição |
|--------|-----------|
| `ia.conhecimento.indexado` | Novo item indexado na Base de Conhecimento |
| `ia.casos_similares.encontrados` | Resposta a solicitação de busca de diagnóstico |
| `ia.hipoteses.geradas` | Hipóteses sugeridas para sessão de diagnóstico |
| `ia.planos_similares.encontrados` | Planos históricos sugeridos |
| `ia.predicao.churn_gerada` | Score de churn calculado por cliente |
| `ia.predicao.mrr_gerada` | Forecast de MRR calculado |
| `ia.score.fechamento_atualizado` | Probabilidade de fechamento de oportunidade |
| `ia.anomalia.detectada` | Desvio estatístico identificado em KPI |
| `ia.sumario.gerado` | Texto narrativo de relatório gerado |
| `ia.modelo.degradado` | Acurácia de modelo abaixo do threshold |

---

## 4. Mapa de Dependências entre Engines

```
Quem dispara → Quem consome

ENG-01 (Processos)   → ENG-03 (sla_violado → alerta)
                     → ENG-02 (instancia_concluida → recalcular KPIs)
                     → ENG-10 (instancia_concluida → indexar benchmark)

ENG-02 (KPIs)        → ENG-03 (limiar_cruzado → alerta)
                     → ENG-10 (kpi_calculado → atualizar modelos preditivos)

ENG-03 (Alertas)     → ENG-04 (alerta_criado + requer_diagnostico → sessão de diagnóstico)
                     → ENG-09 (recorrencia_detectada → criar melhoria)

ENG-04 (Diagnóstico) → ENG-05 (causa_raiz_identificada → criar plano de ação)
                     → ENG-10 (sessão concluída → indexar diagnóstico)
                     → ENG-09 (padrao_detectado → melhoria sistêmica)

ENG-05 (Planos)      → ENG-03 (plano_concluido → resolver alerta)
                     → ENG-02 (plano_concluido → recalcular KPI de verificação)
                     → ENG-09 (verificado_eficaz/ineficaz → aprendizado)
                     → ENG-10 (resultado verificado → indexar conhecimento)

ENG-06 (Auditoria)   → ENG-03 (nc_detectada → alerta de conformidade)
                     → ENG-09 (nc_recorrente / tendencia_queda → melhoria)
                     → ENG-10 (relatório concluído → indexar)

ENG-07 (Workflows)   → ENG-01 (acao_concluida → atualizar instância de processo)
                     → ENG-02 (acao_concluida → atualizar KPI de eficiência)
                     → ENG-03 (falhou → alerta técnico)
                     → ENG-08 (ação de integração → executar via ENG-08)

ENG-08 (Automação)   → ENG-07 (operacao_concluida/falhou → resultado da ação)
                     → ENG-03 (sistema_indisponivel → alerta crítico)

ENG-09 (Melhoria)    → ENG-01 (melhoria_aprovada → novo blueprint de processo)
                     → ENG-02 (melhoria_aprovada → nova definição de KPI/meta)
                     → ENG-03 (melhoria_aprovada → novo template de alerta)
                     → ENG-06 (melhoria_aprovada → novo checklist)
                     → ENG-10 (melhoria_implementada → indexar aprendizado)

ENG-10 (IA/BK)       → ENG-04 (casos_similares → auxiliar diagnóstico)
                     → ENG-05 (planos_similares → sugerir plano)
                     → ENG-03 (anomalia_detectada → alerta estatístico)
                     → CAP-05 (predicao_churn → health score)
                     → CAP-08 (predicao_mrr → forecast)
```

---

## 5. Protocolo de Registro de Módulos

Para um Módulo Operacional participar do ecossistema da Engine de Autogestão, ele DEVE:

```yaml
# Arquivo: docs/05-modules/commercial/cap-XX/ENGINE-REGISTRATION.yaml
modulo_id: "CAP-XX"
nome: "Nome do Módulo"

# 1. Registrar processos na ENG-01
processos:
  - blueprint_id: "PROC-CAPXX-NOME"
    arquivo: "processos/PROC-CAPXX-NOME.yaml"

# 2. Registrar KPIs na ENG-02
kpis:
  - id: "KPI-XX-01"
    arquivo: "kpis/KPI-XX-01.yaml"

# 3. Registrar templates de alerta na ENG-03
alertas:
  - id: "ALT-XX-01"
    arquivo: "alertas/ALT-XX-01.yaml"

# 4. Registrar templates de diagnóstico na ENG-04
diagnosticos:
  - id: "DIAG-XX-WIN-RATE"
    arquivo: "diagnosticos/DIAG-XX-WIN-RATE.yaml"

# 5. Registrar templates de plano de ação na ENG-05
planos_acao:
  - id: "PA-XX-WIN-RATE"
    arquivo: "planos/PA-XX-WIN-RATE.yaml"

# 6. Registrar checklists de auditoria na ENG-06
auditorias:
  - id: "AUD-XX-MENSAL"
    arquivo: "auditorias/AUD-XX-MENSAL.yaml"

# 7. Registrar workflows na ENG-07
workflows:
  - id: "WF-XX-EVENTO-NOME"
    arquivo: "workflows/WF-XX-EVENTO-NOME.yaml"

# 8. Declarar conectores necessários (da ENG-08)
conectores_utilizados:
  - "CONN-CRM-PRINCIPAL"
  - "CONN-EMAIL-TRANSACIONAL"

# 9. Declarar capacidades de IA solicitadas da ENG-10
ia_capacidades:
  - tipo: "predicao"
    modelo: "MODELO-CHURN-V3"
  - tipo: "busca_semantica"
    base: "BASE-CONHECIMENTO-PRINCIPAL"
```

Este arquivo de registro é a "declaração de dependências" do módulo em relação à Engine. Permite que o sistema valide se todas as dependências estão satisfeitas antes de ativar o módulo.

---

## 6. Cadeia de Eventos — Cenários Completos

### Cenário A: Lead inbound → Processo completo de autogestão

```
1. lead.criado (CRM via webhook → ENG-08)
2. workflow.execucao.iniciada (ENG-07: WF-CAP02-LEAD-RECEBIDO)
3. automacao.operacao.concluida (ENG-08: ICP score calculado)
4. processo.instancia.criada (ENG-01: PROC-CAP02-QUALIFICACAO)
5. kpi.valor.calculado (ENG-02: KPI-DM-08 Lead Response Time)
6. [1h sem contato] → processo.sla.violado (ENG-01)
7. alerta.alerta.criado (ENG-03: ALT-DM-01)
8. workflow.execucao.iniciada (ENG-07: WF-CAP02-SLA-VIOLADO)
9. automacao.operacao.concluida (ENG-08: notificação push para vendedor)
10. [vendedor contacta lead] → processo.etapa.concluida (ENG-01)
11. kpi.valor.calculado (ENG-02: LRT atualizado)
12. alerta.alerta.resolvido (ENG-03: SLA cumprido)
```

### Cenário B: KPI crítico → Diagnóstico → Plano → Melhoria

```
1. kpi.valor.calculado (ENG-02: win rate = 42%, meta = 60%)
2. kpi.limiar.cruzado (ENG-02: critical)
3. alerta.alerta.criado (ENG-03: ALT-IC-01 critical)
4. diagnostico.sessao.aberta (ENG-04: DIAG-CAP01-WIN-RATE)
5. ia.casos_similares.encontrados (ENG-10: 3 casos similares dos últimos 2 anos)
6. ia.hipoteses.geradas (ENG-10: top 3 hipóteses com confiança)
7. diagnostico.causa_raiz.identificada (ENG-04: ICP desatualizado — confiança: alta)
8. plano_acao.plano.criado (ENG-05: PA-CAP01-WIN-RATE)
9. [execução das tarefas do plano — 3 semanas]
10. plano_acao.plano.concluido (ENG-05)
11. alerta.alerta.resolvido (ENG-03)
12. [60 dias de monitoramento]
13. kpi.valor.calculado (ENG-02: win rate = 65% — meta atingida)
14. plano_acao.verificacao.eficaz (ENG-05)
15. ia.conhecimento.indexado (ENG-10: diagnóstico + plano eficaz → BK)
16. melhoria.item.identificado (ENG-09: processo de revisão de ICP precisa ser mais frequente)
17. melhoria.artefato.atualizado (ENG-09: blueprint de revisão de ICP atualizado para trimestral)
```

---

## 7. Garantias do Sistema

| Garantia | Mecanismo |
|----------|-----------|
| Nenhum evento perdido | Barramento com entrega garantida (at-least-once delivery) |
| Rastreabilidade completa | correlacao_id em todos os eventos da mesma cadeia |
| Dados imutáveis | Logs e históricos append-only; correções são novos registros |
| Idempotência | Cada operação pode ser executada N vezes com o mesmo resultado |
| Observabilidade | Cada evento é registrado; dashboards mostram o estado do sistema |
| Recuperabilidade | Replay de eventos permite reprocessar qualquer sequência |
| Desacoplamento | Nenhuma Engine conhece a implementação de outra — só eventos |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação do contrato de integração e barramento de eventos |
