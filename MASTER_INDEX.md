# MASTER INDEX — Sistema Operacional Empresarial (SOE)
# MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-000 |
| **Título** | Índice Mestre do Sistema Operacional Empresarial — SOE MM Negócios |
| **Tipo** | Guia |
| **Autor** | Guardião da Documentação Técnica |
| **Data de Criação** | 2026-06-28 |
| **Última Revisão** | 2026-06-28 |
| **Próxima Revisão** | 2026-09-28 |
| **Versão** | 1.0.0 |
| **Status** | aprovado |
| **Prioridade** | crítica |
| **Domínio** | Governança |

---

## 2. Objetivo

Este é o documento mais importante do repositório. É o mapa completo da base de
conhecimento do SOE: lista cada Volume, Capítulo, Documento, Seção e Artefato em
ordem lógica de engenharia, com status de completude de cada elemento.

Qualquer pessoa que ingresse no projeto deve ler este índice antes de qualquer
outro documento. Qualquer pessoa que precise encontrar algo no projeto deve
começar aqui. Qualquer lacuna na documentação torna-se visível neste índice.

Este documento não tem conteúdo próprio além da estrutura — seu valor é a visibilidade
total sobre o que existe, o que falta e como tudo se conecta.

---

## 3. Escopo

### 3.1 O que este documento cobre

- A estrutura hierárquica completa de toda a documentação do SOE
- O status de cada documento (existente, pendente, planejado)
- A ordem lógica de leitura e criação dos documentos
- O registro central de IDs atribuídos
- A Matriz de Rastreabilidade Vertical resumida

### 3.2 O que este documento NÃO cobre

- O conteúdo de nenhum documento listado (cada um tem seu próprio arquivo)
- As regras de governança da documentação → ver `DOC-GOV-002`
- O sistema de relacionamentos entre documentos → ver `DOC-GOV-012`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Governa este índice |
| DOC-GOV-004 | Sistema de Identificação | aprovado | IDs listados aqui seguem aquele sistema |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `contém →` | todos os documentos | — | Este índice referencia todos os documentos do projeto |
| `implementa →` | DOC-GOV-011 | Política de Rastreabilidade | O índice é o instrumento central de rastreabilidade |
| `referencia →` | DOC-GOV-004 | Sistema de Identificação | IDs são gerenciados conforme aquele sistema |

---

## 6. Como Ler Este Índice

### Legenda de Status

| Símbolo | Significado |
|---|---|
| `✅` | Documento existe e está aprovado |
| `🔄` | Documento existe em rascunho ou revisão |
| `📋` | Documento planejado — estrutura criada, conteúdo pendente |
| `⏳` | Documento planejado — ainda não criado |
| `🔒` | Documento restrito — acesso controlado |
| `⚠️` | Documento obsoleto |

### Legenda de Prioridade de Criação

| Símbolo | Significado |
|---|---|
| `[P1]` | Criar primeiro — bloqueia outros documentos |
| `[P2]` | Criar na segunda fase |
| `[P3]` | Criar na terceira fase |
| `[P4]` | Criar quando o módulo for implementado |

---

## 6. Conteúdo Principal — Estrutura Hierárquica Completa

---

# ══════════════════════════════════════════════════════
# VOLUME I — FUNDAÇÕES DO PROJETO
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Estabelece a identidade, propósito e limites
# do SOE. É o ponto de partida de toda leitura. Nenhum documento
# de outros volumes pode ser criado sem que este volume esteja
# completo e aprovado.
#
# Audiência primária: Diretoria, Arquiteto Líder, Novos membros
# Ordem de leitura: Capítulos 1 → 2 → 3

---

## CAPÍTULO 1 — Identidade e Visão do Projeto

> Define quem é a MM Negócios, por que o SOE existe e qual futuro ele viabiliza.
> É a âncora estratégica de todas as decisões técnicas.

### DOC-00-001 | `docs/00-project/project-context.md` | 📋 [P1]
**Contexto do Projeto**
- Seção 6.1 — Histórico e situação atual da MM Negócios
- Seção 6.2 — Sistemas existentes e suas limitações
- Seção 6.3 — Motivadores da mudança (drivers)
- Seção 6.4 — Contexto de mercado e concorrência
- Seção 6.5 — Premissas e restrições organizacionais
- Seção 6.6 — O que o SOE não pode repetir do passado
- _Artefato:_ Mapa de sistemas legados (diagrama)
- _Artefato:_ Análise de gap (tabela atual vs. desejado)

### DOC-00-002 | `docs/00-project/vision.md` | 📋 [P1]
**Visão do Projeto**
- Seção 6.1 — Declaração de visão (1 frase)
- Seção 6.2 — Problema central que o SOE resolve
- Seção 6.3 — Objetivos estratégicos (OKRs de alto nível)
- Seção 6.4 — Princípios de negócio não negociáveis
- Seção 6.5 — Métricas de sucesso do projeto
- Seção 6.6 — Horizonte temporal e fases macro
- Seção 6.7 — O que o sucesso parece em 1, 3 e 5 anos
- _Artefato:_ Vision Canvas (modelo)
- _Artefato:_ Mapa de objetivos estratégicos (diagrama)

### DOC-00-003 | `docs/00-project/scope.md` | 📋 [P1]
**Escopo do Projeto**
- Seção 6.1 — Domínios de negócio incluídos
- Seção 6.2 — Domínios de negócio explicitamente excluídos
- Seção 6.3 — Usuários cobertos pelo SOE
- Seção 6.4 — Sistemas que o SOE substitui
- Seção 6.5 — Sistemas que o SOE coexiste (não substitui)
- Seção 6.6 — Fronteiras geográficas e organizacionais
- Seção 6.7 — O que é e o que não é responsabilidade do SOE
- _Artefato:_ Mapa de escopo (diagrama de contexto)
- _Artefato:_ Tabela in-scope / out-of-scope

### DOC-00-004 | `docs/00-project/stakeholders.md` | 📋 [P1]
**Mapa de Stakeholders**
- Seção 6.1 — Stakeholders primários (decisores)
- Seção 6.2 — Stakeholders secundários (influenciadores)
- Seção 6.3 — Stakeholders externos (parceiros, reguladores)
- Seção 6.4 — Matriz de poder vs. interesse
- Seção 6.5 — Estratégia de comunicação por stakeholder
- Seção 6.6 — Expectativas e riscos por stakeholder
- _Artefato:_ Matriz de poder × interesse (quadrante)
- _Artefato:_ Plano de comunicação (tabela)

### DOC-00-005 | `docs/00-project/roadmap.md` | 📋 [P1]
**Roadmap do Projeto**
- Seção 6.1 — Fase 0: Fundação Documental
- Seção 6.2 — Fase 1: MVP — Módulos核 (core)
- Seção 6.3 — Fase 2: Expansão de Módulos
- Seção 6.4 — Fase 3: Inteligência e Automação
- Seção 6.5 — Fase 4: Otimização e Escala
- Seção 6.6 — Dependências entre fases
- Seção 6.7 — Marcos (milestones) e critérios de conclusão de fase
- _Artefato:_ Gantt de alto nível (diagrama)
- _Artefato:_ Mapa de dependências entre fases

---

## CAPÍTULO 2 — Glossário e Linguagem Oficial

> Define os termos que toda a equipe usará com o mesmo significado.
> Elimina ambiguidade entre negócio e tecnologia.

### DOC-00-006 | `docs/00-project/glossary.md` | 📋 [P1]
**Glossário Oficial do Projeto**
- Seção 6.1 — Termos de negócio gerais
- Seção 6.2 — Termos técnicos do SOE
- Seção 6.3 — Acrônimos e abreviações
- Seção 6.4 — Termos proibidos (evitar ambiguidade)
- Seção 6.5 — Mapeamento negócio → técnico
- _Artefato:_ Glossário exportável (JSON para uso em ferramentas)

### DOC-00-007 | `docs/03-domain/ubiquitous-language.md` | 📋 [P1]
**Linguagem Ubíqua do Domínio**
- Seção 6.1 — Linguagem do contexto CRM
- Seção 6.2 — Linguagem do contexto Financeiro
- Seção 6.3 — Linguagem do contexto Operações
- Seção 6.4 — Linguagem do contexto RH
- Seção 6.5 — Linguagem do contexto Comercial
- Seção 6.6 — Linguagem do contexto Compras
- Seção 6.7 — Linguagem do contexto Jurídico
- Seção 6.8 — Regras de evolução da linguagem ubíqua
- _Artefato:_ Dicionário por contexto (tabelas)

---

# ══════════════════════════════════════════════════════
# VOLUME II — GOVERNANÇA DO PROJETO
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define como o projeto é administrado —
# processos, papéis, padrões editoriais e o sistema de governança
# da base de conhecimento. Este volume é operacional: define as
# regras do jogo para toda a equipe.
#
# Audiência primária: Toda a equipe
# Ordem de leitura: Capítulos 4 → 5 → 6 → 7

---

## CAPÍTULO 3 — Governança Organizacional

