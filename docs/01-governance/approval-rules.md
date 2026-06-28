# Regras de Aprovação de Documentos — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-007 |
| **Título** | Regras de Aprovação de Documentos do SOE |
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

Define quem tem autoridade para aprovar documentos, quais são os requisitos mínimos
de aprovação por categoria, como o processo de aprovação se dá tecnicamente (via Pull
Request) e quais são as condições que bloqueiam a aprovação independente de quem a solicite.

A aprovação é o ato formal pelo qual um documento passa de rascunho para fonte de verdade.
Sem regras claras de aprovação, qualquer pessoa pode publicar qualquer coisa — o que
invalida a documentação como base confiável para decisões de engenharia.

---

## 3. Escopo

### 3.1 O que este documento cobre

- A matriz de aprovação por categoria de documento
- Os papéis de aprovador e suas competências
- As condições de bloqueio absoluto de aprovação
- O processo técnico de aprovação via Pull Request
- O quórum mínimo de aprovação e como ele é contado
- A delegação de aprovação e seus limites

### 3.2 O que este documento NÃO cobre

- As categorias de documentos → ver `DOC-GOV-005`
- O processo de revisão de conteúdo (o que verificar) → ver `DOC-GOV-008`
- O que fazer quando um documento aprovado precisa ser alterado → ver `DOC-GOV-006`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Componente do sistema |
| DOC-GOV-005 | Categorias de Documentos | aprovado | Categoria determina quórum de aprovação |
| `docs/01-governance/roles-and-responsibilities.md` | RACI | aprovado | Papéis de aprovador definidos lá |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `referencia →` | DOC-GOV-005 | Categorias | Categorias determinam o quórum |
| `referencia →` | DOC-GOV-006 | Regras de Atualização | Atualizações seguem este processo de aprovação |
| `referencia →` | DOC-GOV-008 | Regras de Revisão | Revisão é pré-requisito da aprovação |
| `← referenciado por` | `.github/PULL_REQUEST_TEMPLATE.md` | PR Template | O template aplica estas regras |
| `← referenciado por` | `CONTRIBUTING.md` | Guia de Contribuição | Resume estas regras para colaboradores |

---

## 6. Conteúdo Principal

### 6.1 Papéis de Aprovador

| Papel | Abreviação | Competência de Aprovação |
|---|---|---|
| Diretoria Executiva | DIR | Documentos Categoria 1 que afetam escopo, prazo ou budget |
| Arquiteto Líder | ARQ | Documentos Categoria 1 e 2; todos os ADRs |
| Guardião da Documentação | GRD | Conformidade com template e processo editorial em todas as categorias |
| Líder de Módulo | LDM | Documentos Categoria 2 e 3 dentro do seu módulo |
| Revisor Par | PAR | Documentos Categoria 3 e 4 |
| DPO / Jurídico | JUR | Documentos de compliance, LGPD e segurança (todas categorias) |
| CISO | CSO | Documentos de segurança Categoria 1 e 2 |

**Regra:** Um aprovador não pode aprovar seu próprio documento. O autor nunca
conta como aprovador, mesmo que tenha o papel competente.

---

### 6.2 Matriz de Aprovação por Categoria

#### Categoria 1 — Fundacional

| Tipo de Mudança | Aprovadores Obrigatórios | Quórum Mínimo |
|---|---|---|
| Criação (`1.0.0`) | ARQ + DIR + GRD | 3 aprovações distintas |
| Atualização MINOR | ARQ + GRD | 2 aprovações |
| Atualização MAJOR | ARQ + DIR + GRD | 3 aprovações |
| Obsolescência | ARQ + DIR | 2 aprovações |
| Documentos de segurança | + CSO obrigatório | +1 = 4 aprovações na criação |
| Documentos LGPD | + JUR obrigatório | +1 = 4 aprovações na criação |

**SLA:** 5 dias úteis para que todos os aprovadores se manifestem.
Silêncio após o SLA não é aprovação — Guardião escala para o Arquiteto Líder.

#### Categoria 2 — Estratégica

| Tipo de Mudança | Aprovadores Obrigatórios | Quórum Mínimo |
|---|---|---|
| Criação (`1.0.0`) | ARQ + LDM + GRD | 3 aprovações |
| Atualização MINOR | LDM + GRD | 2 aprovações |
| Atualização MAJOR | ARQ + LDM + GRD | 3 aprovações |
| Obsolescência | ARQ + LDM | 2 aprovações |

**SLA:** 3 dias úteis.

#### Categoria 3 — Operacional

| Tipo de Mudança | Aprovadores Obrigatórios | Quórum Mínimo |
|---|---|---|
| Criação (`1.0.0`) | LDM + PAR | 2 aprovações |
| Atualização MINOR | PAR | 1 aprovação |
| Atualização MAJOR | LDM + PAR | 2 aprovações |
| Atualização PATCH | PAR ou GRD | 1 aprovação |
| Obsolescência | LDM | 1 aprovação |

**SLA:** 2 dias úteis.

#### Categoria 4 — Suporte

| Tipo de Mudança | Aprovadores Obrigatórios | Quórum Mínimo |
|---|---|---|
| Criação (`1.0.0`) | PAR ou GRD | 1 aprovação |
| Atas de Reunião | 1 participante presente | 1 aprovação |
| Relatório de Incidente | LDM | 1 aprovação |
| Atualização PATCH | PAR | 1 aprovação |
| Obsolescência | PAR | 1 aprovação |

**SLA:** 1 dia útil.

---

### 6.3 Condições de Bloqueio Absoluto

