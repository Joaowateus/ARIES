---
id: ARC-ENG-012
titulo: "ENG-12 — System Governance Engine (Governança do Sistema)"
versao: "1.0.0"
status: aprovado
categoria: C0-Meta
autor: Guardião da Documentação Técnica
criado-em: 2026-07-01
atualizado-em: 2026-07-01
dependencias:
  - ARC-ENG-000
  - ARC-ENG-011
  - ARC-FOB-001
tags:
  [
    engine,
    governanca,
    versionamento,
    compatibilidade,
    rfc,
    dependencias,
    migracao,
    depreciacao,
    integridade,
    catalogo-sistemico,
    health-check,
    meta,
  ]
---

# ENG-12 — System Governance Engine (Governança do Sistema)

---

## 1. Objetivo

Ser a **camada de governança do próprio Commercial OS** — o sistema que governa todos os outros sistemas. Enquanto as engines ENG-01 a ENG-11 governam as operações do negócio, a ENG-12 governa a integridade, evolução, compatibilidade e rastreabilidade da **arquitetura em si**.

A ENG-12 responde às perguntas que nenhuma outra engine responde:
- *Quem controla as versões dos módulos, engines e contratos?*
- *Como uma mudança em ENG-01 é validada antes de afetar CAP-03?*
- *Onde está o inventário completo e atualizado de tudo que compõe o sistema?*
- *Quem aprova que um componente pode ser depreciado?*
- *Como um módulo novo é incorporado sem quebrar os existentes?*
- *O sistema está arquiteturalmente saudável hoje?*

Sem a ENG-12, o Commercial OS cresce por acréscimo. Com ela, o Commercial OS evolui com governança.

---

## 2. Categoria C0-Meta

A ENG-12 opera em uma categoria diferente de todas as engines anteriores:

| Categoria | Engines | Governa |
|-----------|---------|---------|
| C3-Operacional | ENG-01, ENG-03, ENG-05, ENG-07, ENG-08 | Processos, alertas, planos, workflows, automação |
| C2-Estratégica | ENG-02, ENG-04, ENG-06, ENG-09, ENG-10 | KPIs, diagnóstico, auditoria, melhoria, conhecimento |
| C1-Fundacional | ENG-11 | Decisão e cognição |
| **C0-Meta** | **ENG-12** | **O próprio sistema** |

Engines C0 não são instanciadas por eventos de negócio. São instanciadas por:
- Criação, modificação ou remoção de qualquer artefato do sistema
- Submissão de RFC
- Ciclo de auditoria arquitetural (agendado)
- Detecção de inconsistência entre artefatos

---

## 3. Responsabilidades

- **Manter** o Registro Sistêmico (RS) — inventário completo e vivo de todos os artefatos do Commercial OS
- **Gerenciar** o ciclo completo de RFC (Request for Change) — proposta, análise de impacto, aprovação, implementação, validação
- **Controlar** versões de todos os artefatos com SemVer e rastreabilidade de dependências
- **Verificar** compatibilidade retroativa antes de qualquer mudança ser aprovada
- **Calcular** e manter o Grafo de Dependências em tempo real
- **Executar** Health Checks arquiteturais periódicos e sob demanda
- **Gerenciar** o protocolo de depreciação de componentes (aviso → migração → remoção)
- **Coordenar** migrações sistêmicas quando mudanças breaking afetam múltiplos componentes
- **Manter** os parâmetros sistêmicos dinâmicos (incluindo pesos da MUP)
- **Emitir** alertas arquiteturais quando inconsistências são detectadas
- **Bloquear** mudanças que violam regras de compatibilidade ou dependência

---

## 4. Sistema 1 — Registro Sistêmico (RS)

### 4.1 Definição

O RS é o **inventário oficial e autoritativo** de todos os artefatos que compõem o Commercial OS. É a única fonte de verdade para: o que existe, em qual versão, com quais dependências, com qual status e com qual contrato de interface.

### 4.2 Tipos de Artefatos Registrados

```
┌────────────────────────────────────────────────────────────────┐
│  TIPO 1 — MÓDULOS (CAP)                                        │
│  CAP-01 a CAP-09; cada módulo tem: versão, status, eventos     │
│  publicados, eventos consumidos, KPIs declarados, engines      │
│  utilizadas, processos registrados, responsável arquitetural   │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  TIPO 2 — ENGINES (ENG)                                        │
│  ENG-01 a ENG-12; cada engine tem: versão, categoria, APIs     │
│  expostas, eventos publicados, eventos consumidos, tabelas     │
│  de dados, dependências de outras engines                      │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  TIPO 3 — CONTRATOS DE INTEGRAÇÃO                              │
│  ENGINE-CONTRATO-DE-INTEGRACAO; cada contrato tem: versão,     │
│  constantes sistêmicas, políticas de timeout, conectores,      │
│  definição do Scheduler, convenções de nomenclatura            │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  TIPO 4 — CATÁLOGOS                                            │
│  CUE (Eventos), CUA (Ações), BUD (Decisões), FOB (Framework)   │
│  cada catálogo tem: versão, entradas ativas, entradas          │
│  depreciadas, data de última atualização, dono                 │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  TIPO 5 — PROCESSOS (PROC)                                     │
│  Blueprints registrados na ENG-01; cada processo tem: módulo   │
│  dono, versão do blueprint, gatilho, etapas, SLAs, instâncias  │
│  ativas no momento, blueprint histórico                        │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  TIPO 6 — CONECTORES (CONN)                                    │
│  Integrações com sistemas externos (CRM, ERP, plataformas);    │
│  cada conector tem: sistema alvo, direção, protocolo,          │
│  SLA contratual, status de saúde, última verificação           │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  TIPO 7 — POLÍTICAS (POL)                                      │
│  Regras sistêmicas que cross-cut todos os módulos (ex:         │
│  JANELA_CLAWBACK_DIAS, convenção de nomenclatura de eventos,   │
│  política de deduplicação, forward compatibility)              │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│  TIPO 8 — PARÂMETROS DINÂMICOS (PARAM)                         │
│  Valores configuráveis que afetam o comportamento do sistema   │
│  (ex: pesos da MUP, limiares de SLA, thresholds de alerta);    │
│  cada parâmetro tem: valor atual, histórico de alterações,     │
│  quem pode alterar (nível de decisão), efeito sistêmico        │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Estrutura de um Artefato no RS

```yaml
rs_artefato:
  id: "CAP-03"
  tipo: "MODULO"
  nome: "Gestão do Processo de Vendas"
  versao_atual: "2.1.0"
  status: "ATIVO"                  # ATIVO | DEPRECIADO | MIGRANDO | RASCUNHO | ARQUIVADO
  categoria: "commercial"
  responsavel_arquitetural: "[ID do responsável técnico pelo módulo]"
  documento_referencia: "docs/05-modules/commercial/cap-03-gestao-processo-vendas/MOD-CAP-03.md"
  interfaces:
    eventos_publicados:
      - tipo: "oportunidade.criada"
        versao_schema: "1.0.0"
        consumidores: ["ENG-01", "ENG-07"]
      - tipo: "oportunidade.ganha"
        versao_schema: "2.0.0"
        consumidores: ["CAP-04", "CAP-05", "ENG-01", "ENG-07", "ENG-11"]
    eventos_consumidos:
      - tipo: "demanda.sql.criado"
        versao_schema: "1.0.0"
        publicador: "CAP-02"
      - tipo: "performance.metas_atualizadas"
        versao_schema: "1.0.0"
        publicador: "CAP-08"
  dependencias:
    engines: ["ENG-01", "ENG-02", "ENG-03", "ENG-05", "ENG-07"]
    modulos: ["CAP-02", "CAP-04", "CAP-05", "CAP-08"]
    contratos: ["ENGINE-CONTRATO-DE-INTEGRACAO"]
    conectores: []
  processos_registrados: ["PROC-CAP03-VENDAS", "PROC-CAP035-CONTRATOS"]
  kpis_declarados: ["KPI-PV-01", "KPI-PV-02", "KPI-PV-03", "KPI-PV-04", "KPI-PV-05"]
  historico_versoes:
    - versao: "1.0.0"
      data: "2026-06-10"
      tipo_mudanca: "MAJOR"
      rfc_id: "RFC-001"
    - versao: "2.0.0"
      data: "2026-06-28"
      tipo_mudanca: "MAJOR"
      rfc_id: "RFC-007"
    - versao: "2.1.0"
      data: "2026-06-30"
      tipo_mudanca: "MINOR"
      rfc_id: "RFC-012"
  health_check_ultimo: "2026-07-01T06:00:00Z"
  health_check_status: "SAUDAVEL"
  criado_em: "2026-06-10"
  atualizado_em: "2026-06-30"
