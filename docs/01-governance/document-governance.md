# Sistema de Governança Documental — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-002 |
| **Título** | Sistema de Governança Documental do SOE |
| **Tipo** | Política |
| **Autor** | Guardião da Documentação Técnica |
| **Data de Criação** | 2026-06-28 |
| **Última Revisão** | 2026-06-28 |
| **Próxima Revisão** | 2026-12-28 |
| **Versão** | 1.0.0 |
| **Status** | aprovado |
| **Prioridade** | crítica |
| **Domínio** | Governança |

---

## 2. Objetivo

Este documento é o ápice da governança documental do projeto SOE. Ele não define as regras
em detalhe — cada política tem seu documento próprio — mas estabelece o **sistema como um todo**:
quais políticas existem, como elas se relacionam, qual a hierarquia entre elas e o que
acontece quando há conflito entre duas regras.

A governança documental existe porque documentação sem governança se degrada. Projetos de
longa duração acumulam documentos desatualizados, sem dono, sem histórico, com IDs
conflitantes e sem rastreabilidade entre si. O resultado é a perda da documentação como
fonte de verdade — e, consequentemente, a perda do controle sobre o próprio sistema.

Este sistema de governança garante que, em qualquer momento do projeto, seja possível
responder com precisão: *quem criou este documento, quando foi aprovado, quem pode
alterá-lo, o que ele afeta e se ainda é válido.*

---

## 3. Escopo

### 3.1 O que este documento cobre

- A visão geral do sistema de governança documental e seus componentes
- A hierarquia de autoridade sobre documentos
- A relação entre as políticas que compõem o sistema
- O processo de resolução de conflitos entre políticas
- As responsabilidades permanentes do Guardião da Documentação Técnica

### 3.2 O que este documento NÃO cobre

- As regras detalhadas de versionamento → ver `DOC-GOV-003`
- O sistema de identificação de documentos → ver `DOC-GOV-004`
- As categorias de documentos → ver `DOC-GOV-005`
- As regras de atualização → ver `DOC-GOV-006`
- As regras de aprovação → ver `DOC-GOV-007`
- As regras de revisão periódica → ver `DOC-GOV-008`
- As regras de arquivamento → ver `DOC-GOV-009`
- As regras de obsolescência → ver `DOC-GOV-010`
- A política de rastreabilidade → ver `DOC-GOV-011`
- O sistema de relacionamento entre documentos → ver `DOC-GOV-012`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| ADR-0001 | Template Oficial de Documentação Técnica | aprovado | Todo documento de governança segue este template |
| DOC-GOV-001 | DOCUMENTATION_GUIDE | aprovado | O guia é o pré-requisito operacional do sistema de governança |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `origina →` | DOC-GOV-003 | Modelo de Versionamento | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-004 | Sistema de Identificação | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-005 | Categorias de Documentos | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-006 | Regras de Atualização | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-007 | Regras de Aprovação | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-008 | Regras de Revisão | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-009 | Regras de Arquivamento | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-010 | Regras de Obsolescência | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-011 | Política de Rastreabilidade | Este documento define que aquele deve existir |
| `origina →` | DOC-GOV-012 | Sistema de Relacionamento | Este documento define que aquele deve existir |
| `← origina-se de` | ADR-0001 | Template Oficial | Decisão que tornou este sistema necessário |
| `referencia →` | `docs/01-governance/roles-and-responsibilities.md` | RACI | Papéis que exercem a governança |

---

## 6. Conteúdo Principal

### 6.1 Os Doze Componentes do Sistema

O sistema de governança documental do SOE é composto por doze elementos interdependentes:

```
SISTEMA DE GOVERNANÇA DOCUMENTAL
│
├── [1] Template Oficial (ADR-0001 / DOC-GOV-001)
│       Base estrutural de todo documento
│
├── [2] Modelo de Versionamento (DOC-GOV-003)
│       Como documentos evoluem ao longo do tempo
│
├── [3] Sistema de Identificação (DOC-GOV-004)
│       Como cada documento é identificado unicamente
│
├── [4] Categorias (DOC-GOV-005)
│       Como documentos são classificados por natureza e impacto
│
├── [5] Regras de Atualização (DOC-GOV-006)
│       Quando e como um documento pode ser alterado
│
├── [6] Regras de Aprovação (DOC-GOV-007)
│       Quem autoriza a publicação e mudanças de documentos
│
├── [7] Regras de Revisão (DOC-GOV-008)
│       Quando documentos devem ser revistos proativamente
│
├── [8] Regras de Arquivamento (DOC-GOV-009)
│       Como documentos são preservados historicamente
│
├── [9] Regras de Obsolescência (DOC-GOV-010)
│       Como documentos são declarados inativos
│
├── [10] Política de Rastreabilidade (DOC-GOV-011)
│        Como garantir que tudo pode ser rastreado
│
└── [11] Sistema de Relacionamento (DOC-GOV-012)
         Como documentos se conectam entre si
```

