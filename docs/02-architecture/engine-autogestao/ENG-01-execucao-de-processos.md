---
id: ARC-ENG-001
titulo: "ENG-01 — Engine de Execução de Processos"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
tags: [engine, processos, execucao, bpm, orquestracao, fluxo, etapas, handoff]
---

# ENG-01 — Engine de Execução de Processos

---

## 1. Objetivo

Fornecer o mecanismo único pelo qual **qualquer processo definido em qualquer módulo operacional** é representado, executado, monitorado e controlado — garantindo que nenhum processo dependa da memória ou discernimento de uma pessoa para saber em que etapa está, quem é o responsável atual, qual a próxima ação e qual o prazo.

A ENG-01 é o **motor de execução** do SOE: sem ela, os processos são documentos estáticos. Com ela, os processos tornam-se instâncias vivas que o sistema rastreia, cobra e informa.

---

## 2. Responsabilidades

- **Registrar** a definição de qualquer processo de qualquer módulo (blueprint do processo)
- **Instanciar** uma execução de processo quando seu gatilho ocorre
- **Rastrear** o estado atual de cada instância (em qual etapa está, quem é o responsável, desde quando)
- **Aplicar exit criteria** — impedir que uma instância avance de etapa sem satisfazer os critérios definidos
- **Registrar** cada transição de etapa com timestamp, responsável e dados coletados
- **Emitir eventos** de progresso, bloqueio, conclusão e violação de SLA
- **Delegar** para ENG-03 (Alertas) quando um SLA de etapa é violado
- **Fornecer** visibilidade de todas as instâncias em andamento (em tempo real)
- **Arquivar** instâncias concluídas com seu histórico completo (imutável)

---

## 3. Entradas

### 3.1 Entradas de Configuração (Design Time)
```yaml
processo_blueprint:
  id: "PROC-[MODULO]-[NOME]"           # ex: PROC-CAP03-PROCESSO-VENDAS
  modulo_dono: "CAP-03"
  nome: "Processo de Vendas"
  versao: "1.0.0"
  gatilho: "SQL_RECEBIDO"              # evento que cria uma instância
  etapas:
    - id: "E1"
      nome: "Primeiro Contato"
      responsavel_padrao: "vendedor_designado"
      sla_horas: 4
      exit_criteria:
        - campo: "primeiro_contato_registrado"
          operador: "== true"
        - campo: "proxima_acao_definida"
          operador: "!= null"
      dados_obrigatorios: ["data_contato", "canal_contato", "proxima_acao"]
    - id: "E2"
      nome: "Discovery"
      responsavel_padrao: "vendedor_designado"
      sla_horas: 96
      exit_criteria: [...]
  transicoes:
    - de: "E1"
      para: "E2"
      condicao: "exit_criteria_E1_satisfeitos == true"
    - de: "E1"
      para: "DESCARTADO"
      condicao: "fit_confirmado == false"
```

### 3.2 Entradas de Execução (Run Time)
| Entrada | Tipo | Descrição |
|---------|------|-----------|
| Evento de instanciação | Evento SOE | Criação de nova instância de processo |
| Atualização de dados da instância | Formulário / CRM / API | Dados coletados em cada etapa |
| Solicitação de transição de etapa | Responsável humano ou sistema | Pedido de avanço para a próxima etapa |
| Solicitação de cancelamento | Responsável ou sistema | Encerramento da instância antes da conclusão |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Estado atual da instância | Dashboard / CRM | Tempo real |
| Evento `processo.etapa_concluida` | ENG-07 (Workflows), módulos subscritores | Por transição |
| Evento `processo.sla_violado` | ENG-03 (Alertas) | Ao detectar violação |
| Evento `processo.instancia_concluida` | Módulo dono, ENG-06 (Auditoria) | Ao finalizar |
| Evento `processo.exit_criteria_falhou` | ENG-03 (Alertas), responsável | Ao detectar bloqueio |
| Histórico completo da instância (imutável) | ENG-06, ENG-10 | Ao concluir |
| Relatório de throughput de processos | ENG-02 (KPIs) | Diário / mensal |

---

## 5. Regras Gerais

### RG-01: Imutabilidade do Histórico
Todo registro de transição de etapa é **imutável** — não pode ser alterado retroativamente. Se um erro foi cometido, registra-se uma correção como novo evento, nunca apaga-se o anterior.

