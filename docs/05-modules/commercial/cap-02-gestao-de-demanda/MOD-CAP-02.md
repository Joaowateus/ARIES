---
id: MOD-CAP-02
titulo: "CAP-02 — Gestão de Demanda"
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
  - MOD-CAP-01
tags: [commercial-os, cap-02, demand-generation, lead-management, qualificacao, pipeline, mql, sql]
---

# CAP-02 — Gestão de Demanda

> **Módulo do Commercial Operating System**
> Infraestrutura compartilhada: `docs/02-architecture/engine-autogestao/`
> Contrato de integração: `ENGINE-CONTRATO-DE-INTEGRACAO.md` (ARC-ENG-099)

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| **ID do Módulo** | CAP-02 |
| **Nome** | Gestão de Demanda |
| **Domínio** | Geração e Qualificação de Oportunidades |
| **Versão** | 2.0.0 |
| **Tier** | Core |
| **Posição na cadeia** | Downstream de CAP-01; Upstream de CAP-03 |
| **Registro na Engine** | `ENGINE-REGISTRATION.yaml` (seção 16) |

---

## 2. Objetivo

Garantir que o Commercial OS opere com **volume suficiente de oportunidades qualificadas** para sustentar as metas de receita — entregando para CAP-03 apenas leads que atendem ao ICP definido por CAP-01, reduzindo desperdício de ciclo de vendas com prospects inadequados.

O CAP-02 é a entrada controlada do funil comercial: ele não apenas gera volume, mas garante qualidade. Um funil grande com leads ruins é pior do que um funil menor com leads qualificados — porque desperdiça capacidade do time de vendas e distorce métricas de performance.

**O CAP-02 não vende. Ele garante que o time de vendas sempre tenha com quem falar — e que vale a pena falar.**

---

## 3. Escopo

### 3.1 Dentro do Escopo
- Planejamento e gestão de canais de geração de demanda (inbound, outbound, parceiros, indicações)
- Captura, registro e enriquecimento de leads
- Qualificação de leads contra o ICP (CAP-01) — classificação MQL/SQL/Fora do ICP
- Gestão do volume e saúde do pipeline de entrada
- Monitoramento de SLA de primeiro contato
- Gestão de cadências de prospecção outbound
- Rastreamento de CPL (Custo por Lead) por canal
- Relatório de geração de demanda por segmento e canal

### 3.2 Fora do Escopo
- Definição do ICP → CAP-01
- Condução de reuniões de descoberta e apresentação → CAP-03
- Negociação e fechamento → CAP-03
- Definição de pricing → CAP-06
- Parceiros como canal de distribuição (gestão do parceiro em si) → CAP-09

---

## 4. Responsabilidades

| # | Responsabilidade | Frequência |
|---|-----------------|-----------|
| R-01 | Manter mix de canais capaz de gerar o volume de SQLs necessários para a meta | Contínuo |
| R-02 | Qualificar 100% dos leads recebidos contra o ICP vigente (CAP-01) | Por lead recebido |
| R-03 | Garantir SLA de primeiro contato ≤ tempo definido por canal | Por lead recebido |
| R-04 | Monitorar CPL por canal e reportar eficiência de geração | Semanal |
| R-05 | Manter pipeline de entrada ≥ 3× a meta de fechamento do período | Contínuo |
| R-06 | Publicar leads qualificados (SQL) para CAP-03 via evento | Por qualificação concluída |
| R-07 | Registrar leads descartados com motivo estruturado (para calibração do ICP) | Por descarte |
| R-08 | Executar cadências de prospecção outbound conforme plano | Por cadência ativa |
| R-09 | Recalibrar critérios de qualificação ao receber `mercado.icp.atualizado` | Por evento recebido |

---

## 5. Capacidades Internas

### CAP-02.1 — Gestão de Canais de Geração de Demanda

O módulo opera um **portfólio de canais** balanceado por volume, custo e qualidade de lead.

**Tipos de canal suportados:**
```yaml
canal_types:
  inbound:
    - "conteúdo orgânico (SEO, blog, vídeo)"
    - "mídia paga (search ads, social ads, display)"
    - "produto-led growth (freemium, trial, demo self-serve)"
    - "eventos e webinars"
    - "relações públicas e assessoria de imprensa"

  outbound:
    - "prospecção direta (cold email, cold call, LinkedIn)"
    - "account-based marketing (ABM)"
    - "outreach em eventos e feiras"

  ecosistema:
    - "indicações de clientes (referral)"
    - "canais de parceiros (CAP-09)"
    - "integradores e revendedores"
    - "co-marketing com parceiros estratégicos"
```

