---
id: ARC-ENG-007
titulo: "ENG-07 — Engine de Workflows"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-001
tags: [engine, workflows, automacao, sequencias, tarefas, integracao, orquestracao, eventos]
---

# ENG-07 — Engine de Workflows

---

## 1. Objetivo

Orquestrar **sequências automatizadas de ações** que ocorrem em resposta a eventos do SOE — conectando módulos, sistemas externos e responsáveis humanos em fluxos de trabalho que executam sem intervenção manual, garantindo que o sistema reaja de forma consistente a situações recorrentes e elimine o trabalho de coordenação que hoje depende de memória ou esforço manual.

A ENG-07 é o **sistema nervoso autônomo** do SOE: enquanto a ENG-01 rastreia processos que os humanos executam, a ENG-07 executa as ações de coordenação que o sistema faz automaticamente quando eventos ocorrem.

---

## 2. Responsabilidades

- **Registrar** definições de workflows (gatilho + sequência de ações + condições)
- **Escutar** eventos do barramento do SOE e identificar workflows ativados
- **Executar** cada ação do workflow na sequência correta (com suporte a paralelismo e condicionais)
- **Integrar** com sistemas externos (CRM, ERP, e-mail, mensageria, APIs) via ENG-08
- **Lidar com falhas** — tentar novamente, escalar ou registrar falha sem parar a execução geral
- **Registrar** cada execução e cada ação com timestamp e resultado
- **Notificar** humanos quando uma ação no workflow requer intervenção
- **Emitir** eventos de conclusão, falha e marcos intermediários

---

## 3. Entradas

### 3.1 Entradas de Configuração (Design Time)
```yaml
workflow_definition:
  id: "WF-CAP02-LEAD-RECEBIDO"
  nome: "Workflow de Novo Lead Inbound"
  modulo_dono: "CAP-02"
  gatilho:
    evento: "lead.criado"
    condicao: "lead.canal == 'inbound'"
  acoes:
    - id: "A1"
      tipo: "crm_update"
      descricao: "Calcular e atualizar ICP Score do lead"
      integracao: "CRM_PRINCIPAL"
      operacao: "calcular_icp_score"
      parametros: {lead_id: "{{evento.lead_id}}"}
      timeout_segundos: 10
      em_falha: "continuar"             # continuar | parar | escalar
    - id: "A2"
      tipo: "condicional"
      condicao: "A1.resultado.icp_score >= 7"
      se_verdadeiro: ["A3"]
      se_falso: ["A4"]
    - id: "A3"
      tipo: "crm_update"
      descricao: "Marcar como MQL e adicionar à fila de qualificação"
      integracao: "CRM_PRINCIPAL"
      operacao: "atualizar_status"
      parametros: {lead_id: "{{evento.lead_id}}", status: "MQL"}
    - id: "A4"
      tipo: "crm_update"
      descricao: "Marcar como fora do ICP e descartar"
      integracao: "CRM_PRINCIPAL"
      operacao: "descartar_lead"
      parametros: {lead_id: "{{evento.lead_id}}", motivo: "fora_do_icp"}
    - id: "A5"
      tipo: "notificacao_humana"
      condicao: "A2.resultado == 'se_verdadeiro'"
      descricao: "Notificar SDR responsável sobre novo MQL"
      canal: "push"
      destinatario: "{{crm.lead.sdr_responsavel}}"
      mensagem: "Novo MQL recebido: {{lead.nome}} — {{lead.empresa}} (ICP Score: {{A1.resultado.icp_score}})"
      requer_acao: false
    - id: "A6"
      tipo: "sla_monitor"
      descricao: "Iniciar contagem de SLA de primeiro contato (1h)"
      parametros: {instancia_tipo: "lead_contato", id: "{{evento.lead_id}}", sla_horas: 1}
  acoes_em_falha_geral:
    - tipo: "notificacao_sistema"
      destinatario: "admin_soe"
      mensagem: "Workflow WF-CAP02-LEAD-RECEBIDO falhou para lead {{evento.lead_id}}"
```

### 3.2 Entradas de Execução (Run Time)
| Entrada | Origem | Quando |
|---------|--------|--------|
| Evento do barramento do SOE | Qualquer Engine ou módulo | Quando evento ocorre |
| Resultado de ação anterior (para condicionais) | ENG-07 (self) | Durante execução |
| Resposta de sistema externo (via ENG-08) | ENG-08 | Após chamada de integração |
| Resposta humana (em workflows que aguardam aprovação) | Interface de usuário | Quando requerido |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Ações executadas (atualizações em CRM, ERP, etc.) | Sistemas externos | Por ação no workflow |
| Notificações para responsáveis | ENG-03 (ou direto ao usuário) | Por ação de notificação |
| Evento `workflow.iniciado` | Barramento SOE | Por instância criada |
| Evento `workflow.acao_concluida` | ENG-01, ENG-05, ENG-02 | Por ação executada |
| Evento `workflow.concluido` | Barramento SOE | Por instância finalizada |
| Evento `workflow.falhou` | ENG-03 (Alertas) | Por falha não recuperável |
| Log completo de execução | `workflow_execucoes` | Por instância |

