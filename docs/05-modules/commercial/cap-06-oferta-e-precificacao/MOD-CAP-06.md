---
id: MOD-CAP-06
titulo: "CAP-06 — Gestão de Oferta e Precificação"
versao: "2.0.0"
status: aprovado
categoria: Commercial-OS-Module
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-29
dependencias:
  - ARC-ENG-000
  - ARC-ENG-002
  - ARC-ENG-003
  - ARC-ENG-006
  - ARC-ENG-009
  - MOD-CAP-01
tags: [commercial-os, cap-06, oferta, precificacao, pricing, tabela-precos, desconto, portfolio]
---

# CAP-06 — Gestão de Oferta e Precificação

> **Módulo do Commercial Operating System**
> Infraestrutura compartilhada: `docs/02-architecture/engine-autogestao/`
> Contrato de integração: `ENGINE-CONTRATO-DE-INTEGRACAO.md` (ARC-ENG-099)
>
> **Especialização de negócio:** a metodologia genérica de oferta/tabela de preços/desconto
> descrita neste módulo é especializada, para a vertical de compra e venda de motocicletas
> da MM Negócios Veículos, em `ENGENHARIA-PRECIFICACAO-MOTOS-MM.md` — que define os 10
> pilares de precificação (LP, margens em camadas, precificação dinâmica por dias de
> estoque etc.) e é acompanhada da planilha operacional
> `planilha-precificacao/MM-Negocios-Precificacao-Motos.xlsx`.

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| **ID do Módulo** | CAP-06 |
| **Nome** | Gestão de Oferta e Precificação |
| **Domínio** | Estratégia de Produto-Preço-Mercado |
| **Versão** | 2.0.0 |
| **Tier** | Core — habilitador transversal |
| **Posição na cadeia** | Serve CAP-03, CAP-04, CAP-05, CAP-09 |
| **Registro na Engine** | `ENGINE-REGISTRATION.yaml` (seção 16) |

---

## 2. Objetivo

Definir, manter e governar **o portfólio de ofertas e a estrutura de precificação** do Commercial OS — garantindo que todos os módulos operem com a mesma referência de produtos, serviços, preços, condições e políticas de desconto.

O CAP-06 é a camada de produto-preço do sistema: ele não vende nem entrega, mas define o que pode ser vendido, por qual preço, com quais condições e com quais limites de desconto. Sem CAP-06 atualizado e governado, o sistema comercial perde coerência — cada vendedor opera com preços diferentes, os descontos não têm limite e a margem não é gerenciada.

---

## 3. Escopo

### 3.1 Dentro do Escopo
- Definição e manutenção do catálogo de produtos e serviços
- Gestão da tabela de preços oficial (única fonte de verdade)
- Definição e governança da política de descontos (níveis e limites)
- Revisão periódica de preços com base em dados de mercado e margem
- Gestão de condições especiais (bundles, pacotes, preços por volume)
- Publicação de atualizações de preço para os módulos dependentes

### 3.2 Fora do Escopo
- Negociação de propostas individuais → CAP-03
- Análise competitiva de preço → CAP-01 (fornece insumos)
- Faturamento → CAP-04
- Expansão de clientes → CAP-05

---

## 4. Responsabilidades

| # | Responsabilidade | Frequência |
|---|-----------------|-----------|
| R-01 | Manter catálogo de produtos/serviços atualizado | Contínuo |
| R-02 | Manter tabela de preços única e oficial | Revisão anual obrigatória |
| R-03 | Definir e publicar política de descontos com limites por nível | Por mudança |
| R-04 | Publicar `oferta.tabela_precos.atualizada` quando preços mudam | Por mudança |
| R-05 | Publicar `oferta.politica_desconto.atualizada` quando limites mudam | Por mudança |
| R-06 | Monitorar desconto médio praticado vs. política | Mensal |
| R-07 | Monitorar margem por produto vs. meta | Mensal |
| R-08 | Executar revisão anual de preços com base em dados | Anual |

---

## 5. Capacidades Internas

### CAP-06.1 — Catálogo de Produtos e Serviços

```yaml
produto:
  id: "PROD-ID"
  nome: "nome do produto ou serviço"
  tipo: "produto | servico | bundle | addon | plataforma"
  descricao: "descrição da entrega"
  status: "ativo | descontinuado | em_desenvolvimento"

  modelo_comercial:
    tipo: "recorrente | pontual | por_uso | hibrido"
    frequencia_cobranca: "mensal | anual | unico | por_evento"

  segmentos_alvo: []  # lista de SEG-IDs

  unidade_de_venda: "por_usuario | por_empresa | por_volume | fixo"
  faixas_volume: []  # se precificação por volume

  restricoes:
    - "requer produto X para funcionar"
    - "incompatível com produto Y"

  ativo: true
  criado_em: ""
  descontinuado_em: null
```

