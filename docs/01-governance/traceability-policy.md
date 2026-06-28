# Política de Rastreabilidade Documental — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-011 |
| **Título** | Política de Rastreabilidade Documental do SOE |
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

Define os princípios, requisitos e mecanismos de rastreabilidade que garantem que
qualquer elemento do SOE — requisito, regra de negócio, decisão arquitetural, linha
de código, caso de teste — possa ser rastreado até sua origem e que sua origem possa
ser rastreada até seus impactos.

A rastreabilidade não é apenas uma boa prática: é a capacidade de responder, em qualquer
momento, às perguntas: *"Por que este sistema se comporta assim?"*, *"Quem tomou esta
decisão?"*, *"O que precisa mudar se esta lei for alterada?"*, *"Este requisito foi
testado?"*. Sem rastreabilidade, o projeto cresce cego.

---

## 3. Escopo

### 3.1 O que este documento cobre

- Os quatro tipos de rastreabilidade requeridos no projeto
- A matriz de rastreabilidade vertical (visão → código → teste)
- Os mecanismos técnicos de rastreabilidade (IDs, links, tags Git)
- Os requisitos de rastreabilidade em cada tipo de documento
- Como verificar a integridade da rastreabilidade
- Rastreabilidade de decisões e mudanças

### 3.2 O que este documento NÃO cobre

- O sistema de IDs de documentos → ver `DOC-GOV-004`
- O sistema de relacionamentos entre documentos → ver `DOC-GOV-012`
- Rastreabilidade de logs de auditoria em produção → ver `docs/09-security/audit-logging.md`
- Rastreabilidade de dados pessoais (LGPD) → ver `docs/06-data/lgpd/data-mapping.md`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Componente do sistema |
| DOC-GOV-004 | Sistema de Identificação | aprovado | IDs são o mecanismo primário de rastreabilidade |
| DOC-GOV-012 | Sistema de Relacionamento | aprovado | Relacionamentos são o grafo de rastreabilidade |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `referencia →` | DOC-GOV-004 | Sistema de Identificação | IDs são o mecanismo de rastreabilidade |
| `referencia →` | DOC-GOV-012 | Sistema de Relacionamento | Relacionamentos formam o grafo rastreável |
| `referencia →` | `docs/09-security/audit-logging.md` | Auditoria | Rastreabilidade operacional em produção |
| `← referenciado por` | `docs/00-project/vision.md` | Visão | Visão é o topo da cadeia de rastreabilidade |

---

## 6. Conteúdo Principal

### 6.1 Os Quatro Tipos de Rastreabilidade

#### Tipo 1 — Rastreabilidade Vertical (de cima para baixo)

Garante que toda implementação pode ser rastreada até sua origem estratégica.

```
VISÃO DO PROJETO
      ↓
ESCOPO / OBJETIVOS
      ↓
PRINCÍPIOS DE ENGENHARIA
      ↓
REQUISITOS (RF / RNF)
      ↓
ESPECIFICAÇÕES DE MÓDULO (casos de uso, regras de negócio)
      ↓
CONTRATOS DE API / EVENTOS DE DOMÍNIO
      ↓
CÓDIGO-FONTE
      ↓
TESTES AUTOMATIZADOS
      ↓
RESULTADOS DE TESTE / COBERTURA
```

**Regra:** Nenhum elemento deve existir em um nível sem ter referência ao nível acima.
Um caso de uso sem RF correspondente é não rastreável. Um teste sem caso de teste
correspondente é não rastreável.

#### Tipo 2 — Rastreabilidade Horizontal (entre pares)

Garante que documentos do mesmo nível que se afetam sejam explicitamente conectados.

**Exemplos:**
- `RF-CRM-001` afeta `RF-FIN-003` (criar cliente gera faturamento) → devem referenciar-se
- `RN-FIN-001` afeta `RN-FIN-002` → devem referenciar-se
- `API-CRM-001` consome dados de `API-FIN-001` → devem referenciar-se

**Mecanismo:** Seção 5 (Relacionamentos) do Template Oficial com direção `referencia →`.

#### Tipo 3 — Rastreabilidade de Decisão

Garante que toda decisão arquitetural ou de negócio significativa seja rastreável
até o documento onde foi tomada.

**Pirâmide de decisão:**
```
ADR → Política → Princípio → Restrição → Implementação
```

