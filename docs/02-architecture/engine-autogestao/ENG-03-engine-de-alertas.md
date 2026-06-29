---
id: ARC-ENG-003
titulo: "ENG-03 — Engine de Alertas"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-002
tags: [engine, alertas, notificacoes, monitoramento, limiar, escalonamento, sla]
---

# ENG-03 — Engine de Alertas

---

## 1. Objetivo

Detectar **automaticamente** qualquer condição anormal no SOE — seja violação de KPI, violação de SLA de processo, ausência de ação obrigatória, ou anomalia operacional — e notificar as pessoas certas, no canal certo, no momento certo, com a informação suficiente para que a ação corretiva seja iniciada sem necessidade de investigação adicional.

A ENG-03 é o **sistema imunológico** do SOE: sua função é detectar ameaças antes que causem dano irreversível e acionar a resposta adequada.

---

## 2. Responsabilidades

- **Receber** eventos de KPI, processo, workflow e auditoria de todas as outras Engines
- **Avaliar** se o evento configura uma condição de alerta (cruzamento de limiar, violação de SLA, anomalia)
- **Classificar** o alerta por severidade: `info`, `warning`, `critical`, `bloqueante`
- **Roteamento inteligente**: enviar o alerta ao(s) destinatário(s) correto(s) conforme regras de escalonamento
- **Gerenciar o ciclo de vida** do alerta: aberto → reconhecido → em tratamento → resolvido
- **Escalar** alertas não reconhecidos dentro do prazo para o nível superior
- **Suprimir** alertas duplicados e ruído (não alarmar sem necessidade)
- **Registrar** todos os alertas e suas resoluções (histórico imutável)
- **Alimentar** a ENG-04 (Diagnóstico) quando um alerta crítico requer análise de causa raiz

---

## 3. Entradas

### 3.1 Entradas de Configuração (Design Time)
```yaml
alerta_template:
  id: "ALT-IC-01"
  modulo: "CAP-01"
  nome: "Win Rate com queda crítica"
  condicao_gatilho: "kpi.limiar_cruzado WHERE kpi_id = 'KPI-IC-03' AND nivel = 'critical'"
  severidade: "critical"
  titulo_template: "Win Rate de {{modulo}} caiu para {{valor}}% (meta: {{meta}}%)"
  descricao_template: |
    O Win Rate do módulo {{modulo}} está em {{valor}}%, abaixo do limiar crítico de {{limiar}}%.
    Meta atual: {{meta}}%. Desvio: {{desvio_percentual}}%.
    Período: {{periodo}}. Dados disponíveis em: {{link_dashboard}}.
  destinatarios:
    - papel: "Gerente Comercial"
      canal: ["push", "email"]
      prazo_reconhecimento_horas: 4
    - papel: "Liderança Comercial"
      canal: ["email"]
      condicao: "nao_reconhecido_apos_4h"
  requer_diagnostico: true              # aciona ENG-04 automaticamente
  requer_plano_acao: true               # alerta só é resolvido com plano em ENG-05
  suprimir_duplicado_horas: 24          # não re-disparar o mesmo alerta em 24h
```

### 3.2 Entradas de Execução (Run Time — Eventos Consumidos)
| Evento | Origem | Exemplos |
|--------|--------|---------|
| `kpi.limiar_cruzado` | ENG-02 | Win rate abaixo de 60%, NRR abaixo de 90% |
| `processo.sla_violado` | ENG-01 | Lead sem contato em 4h, onboarding atrasado |
| `processo.sem_responsavel` | ENG-01 | Instância sem responsável designado |
| `auditoria.nao_conformidade_detectada` | ENG-06 | Contrato não arquivado, win/loss ausente |
| `workflow.falhou` | ENG-07 | Automação falhou ao executar |
| `kpi.falha_coleta` | ENG-02 | Fonte de dados indisponível |
| `plano_acao.prazo_vencido` | ENG-05 | Plano de ação não executado no prazo |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Notificação push | App mobile / Desktop do destinatário | Imediato (alertas critical/bloqueante) |
| E-mail de alerta | E-mail do destinatário | Por alerta |
| Mensagem em canal de comunicação | Slack/Teams channel do módulo | Por alerta (conforme template) |
| Registro de alerta em `alertas` | Banco de dados | Por alerta |
| Evento `alerta.criado` | ENG-04 (se requer_diagnostico = true) | Por alerta crítico |
| Evento `alerta.escalonado` | Novo destinatário de escalonamento | Ao escalar |
| Relatório de alertas abertos | CAP-08 (Performance), Liderança | Diário |
| Relatório de frequência de alertas | ENG-09 (Melhoria Contínua) | Mensal |

---

## 5. Regras Gerais

### RG-01: Todo Alerta Tem Dono
Todo alerta criado DEVE ter um destinatário primário designado. Alerta sem destinatário é uma falha de configuração e gera um alerta de sistema para o administrador do SOE.

