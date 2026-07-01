---
id: ARCH-001
titulo: "System Architecture — Commercial Operating System"
versao: "1.0.0"
status: aprovado
categoria: ARC
autor: Guardião da Documentação Técnica
criado-em: 2026-07-01
atualizado-em: 2026-07-01
congelado-em: 2026-07-01
freeze: "Architecture Freeze v1.0"
nivel-decisao-alteracao: D4
tags:
  [
    arquitetura,
    visao-geral,
    c4,
    camadas,
    commercial-os,
    freeze,
    diagrama,
    sistema,
  ]
---

# ARCH-001 — System Architecture
## Commercial Operating System (Commercial OS)

> **Architecture Freeze v1.0 — 2026-07-01**
> Este documento e a arquitetura que ele descreve estão congelados.
> Nenhuma adição estrutural (novo CAP, nova Engine, nova camada) pode ser feita sem RFC ARCHITECTURAL aprovado em nível D4. O objetivo do freeze é direcionar toda a energia da equipe para implementação e validação em produção.

---

## 1. Visão em 90 Segundos

O Commercial OS é uma plataforma de autogestão empresarial composta por **cinco camadas** com responsabilidades distintas e não sobrepostas:

| Camada | O que é | Quem a compõe |
|--------|---------|---------------|
| **Business Layer** | Os domínios de negócio — o que a empresa faz | CAP-01 a CAP-09 |
| **Execution Layer** | O runtime — como o sistema pensa e age | FOB, Scheduler, ENG-11, ENG-12 |
| **Core Layer** | Os serviços fundamentais — mecanismos que tudo usa | ENG-01 a ENG-10 |
| **Integration Layer** | O contrato de comunicação — como tudo se fala | CUE, RS, Contracts |
| **Governance Layer** | A saúde do sistema — quem governa o sistema | Health Check, Grafo, RFC, Audit |

Cada módulo de negócio (CAP) opera dentro da Business Layer. Ele nunca implementa mecanismos de infraestrutura — usa os da Core Layer. Ele nunca decide como priorizar — usa a Execution Layer. Ele nunca publica eventos sem contrato — usa a Integration Layer.

---

## 2. Diagrama de Arquitetura — Visão de Camadas

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BUSINESS LAYER  —  Os domínios de negócio do Commercial OS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│  CAP-01  │ │  CAP-02  │ │  CAP-03  │ │  CAP-04  │ │    CAP-05    │
│Intelig.  │ │Gestão de │ │Processo  │ │Gestão de │ │  Gestão de   │
│Comercial │ │Demanda   │ │de Vendas │ │Receita   │ │  Clientes    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  CAP-06  │ │  CAP-07  │ │  CAP-08  │ │  CAP-09  │
│ [future] │ │Equipe    │ │Performan.│ │Canais e  │
│          │ │Comercial │ │e Autogest│ │Parcerias │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

  Cada CAP: domínio independente, eventos declarados, processos registrados,
  KPIs próprios, zero lógica de infraestrutura.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EXECUTION LAYER  —  O runtime operacional e cognitivo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────────────┐ ┌──────────┐ ┌─────────────────────────┐