### CAP-06.2 — Tabela de Preços

```yaml
tabela_precos:
  id: "TBL-ID"
  versao: "1.0.0"
  vigente_a_partir: "data"
  status: "vigente | arquivada"

  moeda: "BRL"

  itens:
    - produto_id: "PROD-ID"
      preco_unitario: 0.0
      preco_anual: null  # se desconto por antecipação anual
      desconto_anual_percentual: 0.0
      faixas_volume:
        - volume_minimo: 1
          volume_maximo: 10
          preco_unitario: 0.0
        - volume_minimo: 11
          volume_maximo: 50
          preco_unitario: 0.0

  condicoes_especiais:
    - id: "COND-BUNDLE-01"
      nome: "Bundle Comercial Completo"
      produtos: []
      desconto_bundle: 0.0
      condicao_elegibilidade: ""

  ultima_revisao: ""
  proxima_revisao: ""
  responsavel_revisao: ""
```

### CAP-06.3 — Política de Descontos

```yaml
politica_desconto:
  versao: "1.0.0"
  vigente_a_partir: "data"

  niveis:
    - nivel: "N0"
      descricao: "Preço de tabela — sem desconto"
      limite_percentual: 0
      aprovador: "vendedor"
      registro_obrigatorio: false

    - nivel: "N1"
      descricao: "Desconto comercial padrão"
      limite_percentual: 10  # configurável
      aprovador: "vendedor"
      registro_obrigatorio: false

    - nivel: "N2"
      descricao: "Desconto estratégico"
      limite_percentual: 20  # configurável
      aprovador: "gestor_comercial"
      registro_obrigatorio: true
      prazo_aprovacao_horas: 24

    - nivel: "N3"
      descricao: "Desconto excepcional"
      limite_percentual: null  # acima de N2
      aprovador: "diretoria"
      registro_obrigatorio: true
      prazo_aprovacao_horas: 48
      justificativa_obrigatoria: true

  restricoes:
    - "desconto não se aplica a produto PROD-X (margem mínima)"
    - "desconto N3 não pode ser concedido em novos clientes nos primeiros 12 meses"

  validade_desconto_concedido: 30  # dias
```

---

## 6. Fluxo Operacional

```
[FLUXO A — REVISÃO ANUAL DE PREÇOS]

[TRIGGER: sistema.periodo_encerrado (anual) OU gatilho manual]
│
├─► Coletar insumos:
│   ├─ Desconto médio praticado por produto (KPI-OP-05)
│   ├─ Margem por produto (KPI-OP-06)
│   ├─ Win Rate por faixa de preço (via CAP-01/CAP-03)
│   ├─ Referências de mercado e concorrência (via CAP-01)
│   └─ NRR e churn por produto (via CAP-04/CAP-05)
│
├─► Análise: preço está gerando margem adequada? Está competitivo?
│
├─► Propor ajustes de preço (nova versão da tabela)
│
├─► Aprovação: diretoria comercial
│
├─► Publicar nova tabela com data de vigência
│   └─► Publicar: oferta.tabela_precos.atualizada
│       ├─► CAP-03: atualiza base de cálculo de propostas
│       ├─► CAP-04: atualiza faturamento de novos contratos
│       └─► CAP-09: atualiza tabela repassada a parceiros


[FLUXO B — ATUALIZAÇÃO DE POLÍTICA DE DESCONTO]

[TRIGGER: desconto médio fora do limite OU decisão estratégica]
│
├─► Analisar: política atual está sendo respeitada? Está gerando resultado?
├─► Propor ajuste nos limites dos níveis
├─► Aprovação: diretoria comercial
├─► Publicar nova política
│   └─► Publicar: oferta.politica_desconto.atualizada
│       ├─► CAP-03: recalibrar limites de aprovação de desconto
│       └─► CAP-05: atualizar limites de desconto de retenção
```

---

## 7. Estados

### 7.1 Estados do Produto

```
EM_DESENVOLVIMENTO → ATIVO → DESCONTINUADO
```

### 7.2 Estados da Tabela de Preços

```
RASCUNHO → APROVADA → VIGENTE → ARQUIVADA (ao ser substituída)
```