```

### 4.4 Catálogo Sistêmico — Visão Consolidada

O RS mantém automaticamente contadores e listas para:

```yaml
catalogo_sistemico_snapshot:
  gerado_em: "2026-07-01T06:00:00Z"
  modulos:
    total: 9
    ativos: 9
    em_migracao: 0
    depreciados: 0
  engines:
    total: 12
    ativas: 12
    em_migracao: 0
  eventos_registrados_no_cue:
    total: 74
    por_dominio:
      lead: 5
      oportunidade: 6
      receita: 8
      cliente: 8
      mercado: 5
      demanda: 4
      performance: 4
      parceiro: 12
      colaborador: 6
      processo: 7
      decisao: 8
      sistema: 3
    versoes_de_schema_ativas: 18
  acoes_no_cua:
    total: 57
    por_dominio:
      pessoas: 9
      processo: 8
      demanda: 7
      qualidade: 5
      financeiro: 7
      cliente: 6
      estrategico: 6
      governanca: 8
    taxa_eficacia_media: 0.72
  processos_blueprints:
    total: 11
    instancias_ativas_agora: "[calculado dinamicamente]"
  conectores_ativos: 4
  politicas_ativas: 12
  parametros_dinamicos: 8
  rfcs:
    abertos: 0
    aprovados_aguardando_implementacao: 1
    implementados: 12
    rejeitados: 2
```

---

## 5. Sistema 2 — Motor de RFC (Request for Change)

### 5.1 Definição

O Motor de RFC é o processo formal pelo qual **qualquer mudança no Commercial OS é proposta, avaliada, aprovada, implementada e validada**. Nenhuma mudança que afete a arquitetura, os contratos de interface ou os catálogos pode ser aplicada fora do processo de RFC.

### 5.2 Classificação de Mudanças

| Tipo | Definição | RFC Obrigatório | Aprovação Mínima |
|------|-----------|-----------------|-----------------|
| **PATCH** | Correção que não altera interfaces nem comportamento observável | Não — registro simples | D1 |
| **MINOR** | Adição retrocompatível (novo campo opcional, novo evento, nova ação no CUA) | Sim — RFC simplificado | D2 |
| **MAJOR** | Mudança que quebra compatibilidade retroativa (campo removido, evento renomeado, semântica alterada) | Sim — RFC completo | D3 |
| **BREAKING** | Mudança que requer migração de múltiplos consumidores simultaneamente | Sim — RFC completo + plano de migração + janela de depreciação | D3 + D4 se > 3 módulos afetados |
| **ARCHITECTURAL** | Adição ou remoção de módulo, engine, catálogo ou camada inteira | Sim — RFC arquitetural com análise de impacto completa | D4 |

### 5.3 Fluxo Completo de RFC

```
[1] PROPOSTA
│
└─► Autor submete RFC com:
    - Tipo de mudança (PATCH/MINOR/MAJOR/BREAKING/ARCHITECTURAL)
    - Componente(s) afetado(s)
    - Motivação (problema que resolve ou oportunidade)
    - Descrição da mudança proposta
    - Impacto esperado (funcional, de performance, de compatibilidade)
    └─► ENG-12 registra RFC com status: SUBMETIDO

[2] ANÁLISE DE IMPACTO AUTOMÁTICA (ENG-12)
│
└─► ENG-12 consulta Grafo de Dependências
    └─► Identifica todos os componentes que consomem o componente alvo
        └─► Para cada consumidor: verificar se a mudança é breaking
            ├─► Não é breaking → impacto: COMPATÍVEL
            └─► É breaking para N consumidores → impacto: BREAKING (N afetados)
                └─► Se N = 0: RFC simplificado
                    Se N = 1-3: RFC completo
                    Se N > 3: RFC arquitetural
    └─► Gerar relatório de impacto automático
        └─► RFC status: ANÁLISE_CONCLUÍDA

[3] REVISÃO TÉCNICA
│
└─► Responsáveis dos componentes afetados revisam
    └─► Cada revisor: APROVADO / REQUER_AJUSTE / REJEITADO
        ├─► Todos aprovados → avançar para aprovação formal
        ├─► Algum REQUER_AJUSTE → RFC volta para ajuste (status: EM_REVISÃO)
        └─► Algum REJEITADO → RFC vai para deliberação (status: EM_DELIBERAÇÃO)
            └─► D3 / D4 arbitra com DECISION_LOG

