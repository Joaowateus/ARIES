---
id: MOD-CAP-05
titulo: "CAP-05 — Gestão de Clientes"
versao: "2.0.0"
status: aprovado
categoria: Commercial-OS-Module
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-29
dependencias:
  - ARC-ENG-000
  - ARC-ENG-001
  - ARC-ENG-002
  - ARC-ENG-003
  - ARC-ENG-004
  - ARC-ENG-005
  - ARC-ENG-006
  - ARC-ENG-007
  - ARC-ENG-008
  - ARC-ENG-010
  - MOD-CAP-03
  - MOD-CAP-04
tags: [commercial-os, cap-05, customer-success, onboarding, retencao, churn, health-score, expansao, nps]
---

# CAP-05 — Gestão de Clientes

> **Módulo do Commercial Operating System**
> Infraestrutura compartilhada: `docs/02-architecture/engine-autogestao/`
> Contrato de integração: `ENGINE-CONTRATO-DE-INTEGRACAO.md` (ARC-ENG-099)

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| **ID do Módulo** | CAP-05 |
| **Nome** | Gestão de Clientes |
| **Domínio** | Retenção, Expansão e Sucesso do Cliente |
| **Versão** | 2.0.0 |
| **Tier** | Core |
| **Posição na cadeia** | Downstream de CAP-03; Paralelo a CAP-04; Upstream de CAP-01 (feedback) |
| **Registro na Engine** | `ENGINE-REGISTRATION.yaml` (seção 16) |

---

## 2. Objetivo

Garantir que cada cliente que entra na base **atinja o resultado esperado, permaneça ativo e expanda o relacionamento** — transformando clientes em promotores da solução e maximizando o NRR (Net Revenue Retention) como métrica de saúde do negócio.

O CAP-05 fecha o ciclo do Commercial OS: ele começa onde CAP-03 termina (contrato assinado) e alimenta CAP-01 (aprendizado) e CAP-04 (expansão de receita). Um cliente que churn é uma falha sistêmica que começa a ser evitada aqui. Um cliente que expande é o sinal mais eficiente de que o sistema está funcionando.

**O CAP-05 não vende novas contas. Ele protege e desenvolve as contas existentes — e garante que o custo de aquisição de CAP-02 e CAP-03 se justifique no longo prazo.**

---

## 3. Escopo

### 3.1 Dentro do Escopo
- Onboarding estruturado de novos clientes
- Monitoramento contínuo de saúde do cliente (Health Score)
- Gestão de relacionamento pós-venda (touchpoints, QBRs, check-ins)
- Identificação e execução de oportunidades de expansão (upsell/cross-sell)
- Protocolo de prevenção e intervenção de churn
- Coleta e análise de NPS e CSAT
- Gestão de pedidos de cancelamento
- Publicação de eventos de expansão, contração e churn para CAP-04

### 3.2 Fora do Escopo
- Faturamento e cobrança → CAP-04
- Suporte técnico ao produto → sistema de suporte externo
- Desenvolvimento de produto → produto
- Definição de pricing de expansão → CAP-06
- Análise Win/Loss de cancelamentos → CAP-01 (recebe o evento)

---

## 4. Responsabilidades

| # | Responsabilidade | Frequência |
|---|-----------------|-----------|
| R-01 | Iniciar onboarding imediatamente após `cliente.contrato_assinado` | Por evento |
| R-02 | Manter Health Score atualizado para 100% dos clientes ativos | Semanal |
| R-03 | Executar touchpoints de relacionamento conforme cadência por Health Score tier | Contínuo |
| R-04 | Intervir em clientes em risco (Health Score vermelho) em até 48h | Por detecção |
| R-05 | Identificar e propor expansões em clientes com Health Score verde e gatilhos de expansão | Contínuo |
| R-06 | Executar protocolo de cancelamento com tentativa de reversão | Por solicitação |
| R-07 | Publicar `cliente.churned` quando cancelamento é confirmado | Por cancelamento |
| R-08 | Publicar `cliente.expandido` quando expansão é confirmada | Por expansão |
| R-09 | Coletar NPS/CSAT e encaminhar feedback para CAP-01 e ENG-10 | Trimestral / por evento |

---

## 5. Capacidades Internas

### CAP-05.1 — Onboarding Estruturado

O onboarding é o período crítico de adoção que determina se o cliente vai gerar valor com a solução ou se tornará um churn futuro. O Commercial OS trata o onboarding como um processo com estágios, milestones e critérios de sucesso.