### 7.3 Estados da Política de Desconto

```
RASCUNHO → APROVADA → VIGENTE → ARQUIVADA
```

---

## 8. Regras de Negócio

### RN-01 — Uma Única Tabela de Preços Vigente
Em nenhum momento pode existir mais de uma tabela de preços com status `vigente`. Antes de ativar uma nova tabela, a anterior é automaticamente arquivada. Múltiplas tabelas ativas é uma não-conformidade grave.

### RN-02 — Preço de Tabela é a Base de Toda Proposta
Toda proposta gerada em CAP-03 DEVE partir do preço de tabela vigente. Proposta com preço diferente da tabela sem desconto registrado e aprovado é inválida.

### RN-03 — Revisão Anual Obrigatória
A tabela de preços DEVE ser formalmente revisada ao menos uma vez por ano, com evidências documentadas (margem, mercado, win rate). Revisão não executada é não-conformidade. A revisão pode concluir que os preços estão corretos — mas a análise é obrigatória.

### RN-04 — Desconto Concedido Tem Validade
Todo desconto de nível N2 ou N3 concedido em uma proposta tem validade máxima de 30 dias. Após a expiração, a proposta precisa ser reemitida com aprovação renovada. Desconto não tem caráter permanente — exceto quando incorporado ao contrato assinado.

### RN-05 — Produto Descontinuado Não Aceita Novos Contratos
Um produto com status `descontinuado` não pode ser incluído em novas propostas. Clientes com contratos vigentes do produto descontinuado mantêm suas condições até o fim do contrato. A descontinuação DEVE ter período de aviso de 90 dias mínimo.

### RN-06 — Desconto Médio Monitorado como KPI
O desconto médio praticado pelo time comercial é um KPI primário do módulo. Desconto médio acima do limite N1 por 2 meses consecutivos é alerta de que a política de desconto não está sendo seguida ou que o preço de tabela está acima do mercado.

---

## 9. Eventos Publicados

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `oferta.tabela_precos.atualizada` | Nova tabela de preços vigente | `{tabela_id, versao, vigente_a_partir, itens_alterados[], motivo_revisao}` |
| `oferta.politica_desconto.atualizada` | Nova política de descontos vigente | `{politica_versao, niveis_alterados[], vigente_a_partir}` |
| `oferta.produto.criado` | Novo produto adicionado ao catálogo | `{produto_id, nome, tipo, segmentos_alvo[]}` |
| `oferta.produto.descontinuado` | Produto marcado como descontinuado | `{produto_id, nome, data_efetiva_descontinuacao, clientes_afetados_count}` |
| `oferta.revisao_preco.iniciada` | Revisão anual iniciada | `{periodo_referencia, responsavel, data_prevista_conclusao}` |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `mercado.icp.atualizado` | CAP-01 | Revisar se portfólio e preços estão alinhados ao novo ICP |
| `mercado.sinal.detectado` | CAP-01 | Se sinal é competitivo de preço: avaliar necessidade de revisão |
| `sistema.periodo_encerrado` | Scheduler (anual) | Disparar revisão anual de preços |
| `melhoria.item.implementado` | ENG-09 | Revisar processos impactados |

---

## 11. KPIs

| ID | Nome | Fórmula | Meta | Frequência |
|----|------|---------|------|-----------|
| KPI-OP-01 | Receita por Produto | `MRR por produto_id` | Crescente | Mensal |
| KPI-OP-02 | Mix de Receita por Produto | `mrr_produto / mrr_total × 100` | Definido por estratégia | Mensal |
| KPI-OP-03 | Win Rate por Faixa de Preço | `ganhos_faixa / total_faixa × 100` | Referência mercado | Mensal |
| KPI-OP-04 | Ticket Médio por Produto | `receita_produto / clientes_produto` | Crescente | Mensal |
| KPI-OP-05 | Desconto Médio Praticado | `média(desconto_percentual das propostas)` | ≤ N1 limit | Mensal |
| KPI-OP-06 | Margem por Produto | `(receita - custo) / receita × 100` | Por produto | Mensal |
| KPI-OP-07 | Aderência à Política de Desconto | `propostas_dentro_da_politica / total_propostas × 100` | ≥ 99% | Mensal |
| KPI-OP-08 | Descontos N2+ Aprovados vs. Solicitados | `n2_aprovados / n2_solicitados × 100` | Referência | Mensal |

---

## 12. Alertas