**Estrutura de definição de canal:**
```yaml
canal_definition:
  id: "CANAL-ID"
  nome: "nome do canal"
  tipo: "inbound | outbound | ecosistema"
  sla_primeiro_contato_horas: 1
  meta_leads_mes: 0
  meta_cpl_max: 0.0
  taxa_conversao_mql_esperada: 0.0
  taxa_conversao_sql_esperada: 0.0
  owner: "responsavel_do_canal"
  ativo: true
```

### CAP-02.2 — Captura e Enriquecimento de Leads

Toda entrada de lead no sistema DEVE ser estruturada e enriquecida antes da qualificação.

**Ciclo de vida de um lead:**
```
LEAD_RECEBIDO → ENRIQUECIMENTO → QUALIFICACAO → [MQL | SQL | FORA_DO_ICP | NURTURING]
```

**Enriquecimento automático via ENG-08 (CONN-ENRIQUECIMENTO):**
- Dados firmográficos: porte, setor, faturamento estimado, localização
- Dados de contato: cargo, departamento, LinkedIn
- Dados comportamentais: páginas visitadas, conteúdos baixados, tempo no site
- Dados de intenção: sinal de compra de plataformas de intent data

**Estrutura do lead:**
```yaml
lead:
  id: "LEAD-ID"
  origem_canal: "CANAL-ID"
  status: "novo | enriquecido | qualificado_mql | qualificado_sql | fora_icp | nurturing | descartado"

  dados_contato:
    nome: ""
    email: ""
    telefone: ""
    cargo: ""
    linkedin_url: ""

  dados_organizacao:
    nome_empresa: ""
    setor: ""
    porte_estimado: ""
    faturamento_estimado: ""
    website: ""
    linkedin_empresa_url: ""

  icp_score: null          # calculado na qualificação
  icp_tier: null           # forte | adequado | fora_do_icp
  icp_versao_ref: ""       # versão do ICP usada na qualificação

  motivo_descarte: null    # preenchido se status = descartado | fora_icp
  sla_primeiro_contato_horas: null
  sla_status: "dentro | violado | sem_sla"

  criado_em: ""
  qualificado_em: null
  primeiro_contato_em: null
```

### CAP-02.3 — Qualificação de Leads (ICP Scoring)

O processo de qualificação aplica o ICP vigente (publicado por CAP-01) a cada lead recebido.

**Processo de qualificação:**
```
[1] Receber lead → verificar campos obrigatórios para scoring
[2] Aplicar ICP Score (modelo de pesos do CAP-01 vigente)
[3] Classificar:
    - ICP Score ≥ 7.5 → MQL (Marketing Qualified Lead) — candidato para SQL
    - ICP Score ≥ 5.0 → Adequado — requer descoberta adicional antes de promover
    - ICP Score < 5.0 → Fora do ICP → descartar com motivo | nurturing
[4] Para MQL: iniciar SLA de primeiro contato
[5] Após primeiro contato do SDR/vendedor: avaliar promoção para SQL
    - SQL: budget confirmado + autoridade identificada + necessidade validada + timeline definido
[6] Publicar evento correspondente
```

**Critérios de promoção MQL → SQL (BANT+):**
```yaml
sql_criteria:
  budget: "orçamento disponível ou capacidade de investimento confirmada"
  authority: "tomador de decisão identificado e engajado"
  need: "dor confirmada e alinhada à proposta de valor"
  timeline: "prazo de decisão definido (≤ 90 dias)"
  fit: "ICP score ≥ 5.0 após descoberta aprofundada"
```

### CAP-02.4 — Gestão de Cadências Outbound

Sequências estruturadas de contato para prospecção ativa de contas-alvo.

**Estrutura de cadência:**
```yaml
cadencia_definition:
  id: "CAD-ID"
  nome: "nome da cadência"
  segmento_alvo: "SEG-ID"
  duracao_dias: 21
  touchpoints:
    - dia: 1
      tipo: "email"
      template_id: "TMPL-EMAIL-01"
      assunto: "assunto do email"
    - dia: 3
      tipo: "linkedin_message"
      template_id: "TMPL-LI-01"
    - dia: 5
      tipo: "ligacao"
      script_id: "SCRIPT-01"
    - dia: 8
      tipo: "email"
      template_id: "TMPL-EMAIL-02"
    - dia: 12
      tipo: "ligacao"
    - dia: 17
      tipo: "email"
      template_id: "TMPL-EMAIL-03"
    - dia: 21
      tipo: "break_up_email"
      template_id: "TMPL-BREAKUP-01"
  taxa_resposta_esperada: 0.05
  taxa_conversao_sql_esperada: 0.02
```

### CAP-02.5 — Monitoramento de Saúde do Pipeline de Entrada