**Estrutura do plano de onboarding:**
```yaml
onboarding_plan:
  id: "ONB-ID"
  cliente_id: "CLI-ID"
  contrato_id: "CTR-ID"
  cs_responsavel: "CS-ID"
  status: "nao_iniciado | em_andamento | concluido | atrasado | em_risco"

  template_id: "TMPL-ONB-PADRAO"  # templates por segmento/produto

  milestones:
    - id: "M1"
      nome: "Kickoff realizado"
      prazo_dias_apos_contrato: 3
      criterio_conclusao: "reunião de kickoff realizada com stakeholders do cliente"
      status: "pendente | concluido | atrasado"

    - id: "M2"
      nome: "Configuração inicial concluída"
      prazo_dias_apos_contrato: 10
      criterio_conclusao: "ambiente configurado e validado pelo cliente"

    - id: "M3"
      nome: "Primeira adoção comprovada"
      prazo_dias_apos_contrato: 21
      criterio_conclusao: "cliente utilizou o produto/serviço com resultado mensurável"

    - id: "M4"
      nome: "Sucesso inicial (first value)"
      prazo_dias_apos_contrato: 45
      criterio_conclusao: "cliente reconhece e verbaliza o primeiro resultado esperado"

    - id: "M5"
      nome: "Onboarding concluído"
      prazo_dias_apos_contrato: 90
      criterio_conclusao: "todos os milestones concluídos; health score ≥ amarelo"

  data_inicio: ""
  data_conclusao_prevista: ""
  data_conclusao_real: null
```

### CAP-05.2 — Health Score

O Health Score é o indicador sintético de saúde de cada cliente — combinando sinais de adoção, engajamento, relacionamento e financeiro.

**Arquitetura do Health Score:**
```yaml
health_score_model:
  escala: "0 a 100"
  tiers:
    verde: ">= 70"
    amarelo: "40 a 69"
    vermelho: "< 40"

  dimensoes:
    - nome: "adocao"
      peso: 0.35
      sinais:
        - "frequência de uso do produto/serviço"
        - "breadth of use (quais funcionalidades/serviços estão sendo usados)"
        - "número de usuários ativos vs. contratados"

    - nome: "resultado"
      peso: 0.25
      sinais:
        - "milestones de onboarding alcançados"
        - "KPIs do cliente reportados pelo CS"
        - "renovações e expansões históricas"

    - nome: "relacionamento"
      peso: 0.20
      sinais:
        - "tempo desde último touchpoint do CS"
        - "NPS/CSAT mais recente"
        - "engajamento em QBRs e reuniões"
        - "responsividade do cliente"

    - nome: "financeiro"
      peso: 0.20
      sinais:
        - "status de pagamento (inadimplência impacta negativamente)"
        - "expansões recentes (impacto positivo)"
        - "contrações recentes (impacto negativo)"

  atualizacao: "automática semanalmente + manual por CS a qualquer momento"
  historico: "série temporal imutável (ENG-02)"
```

**Cadência de ação por Health Score:**
| Tier | Cadência de Touchpoint | Ação do CS |
|------|----------------------|-----------|
| Verde (≥ 70) | Mensal | Check-in de relacionamento; identificar expansão |
| Amarelo (40-69) | Quinzenal | Diagnóstico de bloqueios; plano de ação de adoção |
| Vermelho (< 40) | Semanal | Protocolo de resgate imediato (48h) |

### CAP-05.3 — Gestão de Expansão

Identificação e execução de oportunidades de upsell e cross-sell em clientes ativos.

```yaml
oportunidade_expansao:
  id: "EXP-ID"
  cliente_id: "CLI-ID"
  cs_responsavel: "CS-ID"
  tipo: "upsell | cross_sell | renovacao_antecipada | adicional_de_usuarios"
  status: "identificada | em_progresso | ganha | perdida"

  gatilhos_detectados:
    - "health_score >= 70 por 3 meses consecutivos"
    - "cliente atingiu limite de usuários/volume contratado"
    - "evento de crescimento da empresa do cliente (ex: novas filiais)"
    - "novo produto disponível relevante para o perfil do cliente"

  valor_estimado_mrr: 0.0
  valor_efetivado_mrr: null

  abordagem_proposta: ""
  data_identificacao: ""
  data_conclusao: null

  motivo_perda: null
```

**Gatilhos de expansão monitorados automaticamente:**
- Health Score verde por 3+ meses consecutivos
- Uso próximo ao limite do plano contratado (> 80%)
- Novo produto/serviço lançado relevante para o segmento do cliente
- Cliente indicou terceiros (sinal de engajamento alto)
- Renovação a menos de 90 dias (janela de upsell na renovação)

### CAP-05.4 — Protocolo de Churn

Processo estruturado para prevenir e responder a sinais de risco de cancelamento.

**Níveis de risco de churn:**
```yaml
churn_risk:
  nivel_1_monitoramento:
    condicao: "health_score amarelo por 2 semanas"
    acao: "CS aumenta frequência de touchpoints; diagnóstico de bloqueios"

  nivel_2_alerta:
    condicao: "health_score vermelho | cliente expressou insatisfação | NPS ≤ 6"
    acao: "protocolo de resgate: CS contacta em 48h; gestor de CS notificado"
    sla: "48 horas para primeiro contato"

  nivel_3_critico:
    condicao: "cliente solicitou cancelamento formalmente"
    acao: "protocolo de salvamento: CS + gestor + proposta de retenção"
    sla: "24 horas para resposta"
    politica:
      - "ouvir: entender a causa raiz do cancelamento sem pressionar"
      - "validar: reconhecer o problema; não minimizar"
      - "propor: oferecer solução concreta (ajuste, desconto, pausa, mudança de plano)"
      - "registrar: documentar todos os motivos independente do resultado"
      - "escalar: se proposta de retenção exige desconto → aprovação de CAP-06"
```

