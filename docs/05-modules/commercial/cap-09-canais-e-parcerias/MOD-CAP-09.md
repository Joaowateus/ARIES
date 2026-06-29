---
id: MOD-CAP-09
titulo: "Módulo Operacional — Gestão de Canais e Parcerias"
versao: "2.0.0"
status: ATIVO
tier: Core
camada: Execution
posicao_comercial: Habilitador transversal de geração de demanda e receita indireta
upstream: [CAP-01, CAP-06]
downstream: [CAP-02, CAP-04]
infraestrutura: Engine de Autogestão (ENG-01 a ENG-10)
ultima_revisao: "2026-06-29"
---

# MOD-CAP-09 — Gestão de Canais e Parcerias
**Commercial Operating System | Módulo 09 de 09**

> Este módulo é um microserviço de negócio independente do Commercial OS. Toda a infraestrutura de governança, auditoria, logs, versionamento, aprovação, workflow, KPIs, metas, alertas, automação, permissões e inteligência é fornecida exclusivamente pela Engine de Autogestão (ENG-01 a ENG-10). Este módulo contém apenas sua lógica de negócio específica.

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | MOD-CAP-09 |
| **Nome** | Gestão de Canais e Parcerias |
| **Versão** | 2.0.0 |
| **Status** | ATIVO |
| **Tier** | Core |
| **Camada** | Execution |
| **Posição no Commercial OS** | Habilitador transversal — geração de demanda e receita indireta via rede de parceiros |
| **Dependências upstream** | CAP-01 (ICP e inteligência de mercado), CAP-06 (oferta e precificação) |
| **Dependências downstream** | CAP-02 (leads gerados por parceiros), CAP-04 (receita indireta) |
| **Infraestrutura** | Engine de Autogestão — ENG-01 a ENG-10 |

---

## 2. Objetivo

Estruturar, operar e escalar a rede de canais indiretos e parcerias estratégicas da organização, transformando parceiros em extensões eficientes da capacidade comercial e geradores confiáveis de demanda qualificada e receita incremental.

O módulo opera como sistema de gestão do ecossistema de parceiros — cobrindo recrutamento, ativação, capacitação, operação, performance e evolução — garantindo que cada parceiro ativo opere alinhado ao ICP, à oferta vigente e às metas comerciais da organização.

**Premissas fundamentais:**

- Parceiros são ativos estratégicos que exigem gestão ativa, não passiva
- A qualidade dos leads gerados por parceiros deve ser mensurável e comparável ao canal direto
- Toda receita indireta deve ser rastreável até o parceiro originador
- O ecossistema de parceiros é complementar ao canal direto, não substituto
- Parceiros de baixa performance consomem recursos sem retorno — devem ser desativados sistematicamente

---

## 3. Escopo

### Dentro do Escopo

- Definição e gestão de tipos de parceria (revenda, indicação, integração, co-selling, OEM, afiliados)
- Recrutamento e qualificação de novos parceiros
- Processo de onboarding e ativação de parceiros
- Capacitação e certificação de parceiros
- Gestão do pipeline de oportunidades geradas por parceiros
- Rastreamento de leads e oportunidades originadas por canal indireto
- Cálculo e gestão de comissões e incentivos de parceiros
- Avaliação de performance individual e do ecossistema
- Gestão do programa de parceiros (tiers, benefícios, requisitos)
- Comunicação e engajamento com a rede de parceiros
- Desativação controlada de parceiros de baixa performance

### Fora do Escopo

- Prospecção e qualificação de leads finais (CAP-02)
- Gestão do processo de vendas para oportunidades de parceiros (CAP-03)
- Faturamento e cobrança de comissões (CAP-04)
- Pós-venda e sucesso do cliente final (CAP-05)
- Definição de preços e tabelas de repasse (CAP-06)
- Gestão da equipe interna de channel (CAP-07)
- KPIs estratégicos consolidados (CAP-08)
- Governança, auditoria, logs (Engine de Autogestão)

---

## 4. Responsabilidades

### 4.1 Responsabilidades Primárias (este módulo)

| Responsabilidade | Descrição |
|---|---|
| **Gestão do Programa** | Definir e manter tiers, requisitos, benefícios e regras do programa de parceiros |
| **Recrutamento** | Identificar, qualificar e contratar novos parceiros alinhados ao ICP e à estratégia |
| **Ativação** | Executar onboarding estruturado até o parceiro gerar o primeiro lead qualificado |
| **Capacitação** | Garantir que parceiros dominem a oferta, o ICP e o processo de vendas |
| **Performance** | Avaliar, classificar e evoluir parceiros com base em resultados mensuráveis |
| **Incentivos** | Calcular e registrar comissões e incentivos de parceiros conforme política vigente |
| **Desativação** | Executar protocolo de saída para parceiros inativos ou de baixa performance |

### 4.2 Responsabilidades Delegadas à Infraestrutura

- **ENG-01**: Execução de processos de onboarding, capacitação e desativação de parceiros
- **ENG-02**: Cálculo e monitoramento de todos os KPIs do módulo
- **ENG-03**: Emissão e gestão de alertas de performance e inatividade
- **ENG-04**: Diagnóstico automático de degradação do ecossistema
- **ENG-05**: Geração e acompanhamento de planos de ação para parceiros e ecossistema
- **ENG-06**: Auditoria de todas as operações, comissões e decisões de parceiros
- **ENG-07**: Workflows de aprovação de novos parceiros, upgrades de tier e desativações
- **ENG-08**: Conectores com portais de parceiros, CRM, plataformas de LMS e sistemas de comissão
- **ENG-09**: Análise de PDCA e melhoria contínua do programa de parceiros
- **ENG-10**: Base de conhecimento de playbooks, materiais de treinamento e melhores práticas