### RG-02: Exit Criteria como Portão
Uma instância NÃO pode avançar de etapa se os exit criteria não foram satisfeitos. A única exceção é uma **exceção formal** registrada com justificativa e responsável aprovador (e este ato é registrado como evento separado).

### RG-03: Responsável Sempre Definido
Toda instância em execução DEVE ter um responsável humano designado em todo momento. Instância sem responsável é imediatamente sinalizada para ENG-03.

### RG-04: SLA por Etapa
Cada etapa possui um SLA. O SLA começa a contar no momento em que a etapa se torna ativa (instância entra na etapa). Violação de SLA dispara evento para ENG-03 sem exceção.

### RG-05: Versionamento de Blueprints
Mudanças em um blueprint de processo NÃO afetam instâncias em andamento — elas continuam sob a versão do blueprint que estava vigente quando foram criadas. Apenas novas instâncias usam o blueprint atualizado.

### RG-06: Rastreabilidade Completa
Cada instância carrega um `correlacao_id` que permite rastrear todos os eventos gerados por ela ao longo de todo o SOE (incluindo alertas, planos de ação e auditorias derivados).

---

## 6. Interfaces com os Módulos

| Módulo | Como Usa a ENG-01 |
|--------|------------------|
| CAP-02 (Demanda) | Registra o processo de qualificação de leads; cada lead é uma instância |
| CAP-03 (Vendas) | Registra o funil de vendas; cada oportunidade é uma instância |
| CAP-03.5 (Contratos) | Registra o processo de formalização contratual |
| CAP-05 (Clientes) | Registra o processo de onboarding; cada novo cliente é uma instância |
| CAP-05 (Clientes) | Registra o protocolo de salvamento (churn risk) como instância específica |
| CAP-07 (Equipe) | Registra o processo de ramp-up de novos membros |
| CAP-07 (Equipe) | Registra o processo de PDI como instância rastreável |
| CAP-09 (Parcerias) | Registra o processo de onboarding de parceiros |

**Protocolo de registro:** Todo módulo que define um processo DEVE registrá-lo na ENG-01 como blueprint antes de operar. Processos não registrados são invisíveis ao sistema de governança.

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `processo_blueprints`
```
id                  TEXT PRIMARY KEY    -- "PROC-CAP03-VENDAS"
modulo_dono         TEXT                -- "CAP-03"
nome                TEXT
versao              TEXT                -- SemVer
gatilho_tipo        TEXT                -- tipo de evento que instancia
etapas_json         JSONB               -- definição completa das etapas
transicoes_json     JSONB               -- regras de transição
ativo               BOOLEAN
criado_em           TIMESTAMP
atualizado_em       TIMESTAMP
```

### 7.2 Tabela: `processo_instancias`
```
id                  UUID PRIMARY KEY
blueprint_id        TEXT REFERENCES processo_blueprints
blueprint_versao    TEXT                -- versão vigente na criação
modulo_dono         TEXT
etapa_atual         TEXT
responsavel_atual   TEXT
status              ENUM(ativa, concluida, cancelada, bloqueada)
correlacao_id       UUID                -- rastreia toda a cadeia de eventos
dados_json          JSONB               -- dados coletados ao longo da instância
criado_em           TIMESTAMP
atualizado_em       TIMESTAMP
concluido_em        TIMESTAMP
```

### 7.3 Tabela: `processo_transicoes` (imutável — append only)
```
id                  UUID PRIMARY KEY
instancia_id        UUID REFERENCES processo_instancias
etapa_de            TEXT
etapa_para          TEXT
responsavel         TEXT
timestamp           TIMESTAMP
dados_coletados     JSONB
exit_criteria_log   JSONB               -- resultado de cada critério avaliado
observacoes         TEXT
excecao_aplicada    BOOLEAN
excecao_aprovador   TEXT
```

### 7.4 Tabela: `processo_violacoes_sla`
```
id                  UUID PRIMARY KEY
instancia_id        UUID
etapa              TEXT
sla_esperado_horas  INTEGER
horas_reais         DECIMAL
responsavel         TEXT
alerta_gerado_id    UUID                -- referência ao alerta em ENG-03
timestamp           TIMESTAMP
```

---

## 8. Fluxo Operacional

