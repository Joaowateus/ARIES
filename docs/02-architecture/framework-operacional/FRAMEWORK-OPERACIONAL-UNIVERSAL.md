---
id: ARC-FOB-001
titulo: "Framework Operacional Universal — Aries Negócios"
versao: "1.0.0"
status: ATIVO
categoria: C1-Fundacional
camada: Metodologia
escopo: Transversal — obrigatório para todos os módulos CAP-01 a CAP-09
criado-em: "2026-07-01"
ultima_revisao: "2026-07-01"
proxima_revisao: "2027-01-01"
dependencias:
  - ARC-ENG-000
  - ARC-ENG-099
tags: [framework, metodologia, ciclo-operacional, kpi, alertas, planos-acao, auditoria, ritos, raci, documentacao, melhoria-continua]
---

# Framework Operacional Universal — Aries Negócios

> **Documento fundacional do sistema.** Toda operação executada por qualquer módulo do Commercial OS obedece às regras, estruturas e ciclos definidos neste framework. Nenhum módulo pode contradizer, substituir ou ignorar qualquer seção deste documento.

---

## Declaração de Propósito

O Framework Operacional Universal (FOB) é a **espinha dorsal metodológica** do sistema Aries Negócios. Ele define o contrato operacional que garante que, independentemente de qual módulo está em execução, qual processo está sendo executado, ou qual equipe está operando, o sistema se comporta de maneira previsível, auditável e autocorretiva.

O FOB não é um manual de procedimentos. É um **sistema de regras e estruturas** que tornam qualquer módulo capaz de:

- Operar sem depender de decisões subjetivas
- Detectar seus próprios desvios
- Corrigir-se de forma estruturada
- Aprender com cada ciclo de execução
- Produzir evidências auditáveis de toda operação

**Referências metodológicas incorporadas:** TOGAF (governança de arquitetura), APQC PCF (categorias de processo), ITIL 4 (gestão de serviços), COBIT 2019 (controles e governança), BPM CBOK (gestão de processos de negócio), Capability-Based Planning (estruturação por capacidades).

---

## Estrutura do Framework

| # | Sistema | Propósito |
|---|---|---|
| **FOB-01** | Ciclo Operacional Universal | Sequência obrigatória de todo processo executado no sistema |
| **FOB-02** | Máquina de Decisão | Regras padronizadas de tomada de decisão e escalonamento |
| **FOB-03** | Sistema Universal de KPIs | Modelagem, cálculo e governança de qualquer indicador |
| **FOB-04** | Sistema Universal de Alertas | Arquitetura de notificação e resposta a desvios |
| **FOB-05** | Sistema Universal de Planos de Ação | Estrutura padronizada de resposta a problemas |
| **FOB-06** | Sistema Universal de Auditoria | Três camadas de verificação de conformidade |
| **FOB-07** | Sistema Universal de Ritos de Gestão | Cadências obrigatórias de revisão e decisão |
| **FOB-08** | Sistema Universal de Responsabilidades | Arquitetura de papéis, autoridade e prestação de contas |
| **FOB-09** | Sistema Universal de Documentação | Padrão obrigatório para qualquer artefato do sistema |
| **FOB-10** | Sistema Universal de Melhoria Contínua | Ciclo de aprendizado e evolução do sistema |

---

# FOB-01 — Ciclo Operacional Universal

## 1.1 Definição

O Ciclo Operacional Universal (COU) é a **sequência obrigatória de fases** que todo processo executado por qualquer módulo deve percorrer. Não existe operação válida no sistema Aries que não passe por todas as oito fases — a execução pode ser instantânea em algumas fases, mas nenhuma pode ser ignorada.

O COU é implementado sobre a Engine de Execução de Processos (ENG-01) e opera em conjunto com as demais engines da infraestrutura compartilhada.

## 1.2 Visão Geral do Ciclo

```
┌─────────────────────────────────────────────────────────────────┐
│                  CICLO OPERACIONAL UNIVERSAL                     │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  FASE 1  │   │  FASE 2  │   │  FASE 3  │   │  FASE 4  │    │
│  │ ENTRADA  │──►│VALIDAÇÃO │──►│EXECUÇÃO  │──►│ CONTROLE │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
│                                                       │          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────▼────┐    │
│  │  FASE 8  │   │  FASE 7  │   │  FASE 6  │   │  FASE 5  │    │
│  │RETROALI- │◄──│APRENDIZA-│◄──│CORREÇÃO  │◄──│AUDITORIA │    │
│  │MENTAÇÃO  │   │   DO     │   │          │   │          │    │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
│       │                                                          │
│       └─────────────────────────────────────────────────────►  │
│                     (inicia novo ciclo)                          │
└─────────────────────────────────────────────────────────────────┘
```

## 1.3 Fase 1 — ENTRADA

**Definição:** Recepção e registro formal de qualquer estímulo que inicia uma instância de processo. Toda operação começa com um evento de entrada documentado.

**Fontes de Entrada:**

| Tipo | Descrição | Exemplo |
|---|---|---|
| **Evento de sistema** | Publicado no barramento por outro módulo ou engine | `demanda.lead.qualificado_sql` |
| **Evento de tempo** | Disparado pelo Scheduler em periodicidade definida | `sistema.periodo.encerrado` |
| **Evento humano** | Ação manual registrada por operador autorizado | Aprovação de desconto |
| **Evento externo** | Webhook recebido de sistema externo via ENG-08 | Pagamento confirmado em gateway |
| **Evento de limiar** | KPI cruzou limiar configurado (ENG-02/ENG-03) | Win rate abaixo de 50% |

**Regras obrigatórias da Fase 1:**

- **E-R01:** Todo evento de entrada deve ter `event_id` único e ser registrado no log de auditoria (ENG-06) antes de qualquer processamento.
- **E-R02:** Deduplicação obrigatória por `event_id`. Evento já processado é descartado silenciosamente.
- **E-R03:** O timestamp de recebimento é imutável após registro. Não pode ser retroativamente alterado.
- **E-R04:** Toda entrada deve ter um responsável associado — humano (user_id) ou sistema (engine_id/module_id).
- **E-R05:** Entradas de origem humana requerem autenticação do operador.

**Saídas da Fase 1:**
- Registro de entrada no log (ENG-06)
- Instância de processo criada (ENG-01)
- `event_id` de rastreamento gerado
- `correlacao_id` propagado para toda a cadeia

**SLA de processamento:** < 500ms para registro e criação da instância.

---

## 1.4 Fase 2 — VALIDAÇÃO

**Definição:** Verificação de que o evento de entrada atende a todos os pré-requisitos para execução. A validação acontece **antes** de qualquer ação sobre o processo de negócio.

**Categorias de Validação:**

| Categoria | O que verifica | Falha resulta em |
|---|---|---|
| **Completude** | Todos os campos obrigatórios presentes no payload | Rejeição com código de erro estruturado |
| **Consistência** | Valores dentro dos domínios aceitos e relacionamentos válidos | Rejeição com campo específico identificado |
| **Autorização** | O ator tem permissão para disparar esta operação | Rejeição com log de tentativa |
| **Contexto** | O sistema está no estado correto para receber esta entrada | Enfileiramento ou rejeição com motivo |
| **Unicidade** | A operação não é duplicada ou conflitante com operações ativas | Fusão ou rejeição controlada |

**Estrutura de resultado de validação:**

```yaml
validacao_resultado:
  status: APROVADO | REJEITADO | ENFILEIRADO
  timestamp: ISO 8601
  validacoes:
    - tipo: COMPLETUDE
      resultado: APROVADO | FALHOU
      campo_afetado: null | "nome_do_campo"
      motivo: null | "descrição do problema"
  acao: PROSSEGUIR | REJEITAR | ENFILEIRAR | ESCALAR
  codigo_rejeicao: null | "VAL-[MODULO]-[CODIGO]"
```

**Regras obrigatórias da Fase 2:**

- **V-R01:** Validação é sempre executada pelo sistema — nunca delegada a julgamento humano para decisão binária. Humanos definem regras; o sistema aplica.
- **V-R02:** Toda rejeição gera log auditável com motivo estruturado. "Não passou na validação" não é motivo aceito.
- **V-R03:** Rejeições não interrompem a operação do sistema — geram evento `processo.validacao.rejeitada` consumível por outros módulos.
- **V-R04:** O sistema não executa validações parciais. Ou valida tudo e aprova, ou identifica todos os problemas e rejeita completamente.

---

## 1.5 Fase 3 — EXECUÇÃO

**Definição:** Realização das atividades de negócio do processo. É a única fase onde o trabalho real acontece. Toda execução deve ser rastreável, atômica onde possível, e idempotente.

**Princípios de Execução:**

| Princípio | Definição |
|---|---|
| **Atomicidade** | Operações que não podem ser parcialmente concluídas devem ser revertidas completamente em caso de falha |
| **Idempotência** | Executar a mesma operação duas vezes deve produzir o mesmo resultado que executar uma vez |
| **Rastreabilidade** | Cada ação executada gera um registro imutável com: o quê, quem, quando, por quê |
| **Determinismo** | Dados iguais + regras iguais = resultado igual, independente de quem executa |
| **Isolamento** | A execução de um processo não interfere com a execução de outro processo paralelo |

**Estrutura de registro de execução:**