O pipeline de entrada é saudável quando mantém volume, qualidade e velocidade adequados.

**Indicadores de saúde do pipeline:**
| Dimensão | Métrica | Limiar de Alerta |
|----------|---------|-----------------|
| Volume | Total de leads no período vs. meta | < 80% da meta |
| Qualidade | % leads dentro do ICP | < 60% |
| Velocidade | Tempo médio de qualificação | > 48h |
| Cobertura | Pipeline vs. meta de receita (3×) | < 2.5× |
| SLA | % leads com primeiro contato no prazo | < 90% |

---

## 6. Fluxo Operacional

```
[FLUXO A — LEAD INBOUND]

[TRIGGER: lead.recebido via formulário, CRM, landing page, evento]
│
├─► Registrar lead no sistema (ENG-01 → instância de processo)
│
├─► Enriquecer dados automaticamente (ENG-07 → ENG-08 → CONN-ENRIQUECIMENTO)
│   └─► Se enriquecimento falha: manter dados originais; marcar para enriquecimento manual
│
├─► Calcular ICP Score (aplicar modelo ICP vigente de CAP-01)
│
├─► Classificar resultado:
│   │
│   ├─► ICP Forte (≥ 7.5) → status: MQL
│   │   ├─► Iniciar SLA de primeiro contato (timer via ENG-01)
│   │   ├─► Notificar SDR responsável (ENG-03 → CONN-MENSAGERIA)
│   │   └─► Publicar: demanda.lead.qualificado_mql
│   │
│   ├─► ICP Adequado (≥ 5.0) → status: adequado
│   │   ├─► Colocar em fila de qualificação adicional
│   │   └─► Publicar: demanda.lead.em_qualificacao
│   │
│   └─► Fora do ICP (< 5.0) → status: fora_icp
│       ├─► Registrar motivo de descarte
│       ├─► Avaliar: nurturing ou descarte definitivo
│       └─► Publicar: demanda.lead.descartado
│
└─► [Para MQL] SDR realiza primeiro contato
    ├─► Contato realizado dentro do SLA → SLA: dentro
    ├─► Contato não realizado no SLA → ALT-DM-01 (SLA violado)
    │
    └─► Após descoberta aprofundada:
        ├─► Critérios SQL atendidos → promover para SQL
        │   └─► Publicar: demanda.lead.qualificado_sql → CAP-03 consome
        └─► Critérios SQL não atendidos → nurturing ou descarte


[FLUXO B — PROSPECÇÃO OUTBOUND]

[TRIGGER: plano de outbound ativo + conta-alvo identificada]
│
├─► Selecionar contas-alvo (filtrar pelo ICP vigente de CAP-01)
│
├─► Enriquecer contatos-alvo (ENG-08 → CONN-ENRIQUECIMENTO, CONN-LINKEDIN)
│
├─► Iniciar cadência outbound (ENG-07 → sequência de touchpoints)
│   │
│   └─► Para cada touchpoint:
│       ├─► Executar (email via CONN-EMAIL-TRANSACIONAL, LinkedIn via CONN-LINKEDIN)
│       ├─► Registrar resultado: sem_resposta | bounce | resposta_negativa | resposta_positiva
│       └─► Resposta positiva → criar lead e iniciar fluxo A (qualificação)
│
├─► Ao final da cadência sem resposta: marcar conta como descartada_cadencia
│   └─► Re-ativação permitida após 90 dias (cooldown)
│
└─► KPIs de outbound atualizados: taxa de abertura, resposta, conversão por cadência


[FLUXO C — RECALIBRAÇÃO POR ICP ATUALIZADO]

[TRIGGER: mercado.icp.atualizado recebido de CAP-01]
│
├─► Recalcular ICP Score de todos os leads ativos (status ≠ sql | descartado)
│
├─► Leads que mudam de tier → atualizar status + notificar responsável
│
├─► Atualizar critérios de qualificação dos formulários e scripts de SDR
│
└─► Publicar: demanda.pipeline.recalibrado (com resumo das mudanças)
```

---

## 7. Estados

### 7.1 Estados do Lead

```
RECEBIDO → ENRIQUECENDO → ENRIQUECIDO → EM_QUALIFICACAO
                                              │
                         ┌────────────────────┼──────────────────────┐
                         ▼                    ▼                      ▼
                       MQL                ADEQUADO              FORA_DO_ICP
                         │                    │                      │
                    PRIMEIRO_CONTATO    QUALIFICACAO_ADICIONAL   NURTURING | DESCARTADO
                         │                    │
                        SQL ←────────────────┘
                         │
                    [CAP-03 assume]
```

### 7.2 Estados da Cadência Outbound