---

## 5. Capacidades Internas

### 5.1 Gestão do Programa de Parceiros

O programa de parceiros é estruturado em tiers que definem requisitos, benefícios e obrigações de cada nível.

**Estrutura de Tiers (configurável por implementação):**

```yaml
tier_estrutura:
  TIER_1_ENTRADA:
    nome: "Parceiro Associado"
    requisitos:
      min_leads_trimestre: 3
      min_revenue_trimestre: 0
      certificacoes_obrigatorias: ["CERT-PRODUTO-BASICO"]
      tempo_minimo_ativo: "3 meses"
    beneficios:
      comissao_indicacao: "configurável"
      acesso_materiais: BASICO
      suporte_canal: EMAIL
      visibilidade_marketplace: false
    
  TIER_2_ATIVO:
    nome: "Parceiro Ativo"
    requisitos:
      min_leads_trimestre: 10
      min_revenue_trimestre: "configurável"
      certificacoes_obrigatorias: ["CERT-PRODUTO-BASICO", "CERT-VENDAS"]
      tempo_minimo_ativo: "6 meses"
    beneficios:
      comissao_indicacao: "configurável (maior que T1)"
      acesso_materiais: COMPLETO
      suporte_canal: EMAIL_PRIORITARIO
      visibilidade_marketplace: true
      
  TIER_3_ESTRATEGICO:
    nome: "Parceiro Estratégico"
    requisitos:
      min_leads_trimestre: 25
      min_revenue_trimestre: "configurável"
      certificacoes_obrigatorias: ["CERT-PRODUTO-AVANCADO", "CERT-VENDAS", "CERT-CS"]
      exclusividade_territorial: "opcional"
    beneficios:
      comissao_indicacao: "configurável (maior que T2)"
      comissao_co_selling: "configurável"
      acesso_materiais: PREMIUM
      suporte_canal: DEDICADO
      co_marketing: true
      visibilidade_marketplace: DESTACADO
      qbr_conjunto: true
```

**Tipos de Parceria Suportados:**

| Tipo | Modelo | Rastreamento de Receita |
|---|---|---|
| **Indicação** | Parceiro indica lead; venda é feita pelo time interno | Comissão por negócio fechado originado |
| **Revenda** | Parceiro vende diretamente ao cliente final | Repasse sobre faturamento ao cliente |
| **Co-Selling** | Venda conjunta entre parceiro e time interno | Comissão proporcional à participação |
| **Integração** | Parceiro integra produto ao seu stack/ecossistema | Modelo de revenue share configurável |
| **OEM** | Parceiro embarca o produto em sua solução | Licenciamento por volume ou uso |
| **Afiliado** | Parceiro gera tráfego/leads via conteúdo ou mídia | Comissão por conversão rastreada |

### 5.2 Recrutamento e Qualificação de Parceiros

**Critérios de Elegibilidade (configuráveis):**

```yaml
criterios_elegibilidade:
  perfil_obrigatorio:
    alinhamento_icp: "O parceiro atende ao mesmo ICP que a organização"
    capacidade_comercial: "Possui time dedicado ou estrutura para venda/indicação"
    reputacao_mercado: "Ausência de registros negativos e conflito de interesse"
    saude_financeira: "Estável (para modelos de revenda)"
    
  criterios_excludentes:
    - parceiro_de_concorrente_direto: true
    - historico_fraude_ou_litigio: true
    - conflito_de_interesse_documentado: true
    - territorio_exclusivo_ocupado: true
    
  processo_qualificacao:
    etapas:
      - "01_CANDIDATURA: Formulário de interesse preenchido"
      - "02_SCREENING: Análise de perfil e elegibilidade (5 dias úteis)"
      - "03_ENTREVISTA: Reunião de alinhamento e apresentação mútua"
      - "04_DUE_DILIGENCE: Verificação de referências e capacidade"
      - "05_APROVACAO: Decisão via workflow ENG-07"
      - "06_CONTRATO: Assinatura do acordo de parceria"
      - "07_ONBOARDING: Início do processo de ativação"
```

### 5.3 Onboarding e Ativação de Parceiros

**Definição de Ativação:** Um parceiro é considerado ATIVO quando gera o primeiro lead qualificado (MQL ou superior) dentro do prazo de ativação.

**Prazo máximo de ativação:** 90 dias corridos após assinatura do contrato.

**Marcos do Onboarding:**