### CAP-05.5 — NPS e CSAT

Coleta estruturada de feedback de clientes.

```yaml
nps_collection:
  frequencia: "trimestral para todos os clientes ativos"
  gatilhos_adicionais:
    - "após conclusão do onboarding (M5)"
    - "após resolução de incidente crítico"
    - "30 dias antes da renovação"

  escala:
    promotores: "9-10"
    neutros: "7-8"
    detratores: "0-6"

  formula_nps: "% promotores - % detratores"

  acoes_por_resultado:
    promotores:
      - "agradecer; solicitar indicação; identificar caso de uso para marketing"
    neutros:
      - "entender o que falta para se tornar promotor; oferecer recurso específico"
    detratores:
      - "contato imediato do CS (24h); abrir protocolo de resgate nível 2"
      - "publicar evento para ENG-10 (aprendizado de insatisfação)"
```

---

## 6. Fluxo Operacional

```
[FLUXO A — ONBOARDING DE NOVO CLIENTE]

[TRIGGER: cliente.contrato_assinado recebido de CAP-03]
│
├─► Criar plano de onboarding (template por segmento/produto)
├─► Designar CS responsável
├─► Notificar cliente e agendar kickoff (SLA: kickoff em até 3 dias úteis)
├─► Publicar: cliente.onboarding_iniciado
│
└─► [Para cada milestone]
    ├─► Notificar CS da proximidade do prazo (3 dias antes)
    ├─► Milestone concluído: registrar evidência + avançar
    ├─► Milestone atrasado → ALT-CS-02 (onboarding em risco)
    │
    └─► [M5 — Onboarding concluído]
        ├─► Calcular Health Score inicial
        ├─► Publicar: cliente.onboarding_concluido
        └─► Ativar cadência regular de relacionamento


[FLUXO B — MONITORAMENTO E AÇÃO POR HEALTH SCORE]

[TRIGGER: cálculo semanal de Health Score (ENG-02)]
│
├─► Health Score verde (≥ 70):
│   ├─► Verificar se há gatilhos de expansão ativos
│   │   ├─► Sim → criar oportunidade de expansão; notificar CS
│   │   └─► Não → manter cadência mensal
│   └─► Se verde por 3+ meses: avaliar indicação / NPS proativo
│
├─► Health Score amarelo (40-69):
│   ├─► Aumentar cadência para quinzenal
│   ├─► CS diagnostica: qual dimensão caiu? (adoção, resultado, relacionamento, financeiro)
│   └─► Criar plano de ação de adoção (ENG-05)
│
└─► Health Score vermelho (< 40):
    ├─► Publicar: cliente.health_score_vermelho
    ├─► ALT-CS-01 (crítico) — SLA de 48h para CS contactar
    ├─► Notificar gestor de CS
    └─► Iniciar protocolo de churn nível 2


[FLUXO C — SOLICITAÇÃO DE CANCELAMENTO]

[TRIGGER: cliente solicita cancelamento formalmente]
│
├─► Publicar: cliente.cancelamento_solicitado
├─► Registrar motivo declarado (campo estruturado obrigatório)
│
├─► Protocolo de salvamento (SLA: resposta em 24h):
│   ├─► CS entende causa raiz sem pressionar
│   ├─► CS valida o problema: "sim, entendemos que X não foi como esperado"
│   ├─► CS propõe solução concreta:
│   │   ├─► Solução não financeira: ajuste de configuração, mudança de plano, pausa
│   │   └─► Solução com desconto: solicitar aprovação conforme CAP-06
│   │
│   ├─► Cliente aceita proposta → cancelamento revertido
│   │   └─► Publicar: cliente.retido; registrar motivo e solução
│   │
│   └─► Cliente mantém cancelamento → processar cancelamento
│       ├─► Registrar todos os motivos na base de conhecimento (ENG-10)
│       ├─► Publicar: cliente.churned → CAP-04 e CAP-01 recebem
│       └─► Publicar: cliente.encerrado


[FLUXO D — EXPANSÃO]

[TRIGGER: gatilho de expansão detectado OU identificação manual pelo CS]
│
├─► Criar oportunidade de expansão
├─► CS prepara proposta de expansão (valor, escopo, justificativa)
├─► Proposta aprovada pelo gestor (se desconto envolvido: CAP-06)
├─► CS apresenta proposta ao cliente
│
├─► Cliente aceita:
│   ├─► Novo contrato ou aditivo gerado (via CAP-03 se novo ciclo, ou via CAP-04 se aditivo simples)
│   └─► Publicar: cliente.expandido (com delta_mrr)
│       └─► CAP-04 reconhece expansion_mrr
│
└─► Cliente não aceita:
    ├─► Registrar motivo
    └─► Reavaliar em próximo ciclo
```