[4] APROVAÇÃO FORMAL
│
└─► Nível de decisão conforme tabela de classificação
    ├─► Aprovado → RFC status: APROVADO; data de implementação definida
    └─► Rejeitado → RFC status: REJEITADO; justificativa registrada (imutável)

[5] IMPLEMENTAÇÃO
│
└─► Responsável implementa mudança
    └─► ENG-12 monitora prazo de implementação (SLA conforme tipo)
        ├─► MINOR: ≤ 14 dias
        ├─► MAJOR: ≤ 30 dias
        └─► BREAKING / ARCHITECTURAL: conforme plano de migração
    └─► Ao implementar: atualizar versão do componente no RS
        └─► RFC status: IMPLEMENTADO

[6] VALIDAÇÃO
│
└─► ENG-12 executa Health Check no componente alterado e em todos os consumidores
    ├─► Todos saudáveis → RFC status: VALIDADO; ciclo encerrado
    └─► Algum com problema → RFC status: VALIDAÇÃO_FALHOU
        └─► Abrir incidente arquitetural; escalar para D3
```

### 5.4 Estrutura de Dados do RFC

```yaml
rfc:
  id: "RFC-[ANO]-[SEQUENCIAL]"        # ex: RFC-2026-014
  titulo: "[Título descritivo da mudança]"
  autor_id: "[ID]"
  tipo: "MAJOR"
  status: "APROVADO"
  componente_alvo: "ENG-01"
  componentes_afetados: ["CAP-02", "CAP-03", "CAP-05", "CAP-07", "CAP-09"]
  motivacao: "[Por que esta mudança é necessária]"
  descricao_mudanca: "[O que exatamente muda e como]"
  breaking_changes:
    - componente: "CAP-03"
      descricao: "Campo 'cliente_id' passa a ser obrigatório no evento processo.instancia_criada"
      migracao_necessaria: true
      prazo_migracao_dias: 21
  impacto_analise:
    consumidores_identificados: 5
    breaking_para: 1
    compativel_com: 4
    gerado_em: "2026-07-01T09:00:00Z"
  revisores:
    - revisor_id: "[ID]"
      componente: "CAP-03"
      decisao: "APROVADO"
      observacao: ""
      data: "2026-07-01T14:00:00Z"
  aprovacao_formal:
    nivel_decisao: "D3"
    aprovador_id: "[ID]"
    data: "2026-07-01T16:00:00Z"
    decision_log_id: "DL-2026-018"
  implementacao:
    responsavel_id: "[ID]"
    data_inicio: "2026-07-02"
    data_conclusao: "2026-07-10"
    versao_anterior: "1.0.0"
    versao_nova: "2.0.0"
  validacao:
    executada_em: "2026-07-10T20:00:00Z"
    resultado: "VALIDADO"
    componentes_verificados: 6
    problemas_encontrados: 0
  criado_em: "2026-07-01T08:00:00Z"
  atualizado_em: "2026-07-10T20:00:00Z"
```

---

## 6. Sistema 3 — Controle de Versão e Compatibilidade

### 6.1 Regras de Versionamento SemVer

Todos os artefatos do Commercial OS (módulos, engines, contratos, catálogos, eventos, processos) seguem SemVer: `MAJOR.MINOR.PATCH`

| Incremento | Quando | Exige RFC |
|------------|--------|-----------|
| **PATCH** (x.y.**Z**) | Correção de descrição, erro tipográfico, ajuste que não altera interface | Não |
| **MINOR** (x.**Y**.0) | Adição de campo opcional, novo evento, nova ação no CUA, nova seção | Sim (simplificado) |
| **MAJOR** (**X**.0.0) | Remoção de campo, renomeação de evento, mudança de semântica, reestruturação | Sim (completo) |

### 6.2 Política de Compatibilidade Retroativa

**CGV-R01 — Forward Compatibility Obrigatória:** Todo consumidor de evento DEVE ignorar campos desconhecidos (não falhar). Isso permite adicionar campos a eventos sem quebrar consumidores existentes.

**CGV-R02 — Campos Removidos Requerem Janela de Depreciação:** Nenhum campo pode ser removido de um contrato de evento sem passar pelo protocolo de depreciação (mínimo 60 dias de aviso). Remoção imediata requer RFC BREAKING com aprovação D3+.

**CGV-R03 — Renomeação = Breaking Change:** Renomear um evento, um campo obrigatório ou uma tabela de dados é sempre uma mudança MAJOR/BREAKING. Nunca é MINOR.

**CGV-R04 — Versão de Schema no CUE:** Cada tipo de evento no CUE declara uma `versao_schema`. Quando o schema de um evento muda de forma MAJOR, a versão do schema incrementa. Consumidores podem declarar qual versão de schema consomem durante o período de migração.

**CGV-R05 — Dois Schemas Simultâneos:** Durante uma migração MAJOR de schema de evento, o publicador DEVE publicar em ambas as versões simultaneamente por N dias (conforme plano de migração). Após N dias, a versão antiga é removida.

### 6.3 Matriz de Compatibilidade

A ENG-12 mantém uma matriz atualizada automaticamente:

```
MATRIZ DE COMPATIBILIDADE (exemplo parcial)
─────────────────────────────────────────────────────────────────
             │ CAP-02 │ CAP-03 │ CAP-04 │ CAP-05 │ ENG-07 │
─────────────┼────────┼────────┼────────┼────────┼────────┤
ENG-01 v2.0  │   ✓    │   ✓    │   ✓    │   ✓    │   ✓    │
ENG-01 v1.0  │  DEPR  │  DEPR  │  DEPR  │  DEPR  │  DEPR  │
─────────────┼────────┼────────┼────────┼────────┼────────┤
CUE v1.2     │   ✓    │   ✓    │   ✓    │   ✓    │   ✓    │
CUE v1.1     │   ✓    │   ✓    │  DEPR  │  DEPR  │   ✓    │
─────────────┼────────┼────────┼────────┼────────┼────────┤
oportunidade.│        │        │        │        │        │
ganha v2.0   │   —    │  PUB   │   ✓    │   ✓    │   ✓    │
oportunidade.│        │        │        │        │        │
ganha v1.0   │   —    │  DEPR  │  DEPR  │  DEPR  │  DEPR  │
─────────────┴────────┴────────┴────────┴────────┴────────┘

