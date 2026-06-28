# Regras de Atualização de Documentos — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-006 |
| **Título** | Regras de Atualização de Documentos do SOE |
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

Define quando, como e por quem um documento aprovado pode ser alterado. A existência
de um processo formal de atualização impede que documentos sejam modificados silenciosamente,
protege a integridade da fonte de verdade e garante que toda mudança seja rastreável,
justificada e comunicada aos interessados.

Sem regras de atualização, documentos aprovados se tornam alvos de edições ad hoc —
o que destrói a confiança da equipe na documentação como fonte de verdade.

---

## 3. Escopo

### 3.1 O que este documento cobre

- Os gatilhos que obrigam a atualização de um documento
- As classes de atualização e o processo correspondente a cada uma
- Quem pode iniciar e quem pode executar uma atualização
- As regras de atualização em cascata (quando um documento muda, quais outros são afetados)
- As proibições absolutas de atualização

### 3.2 O que este documento NÃO cobre

- O processo de aprovação das mudanças → ver `DOC-GOV-007`
- As regras de revisão periódica (proativa) → ver `DOC-GOV-008`
- Quando um documento deve ser obsoletado em vez de atualizado → ver `DOC-GOV-010`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Componente do sistema |
| DOC-GOV-003 | Modelo de Versionamento | aprovado | Atualização implica incremento de versão |
| DOC-GOV-005 | Categorias de Documentos | aprovado | Categoria determina o processo de atualização |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `referencia →` | DOC-GOV-003 | Modelo de Versionamento | Toda atualização incrementa a versão |
| `referencia →` | DOC-GOV-007 | Regras de Aprovação | Mudanças seguem o processo de aprovação |
| `referencia →` | DOC-GOV-011 | Política de Rastreabilidade | Atualizações devem ser rastreáveis |

---

## 6. Conteúdo Principal

### 6.1 Gatilhos de Atualização

Um documento **deve** ser atualizado quando qualquer um dos seguintes eventos ocorrer:

#### Gatilhos Obrigatórios (não atualizar é uma violação)

| # | Gatilho | Prazo para Atualização |
|---|---|---|
| G1 | Uma regra de negócio que o documento especifica foi alterada | 2 dias úteis após a decisão |
| G2 | Um documento do qual este depende (seção 4) foi alterado com impacto cascata | 5 dias úteis após o merge do documento pai |
| G3 | Uma integração ou contrato de API descrito no documento mudou | Antes do deploy da mudança |
| G4 | Um link interno no documento está quebrado (arquivo movido ou renomeado) | 2 dias úteis após identificação |
| G5 | O responsável (Autor) do documento mudou | 5 dias úteis após a mudança de responsável |
| G6 | Uma lei ou regulação que o documento implementa foi alterada | 5 dias úteis após publicação da alteração legal |

#### Gatilhos Recomendados (não atualizar gera débito documental)

| # | Gatilho | Prazo Recomendado |
|---|---|---|
| R1 | Um novo caso de uso foi identificado dentro do escopo do documento | Próxima sprint |
| R2 | Feedback de usuário revelou ambiguidade no documento | Próxima sprint |
| R3 | A implementação divergiu do especificado (o documento é a verdade — o código é corrigido, não o documento, exceto se houver ADR determinando o contrário) | Imediato |
| R4 | Termos foram adicionados ao Glossário que aparecem no documento sem referência | Próximo ciclo de revisão |

---

### 6.2 Classes de Atualização

#### Classe A — Correção Técnica (PATCH)

**Definição:** Mudanças que não alteram o significado, a decisão ou o comportamento
documentado. Apenas melhoram a forma.

**Exemplos:** Erros de digitação, links quebrados, reformatação de tabela, melhoria
de clareza sem mudança semântica.

**Processo:**
1. Qualquer membro da equipe pode abrir PR diretamente
2. 1 revisor é suficiente (pode ser o próprio Guardião)
3. Incremento de PATCH na versão
4. Entrada simples no Histórico de Alterações
5. Notificação: apenas Guardião e equipe do módulo

#### Classe B — Adição de Conteúdo (MINOR)

**Definição:** Novas informações adicionadas ao documento sem remover ou contradizer
o conteúdo existente.

**Exemplos:** Novo caso de uso, nova regra de negócio, nova integração documentada,
novo critério de aceitação, nova referência.

**Processo:**
1. Issue de atualização aberta com descrição do que será adicionado
2. PR com MINOR increment na versão
3. Aprovação conforme categoria do documento (ver `DOC-GOV-007`)
4. Avaliação de impacto cascata nos documentos relacionados
5. Notificação conforme categoria

#### Classe C — Alteração de Conteúdo (MINOR ou MAJOR)

**Definição:** Modificação de conteúdo existente que pode mudar o entendimento de leitores.