```yaml
execucao_registro:
  instancia_id: UUID
  processo_id: string
  modulo_id: string
  fase: EXECUCAO
  timestamp_inicio: ISO 8601
  timestamp_fim: ISO 8601
  ator:
    tipo: HUMANO | SISTEMA | AUTOMACAO
    id: user_id | engine_id | automation_id
  acoes_executadas:
    - id: UUID
      descricao: string
      timestamp: ISO 8601
      resultado: SUCESSO | FALHOU | PARCIAL
      dados_entrada: object
      dados_saida: object
  status_final: CONCLUIDO | FALHOU | PARCIALMENTE_CONCLUIDO
  eventos_publicados: [event_id, ...]
```

**Tratamento de falha em execução:**

```
Falha detectada em ação
    │
    ├─► Falha recuperável?
    │       ├─► SIM: Retry com backoff exponencial (máx 3 tentativas)
    │       │        └─► Sucesso → continua execução
    │       │            Falha → promover para falha definitiva
    │       └─► NÃO: Falha definitiva imediata
    │
    └─► Falha definitiva:
            ├─► Registrar em ENG-06
            ├─► Publicar evento de falha no barramento
            ├─► Notificar responsável via ENG-03
            └─► Instância permanece em FALHOU (não cancela automaticamente)
```

---

## 1.6 Fase 4 — CONTROLE

**Definição:** Verificação contínua de que a execução está produzindo os resultados esperados dentro dos parâmetros de tempo, qualidade e conformidade. O controle é exercido pela Engine de KPIs (ENG-02) e Engine de Alertas (ENG-03).

**O que é controlado:**

| Dimensão | Mecanismo | Frequência |
|---|---|---|
| **Tempo** | SLA de cada etapa monitorado por ENG-01 | Contínuo |
| **Qualidade** | KPIs de resultado calculados por ENG-02 | Conforme definição do KPI |
| **Conformidade** | Adherência a regras de negócio verificada por ENG-06 | Por transação |
| **Recursos** | Capacidade e utilização monitoradas pelo módulo de equipe | Semanal |
| **Dependências** | Saúde dos conectores externos monitorada por ENG-08 | Por uso + health check |

**Níveis de controle:**

```yaml
controle_niveis:
  PREVENTIVO:
    descricao: "Detecta condições que podem levar a desvio antes que ele ocorra"
    exemplo: "Pipeline coverage caindo — ainda acima do mínimo mas em tendência"
    acao: "Alerta de atenção; nenhuma ação obrigatória imediata"
    
  DETECTIVO:
    descricao: "Identifica desvio no momento em que ocorre"
    exemplo: "KPI cruzou limiar configurado"
    acao: "Alerta emitido; máquina de decisão ativada (ver FOB-02)"
    
  CORRETIVO:
    descricao: "Aciona resposta após desvio confirmado"
    exemplo: "Plano de ação criado, workflow de aprovação ativado"
    acao: "Instância de plano de ação criada em ENG-05"
```

---

## 1.7 Fase 5 — AUDITORIA

**Definição:** Registro imutável e verificação estruturada de conformidade do processo executado. A auditoria é retroativa (verifica o que aconteceu) e prospectiva (alimenta o ciclo de melhoria).

**O que é auditado automaticamente:**

- Completude: todas as etapas obrigatórias foram executadas?
- Conformidade: todas as regras de negócio foram respeitadas?
- Tempestividade: SLAs foram cumpridos?
- Autorização: todas as ações foram autorizadas pelo papel correto?
- Rastreabilidade: toda ação tem ator, timestamp e evidência?

**Resultado da auditoria:**

```yaml
auditoria_resultado:
  instancia_id: UUID
  processo_id: string
  periodo: string
  conformidade_percentual: float  # 0.0 a 100.0
  status: CONFORME | NAO_CONFORME | PARCIALMENTE_CONFORME
  nao_conformidades:
    - id: "NC-[MODULO]-[YYYYMM]-[SEQ]"
      descricao: string
      severidade: BAIXA | MEDIA | ALTA | CRITICA
      regra_violada: string
      evidencia: string
      responsavel_resolucao: string
      prazo_resolucao: ISO 8601
  acoes_decorrentes:
    - tipo: ALERTA | PLANO_ACAO | ESCALAMENTO | REGISTRO
      descricao: string
```

---

## 1.8 Fase 6 — CORREÇÃO

**Definição:** Resposta estruturada a qualquer desvio identificado nas fases de Controle ou Auditoria. Toda correção segue o Sistema Universal de Planos de Ação (FOB-05).

**Princípio fundamental:** Correção sem identificação de causa raiz é supressão de sintoma. O sistema exige diagnóstico antes de ação.

**Fluxo de correção:**

```
Desvio confirmado
    │
    ▼
Diagnóstico (ENG-04)
    │
    ├─► Causa raiz identificada?
    │       ├─► SIM → Criar plano de ação com causa confirmada
    │       └─► NÃO → Criar plano provisório + continuar investigação
    │
    ▼
Plano de ação criado (ENG-05)
    │
    ├─► Prioridade CRÍTICA → Execução imediata (SLA: 24h)
    ├─► Prioridade ALTA → Execução em até 72h
    ├─► Prioridade MÉDIA → Execução em até 7 dias
    └─► Prioridade BAIXA → Backlog; executar no próximo ciclo
```

**Tipos de correção:**

| Tipo | Escopo | Quando usar |
|---|---|---|
| **Pontual** | Corrige a instância específica | Problema isolado, não sistêmico |
| **Preventiva** | Evita que o problema ocorra novamente | Causa raiz identificada |
| **Sistêmica** | Altera processo, regra ou configuração | Problema recorrente ou estrutural |
| **Emergencial** | Ação imediata sem diagnóstico completo | Risco imediato de operação |

---

## 1.9 Fase 7 — APRENDIZADO

**Definição:** Extração e estruturação de conhecimento a partir de cada ciclo executado — tanto bem-sucedido quanto com falhas. O aprendizado alimenta a Engine de IA e Base de Conhecimento (ENG-10) e a Engine de Melhoria Contínua (ENG-09).

**O que é aprendido:**

| Fonte | Aprendizado gerado |
|---|---|
| Processo concluído com sucesso | Benchmark de tempo, qualidade e padrão de execução |
| Processo com não-conformidade | Causa raiz, intervenção eficaz, prevenção futura |
| Plano de ação eficaz | Template de solução para o tipo de problema |
| Plano de ação ineficaz | O que não funciona; hipóteses descartadas |
| Decisão de alto impacto | Contexto, alternativas, resultado — para decisões similares futuras |

**Estrutura do registro de aprendizado:**

```yaml
aprendizado_registro:
  id: UUID
  origem:
    tipo: SUCESSO | FALHA | CORRECAO | DECISAO
    instancia_ref: UUID
  conhecimento_extraido:
    descricao: string
    padrao_identificado: boolean
    frequencia_ocorrencias: integer
    confianca: BAIXA | MEDIA | ALTA
  acoes_geradas:
    - tipo: ATUALIZAR_BLUEPRINT | ATUALIZAR_KPI | NOVO_ALERTA | TREINAMENTO | MELHORIA
      descricao: string
  indexado_em_eng10: boolean
  data_indexacao: ISO 8601
```

---

## 1.10 Fase 8 — RETROALIMENTAÇÃO

**Definição:** Publicação dos resultados do ciclo para todos os consumidores relevantes, fechando o loop e iniciando o próximo ciclo com informação atualizada.

**O que é retroalimentado:**

| Destino | Informação | Mecanismo |
|---|---|---|
| Módulos upstream | Resultado do processo que dependia de sua saída | Evento no barramento |
| ENG-02 | KPIs recalculados com dados do ciclo concluído | Evento `kpi.valor.calculado` |
| ENG-09 | Items de melhoria identificados | Evento `melhoria.item.identificado` |
| ENG-10 | Conhecimento indexado | Evento `ia.conhecimento.indexado` |
| CAP-08 | Métricas de performance do período | Evento `kpi.valor.calculado` |
| Equipe responsável | Relatório de ciclo concluído | Via ENG-03 (notificação) |

**Regra de encerramento:** Um ciclo só é considerado encerrado quando:
1. Todos os eventos de retroalimentação foram publicados e confirmados
2. O registro de aprendizado foi indexado em ENG-10
3. O log de auditoria foi finalizado (ENG-06)
4. A instância de processo foi marcada como `CONCLUIDA` em ENG-01

---

# FOB-02 — Máquina de Decisão Universal

## 2.1 Definição

A Máquina de Decisão (MD) é o conjunto de regras, critérios e fluxos que determinam **qual ação o sistema toma diante de qualquer situação de desvio**. A MD opera sobre fatos (dados mensuráveis), não sobre percepções.

**Princípio fundamental:** O sistema deve ser capaz de tomar 90% das decisões operacionais sem intervenção humana. Humanos tomam decisões estratégicas e de alta consequência. O sistema executa o restante.

## 2.2 Taxonomia de Decisões

| Nível | Tipo | Quem decide | Registro obrigatório | Exemplos |
|---|---|---|---|---|
| **D0 — Automática** | Sistema decide e executa sem intervenção | Sistema | Não (somente log) | Cálculo de KPI, geração de alerta, enriquecimento de lead |
| **D1 — Operacional** | Responsável operacional decide dentro de parâmetros | Executor do processo | Não (somente log) | Priorizar uma oportunidade, agendar uma reunião |
| **D2 — Tática** | Gestor decide; afeta mais de um processo ou período | Gestor da área | Sim — DECISION_LOG | Alterar meta do período, aprovar exceção de desconto |
| **D3 — Estratégica** | Diretoria decide; afeta estrutura ou direção | Diretoria | Sim — DECISION_LOG + rationale | Mudar ICP, alterar política de precificação, expansão de canal |
| **D4 — Fundacional** | Altera o próprio framework ou arquitetura | Guardião + aprovação formal | Sim — DECISION_LOG + RFC + aprovação | Modificar este documento, adicionar engine, alterar evento do barramento |