As condições abaixo bloqueiam a aprovação de qualquer documento, independente
de quórum, hierarquia ou urgência:

| # | Condição de Bloqueio | Desbloqueio |
|---|---|---|
| B1 | O documento não usa o `TEMPLATE-OFICIAL.md` | Refatorar para o template |
| B2 | Qualquer campo obrigatório da seção 1 está vazio ou com `[placeholder]` | Preencher todos os campos |
| B3 | Uma ou mais dependências (seção 4) estão com status diferente de `aprovado` | Aprovar as dependências primeiro |
| B4 | Os Critérios de Aceitação (seção 7) não foram verificados pelo autor | Autor deve marcar todos os critérios |
| B5 | Há conflito detectado com um documento Categoria 1 não resolvido | Resolver conflito via ADR ou atualização |
| B6 | O documento modifica escopo definido em um ADR sem criar ADR supersedente | Criar o ADR supersedente |
| B7 | O autor e o único revisor são a mesma pessoa | Adicionar revisor independente |
| B8 | O documento tem status `obsoleto` mas não aponta para substituto | Adicionar referência ao substituto |

---

### 6.4 Processo Técnico de Aprovação

```
1. SUBMISSÃO
   └── Autor abre Pull Request na branch principal
   └── Preenche PULL_REQUEST_TEMPLATE.md completamente
   └── Status do documento: "em-revisão"

2. VALIDAÇÃO AUTOMÁTICA (Guardião ou CI)
   └── Verifica presença de todas as seções do template
   └── Verifica se o ID está registrado no MASTER_INDEX
   └── Verifica se todos os links internos existem
   └── Verifica ausência de condições de bloqueio B1, B2, B4
   └── Se falhar: PR recebe label "blocked" e Guardião notifica o autor

3. DESIGNAÇÃO DE REVISORES
   └── Guardião designa revisores conforme matriz da seção 6.2
   └── CODEOWNERS pode designar automaticamente para documentos de áreas específicas
   └── Prazo de revisão inicia a partir da designação

4. REVISÃO DE CONTEÚDO
   └── Revisores verificam conforme DOC-GOV-008 (Regras de Revisão)
   └── Comentários no PR com tag:
       ├── [BLOQUEANTE] — deve ser resolvido antes do merge
       ├── [SUGESTÃO] — melhoria recomendada, não obrigatória
       └── [DÚVIDA] — esclarecimento pedido ao autor

5. RESOLUÇÃO
   └── Autor responde a todos os comentários [BLOQUEANTE]
   └── Após resolução, revisor re-aprova ou re-solicita mudança
   └── Sugestões podem ser aceitas ou rejeitadas com justificativa

6. APROVAÇÃO FORMAL
   └── Aprovadores mínimos clicam "Approve" no GitHub
   └── GRD verifica que o quórum da categoria foi atingido
   └── Status do documento atualizado para "aprovado"
   └── Versão atualizada para 1.0.0 (ou maior se for atualização)
   └── Histórico de Alterações atualizado

7. MERGE E PUBLICAÇÃO
   └── GRD ou ARQ executa o merge
   └── MASTER_INDEX.md atualizado com nova versão e status
   └── Notificações enviadas conforme categoria
```

---

### 6.5 Delegação de Aprovação

Um aprovador pode delegar sua aprovação para outro membro de papel equivalente ou
superior quando estiver indisponível, seguindo estas regras:

| Regra | Descrição |
|---|---|
| Delegação registrada | A delegação deve ser registrada como comentário no PR |
| Prazo de delegação | Máximo 5 dias úteis; após isso, outro aprovador é designado |
| Delegado deve ter o papel | Não pode delegar para alguém sem competência para aquele tipo de documento |
| Dir não pode ser delegada para ARQ em C1 | Apenas em documentos que não afetam escopo/budget/prazo |
| Sem auto-aprovação via delegação | O autor não pode receber delegação para aprovar seu próprio documento |

---

### 6.6 Aprovação Retroativa (Situação Excepcional)

Se um documento foi publicado sem seguir o processo de aprovação correto
(por exemplo, em contexto de emergência), o seguinte processo se aplica:

1. Guardião abre issue de "aprovação retroativa" com tag `governance-debt`
2. Processo normal de revisão é executado retroativamente
3. Se aprovado: histórico atualizado com nota de aprovação retroativa
4. Se reprovado: documento é revertido ao estado de rascunho ou obsoletado
5. Incidente de processo registrado no DECISION_LOG

---

## 7. Critérios de Aceitação

- [ ] A matriz de aprovação está sendo aplicada em todos os PRs
- [ ] Nenhum documento Categoria 1 foi aprovado sem os aprovadores obrigatórios
- [ ] As condições de bloqueio B1-B8 são verificadas em todo PR
- [ ] O MASTER_INDEX reflete o status correto de todos os documentos aprovados
- [ ] Nenhum autor aprovou seu próprio documento

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Categoria de Documento | `DOC-GOV-005` |
| CODEOWNERS | `.github/CODEOWNERS` |
| Quórum | Este documento (seção 6.2) |
| Guardião da Documentação Técnica | `docs/01-governance/roles-and-responsibilities.md` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `.github/PULL_REQUEST_TEMPLATE.md` | Template que aplica este processo |
| `docs/01-governance/roles-and-responsibilities.md` | Papéis de aprovador |
| `.github/CODEOWNERS` | Designação automática de revisores |

### 9.2 Referências Externas

N/A

---

## 10. Observações

N/A

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Regras de aprovação estabelecidas |