Legenda: ✓ COMPATÍVEL | DEPR DEPRECIADO (migração necessária) | PUB PUBLICADOR | — NÃO CONSOME
```

---

## 7. Sistema 4 — Grafo de Dependências

### 7.1 Definição

O Grafo de Dependências é a representação **calculada automaticamente** das relações entre todos os artefatos do sistema. Não é um documento estático — é derivado dos dados do RS em tempo real e recalculado a cada mudança.

### 7.2 Tipos de Dependência

| Tipo | Descrição | Direção | Criticidade |
|------|-----------|---------|-------------|
| `CONSOME_EVENTO` | Módulo/Engine consome evento publicado por outro | Direcional | ALTA — mudança no publicador afeta consumidor |
| `PUBLICA_EVENTO` | Módulo/Engine publica evento consumido por outro | Direcional | ALTA — mudança afeta todos consumidores |
| `UTILIZA_ENGINE` | Módulo usa capacidades de uma Engine | Direcional | MÉDIA — mudança na engine afeta módulo |
| `REGISTRA_PROCESSO` | Módulo registra blueprint na ENG-01 | Direcional | MÉDIA — blueprint usa contrato da ENG-01 |
| `REFERENCIA_EXTERNA` | KPI ou métrica declara dependência de outro módulo | Direcional | BAIXA — mudança no KPI original pode afetar referência |
| `COMPARTILHA_CONTRATO` | Ambos os lados usam o mesmo contrato de integração | Bidirecional | ALTA — mudança no contrato afeta ambos |
| `DEPENDE_PARAMETRO` | Componente usa valor de PARAM dinâmico | Direcional | MÉDIA — mudança no parâmetro afeta componente |

### 7.3 Representação do Grafo (exemplo parcial)

```
GRAFO DE DEPENDÊNCIAS — NODO: oportunidade.ganha (CUE)
─────────────────────────────────────────────────────────

PUBLICADOR:
  └─► CAP-03 (v2.1.0) [CONSOME_EVENTO invertido → é o publicador]

CONSUMIDORES DIRETOS:
  ├─► CAP-04 (v2.0.0) — usa para iniciar faturamento [CONSOME_EVENTO]
  ├─► CAP-05 (v2.0.0) — usa para iniciar onboarding [CONSOME_EVENTO]
  ├─► ENG-01 (v1.0.0) — usa como gatilho de instância PROC-CAP05-ONBOARDING [CONSOME_EVENTO]
  ├─► ENG-07 (v1.0.0) — usa como gatilho de workflows de pós-venda [CONSOME_EVENTO]
  └─► ENG-11 (v1.0.0) — usa para classificação no Fluxo Cognitivo [CONSOME_EVENTO]

IMPACTO DE MUDANÇA BREAKING EM oportunidade.ganha:
  Afeta: 5 consumidores diretos
  Nível de RFC: BREAKING
  Aprovação: D3 (4 componentes CAP/ENG afetados)
  Janela de depreciação: ≥ 60 dias
  Schema dual obrigatório: SIM (por 60 dias)

DEPENDÊNCIAS DE SEGUNDO GRAU (via CAP-04):
  └─► CAP-05 recebe receita.mrr_calculado de CAP-04, que por sua vez depende de oportunidade.ganha
      Risco de cascata: MÉDIO
```

### 7.4 Alertas do Grafo

O Grafo detecta e alerta automaticamente:

| Padrão Detectado | Alerta | Severidade |
|-----------------|--------|-----------|
| Ciclo de dependência (A→B→A) | `sistema.dependencia_circular_detectada` | CRÍTICO |
| Componente sem consumidores há > 90 dias | `sistema.componente_orfao_detectado` | ATENÇÃO |
| Evento no CUE sem publicador ativo | `sistema.evento_sem_publicador` | CRÍTICO |
| Evento no CUE com consumidores mas sem publicador ativo | `sistema.evento_publicador_ausente` | CRÍTICO |
| Componente consumindo versão depreciada | `sistema.versao_depreciada_em_uso` | ATENÇÃO |
| Consumidor sem declaração de versão de schema | `sistema.schema_sem_versao_declarada` | INFORMATIVO |
| Dependência de componente com status DEPRECIADO | `sistema.dependencia_de_depreciado` | ATENÇÃO |

---

## 8. Sistema 5 — Health Check Arquitetural

### 8.1 Definição

O Health Check Arquitetural é a **auditoria automatizada da saúde estrutural do sistema** — não das operações de negócio (isso é a ENG-06), mas da integridade da arquitetura em si: contratos, versões, dependências, completude e consistência.

### 8.2 Frequência de Execução

| Tipo | Frequência | Escopo | Gatilho |
|------|-----------|--------|---------|
| Incremental | A cada mudança no RS | Componente alterado + dependências de 1º grau | Evento `sistema.rs_atualizado` |
| Completo | Semanal (Domingo 04:00) | Todo o Commercial OS | SOE-SYS-SCHEDULER |
| Sob demanda | Qualquer momento | Escopo definido | RFC antes de aprovação; requisição D2+ |
| Pré-RFC | Automático ao aprovar RFC | Componentes afetados pelo RFC | Motor de RFC |

### 8.3 Checklist do Health Check

```
BLOCO A — INTEGRIDADE DO REGISTRO SISTÊMICO
□ A1: Todos os CAP (01-09) estão no RS com status = ATIVO
□ A2: Todas as ENG (01-12) estão no RS com status = ATIVO
□ A3: Todos os artefatos têm responsável_arquitetural designado
□ A4: Todos os artefatos têm documento_referencia acessível
□ A5: Nenhum artefato com versão "0.x" (rascunho) em status ATIVO

BLOCO B — CONSISTÊNCIA DO CUE (Catálogo de Eventos)
□ B1: Todo evento no CUE tem exatamente um publicador declarado
□ B2: Todo publicador declarado no CUE existe no RS como artefato ATIVO
□ B3: Todo consumidor declarado no CUE existe no RS como artefato ATIVO
□ B4: Nenhum evento é publicado sem estar no CUE
□ B5: Convenção de nomenclatura [dominio].[entidade].[acao_passado] aplicada em 100% dos eventos
□ B6: Todo evento tem versao_schema declarada

BLOCO C — COMPATIBILIDADE DE VERSÕES
□ C1: Nenhum componente consome schema de evento em versão DEPRECIADA
□ C2: Nenhuma dependência aponta para componente com status DEPRECIADO
□ C3: Todos os componentes que consomem campos obrigatórios têm esses campos declarados em sua versão atual
□ C4: Nenhum campo obrigatório foi removido sem passagem pelo protocolo de depreciação

BLOCO D — INTEGRIDADE DO GRAFO DE DEPENDÊNCIAS
□ D1: Nenhuma dependência circular detectada
□ D2: Nenhum evento com consumidores declarados mas sem publicador ativo
□ D3: Nenhum componente ATIVO isolado (sem qualquer dependência de entrada ou saída) por mais de 90 dias

