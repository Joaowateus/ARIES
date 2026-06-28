---
id: IDX-COM-001
titulo: "Índice do Núcleo Comercial — Módulos Operacionais"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
tags: [nucleo-comercial, indice, cap, modulos-operacionais]
---

# Núcleo Comercial — Índice de Módulos Operacionais

## Visão Geral da Arquitetura

O Núcleo Comercial do SOE é composto por **9 Módulos Operacionais** organizados em camadas funcionais:

```
┌─────────────────────────────────────────────────────────────────┐
│                   CAP-08: Performance e Autogestão              │
│              (Hub central — consolida todos os módulos)         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    │                       │                       │
    ▼                       ▼                       ▼
┌──────────┐         ┌──────────────┐        ┌──────────┐
│  CAP-01  │         │   CAP-06     │        │  CAP-07  │
│Intelig.  │         │Oferta e      │        │ Equipe   │
│Comercial │         │Precificação  │        │Comercial │
└────┬─────┘         └──────┬───────┘        └────┬─────┘
     │                      │                      │
     ▼                      ▼                      │
┌──────────┐         ┌──────────┐                  │
│  CAP-02  │         │  CAP-04  │                  │
│Gestão de │         │Gestão de │                  │
│ Demanda  │         │ Receita  │◄─────────────────┘
└────┬─────┘         └────┬─────┘
     │                    │
     ▼                    ▼
┌──────────┐         ┌──────────┐
│  CAP-03  │         │  CAP-05  │
│ Processo │         │Gestão de │
│ Vendas   │────────►│ Clientes │
└──────────┘         └──────────┘
                           ▲
                     ┌─────┴──────┐
                     │   CAP-09   │
                     │ Canais e   │
                     │ Parcerias  │
                     └────────────┘
```

## Catálogo de Módulos

| ID | Módulo | Arquivo | Camada | Status |
|----|--------|---------|--------|--------|
| CAP-01 | Inteligência Comercial | `cap-01-inteligencia-comercial/MOD-CAP-01.md` | Fundação epistêmica | ✅ Aprovado |
| CAP-02 | Gestão de Demanda | `cap-02-gestao-de-demanda/MOD-CAP-02.md` | Geração de pipeline | ✅ Aprovado |
| CAP-03 | Gestão do Processo de Vendas | `cap-03-gestao-processo-vendas/MOD-CAP-03.md` | Conversão | ✅ Aprovado |
| CAP-04 | Gestão de Receita | `cap-04-gestao-de-receita/MOD-CAP-04.md` | Monetização | ✅ Aprovado |
| CAP-05 | Gestão de Clientes | `cap-05-gestao-de-clientes/MOD-CAP-05.md` | Retenção e expansão | ✅ Aprovado |
| CAP-06 | Gestão de Oferta e Precificação | `cap-06-oferta-e-precificacao/MOD-CAP-06.md` | Produto comercial | ✅ Aprovado |
| CAP-07 | Gestão da Equipe Comercial | `cap-07-gestao-equipe-comercial/MOD-CAP-07.md` | Capital humano | ✅ Aprovado |
| CAP-08 | Gestão de Performance e Autogestão | `cap-08-performance-e-autogestao/MOD-CAP-08.md` | Hub central | ✅ Aprovado |
| CAP-09 | Gestão de Canais e Parcerias | `cap-09-canais-e-parcerias/MOD-CAP-09.md` | Evolução / canal indireto | ✅ Aprovado |

## Estrutura Padrão de Cada Módulo (13 Seções)

Todos os módulos seguem exatamente a mesma estrutura:

| # | Seção | Propósito |
|---|-------|-----------|
| 1 | Objetivo da Capacidade | O que este módulo faz e por quê existe |
| 2 | Resultado Esperado | O que deve ser verdade quando o módulo funciona bem |
| 3 | Entradas Necessárias | O que alimenta este módulo (dados, documentos, eventos) |
| 4 | Saídas Obrigatórias | O que este módulo produz para outros módulos e stakeholders |
| 5 | Regras de Negócio | As leis internas que governam a operação deste módulo |
| 6 | Fluxo Operacional Completo | Entrada → Processamento → Decisão → Saída → Registro → Auditoria |
| 7 | Indicadores de Desempenho (KPIs) | Como medimos se o módulo está saudável |
| 8 | Gatilhos e Alertas Operacionais | Quando o sistema detecta que algo está errado |
| 9 | Diagnóstico de Desvios e Análise de Causa Raiz | Como investigar quando um KPI desvia |
| 10 | Planos de Ação Padronizados | O que fazer para corrigir os desvios mais comuns |
| 11 | Procedimentos de Auditoria | Como verificar a saúde do módulo periodicamente |
| 12 | Possibilidades de Automação | CRM, IA, dashboards, integrações e workflows |
| 13 | Interfaces e Dependências | Como este módulo se conecta com os demais |

## Matriz de Dependências entre Módulos

| Módulo | Depende de | É dependência de |
|--------|-----------|-----------------|
| CAP-01 | — (fundação) | CAP-02, CAP-03, CAP-06, CAP-07, CAP-08, CAP-09 |
| CAP-02 | CAP-01, CAP-06, CAP-07, CAP-08 | CAP-03, CAP-05, CAP-09 |
| CAP-03 | CAP-01, CAP-02, CAP-04, CAP-06 | CAP-04, CAP-05 |
| CAP-04 | CAP-03, CAP-05, CAP-06, CAP-08 | CAP-05, CAP-08 |
| CAP-05 | CAP-03, CAP-04, CAP-06, CAP-08 | CAP-02, CAP-04, CAP-08 |
| CAP-06 | CAP-01, CAP-04, CAP-08 | CAP-02, CAP-03, CAP-05, CAP-09 |
| CAP-07 | CAP-08 | CAP-02, CAP-03, CAP-05 |
| CAP-08 | CAP-01→07 (todos) | CAP-01→07 (todos) — fornece metas |
| CAP-09 | CAP-01, CAP-02, CAP-03, CAP-06, CAP-08 | CAP-02 (leads), CAP-03 (SQLs) |

## Sequência de Implementação Recomendada

Para empresas implementando o SOE do zero:

```
Fase 1 (Fundação):    CAP-01 → CAP-06 → CAP-08 (metas)
Fase 2 (Pipeline):    CAP-02 → CAP-07 (equipe)
Fase 3 (Conversão):   CAP-03 → CAP-04 (faturamento)
Fase 4 (Retenção):    CAP-05
Fase 5 (Escala):      CAP-09 (quando canal direto estiver maduro)
```

## KPIs Master do Núcleo Comercial

Os KPIs estratégicos consolidados em CAP-08:

| Perspectiva | KPI | Meta |
|-------------|-----|------|
| Crescimento | MRR | Meta anual / 12 |
| Crescimento | New MRR | Meta mensal |
| Crescimento | ARR | Meta anual |
| Eficiência | Win Rate | Meta por segmento |
| Eficiência | CAC | ≤ Meta |
| Eficiência | LTV/CAC | ≥ 3 |
| Retenção | NRR | ≥ Meta (idealmente ≥ 100%) |
| Retenção | Churn Rate | ≤ Meta |
| Satisfação | NPS | ≥ Meta |
| Pipeline | Pipeline Total | ≥ 3× meta mensal |
| Previsão | Acuracidade Forecast | ≥ 90% |
| Equipe | % equipe acima de quota | ≥ 70% |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação do índice com 9 módulos operacionais completos |