```yaml
onboarding_marcos:
  M1_KICKOFF:
    prazo: "5 dias após assinatura"
    entregaveis:
      - "Acesso ao portal do parceiro concedido"
      - "Materiais de boas-vindas enviados"
      - "Gestor de canal designado"
      - "Reunião de kickoff realizada"
      
  M2_CAPACITACAO:
    prazo: "30 dias após assinatura"
    entregaveis:
      - "Treinamento de produto concluído"
      - "Certificação básica obtida"
      - "Pitch de vendas aprovado"
      - "Acesso ao CRM parceiro configurado"
      
  M3_PRIMEIRO_LEAD:
    prazo: "60 dias após assinatura"
    entregaveis:
      - "Primeiro lead gerado e registrado"
      - "Processo de repasse validado"
      
  M4_ATIVACAO:
    prazo: "90 dias após assinatura"
    entregaveis:
      - "Primeiro lead QUALIFICADO (MQL+) gerado"
      - "Status alterado para ATIVO"
      
  FALHA_ATIVACAO:
    trigger: "M4 não atingido em 90 dias"
    acao: "Protocolo de reavaliação ou desativação"
    evento_publicado: "parceiro.ativacao_falhou"
```

### 5.4 Capacitação e Certificação

**Trilhas de Certificação:**

| Certificação | Conteúdo | Público-Alvo | Renovação |
|---|---|---|---|
| **CERT-PRODUTO-BASICO** | Visão geral do produto, casos de uso, diferenciadores | Todos os parceiros | Anual |
| **CERT-VENDAS** | ICP, processo de vendas, qualificação, objeções | Time comercial do parceiro | Anual |
| **CERT-PRODUTO-AVANCADO** | Demonstração técnica, integrações, customizações | Parceiros técnicos/revendas | Anual |
| **CERT-CS** | Processo de onboarding do cliente, sucesso, renovação | CS de parceiros estratégicos | Anual |

**Regra de Certificação:** Parceiros com certificações vencidas (> 12 meses sem renovação) são rebaixados de tier automaticamente após notificação com 30 dias de antecedência.

### 5.5 Gestão de Pipeline de Parceiros

**Rastreamento de Leads de Parceiros:**

Todo lead originado por parceiro deve ser:
1. Registrado no sistema com atributo `origem_parceiro: [ID_PARCEIRO]`
2. Rastreável desde a indicação até o fechamento (ou descarte)
3. Vinculado ao cálculo de comissão do parceiro originador

**Regras de Atribuição:**

```yaml
regras_atribuicao:
  primeiro_toque: "O parceiro que primeiro registrar o lead é o originador"
  janela_atribuicao: "180 dias — lead do mesmo prospect dentro da janela = mesmo parceiro"
  conflito_multiplos_parceiros: "Resolvido por data de primeiro registro documentado"
  lead_existente_no_crm: "Se prospect já existe como lead direto com < 90 dias, não há comissão"
  lead_existente_no_crm_antigo: "Se > 90 dias sem atividade, parceiro recebe crédito parcial (configurável)"
```

### 5.6 Gestão de Comissões e Incentivos

**Política de Comissões:**

```yaml
politica_comissoes:
  calculo:
    base: "Receita líquida do contrato assinado atribuído ao parceiro"
    momento_calculo: "No fechamento do contrato (evento oportunidade.ganha recebido)"
    momento_pagamento: "Após confirmação de pagamento do cliente (configurável: D+30, D+60, D+90)"
    
  regras_imutabilidade:
    - "Comissão calculada é imutável após fechamento do período"
    - "Ajustes só via processo formal de contestação com aprovação"
    - "Audit trail obrigatório para qualquer modificação"
    
  politica_estorno:
    trigger: "Churn do cliente final em até 90 dias após ativação"
    acao: "Estorno proporcional ao tempo de uso (calculado pelo ENG-02)"
    notificacao: "Parceiro notificado com 10 dias de antecedência"
    
  incentivos_adicionais:
    aceleradores: "Multiplicadores por atingimento de meta trimestral (configurável)"
    bonus_ativacao: "Bonus por primeiro negócio fechado em até 60 dias de ativação (configurável)"
    spiff: "Incentivos pontuais por produto ou período específico (configurável)"
```

### 5.7 Avaliação e Classificação de Performance

**Score de Performance do Parceiro:**

```yaml
score_performance:
  dimensoes:
    volume_leads:
      peso: 30
      metrica: "Leads gerados no trimestre vs. meta"
      
    qualidade_leads:
      peso: 25
      metrica: "Taxa de conversão MQL→SQL dos leads do parceiro"
      
    receita_gerada:
      peso: 30
      metrica: "Receita fechada atribuída ao parceiro vs. meta"
      
    engajamento_programa:
      peso: 15
      metrica: "Certificações ativas + participação em eventos + uso do portal"
      
  classificacao:
    ALTO_DESEMPENHO: "Score ≥ 80"
    DESEMPENHO_ADEQUADO: "Score 60-79"
    DESEMPENHO_ABAIXO: "Score 40-59"
    CRITICO: "Score < 40"
```

### 5.8 Protocolo de Desativação de Parceiros

**Gatilhos de Desativação:**

| Gatilho | Prazo para Resolução | Ação se Não Resolvido |
|---|---|---|
| Inatividade (0 leads em 90 dias) | 30 dias de alerta | Desativação |
| Score crítico (< 40) por 2 trimestres consecutivos | 1 trimestre de PIP | Desativação |
| Violação de contrato | 0 (imediato) | Desativação imediata |
| Certificações vencidas > 60 dias | 30 dias para renovar | Rebaixamento de tier |
| Solicitação do parceiro | N/A | Desativação em 30 dias |

