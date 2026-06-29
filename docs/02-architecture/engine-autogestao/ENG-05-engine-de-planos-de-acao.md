---
id: ARC-ENG-005
titulo: "ENG-05 — Engine de Planos de Ação"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-003
  - ARC-ENG-004
tags: [engine, planos-de-acao, correcao, pdca, tarefas, responsabilidade, prazo, acompanhamento]
---

# ENG-05 — Engine de Planos de Ação

---

## 1. Objetivo

Fornecer o mecanismo pelo qual **qualquer desvio diagnosticado no SOE é transformado em um plano de ação estruturado**, com responsáveis, prazos e critérios de sucesso definidos — e onde a execução desse plano é rastreada até a confirmação de que o problema foi efetivamente resolvido.

A ENG-05 é o **mecanismo de resposta** do SOE: sem ela, diagnósticos se tornam relatórios que ninguém implementa. Com ela, cada causa raiz identificada gera uma cadeia de ações que o sistema monitora até a resolução.

---

## 2. Responsabilidades

- **Receber** diagnósticos concluídos da ENG-04 e estruturar o plano de ação correspondente
- **Sugerir** planos de ação padronizados baseados na categoria de causa raiz e histórico (ENG-10)
- **Registrar** o plano de ação com: ações específicas, responsável por ação, prazo, e critério de conclusão
- **Rastrear** o progresso de cada ação individualmente
- **Monitorar** prazos e escalar para ENG-03 quando ações atrasam
- **Verificar** se a conclusão do plano de ação efetivamente corrigiu o desvio (ENG-02 confirma)
- **Encerrar** o ciclo: alerta → diagnóstico → plano → execução → verificação → encerramento
- **Registrar** o resultado para alimentar ENG-09 e ENG-10

---

## 3. Entradas

### 3.1 Entradas de Configuração (Design Time)
```yaml
plano_acao_template:
  id: "PA-CAP01-WIN-RATE"
  modulo: "CAP-01"
  causa_raiz_categoria: "Dado/ICP"
  nome: "Plano de Ação — Win Rate por ICP Desatualizado"
  descricao: "Executar quando a causa raiz do baixo win rate for ICP desatualizado"
  acoes:
    - sequencia: 1
      descricao: "Levantar todos os win/loss dos últimos 60 dias"
      responsavel_padrao: "Gerente Comercial"
      prazo_dias: 3
      output_esperado: "Lista de patterns de objeção com frequência"
      criterio_conclusao: "Relatório de objeções entregue e aprovado"
    - sequencia: 2
      descricao: "Sessão de revisão do ICP com a equipe"
      responsavel_padrao: "Gerente Comercial"
      prazo_dias: 7
      dependencia_de: [1]
      output_esperado: "ICP draft revisado"
    - sequencia: 3
      descricao: "Aprovação e publicação do novo ICP"
      responsavel_padrao: "Liderança Comercial"
      prazo_dias: 10
      dependencia_de: [2]
      criterio_conclusao: "ICP nova versão publicada e comunicada"
  kpi_verificacao: "KPI-IC-03"           # KPI a monitorar para confirmar resolução
  criterio_sucesso: "KPI-IC-03 >= meta por 2 meses consecutivos"
  prazo_verificacao_dias: 60
```

### 3.2 Entradas de Execução (Run Time)
| Entrada | Origem | Quando |
|---------|--------|--------|
| Evento `diagnostico.causa_raiz_identificada` | ENG-04 | Diagnóstico concluído |
| Atualização de progresso de ação | Responsável (interface) | Por conclusão de ação |
| Solicitação de extensão de prazo | Responsável | Ad hoc |
| Valor atual do KPI de verificação | ENG-02 | No período de verificação |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Plano de ação criado com tarefas | Responsável (notificação) + ENG-03 | Por diagnóstico concluído |
| Evento `plano_acao.criado` | ENG-03 (atualiza alerta) | Por criação |
| Tarefa individual com prazo | Responsável da ação (notificação) | Por ação criada |
| Evento `plano_acao.acao_atrasada` | ENG-03 (alerta de atraso) | Quando prazo vence sem conclusão |
| Evento `plano_acao.concluido` | ENG-03 (permite fechar alerta) | Quando todas as ações concluídas |
| Evento `plano_acao.verificado_eficaz` | ENG-09 (Melhoria Contínua) | Quando KPI confirma resolução |
| Relatório de planos abertos e atrasados | CAP-08, Liderança | Semanal |

---

## 5. Regras Gerais

### RG-01: Vínculo Obrigatório com Diagnóstico
Todo plano de ação DEVE estar vinculado a uma sessão de diagnóstico concluída da ENG-04. Planos de ação sem diagnóstico são planos de ação para sintomas — permitidos como exceção formal, mas sinalizados como `sem_diagnostico`.