## 2.3 Fluxo Universal de Decisão por Desvio

Toda decisão originada por desvio de KPI ou não-conformidade percorre o seguinte fluxo:

```
┌─────────────────────────────────────────────────────────────────┐
│                   FLUXO DE DECISÃO POR DESVIO                   │
└─────────────────────────────────────────────────────────────────┘

[1] DETECÇÃO
    ENG-02 detecta KPI fora do limiar OU ENG-06 detecta NC
    → Evento publicado no barramento
    → ENG-03 cria alerta

[2] CLASSIFICAÇÃO DE GRAVIDADE
    ┌─────────────────────────────────────────────────────────┐
    │  Desvio < 10% da meta → INFORMATIVO (sem ação imediata) │
    │  Desvio 10-25% da meta → ATENÇÃO (ação em 72h)          │
    │  Desvio 25-50% da meta → CRÍTICO (ação em 24h)          │
    │  Desvio > 50% da meta → EMERGENCIAL (ação em 4h)        │
    │  Ou: NC de severidade ALTA ou CRÍTICA → CRÍTICO          │
    └─────────────────────────────────────────────────────────┘

[3] IDENTIFICAÇÃO DE CAUSA
    ENG-04 abre sessão de diagnóstico automático
    ENG-10 busca casos similares na base de conhecimento
    └─► Hipóteses geradas com grau de confiança

[4] CLASSIFICAÇÃO DE RESPONSÁVEL
    ┌─────────────────────────────────────────────────────────┐
    │  Causa operacional → Responsável do processo            │
    │  Causa de capacidade → Gestor de área                   │
    │  Causa estrutural → Diretoria                           │
    │  Causa de sistema → Guardião Técnico                    │
    └─────────────────────────────────────────────────────────┘

[5] DEFINIÇÃO DE PRIORIDADE
    Matriz: Impacto (financeiro + estratégico) × Urgência (tempo disponível)
    ┌──────────────┬────────────┬────────────┐
    │              │ ALTO IMPACTO│ BAIXO IMPACTO│
    ├──────────────┼────────────┼────────────┤
    │ ALTA URGÊNCIA│ P1 — Agir  │ P2 — Agir  │
    │              │ agora       │ hoje        │
    ├──────────────┼────────────┼────────────┤
    │ BAIXA URGÊNCIA│ P2 — Agir │ P4 — Back- │
    │              │ esta semana │ log         │
    └──────────────┴────────────┴────────────┘

[6] CRIAÇÃO DE PLANO DE AÇÃO (ENG-05)
    Plano com causa raiz, objetivo, ações, responsável, prazo, indicador
    → Template sugerido por ENG-10 (casos similares)

[7] APROVAÇÃO DO PLANO
    D0-D1: Sistema aprova automaticamente
    D2: Gestor aprova em até 24h (ENG-07 gerencia workflow)
    D3: Diretoria aprova em até 48h

[8] EXECUÇÃO DO PLANO
    ENG-01 gerencia instância de execução
    ENG-08 executa automações
    ENG-03 monitora prazos

[9] VERIFICAÇÃO DE RESULTADO
    ENG-02 monitora KPI alvo por período configurado
    ├─► KPI normalizado → Verificação eficaz → Encerrar incidente
    └─► KPI não normalizado → Verificação ineficaz → Reabrir diagnóstico

[10] ENCERRAMENTO OU REABERTURA
    Eficaz: Encerrar alerta; indexar aprendizado em ENG-10; registrar em ENG-09
    Ineficaz: Reabrir sessão de diagnóstico com hipóteses descartadas documentadas
```

## 2.4 Matriz de Escalonamento

| Nível de Alerta | SLA sem resposta | Escalonamento automático para |
|---|---|---|
| INFORMATIVO | 48h | Sem escalonamento |
| ATENÇÃO | 24h | Gestor direto notificado |
| CRÍTICO | 4h | Gestor + Diretoria notificados |
| EMERGENCIAL | 1h | Diretoria + todos os responsáveis + abertura imediata de war room |

## 2.5 DECISION_LOG

Todo registro de DECISION_LOG (obrigatório para D2 ou superior) deve conter:

```yaml
decision_log_entry:
  id: "DEC-[ANO]-[TRIMESTRE]-[SEQ]"
  data: ISO 8601
  nivel: D2 | D3 | D4
  decisor:
    nome: string
    papel: string
    modulo: string
  contexto:
    situacao: string  # O que estava acontecendo
    gatilho: string  # O que disparou a necessidade de decisão
    dados_analisados: [string]  # Quais KPIs/relatórios foram considerados
  alternativas_consideradas:
    - opcao: string
      pros: [string]
      contras: [string]
      descartada_por: string | null
  decisao_tomada:
    descricao: string
    justificativa: string
    impacto_esperado: string
    modulos_afetados: [string]
  implementacao:
    responsavel: string
    prazo: ISO 8601
    status: PENDENTE | EM_EXECUCAO | CONCLUIDA
  resultado:
    avaliado_em: ISO 8601
    outcome: string
    aprendizado: string
```

---

# FOB-03 — Sistema Universal de KPIs

## 3.1 Definição

Todo indicador de desempenho utilizado em qualquer módulo do sistema Aries deve ser modelado conforme o padrão definido nesta seção. Nenhum KPI informal, subjetivo ou não modelado é reconhecido pelo sistema.

**Princípio:** Um KPI é uma pergunta que o sistema responde com um número. Se o número não puder ser calculado automaticamente, a definição do KPI está incompleta.

## 3.2 Template Universal de KPI

```yaml
kpi_definicao:
  # IDENTIFICAÇÃO
  id: "KPI-[MODULO]-[SEQ]"    # Ex: KPI-VP-01
  nome: string                  # Nome curto, objetivo
  objetivo: string              # Para que serve este KPI? O que ele mede?
  
  # FÓRMULA E CÁLCULO
  formula: string               # Fórmula matemática ou pseudocódigo
  unidade: PERCENTUAL | MOEDA | QUANTIDADE | TEMPO | RATIO | SCORE | BOOLEAN
  como_calcular: string         # Passo a passo detalhado do cálculo
  fonte_dados:
    primaria: string            # Sistema/módulo onde os dados residem
    secundaria: string | null   # Fonte alternativa ou de validação
    conector: string | null     # Conector ENG-08 se dado é externo
  
  # FREQUÊNCIA
  frequencia_calculo: TEMPO_REAL | DIARIA | SEMANAL | MENSAL | TRIMESTRAL | ANUAL
  janela_calculo: string        # Ex: "últimos 30 dias", "mês corrente", "trimestre fiscal"
  
  # METAS E LIMIARES
  meta:
    valor: number | string      # Meta absoluta ou relativa
    tipo: ABSOLUTO | PERCENTUAL | TENDENCIA
    vigencia: string            # Período de validade da meta
    aprovado_por: string        # Papel que aprovou a meta
  limiar_atencao:
    valor: number
    descricao: "Valor que, se atingido, dispara alerta de ATENÇÃO"
  limiar_critico:
    valor: number
    descricao: "Valor que, se atingido, dispara alerta CRÍTICO"
  
  # RESPONSABILIDADE
  dono: string                  # Papel que é responsável pelo valor do KPI
  executor_calculo: "ENG-02"   # Sempre ENG-02 — nunca manual
  
  # INTERPRETAÇÃO
  direcao_positiva: CRESCENTE | DECRESCENTE
  como_interpretar:
    acima_da_meta: string       # O que significa estar acima da meta?
    abaixo_do_limiar_atencao: string
    abaixo_do_limiar_critico: string
  
  # DECISÕES E AÇÕES
  decisoes_dispara:
    - condicao: string
      decisao: string
      nivel: D0 | D1 | D2 | D3
  alertas_gera:
    - condicao: string
      alerta_id: string
      severidade: INFORMATIVO | ATENCAO | CRITICO | EMERGENCIAL
  planos_acao_aciona:
    - condicao: string
      template_plano: string
  
  # RELACIONAMENTOS
  kpis_relacionados: [string]   # KPIs causalmente relacionados
  modulos_que_influenciam: [string]
  modulos_influenciados: [string]
  
  # HISTÓRICO E VERSÃO
  versao_definicao: "SemVer"
  criado_em: ISO 8601
  ultima_revisao: ISO 8601
  historico_metas: []           # Registro imutável de todas as metas anteriores
```

## 3.3 Taxonomia de KPIs

**Por tipo de medição:**

| Tipo | Definição | Latência | Exemplo |
|---|---|---|---|
| **Leading (preditivo)** | Mede atividade que antecipa resultado futuro | Baixa | Volume de leads gerados |
| **Lagging (resultante)** | Mede resultado de ações passadas | Alta | Receita fechada no mês |
| **Coincident** | Mede o estado atual em tempo real | Zero | Health score do cliente hoje |

**Por dimensão:**

| Dimensão | O que mede | Exemplo |
|---|---|---|
| **Eficiência** | Output por unidade de input | Leads por real investido |
| **Eficácia** | Grau de atingimento do objetivo | Taxa de conversão |
| **Qualidade** | Aderência ao padrão esperado | % de processos sem NC |
| **Velocidade** | Tempo de execução | Ciclo médio de venda |
| **Capacidade** | Potencial disponível vs. utilizado | % de utilização do time |
| **Saúde** | Estado geral de um sistema | Health Score de clientes |