BLOCO E — RFC E GOVERNANÇA DE MUDANÇAS
□ E1: Nenhuma mudança MAJOR ou superior aplicada sem RFC aprovado
□ E2: Todos os RFCs APROVADOS foram implementados dentro do SLA
□ E3: Nenhum RFC VALIDADO_FALHOU permanece aberto por mais de 7 dias sem ação

BLOCO F — PARÂMETROS DINÂMICOS
□ F1: Todos os PARAM dinâmicos têm valor atual, histórico e nível de decisão para alteração documentados
□ F2: Nenhum parâmetro alterado sem registro de nível de decisão adequado
□ F3: MUP — pesos das 5 dimensões somam exatamente 100% no modo atual

BLOCO G — CONECTORES
□ G1: Todos os CONN declarados têm status de saúde verificado nos últimos 7 dias
□ G2: Nenhum CONN com status DEGRADADO ativo por mais de 48h sem plano de ação
□ G3: Todo CONN tem SLA contratual documentado e proprietário designado
```

### 8.4 Classificação do Resultado

| Resultado | Critério | Ação |
|-----------|----------|------|
| **SAUDÁVEL** | Todos os blocos com 100% dos itens ✓ | Sem ação; registrar resultado |
| **ATENÇÃO** | 1-3 itens reprovados, nenhum nos blocos B ou D | Abrir tarefas de correção com SLA 7 dias |
| **DEGRADADO** | 4+ itens reprovados OU qualquer item dos blocos B ou D | RFC de correção obrigatório; alertar D2 |
| **CRÍTICO** | Qualquer item B1, B4, D1 ou D2 reprovado | Alertar D3 imediatamente; bloquear novos RFCs até correção |

### 8.5 Índice de Saúde Arquitetural (ISA)

```
ISA = (itens_aprovados / total_itens_verificados) × 100

Meta: ISA ≥ 97%
Limiar de degradação: ISA < 90%
Limiar crítico: ISA < 80%
```

---

## 9. Sistema 6 — Protocolo de Depreciação

### 9.1 Definição

O Protocolo de Depreciação garante que **nenhum componente, evento, campo ou comportamento seja removido abruptamente** do sistema. Toda remoção passa por uma sequência formal que dá tempo aos consumidores para migrar.

### 9.2 Fases da Depreciação

```
FASE 1 — AVISO DE DEPRECIAÇÃO (dia 0)
│
├─► RFC aprovado com tipo BREAKING ou ARCHITECTURAL
├─► Status do artefato muda para: DEPRECIADO_COM_AVISO
├─► ENG-12 emite: sistema.deprecacao_anunciada
├─► Todos os consumidores são notificados com:
│   - O que será removido
│   - Por quê está sendo removido
│   - O que substitui (alternativa obrigatória)
│   - Data de remoção (dia 0 + janela mínima)
└─► Janelas mínimas por tipo:
    - Campo opcional → 30 dias
    - Campo obrigatório → 60 dias
    - Evento inteiro → 90 dias
    - Engine ou módulo inteiro → 180 dias

FASE 2 — PERÍODO DE MIGRAÇÃO (dia 1 até dia N-7)
│
├─► Componente/comportamento depreciado ainda funciona normalmente
├─► Para eventos: publicador emite nas duas versões simultaneamente
├─► ENG-12 rastreia: quais consumidores já migraram (0 → N)
├─► Alertas automáticos aos consumidores não migrados a cada:
│   - 25% do prazo atingido
│   - 50% do prazo atingido
│   - 75% do prazo atingido (alerta de urgência — nível ATENÇÃO)
│   - 7 dias antes do prazo (alerta CRÍTICO)
└─► Health Check semanal inclui verificação de migração

FASE 3 — VERIFICAÇÃO PRÉ-REMOÇÃO (dia N-7 até dia N)
│
├─► Health Check completo no escopo da depreciação
├─► Se consumidores ainda não migraram:
│   ├─► 1 consumidor: notificação de urgência; D2 responsável pelo consumidor
│   └─► 2+ consumidores: escalar para D3; extensão de prazo pode ser concedida
│       └─► Extensão máxima: 50% do prazo original; apenas uma extensão por RFC
└─► Se todos os consumidores migraram: autorizar remoção

FASE 4 — REMOÇÃO (dia N)
│
├─► Componente/comportamento removido do sistema
├─► Status no RS muda para: ARQUIVADO
├─► ENG-12 emite: sistema.deprecacao_concluida
├─► Versão MAJOR do artefato que recebia incrementada
└─► RS atualizado; Grafo de Dependências recalculado
```

### 9.3 Estrutura de Dados da Depreciação

```yaml
depreciacao:
  id: "DEPR-[ANO]-[SEQUENCIAL]"
  rfc_id: "RFC-2026-014"
  artefato_id: "oportunidade.ganha"
  artefato_tipo: "EVENTO_CUE"
  versao_depreciada: "1.0.0"
  versao_substituta: "2.0.0"
  motivo: "Payload enriquecido requer novo schema; campos antigos insuficientes para CAP-04 e CAP-05"
  alternativa: "Consumir oportunidade.ganha v2.0.0 com campos adicionais obrigatórios"
  status: "EM_MIGRACAO"
  anunciado_em: "2026-07-01"
  data_remocao: "2026-09-29"
  janela_dias: 90
  consumidores_total: 5
  consumidores_migrados: 3
  consumidores_pendentes: ["CAP-07", "ENG-09"]
  alertas_enviados:
    - fase: "25%"
      data: "2026-07-23"
    - fase: "50%"
      data: "2026-08-14"
  extensao_concedida: false
