---
id: ARC-ENG-000
titulo: "Engine de Autogestão — Visão Geral e Arquitetura"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias: []
tags: [engine, autogestao, infraestrutura, arquitetura, servicos-compartilhados, soe]
---

# Engine de Autogestão — Visão Geral e Arquitetura

---

## Premissa Arquitetural

Os Módulos Operacionais (CAP-01 a CAP-09) NÃO são sistemas independentes.

Cada módulo **consome serviços** fornecidos por uma camada de infraestrutura compartilhada que governa, de forma uniforme, como qualquer processo do SOE é executado, medido, monitorado, diagnosticado, corrigido e aprimorado.

Esta camada é a **Engine de Autogestão**.

A Engine de Autogestão é o que transforma um conjunto de módulos documentados em um **Sistema Operacional Empresarial** que se auto-monitora, se auto-diagnostica e tende à auto-correção — reduzindo progressivamente a dependência de decisões humanas para manter o sistema operando dentro dos parâmetros esperados.

---

## Princípio Fundamental

> **"Qualquer módulo, qualquer processo, um único mecanismo de governança."**

A consequência desse princípio é que:

- O modo como o KPI de Inteligência Comercial é calculado segue o mesmo mecanismo que o KPI de Retenção de Clientes.
- O modo como um alerta de pipeline é disparado segue o mesmo mecanismo que um alerta de inadimplência.
- O modo como um desvio de win rate é diagnosticado segue o mesmo mecanismo que um desvio de churn.
- O modo como um plano de ação é criado para um módulo é idêntico ao de qualquer outro.

Isso é o que gera **previsibilidade, auditabilidade e escalabilidade** — as três propriedades essenciais de um sistema que opera além da dependência de pessoas específicas.

---

## Posição na Arquitetura do SOE

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAMADA ESTRATÉGICA                           │
│              Constituição · OKRs · Planejamento · Metas             │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                    CAMADA DE MÓDULOS OPERACIONAIS                   │
│   CAP-01 · CAP-02 · CAP-03 · CAP-04 · CAP-05 · CAP-06 · CAP-07   │
│                     CAP-08 · CAP-09                                 │
│                                                                     │
│   (Cada módulo define SUAS regras, KPIs, processos e objetivos)    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                    consomem serviços de
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                     ENGINE DE AUTOGESTÃO                            │
│                  (Infraestrutura Compartilhada)                     │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ENG-01        │  │ENG-02        │  │ENG-03                    │  │
│  │Execução de   │  │KPIs          │  │Alertas                   │  │
│  │Processos     │  │              │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ENG-04        │  │ENG-05        │  │ENG-06                    │  │
│  │Diagnóstico   │  │Planos de     │  │Auditoria                 │  │
│  │              │  │Ação          │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ENG-07        │  │ENG-08        │  │ENG-09                    │  │
│  │Workflows     │  │Automação     │  │Melhoria Contínua         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│                     ┌──────────────────────────┐                   │
│                     │ENG-10                    │                   │
│                     │IA e Base de Conhecimento │                   │
│                     └──────────────────────────┘                   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                       CAMADA DE DADOS                               │
│         CRM · ERP · Data Warehouse · Repositório de Docs           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## As 10 Engines

| ID | Engine | Função Central |
|----|--------|---------------|
| ENG-01 | Engine de Execução de Processos | Orquestra a execução de qualquer processo definido nos módulos |
| ENG-02 | Engine de KPIs | Coleta, calcula, armazena e publica métricas de qualquer módulo |
| ENG-03 | Engine de Alertas | Detecta violações de limiares e dispara notificações |
| ENG-04 | Engine de Diagnóstico | Analisa causas raiz quando um desvio é detectado |
| ENG-05 | Engine de Planos de Ação | Gera, rastreia e encerra planos de ação corretivos |
| ENG-06 | Engine de Auditoria | Verifica conformidade operacional de todos os módulos |
| ENG-07 | Engine de Workflows | Executa sequências de tarefas automatizadas entre módulos |
| ENG-08 | Engine de Automação | Integra ferramentas externas e elimina trabalho manual repetitivo |
| ENG-09 | Engine de Melhoria Contínua | Executa ciclos PDCA e registra aprendizados organizacionais |
| ENG-10 | Engine de IA e Base de Conhecimento | Fornece inteligência artificial e memória institucional ao SOE |

