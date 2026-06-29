---
id: MOD-CAP-03
titulo: "CAP-03 — Gestão do Processo de Vendas"
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
  - MOD-CAP-02
  - MOD-CAP-06
tags: [commercial-os, cap-03, sales-process, funil, oportunidade, negociacao, fechamento, contrato]
---

# CAP-03 — Gestão do Processo de Vendas

> **Módulo do Commercial Operating System**
> Infraestrutura compartilhada: `docs/02-architecture/engine-autogestao/`
> Contrato de integração: `ENGINE-CONTRATO-DE-INTEGRACAO.md` (ARC-ENG-099)

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| **ID do Módulo** | CAP-03 |
| **Nome** | Gestão do Processo de Vendas |
| **Domínio** | Conversão — Transformação de Oportunidades em Receita |
| **Versão** | 2.0.0 |
| **Tier** | Core |
| **Posição na cadeia** | Downstream de CAP-02; Upstream de CAP-04 e CAP-05 |
| **Registro na Engine** | `ENGINE-REGISTRATION.yaml` (seção 16) |

---

## 2. Objetivo

Converter SQLs entregues por CAP-02 em **contratos assinados e clientes ativos**, através de um processo de vendas estruturado, rastreável e auditável — com estágios bem definidos, critérios de avanço objetivos, controle de negociação e formalização contratual.

O CAP-03 é o núcleo de geração de receita do Commercial OS: ele transforma o trabalho epistêmico de CAP-01 e o trabalho de qualificação de CAP-02 em resultado financeiro real. Sua eficiência determina o ROI de toda a operação comercial.

**O CAP-03 converte. Cada oportunidade processada é um ativo gerenciado com disciplina — não um evento aleatório dependente de talento individual.**

---

## 3. Escopo

### 3.1 Dentro do Escopo
- Gestão do funil de vendas com estágios e critérios de exit definidos
- Condução estruturada de reuniões de descoberta, apresentação, proposta e negociação
- Controle de descontos e níveis de autorização
- Gestão de propostas comerciais (geração, envio, acompanhamento, expiração)
- Formalização contratual (geração, assinatura eletrônica, arquivamento)
- Forecast de receita baseado no funil
- Análise de oportunidades perdidas (via publicação de evento para CAP-01)
- Rastreamento de ciclo de venda por segmento

### 3.2 Fora do Escopo
- Qualificação inicial de leads → CAP-02
- Onboarding do cliente pós-fechamento → CAP-05
- Gestão financeira e cobranças → CAP-04
- Definição de preços e descontos permitidos → CAP-06
- Análise Win/Loss detalhada → CAP-01
- Comissão de vendedores → CAP-07

---

## 4. Responsabilidades

| # | Responsabilidade | Frequência |
|---|-----------------|-----------|
| R-01 | Receber SQLs de CAP-02 e abrir oportunidades no funil | Por evento recebido |
| R-02 | Garantir que cada oportunidade avance apenas com exit criteria atendidos | Por transição de estágio |
| R-03 | Controlar descontos dentro dos limites autorizados por nível | Por proposta gerada |
| R-04 | Formalizar contratos em 100% dos negócios fechados | Por fechamento |
| R-05 | Manter ciclo de venda dentro dos benchmarks por segmento | Contínuo |
| R-06 | Produzir forecast semanal baseado em probabilidade por estágio | Semanal |
| R-07 | Publicar `oportunidade.encerrada` ao fechar ou perder um negócio | Por encerramento |
| R-08 | Publicar `oportunidade.ganha` ao fechar contrato assinado | Por fechamento |
| R-09 | Garantir que todos os contratos assinados são roteados para CAP-05 | Por contrato assinado |

---

## 5. Capacidades Internas

### CAP-03.1 — Funil de Vendas com Exit Criteria

O funil é a estrutura sequencial que cada oportunidade percorre. **Cada estágio tem exit criteria objetivos** que devem ser satisfeitos antes do avanço.

**Estrutura padrão do funil (configurável por segmento):**