---

## 7. Estados

### 7.1 Estados do Cliente

```
EM_ONBOARDING → ATIVO_SAUDAVEL | ATIVO_EM_RISCO | ATIVO_CRITICO
                                        │
                               CANCELAMENTO_SOLICITADO
                                        │
                               RETIDO | CHURNED
```

### 7.2 Health Score Tier

```
VERDE (≥70) ↔ AMARELO (40-69) ↔ VERMELHO (<40)
```
*(bidirecional — pode melhorar ou piorar)*

### 7.3 Estados do Onboarding

```
NAO_INICIADO → EM_ANDAMENTO → CONCLUIDO
                    │
              ATRASADO → EM_RISCO → [intervencao] → EM_ANDAMENTO | CHURNED_ONBOARDING
```

### 7.4 Estados da Oportunidade de Expansão

```
IDENTIFICADA → EM_PROGRESSO → GANHA | PERDIDA
```

---

## 8. Regras de Negócio

### RN-01 — Onboarding Iniciado em até 3 Dias Úteis
O kickoff do onboarding DEVE ser agendado em até 3 dias úteis após `cliente.contrato_assinado`. Onboarding não iniciado nesse prazo é não-conformidade e gera alerta. A velocidade de início do onboarding é um dos maiores preditores de sucesso do cliente.

### RN-02 — Health Score Calculado Semanalmente para Todos os Clientes Ativos
Nenhum cliente ativo pode estar sem Health Score atualizado. O cálculo é automático (ENG-02) e o CS pode complementar manualmente com informações qualitativas. O Health Score é a fonte de verdade sobre a saúde do cliente — não a percepção subjetiva do CS.

### RN-03 — Protocolo de Resgate em 48h para Clientes Vermelhos
Quando o Health Score de um cliente cai para vermelho, o CS responsável tem 48 horas para realizar o primeiro contato ativo. Após 48h sem contato, o gestor de CS é notificado e assume. O Health Score vermelho é uma emergência operacional.

### RN-04 — Todos os Motivos de Churn São Registrados
Todo cancelamento — revertido ou confirmado — DEVE ter todos os motivos registrados em campos estruturados. Motivos em texto livre são proibidos. A taxonomia de motivos de churn é mantida pelo módulo e atualizada com aprovação do gestor. Os dados de churn alimentam CAP-01.

### RN-05 — Expansão Não Interrompe a Cadência de CS
A identificação de uma oportunidade de expansão NÃO deve mudar o relacionamento do CS de suporte para vendas. O CS mantém a cadência de relacionamento independentemente de oportunidades de expansão ativas. A expansão é consequência da saúde, não um objetivo que justifica pressão no cliente.

### RN-06 — Protocolo de Cancelamento Sem Pressão
O protocolo de salvamento de cancelamento é focado em entender e resolver, não em reter a qualquer custo. Clientes retidos por pressão ou concessões sem sustentação têm alta probabilidade de cancelar novamente em 90 dias. Qualquer desconto de retenção > nível configurado requer aprovação e registro.

### RN-07 — NPS ≤ 6 Aciona Protocolo Automático
Qualquer NPS de 0 a 6 (detrator) DEVE acionar protocolo de contato em 24 horas. NPS detrator não atendido é uma oportunidade de churn não detectada. O CS contacta para entender, não para argumentar.

### RN-08 — Evento de Churn Publicado com Dados Completos
O evento `cliente.churned` DEVE conter: motivo estruturado, data efetiva, valor de MRR perdido, health score na semana do churn, se houve tentativa de retenção e resultado. Esses dados são críticos para CAP-01 (análise Win/Loss retroativa) e CAP-04 (MRR Bridge).

### RN-09 — Expansão Publicada Antes de Faturar
O evento `cliente.expandido` deve ser publicado pelo CAP-05 ANTES de CAP-04 ajustar o faturamento. A origem do expansion_mrr é sempre o CAP-05 — CAP-04 apenas executa o faturamento.

---