```

---

## 10. Sistema 7 — Gestão de Migrações

### 10.1 Definição

Uma migração é necessária quando uma mudança MAJOR ou BREAKING exige que os **consumidores alterem seu próprio código ou configuração** para continuar funcionando após a mudança. A Gestão de Migrações coordena esse processo de forma estruturada.

### 10.2 Plano de Migração (obrigatório para BREAKING/ARCHITECTURAL)

```yaml
plano_migracao:
  id: "MIG-[ANO]-[SEQUENCIAL]"
  rfc_id: "RFC-2026-014"
  tipo: "SCHEMA_EVENTO"
  descricao: "Migração do schema de oportunidade.ganha v1.0 para v2.0"
  componentes_afetados:
    - id: "CAP-04"
      responsavel_migracao: "[ID]"
      prazo: "2026-08-15"
      status: "CONCLUIDA"
      notas: "Campos adicionados ao consumer; testado em ambiente de staging"
    - id: "CAP-05"
      responsavel_migracao: "[ID]"
      prazo: "2026-08-15"
      status: "EM_ANDAMENTO"
      notas: ""
  periodo_dual_schema:
    ativo: true
    inicio: "2026-07-01"
    fim: "2026-09-29"
    publicador: "CAP-03"
    versoes_ativas: ["1.0.0", "2.0.0"]
  guia_migracao:
    passo_1: "Adicionar tratamento dos novos campos ao consumer de oportunidade.ganha"
    passo_2: "Garantir que campos novos (mrr, segmento_id, ciclo_dias) são processados corretamente"
    passo_3: "Remover dependência de campos que foram descontinuados na v1"
    passo_4: "Declarar versao_schema: 2.0.0 no ENGINE-REGISTRATION do módulo"
    passo_5: "Notificar ENG-12 da conclusão da migração"
  ambiente_de_teste_disponivel: true
  rollback_possivel_ate: "2026-08-01"
  criado_em: "2026-07-01"
```

### 10.3 Estratégias de Migração Suportadas

| Estratégia | Quando Usar | Como Funciona |
|------------|-------------|---------------|
| **Dual Schema** | Schema de evento | Publicador emite em v_old e v_new simultaneamente; consumidores migram individualmente |
| **Feature Flag** | Comportamento de engine | Nova lógica ativada por parâmetro; ambas as versões coexistem até migração completa |
| **Blue-Green** | Substituição de componente inteiro | Nova versão do componente ativada em paralelo; tráfego migrado gradualmente |
| **Forced Migration** | Situações críticas de segurança | Migração obrigatória imediata; sem janela de depreciação; exige aprovação D4 |

---

## 11. Sistema 8 — Parâmetros Dinâmicos do Sistema

### 11.1 Definição

Parâmetros Dinâmicos são **valores configuráveis que afetam o comportamento sistêmico** sem exigir mudança de código ou arquitetura. São gerenciados pela ENG-12, versionados, auditados e protegidos por nível de decisão.

### 11.2 MUP Dinâmica

A Matriz Universal de Priorização (definida na ENG-11) opera com pesos padrão. A ENG-12 permite que esses pesos sejam ajustados conforme o **contexto estratégico da empresa** — sem alterar o algoritmo, apenas a parametrização.

```yaml
mup_configuracao:
  id: "PARAM-MUP-PESOS"
  nome: "Pesos da Matriz Universal de Priorização"
  nivel_decisao_alteracao: "D3"
  versao: "1.0.0"
  modos_disponiveis:
    padrao:
      descricao: "Operação normal"
      pesos:
        impacto: 0.30
        urgencia: 0.25
        frequencia: 0.20
        tendencia: 0.15
        risco: 0.10
      soma_verificacao: 1.00
    crise_financeira:
      descricao: "Ativar durante períodos de pressão de receita ou MRR abaixo de limiar crítico"
      pesos:
        impacto: 0.40
        urgencia: 0.25
        frequencia: 0.15
        tendencia: 0.10
        risco: 0.10
      soma_verificacao: 1.00
      condicao_ativacao: "MRR < 85% da meta por 2 períodos consecutivos"
    crescimento_acelerado:
      descricao: "Ativar durante expansão rápida (>20% MoM novos clientes)"
      pesos:
        impacto: 0.25
        urgencia: 0.20
        frequencia: 0.25
        tendencia: 0.20
        risco: 0.10
      soma_verificacao: 1.00
      condicao_ativacao: "Novos clientes MoM > 20% por 2 períodos consecutivos"
    auditoria_intensiva:
      descricao: "Ativar quando ISA < 90% ou durante preparação para auditoria externa"
      pesos:
        impacto: 0.25
        urgencia: 0.30
        frequencia: 0.15
        tendencia: 0.10
        risco: 0.20
      soma_verificacao: 1.00
  modo_ativo: "padrao"
  modo_ativo_desde: "2026-07-01"
  historico_modos:
    - modo: "padrao"
      ativo_desde: "2026-07-01"
      ativo_ate: null
      ativado_por: "[ID]"
      decision_log_id: null
```

**Regra:** A soma dos pesos DEVE ser sempre 1.00 (100%). A ENG-12 valida matematicamente antes de aceitar qualquer configuração. Um modo com soma ≠ 1.00 é rejeitado automaticamente.

**Ativação de Modo:** A ativação de um modo não-padrão requer decisão D3. Retorno ao modo padrão pode ser feito por D2. A ativação automática por condição (ver `condicao_ativacao` acima) também requer decisão D3 prévia para o modo ser elegível para ativação automática.

### 11.3 Catálogo de Parâmetros Dinâmicos

| ID | Nome | Valor Atual | Nível p/ Alterar | Impacto |
|----|------|-------------|-----------------|---------|
| PARAM-MUP-PESOS | Pesos da MUP | Modo: padrão | D3 | ENG-11 — priorização de todas as situações |
| PARAM-JANELA-CLAWBACK | Janela de clawback de comissão (dias) | 90 | D3 | CAP-09, ENG-08 |
| PARAM-HEALTH-SCORE-LIMIARES | Limiares verde/amarelo/vermelho | 70/40 | D3 | CAP-05, ENG-02, ENG-03 |
| PARAM-SLA-ALERTAS | SLAs de resposta por nível de alerta | Ver ENG-03 | D2 | ENG-03, ENG-11 |
| PARAM-ICP-SCORE-MQL | Limiar de ICP score para MQL | 7 | D3 | CAP-02, ENG-07 |
| PARAM-CHURN-WINDOW | Janela de análise de risco de churn (dias) | 30 | D3 | CAP-05 |
| PARAM-DEPR-JANELA-EVENTO | Janela mínima de depreciação de evento (dias) | 90 | D4 | ENG-12 |
| PARAM-ISA-META | Meta de Índice de Saúde Arquitetural | 97% | D4 | ENG-12 |

### 11.4 Regras dos Parâmetros Dinâmicos

**PAR-R01 — Auditabilidade Total:** Toda alteração de parâmetro é registrada com: valor anterior, valor novo, quem alterou, decisão que autorizou, data.

**PAR-R02 — Nenhuma Alteração Silenciosa:** Parâmetros não podem ser alterados diretamente em banco de dados ou config files. A alteração deve ser feita via ENG-12 com registro formal.

**PAR-R03 — Efeito Imediato:** A alteração de um parâmetro tem efeito imediato após registro. Não há rollout gradual — isso é intencional para garantir consistência.

**PAR-R04 — Rollback:** Reverter um parâmetro para o valor anterior é uma nova alteração (com mesmo nível de decisão). Não existe "desfazer" — o histórico é imutável.

---

## 12. Fluxo de Governança Sistêmica

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO 1 — MUDANÇA PLANEJADA (RFC)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Proponente identifica necessidade de mudança
  ↓
Submeter RFC com tipo e escopo
  ↓
ENG-12 executa análise de impacto no Grafo de Dependências
  ↓
Revisores dos componentes afetados revisam
  ↓
Aprovação formal (nível de decisão conforme tipo)
  ↓
Implementação com prazo e responsável definidos
  ↓
ENG-12 atualiza RS: nova versão do componente
  ↓
Health Check incremental: componente + dependências
  ↓
Validação formal: RFC → status VALIDADO
  ↓
Grafo de Dependências recalculado
  ↓
Emitir: sistema.rfc_concluido

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO 2 — INCONSISTÊNCIA DETECTADA (Reativo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Health Check identifica inconsistência
   OU
Grafo detecta anomalia (circular, evento sem publicador, etc.)
  ↓
ENG-12 classifica: ATENÇÃO / DEGRADADO / CRÍTICO
  ↓
Emitir: sistema.inconsistencia_detectada (com severidade)
  ↓
Se CRÍTICO → alertar D3 imediatamente; bloquear novos RFCs
  ↓
Abrir RFC de correção (tipo determinado pelo tipo de inconsistência)
  ↓
→ continua no Modo 1 a partir de "Revisores revisam"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODO 3 — ONBOARDING DE NOVO COMPONENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RFC ARCHITECTURAL submetido para novo componente
  ↓
ENG-12 verifica: eventos no CUE? Contratos no RS?
  ↓
Análise de impacto: quais componentes existentes são afetados?
  ↓
Se novo evento → adicionado ao CUE (MINOR se adição)
  ↓
Se novo campo em evento existente → RFC MINOR para o evento
  ↓
Aprovação D4 do RFC ARCHITECTURAL
  ↓
Componente registrado no RS com status RASCUNHO
  ↓
Health Check de integração (todos os eventos publicados/consumidos validados)
  ↓
Status muda para ATIVO
  ↓
Grafo de Dependências atualizado
  ↓
Emitir: sistema.componente_ativado
```