---

## 5. Regras Gerais

### RG-01: Idempotência
Toda ação de workflow DEVE ser idempotente — executar a mesma ação duas vezes não deve causar efeito duplicado (ex: se o CRM já tem o ICP Score calculado, não calcular novamente; se o e-mail já foi enviado, não reenviar). Isso garante segurança em retentativas.

### RG-02: Isolamento de Falhas
A falha de uma ação NÃO deve necessariamente parar todo o workflow. Cada ação define sua política `em_falha`: continuar (pular e seguir), parar (encerrar o workflow), ou escalar (aguardar intervenção humana).

### RG-03: Timeout por Ação
Toda ação que chama sistema externo DEVE ter timeout configurado. Se o sistema externo não responde no timeout, a ação é marcada como `timeout` e a política de falha é aplicada.

### RG-04: Versionamento de Workflows
Mudanças em um workflow não afetam execuções em andamento. Novas instâncias usam a versão mais recente; instâncias ativas concluem na versão que estava vigente quando foram criadas.

### RG-05: Rastreabilidade Completa
Cada execução de workflow mantém registro completo de todas as ações: o que foi executado, quando, com quais parâmetros, e qual foi o resultado. Esse log é imutável e auditável.

### RG-06: Workflows Não Substituem Processos
Workflows (ENG-07) executam ações de coordenação automática. Processos (ENG-01) rastreiam a jornada humana de trabalho. São complementares: um processo pode ter vários workflows associados que automatizam partes da coordenação.

---

## 6. Interfaces com os Módulos

| Módulo | Workflows Registrados (exemplos) |
|--------|----------------------------------|
| CAP-02 | Novo lead inbound → ICP score → classificar → notificar SDR → iniciar SLA |
| CAP-02 | SLA de primeiro contato vencido → notificar → escalar após 4h |
| CAP-03 | Oportunidade ganha → criar contrato → notificar CS → criar onboarding |
| CAP-03 | Proposta enviada → agendar follow-up em 3 dias se sem resposta |
| CAP-04 | Fatura vencida + 1 dia → e-mail automático de lembrete ao cliente |
| CAP-04 | Contrato assinado → ativar faturamento recorrente → notificar financeiro |
| CAP-05 | Novo cliente ativo → criar plano de onboarding → notificar CS designado |
| CAP-05 | Health Score caiu para vermelho → notificar CS + gerente imediatamente |
| CAP-05 | NPS ≤ 6 detectado → criar tarefa urgente para CS contactar cliente em 24h |
| CAP-07 | Novo colaborador → criar plano de ramp-up → agenda treinamentos |
| CAP-08 | Período encerrado → disparar coleta de todos os KPIs → gerar relatório |

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `workflow_definitions`
```
id                  TEXT PRIMARY KEY
modulo_dono         TEXT
nome                TEXT
versao              TEXT
gatilho_evento      TEXT               -- tipo de evento que dispara
gatilho_condicao    TEXT               -- expressão condicional adicional
acoes_json          JSONB              -- sequência de ações com condicionais
acoes_falha_json    JSONB
ativo               BOOLEAN
criado_em           TIMESTAMP
atualizado_em       TIMESTAMP
```

### 7.2 Tabela: `workflow_execucoes`
```
id                  UUID PRIMARY KEY
definition_id       TEXT REFERENCES workflow_definitions
definition_versao   TEXT
evento_gatilho_id   UUID               -- ID do evento que disparou
modulo              TEXT
status              ENUM(iniciado, em_andamento, concluido, falhou, aguardando_humano)
correlacao_id       UUID
criado_em           TIMESTAMP
concluido_em        TIMESTAMP
duracao_ms          INTEGER
```

### 7.3 Tabela: `workflow_acoes_log` (append only — imutável)
```
id                  UUID PRIMARY KEY
execucao_id         UUID REFERENCES workflow_execucoes
acao_id             TEXT               -- ID da ação no definition
tipo_acao           TEXT
descricao           TEXT
parametros_json     JSONB
resultado_json      JSONB
status              ENUM(executada, pulada, falhou, timeout, aguardando)
tentativas          INTEGER
iniciada_em         TIMESTAMP
concluida_em        TIMESTAMP
duracao_ms          INTEGER
erro_descricao      TEXT
```