### DOC-GOV-013 | `docs/01-governance/roles-and-responsibilities.md` | 📋 [P1]
**Papéis e Responsabilidades (RACI)**
- Seção 6.1 — Estrutura organizacional do projeto
- Seção 6.2 — Descrição de cada papel
- Seção 6.3 — Matriz RACI por processo
- Seção 6.4 — Matriz RACI por área de documento
- Seção 6.5 — Processo de onboarding de novos membros
- Seção 6.6 — Processo de offboarding e transferência de responsabilidades
- _Artefato:_ Organograma do projeto
- _Artefato:_ Matriz RACI completa (planilha)

### DOC-GOV-014 | `docs/01-governance/editorial-process.md` | 📋 [P1]
**Processo Editorial**
- Seção 6.1 — Ciclo de vida de um documento (diagrama de estados)
- Seção 6.2 — Como propor um novo documento
- Seção 6.3 — Como redigir (ferramentas, ambiente, branch naming)
- Seção 6.4 — Como submeter para revisão (PR)
- Seção 6.5 — Como revisar (o que verificar, como comentar)
- Seção 6.6 — Como aprovar e publicar
- Seção 6.7 — Como deprecar e arquivar
- Seção 6.8 — SLAs de cada etapa
- _Artefato:_ Fluxograma do processo editorial
- _Artefato:_ Checklist de submissão (PDF)

### DOC-GOV-015 | `docs/01-governance/meeting-notes/` | 📋 [P3]
**Atas de Reunião** _(diretório — cada ata é um documento separado)_
- _Formato:_ `ATA-AAAA-NNN | AAAA-MM-DD-assunto.md`
- _Seções padrão:_ Participantes, Pauta, Discussões, Decisões, Ações
- _Artefato:_ Índice de atas por período (gerado automaticamente)

---

## CAPÍTULO 4 — Governança Documental

> Os documentos DOC-GOV-002 a DOC-GOV-012 compõem o sistema de governança
> documental já criado. Listados aqui para completude do índice.

| ID | Documento | Status |
|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | ✅ |
| DOC-GOV-003 | Modelo de Versionamento (DocSemVer) | ✅ |
| DOC-GOV-004 | Sistema de Identificação de Documentos | ✅ |
| DOC-GOV-005 | Categorias de Documentos | ✅ |
| DOC-GOV-006 | Regras de Atualização | ✅ |
| DOC-GOV-007 | Regras de Aprovação | ✅ |
| DOC-GOV-008 | Regras de Revisão | ✅ |
| DOC-GOV-009 | Regras de Arquivamento | ✅ |
| DOC-GOV-010 | Regras de Obsolescência | ✅ |
| DOC-GOV-011 | Política de Rastreabilidade | ✅ |
| DOC-GOV-012 | Sistema de Relacionamento entre Documentos | ✅ |

---

## CAPÍTULO 5 — Padrões e Convenções

| ID | Documento | Status |
|---|---|---|
| DOC-GOV-001 | DOCUMENTATION_GUIDE | ✅ |
| ADR-0001 | Template Oficial de Documentação | ✅ |
| DOC-GOV-016 | Naming Conventions | 📋 [P1] |
| DOC-GOV-017 | Versioning Policy | 📋 [P1] |
| DOC-GOV-018 | Review Policy | 📋 [P1] |
| TPL-DOC-001 | TEMPLATE-OFICIAL | ✅ |
| TPL-DOC-002 | Template de ADR | ✅ |
| TPL-DOC-003 | Template de Módulo | ✅ |
| TPL-DOC-004 | Template de Requisito Funcional | ✅ |
| TPL-DOC-005 | Template de Contrato de Integração | ✅ |
| TPL-DOC-006 | Template de Agente de IA | ✅ |
| TPL-DOC-007 | Template de Workflow | ✅ |
| TPL-DOC-008 | Template de Ata de Reunião | ✅ |
| TPL-DOC-009 | Template de Relatório de Incidente | ✅ |

---

# ══════════════════════════════════════════════════════
# VOLUME III — ARQUITETURA EMPRESARIAL
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define como o sistema é estruturado.
# Contém as decisões arquiteturais fundamentais, os princípios que
# guiam toda implementação e as visões que permitem entender o
# sistema em diferentes perspectivas.
#
# Audiência primária: Arquiteto Líder, Engenheiros Sênior
# Ordem de leitura: Capítulos 6 → 7 → 8 → 9

---

## CAPÍTULO 6 — Princípios e Fundamentos Arquiteturais

### ARC-SYS-001 | `SYSTEM.md` | 📋 [P1]
**Visão de Sistema**
- Seção 6.1 — O SOE em uma frase
- Seção 6.2 — Componentes principais e suas responsabilidades
- Seção 6.3 — Como o SOE se posiciona no ecossistema tecnológico da MM
- Seção 6.4 — O que o SOE não é
- Seção 6.5 — Decisões fundamentais de design
- _Artefato:_ Diagrama de sistema de alto nível

### ARC-SYS-002 | `docs/02-architecture/principles.md` | 📋 [P1]
**Princípios de Engenharia (ENGINEERING_PRINCIPLES)**
- Seção 6.1 — Princípios de produto
- Seção 6.2 — Princípios de arquitetura
- Seção 6.3 — Princípios de dados
- Seção 6.4 — Princípios de segurança
- Seção 6.5 — Princípios de operações
- Seção 6.6 — Princípios de qualidade
- Seção 6.7 — Como os princípios são aplicados na prática
- Seção 6.8 — Processo de exceção a um princípio
- _Artefato:_ Pôster de princípios (PDF para distribuição)

### ARC-SYS-003 | `docs/02-architecture/constraints.md` | 📋 [P1]
**Restrições Arquiteturais**
- Seção 6.1 — Restrições tecnológicas (stacks proibidas / obrigatórias)
- Seção 6.2 — Restrições orçamentárias
- Seção 6.3 — Restrições legais e regulatórias
- Seção 6.4 — Restrições operacionais
- Seção 6.5 — Restrições de segurança
- Seção 6.6 — Restrições de time e prazo
- _Artefato:_ Tabela de restrições com fonte e impacto

### ARC-SYS-004 | `docs/02-architecture/overview.md` | 📋 [P1]
**Visão Arquitetural Executiva**
- Seção 6.1 — Estilo arquitetural adotado e justificativa
- Seção 6.2 — Grandes componentes e responsabilidades
- Seção 6.3 — Estratégia de comunicação entre componentes
- Seção 6.4 — Estratégia de persistência
- Seção 6.5 — Estratégia de identidade e acesso
- Seção 6.6 — Estratégia de observabilidade
- Seção 6.7 — Pontos de extensão planejados
- _Artefato:_ Diagrama de arquitetura executivo (1 página)

### ARC-SYS-005 | `docs/02-architecture/patterns.md` | 📋 [P2]
**Catálogo de Padrões Arquiteturais**
- Seção 6.1 — Padrões de integração
- Seção 6.2 — Padrões de dados
- Seção 6.3 — Padrões de resiliência
- Seção 6.4 — Padrões de segurança
- Seção 6.5 — Padrões de UI/UX
- Seção 6.6 — Anti-padrões identificados e proibidos
- _Artefato:_ Catálogo de padrões com exemplos de aplicação

---

## CAPÍTULO 7 — Decisões Arquiteturais (ADRs)

> Cada ADR é um documento imutável que registra uma decisão arquitetural.
> Listados em ordem cronológica. Novos ADRs são adicionados ao final.

| ID | Título | Status | Data |
|---|---|---|---|
| ADR-0001 | Template Oficial de Documentação Técnica | ✅ | 2026-06-28 |
| ADR-0002 | Estilo Arquitetural do SOE | ⏳ [P1] | — |
| ADR-0003 | Estratégia de Banco de Dados | ⏳ [P1] | — |
| ADR-0004 | Estratégia de Autenticação e Autorização | ⏳ [P1] | — |
| ADR-0005 | Estratégia de Comunicação entre Serviços | ⏳ [P1] | — |
| ADR-0006 | Estratégia de Observabilidade | ⏳ [P2] | — |
| ADR-0007 | Estratégia de Deploy e CI/CD | ⏳ [P2] | — |
| ADR-0008 | Estratégia de Cache | ⏳ [P2] | — |
| ADR-0009 | Estratégia de Tratamento de Erros | ⏳ [P2] | — |
| ADR-0010 | Estratégia de Versionamento de API | ⏳ [P2] | — |
| ADR-0011 | Escolha de Provedor Cloud | ⏳ [P1] | — |
| ADR-0012 | Estratégia de Testes | ⏳ [P2] | — |
| ADR-0013 | Framework de Frontend | ⏳ [P2] | — |
| ADR-0014 | Estratégia de Internacionalização (i18n) | ⏳ [P3] | — |
| ADR-XXXX | _(ADRs futuros — sequencial contínuo)_ | ⏳ | — |

---

## CAPÍTULO 8 — Visões Arquiteturais (Modelo C4)

### Nível 1 — Contexto do Sistema

| ID | Artefato | Status |
|---|---|---|
| ARC-C4-001 | Diagrama de Contexto — SOE e atores externos | ⏳ [P1] |
| ARC-C4-002 | Narrativa do Diagrama de Contexto | ⏳ [P1] |