```yaml
funil_definition:
  id: "FUNIL-PADRAO"
  nome: "Funil Comercial Padrão"
  segmento_ref: null  # null = aplica a todos; ou SEG-ID específico

  estagios:
    - id: "E1"
      nome: "Descoberta"
      descricao: "Entender contexto, dores e objetivos do prospect"
      probabilidade_ponderada: 0.10
      sla_dias: 7
      exit_criteria:
        - "dor principal identificada e documentada"
        - "stakeholders do processo de decisão mapeados"
        - "timeline de decisão estimado"
        - "ICP score confirmado ≥ 5.0"

    - id: "E2"
      nome: "Qualificação Aprofundada"
      descricao: "Confirmar budget, autoridade, necessidade e timeline"
      probabilidade_ponderada: 0.20
      sla_dias: 10
      exit_criteria:
        - "budget disponível ou liberável confirmado"
        - "decision maker identificado e engajado"
        - "necessidade validada e alinhada à proposta de valor"
        - "timeline de decisão definido (≤ 90 dias)"

    - id: "E3"
      nome: "Apresentação de Solução"
      descricao: "Demonstrar como a solução resolve as dores identificadas"
      probabilidade_ponderada: 0.35
      sla_dias: 14
      exit_criteria:
        - "demo ou apresentação realizada para decision maker"
        - "proposta de valor validada pelo prospect"
        - "objeções técnicas mapeadas e respondidas"
        - "próximos passos acordados com data"

    - id: "E4"
      nome: "Proposta Comercial"
      descricao: "Envio e negociação da proposta formal"
      probabilidade_ponderada: 0.60
      sla_dias: 10
      exit_criteria:
        - "proposta enviada formalmente"
        - "proposta recebida e revisada pelo prospect"
        - "objeções comerciais mapeadas"
        - "desconto aplicado dentro do nível autorizado"

    - id: "E5"
      nome: "Negociação"
      descricao: "Alinhamento final de condições comerciais e contratuais"
      probabilidade_ponderada: 0.80
      sla_dias: 14
      exit_criteria:
        - "condições comerciais acordadas (valor, prazo, forma de pagamento)"
        - "cláusulas contratuais revisadas"
        - "aprovação interna de desconto obtida (se aplicável)"

    - id: "E6"
      nome: "Fechamento"
      descricao: "Assinatura do contrato e ativação do cliente"
      probabilidade_ponderada: 1.00
      sla_dias: 7
      exit_criteria:
        - "contrato assinado por ambas as partes"
        - "primeiro pagamento confirmado ou faturado"
        - "dados de onboarding coletados"
```

### CAP-03.2 — Gestão de Propostas

Controle do ciclo de vida de propostas comerciais.

```yaml
proposta:
  id: "PROP-ID"
  oportunidade_id: "OPP-ID"
  versao: 1
  status: "rascunho | enviada | visualizada | em_negociacao | aceita | recusada | expirada"

  valor_total: 0.0
  valor_com_desconto: 0.0
  desconto_percentual: 0.0
  nivel_desconto_aplicado: "N0 | N1 | N2 | N3"  # ref: CAP-06
  aprovador_desconto: null  # preenchido se N2 ou N3

  validade_dias: 30
  expira_em: ""
  enviada_em: null
  aceita_em: null

  itens_json: []  # produtos/serviços com valores individuais
  condicoes_pagamento: ""
  observacoes_negociacao: ""
```

**Regra de aprovação de descontos (recebe limites de CAP-06):**
| Nível | Desconto Máximo | Aprovador |
|-------|----------------|-----------|
| N0 | 0% (preço de tabela) | Vendedor |
| N1 | Até limite N1 (configurado por CAP-06) | Vendedor |
| N2 | Até limite N2 | Gestor comercial |
| N3 | Acima do limite N2 | Diretoria |

### CAP-03.3 — Formalização Contratual

Gestão do ciclo de vida de contratos desde geração até assinatura.

```yaml
contrato:
  id: "CTR-ID"
  oportunidade_id: "OPP-ID"
  proposta_id: "PROP-ID"
  status: "rascunho | enviado_para_assinatura | assinado | cancelado | expirado"

  tipo: "novo_cliente | renovacao | expansao | aditivo"
  template_id: "TMPL-CTR-ID"

  valor_total: 0.0
  valor_mensal_recorrente: 0.0
  duracao_meses: 0
  data_inicio: ""
  data_fim: ""
  renovacao_automatica: false

  signatarios_json: []  # lista de signatários com status individual
  assinado_cliente_em: null
  assinado_empresa_em: null
  url_documento_assinado: ""  # armazenado em CONN-REPOSITORIO-DOCS

  enviado_em: null
  assinado_em: null
```

### CAP-03.4 — Forecast de Receita

Projeção de fechamento baseada no pipeline ponderado por probabilidade de estágio.

```yaml
forecast:
  periodo: "mês/trimestre"
  data_geracao: ""

  pipeline_ponderado:
    formula: "soma(valor_oportunidade × probabilidade_estagio)"
    valor_total: 0.0

  forecast_conservador:
    formula: "soma(valor × prob se prob >= 0.80)"
    valor: 0.0

  forecast_realista:
    formula: "soma(valor × prob)"
    valor: 0.0

  forecast_otimista:
    formula: "soma(valor × prob) + soma(valor de E3/E4 com alta confiança)"
    valor: 0.0

  accuracy_historica:
    mes_anterior: null  # % de acurácia do forecast anterior
    trimestre_anterior: null

  principais_riscos: []  # oportunidades grandes em risco de slip
```

