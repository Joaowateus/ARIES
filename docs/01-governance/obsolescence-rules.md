# Regras de Obsolescência de Documentos — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-010 |
| **Título** | Regras de Obsolescência de Documentos do SOE |
| **Tipo** | Política |
| **Autor** | Guardião da Documentação Técnica |
| **Data de Criação** | 2026-06-28 |
| **Última Revisão** | 2026-06-28 |
| **Próxima Revisão** | 2026-12-28 |
| **Versão** | 1.0.0 |
| **Status** | aprovado |
| **Prioridade** | alta |
| **Domínio** | Governança |

---

## 2. Objetivo

Define quando e como um documento é declarado obsoleto — estado que indica que o
documento não deve mais ser usado como referência, mas que deve ser preservado como
registro histórico. Obsolescência é diferente de exclusão: o documento permanece
acessível, mas sinalizado de forma inequívoca.

Um sistema sem regras de obsolescência acumula documentos desatualizados sem sinalização,
levando a equipe a tomar decisões baseadas em informações ultrapassadas sem saber disso.
A obsolescência controlada é a higiene da base de conhecimento.

---

## 3. Escopo

### 3.1 O que este documento cobre

- Os critérios que tornam um documento obsoleto
- Quem tem autoridade para declarar obsolescência
- O processo formal de obsolescência (passo a passo)
- Os requisitos obrigatórios de um documento obsoleto (banner, link para substituto)
- A obsolescência de documentos sem substituto
- O tratamento de referências para documentos obsoletos

### 3.2 O que este documento NÃO cobre

- O arquivamento após obsolescência → ver `DOC-GOV-009`
- A revisão que pode identificar necessidade de obsolescência → ver `DOC-GOV-008`
- O versionamento durante o processo de obsolescência → ver `DOC-GOV-003`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Componente do sistema |
| DOC-GOV-005 | Categorias de Documentos | aprovado | Autoridade de obsolescência varia por categoria |
| DOC-GOV-009 | Regras de Arquivamento | aprovado | Arquivamento segue a obsolescência |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `referencia →` | DOC-GOV-009 | Regras de Arquivamento | Arquivamento é consequência da obsolescência |
| `referencia →` | DOC-GOV-008 | Regras de Revisão | Revisão pode recomendar obsolescência |
| `referencia →` | DOC-GOV-011 | Política de Rastreabilidade | Rastreabilidade deve ser mantida mesmo após obsolescência |

---

## 6. Conteúdo Principal

### 6.1 Critérios de Obsolescência

Um documento deve ser declarado obsoleto quando qualquer uma das condições abaixo
for verdadeira e confirmada pelo processo de revisão:

| # | Critério | Exemplos |
|---|---|---|
| O1 | O documento foi supersedido por um substituto aprovado | ADR novo que substitui ADR anterior |
| O2 | O problema que o documento resolve deixou de existir | Módulo descontinuado; integração removida |
| O3 | O conteúdo do documento está factualmente incorreto e não pode ser corrigido sem reescrever completamente | Regra de negócio radicalmente diferente da documentada |
| O4 | O documento descreve uma decisão que foi revertida | Padrão arquitetural abandonado |
| O5 | O escopo do documento foi absorvido completamente por outro documento mais abrangente | Dois documentos mesclados em um |
| O6 | O documento permanece em revisão proativa vencida por mais de 180 dias sem resposta do responsável | Documento sem dono ativo |
| O7 | O módulo ou funcionalidade que o documento especifica foi descontinuado | Módulo removido do escopo |

**Atenção:** Divergência entre documentação e implementação **não** é critério de
obsolescência do documento — o documento é a fonte de verdade. A implementação é
que deve ser corrigida. Exceção: se houver ADR determinando que o código é a referência.

---

### 6.2 Autoridade para Declarar Obsolescência

| Categoria do Documento | Autoridade Mínima |
|---|---|
| **Categoria 1 — Fundacional** | Arquiteto Líder + Diretoria Executiva |
| **Categoria 2 — Estratégica** | Arquiteto Líder + Líder do Módulo |
| **Categoria 3 — Operacional** | Líder do Módulo + Guardião |
| **Categoria 4 — Suporte** | Guardião |
| **ADRs** | Arquiteto Líder (apenas via novo ADR supersedente) |

**Regra especial para ADRs:** ADRs nunca são declarados obsoletos diretamente.
A obsolescência de um ADR ocorre exclusivamente pela aprovação de um novo ADR que
o supersede. O ADR original recebe na seção 10 (Observações) a referência ao ADR
que o supersedem.

---

### 6.3 Processo de Obsolescência