---

## 8. Fluxo Operacional

```
[1] REGISTRO DO WORKFLOW (design time)
│
└─► Módulo ou administrador submete definição de workflow
    └─► ENG-07 valida (gatilho válido? ações reconhecidas? sistema externo acessível?)
        ├─► Válido → salvar em workflow_definitions; ativar listener de evento
        └─► Inválido → rejeitar com erros

[2] DETECÇÃO DO GATILHO (run time — contínuo)
│
└─► Barramento SOE recebe evento (ex: lead.criado)
    └─► ENG-07 verifica: existe workflow com gatilho_evento == "lead.criado"?
        ├─► NÃO → ignorar para este workflow
        └─► SIM → avaliar gatilho_condicao (ex: lead.canal == 'inbound')
            ├─► Condição não satisfeita → ignorar
            └─► Condição satisfeita → criar instância de execução
                └─► Emitir workflow.iniciado

[3] EXECUÇÃO DAS AÇÕES (sequencial com suporte a paralelo e condicionais)
│
└─► Para cada ação na sequência (respeitando dependências):
    │
    ├─► Ação tipo "crm_update" / "erp_call" / "api_call"
    │   └─► Delegar para ENG-08 (Automação) com parâmetros
    │       └─► Aguardar resposta (com timeout)
    │           ├─► Sucesso → registrar resultado; avançar para próxima ação
    │           └─► Falha/Timeout → aplicar política em_falha
    │
    ├─► Ação tipo "condicional"
    │   └─► Avaliar expressão com dados disponíveis
    │       └─► Redirecionar para ramo se_verdadeiro ou se_falso
    │
    ├─► Ação tipo "notificacao_humana"
    │   └─► Enviar notificação via ENG-03 (ou canal direto)
    │       ├─► requer_acao = false → continuar imediatamente
    │       └─► requer_acao = true → pausar execução até confirmação humana
    │
    └─► Ação tipo "sla_monitor"
        └─► Registrar início de contagem de SLA em ENG-01
│
[4] CONCLUSÃO DA EXECUÇÃO
│
├─► Todas as ações executadas (sucesso ou pular) → status = concluido
│   └─► Emitir workflow.concluido
│
└─► Ação crítica falhou com política "parar" → status = falhou
    └─► Emitir workflow.falhou → ENG-03 (alerta)

[5] TRATAMENTO DE RETENTATIVAS (paralelo)
│
└─► Ação com política "continuar" e em_falha é retentada automaticamente
    └─► Máximo de 3 tentativas com backoff exponencial (30s, 60s, 120s)
        └─► Após 3 falhas → registrar como falha definitiva; continuar workflow se política permite
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `workflow.iniciado` | Instância criada | `{execucao_id, definition_id, gatilho_evento_id}` |
| `workflow.acao_concluida` | Ação individual executada com sucesso | `{execucao_id, acao_id, resultado}` |
| `workflow.aguardando_humano` | Ação requer intervenção humana | `{execucao_id, acao_id, descricao_acao, responsavel}` |
| `workflow.concluido` | Todas as ações completadas | `{execucao_id, duracao_ms, acoes_executadas}` |
| `workflow.falhou` | Falha não recuperável | `{execucao_id, acao_falha_id, erro}` |
| `workflow.acao_timeout` | Timeout em chamada externa | `{execucao_id, acao_id, sistema_externo, timeout_ms}` |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `lead.criado` | CAP-02 / CRM | Verificar workflows com gatilho correspondente |
| `oportunidade.ganha` | CAP-03 / CRM | Verificar workflows de pós-venda |
| `oportunidade.ganha` | CAP-03 | Acionar workflow de ativação de cliente (CAP-05 e CAP-04 derivam seus eventos internos) |
| `kpi.limiar_cruzado` | ENG-02 | Acionar workflows de resposta automática a desvio |
| `processo.sla_violado` | ENG-01 | Acionar workflow de escalonamento automático |
| `alerta.criado` | ENG-03 | Acionar workflows de resposta a alertas específicos |
| `cliente.health_score_vermelho` | CAP-05 / ENG-02 | Acionar workflow de protocolo de salvamento |
| `fatura.vencida` | CAP-04 | Acionar workflow de cobrança automática |
| `colaborador.contratado` | CAP-07 | Acionar workflow de ramp-up |
| `sistema.periodo_encerrado` | Scheduler | Acionar workflows de fechamento de período |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-07 |