---

## 6. Fluxo Operacional

```
[FLUXO A — CICLO DE VIDA DA OPORTUNIDADE]

[TRIGGER: demanda.lead.qualificado_sql recebido de CAP-02]
│
├─► Criar oportunidade no funil (estágio E1 — Descoberta)
│   └─► ENG-01 cria instância de processo com SLA de E1
│
├─► [E1 — DESCOBERTA]
│   ├─► Vendedor conduz reunião de descoberta
│   ├─► Preencher exit criteria de E1 no sistema
│   ├─► Exit criteria atendidos? → avançar para E2
│   └─► Exit criteria não atendidos após SLA → ALT-VP-02 (oportunidade parada)
│
├─► [E2 — QUALIFICAÇÃO APROFUNDADA]
│   ├─► Confirmar BANT com decision maker
│   ├─► Exit criteria atendidos? → avançar para E3
│   └─► Não atendidos → rebaixar para nurturing | descartar
│
├─► [E3 — APRESENTAÇÃO DE SOLUÇÃO]
│   ├─► Realizar demo/apresentação para decision maker
│   ├─► Mapear e responder objeções técnicas
│   ├─► Exit criteria atendidos? → avançar para E4
│   └─► Solicitação de desconto > N1 → fluxo de aprovação
│
├─► [E4 — PROPOSTA COMERCIAL]
│   ├─► Gerar proposta (ENG-07 → template + dados da oportunidade)
│   ├─► Validar desconto aplicado (verificar limites de CAP-06)
│   ├─► Se desconto N2 ou N3: solicitar aprovação → ENG-07 pausa e notifica aprovador
│   ├─► Enviar proposta ao cliente (ENG-08 → CONN-EMAIL-TRANSACIONAL)
│   ├─► Iniciar SLA de follow-up (3 dias sem resposta = lembrete automático)
│   └─► Exit criteria atendidos? → avançar para E5
│
├─► [E5 — NEGOCIAÇÃO]
│   ├─► Registrar todas as contrapropostas e condições negociadas
│   ├─► Se desconto aumenta: verificar autorização
│   └─► Exit criteria atendidos (acordo fechado) → avançar para E6
│
└─► [E6 — FECHAMENTO]
    ├─► Gerar contrato (ENG-07 → template contratual)
    ├─► Enviar para assinatura eletrônica (ENG-08 → CONN-ASSINATURA-ELETRONICA)
    ├─► Monitorar assinaturas (SLA: 7 dias para ambas as partes)
    ├─► Contrato assinado por ambos:
    │   ├─► Publicar: oportunidade.ganha
    │   ├─► Publicar: oportunidade.encerrada (tipo: won)
    │   ├─► Publicar: cliente.contrato_assinado → CAP-05 inicia onboarding
    │   └─► Publicar: receita.contrato_novo → CAP-04 registra receita
    └─► Oportunidade perdida (em qualquer estágio):
        ├─► Registrar motivo de perda (campo estruturado obrigatório)
        ├─► Publicar: oportunidade.encerrada (tipo: lost)
        └─► CAP-01 recebe para análise Win/Loss


[FLUXO B — FORECAST SEMANAL]

[TRIGGER: sistema.periodo_encerrado (semanal)]
│
├─► Coletar estado atual do pipeline (todas as oportunidades ativas com valor e estágio)
├─► Calcular pipeline ponderado por probabilidade de estágio
├─► Comparar com meta de fechamento do período
├─► Identificar principais riscos (oportunidades grandes sem movimentação há > 7 dias)
├─► Publicar: forecast.atualizado
└─► Notificar equipe com relatório de forecast (ENG-08 → CONN-EMAIL-TRANSACIONAL)


[FLUXO C — APROVAÇÃO DE DESCONTO (N2/N3)]

[TRIGGER: proposta com desconto > limite N1]
│
├─► ENG-07 pausa o workflow de geração de proposta
├─► Notificar aprovador definido com: oportunidade, valor, desconto solicitado, justificativa
├─► Aprovador responde (aprovado | rejeitado | contraoferta)
│   ├─► Aprovado → retomar workflow; gerar proposta com desconto aprovado; registrar no DECISION_LOG
│   ├─► Rejeitado → notificar vendedor; vendedor negocia nova condição
│   └─► Timeout (48h sem resposta) → escalar para próximo nível
└─► Todo desconto N2+ é registrado permanentemente na oportunidade
```

---

## 7. Estados

### 7.1 Estados da Oportunidade