### Nível 2 — Containers

| ID | Artefato | Status |
|---|---|---|
| ARC-C4-003 | Diagrama de Containers — aplicações e serviços | ⏳ [P1] |
| ARC-C4-004 | Narrativa: Web Application | ⏳ [P2] |
| ARC-C4-005 | Narrativa: API Gateway | ⏳ [P2] |
| ARC-C4-006 | Narrativa: Serviços de Backend por módulo | ⏳ [P2] |
| ARC-C4-007 | Narrativa: Message Broker | ⏳ [P2] |
| ARC-C4-008 | Narrativa: Bancos de Dados | ⏳ [P2] |
| ARC-C4-009 | Narrativa: Storage e CDN | ⏳ [P3] |

### Nível 3 — Componentes

| ID | Artefato | Status |
|---|---|---|
| ARC-C4-010 | Diagrama de Componentes — CRM | ⏳ [P4] |
| ARC-C4-011 | Diagrama de Componentes — Financeiro | ⏳ [P4] |
| ARC-C4-012 | Diagrama de Componentes — Operações | ⏳ [P4] |
| ARC-C4-0XX | _(um diagrama por módulo)_ | ⏳ [P4] |

### Visões Transversais

| ID | Documento | Status |
|---|---|---|
| ARC-VIS-001 | `docs/02-architecture/views/deployment-view.md` | 📋 [P2] |
| ARC-VIS-002 | `docs/02-architecture/views/data-flow-view.md` | 📋 [P2] |
| ARC-VIS-003 | `docs/02-architecture/views/security-view.md` | 📋 [P1] |
| ARC-VIS-004 | Visão de Runtime — fluxos em tempo de execução | ⏳ [P3] |
| ARC-VIS-005 | Visão de Evolução — como a arquitetura cresce | ⏳ [P3] |

---

## CAPÍTULO 9 — Modelagem de Domínio

### DOM-SYS-001 | `docs/03-domain/bounded-contexts.md` | 📋 [P1]
**Bounded Contexts do SOE**
- Seção 6.1 — Contexto: Relacionamento com Cliente (CRM)
- Seção 6.2 — Contexto: Comercial
- Seção 6.3 — Contexto: Financeiro
- Seção 6.4 — Contexto: Operações
- Seção 6.5 — Contexto: Recursos Humanos
- Seção 6.6 — Contexto: Compras
- Seção 6.7 — Contexto: Jurídico
- Seção 6.8 — Contexto: Inteligência de Negócio
- Seção 6.9 — Contexto: Administração da Plataforma
- Seção 6.10 — Contexto: Notificações
- Seção 6.11 — Modelos compartilhados entre contextos
- _Artefato:_ Mapa de bounded contexts (diagrama)

### DOM-SYS-002 | `docs/03-domain/context-map.md` | 📋 [P1]
**Mapa de Contextos**
- Seção 6.1 — Relações entre contextos (Anti-Corruption Layer)
- Seção 6.2 — Relações Shared Kernel
- Seção 6.3 — Relações Customer/Supplier
- Seção 6.4 — Relações Conformist
- Seção 6.5 — Open Host Services identificados
- _Artefato:_ Diagrama de mapa de contextos

### DOM-SYS-003 | `docs/03-domain/domain-events.md` | 📋 [P2]
**Catálogo de Eventos de Domínio**
- Seção 6.1 — Eventos do contexto CRM
- Seção 6.2 — Eventos do contexto Comercial
- Seção 6.3 — Eventos do contexto Financeiro
- Seção 6.4 — Eventos do contexto Operações
- Seção 6.5 — Eventos do contexto RH
- Seção 6.6 — Eventos do contexto Compras
- Seção 6.7 — Eventos do contexto Jurídico
- Seção 6.8 — Eventos transversais (cross-context)
- _Artefato:_ Event Storming Board (diagrama)
- _Artefato:_ Catálogo de eventos (tabela)

### DOM-SYS-004 até DOM-SYS-013 | `docs/03-domain/aggregates/` | ⏳ [P2]
**Agregados por Contexto** _(um documento por contexto)_
- `DOM-SYS-004` — Agregados do CRM
- `DOM-SYS-005` — Agregados do Comercial
- `DOM-SYS-006` — Agregados do Financeiro
- `DOM-SYS-007` — Agregados de Operações
- `DOM-SYS-008` — Agregados de RH
- `DOM-SYS-009` — Agregados de Compras
- `DOM-SYS-010` — Agregados do Jurídico
- `DOM-SYS-011` — Agregados de BI
- `DOM-SYS-012` — Agregados de Admin
- `DOM-SYS-013` — Agregados de Notificações

---

# ══════════════════════════════════════════════════════
# VOLUME IV — REQUISITOS DO SISTEMA
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define O QUE o sistema deve fazer e COMO
# deve se comportar. É a tradução da visão de negócio em
# especificação técnica verificável. Cada requisito aqui é
# rastreável até a visão e até os testes.
#
# Audiência primária: Analistas, Arquiteto, QA, Líderes de Módulo
# Ordem de leitura: Capítulo 10 → 11 → 12

---

## CAPÍTULO 10 — Requisitos Não-Funcionais

> Requisitos que se aplicam ao sistema como um todo — não a módulos específicos.

### RNF-SYS-001 | `docs/04-requirements/non-functional/performance.md` | 📋 [P1]
**Requisitos de Performance**
- Seção 6.1 — Tempos de resposta por tipo de operação
- Seção 6.2 — Throughput mínimo por serviço
- Seção 6.3 — Limites de latência (P50, P95, P99)
- Seção 6.4 — Performance em cenários de pico
- Seção 6.5 — Metas por módulo
- _Artefato:_ Tabela de SLAs de performance

### RNF-SYS-002 | `docs/04-requirements/non-functional/availability.md` | 📋 [P1]
**Requisitos de Disponibilidade**
- Seção 6.1 — SLA de uptime por ambiente
- Seção 6.2 — SLA por módulo (nem todos são iguais)
- Seção 6.3 — RTO e RPO por cenário
- Seção 6.4 — Janelas de manutenção
- Seção 6.5 — Comportamento em modo degradado
- _Artefato:_ Tabela de SLAs de disponibilidade

### RNF-SYS-003 | `docs/04-requirements/non-functional/scalability.md` | 📋 [P2]
**Requisitos de Escalabilidade**
- Seção 6.1 — Volume atual e projeção de crescimento
- Seção 6.2 — Estratégia de escalonamento horizontal
- Seção 6.3 — Estratégia de escalonamento vertical
- Seção 6.4 — Limites de capacidade planejados
- Seção 6.5 — Estratégia de multi-tenancy

### RNF-SYS-004 | `docs/04-requirements/non-functional/security.md` | 📋 [P1]
**Requisitos de Segurança**
- Seção 6.1 — Requisitos de autenticação
- Seção 6.2 — Requisitos de autorização
- Seção 6.3 — Requisitos de criptografia
- Seção 6.4 — Requisitos de proteção contra ataques (OWASP)
- Seção 6.5 — Requisitos de auditoria e rastreabilidade operacional
- _Artefato:_ Checklist OWASP Top 10

### RNF-SYS-005 | `docs/04-requirements/non-functional/usability.md` | 📋 [P2]
**Requisitos de Usabilidade**
- Seção 6.1 — Padrão WCAG alvo
- Seção 6.2 — Suporte a dispositivos e browsers
- Seção 6.3 — Requisitos de internacionalização
- Seção 6.4 — Requisitos de acessibilidade por módulo

### RNF-SYS-006 | `docs/04-requirements/non-functional/maintainability.md` | 📋 [P2]
**Requisitos de Manutenibilidade**
- Seção 6.1 — Cobertura mínima de testes por camada
- Seção 6.2 — Métricas de complexidade ciclomática máxima
- Seção 6.3 — Padrões de código obrigatórios
- Seção 6.4 — Processo de gestão de dívida técnica

### RNF-SYS-007 | `docs/04-requirements/non-functional/compliance.md` | 📋 [P1]
**Requisitos de Conformidade**
- Seção 6.1 — LGPD — obrigações mapeadas
- Seção 6.2 — Obrigações fiscais e tributárias
- Seção 6.3 — Obrigações trabalhistas (impacto em RH)
- Seção 6.4 — Certificações planejadas

---

## CAPÍTULO 11 — Requisitos Funcionais Transversais

> Requisitos que não pertencem a um único módulo.

| ID | Título | Status | Prioridade |
|---|---|---|---|
| RF-SYS-001 | Autenticação e Single Sign-On | ⏳ [P1] | crítica |
| RF-SYS-002 | Controle de Acesso Baseado em Papel (RBAC) | ⏳ [P1] | crítica |
| RF-SYS-003 | Auditoria de Ações do Usuário | ⏳ [P1] | crítica |
| RF-SYS-004 | Notificações Transversais | ⏳ [P2] | alta |
| RF-SYS-005 | Busca Global | ⏳ [P2] | média |
| RF-SYS-006 | Exportação de Dados | ⏳ [P2] | alta |
| RF-SYS-007 | Importação de Dados | ⏳ [P2] | alta |
| RF-SYS-008 | Multi-tenancy | ⏳ [P1] | crítica |
| RF-SYS-009 | Internacionalização (i18n) | ⏳ [P3] | média |
| RF-SYS-010 | Acessibilidade | ⏳ [P2] | alta |
| RF-SYS-011 | Preferências do Usuário | ⏳ [P3] | baixa |
| RF-SYS-012 | Log de Atividades | ⏳ [P1] | alta |