## 9. Eventos Publicados

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `cliente.onboarding_iniciado` | Plano de onboarding criado e kickoff agendado | `{cliente_id, cs_responsavel, data_kickoff, template_id}` |
| `cliente.onboarding_concluido` | Milestone M5 concluído — onboarding finalizado | `{cliente_id, dias_duracao, health_score_inicial, cs_responsavel}` |
| `cliente.health_score_atualizado` | Health Score calculado ou ajustado | `{cliente_id, score_anterior, score_novo, tier_anterior, tier_novo, dimensoes_json}` |
| `cliente.health_score_vermelho` | Health Score caiu para < 40 | `{cliente_id, score, cs_responsavel, gestor_cs, dimensao_principal_queda}` |
| `cliente.nps_coletado` | Resposta de NPS recebida | `{cliente_id, nps_score, categoria: promotor\|neutro\|detrator, comentario}` |
| `cliente.expandido` | Expansão confirmada (upsell/cross-sell) | `{cliente_id, tipo_expansao, delta_mrr, contrato_id_novo\|aditivo_id}` |
| `cliente.contrato_reduzido` | Contrato reduzido (contração) | `{cliente_id, motivo, delta_mrr_negativo, nova_data_fim?}` |
| `cliente.cancelamento_solicitado` | Cancelamento solicitado formalmente | `{cliente_id, motivo_declarado, data_solicitacao, cs_responsavel}` |
| `cliente.retido` | Cancelamento revertido com sucesso | `{cliente_id, motivo_original, solucao_aplicada, desconto_concedido?}` |
| `cliente.churned` | Cancelamento confirmado — cliente saiu | `{cliente_id, motivo_estruturado, mrr_perdido, health_score_semana_churn, tentativa_retencao: boolean}` |
| `cliente.encerrado` | Conta encerrada no sistema | `{cliente_id, data_encerramento, tipo: churned\|encerrado_por_cliente}` |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `cliente.contrato_assinado` | CAP-03 | Iniciar onboarding; designar CS; agendar kickoff |
| `receita.inadimplencia.d15` | CAP-04 | Notificar CS; registrar risco financeiro no Health Score |
| `receita.inadimplencia.critica` | CAP-04 | Escalar para gestor de CS; protocolo de retenção de emergência |
| `receita.suspensao_executada` | CAP-04 | Acionar CS para comunicação formal ao cliente |
| `mercado.icp.atualizado` | CAP-01 | Recalcular fit dos clientes ativos com o novo ICP; identificar clientes que mudaram de tier |
| `kpi.limiar.cruzado` | ENG-02 | Se KPI é churn_rate ou NRR: escalar para gestor; avaliar protocolo de retenção |
| `sistema.periodo_encerrado` | Scheduler (semanal) | Calcular Health Scores; emitir relatório de saúde da base |
| `sistema.periodo_encerrado` | Scheduler (trimestral) | Disparar coleta de NPS; gerar relatório de coortes |
| `melhoria.item.implementado` | ENG-09 | Revisar processos impactados |

---

## 11. KPIs

| ID | Nome | Fórmula | Meta | Frequência |
|----|------|---------|------|-----------|
| KPI-CS-01 | Churn Rate (Clientes) | `clientes_churned / clientes_inicio × 100` | < 2% | Mensal |
| KPI-CS-02 | Churn MRR Rate | `churn_mrr / mrr_inicio × 100` | < 2% | Mensal |
| KPI-CS-03 | NRR | `referência CAP-04 KPI-RV-07` | > 100% | Mensal |
| KPI-CS-04 | NPS | `% promotores - % detratores` | > 40 | Trimestral |
| KPI-CS-05 | CSAT | `respostas_satisfeitos / total_respostas × 100` | > 85% | Por evento |
| KPI-CS-06 | Taxa de Clientes por Tier de Health | `dist. verde/amarelo/vermelho` | Verde > 70% | Semanal |
| KPI-CS-07 | Tempo Médio de Onboarding | `média(data_M5 - data_contrato)` | ≤ 90 dias | Mensal |
| KPI-CS-08 | Taxa de Conclusão de Onboarding | `onboardings_concluidos / iniciados × 100` | ≥ 90% | Mensal |
| KPI-CS-09 | Taxa de Retenção em Cancelamentos | `retidos / cancelamentos_solicitados × 100` | > 40% | Mensal |
| KPI-CS-10 | Expansion MRR Rate | `expansion_mrr / mrr_base × 100` | > 5% | Mensal |
| KPI-CS-11 | Time to First Value | `média(data_M4 - data_contrato)` | Por segmento | Mensal |

---

## 12. Alertas

| ID | Condição | Severidade | Ação |
|----|---------|-----------|------|
| ALT-CS-01 | Health Score vermelho detectado | CRITICAL | CS contacta em 48h; gestor notificado |
| ALT-CS-02 | Milestone de onboarding atrasado > 5 dias | WARNING | CS notificado; plano de recuperação |
| ALT-CS-03 | Churn Rate > 3% no mês | CRITICAL | Escalar para liderança; diagnóstico ENG-04 |
| ALT-CS-04 | NPS ≤ 6 recebido | WARNING | CS contacta em 24h; protocolo de detrator |
| ALT-CS-05 | > 20% da base em Health Score amarelo | WARNING | Revisar qualidade de adoção da base |
| ALT-CS-06 | > 10% da base em Health Score vermelho | CRITICAL | Plano de resgate de base; escalar para liderança |
| ALT-CS-07 | Taxa de retenção em cancelamentos < 20% | WARNING | Revisar protocolo de salvamento; treinamento de CS |
| ALT-CS-08 | Cliente vermelho sem contato do CS em 48h | CRITICAL | Gestor de CS assume; NC registrada |
| ALT-CS-09 | Onboarding sem conclusão há > 120 dias | WARNING | Revisar caso; decisão: reativar ou encerrar |