```
ABERTA_E1 → ABERTA_E2 → ABERTA_E3 → ABERTA_E4 → ABERTA_E5 → ABERTA_E6
                                                                    │
                                                              ┌─────┴─────┐
                                                              ▼           ▼
                                                            GANHA       PERDIDA
```

*(Oportunidade pode ser perdida em qualquer estágio)*

### 7.2 Estados da Proposta

```
RASCUNHO → ENVIADA → VISUALIZADA → EM_NEGOCIACAO → ACEITA | RECUSADA | EXPIRADA
```

### 7.3 Estados do Contrato

```
RASCUNHO → ENVIADO_PARA_ASSINATURA → ASSINADO | CANCELADO | EXPIRADO
```

### 7.4 Estados da Aprovação de Desconto

```
SOLICITADA → PENDENTE → APROVADA | REJEITADA | EXPIRADA (timeout 48h → escala)
```

---

## 8. Regras de Negócio

### RN-01 — Exit Criteria Como Gate Inegociável
Nenhuma oportunidade pode avançar de estágio sem que todos os exit criteria do estágio atual estejam preenchidos. O sistema bloqueia o avanço se os campos obrigatórios não estiverem preenchidos. Override requer aprovação do gestor e registro de justificativa.

### RN-02 — Desconto Dentro do Nível Autorizado
Todo desconto aplicado deve estar dentro do nível autorizado para o papel do vendedor (conforme configurado por CAP-06). Descontos acima do nível autorizado requerem fluxo de aprovação e só podem ser aplicados após aprovação registrada. Proposta enviada com desconto não autorizado é uma não-conformidade grave.

### RN-03 — Oportunidade Parada Gera Alerta
Oportunidade sem movimentação (mudança de estágio ou atividade registrada) por mais de X dias (configurado por estágio) gera alerta automático. Oportunidade parada não é uma oportunidade ativa — é ruído no funil que distorce o forecast.

### RN-04 — Contrato Obrigatório para Todo Negócio Fechado
Nenhum negócio pode ser marcado como fechado sem contrato assinado por ambas as partes. Receita de oportunidade fechada sem contrato assinado não é reconhecida pelo CAP-04. O contrato é o único documento que formaliza o compromisso mútuo.

### RN-05 — Motivo de Perda Obrigatório e Estruturado
Toda oportunidade perdida DEVE ter motivo de perda registrado em campo estruturado antes de ser encerrada. Motivos em texto livre são proibidos. Taxonomia padrão: preco, concorrente, sem_budget, timing, nao_viu_valor, perdeu_sponsor, produto_inadequado, processo_cancelado, sem_contato.

### RN-06 — Proposta com Validade Máxima de 30 Dias
Propostas comerciais têm validade máxima de 30 dias (configurável por segmento). Proposta expirada não pode ser aceita sem reemissão com condições vigentes. O sistema alerta o vendedor 5 dias antes da expiração.

### RN-07 — Forecast Baseado em Probabilidade de Estágio
O forecast de receita é calculado automaticamente pelo sistema usando as probabilidades ponderadas de cada estágio. Ajustes manuais no forecast requerem justificativa e são registrados. O forecast é uma projeção matemática, não uma opinião.

### RN-08 — Oportunidade Sem Decision Maker Não Avança para E3
A identificação e o engajamento do decision maker são exit criteria obrigatórios do E2. Realizar apresentação para um influenciador sem o decision maker presente é contra as regras e pode ser registrado como desvio de processo auditável.

### RN-09 — Ciclo de Venda Máximo por Segmento
Cada segmento tem um ciclo máximo de venda configurado. Oportunidade que ultrapassa o ciclo máximo sem fechar entra em revisão obrigatória: continuar com plano específico (aprovado pelo gestor) ou encerrar como perdida. Oportunidade zumbi distorce pipeline e forecast.

---

