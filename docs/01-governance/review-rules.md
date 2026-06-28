# Regras de Revisão de Documentos — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-008 |
| **Título** | Regras de Revisão de Documentos do SOE |
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

Estabelece dois tipos de revisão de documentos: a **revisão reativa** (que ocorre
quando um PR é aberto para mudança) e a **revisão proativa** (que ocorre periodicamente
para garantir que documentos aprovados continuam válidos e atualizados).

Documentos que nunca são revisados proativamente envelhecem silenciosamente. Quando a
equipe percebe a desatualização, os danos já foram feitos: decisões erradas tomadas,
implementações incorretas, tempo perdido. A revisão proativa é o sistema imunológico
da documentação.

---

## 3. Escopo

### 3.1 O que este documento cobre

- A revisão reativa: critérios de qualidade que um revisor aplica em um PR
- A revisão proativa: quando e quem revisa documentos aprovados periodicamente
- O roteiro de revisão (o que verificar em cada tipo de revisão)
- O que fazer quando uma revisão identifica problemas

### 3.2 O que este documento NÃO cobre

- O processo de aprovação após a revisão → ver `DOC-GOV-007`
- O que gatilha uma atualização obrigatória → ver `DOC-GOV-006`
- Como declarar um documento obsoleto após revisão → ver `DOC-GOV-010`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Componente do sistema |
| DOC-GOV-005 | Categorias de Documentos | aprovado | Frequência de revisão varia por categoria |
| DOC-GOV-007 | Regras de Aprovação | aprovado | Revisão precede aprovação |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `referencia →` | DOC-GOV-005 | Categorias | Frequência por categoria |
| `referencia →` | DOC-GOV-007 | Regras de Aprovação | Revisão leva à aprovação |
| `referencia →` | DOC-GOV-010 | Regras de Obsolescência | Revisão pode resultar em obsolescência |
| `← referenciado por` | `.github/PULL_REQUEST_TEMPLATE.md` | PR Template | Checklist de revisão derivado daqui |

---

## 6. Conteúdo Principal

### 6.1 Revisão Reativa — O Que Verificar em um PR

Quando um revisor analisa um Pull Request de documento, ele deve verificar os seguintes
critérios, agrupados em quatro dimensões:

#### Dimensão 1 — Conformidade Estrutural

| # | Critério | Bloqueante? |
|---|---|---|
| E1 | O documento usa o `TEMPLATE-OFICIAL.md` | Sim |
| E2 | Todos os 11 campos da seção Identificação estão preenchidos | Sim |
| E3 | O ID segue o padrão definido em `DOC-GOV-004` | Sim |
| E4 | A versão segue o `DocSemVer` definido em `DOC-GOV-003` | Sim |
| E5 | O status é um dos quatro valores válidos | Sim |
| E6 | A categoria (Prioridade) está correta conforme `DOC-GOV-005` | Sim |
| E7 | Blocos de instrução do template foram removidos | Sim |

#### Dimensão 2 — Integridade Referencial

| # | Critério | Bloqueante? |
|---|---|---|
| R1 | Todos os links internos apontam para arquivos que existem | Sim |
| R2 | Todas as dependências (seção 4) têm status `aprovado` | Sim |
| R3 | Relacionamentos (seção 5) são bidirecionais — o outro documento também lista este | Recomendado |
| R4 | IDs referenciados existem no MASTER_INDEX | Sim |
| R5 | Nenhum conteúdo foi copiado de outro documento sem referência à fonte | Sim |

#### Dimensão 3 — Qualidade de Conteúdo

| # | Critério | Bloqueante? |
|---|---|---|
| Q1 | O Objetivo (seção 2) responde claramente por que o documento existe | Sim |
| Q2 | O Escopo (seção 3) define o que está dentro E fora | Sim |
| Q3 | O Conteúdo Principal é específico o suficiente para ser implementado | Sim para C1/C2 |
| Q4 | A linguagem é em português, ativa, direta e sem ambiguidades | Recomendado |
| Q5 | Nenhuma decisão arquitetural foi tomada sem ADR correspondente | Sim |
| Q6 | Termos de domínio usados estão referenciados no Glossário (seção 8) | Recomendado |
| Q7 | Os Critérios de Aceitação (seção 7) são verificáveis objetivamente | Sim |
| Q8 | O documento seria compreensível para um novo membro sem contexto adicional | Recomendado |

#### Dimensão 4 — Consistência com o Ecossistema