| ID | Condição | Severidade | Ação |
|----|---------|-----------|------|
| ALT-OP-01 | Desconto médio > N1 por 2 meses consecutivos | WARNING | Revisar política; verificar pressão de mercado |
| ALT-OP-02 | Margem de produto < limite mínimo definido | CRITICAL | Suspender novas vendas do produto; revisar custos/preço |
| ALT-OP-03 | Tabela de preços não revisada há > 12 meses | WARNING | Iniciar revisão anual obrigatória |
| ALT-OP-04 | Proposta com desconto não autorizado detectada | CRITICAL | NC na ENG-06; notificar gestor; invalidar proposta |
| ALT-OP-05 | Produto sem contrato há > 90 dias | WARNING | Avaliar relevância; considerar descontinuação |

---

## 13. Planos de Ação Automáticos

### PA-OP-01 — Desconto Médio Acima do Limite (Gatilho: ALT-OP-01)
```yaml
plano_acao:
  tipo: analise_e_decisao
  prazo_dias: 21
  tarefas:
    - "Analisar: desconto alto é de vendedor específico ou padrão sistêmico?"
    - "Verificar: preço de tabela está competitivo? (insumo de CAP-01)"
    - "Se preço acima do mercado: iniciar revisão antecipada de preços"
    - "Se prática do time: treinamento de negociação de valor via CAP-07"
    - "Se política de desconto inadequada: propor ajuste na política"
  metrica_sucesso: "Desconto médio dentro do N1 em 60 dias"
```

---

## 14. Automações

| ID | Trigger | Ação Automatizada | Conector |
|----|---------|-----------------|---------|
| AUT-OP-01 | `oferta.tabela_precos.atualizada` | Notificar CAP-03, CAP-04, CAP-09 via eventos | Barramento SOE |
| AUT-OP-02 | `sistema.periodo_encerrado` (anual) | Iniciar processo de revisão anual de preços | CONN-MENSAGERIA |
| AUT-OP-03 | `sistema.periodo_encerrado` (mensal) | Calcular KPI-OP-01 a KPI-OP-08 | ENG-02 |

---

## 15. Auditoria Operacional

### Checklist Mensal — CAP-06-AUD-MENSAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Tabela de preços vigente e sem concorrentes ativas | Status das tabelas | Exatamente 1 tabela vigente |
| 2 | Desconto médio dentro do limite N1 | KPI-OP-05 | Valor ≤ limite N1 |
| 3 | Aderência à política de desconto ≥ 99% | KPI-OP-07 | Valor do KPI |
| 4 | Produtos com margem abaixo do mínimo identificados e tratados | KPI-OP-06 | Zero produtos abaixo sem plano |
| 5 | Alertas do mês tratados dentro do SLA | Taxa de resolução | ≥ 90% |

### Checklist Anual — CAP-06-AUD-ANUAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Revisão anual de preços concluída com evidências | Documento de revisão | Relatório com dados de margem e mercado |
| 2 | Catálogo de produtos atualizado | Verificar status de cada produto | Nenhum produto ativo sem revisão anual |
| 3 | Política de desconto revisada | Documento de política | Política vigente com data ≤ 12 meses |

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml — CAP-06 Gestão de Oferta e Precificação
# Ref: ARC-ENG-099

modulo:
  id: "CAP-06"
  nome: "Gestão de Oferta e Precificação"
  versao: "2.0.0"
  tier: "core"
  status: "ativo"

dependencias:
  modulos:
    - id: "CAP-01"
      uso: "inteligência competitiva de preço e sinais de mercado"
  engines:
    - id: "ENG-02"
      uso: "KPIs KPI-OP-01 a KPI-OP-08"
    - id: "ENG-03"
      uso: "alertas ALT-OP-01 a ALT-OP-05"
    - id: "ENG-05"
      uso: "plano de ação PA-OP-01"
    - id: "ENG-06"
      uso: "auditoria mensal e anual"
    - id: "ENG-09"
      uso: "melhoria contínua de pricing e portfólio"

eventos_publicados:
  - evento: "oferta.tabela_precos.atualizada"
    condicao: "nova tabela de preços vigente"
  - evento: "oferta.politica_desconto.atualizada"
    condicao: "nova política de descontos vigente"
  - evento: "oferta.produto.criado"
    condicao: "novo produto adicionado ao catálogo"
  - evento: "oferta.produto.descontinuado"
    condicao: "produto marcado como descontinuado"
  - evento: "oferta.revisao_preco.iniciada"
    condicao: "revisão anual iniciada"