## 9. Eventos Publicados

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `oportunidade.aberta` | SQL recebido e oportunidade criada no funil | `{oportunidade_id, sql_id, segmento_id, valor_estimado, responsavel}` |
| `oportunidade.estagio_avancado` | Exit criteria atendidos; oportunidade avança | `{oportunidade_id, estagio_anterior, estagio_novo, dias_no_estagio}` |
| `oportunidade.parada_detectada` | Sem atividade por > limite do estágio | `{oportunidade_id, estagio_atual, dias_parada, valor_estimado}` |
| `oportunidade.proposta_enviada` | Proposta enviada formalmente ao prospect | `{oportunidade_id, proposta_id, valor_proposto, desconto_percentual, validade_dias}` |
| `oportunidade.ganha` | Contrato assinado por ambas as partes | `{oportunidade_id, contrato_id, valor_total, mrr, segmento_id, ciclo_dias}` |
| `oportunidade.encerrada` | Oportunidade encerrada (ganha ou perdida) | `{oportunidade_id, resultado: won\|lost, motivo, estagio_encerramento, valor, segmento_id}` |
| `cliente.contrato_assinado` | Contrato assinado — cliente oficializado | `{contrato_id, cliente_id, valor_total, mrr, data_inicio, data_fim, responsavel_cs}` |
| `receita.contrato_novo` | Novo contrato para registro financeiro | `{contrato_id, valor_total, mrr, data_inicio, forma_pagamento, condicoes_json}` |
| `forecast.atualizado` | Forecast semanal calculado | `{periodo, pipeline_ponderado, forecast_conservador, forecast_realista, meta_periodo}` |
| `desconto.aprovacao_solicitada` | Desconto acima do nível autorizado requer aprovação | `{oportunidade_id, proposta_id, desconto_percentual, nivel_requerido, aprovador_id}` |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `demanda.lead.qualificado_sql` | CAP-02 | Criar oportunidade no funil (E1) |
| `mercado.icp.atualizado` | CAP-01 | Recalcular ICP tier das oportunidades ativas; alertar sobre mudanças |
| `oferta.tabela_precos.atualizada` | CAP-06 | Atualizar limites de desconto; reprovar propostas com descontos agora inválidos |
| `oferta.politica_desconto.atualizada` | CAP-06 | Atualizar níveis de autorização de desconto |
| `kpi.limiar.cruzado` | ENG-02 | Se KPI afetado é win_rate ou ciclo_venda: criar diagnóstico |
| `sistema.periodo_encerrado` | Scheduler (semanal) | Gerar forecast semanal |
| `melhoria.item.implementado` | ENG-09 | Revisar processos impactados |

---

## 11. KPIs

| ID | Nome | Fórmula | Meta | Frequência |
|----|------|---------|------|-----------|
| KPI-VP-01 | Taxa de Conversão SQL → Ganho | `ganhos / sqls_recebidos × 100` | Por segmento | Mensal |
| KPI-VP-02 | Ciclo Médio de Venda | `média(data_fechamento - data_abertura)` | Por segmento (dias) | Mensal |
| KPI-VP-03 | Ticket Médio | `soma(valor_ganhos) / count(ganhos)` | Por segmento | Mensal |
| KPI-VP-04 | Taxa de Oportunidades Paradas | `opps_paradas / total_ativas × 100` | < 10% | Semanal |
| KPI-VP-05 | Aderência aos Exit Criteria | `transicoes_com_ec_completos / total_transicoes × 100` | ≥ 95% | Mensal |
| KPI-VP-06 | Desconto Médio Aplicado | `média(desconto_percentual)` | Definido por CAP-06 | Mensal |
| KPI-VP-07 | Acurácia do Forecast | `\|forecast_realista - receita_real\| / receita_real × 100` | ≤ 15% | Mensal |
| KPI-VP-08 | Taxa de Contratos Formalizados | `contratos_assinados / ganhos × 100` | 100% | Mensal |
| KPI-VP-09 | Velocidade do Pipeline | `soma(valor × prob) / ciclo_médio` | Crescente | Semanal |
| KPI-VP-10 | Pipeline Slip Rate | `opps_que_sliparam_periodo / total_forecast_periodo × 100` | < 20% | Mensal |

---

## 12. Alertas

| ID | Condição | Severidade | Ação |
|----|---------|-----------|------|
| ALT-VP-01 | Oportunidade sem atividade > limite do estágio | WARNING | Notificar vendedor + gestor |
| ALT-VP-02 | Oportunidade parada > 2× o limite do estágio | CRITICAL | Escalar para gestor; iniciar revisão |
| ALT-VP-03 | Taxa de oportunidades paradas > 20% do funil | CRITICAL | Diagnóstico de funil; reunião de pipeline |
| ALT-VP-04 | Acurácia do forecast < 85% por 2 meses | WARNING | Revisar metodologia de forecast; ENG-04 |
| ALT-VP-05 | Ciclo de venda > 150% do benchmark do segmento | WARNING | Identificar estágio gargalo; plano de ação |
| ALT-VP-06 | Desconto médio > limite configurado por CAP-06 | WARNING | Revisar política de desconto; treinamento |
| ALT-VP-07 | Proposta expirada sem resposta do cliente | WARNING | Notificar vendedor; ação de follow-up |
| ALT-VP-08 | Taxa de formalização de contratos < 95% | CRITICAL | Identificar negócios sem contrato; NC ENG-06 |
| ALT-VP-09 | Taxa de conversão SQL→Ganho cai > 10pp | CRITICAL | Disparar diagnóstico ENG-04 |

---

## 13. Planos de Ação Automáticos