---

## 13. Estrutura de Dados

### 13.1 Tabela: `rs_artefatos` (Registro Sistêmico)
```
id                      TEXT PRIMARY KEY
tipo                    TEXT                    -- MODULO|ENGINE|CONTRATO|CATALOGO|PROCESSO|CONECTOR|POLITICA|PARAMETRO
nome                    TEXT
versao_atual            TEXT
status                  TEXT                    -- ATIVO|DEPRECIADO_COM_AVISO|MIGRANDO|RASCUNHO|ARQUIVADO
categoria               TEXT
responsavel_id          TEXT
documento_referencia    TEXT
interfaces_json         JSONB                   -- eventos publicados e consumidos com schemas
dependencias_json       JSONB                   -- engines, módulos, contratos, conectores
health_check_ultimo     TIMESTAMP
health_check_status     TEXT
criado_em               TIMESTAMP
atualizado_em           TIMESTAMP
```

### 13.2 Tabela: `rs_versoes` (append only — histórico imutável)
```
id                      UUID PRIMARY KEY
artefato_id             TEXT REFERENCES rs_artefatos
versao                  TEXT
tipo_mudanca            TEXT                    -- PATCH|MINOR|MAJOR|BREAKING|ARCHITECTURAL
rfc_id                  TEXT                    -- referência ao RFC que gerou esta versão
descricao               TEXT
aplicado_em             TIMESTAMP
aplicado_por_id         TEXT
```

### 13.3 Tabela: `rfcs`
```
id                      TEXT PRIMARY KEY        -- "RFC-YYYY-NNN"
titulo                  TEXT
autor_id                TEXT
tipo                    TEXT
status                  TEXT                    -- SUBMETIDO|ANALISE_CONCLUIDA|EM_REVISAO|EM_DELIBERACAO|APROVADO|REJEITADO|IMPLEMENTADO|VALIDADO|VALIDACAO_FALHOU
componente_alvo         TEXT
componentes_afetados    TEXT[]
motivacao               TEXT
descricao_mudanca       TEXT
breaking_changes_json   JSONB
impacto_analise_json    JSONB
revisores_json          JSONB
aprovacao_json          JSONB
implementacao_json      JSONB
validacao_json          JSONB
criado_em               TIMESTAMP
atualizado_em           TIMESTAMP
```

### 13.4 Tabela: `deprecacoes`
```
id                      TEXT PRIMARY KEY
rfc_id                  TEXT REFERENCES rfcs
artefato_id             TEXT
artefato_tipo           TEXT
versao_depreciada       TEXT
versao_substituta       TEXT
motivo                  TEXT
alternativa             TEXT
status                  TEXT                    -- ANUNCIADA|EM_MIGRACAO|CONCLUIDA|CANCELADA
anunciado_em            DATE
data_remocao            DATE
janela_dias             INTEGER
consumidores_total      INTEGER
consumidores_migrados   INTEGER
consumidores_pendentes  TEXT[]
alertas_enviados_json   JSONB
extensao_concedida      BOOLEAN
criado_em               TIMESTAMP
atualizado_em           TIMESTAMP
```

### 13.5 Tabela: `health_checks`
```
id                      UUID PRIMARY KEY
tipo                    TEXT                    -- INCREMENTAL|COMPLETO|SOB_DEMANDA|PRE_RFC
escopo                  TEXT[]                  -- componentes verificados
resultado               TEXT                    -- SAUDAVEL|ATENCAO|DEGRADADO|CRITICO
isa_score               DECIMAL(5,2)
itens_total             INTEGER
itens_aprovados         INTEGER
itens_reprovados_json   JSONB
executado_em            TIMESTAMP
duracao_ms              INTEGER
rfc_id                  TEXT                    -- se foi pré-RFC
```

### 13.6 Tabela: `parametros_dinamicos`
```
id                      TEXT PRIMARY KEY
nome                    TEXT
descricao               TEXT
valor_atual_json        JSONB
nivel_decisao_alteracao TEXT
historico_json          JSONB                   -- append de alterações
componentes_impactados  TEXT[]
versao                  TEXT
atualizado_em           TIMESTAMP
atualizado_por_id       TEXT
```

---