```
PLANEJADA → ATIVA → PAUSADA → CONCLUIDA_SEM_RESPOSTA | CONVERTIDA
```

### 7.3 Estados do Canal

```
ATIVO → EM_AVALIACAO (performance abaixo do limiar) → SUSPENSO | OTIMIZADO
```

---

## 8. Regras de Negócio

### RN-01 — Qualificação Obrigatória por ICP Vigente
Todo lead DEVE ser qualificado contra a versão vigente do ICP (CAP-01). Proibido qualificar leads manualmente sem aplicar o ICP Score. A versão do ICP utilizada deve ser registrada no lead para rastreabilidade.

### RN-02 — SLA de Primeiro Contato
O SLA de primeiro contato é definido por canal e configurado no `canal_definition`. O padrão global é ≤ 1 hora para inbound com interesse explícito (demo request, formulário de contato) e ≤ 24 horas para demais leads. Violação de SLA gera alerta automático ALT-DM-01.

### RN-03 — SQL Requer Todos os Critérios BANT+
A promoção de MQL para SQL exige confirmação dos 5 critérios (Budget, Authority, Need, Timeline, Fit). Promoção sem todos os critérios requer aprovação do gestor e registro de justificativa. Leads promovidos incorretamente distorcem métricas de CAP-03.

### RN-04 — Pipeline Mínimo de 3× a Meta
O volume de leads no pipeline de entrada DEVE ser mantido em pelo menos 3× o valor da meta de fechamento do período. Abaixo de 2.5× é alerta WARNING; abaixo de 2× é CRITICAL. Esse índice é calculado semanalmente.

### RN-05 — Descarte Requer Motivo Estruturado
Todo lead descartado ou classificado como Fora do ICP DEVE ter o motivo registrado em campo estruturado (não texto livre). Os motivos são taxonomia predefinida: fora_porte, fora_setor, sem_budget, sem_autoridade, timing_futuro, concorrente_instalado, duplicata, sem_interesse.

### RN-06 — Cooldown de Reabordagem
Leads descartados como fora_do_icp ou contas que completaram cadência outbound sem resposta DEVEM respeitar um cooldown de 90 dias antes de nova abordagem. Reabordagem antes do cooldown requer aprovação do gestor.

### RN-07 — Canais com CPL Sistematicamente Acima do Limite São Revisados
Todo canal com CPL acima do limite configurado por 2 meses consecutivos entra em `EM_AVALIACAO` automaticamente. O responsável tem 30 dias para apresentar plano de otimização ou o canal é suspenso.

### RN-08 — Enriquecimento Não Bloqueia Qualificação
Falha no enriquecimento automático NÃO impede a qualificação do lead. O sistema qualifica com os dados disponíveis e marca o lead para enriquecimento manual pendente. Lead não pode ficar bloqueado aguardando enriquecimento.

### RN-09 — Recalibração Automática ao Atualizar ICP
Ao receber `mercado.icp.atualizado`, o módulo DEVE recalcular o ICP Score de todos os leads ativos. Leads que mudam de tier (ex: de MQL para Fora do ICP ou vice-versa) têm seu status atualizado automaticamente e os responsáveis são notificados.

---

## 9. Eventos Publicados

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `demanda.lead.recebido` | Novo lead capturado antes da qualificação | `{lead_id, canal_id, origem, dados_capturados_json}` |
| `demanda.lead.qualificado_mql` | Lead classificado como MQL | `{lead_id, icp_score, icp_tier, icp_versao_ref, canal_id}` |
| `demanda.lead.qualificado_sql` | Lead promovido para SQL (critérios BANT+ atendidos) | `{lead_id, segmento_id, valor_estimado, responsavel_sdr, dados_qualificacao_json}` |
| `demanda.lead.em_qualificacao` | Lead adequado em processo de descoberta adicional | `{lead_id, icp_score, responsavel_sdr}` |
| `demanda.lead.descartado` | Lead descartado (fora ICP ou sem potencial) | `{lead_id, motivo_descarte, canal_id, icp_score}` |
| `demanda.lead.sla_violado` | Primeiro contato não realizado no prazo | `{lead_id, canal_id, sla_configurado_horas, tempo_decorrido_horas, responsavel}` |
| `demanda.pipeline.minimo_violado` | Volume do pipeline < 2.5× a meta | `{cobertura_atual, meta_cobertura, deficit_leads, segmentos_deficitarios[]}` |
| `demanda.pipeline.recalibrado` | Pipeline recalculado após ICP atualizado | `{icp_versao_anterior, icp_versao_nova, leads_reclassificados, mudancas_resumo_json}` |
| `demanda.canal.em_avaliacao` | Canal com CPL acima do limite por 2 meses | `{canal_id, cpl_atual, cpl_limite, meses_acima}` |
| `demanda.cadencia.convertida` | Cadência outbound gerou lead qualificado | `{cadencia_id, lead_id, touchpoint_conversao, tentativas_ate_conversao}` |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `mercado.icp.atualizado` | CAP-01 | Recalcular ICP Score de todos os leads ativos; atualizar critérios de qualificação |
| `mercado.qualificacao.criterios_atualizados` | CAP-01 | Atualizar perguntas/scripts de qualificação dos SDRs |
| `mercado.segmento.atualizado` | CAP-01 | Revisar segmentação dos canais e cadências ativas |
| `kpi.limiar.cruzado` | ENG-02 | Se KPI afetado é volume de pipeline: disparar alerta de demanda |
| `sistema.periodo_encerrado` | Scheduler | Calcular KPIs de geração de demanda; emitir relatório de canais |
| `parceiro.lead_indicado` | CAP-09 | Registrar lead como recebido; iniciar fluxo de qualificação com origem = parceiro |
| `melhoria.item.implementado` | ENG-09 | Se melhoria afeta CAP-02: revisar processos impactados |