### PA-VP-01 — Queda de Conversão SQL→Ganho (Gatilho: ALT-VP-09)
```yaml
plano_acao:
  tipo: diagnostico_e_correcao
  prazo_dias: 30
  tarefas:
    - "ENG-04: identificar em qual estágio ocorre a maior perda de oportunidades"
    - "Analisar: perda é por qualidade (SQLs desqualificados) ou por processo (estágio específico)?"
    - "Se qualidade: solicitar revisão dos critérios SQL para CAP-02"
    - "Se processo: revisar exit criteria e scripts do estágio com maior drop-off"
    - "Se negociação: analisar descontos médios e posicionamento de preço (CAP-06)"
  metrica_sucesso: "Conversão SQL→Ganho retorna ao baseline em 60 dias"
```

### PA-VP-02 — Funil Travado (Gatilho: ALT-VP-03)
```yaml
plano_acao:
  tipo: revisao_operacional
  prazo_dias: 14
  tarefas:
    - "Listar todas as oportunidades paradas com mais de 2× o limite do estágio"
    - "Para cada oportunidade: decisão binária — continuar (com plano específico) ou encerrar"
    - "Atualizar pipeline com posição real (eliminar oportunidades zumbi)"
    - "Realizar sessão de revisão de pipeline com a equipe"
  metrica_sucesso: "Taxa de oportunidades paradas < 10% do funil em 14 dias"
```

### PA-VP-03 — Desconto Médio Alto (Gatilho: ALT-VP-06)
```yaml
plano_acao:
  tipo: revisao_estrategica
  prazo_dias: 21
  tarefas:
    - "Identificar: desconto alto é em etapa específica (negociação) ou desde a proposta?"
    - "Analisar se a proposta de valor está sendo comunicada corretamente (antes do preço)"
    - "Verificar se a política de desconto de CAP-06 está atualizada e comunicada ao time"
    - "Se treinamento necessário: acionar CAP-07 para sessão de negociação de valor"
  metrica_sucesso: "Desconto médio dentro do limite configurado em 60 dias"
```

---

## 14. Automações

| ID | Trigger | Ação Automatizada | Conector |
|----|---------|-----------------|---------|
| AUT-VP-01 | `demanda.lead.qualificado_sql` recebido | Criar oportunidade; notificar vendedor; iniciar SLA de E1 | CONN-CRM-PRINCIPAL, CONN-MENSAGERIA |
| AUT-VP-02 | Proposta aceita (estágio E4 concluído) | Gerar contrato a partir do template; enviar para assinatura | CONN-ASSINATURA-ELETRONICA |
| AUT-VP-03 | Proposta sem resposta após 3 dias | Enviar lembrete automático ao cliente | CONN-EMAIL-TRANSACIONAL |
| AUT-VP-04 | Proposta a 5 dias de expirar | Notificar vendedor para ação de follow-up | CONN-MENSAGERIA |
| AUT-VP-05 | Contrato assinado por ambas as partes | Publicar oportunidade.ganha + cliente.contrato_assinado + receita.contrato_novo | Barramento SOE |
| AUT-VP-06 | Oportunidade sem atividade > limite do estágio | Criar alerta; notificar vendedor + gestor | ENG-03 |
| AUT-VP-07 | `sistema.periodo_encerrado` (semanal) | Calcular e publicar forecast.atualizado | ENG-02 |
| AUT-VP-08 | Desconto solicitado > nível N1 | Pausar geração de proposta; notificar aprovador; iniciar timer 48h | CONN-MENSAGERIA, ENG-07 |

---

## 15. Auditoria Operacional

### Checklist Semanal — CAP-03-AUD-SEMANAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Forecast semanal gerado e publicado | Evento `forecast.atualizado` | Registro do evento |
| 2 | Oportunidades paradas < 10% do funil | KPI-VP-04 | Valor do KPI |
| 3 | Propostas próximas de expirar tratadas | Log de alertas de expiração | Ações registradas |
| 4 | Pipeline review realizada com a equipe | Ata ou registro de reunião | Documento datado |

### Checklist Mensal — CAP-03-AUD-MENSAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | 100% dos negócios fechados têm contrato assinado | KPI-VP-08 | 100% |
| 2 | 100% das oportunidades perdidas têm motivo estruturado | Verificar campo motivo_perda | Zero nulos |
| 3 | Aderência a exit criteria ≥ 95% | KPI-VP-05 | Valor do KPI |
| 4 | Todos os descontos N2+ têm aprovação registrada | Verificar log de aprovações | Zero exceções |
| 5 | Acurácia do forecast dentro do limite | KPI-VP-07 | ≤ 15% de desvio |
| 6 | Alertas tratados dentro do SLA da ENG-03 | Taxa de resolução | ≥ 90% no SLA |

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml — CAP-03 Gestão do Processo de Vendas
# Ref: ARC-ENG-099