| # | Critério | Bloqueante? |
|---|---|---|
| C1 | O documento não contradiz um documento Categoria 1 sem ADR que justifique | Sim |
| C2 | Regras de negócio documentadas aqui são consistentes com as regras em módulos relacionados | Sim para C2/C3 |
| C3 | O documento respeita as restrições definidas em `docs/02-architecture/constraints.md` | Sim |
| C4 | A seção de Histórico de Alterações registra esta versão corretamente | Sim para versão ≥ 1.0.0 |

---

### 6.2 Revisão Proativa — Cadência por Categoria

A revisão proativa é iniciada pelo Guardião da Documentação Técnica, que agenda
e coordena as revisões conforme a cadência abaixo:

| Categoria | Frequência | Gatilho Adicional |
|---|---|---|
| **Categoria 1** | Semestral (jan e jul) | + Sempre que um ADR for aprovado que possa afetar |
| **Categoria 2** | Trimestral | + A cada release de módulo que afete o documento |
| **Categoria 3** | Semestral | + A cada mudança MAJOR no documento pai (Categoria 2) |
| **Categoria 4** | Não aplicável | Atas e incidentes são imutáveis após aprovação |

**Registro:** O campo "Próxima Revisão" da seção 1 deve ser atualizado após cada
revisão proativa. Documentos sem este campo preenchido (para C1, C2 e C3) são
considerados em débito de revisão.

---

### 6.3 Roteiro de Revisão Proativa

Quando o Guardião inicia uma revisão proativa, o responsável pelo documento
(Autor ou Líder de Módulo) deve verificar:

#### Bloco A — Atualidade do Conteúdo

- [ ] O conteúdo ainda reflete a realidade atual do sistema/processo?
- [ ] Alguma regra de negócio mudou desde a última revisão?
- [ ] Alguma integração ou contrato de API que este documento descreve foi alterado?
- [ ] O responsável (Autor) do documento ainda está no projeto? Se não, atualizar.

#### Bloco B — Consistência com o Repositório

- [ ] Todos os links internos ainda funcionam?
- [ ] Documentos que este referencia foram atualizados de forma que afeta este?
- [ ] Novos documentos foram criados que deveriam ser listados nos Relacionamentos?
- [ ] O MASTER_INDEX tem as informações corretas sobre este documento?

#### Bloco C — Relevância

- [ ] O documento ainda é necessário? O problema que ele resolve ainda existe?
- [ ] Não está obsoleto na prática mas continua ativo no status?
- [ ] O escopo está correto ou o documento cresceu informalmente além do escopo?

#### Resultado da Revisão Proativa

| Resultado | Ação |
|---|---|
| Documento válido e atualizado | Atualizar campo "Última Revisão" e "Próxima Revisão". PATCH na versão. |
| Requer pequenas correções | Abrir PR de Classe A ou B. Execução em até 5 dias úteis. |
| Requer atualização substancial | Abrir issue de atualização. Execução em até 15 dias úteis. |
| Deve ser obsoletado | Iniciar processo conforme `DOC-GOV-010`. |

---

### 6.4 Relatório de Saúde Documental

O Guardião produz um Relatório de Saúde Documental trimestral contendo:

| Seção do Relatório | Conteúdo |
|---|---|
| Documentos em débito de revisão | Lista de documentos com "Próxima Revisão" vencida |
| Documentos em `em-revisão` há mais de SLA | PRs abertos além do prazo da categoria |
| Documentos sem Autor ativo | Documentos cujo autor saiu do projeto |
| Documentos Categoria 1 com mudanças recentes | Avaliação de impacto cascata |
| Tendência de atualização | % de documentos atualizados no último trimestre |

O relatório é compartilhado com o Arquiteto Líder e líderes de módulo como
Categoria 4 (ata/relatório), arquivo em `docs/01-governance/meeting-notes/`.

---

## 7. Critérios de Aceitação

- [ ] Todos os documentos Categoria 1 têm "Próxima Revisão" preenchida e não vencida
- [ ] O checklist de Dimensão 1 é aplicado em 100% dos PRs de documentos
- [ ] O Relatório de Saúde Documental trimestral existe e está atualizado
- [ ] Nenhum documento aprovado está em débito de revisão há mais de 60 dias

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Revisão Reativa | Este documento (seção 6.1) |
| Revisão Proativa | Este documento (seção 6.2) |
| Débito Documental | `docs/01-governance/document-governance.md` |
| Categoria de Documento | `DOC-GOV-005` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `docs/01-governance/approval-rules.md` | Aprovação que segue a revisão |
| `docs/01-governance/obsolescence-rules.md` | Obsolescência como resultado de revisão |
| `.github/PULL_REQUEST_TEMPLATE.md` | Checklist de revisão reativa |

### 9.2 Referências Externas

N/A

---

## 10. Observações

N/A

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Regras de revisão estabelecidas |