## 3.4 Ciclo de Vida de um KPI

```
PROPOSTO → REVISÃO → APROVADO → ATIVO → SUSPENSO → DESCONTINUADO
```

- **PROPOSTO:** Definição rascunhada, aguardando revisão formal
- **REVISÃO:** Em análise pelo guardião de arquitetura e módulo dono
- **APROVADO:** Definição validada; aguardando implementação em ENG-02
- **ATIVO:** Em cálculo regular pelo ENG-02
- **SUSPENSO:** Temporariamente pausado (ex: mudança estrutural no negócio)
- **DESCONTINUADO:** Permanentemente removido; histórico preservado imutavelmente

## 3.5 Imutabilidade e Auditoria de KPIs

- Valores históricos de KPI são **imutáveis** — nunca sobrescritos
- Correções criam novos registros com justificativa (event: `kpi.valor.corrigido`)
- Alterações de meta geram novo registro com vigência; meta anterior permanece no histórico
- Todo KPI tem trilha de auditoria completa acessível via ENG-06

---

# FOB-04 — Sistema Universal de Alertas

## 4.1 Definição

O Sistema Universal de Alertas é a arquitetura que garante que **nenhum desvio relevante passe despercebido**, que cada desvio seja comunicado à pessoa certa com a urgência correta, e que o sistema acompanhe a resolução de cada alerta até o encerramento.

## 4.2 Classificação em Quatro Níveis

### NÍVEL 1 — INFORMATIVO

| Atributo | Especificação |
|---|---|
| **Definição** | Condição que merece atenção mas não requer ação imediata |
| **Critério de disparo** | KPI em tendência de piora mas ainda dentro da meta; processo com desempenho levemente abaixo do benchmark |
| **Quem recebe** | Responsável operacional do processo |
| **Canal** | Dashboard (visível na próxima consulta) |
| **Prazo de resposta** | 48 horas |
| **Ação esperada** | Monitorar; documentar observação |
| **Escalonamento** | Não há escalonamento automático |
| **Encerramento** | Automático: KPI normaliza OU manual: responsável marca como "ciente" |
| **Supressão** | Mesmo alerta repetido em < 24h é suprimido (deduplicação) |

### NÍVEL 2 — ATENÇÃO

| Atributo | Especificação |
|---|---|
| **Definição** | Desvio confirmado que requer análise e plano de ação dentro do prazo |
| **Critério de disparo** | KPI cruzou limiar de atenção; NC de severidade MÉDIA detectada; SLA de processo em risco |
| **Quem recebe** | Responsável operacional + Gestor direto |
| **Canal** | Dashboard + notificação push (mensageria) |
| **Prazo de resposta** | 24 horas para reconhecimento; 72 horas para plano de ação |
| **Ação esperada** | Reconhecer; diagnosticar causa; criar plano de ação |
| **Escalonamento** | Sem reconhecimento em 24h → notificar Gestor + aumentar para CRÍTICO |
| **Encerramento** | KPI normaliza E plano de ação concluído com verificação eficaz |
| **Supressão** | Não suprimido; máximo 1 alerta ativo por KPI/processo |

### NÍVEL 3 — CRÍTICO

| Atributo | Especificação |
|---|---|
| **Definição** | Desvio severo com impacto material imediato na operação ou resultado |
| **Critério de disparo** | KPI cruzou limiar crítico; NC de severidade ALTA; falha sistêmica em processo core; inadimplência crítica |
| **Quem recebe** | Responsável + Gestor + Diretoria (simultâneo) |
| **Canal** | Dashboard + push + SMS/ligação para o responsável |
| **Prazo de resposta** | 4 horas para resposta; 24 horas para plano de ação e primeira ação corretiva |
| **Ação esperada** | Resposta imediata; diagnóstico urgente; plano de ação P1 |
| **Escalonamento** | Sem resposta em 4h → escalonamento automático para próximo nível hierárquico; repetição a cada 2h |
| **Encerramento** | Somente com evidência documentada de resolução + verificação de KPI por período mínimo |
| **Supressão** | Nunca suprimido automaticamente |

### NÍVEL 4 — EMERGENCIAL

| Atributo | Especificação |
|---|---|
| **Definição** | Situação que ameaça a continuidade operacional ou envolve risco financeiro ou reputacional grave |
| **Critério de disparo** | Desvio > 50% da meta; NC CRÍTICA; falha em sistema crítico; churn em massa detectado |
| **Quem recebe** | Toda a cadeia de gestão (operação → gestão → diretoria) + notificação simultânea |
| **Canal** | Todos os canais disponíveis; escalação imediata |
| **Prazo de resposta** | 1 hora para comando de resposta; ação imediata |
| **Ação esperada** | Ativação de protocolo de resposta; designação de responsável sênior; comunicação a stakeholders |
| **Escalonamento** | Contínuo a cada 30 minutos até reconhecimento de diretoria |
| **Encerramento** | Aprovação formal da diretoria + relatório de ocorrência + plano de prevenção |
| **Supressão** | Nunca suprimido |

## 4.3 Estrutura do Alerta

```yaml
alerta:
  id: "ALT-[MODULO]-[SEQ]-[YYYYMM]"
  nome: string
  nivel: INFORMATIVO | ATENCAO | CRITICO | EMERGENCIAL
  status: ABERTO | RECONHECIDO | EM_TRATAMENTO | RESOLVIDO | SUPRIMIDO
  
  gatilho:
    tipo: KPI_LIMIAR | NC_DETECTADA | SLA_VIOLADO | ANOMALIA | MANUAL
    referencia_id: string       # KPI_id, NC_id, etc.
    valor_gatilho: number | string
    limiar_configurado: number | string
    
  timestamps:
    criado_em: ISO 8601
    reconhecido_em: ISO 8601 | null
    tratamento_iniciado: ISO 8601 | null
    resolvido_em: ISO 8601 | null
    prazo_resposta: ISO 8601
    
  destinatarios:
    - papel: string
      notificado_em: ISO 8601
      canal: DASHBOARD | MENSAGERIA | EMAIL | SMS
      reconhecido: boolean
      
  historico_escalonamentos:
    - nivel_anterior: string
      nivel_novo: string
      motivo: "SLA_VIOLADO"
      timestamp: ISO 8601
      
  resolucao:
    plano_acao_id: string | null
    evidencia: string | null
    resolvido_por: string
    verificacao_kpi: EFICAZ | INEFICAZ | PENDENTE
```

## 4.4 Regras de Operação do Sistema de Alertas

- **ALT-R01:** Nenhum alerta pode ser encerrado sem evidência documentada de resolução.
- **ALT-R02:** Alerta CRÍTICO ou EMERGENCIAL não encerrado em 7 dias escala automaticamente para revisão de diretoria.
- **ALT-R03:** Recorrência do mesmo alerta (≥ 3× em 90 dias) dispara automaticamente item no backlog de melhoria contínua (ENG-09).
- **ALT-R04:** Supressão de alerta só é válida para o nível INFORMATIVO e por deduplicação (mesmo `event_id` ou mesmo desvio dentro da janela de supressão).
- **ALT-R05:** O canal de alerta nunca substitui a comunicação direta em situações emergenciais — o sistema garante notificação mas não substitui a responsabilidade humana de verificação.

---

# FOB-05 — Sistema Universal de Planos de Ação

## 5.1 Definição

O Plano de Ação é a resposta estruturada do sistema a qualquer problema identificado. Todo desvio de nível ATENÇÃO ou superior deve gerar um plano formal. Ações informais, verbais ou não registradas no sistema não são reconhecidas como planos de ação válidos.

## 5.2 Estrutura Universal do Plano de Ação

```yaml
plano_acao:
  # CABEÇALHO
  id: "PA-[MODULO]-[YYYYMM]-[SEQ]"
  titulo: string
  versao: "SemVer"
  status: RASCUNHO | APROVADO | EM_EXECUCAO | CONCLUIDO | ENCERRADO | CANCELADO
  prioridade: P1 | P2 | P3 | P4
  
  # ORIGEM
  origem:
    tipo: ALERTA | AUDITORIA | REVISAO_GESTAO | MELHORIA_CONTINUA | INICIATIVA
    referencia_id: string       # ID do alerta, NC, etc.
    modulo: string
    
  # DIAGNÓSTICO
  problema:
    descricao: string           # O que está acontecendo (fatos, não opiniões)
    evidencias: [string]        # KPIs, logs, capturas que comprovam o problema
    impacto_atual: string       # Consequência mensurável já observada
    impacto_potencial: string   # Consequência se não tratado
    
  causa_raiz:
    identificada: boolean
    descricao: string | null
    metodo_diagnostico: "5_PORQUES" | "ISHIKAWA" | "PARETO" | "ENG04_AUTOMATICO" | "HIPOTESE"
    confianca: BAIXA | MEDIA | ALTA
    
  # OBJETIVO
  objetivo:
    descricao: string           # O que o plano precisa atingir
    kpi_alvo_id: string         # KPI que será monitorado como indicador de sucesso
    meta_resultado: number      # Valor alvo do KPI ao final do plano
    prazo_atingimento: ISO 8601
    
  # AÇÕES
  acoes:
    - id: "ACA-[SEQ]"
      descricao: string
      tipo: CORRETIVA | PREVENTIVA | MELHORIA | TREINAMENTO | COMUNICACAO
      responsavel: string       # Papel específico, não "equipe"
      executor: string | null   # Se diferente do responsável
      prazo: ISO 8601
      dependencias: [string]    # IDs de ações que devem ser concluídas antes
      status: PENDENTE | EM_EXECUCAO | CONCLUIDA | BLOQUEADA | CANCELADA
      evidencia_conclusao: string | null
      
  # APROVAÇÃO
  aprovacao:
    nivel_requerido: D0 | D1 | D2 | D3
    aprovador: string | null
    aprovado_em: ISO 8601 | null
    
  # VERIFICAÇÃO DE EFICÁCIA
  verificacao:
    periodo_monitoramento_dias: integer   # Quantos dias monitorar após conclusão
    criterio_sucesso: string              # Como saber que funcionou
    kpi_verificacao:
      id: string
      valor_antes: number
      valor_esperado: number
      valor_apos: number | null
    resultado: PENDENTE | EFICAZ | INEFICAZ | PARCIALMENTE_EFICAZ
    avaliado_em: ISO 8601 | null
    
  # ENCERRAMENTO
  encerramento:
    status_final: SUCESSO | SUCESSO_PARCIAL | FALHA | CANCELADO
    aprendizado: string
    indexado_eng10: boolean
    
  # RASTREABILIDADE
  criado_por: string
  criado_em: ISO 8601
  ultima_atualizacao: ISO 8601
  historico_revisoes: []
```