**Processo de Desativação:**
1. **Notificação formal** — comunicado com motivo e prazo
2. **Período de cura** — prazo para reversão (quando aplicável)
3. **Decisão final** — registrada via workflow ENG-07
4. **Offboarding** — revogação de acessos, liquidação de comissões pendentes
5. **Registro** — auditoria completa via ENG-06

---

## 6. Fluxo Operacional

### 6.1 Ciclo de Vida do Parceiro

```
CANDIDATO → [Qualificação] → QUALIFICADO → [Aprovação ENG-07] → CONTRATADO
     → [Onboarding 90 dias] → ATIVO → [Operação contínua] → AVALIAÇÃO TRIMESTRAL
     → ATIVO (mantido) | TIER_UP | TIER_DOWN | PIP | DESATIVADO
```

### 6.2 Fluxo de Indicação de Lead

```
Parceiro identifica oportunidade
    → Registra lead no portal/CRM com ID_PARCEIRO
    → Sistema valida atribuição (regras de janela e conflito)
    → Evento publicado: parceiro.lead_indicado
    → CAP-02 recebe e processa qualificação
    → CAP-03 gerencia oportunidade
    → Resultado informado: oportunidade.ganha | oportunidade.perdida
    → CAP-09 calcula comissão (se ganha)
    → Comissão registrada e notificada ao parceiro
```

### 6.3 Ciclo de Avaliação Trimestral

```
Fim do trimestre (evento sistema.periodo_encerrado)
    → ENG-02 calcula todos os KPIs de parceiros
    → Score de performance calculado para cada parceiro
    → Classificação atualizada
    → Ações disparadas por tier/score:
        ALTO_DESEMPENHO → Reconhecimento + avaliação de upgrade
        DESEMPENHO_ADEQUADO → Manutenção
        DESEMPENHO_ABAIXO → Alerta + plano de melhoria
        CRÍTICO → Protocolo de PIP ou desativação
    → Relatório trimestral publicado
    → Eventos publicados: parceiro.avaliacao_trimestral_concluida
```

---

## 7. Estados

### 7.1 Estados do Parceiro

| Estado | Descrição | Transições Possíveis |
|---|---|---|
| `CANDIDATO` | Manifestou interesse, em processo de qualificação | → QUALIFICADO, → REJEITADO |
| `QUALIFICADO` | Aprovado no screening, aguardando aprovação formal | → CONTRATADO, → REJEITADO |
| `CONTRATADO` | Contrato assinado, em onboarding | → ATIVO, → CANCELADO_ONBOARDING |
| `ATIVO` | Operacional, gerando leads | → ATIVO (tier mudado), → PIP, → DESATIVADO |
| `PIP` | Em plano de melhoria de performance | → ATIVO (recuperado), → DESATIVADO |
| `SUSPENSO` | Temporariamente suspenso (ex: investigação) | → ATIVO, → DESATIVADO |
| `DESATIVADO` | Encerramento de parceria | (estado final) |
| `REJEITADO` | Candidatura não aprovada | (estado final) |

### 7.2 Estados de Lead de Parceiro

| Estado | Descrição |
|---|---|
| `REGISTRADO` | Lead indicado pelo parceiro, aguardando validação de atribuição |
| `ATRIBUIDO` | Atribuição confirmada, enviado para CAP-02 |
| `EM_QUALIFICACAO` | Em processo de qualificação pelo time interno (CAP-02) |
| `QUALIFICADO` | MQL ou SQL confirmado |
| `EM_NEGOCIACAO` | Oportunidade em estágio avançado (CAP-03) |
| `GANHO` | Contrato fechado — comissão calculada |
| `PERDIDO` | Oportunidade encerrada sem fechamento |
| `INVALIDO` | Lead rejeitado (duplicado, fora de ICP, sem atribuição válida) |

---

## 8. Regras de Negócio

### 8.1 Regras de Programa

| ID | Regra |
|---|---|
| **RN-CP-01** | Todo parceiro ativo deve ter contrato assinado e vigente. Parceiro sem contrato não pode gerar leads comissionáveis. |
| **RN-CP-02** | Um parceiro só pode operar no tier para o qual atende TODOS os requisitos. Requisito não atendido = rebaixamento automático em D+30 após notificação. |
| **RN-CP-03** | Conflito de interesse documentado com concorrente direto = bloqueio imediato do parceiro para aprovação. |
| **RN-CP-04** | Exclusividade territorial só pode ser concedida a parceiros Tier 3 e com aprovação da diretoria. |
| **RN-CP-05** | O programa de parceiros deve ter revisão formal anual com documentação de resultados e ajustes. |

### 8.2 Regras de Atribuição e Comissão

| ID | Regra |
|---|---|
| **RN-CP-06** | A atribuição de lead a parceiro é baseada no PRIMEIRO REGISTRO documentado no sistema. Conflitos são resolvidos por timestamp. |
| **RN-CP-07** | Janela de atribuição padrão: 180 dias. Após esse prazo, o mesmo prospect pode ser atribuído a outro parceiro ou ao canal direto. |
| **RN-CP-08** | Comissão calculada é imutável após fechamento do período contábil. Contestações seguem fluxo formal com aprovação. |
| **RN-CP-09** | Estorno de comissão ocorre somente em caso de churn do cliente em até 90 dias. O cálculo é proporcional ao tempo efetivo. |
| **RN-CP-10** | Auto-indicação é vedada: parceiro não pode indicar como lead empresas onde possui participação societária ou controle sem declaração explícita. |

