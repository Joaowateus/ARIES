# Sistema de Relacionamento entre Documentos — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-012 |
| **Título** | Sistema de Relacionamento entre Documentos do SOE |
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

Define o sistema formal para declarar, classificar e manter os relacionamentos entre
documentos do SOE. Um relacionamento bem definido é mais do que um link — ele comunica
a natureza da dependência, a direção da influência e o impacto de uma mudança em um
documento sobre o outro.

O conjunto de todos os relacionamentos declarados forma o **Grafo de Conhecimento do SOE**:
uma rede onde cada nó é um documento e cada aresta é um relacionamento tipado e direcionado.
Este grafo é o que torna possível responder a perguntas como "o que é afetado se eu mudar X?"
de forma completa e precisa.

---

## 3. Escopo

### 3.1 O que este documento cobre

- Os tipos de relacionamento reconhecidos e seus significados precisos
- As regras de direção e bidirecionalidade dos relacionamentos
- Como declarar relacionamentos no Template Oficial (seção 5)
- O Grafo de Conhecimento do SOE e como ele é mantido
- Os padrões de relacionamento por tipo de documento
- Como relacionamentos afetam o processo de atualização em cascata

### 3.2 O que este documento NÃO cobre

- O sistema de IDs usado nas referências → ver `DOC-GOV-004`
- A rastreabilidade vertical entre níveis → ver `DOC-GOV-011`
- As regras de atualização cascata que os relacionamentos implicam → ver `DOC-GOV-006`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Componente do sistema |
| DOC-GOV-004 | Sistema de Identificação | aprovado | IDs são usados para identificar os nós do grafo |
| ADR-0001 | Template Oficial | aprovado | A seção 5 do template é onde os relacionamentos são declarados |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `referencia →` | DOC-GOV-004 | Sistema de Identificação | IDs identificam os documentos relacionados |
| `referencia →` | DOC-GOV-006 | Regras de Atualização | Relacionamentos determinam impacto cascata |
| `referencia →` | DOC-GOV-011 | Política de Rastreabilidade | Relacionamentos formam o grafo de rastreabilidade |
| `← referenciado por` | `templates/TEMPLATE-OFICIAL.md` | Template Oficial | A seção 5 do template implementa este sistema |

---

## 6. Conteúdo Principal

### 6.1 Taxonomia de Tipos de Relacionamento

O sistema reconhece **oito tipos de relacionamento**, cada um com semântica precisa:

---

#### `origina →` / `← origina-se de`

**Semântica:** O documento de origem (A) é o motivo de existência do documento de destino (B).
B não existiria sem A. A define o "por quê" de B.

**Impacto de mudança:** Mudança em A pode invalidar B completamente.
Mudança em B não afeta A.

**Exemplos:**
- `vision.md` `origina →` `scope.md` (visão origina o escopo)
- `ADR-0001` `origina →` `DOCUMENTATION_GUIDE.md` (decisão originou o guia)
- `RF-CRM-001` `origina →` `CDU-CRM-001` (requisito originou caso de uso)

**Bidirecionalidade:** Obrigatória. B deve listar `← origina-se de` A.

---

#### `implementa →` / `← implementado por`

**Semântica:** O documento A detalha como o conceito, política ou decisão descrita em
B é colocado em prática. A é mais concreto que B.

**Impacto de mudança:** Mudança em B provavelmente exige atualização de A.
Mudança em A não necessariamente afeta B.

**Exemplos:**
- `DOC-GOV-007` `implementa →` `DOC-GOV-002` (regras de aprovação implementam a governança)
- `API-CRM-001` `implementa →` `RF-CRM-001` (contrato de API implementa o requisito)
- `CDT-CRM-001` `implementa →` `PLT-CRM-001` (caso de teste implementa o plano de teste)

**Bidirecionalidade:** Obrigatória.

---

#### `refina →` / `← refinado por`

**Semântica:** O documento A aprofunda, detalha ou especifica mais precisamente algo
que B enuncia de forma mais geral. A e B tratam do mesmo assunto — A em maior granularidade.

**Impacto de mudança:** Mudança em B pode exigir atualização de A.
Mudança em A raramente afeta B.

**Exemplos:**
- `docs/05-modules/crm/business-rules.md` `refina →` `RF-CRM-001`
- `docs/03-domain/ubiquitous-language.md` `refina →` `docs/00-project/glossary.md`
- `CDU-CRM-001` `refina →` `MOD-CRM-001`

**Bidirecionalidade:** Obrigatória para C1 e C2; recomendada para C3.

---

#### `depende de →` / `← depende de`

**Semântica:** O documento A não pode ser completado, aprovado ou implementado sem que
B exista e esteja aprovado. É uma dependência funcional, não apenas referencial.

**Impacto de mudança:** Mudança em B pode bloquear ou invalidar A.
Mudança em A não afeta B.