## 5.3 Prioridades e SLAs de Planos de Ação

| Prioridade | Critério | SLA de criação do plano | SLA de aprovação | SLA de primeira ação |
|---|---|---|---|---|
| **P1 — Imediata** | Alerta EMERGENCIAL; impacto operacional imediato | 2 horas | 1 hora | 4 horas |
| **P2 — Urgente** | Alerta CRÍTICO; desvio > 25% da meta | 4 horas | 4 horas | 24 horas |
| **P3 — Necessária** | Alerta ATENÇÃO; desvio 10-25% da meta | 24 horas | 24 horas | 72 horas |
| **P4 — Backlog** | Alerta INFORMATIVO; NC de baixa severidade | Próximo rito | Próximo rito | Próximo sprint |

## 5.4 Regras do Sistema de Planos de Ação

- **PA-R01:** Todo plano deve ter um único responsável final — nunca "equipe" como responsável.
- **PA-R02:** Ações sem prazo definido são inválidas e não são aceitas pelo sistema.
- **PA-R03:** Plano concluído ≠ problema resolvido. A verificação de eficácia determina o encerramento.
- **PA-R04:** Plano ineficaz deve ser reaberto como nova instância (não reaproveita o ID anterior) com hipóteses descartadas documentadas.
- **PA-R05:** Nenhuma ação pode ser marcada como concluída sem evidência documentada.
- **PA-R06:** Plano com prazo vencido sem conclusão gera alerta automático para o gestor do responsável.
- **PA-R07:** Cancelamento de plano requer justificativa formal aprovada por D2 ou superior.

---

# FOB-06 — Sistema Universal de Auditoria

## 6.1 Definição

O Sistema Universal de Auditoria verifica, em três camadas complementares, se o sistema opera conforme suas regras, produz os resultados esperados e evolui na direção correta. Auditoria não é punição — é o mecanismo pelo qual o sistema mantém sua integridade ao longo do tempo.

## 6.2 Três Camadas de Auditoria

### CAMADA 1 — Auditoria Operacional

| Atributo | Especificação |
|---|---|
| **Objetivo** | Verificar se os processos do dia a dia estão sendo executados conforme definido — com completude, no prazo e com qualidade |
| **Periodicidade** | Contínua (automática por ENG-06) + consolidação mensal |
| **Executor** | ENG-06 (automático) + validação pelo responsável operacional |
| **Escopo** | Instâncias de processo; conformidade de exit criteria; aderência a SLAs; completude de registros |

**Checklist de Auditoria Operacional (universal — módulos podem adicionar itens):**

```yaml
checklist_operacional:
  completude_registros:
    - "Todas as instâncias de processo têm responsável designado"
    - "Todas as decisões D1+ têm registro (log de ação)"
    - "Todos os eventos publicados têm event_id único"
    - "Nenhum campo obrigatório em branco em registros ativos"
    
  conformidade_processo:
    - "Exit criteria verificados antes de todo avanço de etapa"
    - "SLAs de etapa monitorados e desvios alertados"
    - "Responsáveis notificados dentro do prazo definido"
    
  qualidade_dados:
    - "KPIs calculados no prazo definido para cada um"
    - "Fontes de dados disponíveis (health check de conectores)"
    - "Nenhum KPI com fonte de dados ausente por mais de 2 períodos"
    
  gestao_de_desvios:
    - "100% dos alertas CRÍTICOS respondidos no prazo"
    - "0 planos de ação vencidos sem justificativa formal"
    - "100% dos alertas têm status atualizado"
```

**Resultado esperado:** Índice de Conformidade Operacional (ICO) ≥ 95%.

**Ações decorrentes de ICO < 95%:** Alerta ATENÇÃO para gestor; diagnóstico obrigatório; plano de ação em 72h.

---

### CAMADA 2 — Auditoria Gerencial

| Atributo | Especificação |
|---|---|
| **Objetivo** | Avaliar se os módulos estão entregando resultados táticos esperados — KPIs dentro das metas, planos eficazes, decisões documentadas |
| **Periodicidade** | Mensal (consolidação) + análise trimestral profunda |
| **Executor** | Gestor de área + ENG-06 (relatório automatizado) |
| **Escopo** | KPIs de resultado por módulo; eficácia de planos de ação; qualidade de decisões D2; aderência ao programa de capacitação |

**Checklist de Auditoria Gerencial:**

```yaml
checklist_gerencial:
  performance_kpis:
    - "% de KPIs dentro da meta no período"
    - "Evolução trimestral de KPIs estratégicos"
    - "Alertas CRÍTICOS no período: contagem, tempo médio de resolução"
    - "Taxa de planos de ação eficazes vs. ineficazes"
    
  qualidade_decisoes:
    - "100% das decisões D2+ registradas no DECISION_LOG"
    - "Decisões com resultado avaliado dentro do prazo definido"
    - "Nenhuma decisão D2+ tomada sem dados (só percepção)"
    
  gestao_de_equipe:
    - "Cadências operacionais executadas conforme calendário"
    - "Capacitações obrigatórias em dia para todos os papéis"
    - "Planos de melhoria individual acompanhados"
    
  integridade_do_sistema:
    - "Nenhuma NC recorrente sem plano de eliminação"
    - "Blueprint de processos atualizado (máx. 90 dias sem revisão)"
    - "Conectores com health check verde nos últimos 30 dias"
```

**Resultado esperado:** Índice de Conformidade Gerencial (ICG) ≥ 90%.

**Ações decorrentes:** Relatório de auditoria gerencial ao comitê diretivo; planos de ação para módulos abaixo do índice mínimo.

---

### CAMADA 3 — Auditoria Estratégica

| Atributo | Especificação |
|---|---|
| **Objetivo** | Verificar se o sistema como um todo está evoluindo na direção estratégica — cumprindo OKRs, gerando valor, operando de forma sustentável |
| **Periodicidade** | Trimestral (QBR) + anual (revisão completa) |
| **Executor** | Diretoria + guardião de arquitetura + auditores externos (quando aplicável) |
| **Escopo** | OKRs trimestrais; métricas de saúde do negócio (LTV/CAC, NRR, Rule of 40); integridade arquitetural; alinhamento entre estratégia e execução |

**Checklist de Auditoria Estratégica:**

```yaml
checklist_estrategico:
  resultados_do_negocio:
    - "OKRs do trimestre: % atingidos vs. meta (target ≥ 70%)"
    - "MRR/ARR na tendência projetada"
    - "LTV/CAC dentro do benchmark (≥ 3×)"
    - "NRR acima de 100% (para modelos recorrentes)"
    
  saude_do_sistema:
    - "Framework Operacional Universal revisado e atualizado"
    - "Backlog de melhorias: items > 90 dias priorizados"
    - "Nenhuma NC de nível CRÍTICO sem resolução estrutural"
    - "Arquitetura de eventos sem eventos órfãos ou duplicados"
    
  evolucao_e_aprendizado:
    - "% de melhorias implementadas vs. identificadas no trimestre"
    - "Base de conhecimento (ENG-10): novos items indexados"
    - "Capacitações estratégicas realizadas"
    - "Lições aprendidas do trimestre documentadas"
    
  governanca:
    - "Todos os papéis RACI-T preenchidos e sem vacâncias > 30 dias"
    - "DECISION_LOG auditado: nenhuma decisão D3+ não documentada"
    - "Compliance: regulatório e contratual (se aplicável)"
```

**Resultado esperado:** Relatório de auditoria estratégica com score por dimensão; mínimo de 3 iniciativas de melhoria identificadas; aprovação formal dos OKRs do próximo trimestre.

---

# FOB-07 — Sistema Universal de Ritos de Gestão

## 7.1 Definição

Os Ritos de Gestão são as **cadências obrigatórias** de revisão, alinhamento e tomada de decisão. São chamados "ritos" porque sua execução não é opcional — a não-realização é uma não-conformidade auditável (ENG-06). Cada rito tem estrutura fixa, tempo definido, participantes obrigatórios, entradas e saídas.

**Princípio:** Um sistema que não revisa a si mesmo regularmente acumula desvios até que eles se tornem crises.