### RG-02: Toda Ação Tem Responsável e Prazo
Cada ação individual dentro de um plano DEVE ter: (a) responsável humano nomeado, (b) prazo específico, (c) output esperado, (d) critério de conclusão. Ações vagas ("melhorar o processo") não são aceitas pelo sistema.

### RG-03: Prazo Máximo por Plano
Um plano de ação DEVE ter prazo total definido. O prazo máximo recomendado por categoria de causa raiz é:
- `Processo`: ≤ 30 dias
- `Pessoa/Habilidade`: ≤ 45 dias
- `Ferramenta`: ≤ 60 dias
- `Estratégia`: ≤ 90 dias
- `Externo`: ≤ 90 dias (ação mitigatória)

### RG-04: Verificação de Eficácia é Obrigatória
Um plano de ação não é encerrado ao concluir as tarefas. O encerramento definitivo só ocorre quando ENG-02 confirma que o KPI de verificação atingiu a meta por pelo menos 1 ciclo completo após a conclusão do plano. Caso contrário, o plano é marcado como `ineficaz` e um novo diagnóstico é iniciado.

### RG-05: Extensão de Prazo Requer Aprovação
Extensões de prazo de planos de ação DEVEM ser aprovadas pelo gerente responsável. A extensão é registrada no histórico com justificativa. Mais de 2 extensões no mesmo plano geram alerta para a liderança.

### RG-06: Plano Ineficaz Não É Falha — É Dado
Quando um plano se mostra ineficaz (KPI não melhora após conclusão das ações), isso é registrado como aprendizado na ENG-10. A causa raiz identificada estava errada, ou as ações foram insuficientes. Um novo ciclo de diagnóstico é iniciado com esse contexto adicional.

---

## 6. Interfaces com os Módulos

| Módulo | Planos de Ação Padronizados (templates registrados) |
|--------|-----------------------------------------------------|
| CAP-01 | Win rate baixo, ICP desatualizado, IC desengajada |
| CAP-02 | Pipeline abaixo do volume, qualidade de leads baixa, LRT alto |
| CAP-03 | Win rate baixo, ciclo longo, desconto excessivo, clientes sem contrato |
| CAP-04 | NRR abaixo de 100%, inadimplência alta, forecast impreciso |
| CAP-05 | Protocolo de salvamento de cliente, churn alto, onboarding atrasado |
| CAP-06 | Alto desconto médio, portfólio com gap, revisão anual de preços |
| CAP-07 | Equipe abaixo de quota (PA-EC-01), turnover alto (PA-EC-02), PDI ativo (PA-EC-03) |
| CAP-08 | MRR abaixo da meta, LTV/CAC < 3, ritmo operacional quebrado |
| CAP-09 | Canal sem resultado, qualidade de leads de parceiros baixa |

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `plano_acao_templates`
```
id                      TEXT PRIMARY KEY
modulo                  TEXT
causa_raiz_categoria    TEXT
nome                    TEXT
descricao               TEXT
acoes_json              JSONB           -- sequência de ações padronizadas
kpi_verificacao         TEXT
criterio_sucesso        TEXT
prazo_verificacao_dias  INTEGER
ativo                   BOOLEAN
```

### 7.2 Tabela: `planos_acao`
```
id                      UUID PRIMARY KEY
template_id             TEXT            -- null se criado manualmente
diagnostico_id          UUID REFERENCES diagnostico_sessoes
alerta_id               UUID
modulo                  TEXT
nome                    TEXT
causa_raiz_resumo       TEXT
status                  ENUM(rascunho, ativo, concluido, verificando, eficaz, ineficaz, abandonado)
responsavel_geral       TEXT
prazo_total             DATE
kpi_verificacao         TEXT
criterio_sucesso        TEXT
prazo_verificacao_ate   DATE
sem_diagnostico         BOOLEAN DEFAULT false
criado_em               TIMESTAMP
concluido_em            TIMESTAMP
verificado_em           TIMESTAMP
resultado_verificacao   ENUM(eficaz, ineficaz, inconclusivo)
```

### 7.3 Tabela: `plano_acao_tarefas`
```
id                      UUID PRIMARY KEY
plano_id                UUID REFERENCES planos_acao
sequencia               INTEGER
descricao               TEXT
responsavel             TEXT
prazo                   DATE
dependencias_json       JSONB           -- IDs de tarefas predecessoras
output_esperado         TEXT
criterio_conclusao      TEXT
status                  ENUM(pendente, em_andamento, concluida, atrasada, cancelada)
concluido_em            TIMESTAMP
concluido_por           TEXT
evidencia               TEXT
```