---

## Contrato de Integração (Interface Padrão Módulo → Engine)

Todo Módulo Operacional interage com a Engine de Autogestão através de um **contrato de registro** padronizado. Para consumir qualquer serviço da Engine, o módulo DEVE registrar:

```yaml
# Exemplo: registro de KPI de um módulo
kpi_registration:
  id: "KPI-IC-01"
  modulo: "CAP-01"
  nome: "Cobertura de Win/Loss Analysis"
  formula: "oportunidades_com_analise / total_fechadas * 100"
  unidade: "%"
  meta: 95
  direcao: "maximizar"  # maximizar | minimizar | manter_intervalo
  frequencia: "mensal"
  fonte_de_dados: "CRM.oportunidades"
  dono: "Gerente Comercial"
  alertas:
    - limiar: 80
      severidade: "warning"
    - limiar: 70
      severidade: "critical"
```

A Engine recebe esse registro e automaticamente:
- Inclui o KPI no ciclo de coleta (ENG-02)
- Configura os alertas correspondentes (ENG-03)
- Disponibiliza o KPI para diagnóstico (ENG-04)
- Inclui o KPI nas auditorias do módulo (ENG-06)
- Alimenta o modelo de IA com o histórico (ENG-10)

---

## Modelo de Eventos do SOE

A Engine de Autogestão opera fundamentalmente através de **eventos**. Todo evento possui:

```yaml
evento:
  id: "EVT-[tipo]-[sequencial]"
  tipo: "kpi_desvio | alerta_disparado | plano_criado | auditoria_concluida | ..."
  timestamp: "ISO 8601"
  origem_modulo: "CAP-XX"
  origem_engine: "ENG-XX"
  payload: {}
  correlacao_id: "ID do evento que causou este (rastreabilidade)"
  severidade: "info | warning | critical | bloqueante"
```

Eventos fluem através das Engines e geram reações em cadeia:

```
KPI calculado (ENG-02)
    → KPI abaixo do limiar? → Alerta disparado (ENG-03)
        → Alerta crítico? → Diagnóstico iniciado (ENG-04)
            → Causa raiz identificada? → Plano de Ação criado (ENG-05)
                → Plano executado → Auditoria de eficácia (ENG-06)
                    → Desvio recorrente? → Ciclo PDCA (ENG-09)
                        → Padrão aprendido → Base de Conhecimento (ENG-10)
```

---

## Ciclo Operacional da Engine (Ritmo Sistêmico)

```
TEMPO REAL:   ENG-03 monitora eventos e limites críticos
DIÁRIO:       ENG-02 coleta dados de CRM/sistemas e atualiza dashboard
SEMANAL:      ENG-02 consolida KPIs semanais; ENG-03 revisa alertas abertos
MENSAL:       ENG-02 fecha o mês; ENG-06 executa auditoria mensal;
              ENG-05 revisa planos de ação abertos; ENG-09 registra aprendizados
TRIMESTRAL:   ENG-06 auditoria estratégica; ENG-09 retrospectiva;
              ENG-10 atualiza base de conhecimento
ANUAL:        ENG-09 revisão completa de melhoria contínua;
              ENG-10 atualiza modelos de IA
```

---

## Documentos Detalhados (por Engine)

| Documento | Engine |
|-----------|--------|
| `ENG-01-execucao-de-processos.md` | Engine de Execução de Processos |
| `ENG-02-engine-de-kpis.md` | Engine de KPIs |
| `ENG-03-engine-de-alertas.md` | Engine de Alertas |
| `ENG-04-engine-de-diagnostico.md` | Engine de Diagnóstico |
| `ENG-05-engine-de-planos-de-acao.md` | Engine de Planos de Ação |
| `ENG-06-engine-de-auditoria.md` | Engine de Auditoria |
| `ENG-07-engine-de-workflows.md` | Engine de Workflows |
| `ENG-08-engine-de-automacao.md` | Engine de Automação |
| `ENG-09-melhoria-continua.md` | Engine de Melhoria Contínua |
| `ENG-10-ia-e-base-de-conhecimento.md` | Engine de IA e Base de Conhecimento |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da arquitetura da Engine de Autogestão |