## 7.2 Estrutura Universal de Rito

Todo rito — independente da cadência — deve seguir a seguinte estrutura:

```yaml
rito_definicao:
  id: "RITO-[CADENCIA]-[MODULO_OU_SISTEMA]"
  nome: string
  cadencia: DIARIA | SEMANAL | MENSAL | TRIMESTRAL | ANUAL
  duracao_minutos: integer
  
  objetivo: string
  
  participantes:
    obrigatorios: [string]      # Papéis que DEVEM estar presentes
    opcionais: [string]         # Papéis convidados conforme contexto
    facilitador: string         # Quem conduz o rito
    registrador: string         # Quem documenta saídas
    
  entradas_obrigatorias:
    - nome: string
      fonte: string
      responsavel_preparacao: string
      prazo_preparacao: "X horas/dias antes do rito"
      
  agenda:
    - item: string
      objetivo: string
      tempo_minutos: integer
      tipo: REVISAO | DECISAO | ALINHAMENTO | IDENTIFICACAO
      
  kpis_analisados: [string]
  
  niveis_de_decisao_permitidos: [D0, D1, D2, D3]
  
  saidas_obrigatorias:
    - nome: string
      responsavel: string
      prazo: string             # "até o final do rito" ou "em X dias"
      formato: string
      
  registro:
    ata_obrigatoria: boolean
    template: string
    prazo_publicacao: "X horas após o rito"
    destinatarios: [string]
    
  conformidade:
    frequencia_minima: string   # "pelo menos 1× por semana" etc.
    tolerancia_cancelamento: string # "máximo 1 cancelamento consecutivo"
    nc_se_nao_realizado: INFORMATIVO | ATENCAO | CRITICO
```

## 7.3 Rito Diário — Pulso Operacional

| Campo | Especificação |
|---|---|
| **Objetivo** | Alinhar o time sobre o estado da operação e remover bloqueios do dia |
| **Duração** | 15 minutos (máximo absoluto) |
| **Cadência** | Todos os dias úteis, mesmo horário |
| **Participantes obrigatórios** | Toda a equipe operacional do módulo/área + gestor |
| **Facilitador** | Gestor ou delegado fixo |

**Agenda fixa (3 perguntas):**

| # | Pergunta | Tempo | Output esperado |
|---|---|---|---|
| 1 | O que foi concluído desde ontem? | 5 min | Lista de entregas do dia anterior |
| 2 | O que será concluído hoje? | 5 min | Compromissos do dia atual |
| 3 | Existe algum bloqueio ou risco? | 5 min | Impedimentos identificados e responsável designado |

**KPIs revisados:** Apenas indicadores de operação diária — SLA de resposta, atividades planejadas vs. executadas, bloqueios ativos.

**Decisões permitidas:** D0 e D1 apenas. Temas D2+ são agendados para rito semanal.

**Saídas obrigatórias:**
- Lista de comprometimentos do dia (publicada no canal de equipe)
- Bloqueios identificados com responsável para resolução

**Não-conformidade se não realizado:** ATENÇÃO após 2 falhas consecutivas.

---

## 7.4 Rito Semanal — Revisão de Pipeline e Performance

| Campo | Especificação |
|---|---|
| **Objetivo** | Revisar o andamento dos processos ativos, identificar desvios e tomar decisões táticas |
| **Duração** | 60 minutos |
| **Cadência** | 1× por semana, dia e horário fixos |
| **Participantes obrigatórios** | Equipe operacional + gestor + responsáveis por planos de ação ativos |
| **Facilitador** | Gestor |

**Agenda:**

| # | Item | Tempo | Tipo |
|---|---|---|---|
| 1 | Revisão do dashboard de KPIs da semana | 15 min | REVISÃO |
| 2 | Status de processos ativos e em risco | 15 min | REVISÃO |
| 3 | Alertas abertos e planos de ação em andamento | 15 min | REVISÃO + DECISÃO |
| 4 | Prioridades e comprometimentos da próxima semana | 10 min | ALINHAMENTO |
| 5 | Pontos de escalonamento ou necessidade de suporte | 5 min | IDENTIFICAÇÃO |

**Entradas obrigatórias (preparadas antes do rito):**
- Dashboard de KPIs da semana (ENG-02)
- Lista de alertas ativos (ENG-03)
- Status de todos os planos de ação em andamento (ENG-05)
- Agenda de SLAs vencendo na próxima semana

**Decisões permitidas:** D0, D1, D2.

**Saídas obrigatórias:**
- Ata com: KPIs revisados, decisões tomadas (com nível e responsável), próximos passos
- Planos de ação novos ou atualizados
- Itens escalados para o rito mensal

---

## 7.5 Rito Mensal — Revisão de Performance e Fechamento

| Campo | Especificação |
|---|---|
| **Objetivo** | Avaliar o fechamento do mês, revisar KPIs vs. metas, ajustar rumo se necessário e projetar o próximo mês |
| **Duração** | 120 minutos |
| **Cadência** | 1× por mês, entre o 3º e 5º dia útil do mês seguinte |
| **Participantes obrigatórios** | Gestor + equipe de liderança + Diretoria (informada) |
| **Facilitador** | Gestor + Diretoria alternando na facilitação |

**Agenda:**

| # | Item | Tempo | Tipo |
|---|---|---|---|
| 1 | Abertura: resultado do mês em 3 números | 5 min | REVISÃO |
| 2 | Dashboard completo de KPIs vs. metas | 20 min | REVISÃO |
| 3 | Análise de desvios: causas confirmadas e em investigação | 20 min | REVISÃO + DECISÃO |
| 4 | Planos de ação: eficácia dos concluídos, status dos ativos | 15 min | REVISÃO |
| 5 | Revisão de OKRs do trimestre: progresso | 15 min | REVISÃO |
| 6 | Decisões táticas necessárias para o próximo mês | 20 min | DECISÃO |
| 7 | Comprometimentos do próximo mês | 10 min | ALINHAMENTO |
| 8 | DECISION_LOG: decisões D2+ do mês | 5 min | REGISTRO |
| 9 | Encerramento e próximos passos | 10 min | ALINHAMENTO |

**KPIs revisados:** Todos os KPIs do módulo + KPIs estratégicos do CAP-08.

**Decisões permitidas:** D0, D1, D2, D3 (com quórum adequado).

**Saídas obrigatórias:**
- Relatório mensal publicado (event: `performance.relatorio_mensal`)
- DECISION_LOG atualizado para todas as decisões D2+
- Planos de ação aprovados para o próximo mês
- OKRs do trimestre: status atualizado

---

## 7.6 Rito Trimestral — QBR (Quarterly Business Review)

| Campo | Especificação |
|---|---|
| **Objetivo** | Retrospectiva completa do trimestre, avaliação de OKRs, definição de OKRs do próximo trimestre e alinhamento estratégico |
| **Duração** | 180 minutos (3 horas) |
| **Cadência** | 1× por trimestre, nos primeiros 10 dias úteis do trimestre seguinte |
| **Participantes obrigatórios** | Diretoria + todos os gestores + guardião de arquitetura |
| **Facilitador** | CEO ou responsável sênior designado |

**Agenda:**

| # | Item | Tempo | Tipo |
|---|---|---|---|
| 1 | Resultado do trimestre: onde chegamos vs. onde queríamos | 20 min | REVISÃO |
| 2 | OKRs do trimestre: resultado por Key Result | 30 min | REVISÃO |
| 3 | KPIs estratégicos: LTV/CAC, NRR, Rule of 40, Payback | 20 min | REVISÃO |
| 4 | Diagnóstico das falhas: o que não funcionou e por quê | 20 min | ANÁLISE |
| 5 | Celebração dos sucessos: o que funcionou e o que aprendemos | 10 min | APRENDIZADO |
| 6 | Propostas de OKRs para o próximo trimestre | 30 min | DECISÃO |
| 7 | Mudanças estruturais necessárias (ICP, oferta, time, canais) | 20 min | DECISÃO |
| 8 | Aprovação formal dos OKRs do próximo trimestre | 15 min | DECISÃO |
| 9 | Comprometimentos da liderança para o próximo trimestre | 15 min | ALINHAMENTO |

**Saídas obrigatórias:**
- Relatório trimestral publicado (event: `performance.relatorio_trimestral`)
- OKRs do próximo trimestre aprovados e publicados (event: `performance.metas_atualizadas`)
- DECISION_LOG atualizado com todas as decisões D3+
- Plano de melhoria estrutural se ICG < 90%

---

## 7.7 Rito Anual — Planejamento Estratégico

| Campo | Especificação |
|---|---|
| **Objetivo** | Revisão completa da estratégia, atualização do ICP, revisão arquitetural, definição de metas anuais e OKRs do primeiro trimestre |
| **Duração** | 480 minutos (8 horas — pode ser dividido em 2 dias) |
| **Cadência** | 1× por ano, entre novembro e janeiro (antes do início do exercício) |
| **Participantes obrigatórios** | Diretoria completa + gestores sênior + guardião de arquitetura |

**Agenda:**