---

## 11. KPIs

> Registrados e calculados via ENG-02.

| ID | Nome | Fórmula | Meta | Frequência |
|----|------|---------|------|-----------|
| KPI-DM-01 | Volume de Leads Gerados | `count(leads_recebidos)` | Por plano | Mensal |
| KPI-DM-02 | Taxa de Conversão Lead → MQL | `mqls / leads_total × 100` | ≥ 30% | Mensal |
| KPI-DM-03 | Taxa de Conversão MQL → SQL | `sqls / mqls × 100` | ≥ 50% | Mensal |
| KPI-DM-04 | Taxa de Conversão Lead → SQL | `sqls / leads_total × 100` | ≥ 15% | Mensal |
| KPI-DM-05 | CPL por Canal | `investimento_canal / leads_canal` | Por canal | Mensal |
| KPI-DM-06 | Cobertura de Pipeline | `valor_pipeline / meta_fechamento` | ≥ 3× | Semanal |
| KPI-DM-07 | SLA de Primeiro Contato | `leads_no_sla / total_mqls × 100` | ≥ 90% | Semanal |
| KPI-DM-08 | Tempo Médio de Qualificação | `média(qualificado_em - recebido_em)` | ≤ 48h | Semanal |
| KPI-DM-09 | Taxa de Leads Dentro do ICP | `leads_icp_adequado / total_leads × 100` | ≥ 60% | Mensal |
| KPI-DM-10 | Taxa de Resposta Outbound | `respostas / touchpoints_enviados × 100` | Por cadência | Mensal |

---

## 12. Alertas

> Gerenciados pela ENG-03.

| ID | Condição | Severidade | Ação |
|----|---------|-----------|------|
| ALT-DM-01 | SLA de primeiro contato violado | WARNING | Notificar SDR + gestor imediatamente |
| ALT-DM-02 | Cobertura de pipeline < 2.5× | WARNING | Publicar `demanda.pipeline.minimo_violado`; revisar canais |
| ALT-DM-03 | Cobertura de pipeline < 2× | CRITICAL | Escalar para liderança; plano de demanda emergencial |
| ALT-DM-04 | Taxa de leads dentro do ICP < 50% | WARNING | Revisar fontes de captação; verificar calibração do ICP score |
| ALT-DM-05 | Taxa de conversão MQL→SQL < 30% | WARNING | Disparar diagnóstico ENG-04; revisar critérios SQL |
| ALT-DM-06 | CPL de canal > limite por 2 meses consecutivos | WARNING | Publicar `demanda.canal.em_avaliacao` |
| ALT-DM-07 | Volume de SQLs entregues < 80% da meta do mês | CRITICAL | Escalar para gestor; acionar plano de demanda |
| ALT-DM-08 | Tempo médio de qualificação > 72h | WARNING | Verificar capacidade do time de SDRs |

---

## 13. Planos de Ação Automáticos

> Executados via ENG-05.

### PA-DM-01 — Pipeline Crítico (Gatilho: ALT-DM-03)
```yaml
plano_acao:
  tipo: emergencia_de_demanda
  prazo_dias: 14
  tarefas:
    - "Mapear canais com maior potencial de escala imediata (histórico de volume)"
    - "Aumentar investimento nos canais de melhor CPL (proposta para aprovação)"
    - "Ativar cadências outbound para contas-alvo em estado de reabordagem permitida"
    - "Acionar CAP-09: solicitar leads de parceiros ativos"
    - "Revisar leads em nurturing: identificar candidatos a requalificação"
  metrica_sucesso: "Cobertura de pipeline ≥ 2.5× em 14 dias"
```