### 8.3 Regras de Performance

| ID | Regra |
|---|---|
| **RN-CP-11** | Parceiro com 0 leads em 90 dias corridos entra automaticamente em alerta de inatividade. |
| **RN-CP-12** | Score crítico (< 40) por 2 avaliações trimestrais consecutivas ativa PIP automático. |
| **RN-CP-13** | PIP tem duração máxima de 1 trimestre. Não atingindo meta mínima ao fim do PIP, desativação é executada. |
| **RN-CP-14** | Parceiro em desativação mantém direito às comissões de negócios já fechados. Comissões de negócios em andamento são pagas conforme desfecho. |
| **RN-CP-15** | Taxa de conversão de leads do parceiro abaixo de 50% do benchmark interno por 2 trimestres consecutivos ativa revisão formal da qualidade da indicação. |

### 8.4 Regras de Capacitação

| ID | Regra |
|---|---|
| **RN-CP-16** | Certificações com prazo vencido bloqueiam o parceiro de upgrade de tier. |
| **RN-CP-17** | Certificações vencidas há mais de 60 dias ativam notificação formal. Vencidas há mais de 90 dias = rebaixamento de tier. |
| **RN-CP-18** | Novos produtos ou mudanças significativas na oferta exigem atualização de certificações em até 60 dias. |

---

## 9. Eventos Publicados

> Nomenclatura: `[dominio].[entidade].[acao_passado]`
> Transporte: Barramento de Eventos SOE (ENG-07) | Garantia: at-least-once

| ID | Evento | Payload (campos principais) | Consumidores |
|---|---|---|---|
| **EVT-CP-PUB-01** | `parceiro.lead_indicado` | parceiro_id, lead_id, prospect_id, canal_tipo, data_indicacao, tier_parceiro | CAP-02 |
| **EVT-CP-PUB-02** | `parceiro.ativado` | parceiro_id, tier_inicial, data_ativacao, gestor_canal_id, tipo_parceria | ENG-02, ENG-06, CAP-08 |
| **EVT-CP-PUB-03** | `parceiro.desativado` | parceiro_id, motivo, data_desativacao, comissoes_pendentes, aprovador_id | ENG-02, ENG-06, CAP-08 |
| **EVT-CP-PUB-04** | `parceiro.tier_alterado` | parceiro_id, tier_anterior, tier_novo, motivo, data_alteracao | ENG-02, ENG-06 |
| **EVT-CP-PUB-05** | `parceiro.comissao_calculada` | parceiro_id, oportunidade_id, valor_comissao, base_calculo, tipo_comissao, periodo | CAP-04, ENG-06 |
| **EVT-CP-PUB-06** | `parceiro.inativo_detectado` | parceiro_id, dias_sem_leads, ultimo_lead_data, tier_atual | ENG-03, ENG-05 |
| **EVT-CP-PUB-07** | `parceiro.pip_iniciado` | parceiro_id, motivo, meta_pip, prazo_pip, gestor_responsavel | ENG-06, CAP-07 |
| **EVT-CP-PUB-08** | `parceiro.ativacao_falhou` | parceiro_id, motivo, dias_decorridos, marcos_nao_atingidos | ENG-03, ENG-05 |
| **EVT-CP-PUB-09** | `parceiro.certificacao_vencida` | parceiro_id, certificacao_id, data_vencimento, impacto_tier | ENG-03 |
| **EVT-CP-PUB-10** | `parceiro.avaliacao_trimestral_concluida` | parceiro_id, trimestre, score, classificacao, tier_resultante, kpis_periodo | ENG-06, CAP-08 |
| **EVT-CP-PUB-11** | `ecossistema.relatorio_publicado` | periodo, total_parceiros_ativos, leads_gerados, receita_atribuida, top_parceiros | CAP-08, ENG-06 |
| **EVT-CP-PUB-12** | `parceiro.contrato_renovado` | parceiro_id, contrato_anterior_id, novo_contrato_id, vigencia, tier, condicoes | ENG-06 |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação Interna |
|---|---|---|
| `mercado.icp.atualizado` | CAP-01 | Atualizar critérios de elegibilidade de parceiros e perfil de lead válido para atribuição |
| `oferta.tabela_precos.atualizada` | CAP-06 | Atualizar base de cálculo de comissões e materiais de capacitação de parceiros |
| `oferta.produto.descontinuado` | CAP-06 | Notificar parceiros que vendem o produto descontinuado e atualizar certificações |
| `oportunidade.ganha` | CAP-03 | Verificar atribuição a parceiro e iniciar cálculo de comissão se aplicável |
| `oportunidade.encerrada` | CAP-03 | Registrar desfecho de lead de parceiro; atualizar taxa de conversão do parceiro |
| `cliente.churned` | CAP-05 | Verificar se cliente é atribuído a parceiro; calcular estorno de comissão se churn < 90 dias |
| `kpi.limiar.cruzado` | ENG-02 | Processar alertas de KPIs de canal que cruzaram limiares críticos |
| `sistema.periodo_encerrado` | Scheduler | Disparar avaliação trimestral de todos os parceiros ativos |
| `alerta.emitido` | ENG-03 | Processar alertas de inatividade, performance ou certificação de parceiros |
| `plano_acao.concluido` | ENG-05 | Verificar se PIP de parceiro foi concluído e avaliar resultado |