---

## 13. Planos de Ação Automáticos

### PA-CS-01 — Churn Rate Alto (Gatilho: ALT-CS-03)
```yaml
plano_acao:
  tipo: diagnostico_e_correcao
  prazo_dias: 30
  tarefas:
    - "ENG-04: analisar churn dos últimos 90 dias por dimensão (segmento, plano, coorte, motivo)"
    - "Identificar: churn é concentrado em segmento específico, produto, coorte de entrada ou CS?"
    - "Se concentrado em segmento: verificar fit do ICP (comunicar para CAP-01)"
    - "Se concentrado em produto: escalar para produto com dados"
    - "Se concentrado em CS: coaching individual via CAP-07"
    - "Se coorte específica: revisar processo de onboarding do período"
  metrica_sucesso: "Churn Rate < 2% em 60 dias"
```

### PA-CS-02 — Base com Alta Proporção de Clientes Vermelhos (Gatilho: ALT-CS-06)
```yaml
plano_acao:
  tipo: resgate_de_base
  prazo_dias: 45
  tarefas:
    - "Listar todos os clientes vermelhos com responsável, health score e dimensão principal"
    - "Triagem: clientes recuperáveis vs. provável churn"
    - "Para recuperáveis: plano individual por cliente com CS"
    - "Para alto risco de churn: protocolo de cancelamento antecipado (cancelamento proativo > churn surpresa)"
    - "Revisar se capacidade do time de CS é adequada ao volume da base"
  metrica_sucesso: "< 10% da base em vermelho em 60 dias"
```

---

## 14. Automações

| ID | Trigger | Ação Automatizada | Conector |
|----|---------|-----------------|---------|
| AUT-CS-01 | `cliente.contrato_assinado` recebido | Criar plano de onboarding; notificar CS; enviar boas-vindas ao cliente | CONN-CRM-PRINCIPAL, CONN-MENSAGERIA, CONN-EMAIL-TRANSACIONAL |
| AUT-CS-02 | Milestone de onboarding próximo (3 dias) | Lembrar CS do prazo | CONN-MENSAGERIA |
| AUT-CS-03 | `sistema.periodo_encerrado` (semanal) | Calcular Health Scores de todos os clientes ativos | ENG-02 |
| AUT-CS-04 | Health Score cai para vermelho | Publicar `cliente.health_score_vermelho`; notificar CS e gestor | Barramento SOE, CONN-MENSAGERIA |
| AUT-CS-05 | `receita.inadimplencia.d15` recebido | Notificar CS; registrar impacto no Health Score (dimensão financeira) | CONN-MENSAGERIA |
| AUT-CS-06 | `sistema.periodo_encerrado` (trimestral) | Disparar coleta de NPS para todos os clientes ativos | CONN-PESQUISA-NPS |
| AUT-CS-07 | NPS ≤ 6 recebido | Notificar CS para contato em 24h; publicar evento | Barramento SOE, CONN-MENSAGERIA |
| AUT-CS-08 | Gatilho de expansão detectado | Criar oportunidade de expansão; notificar CS | CONN-CRM-PRINCIPAL, CONN-MENSAGERIA |
| AUT-CS-09 | `sistema.periodo_encerrado` (mensal) | Calcular KPI-CS-01 a KPI-CS-11; gerar relatório de saúde da base | ENG-02 |

---

## 15. Auditoria Operacional

### Checklist Semanal — CAP-05-AUD-SEMANAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | 100% dos clientes ativos com Health Score calculado | KPI-CS-06 | Zero clientes sem score |
| 2 | Clientes vermelhos com contato do CS registrado em ≤ 48h | Log de atividades | 100% dentro do SLA |
| 3 | Milestones atrasados com plano de ação ativo | Lista de milestones atrasados | Zero atrasados sem plano |
| 4 | Oportunidades de expansão identificadas em clientes verdes | Log de oportunidades | Revisão periódica |

### Checklist Mensal — CAP-05-AUD-MENSAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Churn Rate dentro do limite | KPI-CS-01 | < 2% |
| 2 | 100% dos churns com motivo estruturado registrado | Verificar campo motivo | Zero churns sem motivo |
| 3 | Taxa de conclusão de onboarding ≥ 90% | KPI-CS-08 | Valor do KPI |
| 4 | NPS coletado no trimestre (se aplicável) | Registro de coleta | Cobertura ≥ 80% da base |
| 5 | Clientes com Health Score vermelho > 30 dias têm escalonamento registrado | Log de escalonamentos | 100% dos casos |
| 6 | Alertas tratados dentro do SLA da ENG-03 | Taxa de resolução | ≥ 90% no SLA |

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml — CAP-05 Gestão de Clientes
# Ref: ARC-ENG-099

modulo:
  id: "CAP-05"
  nome: "Gestão de Clientes"
  versao: "2.0.0"
  tier: "core"
  status: "ativo"