---

# ══════════════════════════════════════════════════════
# VOLUME V — ESPECIFICAÇÃO DE MÓDULOS
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Especificação completa e detalhada de cada
# módulo do SOE. Este é o volume mais extenso do projeto — cada
# módulo tem seu próprio capítulo com dezenas de documentos.
# É a fonte primária para implementação.
#
# Estrutura padrão de cada capítulo de módulo:
#   1. Visão geral do módulo
#   2. Atores e personas
#   3. Casos de uso (um documento por CDU complexo)
#   4. Regras de negócio
#   5. Entidades de dados
#   6. Fluxos de UI
#   7. Eventos produzidos e consumidos
#   8. Integrações do módulo
#   9. Questões em aberto
#
# Audiência primária: Líderes de Módulo, Engenheiros, QA, UX

---

## CAPÍTULO 12 — Módulo CRM (Gestão de Relacionamento com Cliente)

### Visão e Contexto do Módulo

| ID | Documento | Status |
|---|---|---|
| MOD-CRM-001 | `docs/05-modules/crm/overview.md` — Visão Geral do Módulo | 📋 [P2] |
| MOD-CRM-002 | `docs/05-modules/crm/actors.md` — Atores e Personas | 📋 [P2] |
| MOD-CRM-003 | `docs/05-modules/crm/open-questions.md` — Questões em Aberto | 📋 [P2] |

### Casos de Uso

| ID | Título | Status |
|---|---|---|
| CDU-CRM-001 | Cadastrar Cliente Pessoa Física | ⏳ [P2] |
| CDU-CRM-002 | Cadastrar Cliente Pessoa Jurídica | ⏳ [P2] |
| CDU-CRM-003 | Consultar Histórico de Relacionamento | ⏳ [P2] |
| CDU-CRM-004 | Registrar Interação com Cliente | ⏳ [P2] |
| CDU-CRM-005 | Segmentar Base de Clientes | ⏳ [P3] |
| CDU-CRM-006 | Gerenciar Pipeline de Oportunidades | ⏳ [P2] |
| CDU-CRM-007 | Registrar Reclamação / Ocorrência | ⏳ [P2] |
| CDU-CRM-008 | Exportar Base de Clientes | ⏳ [P3] |
| CDU-CRM-009 | Mesclar Clientes Duplicados | ⏳ [P3] |
| CDU-CRM-010 | Gerenciar Consentimentos LGPD | ⏳ [P2] |

### Regras de Negócio

| ID | Título | Status |
|---|---|---|
| RN-CRM-001 | Unicidade de CPF/CNPJ na base | ⏳ [P2] |
| RN-CRM-002 | Campos obrigatórios por tipo de cliente | ⏳ [P2] |
| RN-CRM-003 | Regras de privacidade e visibilidade de dados do cliente | ⏳ [P2] |
| RN-CRM-004 | Política de deduplicação de clientes | ⏳ [P3] |
| RN-CRM-005 | Critérios de segmentação de clientes | ⏳ [P3] |
| RN-CRM-006 | Regras de ciclo de vida do cliente (ativo, inativo, bloqueado) | ⏳ [P2] |
| RN-CRM-007 | Regras de consentimento LGPD | ⏳ [P2] |

### Especificação de Dados

| ID | Documento | Status |
|---|---|---|
| DAT-CRM-001 | `docs/05-modules/crm/data-entities.md` — Entidades de Dados | 📋 [P2] |
| ESQ-CRM-001 | Schema JSON — Cliente PF | ⏳ [P3] |
| ESQ-CRM-002 | Schema JSON — Cliente PJ | ⏳ [P3] |
| ESQ-CRM-003 | Schema JSON — Interação | ⏳ [P3] |

### Fluxos de UI

| ID | Documento | Status |
|---|---|---|
| UXD-CRM-001 | `docs/05-modules/crm/ui-flows.md` — Mapa de Telas | 📋 [P3] |
| JOR-CRM-001 | Jornada — Cadastro de Novo Cliente | ⏳ [P3] |
| JOR-CRM-002 | Jornada — Consulta de Histórico | ⏳ [P3] |

### Eventos e Integrações

| ID | Documento | Status |
|---|---|---|
| EVT-CRM-001 | `docs/05-modules/crm/events.md` — Catálogo de Eventos | 📋 [P2] |
| MOD-CRM-004 | `docs/05-modules/crm/integrations.md` — Integrações | 📋 [P2] |

---

## CAPÍTULO 13 — Módulo Comercial

| ID | Documento | Status |
|---|---|---|
| MOD-COM-001 | Visão Geral do Módulo Comercial | 📋 [P2] |
| MOD-COM-002 | Atores e Personas | 📋 [P2] |
| CDU-COM-001 | Criar Proposta Comercial | ⏳ [P2] |
| CDU-COM-002 | Gerenciar Funil de Vendas | ⏳ [P2] |
| CDU-COM-003 | Aprovar Desconto | ⏳ [P2] |
| CDU-COM-004 | Converter Proposta em Contrato | ⏳ [P2] |
| CDU-COM-005 | Gerenciar Metas de Vendas | ⏳ [P3] |
| CDU-COM-006 | Comissionar Vendedores | ⏳ [P3] |
| CDU-COM-007 | Renovar Contrato | ⏳ [P3] |
| RN-COM-001 | Regras de desconto por perfil de cliente | ⏳ [P2] |
| RN-COM-002 | Regras de aprovação de proposta por valor | ⏳ [P2] |
| RN-COM-003 | Regras de comissionamento | ⏳ [P3] |
| RN-COM-004 | Regras de vigência de proposta | ⏳ [P2] |
| DAT-COM-001 | Entidades de Dados — Comercial | 📋 [P2] |
| EVT-COM-001 | Catálogo de Eventos — Comercial | 📋 [P2] |

---

## CAPÍTULO 14 — Módulo Financeiro

| ID | Documento | Status |
|---|---|---|
| MOD-FIN-001 | Visão Geral do Módulo Financeiro | 📋 [P2] |
| MOD-FIN-002 | Atores e Personas | 📋 [P2] |
| CDU-FIN-001 | Registrar Conta a Receber | ⏳ [P2] |
| CDU-FIN-002 | Registrar Conta a Pagar | ⏳ [P2] |
| CDU-FIN-003 | Conciliar Extrato Bancário | ⏳ [P2] |
| CDU-FIN-004 | Gerar DRE | ⏳ [P2] |
| CDU-FIN-005 | Gerar Fluxo de Caixa | ⏳ [P2] |
| CDU-FIN-006 | Emitir Nota Fiscal | ⏳ [P2] |
| CDU-FIN-007 | Gerenciar Centro de Custo | ⏳ [P3] |
| CDU-FIN-008 | Aprovar Pagamento | ⏳ [P2] |
| CDU-FIN-009 | Gerenciar Orçamento | ⏳ [P3] |
| CDU-FIN-010 | Gerar Relatórios Gerenciais | ⏳ [P3] |
| RN-FIN-001 | Regras de aprovação de pagamento por alçada | ⏳ [P2] |
| RN-FIN-002 | Regras de conciliação bancária | ⏳ [P2] |
| RN-FIN-003 | Regras de competência vs. caixa | ⏳ [P2] |
| RN-FIN-004 | Regras de impostos por tipo de operação | ⏳ [P2] |
| RN-FIN-005 | Regras de bloqueio por inadimplência | ⏳ [P3] |
| RN-FIN-006 | Regras de fechamento de período | ⏳ [P2] |
| DAT-FIN-001 | Entidades de Dados — Financeiro | 📋 [P2] |
| EVT-FIN-001 | Catálogo de Eventos — Financeiro | 📋 [P2] |

---

## CAPÍTULO 15 — Módulo de Operações

| ID | Documento | Status |
|---|---|---|
| MOD-OPS-001 | Visão Geral do Módulo de Operações | 📋 [P2] |
| MOD-OPS-002 | Atores e Personas | 📋 [P2] |
| CDU-OPS-001 | Criar Ordem de Serviço | ⏳ [P2] |
| CDU-OPS-002 | Alocar Recursos à OS | ⏳ [P2] |
| CDU-OPS-003 | Registrar Execução de OS | ⏳ [P2] |
| CDU-OPS-004 | Encerrar Ordem de Serviço | ⏳ [P2] |
| CDU-OPS-005 | Gerenciar Agenda de Execução | ⏳ [P3] |
| CDU-OPS-006 | Registrar Checklist de Qualidade | ⏳ [P3] |
| CDU-OPS-007 | Gerenciar Reclamação Operacional | ⏳ [P3] |
| RN-OPS-001 | Regras de criação e priorização de OS | ⏳ [P2] |
| RN-OPS-002 | Regras de alocação de recursos | ⏳ [P2] |
| RN-OPS-003 | Regras de SLA de atendimento | ⏳ [P2] |
| DAT-OPS-001 | Entidades de Dados — Operações | 📋 [P2] |
| EVT-OPS-001 | Catálogo de Eventos — Operações | 📋 [P2] |