│   FOB — Framework       │ │Scheduler │ │   ENG-11 — Decision     │
│   Operacional Básico    │ │          │ │   Engine                │
│                         │ │Ciclo     │ │                         │
│ FOB-01 Ciclo Operacional│ │diário    │ │ Hierarquia D0-D4        │
│ FOB-02 Desvios/Decisões │ │semanal   │ │ MUP Dinâmica            │
│ FOB-03 KPIs             │ │mensal    │ │ Motor de Diagnóstico    │
│ FOB-04 Alertas          │ │trimestral│ │ Motor de Correção       │
│ FOB-05 Planos de Ação   │ │anual     │ │ Motor de Escalonamento  │
│ FOB-06 Auditoria        │ │          │ │ Motor de Aprendizado    │
│ FOB-07 Rituais          │ │Emite:    │ │ BUD — Taxonomia         │
│ FOB-08 RACI-T           │ │sistema.  │ │ CUA — Catálogo Ações    │
│ FOB-09 Documentação     │ │periodo_  │ │ Fluxo Cognitivo 12 pass.│
│ FOB-10 Melhoria Contínua│ │encerrado │ │                         │
└─────────────────────────┘ └──────────┘ └─────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│   ENG-12 — System Governance Engine                                 │
│                                                                     │
│  Registro Sistêmico (RS)  │  Motor de RFC  │  MUP Dinâmica Config  │
│  Grafo de Dependências    │  Depreciação   │  Parâmetros Dinâmicos │
│  Health Check (ISA ≥ 97%) │  Migrações     │  Catálogo Sistêmico   │
└─────────────────────────────────────────────────────────────────────┘

  O Scheduler é o único produtor de eventos baseados em tempo.
  O FOB define como qualquer módulo opera (templates obrigatórios).
  A ENG-11 decide O QUÊ fazer. A ENG-12 governa O SISTEMA MESMO.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CORE LAYER  —  Os serviços de infraestrutura compartilhados
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│  ENG-01  │ │  ENG-02  │ │  ENG-03  │ │  ENG-04  │ │    ENG-05    │
│Execução  │ │Engine de │ │Engine de │ │Engine de │ │ Engine de    │
│de        │ │KPIs      │ │Alertas   │ │Diagnós-  │ │ Planos de    │
│Processos │ │          │ │          │ │tico      │ │ Ação         │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│  ENG-06  │ │  ENG-07  │ │  ENG-08  │ │  ENG-09  │ │    ENG-10    │
│Engine de │ │Engine de │ │Engine de │ │Melhoria  │ │ IA e Base de │
│Auditoria │ │Workflows │ │Automação │ │Contínua  │ │ Conhecimento │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘

  Cada Engine: serviço sistêmico único, responsabilidade não sobreponível,
  utilizado por ≥ 3 módulos CAP, agnóstico ao domínio de negócio.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  INTEGRATION LAYER  —  O contrato de comunicação do sistema
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────────────────────────────────────────────────────────┐
│   BARRAMENTO DE EVENTOS SOE (at-least-once delivery)                │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  CUE — Catálogo Universal de Eventos (74+ eventos)         │    │
│  │  Convenção: [dominio].[entidade].[acao_passado]            │    │
│  │  Domínios: lead│oportunidade│receita│cliente│mercado│      │    │
│  │            demanda│performance│parceiro│colaborador│       │    │
│  │            processo│decisao│sistema                        │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────────┐
│ ENGINE-CONTRATO │ │  Conectores     │ │  Parâmetros Sistêmicos      │
│ DE-INTEGRACAO   │ │  (CONN)         │ │  (Constantes do sistema)    │
│                 │ │                 │ │                             │
│ Deduplicação    │ │ CONN-CRM        │ │ JANELA_CLAWBACK_DIAS: 90    │
│ Forward compat. │ │ CONN-ERP        │ │ ICP_SCORE_MQL: 7            │
│ Timeout policy  │ │ CONN-MKTG-AUTO  │ │ HEALTH_SCORE_LIMIARES: 70/40│
│ Schema policy   │ │ CONN-PLATAFORMA │ │ + 9 constantes adicionais   │
└─────────────────┘ └─────────────────┘ └─────────────────────────────┘

  Nenhum módulo se comunica diretamente com outro módulo.
  Toda comunicação é via barramento. O CUE é o contrato único.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GOVERNANCE LAYER  —  A saúde e evolução do sistema
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────┐
│ Health Check │ │  Dependency  │ │  RFC Engine  │ │ Audit Log     │
│ Arquitetural │ │  Graph       │ │              │ │ (ENG-06)      │
│              │ │              │ │ PATCH: D1    │ │               │
│ ISA ≥ 97%    │ │ Calculado    │ │ MINOR: D2    │ │ Imutável      │
│ 7 blocos     │ │ em tempo     │ │ MAJOR: D3    │ │ Toda decisão  │
│ 24 itens     │ │ real do RS   │ │ BREAKING: D3 │ │ registrada    │
│              │ │              │ │ ARCH.: D4    │ │               │
│ Semanal +    │ │ 7 tipos de   │ │              │ │               │
│ incremental  │ │ dependência  │ │ SLA: 48h     │ │               │
│ + sob demanda│ │ + alertas    │ │ (MINOR)      │ │               │
└──────────────┘ └──────────────┘ └──────────────┘ └───────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│  POL-ENGINE-001 — Critérios para criação de novas Engines           │
│  3 critérios obrigatórios + 1 critério de exclusão + aprovação D4  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Diagrama de Fluxo — Como o Sistema Pensa