### PA-DM-02 — SLA Sistematicamente Violado (Gatilho: ALT-DM-01 recorrente)
```yaml
plano_acao:
  tipo: correcao_operacional
  prazo_dias: 10
  tarefas:
    - "Analisar: violações são de SDR específico ou sistêmicas?"
    - "Se sistêmicas: verificar capacidade do time vs. volume de MQLs"
    - "Se time subdimensionado: escalar para CAP-07 (gestão de equipe)"
    - "Se processo: revisar distribuição automática de leads (workflow WF-DM-02)"
    - "Se tecnologia: verificar notificações e integrações via ENG-08"
  metrica_sucesso: "SLA de primeiro contato ≥ 90% em 30 dias"
```

### PA-DM-03 — Conversão MQL→SQL Baixa (Gatilho: ALT-DM-05)
```yaml
plano_acao:
  tipo: diagnostico_qualidade
  prazo_dias: 21
  tarefas:
    - "ENG-04: analisar padrões de MQLs não convertidos para SQL"
    - "Identificar: problema é no ICP Score (qualidade da triagem) ou na qualificação (SDR)?"
    - "Se ICP Score: verificar com CAP-01 se critérios de scoring estão calibrados"
    - "Se SDR: analisar gravações de qualificação; identificar gaps de script ou habilidade"
    - "Atualizar script de qualificação ou solicitar treinamento via CAP-07"
  metrica_sucesso: "Conversão MQL→SQL ≥ 40% em 60 dias"
```

---

## 14. Automações

> Via ENG-07 + ENG-08.

| ID | Trigger | Ação Automatizada | Conector |
|----|---------|-----------------|---------|
| AUT-DM-01 | Lead recebido (qualquer canal) | Enriquecer dados; calcular ICP score; classificar; notificar SDR | CONN-ENRIQUECIMENTO, CONN-MENSAGERIA |
| AUT-DM-02 | Lead MQL sem contato após 30 min | Renotificar SDR; após 1h, escalar para gestor | CONN-MENSAGERIA |
| AUT-DM-03 | Lead MQL sem contato após SLA | Registrar violação de SLA; disparar ALT-DM-01 | ENG-03 |
| AUT-DM-04 | `mercado.icp.atualizado` recebido | Recalcular scores de leads ativos; notificar sobre mudanças de tier | CONN-CRM-PRINCIPAL, CONN-MENSAGERIA |
| AUT-DM-05 | Touchpoint de cadência programado | Executar envio (email/LinkedIn); registrar resultado | CONN-EMAIL-TRANSACIONAL, CONN-LINKEDIN |
| AUT-DM-06 | `sistema.periodo_encerrado` (semanal) | Calcular cobertura de pipeline; disparar alerta se < 2.5× | ENG-02, ENG-03 |
| AUT-DM-07 | `sistema.periodo_encerrado` (mensal) | Calcular KPI-DM-01 a KPI-DM-10; gerar relatório de canais | ENG-02 |
| AUT-DM-08 | Canal em avaliação aprovado para suspensão | Pausar workflows de canal; notificar responsável | ENG-07, CONN-MENSAGERIA |

---

## 15. Auditoria Operacional

> Via ENG-06.

### Checklist Semanal — CAP-02-AUD-SEMANAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Cobertura de pipeline ≥ 3× a meta | KPI-DM-06 | Valor do KPI |
| 2 | SLA de primeiro contato ≥ 90% | KPI-DM-07 | Valor do KPI |
| 3 | Nenhum MQL com contato pendente > 2× o SLA | Lista de violações | Zero violações > 2× SLA |
| 4 | Cadências outbound ativas executando conforme plano | Log de touchpoints | 100% dos touchpoints programados executados |

### Checklist Mensal — CAP-02-AUD-MENSAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Taxa de leads dentro do ICP ≥ 60% | KPI-DM-09 | Valor do KPI |
| 2 | Conversão MQL→SQL ≥ meta definida | KPI-DM-03 | Valor do KPI |
| 3 | CPL por canal dentro do limite configurado | KPI-DM-05 | Todos os canais dentro do limite |
| 4 | 100% dos descartados têm motivo estruturado | Verificar campo motivo_descarte | Zero registros com motivo nulo |
| 5 | Recalibração de ICP aplicada se ICP foi atualizado no período | Log de eventos recebidos | Confirmação de recalibração |
| 6 | Alertas do mês tratados dentro do SLA da ENG-03 | Taxa de resolução | ≥ 90% no SLA |

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml — CAP-02 Gestão de Demanda
# Ref: ARC-ENG-099

modulo:
  id: "CAP-02"
  nome: "Gestão de Demanda"
  versao: "2.0.0"
  tier: "core"
  status: "ativo"