**Nota:** Este tipo normalmente vai na seção 4 (Dependências) do template, não na seção 5
(Relacionamentos). Use na seção 5 quando a dependência é de conteúdo, não de processo.

**Exemplos:**
- `RN-FIN-001` `depende de →` `RF-FIN-001` (regra não existe sem o requisito)
- `INT-EXT-001` `depende de →` `API-CRM-001` (integração depende do contrato de API)

**Bidirecionalidade:** Obrigatória.

---

#### `supersede →` / `← supersedido por`

**Semântica:** O documento A substitui B integralmente. B se torna obsoleto quando A
é aprovado. Usado exclusivamente em ADRs e templates revisados.

**Impacto de mudança:** Aprovação de A torna B obsoleto (aciona `DOC-GOV-010`).

**Exemplos:**
- `ADR-0002` `supersede →` `ADR-0001` (nova decisão substitui a anterior)
- `TEMPLATE-OFICIAL-v2.md` `supersede →` `TEMPLATE-OFICIAL.md`

**Bidirecionalidade:** Obrigatória. B recebe `← supersedido por` A no banner de obsolescência.

---

#### `complementa →` / `← complementado por`

**Semântica:** Os documentos A e B se complementam — juntos formam uma especificação
completa que nenhum deles fornece sozinho. Nenhum supersede o outro.

**Impacto de mudança:** Mudança em um pode afetar o outro. Ambos devem ser avaliados.

**Exemplos:**
- `docs/09-security/security-policy.md` `complementa →` `docs/04-requirements/non-functional/security.md`
- `docs/03-domain/ubiquitous-language.md` `complementa →` `docs/00-project/glossary.md`

**Bidirecionalidade:** Obrigatória.

---

#### `referencia →` / `← referenciado por`

**Semântica:** O documento A menciona ou usa informações de B, mas sem dependência forte.
A pode existir sem B, mas B fornece contexto útil ou define termos usados em A.

**Impacto de mudança:** Mudança em B pode requerer atualização de A (ex: link quebrado,
termo redefinido). Avaliação de impacto é recomendada, não obrigatória.

**Exemplos:**
- `RF-CRM-001` `referencia →` `docs/00-project/glossary.md`
- `DOC-GOV-007` `referencia →` `docs/01-governance/roles-and-responsibilities.md`

**Bidirecionalidade:** Recomendada para C1 e C2; opcional para C3 e C4.

---

#### `contém →` / `← contido em`

**Semântica:** O documento B é um componente, subseção ou instância de A.
A é o índice ou a visão geral; B é uma entrada específica.

**Impacto de mudança:** Mudança em A (ex: remoção de B da lista) marca B para revisão.

**Exemplos:**
- `docs/13-ai-agents/agent-catalog.md` `contém →` `AGT-CRM-001`
- `MASTER_INDEX.md` `contém →` todos os documentos do projeto
- `docs/05-modules/crm/` `contém →` `CDU-CRM-001`

**Bidirecionalidade:** Obrigatória (B declara `← contido em` A).

---

### 6.2 Tabela Resumida dos Tipos

| Tipo | Direção | Impacto de Mudança no Origem | Bidicional? |
|---|---|---|---|
| `origina` | A → B | Alto: pode invalidar B | Obrigatória |
| `implementa` | A → B (A mais concreto) | Médio: B muda → A provavelmente muda | Obrigatória |
| `refina` | A → B (A mais detalhado) | Médio: B muda → avaliar A | C1/C2: obrigatória |
| `depende de` | A → B (A precisa de B) | Alto: B muda → A pode ser bloqueado | Obrigatória |
| `supersede` | A → B (A substitui B) | Terminal: B torna-se obsoleto | Obrigatória |
| `complementa` | A ↔ B (simbiótico) | Médio: avaliar ambos | Obrigatória |
| `referencia` | A → B (A usa B) | Baixo: verificar links e termos | C1/C2: obrigatória |
| `contém` | A → B (A é pai) | Baixo: verificar consistência | Obrigatória |

---

### 6.3 Regras de Declaração de Relacionamentos

#### Regra 1 — Localização

Todos os relacionamentos são declarados na **seção 5 do Template Oficial**, na tabela de
relacionamentos. Não há outros locais válidos para declarar relacionamentos formais.

#### Regra 2 — Formato Obrigatório

Cada relacionamento deve seguir exatamente o formato da tabela do template:

```
| Direção   | ID      | Título         | Natureza do Relacionamento       |
|-----------|---------|----------------|----------------------------------|
| origina → | RF-001  | Requisito X    | Este ADR originou este requisito |
```

- **Direção:** usar exatamente os termos da taxonomia (seção 6.1)
- **ID:** ID único do documento relacionado (ver `DOC-GOV-004`)
- **Título:** título atual do documento relacionado
- **Natureza:** frase curta explicando por que o relacionamento existe