## 14. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `sistema.rfc_submetido` | RFC criado e registrado | `{rfc_id, tipo, componente_alvo, autor_id}` |
| `sistema.rfc_aprovado` | RFC aprovado formalmente | `{rfc_id, tipo, componentes_afetados, data_implementacao}` |
| `sistema.rfc_rejeitado` | RFC rejeitado | `{rfc_id, motivo, decision_log_id}` |
| `sistema.rfc_concluido` | RFC implementado e validado | `{rfc_id, versao_anterior, versao_nova, componente_id}` |
| `sistema.deprecacao_anunciada` | Protocolo de depreciação iniciado | `{depreciacao_id, artefato_id, data_remocao, consumidores_afetados}` |
| `sistema.deprecacao_concluida` | Componente/comportamento removido | `{depreciacao_id, artefato_id, rfc_id}` |
| `sistema.health_check_concluido` | Health Check finalizado | `{health_check_id, resultado, isa_score, itens_reprovados}` |
| `sistema.inconsistencia_detectada` | Inconsistência arquitetural detectada | `{componente_id, tipo_inconsistencia, severidade}` |
| `sistema.componente_ativado` | Novo componente registrado e ativo | `{artefato_id, tipo, versao}` |
| `sistema.componente_arquivado` | Componente removido do sistema | `{artefato_id, tipo, rfc_id}` |
| `sistema.parametro_alterado` | Parâmetro dinâmico atualizado | `{param_id, valor_anterior, valor_novo, nivel_decisao, alterado_por}` |
| `sistema.mup_modo_alterado` | Modo da MUP Dinâmica alterado | `{modo_anterior, modo_novo, decision_log_id}` |
| `sistema.rs_atualizado` | Registro Sistêmico atualizado | `{artefato_id, tipo_mudanca, versao_nova}` |
| `sistema.dependencia_circular_detectada` | Ciclo de dependência encontrado | `{componentes_no_ciclo, severidade: CRITICO}` |
| `sistema.evento_sem_publicador` | Evento no CUE sem publicador ativo | `{evento_tipo, consumidores_afetados}` |
| `sistema.versao_depreciada_em_uso` | Componente consumindo versão depreciada | `{consumidor_id, artefato_depreciado_id, versao_em_uso}` |

---

## 15. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `sistema.periodo_encerrado` | SOE-SYS-SCHEDULER | Executar Health Check completo se período = SEMANAL |
| `decisao.incidente_encerrado` | ENG-11 | Verificar se incidente revelou necessidade de RFC |
| `decisao.bud_atualizada` | ENG-11 | Atualizar versão do catálogo BUD no RS |
| `decisao.cua_atualizado` | ENG-11 | Atualizar versão do catálogo CUA no RS |
| `processo.blueprint_registrado` | ENG-01 | Registrar novo blueprint no RS; verificar compatibilidade |
| `workflow.falhou` | ENG-07 | Verificar se falha tem origem em incompatibilidade de versão |

---

## 16. Regras Gerais

**ENG12-R01 — Nenhuma Mudança sem Rastreabilidade:** Todo artefato no RS tem histórico imutável de versões. Mudança sem rastreabilidade é inconsistência arquitetural (Health Check bloqueia).

**ENG12-R02 — ENG-12 não é Burocracia:** RFC simplificado (MINOR) deve ser completado em ≤ 48h (análise + aprovação D2). A governança não pode ser mais lenta que o desenvolvimento. Se um RFC simplificado demora > 48h, é falha de processo da ENG-12.

**ENG12-R03 — Bloco de RFCs em Status CRÍTICO:** Se o Health Check resulta em CRÍTICO, novos RFCs MAJOR ou superior não podem ser aprovados até que a inconsistência crítica seja resolvida. RFCs que *corrigem* a inconsistência crítica são tratados como prioridade máxima.

**ENG12-R04 — MUP Sempre Soma 1.0:** A ENG-12 valida matematicamente os pesos da MUP antes de aceitar qualquer configuração. Configuração inválida (soma ≠ 1.00) é rejeitada automaticamente sem escalonamento.

**ENG12-R05 — Grafo é Calculado, não Declarado:** O Grafo de Dependências é derivado dos dados do RS — não é editado manualmente. Se há discrepância entre o que um módulo declara e o que os dados mostram, o dado declarado no RS prevalece e o Grafo aponta a inconsistência.

**ENG12-R06 — Depreciação Não Pode Ser Acelerada sem D4:** Reduzir a janela mínima de depreciação de qualquer artefato abaixo do valor do PARAM-DEPR-JANELA-EVENTO requer aprovação D4 e RFC ARCHITECTURAL. Não há exceção.

**ENG12-R07 — RS é Autoritativo:** Em caso de divergência entre o que está documentado em um módulo e o que está registrado no RS, o RS prevalece para fins de governança. O módulo deve ser atualizado via RFC para refletir a realidade do RS.

**ENG12-R08 — Parâmetros Dinâmicos são Sistêmicos:** Nenhum módulo pode manter sua própria cópia de um parâmetro sistêmico (ex: JANELA_CLAWBACK_DIAS). Todos leem do RS via consulta à ENG-12. Cópias locais são inconsistências arquiteturais.

---

## 17. Interfaces com as Outras Engines

| Engine | Como a ENG-12 Interage |
|--------|----------------------|
| ENG-01 (Processos) | Registra blueprints no RS; verifica compatibilidade de blueprints ao registrar |
| ENG-02 (KPIs) | Registra definições de KPIs no RS; gerencia versões do catálogo de KPIs |
| ENG-03 (Alertas) | Emite alertas arquiteturais via ENG-03; recebe alertas de componentes degradados |
| ENG-04 (Diagnóstico) | Aciona ENG-04 para diagnóstico de inconsistências arquiteturais complexas |
| ENG-05 (Planos de Ação) | Cria planos de correção quando Health Check identifica problemas |
| ENG-06 (Auditoria) | Registra todos os RFCs e Health Checks no log de auditoria; fornece histórico imutável |
| ENG-07 (Workflows) | Registra definições de workflow no RS; verifica compatibilidade de versão |
| ENG-08 (Automação) | Registra conectores no RS; monitora saúde dos conectores |
| ENG-09 (Melhoria Contínua) | Recebe sugestões de melhoria arquitetural do backlog; converte em RFCs quando aprovado |
| ENG-10 (IA/Conhecimento) | Incorpora aprendizados de RFCs e depreciações na base de conhecimento |
| ENG-11 (Decision Engine) | Fornece parâmetros dinâmicos (MUP pesos, modo ativo); recebe eventos de incidentes que podem gerar RFCs |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-07-01 | Guardião da Documentação Técnica | Criação da especificação da ENG-12 |