```
PASSO 1 — IDENTIFICAÇÃO
└── Qualquer membro pode propor obsolescência via issue com label "obsolescence-proposal"
└── Issue deve incluir: ID do documento, critério de obsolescência (O1-O7), substituto (se houver)

PASSO 2 — AVALIAÇÃO
└── Guardião avalia a proposta em até 3 dias úteis
└── Se procedente: inicia o processo formal
└── Se improcedente: fecha a issue com justificativa

PASSO 3 — IDENTIFICAÇÃO DO IMPACTO
└── Listar todos os documentos que referenciam o documento a ser obsoletado
└── Para cada referenciador: avaliar se precisa ser atualizado
└── Criar issues de atualização cascata para todos os referenciadores afetados

PASSO 4 — PREPARAÇÃO DO SUBSTITUTO (se aplicável)
└── O substituto deve existir e estar com status "aprovado" ANTES do processo de obsolescência
└── Exceção: obsolescência sem substituto (critérios O2, O4, O7) — documentar justificativa

PASSO 5 — PULL REQUEST DE OBSOLESCÊNCIA
└── Aplicar o "Banner de Obsolescência" (seção 6.4) no início do documento
└── Atualizar seção 1: status = "obsoleto"
└── Atualizar seção 10 (Observações): registrar data, motivo e link para substituto
└── Congelar versão (não incrementar — o documento não evolui mais)
└── Aprovação conforme matriz da seção 6.2

PASSO 6 — MERGE E NOTIFICAÇÃO
└── Merge do PR de obsolescência
└── MASTER_INDEX atualizado: status = "obsoleto", campo "Substituto" preenchido
└── Notificação ampla (conforme categoria) informando a obsolescência e o substituto
└── Issues cascata de referenciadores: verificar que foram endereçadas

PASSO 7 — ARQUIVAMENTO (conforme prazo da categoria em DOC-GOV-009)
└── Após o prazo de retenção no ativo, documento é movido para archive/
└── ARCHIVE_INDEX.md atualizado
```

---

### 6.4 Banner de Obsolescência

Todo documento obsoleto deve ter, como **primeiro elemento do corpo** (após a seção 1),
o seguinte banner:

```markdown
> ⚠️ **DOCUMENTO OBSOLETO**
>
> Este documento foi declarado obsoleto em **AAAA-MM-DD**.
>
> **Motivo:** [Critério de obsolescência e breve explicação]
>
> **Substituto:** [ID e link para o documento substituto, ou "Sem substituto —
> [motivo pelo qual não há substituto]"]
>
> **Não utilize este documento como referência.** Consulte o substituto indicado acima.
```

**Regras do banner:**
- Nunca remover — é o sinal visual de obsolescência
- Nunca editar após aprovação do PR de obsolescência
- Deve aparecer antes de qualquer outro conteúdo do documento
- O link para o substituto deve ser testado antes do merge

---

### 6.5 Obsolescência Sem Substituto

Quando um documento é obsoletado sem um substituto (critérios O2, O4 ou O7),
o banner deve explicar explicitamente por que não há substituto:

```markdown
> ⚠️ **DOCUMENTO OBSOLETO — SEM SUBSTITUTO**
>
> Este documento foi declarado obsoleto em **AAAA-MM-DD**.
>
> **Motivo:** [Explicação clara]
>
> **Por que não há substituto:** [O problema que este documento resolvia não existe mais /
> A funcionalidade foi descontinuada / A decisão foi revertida e não há nova decisão]
```

---

### 6.6 Tratamento de Referências para Documentos Obsoletos

Quando um documento é obsoletado, todos os documentos que o referenciam devem:

1. **Ser notificados** via issues criadas no Passo 3 do processo
2. **Atualizar a referência** para o substituto (quando houver)
3. **Ou remover a referência** (quando o contexto não se aplica mais)
4. **Ou manter a referência com nota** "[OBSOLETO — ver substituto]" (quando o contexto
   histórico deve ser preservado)

**Prazo para atualização de referências:**
- Categoria 1 → 5 dias úteis após obsolescência
- Categoria 2 → 10 dias úteis
- Categoria 3 → 15 dias úteis
- Categoria 4 → N/A (referências históricas são aceitáveis)

---

## 7. Critérios de Aceitação

- [ ] Todo documento com status `obsoleto` tem o banner da seção 6.4 aplicado
- [ ] Todo documento obsoleto aponta para substituto ou explica a ausência dele
- [ ] Nenhum documento Categoria 1 foi obsoletado sem aprovação da Diretoria Executiva
- [ ] ADRs só são marcados como obsoletos por ADR supersedente
- [ ] O processo de 7 passos foi seguido para todos os documentos obsoletos
- [ ] Referências para documentos obsoletos foram tratadas no prazo definido

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Banner de Obsolescência | Este documento (seção 6.4) |
| Substituto | Este documento (seção 6.3 — Passo 4) |
| ADR Supersedente | `docs/02-architecture/adr/ADR-0000-template.md` |
| Categoria de Documento | `DOC-GOV-005` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `docs/01-governance/archiving-rules.md` | Arquivamento após obsolescência |
| `docs/01-governance/review-rules.md` | Revisão que pode identificar obsolescência |
| `MASTER_INDEX.md` | Índice com campo "Substituto" para documentos obsoletos |

### 9.2 Referências Externas

N/A

---

## 10. Observações

N/A

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Regras de obsolescência estabelecidas |