### RG-02: Escalonamento Automático e Obrigatório
Se um alerta do tipo `warning` não é reconhecido em `prazo_reconhecimento` horas, **automaticamente** é escalonado para o nível superior — sem intervenção humana. O escalonamento é registrado no histórico do alerta.

Escalonamento obrigatório de `critical` não reconhecido em 4h vai para a liderança. `critical` não reconhecido em 8h vai para o nível máximo disponível.

### RG-03: Supressão Inteligente de Ruído
O mesmo alerta NÃO pode ser disparado repetidamente em curto intervalo. O campo `suprimir_duplicado_horas` define o intervalo mínimo entre disparos do mesmo alerta para a mesma instância. Isso evita que a equipe ignore alertas por saturação.

### RG-04: Severidade Progressiva
Um alerta não pode pular de `info` para `bloqueante`. A progressão de severidade segue: `info → warning → critical → bloqueante`. Cada nível tem uma escala de resposta progressivamente mais urgente.

### RG-05: Alerta Bloqueante Paralisa o Processo
Alerta do tipo `bloqueante` sinaliza que uma instância de processo NÃO pode avançar até ser resolvido. A ENG-01 recebe o evento e impede transição de etapa até que o bloqueio seja removido.

### RG-06: Resolução Exige Evidência
Um alerta não pode ser marcado como `resolvido` sem que o responsável registre: (a) o que foi feito, (b) quando foi feito, e (c) como verificou que o problema foi corrigido. Alertas que exigem plano de ação só são resolvidos quando a ENG-05 sinaliza o plano como concluído.

### RG-07: Alertas São Insumo — Não Destino
A resolução de um alerta é apenas o começo. Alertas recorrentes (mesmo alerta disparado >3 vezes em 90 dias) devem alimentar a ENG-09 (Melhoria Contínua) como sinal de problema sistêmico não resolvido.

---

## 6. Interfaces com os Módulos

| Módulo | Alertas Registrados (exemplos) |
|--------|-------------------------------|
| CAP-01 | Win rate caiu, win/loss incompleto, mapa competitivo desatualizado |
| CAP-02 | Lead sem contato em 1h, pipeline abaixo de 2×, CPL acima do limite |
| CAP-03 | Oportunidade parada >5 dias, desconto excessivo, cliente sem contrato |
| CAP-04 | Fatura em atraso, NRR abaixo de 95%, forecast desvio >15% |
| CAP-05 | Health score caiu para vermelho, cliente sem contato >45 dias, solicitação de cancelamento |
| CAP-06 | Desconto médio acima do limite, ticket abaixo da meta, concorrente muda preço |
| CAP-07 | Membro abaixo de quota por 2 meses, capacidade da equipe >80%, turnover alto |
| CAP-08 | KPI master abaixo da meta, pipeline < 2×, LTV/CAC < 2 |
| CAP-09 | Parceiro inativo há 60 dias, concentração de canal >40%, leads de qualidade ruim |

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `alerta_templates`
```
id                  TEXT PRIMARY KEY    -- "ALT-IC-01"
modulo              TEXT
nome                TEXT
condicao_gatilho    TEXT                -- expressão de evento e condição
severidade          ENUM(info, warning, critical, bloqueante)
titulo_template     TEXT                -- com variáveis {{campo}}
descricao_template  TEXT
destinatarios_json  JSONB               -- lista com papel, canal, prazo
requer_diagnostico  BOOLEAN
requer_plano_acao   BOOLEAN
suprimir_horas      INTEGER
ativo               BOOLEAN
```

### 7.2 Tabela: `alertas` (registro imutável de cada disparo)
```
id                  UUID PRIMARY KEY
template_id         TEXT REFERENCES alerta_templates
instancia_ref       UUID               -- processo/KPI/módulo que originou
modulo              TEXT
severidade          ENUM(info, warning, critical, bloqueante)
titulo              TEXT               -- título com variáveis preenchidas
descricao           TEXT
status              ENUM(aberto, reconhecido, em_tratamento, resolvido, suprimido)
destinatario_atual  TEXT
criado_em           TIMESTAMP
reconhecido_em      TIMESTAMP
reconhecido_por     TEXT
resolvido_em        TIMESTAMP
resolucao_descricao TEXT
diagnostico_id      UUID               -- referência na ENG-04
plano_acao_id       UUID               -- referência na ENG-05
correlacao_id       UUID               -- rastreia a cadeia de eventos
```

### 7.3 Tabela: `alerta_escalamentos` (append only)
```
id                  UUID PRIMARY KEY
alerta_id           UUID REFERENCES alertas
de_destinatario     TEXT
para_destinatario   TEXT
motivo              TEXT               -- "nao_reconhecido_em_4h"
timestamp           TIMESTAMP
```