modulo:
  id: "CAP-03"
  nome: "Gestão do Processo de Vendas"
  versao: "2.0.0"
  tier: "core"
  status: "ativo"

dependencias:
  modulos:
    - id: "CAP-01"
      uso: "ICP vigente para qualificação de oportunidades"
    - id: "CAP-02"
      uso: "receber SQLs para abrir oportunidades"
    - id: "CAP-06"
      uso: "tabela de preços e limites de desconto por nível"
  engines:
    - id: "ENG-01"
      uso: "instâncias de oportunidades, SLA por estágio, exit criteria"
    - id: "ENG-02"
      uso: "KPIs KPI-VP-01 a KPI-VP-10"
    - id: "ENG-03"
      uso: "alertas ALT-VP-01 a ALT-VP-09"
    - id: "ENG-04"
      uso: "diagnóstico de queda de conversão e gargalos de estágio"
    - id: "ENG-05"
      uso: "planos de ação PA-VP-01 a PA-VP-03"
    - id: "ENG-06"
      uso: "auditoria semanal e mensal"
    - id: "ENG-07"
      uso: "workflows AUT-VP-01 a AUT-VP-08"
    - id: "ENG-08"
      uso: "CRM, assinatura eletrônica, email, mensageria"
    - id: "ENG-10"
      uso: "sugestões de abordagem baseadas em casos similares"

eventos_publicados:
  - evento: "oportunidade.aberta"
    condicao: "SQL recebido e oportunidade criada"
  - evento: "oportunidade.estagio_avancado"
    condicao: "exit criteria atendidos e estágio avançado"
  - evento: "oportunidade.parada_detectada"
    condicao: "sem atividade > limite do estágio"
  - evento: "oportunidade.proposta_enviada"
    condicao: "proposta enviada formalmente"
  - evento: "oportunidade.ganha"
    condicao: "contrato assinado por ambas as partes"
  - evento: "oportunidade.encerrada"
    condicao: "oportunidade encerrada (won ou lost)"
  - evento: "cliente.contrato_assinado"
    condicao: "contrato assinado — cliente oficializado"
  - evento: "receita.contrato_novo"
    condicao: "novo contrato para registro financeiro"
  - evento: "forecast.atualizado"
    condicao: "forecast semanal calculado"
  - evento: "desconto.aprovacao_solicitada"
    condicao: "desconto acima do nível autorizado"

eventos_consumidos:
  - evento: "demanda.lead.qualificado_sql"
    origem: "CAP-02"
    acao: "criar oportunidade no funil em E1"
  - evento: "mercado.icp.atualizado"
    origem: "CAP-01"
    acao: "recalcular ICP tier das oportunidades ativas"
  - evento: "oferta.tabela_precos.atualizada"
    origem: "CAP-06"
    acao: "atualizar limites de desconto"
  - evento: "oferta.politica_desconto.atualizada"
    origem: "CAP-06"
    acao: "atualizar níveis de autorização"
  - evento: "kpi.limiar.cruzado"
    origem: "ENG-02"
    acao: "criar diagnóstico se KPI é win_rate ou ciclo_venda"
  - evento: "sistema.periodo_encerrado"
    origem: "Scheduler"
    acao: "gerar forecast semanal"
  - evento: "melhoria.item.implementado"
    origem: "ENG-09"
    acao: "revisar processos impactados"

kpis_registrados:
  - id: "KPI-VP-01"
    nome: "Taxa de Conversão SQL → Ganho"
    formula: "ganhos / sqls_recebidos * 100"
    unidade: "percentual"
    dimensao: "segmento_id"
    frequencia_calculo: "mensal"
  - id: "KPI-VP-02"
    nome: "Ciclo Médio de Venda"
    formula: "media(data_fechamento - data_abertura)"
    unidade: "dias"
    dimensao: "segmento_id"
    frequencia_calculo: "mensal"
  - id: "KPI-VP-03"
    nome: "Ticket Médio"
    formula: "soma(valor_ganhos) / count(ganhos)"
    unidade: "moeda"
    dimensao: "segmento_id"
    frequencia_calculo: "mensal"
  - id: "KPI-VP-04"
    nome: "Taxa de Oportunidades Paradas"
    formula: "opps_paradas / total_ativas * 100"
    unidade: "percentual"
    frequencia_calculo: "semanal"
    meta_padrao: 10
    limiar_warning: 15
    limiar_critical: 20
  - id: "KPI-VP-05"
    nome: "Aderência aos Exit Criteria"
    formula: "transicoes_com_ec_completos / total_transicoes * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 95
    limiar_warning: 90
  - id: "KPI-VP-06"
    nome: "Desconto Médio Aplicado"
    formula: "media(desconto_percentual_das_propostas)"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: "configurado por CAP-06"
  - id: "KPI-VP-07"
    nome: "Acurácia do Forecast"
    formula: "abs(forecast_realista - receita_real) / receita_real * 100"
    unidade: "percentual_desvio"
    frequencia_calculo: "mensal"
    meta_padrao: 15
    limiar_warning: 20
  - id: "KPI-VP-08"
    nome: "Taxa de Contratos Formalizados"
    formula: "contratos_assinados / negócios_ganhos * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 100
    limiar_critical: 95
  - id: "KPI-VP-09"
    nome: "Velocidade do Pipeline"
    formula: "soma(valor * prob_estagio) / ciclo_medio_dias"
    unidade: "moeda_por_dia"
    frequencia_calculo: "semanal"
  - id: "KPI-VP-10"
    nome: "Pipeline Slip Rate"
    formula: "opps_slipadas / total_forecast_periodo * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    limiar_warning: 20