---

## CAPÍTULO 16 — Módulo de Recursos Humanos

| ID | Documento | Status |
|---|---|---|
| MOD-HRH-001 | Visão Geral do Módulo RH | 📋 [P2] |
| MOD-HRH-002 | Atores e Personas | 📋 [P2] |
| CDU-HRH-001 | Cadastrar Colaborador | ⏳ [P3] |
| CDU-HRH-002 | Gerenciar Jornada de Trabalho | ⏳ [P3] |
| CDU-HRH-003 | Processar Folha de Pagamento | ⏳ [P3] |
| CDU-HRH-004 | Registrar Ponto | ⏳ [P3] |
| CDU-HRH-005 | Gerenciar Férias e Afastamentos | ⏳ [P3] |
| CDU-HRH-006 | Gestão de Desempenho | ⏳ [P4] |
| CDU-HRH-007 | Processo Admissional | ⏳ [P3] |
| CDU-HRH-008 | Processo Demissional | ⏳ [P3] |
| RN-HRH-001 | Regras CLT aplicáveis | ⏳ [P3] |
| RN-HRH-002 | Regras de cálculo de férias | ⏳ [P3] |
| RN-HRH-003 | Regras de hora extra e banco de horas | ⏳ [P3] |
| RN-HRH-004 | Regras de benefícios | ⏳ [P4] |
| DAT-HRH-001 | Entidades de Dados — RH | 📋 [P3] |
| EVT-HRH-001 | Catálogo de Eventos — RH | 📋 [P3] |

---

## CAPÍTULO 17 — Módulo de Compras (Procurement)

| ID | Documento | Status |
|---|---|---|
| MOD-PRO-001 | Visão Geral do Módulo de Compras | 📋 [P3] |
| MOD-PRO-002 | Atores e Personas | 📋 [P3] |
| CDU-PRO-001 | Cadastrar Fornecedor | ⏳ [P3] |
| CDU-PRO-002 | Criar Solicitação de Compra | ⏳ [P3] |
| CDU-PRO-003 | Aprovar Compra | ⏳ [P3] |
| CDU-PRO-004 | Emitir Pedido de Compra | ⏳ [P3] |
| CDU-PRO-005 | Receber Mercadoria / Serviço | ⏳ [P3] |
| CDU-PRO-006 | Avaliar Fornecedor | ⏳ [P4] |
| RN-PRO-001 | Regras de alçada de aprovação de compras | ⏳ [P3] |
| RN-PRO-002 | Regras de homologação de fornecedores | ⏳ [P3] |
| DAT-PRO-001 | Entidades de Dados — Compras | 📋 [P3] |

---

## CAPÍTULO 18 — Módulo Jurídico

| ID | Documento | Status |
|---|---|---|
| MOD-LEG-001 | Visão Geral do Módulo Jurídico | 📋 [P3] |
| MOD-LEG-002 | Atores e Personas | 📋 [P3] |
| CDU-LEG-001 | Gerenciar Contratos | ⏳ [P3] |
| CDU-LEG-002 | Controlar Prazos Processuais | ⏳ [P3] |
| CDU-LEG-003 | Gerenciar Procurações | ⏳ [P4] |
| CDU-LEG-004 | Registrar Parecer Jurídico | ⏳ [P4] |
| CDU-LEG-005 | Gestão de Riscos Jurídicos | ⏳ [P4] |
| RN-LEG-001 | Regras de vigência de contratos | ⏳ [P3] |
| RN-LEG-002 | Regras de controle de prazos legais | ⏳ [P3] |
| DAT-LEG-001 | Entidades de Dados — Jurídico | 📋 [P3] |

---

## CAPÍTULO 19 — Módulo BI (Business Intelligence)

| ID | Documento | Status |
|---|---|---|
| MOD-BIR-001 | Visão Geral do Módulo BI | 📋 [P3] |
| MOD-BIR-002 | Atores e Personas | 📋 [P3] |
| CDU-BIR-001 | Visualizar Dashboard Executivo | ⏳ [P3] |
| CDU-BIR-002 | Criar Relatório Customizado | ⏳ [P4] |
| CDU-BIR-003 | Exportar Dados para Análise | ⏳ [P3] |
| CDU-BIR-004 | Configurar Alerta de Indicador | ⏳ [P4] |
| RN-BIR-001 | Regras de KPIs obrigatórios por área | ⏳ [P3] |
| RN-BIR-002 | Regras de atualização de dados no BI | ⏳ [P3] |
| DAT-BIR-001 | Modelo de Dados Analíticos (Data Mart) | ⏳ [P3] |

---

## CAPÍTULO 20 — Módulo Admin (Administração da Plataforma)

| ID | Documento | Status |
|---|---|---|
| MOD-ADM-001 | Visão Geral do Módulo Admin | 📋 [P2] |
| MOD-ADM-002 | Atores e Personas | 📋 [P2] |
| CDU-ADM-001 | Gerenciar Usuários | ⏳ [P1] |
| CDU-ADM-002 | Gerenciar Papéis e Permissões | ⏳ [P1] |
| CDU-ADM-003 | Gerenciar Tenants (multi-tenancy) | ⏳ [P1] |
| CDU-ADM-004 | Configurar Módulos por Tenant | ⏳ [P2] |
| CDU-ADM-005 | Gerenciar Consentimentos LGPD | ⏳ [P2] |
| CDU-ADM-006 | Visualizar Logs de Auditoria | ⏳ [P2] |
| CDU-ADM-007 | Gerenciar Integrações | ⏳ [P3] |
| CDU-ADM-008 | Configurar Notificações | ⏳ [P3] |
| RN-ADM-001 | Regras de criação e bloqueio de usuários | ⏳ [P1] |
| RN-ADM-002 | Regras de herança de permissões | ⏳ [P1] |
| RN-ADM-003 | Regras de isolamento de tenant | ⏳ [P1] |
| DAT-ADM-001 | Entidades de Dados — Admin | 📋 [P1] |
| EVT-ADM-001 | Catálogo de Eventos — Admin | 📋 [P2] |

---

## CAPÍTULO 21 — Módulo de Notificações

| ID | Documento | Status |
|---|---|---|
| MOD-NOT-001 | Visão Geral do Módulo de Notificações | 📋 [P2] |
| MOD-NOT-002 | Atores e Personas | 📋 [P2] |
| CDU-NOT-001 | Enviar Notificação In-App | ⏳ [P2] |
| CDU-NOT-002 | Enviar E-mail Transacional | ⏳ [P2] |
| CDU-NOT-003 | Enviar SMS / WhatsApp | ⏳ [P3] |
| CDU-NOT-004 | Gerenciar Preferências de Notificação | ⏳ [P3] |
| CDU-NOT-005 | Gerenciar Templates de Notificação | ⏳ [P3] |
| CDU-NOT-006 | Visualizar Histórico de Notificações | ⏳ [P3] |
| RN-NOT-001 | Regras de prioridade de canal | ⏳ [P2] |
| RN-NOT-002 | Regras de horário de envio | ⏳ [P3] |
| RN-NOT-003 | Regras de opt-out | ⏳ [P2] |
| DAT-NOT-001 | Entidades de Dados — Notificações | 📋 [P2] |
| EVT-NOT-001 | Catálogo de Eventos — Notificações | 📋 [P2] |

---

# ══════════════════════════════════════════════════════
# VOLUME VI — ARQUITETURA DE DADOS
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define como os dados do SOE são modelados,
# governados, protegidos e mantidos. Dados são tratados como
# ativo estratégico. Toda decisão de dados tem rastreabilidade
# até um requisito de negócio.

---

## CAPÍTULO 22 — Modelo de Dados

### DAT-SYS-001 | `docs/06-data/data-model-overview.md` | 📋 [P2]
**Visão Geral do Modelo de Dados**
- Seção 6.1 — Estratégia de persistência (SQL, NoSQL, Cache, Blob)
- Seção 6.2 — Diagrama entidade-relacionamento de alto nível
- Seção 6.3 — Entidades-chave e seus domínios
- Seção 6.4 — Estratégia de identificadores (UUID, sequencial, composto)
- Seção 6.5 — Política de soft delete vs. hard delete
- Seção 6.6 — Estratégia de auditoria de dados (created_at, updated_by)
- _Artefato:_ Diagrama ER de alto nível
- _Artefato:_ Diagrama de particionamento por domínio