dependencias:
  modulos:
    - id: "CAP-01"
      uso: "consumir ICP vigente para qualificação de leads"
  engines:
    - id: "ENG-01"
      uso: "rastreamento de instâncias de qualificação e cadências"
    - id: "ENG-02"
      uso: "KPIs KPI-DM-01 a KPI-DM-10"
    - id: "ENG-03"
      uso: "alertas ALT-DM-01 a ALT-DM-08"
    - id: "ENG-04"
      uso: "diagnóstico de baixa conversão e qualidade de pipeline"
    - id: "ENG-05"
      uso: "planos de ação PA-DM-01 a PA-DM-03"
    - id: "ENG-06"
      uso: "auditoria semanal e mensal"
    - id: "ENG-07"
      uso: "workflows AUT-DM-01 a AUT-DM-08"
    - id: "ENG-08"
      uso: "enriquecimento de leads, envio de email/LinkedIn, integração CRM"
    - id: "ENG-10"
      uso: "sugestões de qualificação e padrões de leads históricos"

eventos_publicados:
  - evento: "demanda.lead.recebido"
    condicao: "novo lead capturado antes da qualificação"
  - evento: "demanda.lead.qualificado_mql"
    condicao: "lead classificado como MQL"
  - evento: "demanda.lead.qualificado_sql"
    condicao: "lead promovido para SQL com todos os critérios BANT+ atendidos"
  - evento: "demanda.lead.em_qualificacao"
    condicao: "lead adequado em descoberta adicional"
  - evento: "demanda.lead.descartado"
    condicao: "lead descartado com motivo estruturado"
  - evento: "demanda.lead.sla_violado"
    condicao: "primeiro contato não realizado no prazo"
  - evento: "demanda.pipeline.minimo_violado"
    condicao: "cobertura de pipeline < 2.5×"
  - evento: "demanda.pipeline.recalibrado"
    condicao: "recalculado após ICP atualizado"
  - evento: "demanda.canal.em_avaliacao"
    condicao: "CPL acima do limite por 2+ meses"
  - evento: "demanda.cadencia.convertida"
    condicao: "cadência outbound gerou lead qualificado"

eventos_consumidos:
  - evento: "mercado.icp.atualizado"
    origem: "CAP-01"
    acao: "recalcular ICP scores e atualizar critérios de qualificação"
  - evento: "mercado.qualificacao.criterios_atualizados"
    origem: "CAP-01"
    acao: "atualizar perguntas e scripts de SDR"
  - evento: "mercado.segmento.atualizado"
    origem: "CAP-01"
    acao: "revisar segmentação de canais e cadências"
  - evento: "kpi.limiar.cruzado"
    origem: "ENG-02"
    acao: "disparar alerta de demanda se KPI é volume ou cobertura"
  - evento: "sistema.periodo_encerrado"
    origem: "Scheduler"
    acao: "calcular KPIs; emitir relatório de canais"
  - evento: "parceiro.lead_indicado"
    origem: "CAP-09"
    acao: "registrar lead com origem = parceiro; iniciar qualificação"
  - evento: "melhoria.item.implementado"
    origem: "ENG-09"
    acao: "revisar processos impactados"
  - evento: "performance.metas_atualizadas"
    origem: "CAP-08"
    acao: "atualizar meta de volume de leads e pipeline coverage de referência; recalibrar limiares de alerta"

kpis_registrados:
  - id: "KPI-DM-01"
    nome: "Volume de Leads Gerados"
    formula: "count(leads_recebidos_no_periodo)"
    unidade: "quantidade"
    frequencia_calculo: "mensal"
  - id: "KPI-DM-02"
    nome: "Taxa de Conversão Lead → MQL"
    formula: "mqls / leads_total * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 30
    limiar_warning: 20
  - id: "KPI-DM-03"
    nome: "Taxa de Conversão MQL → SQL"
    formula: "sqls / mqls * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 50
    limiar_warning: 30
  - id: "KPI-DM-04"
    nome: "Taxa de Conversão Lead → SQL"
    formula: "sqls / leads_total * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 15
  - id: "KPI-DM-05"
    nome: "CPL por Canal"
    formula: "investimento_canal / leads_gerados_canal"
    unidade: "moeda"
    dimensao: "canal_id"
    frequencia_calculo: "mensal"
    meta_padrao: "configurado por canal"
  - id: "KPI-DM-06"
    nome: "Cobertura de Pipeline"
    formula: "valor_total_pipeline / meta_fechamento_periodo"
    unidade: "multiplicador"
    frequencia_calculo: "semanal"
    meta_padrao: 3.0
    limiar_warning: 2.5
    limiar_critical: 2.0
  - id: "KPI-DM-07"
    nome: "SLA de Primeiro Contato"
    formula: "leads_contactados_no_sla / total_mqls * 100"
    unidade: "percentual"
    frequencia_calculo: "semanal"
    meta_padrao: 90
    limiar_warning: 80
    limiar_critical: 70
  - id: "KPI-DM-08"
    nome: "Tempo Médio de Qualificação"
    formula: "media(qualificado_em - recebido_em)"
    unidade: "horas"
    frequencia_calculo: "semanal"
    meta_padrao: 48
    limiar_warning: 72
  - id: "KPI-DM-09"
    nome: "Taxa de Leads Dentro do ICP"
    formula: "leads_icp_adequado / total_leads * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 60
    limiar_warning: 50
  - id: "KPI-DM-10"
    nome: "Taxa de Resposta Outbound"
    formula: "respostas_positivas / touchpoints_enviados * 100"
    unidade: "percentual"
    dimensao: "cadencia_id"
    frequencia_calculo: "mensal"