| # | Item | Tempo | Tipo |
|---|---|---|---|
| 1 | Retrospectiva do ano: resultados vs. projeções | 60 min | REVISÃO |
| 2 | Análise de mercado e posicionamento competitivo (via CAP-01) | 45 min | REVISÃO |
| 3 | Revisão do ICP: ainda é o cliente certo? | 30 min | DECISÃO |
| 4 | Revisão do portfólio: produtos e preços | 30 min | DECISÃO |
| 5 | Planejamento de headcount e capacidade | 30 min | DECISÃO |
| 6 | Objetivos estratégicos do ano | 45 min | DECISÃO |
| 7 | Metas anuais por módulo | 45 min | DECISÃO |
| 8 | OKRs do primeiro trimestre | 45 min | DECISÃO |
| 9 | Orçamento e alocação de recursos | 45 min | DECISÃO |
| 10 | Revisão arquitetural do sistema (com guardião) | 30 min | REVISÃO |
| 11 | Aprovação formal do planejamento | 30 min | DECISÃO |
| 12 | Comunicação e comprometimentos | 45 min | ALINHAMENTO |

**Saídas obrigatórias:**
- Plano Anual publicado com metas, OKRs do Q1 e alocação
- ICP atualizado e formalizado (se revisado)
- Revisão arquitetural documentada com recomendações
- DECISION_LOG completo das decisões D3 e D4

---

# FOB-08 — Sistema Universal de Responsabilidades

## 8.1 Definição

Todo elemento do sistema — processo, KPI, alerta, plano de ação, rito, documento, decisão — tem um único dono. Não há propriedade coletiva no sistema. "A equipe é responsável" não é uma atribuição válida.

## 8.2 Modelo RACI-T Expandido

O sistema utiliza uma versão expandida do modelo RACI, com a adição do papel T (Treinado):

| Papel | Código | Definição | Regras |
|---|---|---|---|
| **Responsável** | R | Executa o trabalho; entrega o resultado | Exatamente 1 por elemento |
| **Prestador de Contas** | A (Accountable) | Responde pelo resultado perante a organização; aprova saídas | Exatamente 1 por elemento; nunca o mesmo que R se demandar aprovação |
| **Consultado** | C | Contribui com input antes da execução; comunicação bidirecional | 0 a N pessoas; contribui ativamente |
| **Informado** | I | Recebe informação sobre o resultado; comunicação unidirecional | 0 a N pessoas; apenas notificado |
| **Treinado** | T | Deve possuir competência para executar este elemento; responsável por capacitação | 0 a N papéis que precisam ser habilitados |

## 8.3 Papéis Padrão do Sistema

| Papel | Definição | Capacidades |
|---|---|---|
| **Operador** | Executa tarefas dentro de processos definidos | Decisões D0-D1; execução conforme processo |
| **Analista** | Produz diagnósticos, análises e recomendações | Decisões D0-D1; proposta de D2 |
| **Gestor de Módulo** | Responsável pelos resultados de um módulo | Decisões D1-D2; proposta de D3 |
| **Gestor de Área** | Responsável por um conjunto de módulos correlatos | Decisões D2; proposta de D3 |
| **Diretor** | Responsável pela estratégia e resultados do negócio | Decisões D2-D3 |
| **Guardião de Arquitetura** | Mantém a integridade do framework e da arquitetura | Decisões D4 (compartilhado com diretoria) |
| **Guardião de Dados** | Garante qualidade e governança das fontes de dados | Decisões sobre fontes e schemas |
| **Auditor Interno** | Executa auditorias e emite relatórios de conformidade | Acesso read-only; emissão de NCs |

## 8.4 Regras de Atribuição de Responsabilidades

- **RES-R01:** Todo elemento tem exatamente 1 papel R e 1 papel A. A ausência de qualquer um é não-conformidade.
- **RES-R02:** O mesmo papel pode ser R e A para decisões D0-D1. Para D2+, R e A devem ser papéis distintos (separação de funções).
- **RES-R03:** Vacância em papel R ou A por mais de 30 dias gera alerta ATENÇÃO automático.
- **RES-R04:** Atribuições de responsabilidade são registradas no sistema e têm data de vigência.
- **RES-R05:** Substituição temporária (férias, licença) deve ser formalmente declarada com data de início e fim.
- **RES-R06:** Papel T indica capacitação mínima obrigatória; sistema verifica se os operadores têm as certificações requeridas (via CAP-07).

## 8.5 Matriz de Autoridade para Decisões

| Tipo de Decisão | Operador | Analista | Gestor de Módulo | Gestor de Área | Diretor |
|---|---|---|---|---|---|
| Executar processo conforme blueprint | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exceção operacional pontual | — | ✓ | ✓ | ✓ | ✓ |
| Aprovar plano de ação P3-P4 | — | — | ✓ | ✓ | ✓ |
| Aprovar plano de ação P1-P2 | — | — | C | ✓ | ✓ |
| Alterar meta de KPI | — | — | Propõe | ✓ | ✓ |
| Alterar processo (blueprint) | — | C | Propõe | ✓ | ✓ |
| Alterar estrutura do módulo | — | — | — | Propõe | ✓ |
| Alterar ICP | — | — | — | C | ✓ |
| Alterar framework operacional | — | — | — | C | ✓ (com guardião) |

---

# FOB-09 — Sistema Universal de Documentação

## 9.1 Definição

Todo artefato produzido pelo sistema Aries deve seguir o padrão de documentação definido nesta seção. Documentos sem identificação, sem versionamento ou sem responsável não são reconhecidos como válidos pelo sistema.

## 9.2 Template Universal de Metadados de Documento

```yaml
documento_cabecalho:
  # IDENTIFICAÇÃO
  id: "[CATEGORIA]-[MODULO_OU_AREA]-[SEQ]"
  titulo: string
  
  # VERSÃO
  versao: "SemVer (MAJOR.MINOR.PATCH)"
  status: RASCUNHO | EM_REVISAO | APROVADO | OBSOLETO | ARQUIVADO
  
  # AUTORIA E RESPONSABILIDADE
  autor_original: string        # Quem criou
  responsavel_atual: string     # Quem mantém (papel)
  aprovador: string             # Papel que aprova mudanças
  
  # TEMPORALIDADE
  criado_em: ISO 8601
  ultima_revisao: ISO 8601
  proxima_revisao: ISO 8601     # Revisão obrigatória (máx. 12 meses para qualquer doc)
  
  # DEPENDÊNCIAS
  dependencias: [string]        # IDs de documentos que este referencia
  dependentes: [string]         # IDs de documentos que referenciam este
  
  # HISTÓRICO (append-only)
  historico_revisoes:
    - versao: string
      data: ISO 8601
      autor: string
      descricao_mudanca: string
      aprovado_por: string
      
  # CLASSIFICAÇÃO
  categoria: string             # Conforme catálogo de categorias
  tags: [string]
  confidencialidade: PUBLICO | INTERNO | RESTRITO | CONFIDENCIAL
```

## 9.3 Categorias de Documentos

| Código | Categoria | Exemplos | Responsável padrão |
|---|---|---|---|
| **ARC** | Arquitetura | Engines, contratos de integração, framework | Guardião de Arquitetura |
| **MOD** | Módulo Operacional | Especificações CAP-01 a CAP-09 | Gestor do Módulo |
| **PROC** | Processo | Blueprints de processo BPMN/textual | Gestor do Módulo |
| **KPI** | Indicador | Definições formais de KPI | Dono do KPI |
| **POL** | Política | Políticas de governança, desconto, comissão | Diretor |
| **MAN** | Manual | Guias operacionais e de usuário | Gestor de Área |
| **REL** | Relatório | Templates de relatórios recorrentes | Gestor de Módulo |
| **DEC** | Decisão | DECISION_LOG entries | Decisor + Gestor |
| **RFC** | Request for Change | Propostas de alteração arquitetural | Guardião de Arquitetura |

## 9.4 Ciclo de Vida de Documentos

```
RASCUNHO → EM_REVISAO → APROVADO → [em uso] → OBSOLETO → ARQUIVADO
                ↓
           REJEITADO → (volta ao autor para revisão)
```

**Regras do ciclo de vida:**

- **DOC-R01:** Nenhum documento em status RASCUNHO pode ser referenciado por processos ativos.
- **DOC-R02:** Documentos APROVADOS com mais de 12 meses sem revisão geram alerta automático de revisão vencida.
- **DOC-R03:** A obsolescência de um documento requer comunicação formal a todos os consumidores (papéis I da RACI).
- **DOC-R04:** Documentos ARQUIVADOS são imutáveis e acessíveis para referência histórica; nunca deletados.
- **DOC-R05:** Mudanças em documentos que afetam processos ativos requerem versionamento MAJOR e aprovação D2+.
- **DOC-R06:** Todo documento APROVADO tem uma `proxima_revisao` definida — não existe documento sem data de revisão.

## 9.5 Versionamento Semântico de Documentos

Segue o padrão SemVer adaptado para documentação:

| Tipo de mudança | Incremento | Exemplos |
|---|---|---|
| **MAJOR** | X.0.0 | Mudança de objetivo, escopo ou estrutura fundamental do documento |
| **MINOR** | X.Y.0 | Adição de seção, nova regra, novo KPI, nova automação |
| **PATCH** | X.Y.Z | Correção de texto, atualização de referência, correção de fórmula |

---

# FOB-10 — Sistema Universal de Melhoria Contínua

## 10.1 Definição

O Sistema Universal de Melhoria Contínua é o mecanismo pelo qual o sistema Aries aprende e evolui com cada ciclo de operação. Não é um projeto pontual — é um processo permanente, estruturado e auditável que impede a estagnação e corrige degradações antes que se tornem crises.

**Princípio:** Um sistema que não melhora degrada. A melhoria contínua não é uma opção — é um componente operacional obrigatório.

## 10.2 Ciclo PDCA Expandido em 10 Etapas