---

## 11. KPIs

> Definição, cálculo e monitoramento: ENG-02. Metas configuradas via ENG-02. Limiares de alerta configurados via ENG-03.

| ID | KPI | Fórmula / Definição | Frequência |
|---|---|---|---|
| **KPI-CP-01** | Total de Parceiros Ativos | COUNT(parceiros com status = ATIVO) | Diária |
| **KPI-CP-02** | Taxa de Ativação de Parceiros | (Parceiros ATIVOS / Parceiros CONTRATADOS nos últimos 90 dias) × 100 | Mensal |
| **KPI-CP-03** | Leads Gerados por Parceiros | COUNT(leads com origem_parceiro no período) | Mensal |
| **KPI-CP-04** | Taxa de Conversão de Leads de Parceiros | (Leads de parceiros convertidos em SQL / Total de leads de parceiros) × 100 | Mensal |
| **KPI-CP-05** | Receita Atribuída a Parceiros | SUM(receita de contratos com origem_parceiro no período) | Mensal |
| **KPI-CP-06** | % da Receita Total via Canal Indireto | (Receita via parceiros / Receita total) × 100 | Mensal |
| **KPI-CP-07** | Parceiros com Score Crítico | COUNT(parceiros com score < 40) | Trimestral |
| **KPI-CP-08** | Tempo Médio de Ativação | AVG(dias entre contrato assinado e primeiro lead qualificado) | Mensal |
| **KPI-CP-09** | Taxa de Retenção de Parceiros | (Parceiros ativos ao fim do período / Parceiros ativos no início) × 100 | Trimestral |
| **KPI-CP-10** | Receita Média por Parceiro Ativo | Receita total via canal / Total de parceiros ativos | Trimestral |
| **KPI-CP-11** | Taxa de Estorno de Comissões | (Comissões estornadas / Comissões pagas) × 100 | Trimestral |
| **KPI-CP-12** | Comparativo Qualidade Lead Canal Direto vs. Indireto | Taxa de conversão MQL→SQL canal direto / Taxa canal indireto | Trimestral |

---

## 12. Alertas

> Emissão e gestão: ENG-03. Os limiares abaixo são referências; configuração em ENG-03.

| ID | Alerta | Condição | Severidade | Ação Recomendada |
|---|---|---|---|---|
| **ALT-CP-01** | Parceiro inativo | KPI-CP-03 por parceiro = 0 leads em 90 dias | ALTO | Contato do gestor de canal; protocolo de reativação |
| **ALT-CP-02** | Taxa de ativação crítica | KPI-CP-02 < 50% | ALTO | Revisar processo de onboarding; investigar gargalos |
| **ALT-CP-03** | Score de parceiro crítico | Score < 40 | ALTO | Iniciar PIP imediatamente |
| **ALT-CP-04** | Qualidade de leads degradada | KPI-CP-12 < 0.6 (leads de parceiros convertem 40% menos) | MÉDIO | Revisão de capacitação; alinhamento de ICP com parceiros |
| **ALT-CP-05** | Concentração de receita | Top 3 parceiros > 70% da receita de canal | MÉDIO | Diversificar portfólio de parceiros; recrutar novos |
| **ALT-CP-06** | Certificação vencida | Parceiro com certificação > 30 dias vencida | MÉDIO | Notificar parceiro; bloquear upgrade de tier |
| **ALT-CP-07** | Pipeline de canal insuficiente | Leads de parceiros < 30% da meta do período | MÉDIO | Ação de engajamento com rede de parceiros |
| **ALT-CP-08** | Taxa de estorno elevada | KPI-CP-11 > 10% | MÉDIO | Investigar qualidade da indicação; revisar política |

---

## 13. Planos de Ação Automáticos

> Geração e acompanhamento: ENG-05.

| ID | Gatilho | Plano Gerado | SLA |
|---|---|---|---|
| **PA-CP-01** | Parceiro inativo (ALT-CP-01) | Contato imediato do gestor de canal; reunião de alinhamento em até 10 dias; plano de reativação ou início de protocolo de desativação | 15 dias para resolução |
| **PA-CP-02** | Score crítico por 2 trimestres (RN-CP-12) | Estruturação de PIP com metas específicas, suporte intensivo e prazo de 1 trimestre | 5 dias para estruturação |
| **PA-CP-03** | Taxa de ativação crítica (ALT-CP-02) | Auditoria do processo de onboarding; entrevistas com parceiros em onboarding; redesenho de etapas problemáticas | 30 dias para diagnóstico |

---

## 14. Automações

> Execução: ENG-08 via conectores registrados.