eventos_consumidos:
  - evento: "mercado.icp.atualizado"
    origem: "CAP-01"
    acao: "revisar alinhamento do portfólio e preços ao novo ICP"
  - evento: "mercado.sinal.detectado"
    origem: "CAP-01"
    acao: "avaliar necessidade de revisão de preços se sinal é competitivo"
  - evento: "sistema.periodo_encerrado"
    origem: "Scheduler"
    acao: "disparar revisão anual se período = anual; calcular KPIs se mensal"
  - evento: "melhoria.item.implementado"
    origem: "ENG-09"
    acao: "revisar processos impactados"

kpis_registrados:
  - id: "KPI-OP-01"
    nome: "Receita por Produto"
    formula: "mrr por produto_id"
    unidade: "moeda"
    dimensao: "produto_id"
    frequencia_calculo: "mensal"
  - id: "KPI-OP-02"
    nome: "Mix de Receita por Produto"
    formula: "mrr_produto / mrr_total * 100"
    unidade: "percentual"
    dimensao: "produto_id"
    frequencia_calculo: "mensal"
  - id: "KPI-OP-03"
    nome: "Win Rate por Faixa de Preço"
    formula: "ganhos_faixa / total_faixa * 100"
    unidade: "percentual"
    dimensao: "faixa_preco"
    frequencia_calculo: "mensal"
  - id: "KPI-OP-04"
    nome: "Ticket Médio por Produto"
    formula: "receita_produto / clientes_produto"
    unidade: "moeda"
    dimensao: "produto_id"
    frequencia_calculo: "mensal"
  - id: "KPI-OP-05"
    nome: "Desconto Médio Praticado"
    formula: "media(desconto_percentual_propostas)"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: "limite_N1"
  - id: "KPI-OP-06"
    nome: "Margem por Produto"
    formula: "(receita_produto - custo_produto) / receita_produto * 100"
    unidade: "percentual"
    dimensao: "produto_id"
    frequencia_calculo: "mensal"
  - id: "KPI-OP-07"
    nome: "Aderência à Política de Desconto"
    formula: "propostas_dentro_da_politica / total_propostas * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 99
    limiar_critical: 97
  - id: "KPI-OP-08"
    nome: "Taxa de Aprovação de Descontos N2+"
    formula: "n2_aprovados / n2_solicitados * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"

alertas_registrados:
  - id: "ALT-OP-01"
    kpi_ref: "KPI-OP-05"
    condicao: "> limite_N1 por 2 meses"
    severidade: "warning"
    owner: "responsavel_cap06"
  - id: "ALT-OP-02"
    kpi_ref: "KPI-OP-06"
    condicao: "< margem_minima_por_produto"
    severidade: "critical"
    owner: "diretoria_comercial"
  - id: "ALT-OP-03"
    condicao: "tabela_precos.dias_sem_revisao > 365"
    severidade: "warning"
    owner: "responsavel_cap06"
  - id: "ALT-OP-04"
    kpi_ref: "KPI-OP-07"
    condicao: "< 97"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-OP-05"
    condicao: "produto.dias_sem_contrato_novo > 90"
    severidade: "warning"
    owner: "responsavel_cap06"

workflows_registrados:
  - id: "WF-OP-01"
    nome: "Propagação de Tabela de Preços Atualizada"
    gatilho: "oferta.tabela_precos.atualizada"
    descricao: "notifica CAP-03, CAP-04, CAP-09"
  - id: "WF-OP-02"
    nome: "Revisão Anual de Preços"
    gatilho: "sistema.periodo_encerrado (anual)"
    descricao: "coleta insumos, notifica responsável, inicia processo de revisão"

auditoria_checklists:
  - id: "CAP-06-AUD-MENSAL"
    tipo: "mensal"
    itens_count: 5
  - id: "CAP-06-AUD-ANUAL"
    tipo: "anual"
    itens_count: 3

conectores_utilizados:
  - "CONN-MENSAGERIA"

permissoes_necessarias:
  - recurso: "produto_catalog"
    acoes: ["read", "write"]
  - recurso: "tabela_precos"
    acoes: ["read", "write", "version"]
  - recurso: "politica_desconto"
    acoes: ["read", "write", "version"]
  - recurso: "kpi_values.KPI-OP-*"
    acoes: ["read", "write_via_eng02"]
  - recurso: "eventos_barramento"
    acoes: ["publish", "subscribe"]
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial |
| 2.0.0 | 2026-06-29 | Guardião da Documentação | Redesenho como microserviço do Commercial OS |