#### Regra 3 — Bidirecionalidade

Quando A declara relacionamento com B, B deve declarar o relacionamento recíproco com A.
A verificação de bidirecionalidade é parte do checklist de revisão (`DOC-GOV-008`).

**Exceção permitida:** Documentos de Categoria 4 (suporte) podem ter relacionamentos
unidirecionais quando a bidirecionalidade seria impraticável (ex: uma ata que referencia
50 documentos não exige que todos os 50 referenciem a ata).

#### Regra 4 — Atualização de Relacionamentos

Quando um documento referenciado muda de ID (não deveria ocorrer — IDs são imutáveis,
ver `DOC-GOV-004`), ou quando um documento é movido de localização, todos os documentos
que o referenciam devem ser atualizados via PR de Classe A (PATCH).

#### Regra 5 — Relacionamentos Pendentes

Quando um documento é criado e referencia um documento que ainda não existe (previsto
mas não criado), o relacionamento é declarado com nota `[pendente — DOC-XXX-NNN]`.
A issue de criação do documento pendente deve ser aberta imediatamente.

---

### 6.4 O Grafo de Conhecimento do SOE

O conjunto de todos os relacionamentos declarados forma o Grafo de Conhecimento do SOE
(GCS). O GCS é:

- **Dirigido:** as arestas têm direção (A → B)
- **Tipado:** cada aresta tem um tipo da taxonomia (seção 6.1)
- **Vivo:** cresce com o projeto
- **Auditável:** todo nó e aresta tem rastreabilidade no Git

**Representação:** O GCS não é um arquivo separado — ele é a agregação das seções 5
de todos os documentos do repositório. O `scripts/generate-index.sh` pode gerar uma
representação visual do grafo a partir das seções 5.

**Propriedades desejáveis do GCS:**
- Nenhum documento isolado (sem relacionamentos) — documentos sem conexões são suspeitos
- Ausência de ciclos no tipo `origina` (A origina B que origina A = problema de design)
- Cada documento Categoria 1 tem grau de entrada alto (muitos documentos dependem dele)
- Documentos obsoletos têm todos os seus relacionamentos atualizados para o substituto

---

### 6.5 Padrões de Relacionamento por Tipo de Documento

#### Padrão de um Requisito Funcional (RF)

```
vision.md  ←origina-se de──  RF-XXX-NNN  ──origina→  CDU-XXX-NNN
                                │
                                ├──referencia→  glossary.md
                                ├──referencia→  RNF relevante
                                └──referencia→  RN-XXX-NNN (se impuser regra)
```

#### Padrão de um ADR

```
principles.md  ←implementa──  ADR-XXXX  ──origina→  documentos afetados
                                  │
                                  └──supersede→  ADR anterior (se aplicável)
```

#### Padrão de uma Especificação de Módulo

```
scope.md  ←refina──  MOD-XXX-001  ──origina→  CDU-XXX-NNN
                          │                    RN-XXX-NNN
                          │                    DAT-XXX-NNN
                          │
                          ├──complementa→  módulos relacionados
                          └──referencia→   bounded-contexts.md
```

---

## 7. Critérios de Aceitação

- [ ] Todos os documentos aprovados têm pelo menos um relacionamento declarado na seção 5
- [ ] Todos os relacionamentos obrigatoriamente bidirecionais são bidirecionais
- [ ] Não existem relacionamentos com tipo fora da taxonomia da seção 6.1
- [ ] O script `validate-docs.sh` verifica bidirecionalidade sem reportar violações
- [ ] Nenhum documento aprovado tem status `supersede` sem o documento original marcado como obsoleto

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Grafo de Conhecimento do SOE (GCS) | Este documento (seção 6.4) |
| Bidirecionalidade | Este documento (seção 6.3 — Regra 3) |
| Taxonomia de Relacionamentos | Este documento (seção 6.1) |
| ID de Documento | `DOC-GOV-004` |
| Rastreabilidade | `DOC-GOV-011` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `templates/TEMPLATE-OFICIAL.md` | Seção 5 — onde os relacionamentos são declarados |
| `DOC-GOV-004` | Sistema de Identificação — IDs usados nos relacionamentos |
| `DOC-GOV-006` | Atualização Cascata — consequência dos relacionamentos |
| `DOC-GOV-011` | Política de Rastreabilidade — grafo como instrumento de rastreabilidade |
| `scripts/generate-index.sh` | Geração de representação do grafo |

### 9.2 Referências Externas

| URL | Título |
|---|---|
| https://en.wikipedia.org/wiki/Traceability_matrix | Matriz de Rastreabilidade |
| https://www.w3.org/TR/skos-reference/ | SKOS — referência para tipagem de relacionamentos semânticos |

---

## 10. Observações

N/A

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Sistema de relacionamento estabelecido |