| ID | Automação | Gatilho | Ação |
|---|---|---|---|
| **AUT-CP-01** | Provisionamento de acesso ao portal | `parceiro.ativado` publicado | Criar conta no portal de parceiros, enviar credenciais, configurar permissões de tier |
| **AUT-CP-02** | Notificação de lead atribuído | `parceiro.lead_indicado` validado | Notificar time interno sobre lead de parceiro; registrar no CRM com tag de origem |
| **AUT-CP-03** | Cálculo de comissão | `oportunidade.ganha` com parceiro atribuído | Calcular comissão, registrar no sistema, notificar parceiro e CAP-04 |
| **AUT-CP-04** | Alerta de inatividade | Score parceiro = 0 leads em 75 dias | Enviar alerta ao gestor de canal com 15 dias de antecedência do gatilho formal |
| **AUT-CP-05** | Notificação de certificação | Certificação com vencimento em 30 dias | Enviar lembretes ao parceiro (D-30, D-15, D-7) com link para renovação |
| **AUT-CP-06** | Rebaixamento de tier automático | Requisito de tier não atendido + D+30 após notificação | Alterar tier, revogar benefícios, notificar parceiro, publicar evento |
| **AUT-CP-07** | Comunicação de oferta atualizada | `oferta.tabela_precos.atualizada` recebido | Notificar parceiros ativos com resumo das mudanças e novos materiais de venda |
| **AUT-CP-08** | Relatório trimestral de canal | `sistema.periodo_encerrado` recebido | Consolidar KPIs, calcular scores, gerar e publicar relatório do ecossistema |

---

## 15. Auditoria Operacional

> Execução e imutabilidade: ENG-06. Todos os registros são append-only e imutáveis após criação.

### 15.1 Eventos Auditados Obrigatoriamente

| Evento | Nível | Dados Registrados |
|---|---|---|
| Aprovação/rejeição de novo parceiro | CRITICAL | Decisor, critérios avaliados, resultado, justificativa |
| Concessão de exclusividade territorial | CRITICAL | Aprovador, parceiro, território, prazo, condições |
| Alteração de tier de parceiro | HIGH | Motivo, tier anterior, tier novo, responsável |
| Cálculo de comissão | HIGH | Base de cálculo, alíquota, valor, oportunidade vinculada |
| Estorno de comissão | CRITICAL | Motivo, valor estornado, período, aprovador |
| Iniciação de PIP | HIGH | Parceiro, metas do PIP, responsável, prazo |
| Desativação de parceiro | CRITICAL | Motivo, aprovador, comissões pendentes, data |
| Contestação de atribuição | HIGH | Partes envolvidas, timestamps, decisão, decisor |

### 15.2 Relatórios de Auditoria

| Relatório | Frequência | Conteúdo |
|---|---|---|
| **Relatório de Comissões** | Mensal | Todas as comissões calculadas, base, alíquota, status de pagamento |
| **Relatório de Atividade do Ecossistema** | Trimestral | Performance por parceiro, tier, KPIs individuais |
| **Relatório de Conformidade do Programa** | Anual | Aderência às regras, parceiros fora de compliance, ações tomadas |

### 15.3 Checklist Trimestral

- [ ] Avaliação de score realizada para todos os parceiros ativos
- [ ] Certificações vencidas identificadas e parceiros notificados
- [ ] Comissões do trimestre calculadas, registradas e comunicadas
- [ ] Parceiros inativos em protocolo ou desativados
- [ ] Relatório trimestral publicado e distribuído
- [ ] Atribuições contestadas resolvidas e documentadas

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml
# Módulo: MOD-CAP-09 — Gestão de Canais e Parcerias
# Versão: 2.0.0
# Infraestrutura: Engine de Autogestão SOE

module:
  id: MOD-CAP-09
  name: "Gestão de Canais e Parcerias"
  version: "2.0.0"
  tier: Core
  layer: Execution
  status: ATIVO

dependencies:
  upstream_events:
    - source: MOD-CAP-01
      events:
        - mercado.icp.atualizado
    - source: MOD-CAP-06
      events:
        - oferta.tabela_precos.atualizada
        - oferta.produto.descontinuado
    - source: MOD-CAP-03
      events:
        - oportunidade.ganha
        - oportunidade.encerrada
    - source: MOD-CAP-05
      events:
        - cliente.churned
    - source: ENG-02
      events:
        - kpi.limiar.cruzado
    - source: ENG-03
      events:
        - alerta.emitido
    - source: ENG-05
      events:
        - plano_acao.concluido
    - source: Scheduler
      events:
        - sistema.periodo_encerrado

published_events:
  - id: EVT-CP-PUB-01
    name: parceiro.lead_indicado
    consumers: [MOD-CAP-02]
  - id: EVT-CP-PUB-02
    name: parceiro.ativado
    consumers: [ENG-02, ENG-06, MOD-CAP-08]
  - id: EVT-CP-PUB-03
    name: parceiro.desativado
    consumers: [ENG-02, ENG-06, MOD-CAP-08]
  - id: EVT-CP-PUB-04
    name: parceiro.tier_alterado
    consumers: [ENG-02, ENG-06]
  - id: EVT-CP-PUB-05
    name: parceiro.comissao_calculada
    consumers: [MOD-CAP-04, ENG-06]
  - id: EVT-CP-PUB-06
    name: parceiro.inativo_detectado
    consumers: [ENG-03, ENG-05]
  - id: EVT-CP-PUB-07
    name: parceiro.pip_iniciado
    consumers: [ENG-06, MOD-CAP-07]
  - id: EVT-CP-PUB-08
    name: parceiro.ativacao_falhou
    consumers: [ENG-03, ENG-05]
  - id: EVT-CP-PUB-09
    name: parceiro.certificacao_vencida
    consumers: [ENG-03]
  - id: EVT-CP-PUB-10
    name: parceiro.avaliacao_trimestral_concluida
    consumers: [ENG-06, MOD-CAP-08]
  - id: EVT-CP-PUB-11
    name: ecossistema.relatorio_publicado
    consumers: [MOD-CAP-08, ENG-06]
  - id: EVT-CP-PUB-12
    name: parceiro.contrato_renovado
    consumers: [ENG-06]