alertas_registrados:
  - id: "ALT-DM-01"
    condicao: "lead.sla_primeiro_contato_violado = true"
    severidade: "warning"
    owner: "sdr_responsavel + gestor_comercial"
  - id: "ALT-DM-02"
    kpi_ref: "KPI-DM-06"
    condicao: "< 2.5"
    severidade: "warning"
    owner: "responsavel_cap02"
  - id: "ALT-DM-03"
    kpi_ref: "KPI-DM-06"
    condicao: "< 2.0"
    severidade: "critical"
    owner: "gestor_comercial"
    acao_automatica: "publicar_demanda_pipeline_abaixo_minimo"
  - id: "ALT-DM-04"
    kpi_ref: "KPI-DM-09"
    condicao: "< 50"
    severidade: "warning"
    owner: "responsavel_cap02"
  - id: "ALT-DM-05"
    kpi_ref: "KPI-DM-03"
    condicao: "< 30"
    severidade: "warning"
    owner: "responsavel_cap02"
    acao_automatica: "disparar_diagnostico_eng04"
  - id: "ALT-DM-06"
    condicao: "canal.meses_cpl_acima_limite >= 2"
    severidade: "warning"
    owner: "responsavel_cap02"
    acao_automatica: "publicar_canal_em_avaliacao"
  - id: "ALT-DM-07"
    condicao: "sqls_entregues < meta_sqls * 0.80"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-DM-08"
    kpi_ref: "KPI-DM-08"
    condicao: "> 72"
    severidade: "warning"
    owner: "responsavel_cap02"

workflows_registrados:
  - id: "WF-DM-01"
    nome: "Qualificação Automática de Lead Inbound"
    gatilho: "lead recebido de qualquer canal"
    descricao: "enriquece, calcula ICP score, classifica, notifica SDR"
  - id: "WF-DM-02"
    nome: "Escalação de SLA de Primeiro Contato"
    gatilho: "timer após MQL criado"
    descricao: "renotifica após 30 min, escala após SLA violado"
  - id: "WF-DM-03"
    nome: "Recalibração de Pipeline por ICP"
    gatilho: "mercado.icp.atualizado"
    descricao: "recalcula scores ativos, atualiza tiers, notifica mudanças"
  - id: "WF-DM-04"
    nome: "Execução de Cadência Outbound"
    gatilho: "cadência ativa + touchpoint agendado"
    descricao: "executa envio, registra resultado, avança ou encerra cadência"

auditoria_checklists:
  - id: "CAP-02-AUD-SEMANAL"
    tipo: "semanal"
    itens_count: 4
  - id: "CAP-02-AUD-MENSAL"
    tipo: "mensal"
    itens_count: 6

conectores_utilizados:
  - "CONN-CRM-PRINCIPAL"
  - "CONN-ENRIQUECIMENTO"
  - "CONN-EMAIL-TRANSACIONAL"
  - "CONN-LINKEDIN"
  - "CONN-MENSAGERIA"
  - "CONN-ADS"
  - id: "CONN-MARKETING-AUTOMATION"
    tipo: BIDIRECTIONAL
    proposito: "Transferir leads em estado em_nutricao para sistema externo de automação de marketing; receber notificação quando lead re-qualificado retorna ao pipeline"

permissoes_necessarias:
  - recurso: "leads"
    acoes: ["read", "write", "update_status"]
  - recurso: "canal_definitions"
    acoes: ["read", "write"]
  - recurso: "cadencia_definitions"
    acoes: ["read", "write", "execute"]
  - recurso: "icp_definitions"
    acoes: ["read"]
  - recurso: "kpi_values.KPI-DM-*"
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