Toda implementação que não é óbvia deve ter, em seu documento de especificação,
referência ao ADR ou política que a originou.

#### Tipo 4 — Rastreabilidade de Mudança

Garante que toda mudança em um documento seja rastreável no tempo.

**Mecanismos:**
- Histórico de Alterações (seção 11 do template) — rastreabilidade documental
- Histórico de commits Git — rastreabilidade técnica
- Issues do GitHub — rastreabilidade de motivação
- PR do GitHub — rastreabilidade de revisão e aprovação

---

### 6.2 Matriz de Rastreabilidade Vertical (MRV)

A Matriz de Rastreabilidade Vertical é um artefato vivo que mapeia a cadeia completa
de rastreabilidade do SOE. É mantida pelo Guardião e atualizada a cada release.

| Nível | Artefato | Referencia → | ← Referenciado por |
|---|---|---|---|
| Estratégico | `vision.md` | — | `scope.md`, `roadmap.md` |
| Estratégico | `scope.md` | `vision.md` | todos os módulos |
| Arquitetural | `principles.md` | `vision.md` | ADRs, todos os módulos |
| Arquitetural | `ADR-XXXX` | `principles.md` | implementação afetada |
| Requisito | `RF-XXX-NNN` | `vision.md`, módulo | CDU, RN, PLT |
| Domínio | `CDU-XXX-NNN` | `RF-XXX-NNN` | `RN-XXX-NNN`, `TST-XXX-NNN` |
| Domínio | `RN-XXX-NNN` | `CDU-XXX-NNN` | código, `CDT-XXX-NNN` |
| Contrato | `API-XXX-NNN` | `RF-XXX-NNN`, `RN-XXX-NNN` | código, `TST-XXX-NNN` |
| Teste | `PLT-XXX-NNN` | `RF-XXX-NNN` | `CDT-XXX-NNN` |
| Teste | `CDT-XXX-NNN` | `CDU-XXX-NNN`, `RN-XXX-NNN` | resultado de teste |

A MRV completa e atualizada vive em `MASTER_INDEX.md` — seção "Matriz de Rastreabilidade".

---

### 6.3 Requisitos de Rastreabilidade por Tipo de Documento

#### Requisitos Funcionais (RF)

Todo RF deve rastrear para:
- **Para cima:** `vision.md` ou `scope.md` (o RF serve a qual objetivo?)
- **Para baixo:** pelo menos um `CDU` (caso de uso que o implementa)
- **Horizontal:** outros RFs que dependem deste ou dos quais este depende

#### Casos de Uso (CDU)

Todo CDU deve rastrear para:
- **Para cima:** `RF` correspondente
- **Para baixo:** `RN` aplicáveis, `PLT` que o testa
- **Horizontal:** CDUs de outros módulos que são predecessores ou sucessores

#### Regras de Negócio (RN)

Toda RN deve rastrear para:
- **Para cima:** `CDU` onde é aplicada, `RF` que a origina
- **Para baixo:** `CDT` que a valida
- **Horizontal:** outras RNs que conflitam ou se complementam

#### ADRs

Todo ADR deve rastrear para:
- **Para cima:** `principles.md` (o princípio que guiou a decisão)
- **Para baixo:** todos os documentos que implementam a decisão
- **Horizontal:** ADRs que este supersede ou com os quais conflitaria

#### Código-Fonte (quando implementado)

Todo módulo de código deve ter no cabeçalho ou README:
- ID do módulo SOE correspondente (`MOD-XXX-NNN`)
- IDs dos RFs que implementa
- IDs dos CDUs que realiza
- IDs dos contratos de API que expõe ou consome

---

### 6.4 Mecanismos Técnicos de Rastreabilidade

#### 6.4.1 IDs Únicos e Permanentes

O mecanismo primário. Ver `DOC-GOV-004` para o sistema completo.
Um ID permite referenciar qualquer artefato de forma unívoca e permanente.

#### 6.4.2 Seção de Relacionamentos (Seção 5 do Template)

Mecanismo de grafo declarativo. Cada documento declara explicitamente suas relações.
A combinação das seções 5 de todos os documentos forma o grafo de conhecimento do projeto.