### 7.4 Tabela: `plano_acao_extensoes` (append only)
```
id                      UUID PRIMARY KEY
plano_id                UUID
tarefa_id               UUID            -- null se extensão do plano geral
prazo_anterior          DATE
prazo_novo              DATE
justificativa           TEXT
aprovado_por            TEXT
timestamp               TIMESTAMP
```

---

## 8. Fluxo Operacional

```
[1] CRIAÇÃO DO PLANO (por diagnóstico concluído)
│
└─► ENG-04 emite diagnostico.causa_raiz_identificada
    └─► ENG-05 recebe evento com: modulo, kpi, causa_raiz, categoria
        └─► Buscar template de plano de ação para a categoria e módulo
            ├─► Template encontrado → pré-preencher plano com ações padronizadas
            └─► Template não encontrado → criar plano "livre" para preenchimento manual
                └─► ENG-10 sugere planos similares de casos históricos
                    └─► Notificar responsável para revisar e aprovar o plano
                        └─► Responsável ajusta ações, prazos, responsáveis por ação
                            └─► Aprovar plano → status = ativo
                                └─► Emitir plano_acao.criado
                                    └─► Notificar cada responsável de tarefa (ENG-03)

[2] EXECUÇÃO DAS TAREFAS (ciclo por tarefa)
│
└─► Responsável executa a ação
    └─► Atualiza tarefa: status = concluida + evidência registrada
        └─► ENG-05 verifica dependências: próxima tarefa liberada?
            ├─► SIM → notificar responsável da próxima tarefa
            └─► Todas as tarefas concluídas → plano status = concluido
                └─► Emitir plano_acao.concluido
                    └─► ENG-03 recebe: alerta pode ser marcado como resolvido
                    └─► ENG-05 inicia período de verificação de eficácia

[3] MONITORAMENTO DE PRAZOS (paralelo)
│
└─► Scheduler verifica tarefas com prazo vencido e status != concluida
    └─► Tarefa atrasada → status = atrasada
        └─► Emitir plano_acao.acao_atrasada → ENG-03 (alerta de atraso)
            └─► Escalar para responsável da tarefa + gerente do plano

[4] VERIFICAÇÃO DE EFICÁCIA (após conclusão do plano)
│
└─► ENG-02 coleta KPI de verificação no próximo ciclo após conclusão do plano
    └─► ENG-05 compara valor com critério_sucesso
        ├─► Critério atingido → status = eficaz
        │   └─► Emitir plano_acao.verificado_eficaz
        │       └─► ENG-09 recebe como ciclo PDCA bem-sucedido
        │           └─► ENG-10 indexa como caso de sucesso
        │
        └─► Critério NÃO atingido → status = ineficaz
            └─► Emitir plano_acao.verificado_ineficaz
                └─► ENG-04 iniciado novamente: novo diagnóstico com contexto adicional
                    └─► ENG-10 indexa como aprendizado (o que não funcionou)
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `plano_acao.criado` | Plano aprovado e ativado | `{plano_id, modulo, causa_raiz, responsavel, prazo}` |
| `plano_acao.tarefa_iniciada` | Tarefa muda para em_andamento | `{plano_id, tarefa_id, responsavel}` |
| `plano_acao.tarefa_concluida` | Tarefa marcada como concluída | `{plano_id, tarefa_id, evidencia}` |
| `plano_acao.acao_atrasada` | Tarefa com prazo vencido sem conclusão | `{plano_id, tarefa_id, dias_atraso, responsavel}` |
| `plano_acao.concluido` | Todas as tarefas concluídas | `{plano_id, duracao_total}` |
| `plano_acao.verificado_eficaz` | KPI confirmou melhoria | `{plano_id, kpi_id, valor_antes, valor_depois}` |
| `plano_acao.verificado_ineficaz` | KPI não melhorou | `{plano_id, kpi_id, valor_esperado, valor_obtido}` |
| `plano_acao.prazo_vencido` | Prazo total do plano venceu sem conclusão | `{plano_id, dias_atraso, responsavel_geral}` |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `diagnostico.causa_raiz_identificada` | ENG-04 | Criar plano de ação (automático ou assistido) |
| `kpi.calculado` | ENG-02 | Verificar critério de sucesso dos planos em fase de verificação |
| `ia.planos_similares_encontrados` | ENG-10 | Apresentar sugestões ao responsável |
| `plano_acao.concluido` | ENG-05 (self) | Iniciar período de verificação de eficácia |
| `workflow.acao_concluida` | ENG-07 | Atualizar tarefa correspondente no plano |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-05 |