### DAT-SYS-002 | `docs/06-data/data-dictionary.md` | 📋 [P2]
**Dicionário de Dados**
- Seção 6.1 — Entidade: Cliente
- Seção 6.2 — Entidade: Contrato
- Seção 6.3 — Entidade: Ordem de Serviço
- Seção 6.4 — Entidade: Transação Financeira
- Seção 6.5 — Entidade: Colaborador
- Seção 6.6 — Entidade: Fornecedor
- Seção 6.7 — Entidade: Usuário do Sistema
- Seção 6.8 — Entidade: Tenant
- Seção 6.9 — _(continua por entidade)_
- _Artefato:_ Dicionário exportável (JSON, CSV)

### Schemas de Dados por Módulo

| ID | Documento | Status |
|---|---|---|
| ESQ-SYS-001 | Schema de Banco — CRM | ⏳ [P3] |
| ESQ-SYS-002 | Schema de Banco — Financeiro | ⏳ [P3] |
| ESQ-SYS-003 | Schema de Banco — Operações | ⏳ [P3] |
| ESQ-SYS-004 | Schema de Banco — RH | ⏳ [P3] |
| ESQ-SYS-005 | Schema de Banco — Admin | ⏳ [P3] |
| ESQ-SYS-006 | Schema de Banco Analítico (BI) | ⏳ [P4] |
| MIG-SYS-001 | Política de Migrações de Banco de Dados | ⏳ [P2] |

---

## CAPÍTULO 23 — Governança de Dados

### DAT-SYS-003 | `docs/06-data/data-governance.md` | 📋 [P2]
**Política de Governança de Dados**
- Seção 6.1 — Princípios de governança de dados
- Seção 6.2 — Proprietários de dados por domínio
- Seção 6.3 — Critérios de qualidade de dados
- Seção 6.4 — Processo de catalogação de novos dados
- Seção 6.5 — Gestão de dados mestres (MDM)
- Seção 6.6 — Política de acesso a dados por papel

### DAT-SYS-004 | `docs/06-data/data-lifecycle.md` | 📋 [P2]
**Ciclo de Vida dos Dados**
- Seção 6.1 — Categorias de dados e seus ciclos
- Seção 6.2 — Política de retenção por categoria
- Seção 6.3 — Processo de arquivamento de dados históricos
- Seção 6.4 — Processo de expurgo
- Seção 6.5 — Estratégia de backup e recovery

---

## CAPÍTULO 24 — Privacidade e LGPD

| ID | Documento | Status |
|---|---|---|
| PRI-MAP-001 | `docs/06-data/lgpd/data-mapping.md` — ROPA (Registro de Tratamento) | 📋 [P1] |
| PRI-CNS-001 | `docs/06-data/lgpd/consent-flows.md` — Fluxos de Consentimento | 📋 [P1] |
| PRI-RET-001 | `docs/06-data/lgpd/retention-policy.md` — Política de Retenção LGPD | 📋 [P1] |
| CPL-LGPD-001 | Mapeamento de Direitos do Titular | ⏳ [P2] |
| CPL-LGPD-002 | Processo de Atendimento a Requisições LGPD (DSAR) | ⏳ [P2] |
| CPL-LGPD-003 | Plano de Notificação à ANPD em caso de incidente | ⏳ [P2] |
| CPL-LGPD-004 | Avaliação de Impacto à Proteção de Dados (AIPD) | ⏳ [P2] |

---

# ══════════════════════════════════════════════════════
# VOLUME VII — INTEGRAÇÕES E CONTRATOS DE API
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define como o SOE se comunica com o mundo
# externo e como seus módulos se comunicam internamente.
# Contratos são definidos antes da implementação — API-first.

---

## CAPÍTULO 25 — Integrações Internas

### INT-SYS-001 | `docs/07-integrations/overview.md` | 📋 [P2]
**Mapa de Integrações**
- Seção 6.1 — Mapa de integrações internas (módulo a módulo)
- Seção 6.2 — Mapa de integrações externas
- Seção 6.3 — Protocolos de comunicação utilizados
- Seção 6.4 — Estratégia de tratamento de falhas em integrações
- _Artefato:_ Diagrama de integrações (completo)

### Contratos de Integração Interna por Par de Módulos

| ID | Integração | Status |
|---|---|---|
| INT-INT-001 | CRM → Comercial (sincronização de clientes) | ⏳ [P3] |
| INT-INT-002 | Comercial → Financeiro (faturamento) | ⏳ [P3] |
| INT-INT-003 | Comercial → Operações (abertura de OS) | ⏳ [P3] |
| INT-INT-004 | Financeiro → Notificações (alertas de vencimento) | ⏳ [P3] |
| INT-INT-005 | Operações → CRM (atualização de histórico) | ⏳ [P3] |
| INT-INT-006 | Compras → Financeiro (contas a pagar) | ⏳ [P3] |
| INT-INT-007 | RH → Financeiro (folha de pagamento) | ⏳ [P3] |
| INT-INT-008 | Admin → todos os módulos (RBAC) | ⏳ [P2] |
| INT-INT-009 | BI → todos os módulos (leitura analítica) | ⏳ [P3] |

---

## CAPÍTULO 26 — Integrações Externas

| ID | Sistema Externo | Tipo | Status |
|---|---|---|---|
| INT-EXT-001 | Gateway de Pagamento | Financeiro | ⏳ [P3] |
| INT-EXT-002 | Emissor de NF-e / NFS-e | Fiscal | ⏳ [P3] |
| INT-EXT-003 | Banco(s) — Open Banking | Financeiro | ⏳ [P3] |
| INT-EXT-004 | Serviço de E-mail (SMTP / SaaS) | Notificações | ⏳ [P2] |
| INT-EXT-005 | Serviço de SMS | Notificações | ⏳ [P3] |
| INT-EXT-006 | WhatsApp Business API | Notificações | ⏳ [P3] |
| INT-EXT-007 | Receita Federal (CPF/CNPJ) | Compliance | ⏳ [P3] |
| INT-EXT-008 | eSocial | RH / Legal | ⏳ [P4] |
| INT-EXT-009 | Serviço de Assinatura Digital | Jurídico | ⏳ [P4] |
| INT-EXT-010 | ERPs parceiros (legado / clientes) | Dados | ⏳ [P4] |
| INT-EXT-011 | Provedor de Identidade (SSO externo) | Auth | ⏳ [P2] |
| INT-EXT-012 | Serviço de Storage (Cloud) | Infra | ⏳ [P2] |

---

## CAPÍTULO 27 — Contratos de API

### Design e Padrões

| ID | Documento | Status |
|---|---|---|
| DOC-API-001 | `docs/08-api/api-design-guide.md` — Guia de Design de API | 📋 [P1] |
| DOC-API-002 | `docs/08-api/authentication.md` — Autenticação de API | 📋 [P1] |
| DOC-API-003 | Guia de Tratamento de Erros | ⏳ [P2] |
| DOC-API-004 | Guia de Paginação e Filtros | ⏳ [P2] |
| DOC-API-005 | Guia de Versionamento de API | ⏳ [P2] |

### Contratos OpenAPI por Módulo

| ID | Arquivo | Status |
|---|---|---|
| API-CRM-001 | `specs/openapi/crm-api.yaml` | ⏳ [P3] |
| API-COM-001 | `specs/openapi/commercial-api.yaml` | ⏳ [P3] |
| API-FIN-001 | `specs/openapi/financial-api.yaml` | ⏳ [P3] |
| API-OPS-001 | `specs/openapi/operations-api.yaml` | ⏳ [P3] |
| API-HRH-001 | `specs/openapi/hr-api.yaml` | ⏳ [P4] |
| API-PRO-001 | `specs/openapi/procurement-api.yaml` | ⏳ [P4] |
| API-LEG-001 | `specs/openapi/legal-api.yaml` | ⏳ [P4] |
| API-BIR-001 | `specs/openapi/bi-api.yaml` | ⏳ [P4] |
| API-ADM-001 | `specs/openapi/admin-api.yaml` | ⏳ [P2] |
| API-NOT-001 | `specs/openapi/notifications-api.yaml` | ⏳ [P3] |

### Contratos AsyncAPI (Eventos)

| ID | Arquivo | Status |
|---|---|---|
| API-EVT-001 | `specs/asyncapi/crm-events.yaml` | ⏳ [P3] |
| API-EVT-002 | `specs/asyncapi/financial-events.yaml` | ⏳ [P3] |
| API-EVT-003 | `specs/asyncapi/operations-events.yaml` | ⏳ [P3] |
| API-EVT-004 | `specs/asyncapi/system-events.yaml` | ⏳ [P2] |

---

# ══════════════════════════════════════════════════════
# VOLUME VIII — SEGURANÇA DA INFORMAÇÃO
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Segurança como requisito de primeira classe.
# Define ameaças, controles, políticas e planos. Nenhum módulo
# é implementado sem os documentos de segurança relevantes aprovados.

---

## CAPÍTULO 28 — Políticas e Controles de Segurança