```
EVENTO EXTERNO / GATILHO
(usuário, integração, scheduler, módulo CAP)
         │
         ▼
┌─────────────────────┐
│  BARRAMENTO SOE     │  ← CUE valida tipo do evento
│  (at-least-once)    │  ← Deduplicação por event_id
└──────────┬──────────┘
           │
    ┌──────┴──────────────────────────────────┐
    │                                         │
    ▼                                         ▼
┌─────────┐                          ┌─────────────────┐
│ ENG-07  │                          │    ENG-11       │
│Workflows│                          │ Decision Engine │
│         │                          │                 │
│Sequência│                          │ 1. Detectar     │
│automati-│                          │ 2. Classificar  │
│zada de  │                          │ 3. Priorizar    │
│ações    │                          │    (MUP)        │
└────┬────┘                          │ 4. Diagnosticar │
     │                               │ 5. Corrigir     │
     │                               │ 6. Planejar     │
     │                               │ 7. Executar     │
     │                               │ 8. Monitorar    │
     │                               │ 9. Auditar      │
     │                               │10. Aprender     │
     │                               │11. Atualizar    │
     │                               │12. Encerrar     │
     │                               └────────┬────────┘
     │                                        │
     └───────────────────┬────────────────────┘
                         │ orquestração
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    CORE LAYER                           │
│                                                         │
│  ENG-01     ENG-03     ENG-05     ENG-06     ENG-09    │
│  Processos  Alertas    Planos     Auditoria  Melhoria  │
│                                                         │
│  ENG-02     ENG-04     ENG-07     ENG-08     ENG-10    │
│  KPIs       Diagnóst.  Workflows  Automação  IA/Base   │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   MÓDULOS CAP                           │
│                                                         │
│  Estado atualizado, responsáveis notificados,           │
│  processos avançados, planos em execução                │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              ENG-12 — GOVERNANÇA SISTÊMICA              │
│                                                         │
│  RS atualizado → Grafo recalculado → ISA verificado     │
│  Toda mudança versionada, rastreada, auditada           │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Mapa de Responsabilidades por Componente

### 4.1 O que cada CAP faz (e o que NÃO faz)

| CAP | Domínio | Publica | Consome | NÃO faz |
|-----|---------|---------|---------|---------|
| CAP-01 | Inteligência Comercial | `mercado.*` | `cliente.cancelamento.*`, `oportunidade.*` | Não executa processos de vendas |
| CAP-02 | Gestão de Demanda | `lead.*`, `demanda.*` | `mercado.icp_revisado`, `performance.metas_*` | Não qualifica oportunidades |
| CAP-03 | Processo de Vendas | `oportunidade.*` | `demanda.sql.criado`, `performance.metas_*` | Não gerencia receita nem clientes |
| CAP-04 | Gestão de Receita | `receita.*` | `oportunidade.ganha`, `cliente.cancelamento.*` | Não gerencia relacionamento com cliente |
| CAP-05 | Gestão de Clientes | `cliente.*` | `oportunidade.ganha`, `receita.*` | Não calcula MRR nem NRR (referencia CAP-04) |
| CAP-07 | Equipe Comercial | `colaborador.*` | `performance.metas_*` | Não define metas (referencia CAP-08) |
| CAP-08 | Performance e Autogestão | `performance.*` | Dados de todos os CAPs | Não executa ações operacionais |
| CAP-09 | Canais e Parcerias | `parceiro.*`, `ecossistema.*` | `oportunidade.ganha`, `cliente.cancelamento.*` | Não gerencia receita de parceiros (via ENG-08→ERP) |

### 4.2 O que cada Engine faz (responsabilidade única)

| Engine | Responsabilidade Única | Não Faz |
|--------|----------------------|---------|
| ENG-01 | Rastrear estado de processos e instâncias | Não decide o que fazer com o processo |
| ENG-02 | Medir KPIs, detectar limiares cruzados | Não alerta nem diagnostica |
| ENG-03 | Classificar e emitir alertas, gerenciar SLAs de alerta | Não diagnostica nem planeja correção |
| ENG-04 | Estruturar investigação de causa raiz | Não escolhe ações nem cria planos |
| ENG-05 | Criar, rastrear e encerrar planos de ação | Não executa as ações (delega para ENG-07/08) |
| ENG-06 | Registrar auditoria imutável de tudo | Não age — apenas registra |
| ENG-07 | Orquestrar sequências automáticas de ações | Não decide *se* acionar — apenas executa quando acionado |
| ENG-08 | Integrar com sistemas externos (CRM, ERP, APIs) | Não tem lógica de negócio — apenas adapta e chama |
| ENG-09 | Gerenciar backlog de melhoria contínua | Não implementa melhorias — registra e prioriza |
| ENG-10 | Manter base de conhecimento e sugerir com IA | Não decide — sugere; responsável humano decide |
| ENG-11 | Orquestrar o fluxo cognitivo de decisão | Não executa ações — decide e delega para outras engines |
| ENG-12 | Governar a arquitetura do sistema | Não governa operações de negócio — governa o sistema |

---

## 5. Regras Arquiteturais Fundamentais

As regras abaixo são imutáveis enquanto o Architecture Freeze v1.0 estiver ativo. Alteração requer RFC ARCHITECTURAL + D4.

**AR-01 — Isolamento de Domínio:** Nenhum módulo CAP acessa dados de outro módulo CAP diretamente. Toda comunicação é via barramento de eventos (CUE).

**AR-02 — Engines Agnósticas:** Engines não contêm lógica de domínio de negócio. Elas proveem mecanismos que qualquer domínio pode usar.

**AR-03 — CUE como Contrato Único:** Todo evento publicado no barramento deve estar no CUE. Publicar evento não listado é inconsistência arquitetural.

**AR-04 — At-least-once com Deduplicação:** O barramento garante at-least-once delivery. Todo consumidor implementa deduplicação por `event_id`. Consumidores nunca assumem exactly-once.

**AR-05 — Forward Compatibility:** Todo publicador de evento adiciona apenas campos opcionais em mudanças MINOR. Consumidores ignoram campos desconhecidos. Campos removidos passam pelo protocolo de depreciação (mínimo 90 dias para eventos).

**AR-06 — Imutabilidade do Histórico:** Registros de transição de processo (ENG-01), log de auditoria (ENG-06), diagnósticos (ENG-04), decisões (ENG-11) e versões de artefatos (ENG-12) são append-only e imutáveis. Correções são novos registros que referenciam o original.

**AR-07 — Responsável Sempre Definido:** Toda instância de processo em execução deve ter um responsável humano designado. Instância sem responsável é sinalizada imediatamente para ENG-03.

**AR-08 — Versionamento SemVer:** Todos os artefatos do sistema (módulos, engines, catálogos, contratos, eventos) seguem SemVer. Mudanças MAJOR requerem RFC. O RS é a fonte autoritativa das versões vigentes.

**AR-09 — ENG-12 não é Opcional:** Nenhuma mudança estrutural pode ser aplicada sem registro e aprovação via ENG-12. O Registro Sistêmico é a única fonte de verdade sobre o que existe no sistema.

**AR-10 — POL-ENGINE-001 como Barreira de Entrada:** Nenhuma nova Engine pode ser criada sem satisfazer os três critérios obrigatórios e o critério de exclusão definidos na POL-ENGINE-001. A aprovação é sempre D4.

---

## 6. Inventário Arquitetural — Estado no Architecture Freeze v1.0

### 6.1 Módulos CAP

| ID | Nome | Versão | Status | Doc |
|----|------|--------|--------|-----|
| CAP-01 | Inteligência Comercial | 2.0.0 | ATIVO | `docs/05-modules/commercial/cap-01-*/` |
| CAP-02 | Gestão de Demanda | 2.0.0 | ATIVO | `docs/05-modules/commercial/cap-02-*/` |
| CAP-03 | Gestão do Processo de Vendas | 2.1.0 | ATIVO | `docs/05-modules/commercial/cap-03-*/` |
| CAP-04 | Gestão de Receita | 2.0.0 | ATIVO | `docs/05-modules/commercial/cap-04-*/` |
| CAP-05 | Gestão de Clientes | 2.0.0 | ATIVO | `docs/05-modules/commercial/cap-05-*/` |
| CAP-06 | [Reservado] | — | PLANEJADO | — |
| CAP-07 | Gestão da Equipe Comercial | 2.0.0 | ATIVO | `docs/05-modules/commercial/cap-07-*/` |
| CAP-08 | Performance e Autogestão | 2.0.0 | ATIVO | `docs/05-modules/commercial/cap-08-*/` |
| CAP-09 | Gestão de Canais e Parcerias | 2.0.0 | ATIVO | `docs/05-modules/commercial/cap-09-*/` |

### 6.2 Engines

| ID | Nome | Versão | Categoria | Doc |
|----|------|--------|-----------|-----|
| ENG-01 | Engine de Execução de Processos | 1.0.0 | C3-Operacional | `docs/02-architecture/engine-autogestao/ENG-01-*` |
| ENG-02 | Engine de KPIs | 1.0.0 | C2-Estratégica | `docs/02-architecture/engine-autogestao/ENG-02-*` |
| ENG-03 | Engine de Alertas | 1.0.0 | C3-Operacional | `docs/02-architecture/engine-autogestao/ENG-03-*` |
| ENG-04 | Engine de Diagnóstico | 1.0.0 | C2-Estratégica | `docs/02-architecture/engine-autogestao/ENG-04-*` |
| ENG-05 | Engine de Planos de Ação | 1.0.0 | C3-Operacional | `docs/02-architecture/engine-autogestao/ENG-05-*` |
| ENG-06 | Engine de Auditoria | 1.0.0 | C2-Estratégica | `docs/02-architecture/engine-autogestao/ENG-06-*` |
| ENG-07 | Engine de Workflows | 1.0.0 | C3-Operacional | `docs/02-architecture/engine-autogestao/ENG-07-*` |
| ENG-08 | Engine de Automação | 1.0.0 | C3-Operacional | `docs/02-architecture/engine-autogestao/ENG-08-*` |
| ENG-09 | Engine de Melhoria Contínua | 1.0.0 | C2-Estratégica | `docs/02-architecture/engine-autogestao/ENG-09-*` |
| ENG-10 | IA e Base de Conhecimento | 1.0.0 | C2-Estratégica | `docs/02-architecture/engine-autogestao/ENG-10-*` |
| ENG-11 | Decision Engine | 1.0.0 | C1-Fundacional | `docs/02-architecture/engine-autogestao/ENG-11-*` |
| ENG-12 | System Governance Engine | 1.0.0 | C0-Meta | `docs/02-architecture/engine-autogestao/ENG-12-*` |

### 6.3 Framework e Infraestrutura

| Componente | ID | Versão | Doc |
|------------|-----|--------|-----|
| Framework Operacional Universal | ARC-FOB-001 | 1.0.0 | `docs/02-architecture/framework-operacional/` |
| Contrato de Integração das Engines | ENGINE-CONTRATO | 1.1.0 | `docs/02-architecture/engine-autogestao/ENGINE-CONTRATO-*` |
| Scheduler de Sistema | SOE-SYS-SCHEDULER | 1.0.0 | Seção 8 do ENGINE-CONTRATO |
| Catálogo Universal de Eventos (CUE) | ARC-ENG-011 §13 | 1.0.0 | `ENG-11-decision-engine.md` §13 |
| Catálogo Universal de Ações (CUA) | ARC-ENG-011 §12 | 1.0.0 | `ENG-11-decision-engine.md` §12 |
| Biblioteca Universal de Decisões (BUD) | ARC-ENG-011 §10 | 1.0.0 | `ENG-11-decision-engine.md` §10 |
| Registro Sistêmico (RS) | ARC-ENG-012 §4 | 1.0.0 | `ENG-12-system-governance-engine.md` §4 |

### 6.4 Políticas Ativas

| ID | Nome | Versão | Nível p/ Alterar |
|----|------|--------|-----------------|
| POL-ENGINE-001 | Critérios para Criação de Novas Engines | 1.0.0 | D4 |

---

## 7. Architecture Freeze v1.0

### 7.1 Declaração

A partir de **2026-07-01**, o Commercial OS entra em **Architecture Freeze v1.0**.

O freeze significa que:

```
O que está CONGELADO (requer RFC ARCHITECTURAL + D4):
  ✗ Criação de novo módulo CAP
  ✗ Criação de nova Engine
  ✗ Criação de nova camada arquitetural
  ✗ Alteração de regras arquiteturais fundamentais (AR-01 a AR-10)
  ✗ Alteração de políticas de governança (POL-ENGINE-001)
  ✗ Remoção de componente existente sem protocolo de depreciação