```
[1] REGISTRO DO BLUEPRINT (design time)
│
└─► Módulo submete blueprint do processo
    └─► ENG-01 valida (etapas, transições, exit criteria, SLAs definidos?)
        ├─► Válido → armazenar em processo_blueprints; emitir evento processo.blueprint_registrado
        └─► Inválido → retornar erros de validação; blueprint NÃO é ativado

[2] INSTANCIAÇÃO (run time — ao ocorrer o evento gatilho)
│
└─► Evento gatilho recebido (ex: SQL_RECEBIDO de CAP-02)
    └─► ENG-01 localiza blueprint ativo correspondente
        └─► Cria registro em processo_instancias (status: ativa, etapa_atual: E1)
            └─► Designa responsável padrão da E1
                └─► Inicia contagem de SLA da E1
                    └─► Emite evento processo.instancia_criada

[3] EXECUÇÃO DE ETAPA (ciclo por etapa)
│
├─► Responsável coleta dados e solicita avanço de etapa
│   └─► ENG-01 avalia exit criteria da etapa atual
│       ├─► Todos satisfeitos → registrar transição (append only)
│       │   └─► Atualizar instância para próxima etapa
│       │       └─► Iniciar SLA da nova etapa
│       │           └─► Emitir evento processo.etapa_concluida
│       └─► Critério NÃO satisfeito → registrar tentativa; emitir processo.exit_criteria_falhou
│           └─► ENG-03 notifica responsável com critério específico que falhou
│
└─► [Paralelo — monitoramento de SLA]
    └─► ENG-01 verifica continuamente se SLA de etapa ativa foi violado
        └─► Violação detectada → registrar em processo_violacoes_sla
            └─► Emitir evento processo.sla_violado → ENG-03 dispara alerta

[4] CONCLUSÃO OU ENCERRAMENTO
│
├─► Instância chega à etapa final com exit criteria satisfeitos
│   └─► Status → concluida; concluido_em = now()
│       └─► Emitir processo.instancia_concluida
│           └─► ENG-06 (Auditoria) recebe para registro
│               └─► ENG-10 (IA/Conhecimento) recebe histórico para aprendizado
│
└─► Instância cancelada (fit negativo, desistência, etc.)
    └─► Registrar motivo de cancelamento
        └─► Status → cancelada
            └─► Emitir processo.instancia_cancelada (com motivo)
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `processo.blueprint_registrado` | Blueprint aprovado e salvo | `{blueprint_id, modulo, versao}` |
| `processo.instancia_criada` | Nova instância instanciada | `{instancia_id, blueprint_id, responsavel, etapa_inicial}` |
| `processo.etapa_concluida` | Transição de etapa bem-sucedida | `{instancia_id, etapa_de, etapa_para, responsavel, timestamp}` |
| `processo.exit_criteria_falhou` | Critério de saída não satisfeito | `{instancia_id, etapa, criterio_falho, responsavel}` |
| `processo.sla_violado` | SLA de etapa ultrapassado | `{instancia_id, etapa, sla_horas, horas_reais, responsavel}` |
| `processo.instancia_concluida` | Processo finalizado com sucesso | `{instancia_id, duracao_total, etapas_executadas}` |
| `processo.instancia_cancelada` | Processo encerrado antes do fim | `{instancia_id, motivo_cancelamento, etapa_no_cancelamento}` |
| `processo.sem_responsavel` | Instância sem responsável designado | `{instancia_id, etapa_atual, tempo_sem_responsavel}` |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `sql.criado` | CAP-02 | Instanciar processo PROC-CAP03-VENDAS |
| `oportunidade.ganha` | CAP-03 | CAP-05 consome e instancia processo PROC-CAP05-ONBOARDING; CAP-04 consome e instancia processo de faturamento |
| `cliente.churn_risco_detectado` | ENG-03 | Instanciar processo PROC-CAP05-SALVAMENTO |
| `parceiro.cadastrado` | CAP-09 | Instanciar processo PROC-CAP09-ONBOARDING-PARCEIRO |
| `colaborador.contratado` | CAP-07 | Instanciar processo PROC-CAP07-RAMPUP |
| `colaborador.meta_abaixo_limiar` | ENG-03 | Instanciar processo PROC-CAP07-PDI |
| `processo.etapa_concluida` | ENG-01 (self) | Avaliar transição e avançar instância |
| `workflow.acao_concluida` | ENG-07 | Atualizar dados da instância e reavaliar exit criteria |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-01 |