| ID | Documento | Status |
|---|---|---|
| SEC-POL-001 | `docs/09-security/security-policy.md` — Política Geral | 📋 [P1] |
| SEC-THR-001 | `docs/09-security/threat-model.md` — Modelo de Ameaças (STRIDE) | 📋 [P1] |
| SEC-ACC-001 | `docs/09-security/access-control.md` — Controle de Acesso RBAC | 📋 [P1] |
| SEC-ENC-001 | `docs/09-security/encryption.md` — Política de Criptografia | 📋 [P1] |
| SEC-AUD-001 | `docs/09-security/audit-logging.md` — Auditoria e Logs | 📋 [P1] |
| SEC-INC-001 | `docs/09-security/incident-response.md` — Resposta a Incidentes | 📋 [P1] |
| SEC-VUL-001 | Política de Gestão de Vulnerabilidades | ⏳ [P2] |
| SEC-PEN-001 | Plano de Pentest — Fase 1 | ⏳ [P3] |
| SEC-SDG-001 | Guia de Desenvolvimento Seguro (Secure Coding) | ⏳ [P2] |
| SEC-SCA-001 | Política de Análise de Composição de Software (SCA) | ⏳ [P2] |

---

## CAPÍTULO 29 — Conformidade e Auditoria

| ID | Documento | Status |
|---|---|---|
| CPL-REG-001 | `docs/15-compliance/regulatory-map.md` — Mapa Regulatório | 📋 [P1] |
| CPL-AUD-001 | `docs/15-compliance/audit-readiness.md` — Prontidão para Auditoria | 📋 [P2] |
| CPL-ISO-001 | Plano de Adequação ISO 27001 | ⏳ [P4] |
| CPL-SOC-001 | Plano de Adequação SOC 2 | ⏳ [P4] |

---

# ══════════════════════════════════════════════════════
# VOLUME IX — EXPERIÊNCIA DO USUÁRIO E DESIGN
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define a experiência que o SOE proporciona.
# O design é especificado antes da implementação.
# Cada tela tem uma especificação; cada componente tem um padrão.

---

## CAPÍTULO 30 — Design System e Fundamentos

| ID | Documento | Status |
|---|---|---|
| UXD-DES-001 | `docs/12-ux/design-principles.md` — Princípios de Design | 📋 [P2] |
| UXD-DES-002 | `docs/12-ux/design-system.md` — Design System | 📋 [P2] |
| UXD-DES-003 | `docs/12-ux/accessibility.md` — Acessibilidade | 📋 [P2] |
| UXD-DES-004 | Tokens de Design (cores, tipografia, espaçamento) | ⏳ [P3] |
| UXD-DES-005 | Catálogo de Componentes UI | ⏳ [P3] |
| UXD-DES-006 | Guia de Ícones e Ilustrações | ⏳ [P3] |
| UXD-DES-007 | Guia de Motion Design e Animações | ⏳ [P4] |

---

## CAPÍTULO 31 — Pesquisa de Usuário e Jornadas

| ID | Documento | Status |
|---|---|---|
| PER-001 | `docs/12-ux/personas.md` — Personas | 📋 [P2] |
| PER-002 | Persona: Gestor Comercial | ⏳ [P2] |
| PER-003 | Persona: Gestor Financeiro | ⏳ [P2] |
| PER-004 | Persona: Operador de Campo | ⏳ [P2] |
| PER-005 | Persona: Analista Administrativo | ⏳ [P2] |
| PER-006 | Persona: Diretor Executivo | ⏳ [P3] |
| JOR-SYS-001 | Jornada — Primeiro Acesso ao SOE | ⏳ [P2] |
| JOR-CRM-001 | Jornada — Atendimento ao Cliente | ⏳ [P3] |
| JOR-FIN-001 | Jornada — Fechamento Financeiro Mensal | ⏳ [P3] |
| JOR-OPS-001 | Jornada — Execução de Ordem de Serviço | ⏳ [P3] |

---

# ══════════════════════════════════════════════════════
# VOLUME X — INTELIGÊNCIA ARTIFICIAL E AUTOMAÇÕES
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define a camada de inteligência e automação
# do SOE. Agentes de IA e workflows são especificados antes de
# implementados. Toda IA tem governança documentada.

---

## CAPÍTULO 32 — Estratégia e Governança de IA

| ID | Documento | Status |
|---|---|---|
| DOC-STR-001 | `docs/13-ai-agents/ai-strategy.md` — Estratégia de IA | 📋 [P2] |
| DOC-GOV-019 | `docs/13-ai-agents/agent-governance.md` — Governança de Agentes | 📋 [P2] |
| DOC-STR-002 | `docs/13-ai-agents/agent-catalog.md` — Catálogo de Agentes | 📋 [P3] |

---

## CAPÍTULO 33 — Especificações de Agentes de IA

| ID | Agente | Módulo | Status |
|---|---|---|---|
| AGT-CRM-001 | Agente de Qualificação de Leads | CRM | ⏳ [P3] |
| AGT-CRM-002 | Agente de Análise de Sentimento de Clientes | CRM | ⏳ [P4] |
| AGT-COM-001 | Agente de Recomendação de Proposta | Comercial | ⏳ [P3] |
| AGT-FIN-001 | Agente de Previsão de Fluxo de Caixa | Financeiro | ⏳ [P3] |
| AGT-FIN-002 | Agente de Detecção de Anomalias Financeiras | Financeiro | ⏳ [P4] |
| AGT-OPS-001 | Agente de Otimização de Agenda | Operações | ⏳ [P3] |
| AGT-OPS-002 | Agente de Previsão de Demanda | Operações | ⏳ [P4] |
| AGT-BIR-001 | Agente de Geração de Insights de BI | BI | ⏳ [P4] |
| AGT-SYS-001 | Agente de Suporte ao Usuário (Copilot) | Transversal | ⏳ [P3] |
| AGT-SYS-002 | Agente de Detecção de Fraude | Transversal | ⏳ [P4] |

---

## CAPÍTULO 34 — Especificações de Automações e Workflows

| ID | Workflow | Módulo | Status |
|---|---|---|---|
| WFL-CRM-001 | Onboarding Automático de Novo Cliente | CRM | ⏳ [P3] |
| WFL-COM-001 | Aprovação Automática de Proposta por Valor | Comercial | ⏳ [P3] |
| WFL-COM-002 | Alerta de Oportunidade em Risco | Comercial | ⏳ [P3] |
| WFL-FIN-001 | Cobrança Automática de Inadimplentes | Financeiro | ⏳ [P3] |
| WFL-FIN-002 | Conciliação Bancária Automática | Financeiro | ⏳ [P3] |
| WFL-OPS-001 | Abertura Automática de OS a partir de Contrato | Operações | ⏳ [P3] |
| WFL-OPS-002 | Escalação de OS não atendida no SLA | Operações | ⏳ [P3] |
| WFL-HRH-001 | Processo Admissional Automático | RH | ⏳ [P4] |
| WFL-NOT-001 | Disparo de Notificações por Evento | Notificações | ⏳ [P2] |
| WFL-ADM-001 | Provisionamento de Novo Tenant | Admin | ⏳ [P2] |
| WFL-SYS-001 | Pipeline de Backup e Arquivamento | Sistema | ⏳ [P3] |
| WFL-SYS-002 | Rotina de Expurgo de Dados (LGPD) | Sistema | ⏳ [P3] |

---

# ══════════════════════════════════════════════════════
# VOLUME XI — INFRAESTRUTURA E PLATAFORMA
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define como o SOE é construído, implantado
# e operado. Inclui arquitetura cloud, ambientes, CI/CD, observabilidade
# e recuperação de desastres. Infraestrutura como código — tudo versionado.

---

## CAPÍTULO 35 — Ambientes e Arquitetura Cloud

| ID | Documento | Status |
|---|---|---|
| INF-ENV-001 | `docs/10-infrastructure/environments.md` — Definição de Ambientes | 📋 [P2] |
| INF-CLD-001 | `docs/10-infrastructure/cloud-architecture.md` — Arquitetura Cloud | 📋 [P2] |
| INF-NET-001 | `docs/10-infrastructure/networking.md` — Topologia de Rede | ⏳ [P2] |
| INF-DEP-001 | `docs/10-infrastructure/deployment-strategy.md` — Estratégia de Deploy | 📋 [P2] |
| INF-OBS-001 | `docs/10-infrastructure/observability.md` — Observabilidade | 📋 [P2] |
| INF-DRE-001 | `docs/10-infrastructure/disaster-recovery.md` — DR | 📋 [P2] |
| INF-SEC-001 | Configuração de Segurança de Infraestrutura | ⏳ [P2] |
| INF-CST-001 | Estratégia de Gestão de Custos Cloud | ⏳ [P3] |

---

## CAPÍTULO 36 — CI/CD e DevOps

| ID | Documento | Status |
|---|---|---|
| INF-CID-001 | Especificação do Pipeline de CI | ⏳ [P2] |
| INF-CID-002 | Especificação do Pipeline de CD | ⏳ [P2] |
| INF-CID-003 | Guia de Feature Flags | ⏳ [P3] |
| INF-CID-004 | Política de Ambientes Efêmeros | ⏳ [P3] |
| INF-CID-005 | Guia de Rollback e Rollforward | ⏳ [P3] |

---

## CAPÍTULO 37 — Runbooks Operacionais