dependencias:
  modulos:
    - id: "CAP-03"
      uso: "receber contratos assinados para iniciar onboarding"
    - id: "CAP-04"
      uso: "receber alertas de inadimplência; publicar eventos de expansão/churn para faturamento"
    - id: "CAP-06"
      uso: "aprovação de descontos de retenção"
  engines:
    - id: "ENG-01"
      uso: "instâncias de onboarding, planos de ação de resgate"
    - id: "ENG-02"
      uso: "KPIs KPI-CS-01 a KPI-CS-11; Health Score como série temporal"
    - id: "ENG-03"
      uso: "alertas ALT-CS-01 a ALT-CS-09"
    - id: "ENG-04"
      uso: "diagnóstico de churn alto e distribuição de health score"
    - id: "ENG-05"
      uso: "planos de ação PA-CS-01 e PA-CS-02"
    - id: "ENG-06"
      uso: "auditoria semanal e mensal"
    - id: "ENG-07"
      uso: "workflows AUT-CS-01 a AUT-CS-09"
    - id: "ENG-08"
      uso: "CRM, email, mensageria, NPS"
    - id: "ENG-10"
      uso: "indexar padrões de churn e expansão; sugestões para CS"

eventos_publicados:
  - evento: "cliente.onboarding_iniciado"
    condicao: "plano de onboarding criado e kickoff agendado"
  - evento: "cliente.onboarding_concluido"
    condicao: "milestone M5 concluído"
  - evento: "cliente.health_score_atualizado"
    condicao: "health score calculado ou ajustado"
  - evento: "cliente.health_score_vermelho"
    condicao: "health score caiu para < 40"
  - evento: "cliente.nps_coletado"
    condicao: "resposta de NPS recebida"
  - evento: "cliente.expandido"
    condicao: "expansão confirmada"
  - evento: "cliente.contrato_reduzido"
    condicao: "contração confirmada"
  - evento: "cliente.cancelamento_solicitado"
    condicao: "cancelamento solicitado formalmente"
  - evento: "cliente.retido"
    condicao: "cancelamento revertido"
  - evento: "cliente.churned"
    condicao: "cancelamento confirmado"
  - evento: "cliente.encerrado"
    condicao: "conta encerrada no sistema"

eventos_consumidos:
  - evento: "cliente.contrato_assinado"
    origem: "CAP-03"
    acao: "iniciar onboarding; designar CS; agendar kickoff"
  - evento: "receita.inadimplencia.d15"
    origem: "CAP-04"
    acao: "notificar CS; registrar impacto no health score"
  - evento: "receita.inadimplencia.critica"
    origem: "CAP-04"
    acao: "escalar para gestor de CS; protocolo de emergência"
  - evento: "receita.suspensao_executada"
    origem: "CAP-04"
    acao: "CS comunica formalmente ao cliente"
  - evento: "mercado.icp.atualizado"
    origem: "CAP-01"
    acao: "recalcular fit dos clientes ativos com o novo ICP"
  - evento: "kpi.limiar.cruzado"
    origem: "ENG-02"
    acao: "escalar se KPI é churn_rate ou NRR"
  - evento: "sistema.periodo_encerrado"
    origem: "Scheduler"
    acao: "calcular health scores; emitir relatórios; disparar NPS se trimestral"
  - evento: "melhoria.item.implementado"
    origem: "ENG-09"
    acao: "revisar processos impactados"

kpis_registrados:
  - id: "KPI-CS-01"
    nome: "Churn Rate (Clientes)"
    formula: "clientes_churned / clientes_inicio_periodo * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 2
    limiar_warning: 3
    limiar_critical: 5
  - id: "KPI-CS-02"
    nome: "Churn MRR Rate"
    formula: "churn_mrr / mrr_inicio * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 2
    limiar_warning: 3
  - id: "KPI-CS-03"
    nome: "NRR"
    formula: "referencia KPI-RV-07 do CAP-04"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 100
  - id: "KPI-CS-04"
    nome: "NPS"
    formula: "percentual_promotores - percentual_detratores"
    unidade: "pontos"
    frequencia_calculo: "trimestral"
    meta_padrao: 40
    limiar_warning: 20
    limiar_critical: 0
  - id: "KPI-CS-05"
    nome: "CSAT"
    formula: "respostas_satisfeitos / total_respostas * 100"
    unidade: "percentual"
    frequencia_calculo: "por_evento"
    meta_padrao: 85
  - id: "KPI-CS-06"
    nome: "Distribuição de Health Score"
    formula: "count_por_tier / total_clientes * 100"
    unidade: "percentual por tier"
    dimensao: "tier: verde|amarelo|vermelho"
    frequencia_calculo: "semanal"
    meta_verde: 70
  - id: "KPI-CS-07"
    nome: "Tempo Médio de Onboarding"
    formula: "media(data_M5 - data_contrato)"
    unidade: "dias"
    frequencia_calculo: "mensal"
    meta_padrao: 90
  - id: "KPI-CS-08"
    nome: "Taxa de Conclusão de Onboarding"
    formula: "onboardings_concluidos / onboardings_iniciados * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 90
    limiar_warning: 80
  - id: "KPI-CS-09"
    nome: "Taxa de Retenção em Cancelamentos"
    formula: "retidos / cancelamentos_solicitados * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 40
    limiar_warning: 25
  - id: "KPI-CS-10"
    nome: "Expansion MRR Rate"
    formula: "expansion_mrr / mrr_base * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 5
  - id: "KPI-CS-11"
    nome: "Time to First Value"
    formula: "media(data_M4 - data_contrato)"
    unidade: "dias"
    dimensao: "segmento_id"
    frequencia_calculo: "mensal"