### 7.4 Tabela: `alerta_historico` (append only)
```
id                  UUID PRIMARY KEY
alerta_id           UUID REFERENCES alertas
evento              TEXT               -- "criado", "reconhecido", "escalonado", "resolvido"
ator                TEXT               -- quem realizou a ação (ou "sistema")
dados_json          JSONB
timestamp           TIMESTAMP
```

---

## 8. Fluxo Operacional

```
[1] CONFIGURAÇÃO DE TEMPLATE (design time)
│
└─► Módulo submete template de alerta (ou ENG-02 gera automaticamente de limiares de KPI)
    └─► ENG-03 valida (destinatário definido? template de mensagem válido? severidade válida?)
        ├─► Válido → salvar em alerta_templates
        └─► Inválido → rejeitar com erros

[2] DETECÇÃO E CRIAÇÃO DO ALERTA (run time)
│
└─► Evento recebido (ex: kpi.limiar_cruzado, processo.sla_violado)
    └─► ENG-03 avalia: existe template configurado para este evento?
        ├─► NÃO → ignorar (ou logar como evento não mapeado)
        └─► SIM → verificar se alerta duplicado dentro do período de supressão
            ├─► DENTRO DO PERÍODO → suprimir; incrementar contador de supressão
            └─► FORA DO PERÍODO → criar alerta
                └─► Preencher template com variáveis do evento
                    └─► Salvar em alertas (status: aberto)
                        └─► Notificar destinatário primário via canais configurados
                            └─► Iniciar contagem de prazo de reconhecimento
                                └─► Se requer_diagnostico → emitir alerta.criado para ENG-04

[3] CICLO DE VIDA DO ALERTA
│
├─► [Reconhecimento]
│   └─► Destinatário reconhece alerta (via app, email link, ou CRM)
│       └─► Atualizar status → reconhecido; registrar em alerta_historico
│           └─► Iniciar contagem de resolução
│
├─► [Escalonamento automático]
│   └─► Scheduler verifica alertas abertos não reconhecidos
│       └─► Prazo de reconhecimento ultrapassado?
│           └─► SIM → criar registro em alerta_escalamentos
│               └─► Notificar próximo nível conforme destinatarios_json
│                   └─► Emitir alerta.escalonado
│
├─► [Resolução]
│   └─► Responsável registra resolução com descrição e evidência
│       └─► Se requer_plano_acao: verificar se ENG-05 tem plano marcado como concluído
│           ├─► SIM → permitir resolução
│           └─► NÃO → bloquear resolução ("plano de ação pendente")
│               └─► Quando ENG-05 emite plano_acao.concluido → automaticamente liberar resolução
│
└─► [Recorrência]
    └─► ENG-09 recebe relatório mensal de alertas
        └─► Identifica alertas disparados >3× em 90 dias → sinaliza como problema sistêmico
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `alerta.criado` | Novo alerta instanciado | `{alerta_id, template_id, severidade, modulo, destinatario}` |
| `alerta.reconhecido` | Destinatário confirma recebimento | `{alerta_id, reconhecido_por, timestamp}` |
| `alerta.escalonado` | Prazo de reconhecimento vencido | `{alerta_id, de, para, motivo}` |
| `alerta.em_tratamento` | Responsável inicia ação | `{alerta_id, responsavel, acao_iniciada}` |
| `alerta.resolvido` | Alerta encerrado com evidência | `{alerta_id, resolvido_por, resolucao, plano_acao_id}` |
| `alerta.suprimido` | Alerta duplicado dentro do período | `{alerta_id_original, evento_suprimido, motivo}` |
| `alerta.recorrente_detectado` | Mesmo alerta >3× em 90 dias | `{template_id, contagem, periodo, modulo}` — para ENG-09 |
| `processo.bloqueado` | Alerta bloqueante associado a processo | `{instancia_id, alerta_id}` — para ENG-01 |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `kpi.limiar_cruzado` | ENG-02 | Avaliar template de alerta; criar alerta se configurado |
| `kpi.falha_coleta` | ENG-02 | Criar alerta técnico para administrador do SOE |
| `processo.sla_violado` | ENG-01 | Criar alerta com dados da etapa e responsável |
| `processo.sem_responsavel` | ENG-01 | Criar alerta bloqueante até designação |
| `auditoria.nao_conformidade_detectada` | ENG-06 | Criar alerta de conformidade |
| `workflow.falhou` | ENG-07 | Criar alerta técnico com detalhes da falha |
| `plano_acao.prazo_vencido` | ENG-05 | Escalar alerta original; criar novo alerta de delinquência |
| `plano_acao.concluido` | ENG-05 | Verificar se alerta pode ser marcado como resolvido |
| `alerta.recorrente_detectado` | ENG-03 (self) | Encaminhar para ENG-09 como sinal de problema sistêmico |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-03 |