| ID | Runbook | Status |
|---|---|---|
| RUN-OPS-001 | Deploy em Produção | ⏳ [P2] |
| RUN-OPS-002 | Rollback de Release | ⏳ [P2] |
| RUN-OPS-003 | Escalonamento de Infraestrutura | ⏳ [P3] |
| RUN-OPS-004 | Resposta a Alertas de Performance | ⏳ [P3] |
| RUN-OPS-005 | Backup e Restore de Banco de Dados | ⏳ [P3] |
| RUN-OPS-006 | Rotação de Segredos e Certificados | ⏳ [P3] |
| RUN-OPS-007 | Ativação do Plano de DR | ⏳ [P3] |
| RUN-OPS-008 | Resposta a Incidente de Segurança | ⏳ [P2] |
| RUN-OPS-009 | Onboarding de Novo Ambiente | ⏳ [P3] |
| RUN-OPS-010 | Procedimento de Expurgo de Dados LGPD | ⏳ [P3] |

---

# ══════════════════════════════════════════════════════
# VOLUME XII — QUALIDADE E TESTES
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Define como o SOE é verificado e validado.
# Qualidade é requisito, não fase. Cada módulo tem plano de teste.
# Cada regra de negócio tem caso de teste correspondente.

---

## CAPÍTULO 38 — Estratégia de Qualidade

| ID | Documento | Status |
|---|---|---|
| TST-STR-001 | `docs/11-testing/testing-strategy.md` — Estratégia de Testes | 📋 [P1] |
| TST-STR-002 | `docs/11-testing/acceptance-criteria.md` — Critérios de Aceite | 📋 [P1] |
| TST-STR-003 | `docs/11-testing/qa-checklist.md` — Checklist de QA | 📋 [P1] |
| TST-STR-004 | Política de Testes de Regressão | ⏳ [P2] |
| TST-STR-005 | Plano de Testes de Carga e Performance | ⏳ [P2] |
| TST-STR-006 | Plano de Testes de Segurança (DAST/SAST) | ⏳ [P2] |
| TST-STR-007 | Plano de Testes de Acessibilidade | ⏳ [P3] |
| TST-STR-008 | Estratégia de Test Data Management | ⏳ [P2] |

---

## CAPÍTULO 39 — Planos de Teste por Módulo

| ID | Plano de Teste | Status |
|---|---|---|
| PLT-CRM-001 | Plano de Teste — CRM | ⏳ [P3] |
| PLT-COM-001 | Plano de Teste — Comercial | ⏳ [P3] |
| PLT-FIN-001 | Plano de Teste — Financeiro | ⏳ [P3] |
| PLT-OPS-001 | Plano de Teste — Operações | ⏳ [P3] |
| PLT-HRH-001 | Plano de Teste — RH | ⏳ [P4] |
| PLT-ADM-001 | Plano de Teste — Admin | ⏳ [P2] |
| PLT-NOT-001 | Plano de Teste — Notificações | ⏳ [P3] |
| PLT-SYS-001 | Plano de Teste de Integração Sistêmica | ⏳ [P3] |
| PLT-SYS-002 | Plano de Teste End-to-End (Jornadas Críticas) | ⏳ [P3] |

---

# ══════════════════════════════════════════════════════
# VOLUME XIII — CONFORMIDADE LEGAL E REGULATÓRIA
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Garante que o SOE opera dentro dos limites
# legais e regulatórios. Compliance não é afterthought —
# é requisito rastreável até o código.

---

## CAPÍTULO 40 — Regulações e Conformidade

| ID | Documento | Status |
|---|---|---|
| CPL-REG-001 | `docs/15-compliance/regulatory-map.md` — Mapa Regulatório | 📋 [P1] |
| CPL-AUD-001 | `docs/15-compliance/audit-readiness.md` — Prontidão para Auditoria | 📋 [P2] |
| CPL-LGPD-001 | Mapeamento de Direitos do Titular | ⏳ [P2] |
| CPL-LGPD-002 | Processo DSAR (Data Subject Access Request) | ⏳ [P2] |
| CPL-LGPD-003 | Plano de Comunicação de Incidente LGPD → ANPD | ⏳ [P2] |
| CPL-LGPD-004 | AIPD — Avaliação de Impacto à Proteção de Dados | ⏳ [P2] |
| CPL-FIS-001 | Requisitos Fiscais e Tributários | ⏳ [P3] |
| CPL-TRB-001 | Requisitos Trabalhistas (impacto no módulo RH) | ⏳ [P3] |

---

# ══════════════════════════════════════════════════════
# VOLUME XIV — HISTÓRICO E REGISTROS
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Preserva a história do projeto. Imutável
# por natureza — registros do passado nunca são alterados.
# É a memória institucional do SOE.

---

## CAPÍTULO 41 — Architecture Decision Records

> Ver Capítulo 7 para a lista completa de ADRs.
> Este capítulo existe como referência cruzada e para facilitar a navegação.

### Índice de ADRs por Domínio

| Domínio | ADRs |
|---|---|
| Documentação e Governança | ADR-0001 |
| Arquitetura Sistêmica | ADR-0002, ADR-0003, ADR-0004, ADR-0005 |
| Infraestrutura e Cloud | ADR-0011, ADR-0007 |
| Qualidade e Processo | ADR-0006, ADR-0008, ADR-0009, ADR-0010, ADR-0012 |
| Frontend e UX | ADR-0013, ADR-0014 |
| _(novos ADRs categorizados aqui)_ | — |

---

## CAPÍTULO 42 — Decision Log e Atas

| ID | Documento | Status |
|---|---|---|
| DOC-GOV-020 | `docs/09-decisions/DECISION_LOG.md` — Log de Decisões | 📋 ativo |
| ATA-2026-001 | _(primeira ata do projeto)_ | ⏳ |
| ATA-2026-NNN | _(atas subsequentes — sequencial por ano)_ | ⏳ |

---

## CAPÍTULO 43 — Relatórios de Incidente

| ID | Relatório | Status |
|---|---|---|
| INC-2026-NNN | _(relatórios criados quando necessário)_ | — |

---

# ══════════════════════════════════════════════════════
# VOLUME XV — GUIAS OPERACIONAIS E ONBOARDING
# ══════════════════════════════════════════════════════
#
# Propósito do Volume: Documentação de suporte ao dia a dia da equipe.
# Guias de como trabalhar no projeto, como configurar ambientes,
# como fazer onboarding de novos membros.

---

## CAPÍTULO 44 — Guias para a Equipe

| ID | Documento | Status |
|---|---|---|
| DOC-GOV-001 | DOCUMENTATION_GUIDE — Guia de Documentação | ✅ |
| DOC-GOV-021 | Guia de Onboarding — Novo Membro da Equipe | ⏳ [P2] |
| DOC-GOV-022 | Guia de Contribuição com Código (quando aplicável) | ⏳ [P3] |
| DOC-GOV-023 | Guia de Configuração do Ambiente de Desenvolvimento | ⏳ [P3] |
| DOC-GOV-024 | Guia de Resolução de Problemas Comuns | ⏳ [P4] |
| DOC-GOV-025 | FAQ do Projeto | ⏳ [P3] |

---

## 7. Critérios de Aceitação

- [ ] Todos os documentos com status `📋` (existem mas sem conteúdo) passam para `🔄` na Fase 0
- [ ] Todos os documentos `[P1]` existem e estão aprovados antes do início da Fase 1
- [ ] O MASTER_INDEX é atualizado a cada novo documento criado ou ID atribuído
- [ ] Nenhum documento é criado sem ID listado neste índice
- [ ] A Matriz de Rastreabilidade Vertical (referenciada em DOC-GOV-011) está mapeada neste índice
- [ ] A coluna de status reflete a realidade atual do repositório

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Volume | Este documento — agrupamento temático de capítulos |
| Capítulo | Este documento — agrupamento de documentos relacionados |
| Artefato | Qualquer arquivo não-Markdown (diagrama, schema, planilha, etc.) |
| Status de documento | `DOC-GOV-003` — Modelo de Versionamento |
| ID de documento | `DOC-GOV-004` — Sistema de Identificação |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `docs/01-governance/document-governance.md` | Sistema de Governança que rege este índice |
| `docs/01-governance/document-identification.md` | IDs usados neste índice |
| `docs/01-governance/traceability-policy.md` | Política que o índice implementa |
| `docs/01-governance/versioning-model.md` | Modelo de versão aplicado a todos os documentos |

### 9.2 Referências Externas

N/A

---

## 10. Observações

Este índice está na versão `1.0.0` — reflete a estrutura planejada completa do SOE.
Os documentos com status `📋` foram criados estruturalmente (cabeçalho de metadados)
mas aguardam conteúdo. Os documentos `⏳` ainda não têm arquivo criado.

O índice crescerá ao longo dos anos. Novos módulos, integrações, ADRs, agentes e
workflows serão adicionados. A estrutura de Volumes e Capítulos suporta esse crescimento
sem reorganização: novos documentos entram nos capítulos existentes; novos capítulos
entram nos volumes existentes; novos volumes (XVI, XVII...) são adicionados ao final.

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Índice mestre criado com 15 Volumes, 44 Capítulos e estrutura completa do SOE |