**Processo:**
- Se a mudança não contradiz a versão anterior: MINOR
- Se a mudança invalida conclusões tiradas da versão anterior: MAJOR
- Obrigatório: justificativa da mudança no PR
- Obrigatório: avaliação de impacto em todos os documentos relacionados
- Obrigatório: se houver ADR que motivou a mudança, referenciá-lo no PR
- Aprovação conforme categoria do documento (ver `DOC-GOV-007`)

#### Classe D — Reestruturação (MAJOR)

**Definição:** Reorganização significativa da estrutura do documento, mudança de
escopo ou reescrita substancial. A versão anterior não pode ser usada para entender
o estado atual.

**Processo:**
1. Issue de reestruturação aprovada pelo Arquiteto Líder antes de qualquer escrita
2. Se a reestruturação mudar decisões: criar ADR antes do PR
3. Branch dedicada: `docs/restructure/[ID]-[titulo-curto]`
4. PR com MAJOR increment obrigatório
5. Revisão com 1 nível de aprovação acima do normal para a categoria
6. Notificação ampla (equipe inteira para C1 e C2)
7. Todos os documentos que referenciam este devem ser avaliados para atualização

---

### 6.3 Atualização em Cascata

Quando um documento é alterado, o seguinte processo de impacto cascata é obrigatório:

```
DOCUMENTO ALTERADO
       │
       ├── 1. Listar todos os documentos que o referenciam (seção 5 de cada)
       │
       ├── 2. Para cada documento referenciador:
       │       ├── Avaliar se a mudança afeta o conteúdo daquele documento
       │       ├── Se SIM: abrir issue de atualização cascata (Classe A, B ou C)
       │       └── Se NÃO: registrar avaliação no PR original (campo "Impacto em Outros Documentos")
       │
       └── 3. O PR do documento alterado SOMENTE é mergeado quando:
               ├── Todas as atualizações cascata Obrigatórias (gatilhos G1-G6) estão em PR
               └── Ou quando o Arquiteto Líder autoriza merge com débito documental registrado em issue
```

---

### 6.4 Proibições Absolutas de Atualização

As seguintes ações nunca são permitidas, independente de autoridade ou urgência:

| # | Proibição |
|---|---|
| P1 | Editar diretamente a branch principal sem Pull Request |
| P2 | Alterar o ID de um documento (seção 1 — campo ID) |
| P3 | Apagar entradas do Histórico de Alterações (seção 11) |
| P4 | Alterar um ADR aprovado (criar novo ADR supersedente) |
| P5 | Alterar atas de reunião aprovadas (criar errata) |
| P6 | Remover um relacionamento da seção 5 sem justificativa documentada no Histórico |
| P7 | Alterar documentos Categoria 1 sem notificação prévia de 24h à equipe |

---

### 6.5 Janela de Atualização Emergencial

Em situações excepcionais (falha em produção, vulnerabilidade de segurança, mudança
legal urgente), o processo normal pode ser abreviado:

**Condições para uso da janela emergencial:**
- Impacto em produção ou risco legal ativo
- Autorização verbal do Arquiteto Líder (registrada em issue)

**Processo emergencial:**
1. Arquiteto Líder autoriza PR direto para branch principal
2. Aprovação de apenas 1 revisor (ao invés do mínimo da categoria)
3. Prazo de 4 horas para revisão
4. PR de normalização aberto em até 24h após merge, seguindo o processo normal
5. Incidente de processo registrado em `docs/09-decisions/DECISION_LOG.md`

---

## 7. Critérios de Aceitação

- [ ] Nenhum documento Categoria 1 foi alterado sem PR e aprovação documentada
- [ ] Todos os gatilhos G1-G6 têm SLA de atualização sendo monitorado pelo Guardião
- [ ] O processo de impacto cascata é executado em todo PR de Classe C ou D
- [ ] Nenhuma das Proibições Absolutas foi violada no histórico git

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Pull Request | `docs/01-governance/editorial-process.md` |
| Categoria de Documento | `DOC-GOV-005` |
| MAJOR / MINOR / PATCH | `DOC-GOV-003` — Modelo de Versionamento |
| Impacto Cascata | Este documento (seção 6.3) |
| ADR | `docs/02-architecture/adr/ADR-0000-template.md` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `docs/01-governance/approval-rules.md` | Aprovação após atualização |
| `docs/01-governance/versioning-model.md` | Incremento de versão |
| `docs/01-governance/traceability-policy.md` | Rastreabilidade de mudanças |

### 9.2 Referências Externas

N/A

---

## 10. Observações

A "Janela de Atualização Emergencial" (seção 6.5) deve ser monitorada. Se for acionada
mais de 2 vezes por trimestre, é sinal de que processos de negócio estão gerando
mudanças sem documentação antecipada — problema de processo, não de governança documental.

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Regras de atualização estabelecidas |