**Regra de bidirecionalidade:** Quando o documento A lista B em seus relacionamentos,
B deve listar A nos seus. Relacionamentos unidirecionais são rastreabilidade incompleta.

#### 6.4.3 Tags de Rastreabilidade em Commits Git

Commits que implementam ou alteram um documento devem incluir o ID no corpo da mensagem:

```
docs(update): RF-CRM-001 v1.1.0 - adiciona fluxo de cliente PJ

Refs: RF-CRM-001, CDU-CRM-003, RN-CRM-007
```

#### 6.4.4 Labels de Issues e PRs

| Label | Uso |
|---|---|
| `traces:RF-XXX-NNN` | Issue/PR que implementa ou afeta este RF |
| `traces:ADR-XXXX` | Issue/PR que implementa decisão deste ADR |
| `traces:RN-XXX-NNN` | Issue/PR que implementa esta regra de negócio |

#### 6.4.5 MASTER_INDEX como Registro Central

O MASTER_INDEX é o ponto central de rastreabilidade: lista todos os documentos,
seus IDs, status, versões, responsáveis e localização. É consultado para:
- Verificar se um ID existe
- Encontrar o documento atual de um ID conhecido
- Auditar a completude da cadeia de rastreabilidade

---

### 6.5 Verificação de Integridade da Rastreabilidade

O Guardião executa as seguintes verificações regularmente:

| Verificação | Frequência | Ferramenta |
|---|---|---|
| Links internos quebrados | Semanal | `scripts/validate-docs.sh` |
| Documentos sem referências (órfãos) | Mensal | `scripts/generate-index.sh` |
| RFs sem CDU correspondente | Por release | Verificação manual |
| CDUs sem PLT (plano de teste) | Por release | Verificação manual |
| Relacionamentos sem bidirecionalidade | Trimestral | Verificação manual |
| IDs referenciados que não existem no MASTER_INDEX | Mensal | `scripts/validate-docs.sh` |

---

### 6.6 Rastreabilidade de Requisitos Legais

Requisitos oriundos de legislação (LGPD, normas fiscais, trabalhistas) têm rastreabilidade
especial obrigatória:

```
ARTIGO DA LEI / NORMA
        ↓
   DOC de Compliance (CPL-XXXX ou PRI-XXXX)
        ↓
   RNF de Compliance (RNF-CPL-NNN)
        ↓
   RN de Módulo (RN-XXX-NNN)
        ↓
   Implementação + Teste
```

Nenhum requisito legal pode "flutuar" na base de conhecimento sem estar rastreado
do artigo da lei até o teste que o valida.

---

## 7. Critérios de Aceitação

- [ ] A Matriz de Rastreabilidade Vertical existe no MASTER_INDEX
- [ ] Todo RF aprovado tem pelo menos um CDU que o referencia
- [ ] Todo ADR lista os documentos que implementam a decisão
- [ ] O script `validate-docs.sh` não reporta links quebrados
- [ ] Nenhum requisito legal existe sem cadeia completa de rastreabilidade até o teste
- [ ] Relacionamentos são bidirecionais em 100% dos documentos Categoria 1 e 2

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Rastreabilidade Vertical | Este documento (seção 6.1) |
| Matriz de Rastreabilidade Vertical (MRV) | Este documento (seção 6.2) |
| Bidirecionalidade | Este documento (seção 6.4.2) |
| MASTER_INDEX | `MASTER_INDEX.md` |
| ID de Documento | `DOC-GOV-004` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `DOC-GOV-004` | Sistema de Identificação — IDs como mecanismo |
| `DOC-GOV-012` | Sistema de Relacionamento — grafo de rastreabilidade |
| `scripts/validate-docs.sh` | Validação automática de rastreabilidade |
| `MASTER_INDEX.md` | Registro central e MRV |

### 9.2 Referências Externas

| URL | Título |
|---|---|
| https://www.ieee.org/standards/ | IEEE 830 — Rastreabilidade de Requisitos |
| https://www.incose.org/ | INCOSE SE Handbook — Rastreabilidade em Engenharia de Sistemas |

---

## 10. Observações

A Matriz de Rastreabilidade Vertical completa será construída progressivamente à medida
que os documentos de requisito, domínio e teste forem escritos. A estrutura dela está
definida aqui; sua população é trabalho contínuo.

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Política de rastreabilidade estabelecida |