alertas_registrados:
  - id: "ALT-VP-01"
    condicao: "oportunidade.dias_sem_atividade > limite_estagio"
    severidade: "warning"
    owner: "vendedor_responsavel + gestor"
  - id: "ALT-VP-02"
    condicao: "oportunidade.dias_sem_atividade > 2x_limite_estagio"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-VP-03"
    kpi_ref: "KPI-VP-04"
    condicao: "> 20"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-VP-04"
    kpi_ref: "KPI-VP-07"
    condicao: "> 20 por 2 meses consecutivos"
    severidade: "warning"
    owner: "responsavel_cap03"
  - id: "ALT-VP-05"
    condicao: "ciclo_venda_opp > 1.5x benchmark_segmento"
    severidade: "warning"
    owner: "gestor_comercial"
  - id: "ALT-VP-06"
    kpi_ref: "KPI-VP-06"
    condicao: "> limite_cap06"
    severidade: "warning"
    owner: "gestor_comercial"
  - id: "ALT-VP-07"
    condicao: "proposta.dias_para_expirar <= 5"
    severidade: "warning"
    owner: "vendedor_responsavel"
  - id: "ALT-VP-08"
    kpi_ref: "KPI-VP-08"
    condicao: "< 95"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-VP-09"
    kpi_ref: "KPI-VP-01"
    condicao: "queda > 10pp vs baseline"
    severidade: "critical"
    owner: "gestor_comercial"
    acao_automatica: "disparar_diagnostico_eng04"

workflows_registrados:
  - id: "WF-VP-01"
    nome: "Abertura de Oportunidade a partir de SQL"
    gatilho: "demanda.lead.qualificado_sql"
    descricao: "cria oportunidade E1, notifica vendedor, inicia SLA"
  - id: "WF-VP-02"
    nome: "Geração e Envio de Proposta"
    gatilho: "exit criteria E3 atendidos"
    descricao: "gera proposta, valida desconto, solicita aprovação se necessário, envia"
  - id: "WF-VP-03"
    nome: "Follow-up de Proposta"
    gatilho: "proposta sem resposta após 3 dias"
    descricao: "envia lembrete automático ao cliente"
  - id: "WF-VP-04"
    nome: "Geração e Assinatura de Contrato"
    gatilho: "proposta aceita"
    descricao: "gera contrato, envia para assinatura eletrônica, monitora"
  - id: "WF-VP-05"
    nome: "Ativação de Cliente Pós-Fechamento"
    gatilho: "contrato assinado por ambas as partes"
    descricao: "publica eventos de ganho, contrato e receita; notifica CAP-05"
  - id: "WF-VP-06"
    nome: "Forecast Semanal"
    gatilho: "sistema.periodo_encerrado (semanal)"
    descricao: "calcula e publica forecast ponderado"

auditoria_checklists:
  - id: "CAP-03-AUD-SEMANAL"
    tipo: "semanal"
    itens_count: 4
  - id: "CAP-03-AUD-MENSAL"
    tipo: "mensal"
    itens_count: 6

conectores_utilizados:
  - "CONN-CRM-PRINCIPAL"
  - "CONN-ASSINATURA-ELETRONICA"
  - "CONN-EMAIL-TRANSACIONAL"
  - "CONN-MENSAGERIA"
  - "CONN-REPOSITORIO-DOCS"

permissoes_necessarias:
  - recurso: "oportunidades"
    acoes: ["read", "write", "update_status"]
  - recurso: "propostas"
    acoes: ["read", "write", "send"]
  - recurso: "contratos"
    acoes: ["read", "write", "send_for_signature"]
  - recurso: "funil_definitions"
    acoes: ["read"]
  - recurso: "politica_descontos"
    acoes: ["read"]
  - recurso: "kpi_values.KPI-VP-*"
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