O que NÃO está congelado (pode evoluir via RFC normal):
  ✓ Conteúdo interno de módulos CAP (novos KPIs, processos, workflows)
  ✓ Adição de eventos ao CUE (RFC MINOR)
  ✓ Adição de ações ao CUA (RFC MINOR)
  ✓ Atualização de parâmetros dinâmicos (nível de decisão conforme parâmetro)
  ✓ Implementação de qualquer componente em código
  ✓ Correções de documentação (PATCH — sem RFC)
  ✓ Adição de entradas na BUD (RFC MINOR)
```

### 7.2 Fundamento do Freeze

A arquitetura do Commercial OS atingiu um ponto de maturidade em que a principal limitação deixou de ser o design e passou a ser a validação em produção.

Cada CAP implementado em código revelará ajustes necessários — mas esses ajustes serão de conteúdo (quais KPIs medir, quais workflows criar, quais eventos publicar), não de estrutura (como os módulos se comunicam, quem governa o quê, como as engines interagem).

Se a arquitetura suportar a implementação dos nove CAPs com poucas mudanças estruturais, isso confirmará que a base é sólida. Se mudanças estruturais forem necessárias, elas emergirão de evidências reais — não de especulação antecipada — e serão tratadas via RFC com dados concretos.

### 7.3 Critério de Revisão do Freeze

O freeze é reavaliado:
- Após implementação de **3 ou mais módulos CAP** em produção
- Se um RFC ARCHITECTURAL for aprovado em D4 durante o período
- Em cada ciclo anual de planejamento estratégico

O freeze não tem data de expiração — expira quando a evidência operacional justificar uma nova versão de arquitetura.

---

## 8. Como Ler a Arquitetura (Guia para Novos Membros)

1. **Comece aqui (ARCH-001)** — entenda as 5 camadas e onde cada componente vive (5 minutos)
2. **Leia o Contrato de Integração** — entenda como os componentes se comunicam (10 minutos)
3. **Leia o FOB** — entenda como qualquer módulo opera dentro do sistema (20 minutos)
4. **Leia o módulo do seu domínio** — entenda o CAP que você vai implementar (30 minutos)
5. **Leia as engines que seu CAP usa** — entenda os serviços que você vai consumir (variável)

Em nenhum momento você precisa ler toda a documentação antes de começar. A arquitetura foi desenhada para que cada componente possa ser entendido isoladamente, com referências claras para onde buscar mais contexto quando necessário.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-07-01 | Guardião da Documentação Técnica | Criação — Architecture Freeze v1.0 |