O ciclo de melhoria do sistema Aries expande o PDCA clássico (Plan-Do-Check-Act) em 10 etapas operacionais:

```
┌────────────────────────────────────────────────────────────────┐
│                CICLO DE MELHORIA CONTÍNUA (10 ETAPAS)          │
└────────────────────────────────────────────────────────────────┘

ETAPA 1 — DETECTAR
  Fonte: ENG-02 (KPI), ENG-03 (alerta), ENG-06 (NC), ENG-09 (recorrência)
  Saída: Item no backlog de melhoria com descrição estruturada
  
ETAPA 2 — DIAGNOSTICAR
  Ferramenta: ENG-04 + ENG-10 (casos similares)
  Saída: Causa raiz identificada com grau de confiança
  
ETAPA 3 — CRIAR HIPÓTESE DE MELHORIA
  Ação: Formular a mudança proposta (O que mudar? Por quê? Com que evidência?)
  Saída: Hipótese formal com métricas de validação definidas a priori
  
ETAPA 4 — PRIORIZAR
  Critérios: Impacto esperado × Custo de implementação × Urgência
  Ferramentas: Matriz de Eisenhower + análise de Pareto
  Saída: Score de prioridade; posição no backlog
  
ETAPA 5 — PLANEJAR
  Ação: Criar plano de implementação da melhoria (usar FOB-05)
  Definir: Métricas de sucesso, período de avaliação, responsável
  Saída: Plano de ação aprovado
  
ETAPA 6 — TESTAR (piloto controlado)
  Escopo: Implementação limitada (1 módulo, 1 processo, 1 equipe)
  Duração: Período suficiente para observação de pelo menos 1 ciclo completo
  Saída: Dados de resultado do piloto
  
ETAPA 7 — MEDIR
  Ação: Comparar métricas antes e depois do piloto
  Ferramentas: ENG-02 (KPIs); ENG-06 (conformidade)
  Saída: Relatório de resultado do piloto (eficaz / ineficaz / parcial)
  
ETAPA 8 — VALIDAR
  Decisão: Melhoria aprovada para escala? Abandonar? Iterar?
  Critério: Hipótese confirmada? Métricas atingidas? Efeitos colaterais?
  Saída: Decisão formal com justificativa
  
ETAPA 9 — PADRONIZAR E DOCUMENTAR
  Ação: Incorporar a melhoria ao blueprint de processo, KPI, alerta ou regra
  Atualizar: Documento afetado (versão MINOR ou MAJOR)
  Publicar: `melhoria.artefato.atualizado` no barramento
  
ETAPA 10 — TREINAR E MONITORAR
  Ação: Capacitar todos os operadores afetados
  Monitorar: KPI alvo por período mínimo de 90 dias
  Indexar: Aprendizado em ENG-10 para referência futura
```

## 10.3 Backlog de Melhoria

O backlog é a lista viva de todas as melhorias identificadas — em qualquer estágio do ciclo. É gerenciado por ENG-09 e visível em CAP-08.

```yaml
melhoria_item:
  id: "MH-[MODULO]-[ANO]-[SEQ]"
  titulo: string
  descricao: string
  
  origem:
    tipo: NC_RECORRENTE | ALERTA_RECORRENTE | AUDITORIA | QBR | SUGESTAO | ANOMALIA_IA
    referencia: string
    
  dimensao:
    tipo: PROCESSO | KPI | ALERTA | BLUEPRINT | CAPACITACAO | ARQUITETURA | TECNOLOGIA
    modulo_afetado: [string]
    
  prioridade:
    score: float              # Calculado: impacto × urgência / esforço
    nivel: P1 | P2 | P3 | P4
    
  status: IDENTIFICADO | PRIORIZADO | EM_ANALISE | EM_PILOTO | VALIDADO | IMPLEMENTADO | ARQUIVADO
  
  hipotese:
    descricao: string
    metrica_validacao: string
    valor_esperado: number
    confianca: BAIXA | MEDIA | ALTA
    
  resultado:
    implementado: boolean
    eficaz: boolean | null
    ganho_mensurado: string | null
    
  responsavel: string
  prazo_alvo: ISO 8601 | null
  criado_em: ISO 8601
  ultima_atualizacao: ISO 8601
```

## 10.4 Regras do Sistema de Melhoria Contínua

- **MC-R01:** Todo item de melhoria deve ter hipótese formal antes de entrar em execução. "Vamos tentar e ver" não é hipótese válida.
- **MC-R02:** Melhoria sem piloto não vai para escala. Mesmo melhorias "óbvias" passam por teste controlado.
- **MC-R03:** Backlog com mais de 20 items não priorizados por mais de 30 dias gera alerta de gestão de backlog.
- **MC-R04:** Nenhuma melhoria pode ser implementada que contradiga este framework sem passar pelo processo D4.
- **MC-R05:** Melhorias ineficazes são documentadas com igual rigor — o que não funciona é tão valioso quanto o que funciona.
- **MC-R06:** O guardião de arquitetura revisa e homologa todas as melhorias que afetam mais de um módulo ou a infraestrutura compartilhada.
- **MC-R07:** Toda melhoria implementada gera atualização de versão no documento afetado e registro em ENG-10.

## 10.5 Indicadores do Sistema de Melhoria

| KPI | Fórmula | Meta |
|---|---|---|
| Taxa de Implementação | melhorias implementadas / melhorias priorizadas × 100 | ≥ 70% |
| Eficácia das Melhorias | melhorias eficazes / melhorias implementadas × 100 | ≥ 60% |
| Tempo Médio de Ciclo | média(data_implementação - data_identificação) | ≤ 90 dias |
| Cobertura de Piloto | melhorias com piloto / melhorias implementadas × 100 | 100% |
| Recorrência de Problemas | problemas com NC recorrente / total NCs × 100 | ≤ 10% |

---

# Anexo A — Integração do Framework com a Engine de Autogestão

O Framework Operacional Universal opera **sobre** a Engine de Autogestão — não em paralelo com ela. A relação é:

| Sistema FOB | Engine que executa | Evento principal |
|---|---|---|
| FOB-01 (Ciclo Operacional) | ENG-01 | `processo.instancia.criada` |
| FOB-02 (Máquina de Decisão) | ENG-03 + ENG-04 + ENG-05 | `alerta.alerta.criado` → `diagnostico.sessao.aberta` |
| FOB-03 (KPIs) | ENG-02 | `kpi.valor.calculado` |
| FOB-04 (Alertas) | ENG-03 | `alerta.alerta.criado` |
| FOB-05 (Planos de Ação) | ENG-05 | `plano_acao.plano.criado` |
| FOB-06 (Auditoria) | ENG-06 | `auditoria.execucao.concluida` |
| FOB-07 (Ritos) | ENG-01 + ENG-07 | `processo.instancia.criada` (por Scheduler) |
| FOB-08 (Responsabilidades) | ENG-07 + ENG-01 | Permissões e workflows |
| FOB-09 (Documentação) | ENG-06 | Auditoria de conformidade documental |
| FOB-10 (Melhoria Contínua) | ENG-09 + ENG-10 | `melhoria.item.identificado` |

---

# Anexo B — Checklist de Conformidade do Framework por Módulo

Todo módulo do sistema Aries deve ser auditável contra este checklist:

```yaml
checklist_conformidade_framework:
  fob_01_ciclo_operacional:
    - "Todos os processos do módulo têm as 8 fases documentadas"
    - "Event_id em todos os eventos publicados"
    - "Deduplicação implementada para todos os consumidores"
    - "Log de auditoria gerado em Fase 1 (Entrada)"
    
  fob_02_maquina_de_decisao:
    - "Decisões D2+ têm DECISION_LOG obrigatório"
    - "Matriz de escalonamento definida para todos os alertas"
    - "Causa raiz identificada antes de planos de ação P1/P2"
    
  fob_03_kpis:
    - "Todos os KPIs têm os 15 campos do template preenchidos"
    - "Nenhum KPI sem fórmula calculável automaticamente"
    - "Todos os KPIs têm limiar de atenção e crítico configurados"
    
  fob_04_alertas:
    - "Todos os alertas classificados em um dos 4 níveis"
    - "SLA de resposta definido para cada nível"
    - "Regra de escalonamento definida"
    
  fob_05_planos_acao:
    - "Nenhum plano de ação sem responsável único"
    - "Nenhuma ação sem prazo"
    - "Verificação de eficácia definida a priori"
    
  fob_06_auditoria:
    - "Checklist operacional executado mensalmente"
    - "Checklist gerencial executado trimestralmente"
    - "NCs registradas e com plano de resolução"
    
  fob_07_ritos:
    - "Calendário de ritos publicado e acessível a todos"
    - "Atas de todos os ritos publicadas dentro do prazo"
    - "Ausências justificadas formalmente"
    
  fob_08_responsabilidades:
    - "Todo elemento do módulo tem R e A definidos"
    - "Nenhum papel vago por mais de 30 dias"
    - "Matriz RACI-T atualizada"
    
  fob_09_documentacao:
    - "Todos os documentos do módulo com metadados completos"
    - "Nenhum documento sem data de próxima revisão"
    - "Histórico de revisões completo e imutável"
    
  fob_10_melhoria_continua:
    - "Backlog de melhoria ativo com pelo menos 1 item em andamento"
    - "Nenhum item no backlog sem prioridade definida"
    - "Piloto executado para toda melhoria implementada"
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-07-01 | Guardião da Documentação Técnica | Criação do Framework Operacional Universal — 10 sistemas, estrutura completa |