shared_services:
  - engine: ENG-01
    usage: "Execução de processos de onboarding, capacitação e desativação de parceiros"
  - engine: ENG-02
    usage: "Cálculo e monitoramento de KPI-CP-01 a KPI-CP-12"
    kpis_registrados:
      - KPI-CP-01  # Total de Parceiros Ativos
      - KPI-CP-02  # Taxa de Ativação
      - KPI-CP-03  # Leads Gerados por Parceiros
      - KPI-CP-04  # Taxa de Conversão de Leads
      - KPI-CP-05  # Receita Atribuída a Parceiros
      - KPI-CP-06  # % Receita via Canal Indireto
      - KPI-CP-07  # Parceiros com Score Crítico
      - KPI-CP-08  # Tempo Médio de Ativação
      - KPI-CP-09  # Taxa de Retenção de Parceiros
      - KPI-CP-10  # Receita Média por Parceiro Ativo
      - KPI-CP-11  # Taxa de Estorno de Comissões
      - KPI-CP-12  # Comparativo Qualidade Canal Direto vs. Indireto
  - engine: ENG-03
    usage: "Alertas ALT-CP-01 a ALT-CP-08"
    alertas_registrados:
      - ALT-CP-01  # Parceiro inativo
      - ALT-CP-02  # Taxa de ativação crítica
      - ALT-CP-03  # Score crítico
      - ALT-CP-04  # Qualidade de leads degradada
      - ALT-CP-05  # Concentração de receita
      - ALT-CP-06  # Certificação vencida
      - ALT-CP-07  # Pipeline de canal insuficiente
      - ALT-CP-08  # Taxa de estorno elevada
  - engine: ENG-04
    usage: "Diagnóstico de degradação do ecossistema de parceiros"
  - engine: ENG-05
    usage: "Planos de ação PA-CP-01 a PA-CP-03"
  - engine: ENG-06
    usage: "Auditoria de aprovações, comissões, estornos e desativações"
    nivel_auditoria: CRITICAL_AND_HIGH
  - engine: ENG-07
    usage: "Workflows de aprovação de novos parceiros, upgrades de tier, exclusividades, desativações"
    workflows_registrados:
      - "WF-CP-APROVACAO-PARCEIRO"
      - "WF-CP-EXCLUSIVIDADE-TERRITORIAL"
      - "WF-CP-DESATIVACAO-PARCEIRO"
      - "WF-CP-CONTESTACAO-ATRIBUICAO"
  - engine: ENG-08
    usage: "Conectores com portal de parceiros, CRM, LMS, sistema de comissões"
    connectors:
      - id: CONN-PORTAL-PARCEIROS
        type: BIDIRECTIONAL
        purpose: "Gestão de leads, comunicação e materiais para parceiros"
      - id: CONN-CRM-PRINCIPAL
        type: BIDIRECTIONAL
        purpose: "Registro de leads com atribuição de parceiro"
      - id: CONN-LMS-CERTIFICACOES
        type: BIDIRECTIONAL
        purpose: "Gestão de trilhas e certificações de parceiros"
      - id: CONN-EMAIL-TRANSACIONAL
        type: OUTBOUND
        purpose: "Notificações de comissão, inatividade, certificações"
      - id: CONN-MENSAGERIA
        type: OUTBOUND
        purpose: "Alertas operacionais para gestores de canal"
  - engine: ENG-09
    usage: "PDCA do programa de parceiros; análise de efetividade do canal indireto"
  - engine: ENG-10
    usage: "Playbooks de parceiros, materiais de treinamento, melhores práticas do canal"

required_permissions:
  - CHANNEL_PARTNER_READ
  - CHANNEL_PARTNER_WRITE
  - CHANNEL_COMMISSION_READ
  - CHANNEL_COMMISSION_WRITE
  - CHANNEL_PROGRAM_ADMIN
  - LEAD_ATTRIBUTION_READ
  - LEAD_ATTRIBUTION_WRITE

monitored_kpis:
  primary:
    - KPI-CP-05  # Receita Atribuída a Parceiros (principal indicador de resultado)
    - KPI-CP-06  # % Receita via Canal Indireto
  operational:
    - KPI-CP-01  # Total de Parceiros Ativos
    - KPI-CP-03  # Leads Gerados por Parceiros
    - KPI-CP-04  # Taxa de Conversão
  health:
    - KPI-CP-07  # Parceiros com Score Crítico
    - KPI-CP-09  # Taxa de Retenção

enabled_automations:
  - AUT-CP-01  # Provisionamento de acesso ao portal
  - AUT-CP-02  # Notificação de lead atribuído
  - AUT-CP-03  # Cálculo de comissão
  - AUT-CP-04  # Alerta de inatividade
  - AUT-CP-05  # Notificação de certificação
  - AUT-CP-06  # Rebaixamento de tier automático
  - AUT-CP-07  # Comunicação de oferta atualizada
  - AUT-CP-08  # Relatório trimestral de canal
```

---

*MOD-CAP-09 v2.0.0 — Commercial Operating System | Engine de Autogestão SOE*
*Este módulo é um microserviço independente. Toda infraestrutura de governança é provida pela Engine de Autogestão.*