alertas_registrados:
  - id: "ALT-CS-01"
    condicao: "cliente.health_score < 40"
    severidade: "critical"
    owner: "cs_responsavel + gestor_cs"
    acao_automatica: "publicar_health_score_vermelho"
  - id: "ALT-CS-02"
    condicao: "milestone.dias_atraso > 5"
    severidade: "warning"
    owner: "cs_responsavel"
  - id: "ALT-CS-03"
    kpi_ref: "KPI-CS-01"
    condicao: "> 3"
    severidade: "critical"
    owner: "gestor_cs"
    acao_automatica: "disparar_diagnostico_eng04"
  - id: "ALT-CS-04"
    condicao: "nps_score <= 6"
    severidade: "warning"
    owner: "cs_responsavel"
    acao_automatica: "protocolo_detrator_24h"
  - id: "ALT-CS-05"
    kpi_ref: "KPI-CS-06"
    condicao: "percentual_amarelo > 20"
    severidade: "warning"
    owner: "gestor_cs"
  - id: "ALT-CS-06"
    kpi_ref: "KPI-CS-06"
    condicao: "percentual_vermelho > 10"
    severidade: "critical"
    owner: "gestor_cs"
  - id: "ALT-CS-07"
    kpi_ref: "KPI-CS-09"
    condicao: "< 20"
    severidade: "warning"
    owner: "gestor_cs"
  - id: "ALT-CS-08"
    condicao: "cliente.health_score_vermelho AND horas_sem_contato_cs > 48"
    severidade: "critical"
    owner: "gestor_cs"
    acao_automatica: "escalar_para_gestor_cs"
  - id: "ALT-CS-09"
    condicao: "onboarding.dias_sem_conclusao > 120"
    severidade: "warning"
    owner: "cs_responsavel + gestor_cs"

workflows_registrados:
  - id: "WF-CS-01"
    nome: "Iniciação de Onboarding"
    gatilho: "cliente.contrato_assinado"
    descricao: "cria plano, designa CS, envia boas-vindas, agenda kickoff"
  - id: "WF-CS-02"
    nome: "Monitoramento de Milestones"
    gatilho: "milestone.prazo_proximo (3 dias)"
    descricao: "lembra CS; alerta se atrasado"
  - id: "WF-CS-03"
    nome: "Cálculo Semanal de Health Score"
    gatilho: "sistema.periodo_encerrado (semanal)"
    descricao: "calcula health score de todos os clientes ativos"
  - id: "WF-CS-04"
    nome: "Protocolo de Resgate de Cliente Vermelho"
    gatilho: "cliente.health_score_vermelho"
    descricao: "notifica CS, gestor; inicia timer de 48h; escala se não atendido"
  - id: "WF-CS-05"
    nome: "Protocolo de Detrator NPS"
    gatilho: "nps_score <= 6"
    descricao: "notifica CS; timer de 24h; protocolo de acompanhamento"
  - id: "WF-CS-06"
    nome: "Coleta Trimestral de NPS"
    gatilho: "sistema.periodo_encerrado (trimestral)"
    descricao: "dispara pesquisa para todos os clientes ativos"

auditoria_checklists:
  - id: "CAP-05-AUD-SEMANAL"
    tipo: "semanal"
    itens_count: 4
  - id: "CAP-05-AUD-MENSAL"
    tipo: "mensal"
    itens_count: 6

conectores_utilizados:
  - "CONN-CRM-PRINCIPAL"
  - "CONN-EMAIL-TRANSACIONAL"
  - "CONN-MENSAGERIA"
  - "CONN-PESQUISA-NPS"

permissoes_necessarias:
  - recurso: "clientes"
    acoes: ["read", "write", "update_status"]
  - recurso: "onboarding_plans"
    acoes: ["read", "write"]
  - recurso: "health_scores"
    acoes: ["read", "write"]
  - recurso: "oportunidades_expansao"
    acoes: ["read", "write"]
  - recurso: "kpi_values.KPI-CS-*"
    acoes: ["read", "write_via_eng02"]
  - recurso: "eventos_barramento"
    acoes: ["publish", "subscribe"]
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial |
| 2.0.0 | 2026-06-29 | Guardião da Documentação | Redesenho como microserviço do Commercial OS — 16 seções, arquitetura orientada a eventos, ENGINE-REGISTRATION.yaml |