### 6.2 Hierarquia de Autoridade

Quando duas políticas ou regras conflitam, a seguinte hierarquia resolve o conflito.
O nível mais alto prevalece:

```
NÍVEL 1 — Diretoria Executiva
  Decisões que afetam escopo, budget ou prazo do projeto

NÍVEL 2 — Arquiteto Líder
  Decisões arquiteturais e de governança técnica (ADRs)

NÍVEL 3 — Guardião da Documentação Técnica
  Decisões editoriais, de estrutura e padrões documentais

NÍVEL 4 — Líderes de Módulo
  Decisões de conteúdo dentro do escopo de seus módulos

NÍVEL 5 — Autores
  Proposta de conteúdo, sujeita a aprovação dos níveis acima
```

### 6.3 Princípios Inegociáveis da Governança

Os princípios abaixo nunca podem ser violados, independente de urgência ou hierarquia:

| # | Princípio | Consequência da Violação |
|---|---|---|
| P1 | Todo documento tem um dono identificado | Documento inválido — não pode ser aprovado |
| P2 | Nenhum documento aprovado é alterado sem registro no histórico | Mudança considerada não autorizada |
| P3 | Documentos com dependências não aprovadas não podem ser aprovados | PR rejeitado automaticamente |
| P4 | Todo documento obsoleto deve apontar para seu substituto | Obsolescência inválida |
| P5 | Rastreabilidade nunca pode ser quebrada retroativamente | Proibido alterar IDs de documentos existentes |
| P6 | O Guardião pode bloquear qualquer PR que viole este sistema | Sem exceções — qualquer nível hierárquico |

### 6.4 Cadência de Saúde do Sistema

| Frequência | Ação | Responsável |
|---|---|---|
| Semanal | Verificar documentos em `em-revisão` há mais de 7 dias | Guardião |
| Mensal | Auditar documentos com `Próxima Revisão` vencida | Guardião |
| Trimestral | Relatório de saúde documental para o Arquiteto Líder | Guardião |
| Semestral | Revisão das próprias políticas de governança | Arquiteto Líder |
| Por release | Verificar se novos documentos foram criados para mudanças relevantes | Guardião |

---

## 7. Critérios de Aceitação

- [ ] Todos os 11 componentes do sistema existem como documentos aprovados
- [ ] A hierarquia de autoridade está publicada e comunicada à equipe
- [ ] Os 6 princípios inegociáveis estão incorporados no PR template
- [ ] A cadência de saúde está agendada como processo recorrente
- [ ] Nenhum dos documentos componentes tem dependências em `rascunho`

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Guardião da Documentação Técnica | `docs/01-governance/roles-and-responsibilities.md` |
| ADR | `docs/02-architecture/adr/ADR-0000-template.md` |
| Pull Request | `docs/01-governance/editorial-process.md` |
| Status de documento | `DOC-GOV-003` — Modelo de Versionamento |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `docs/01-governance/roles-and-responsibilities.md` | RACI do projeto |
| `docs/01-governance/editorial-process.md` | Processo editorial |
| `templates/TEMPLATE-OFICIAL.md` | Template base de todos os documentos |

### 9.2 Referências Externas

| URL | Título |
|---|---|
| https://www.iso.org/standard/73479.html | ISO 15489 — Gestão de Documentos e Registros |
| https://www.abnt.org.br/ | ABNT NBR ISO 9001 — Sistema de Gestão da Qualidade |

---

## 10. Observações

Este documento e os 10 documentos que ele origina foram criados simultaneamente em
2026-06-28. A maturidade do sistema de governança será avaliada na primeira revisão
semestral (2026-12-28).

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Sistema de governança estabelecido |
