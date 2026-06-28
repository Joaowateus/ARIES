# Pull Request — SOE MM Negócios

---

## Identificação

| Campo | Valor |
|---|---|
| **Tipo de Mudança** | `documento-novo` / `revisão-de-documento` / `correção` / `migração-de-template` / `estrutura` / `outro` |
| **Documentos Afetados** | [Listar IDs e caminhos] |
| **Issue Relacionada** | Closes # |
| **Revisor Solicitado** | @[username] |

---

## Descrição da Mudança

> Em 2-3 frases: o que muda, por que muda e qual problema resolve.

---

## Checklist de Conformidade Documental

> Marque cada item. Pull Requests com itens não marcados não serão aprovados.

### Conformidade com o Template Oficial (`templates/TEMPLATE-OFICIAL.md`)

- [ ] O documento usa exatamente o `TEMPLATE-OFICIAL.md` como base
- [ ] **Seção 1 — Identificação:** todos os 11 campos estão preenchidos (sem `[placeholder]`)
- [ ] **Seção 1 — ID:** segue o padrão `[PREFIXO]-[MÓDULO]-[SEQUENCIAL]` definido em `DOCUMENTATION_GUIDE.md`
- [ ] **Seção 1 — Versão:** segue SemVer conforme o status do documento
- [ ] **Seção 1 — Status:** é um dos quatro valores válidos (`rascunho` / `em-revisão` / `aprovado` / `obsoleto`)
- [ ] **Seção 2 — Objetivo:** responde *por que o documento existe* de forma clara e autossuficiente
- [ ] **Seção 3 — Escopo:** define o que está dentro E o que NÃO está coberto
- [ ] **Seção 4 — Dependências:** todas as dependências listadas estão com status `aprovado`
- [ ] **Seção 5 — Relacionamentos:** pelo menos um relacionamento listado; todos com direção indicada
- [ ] **Seção 7 — Critérios de Aceitação:** todos os critérios verificados pelo autor antes de abrir o PR
- [ ] **Seção 8 — Glossário:** todos os termos técnicos do documento estão referenciados
- [ ] **Seção 11 — Histórico:** entrada adicionada para esta versão (se versão ≥ `1.0.0`)
- [ ] Blocos de instrução do template foram removidos do documento

### Consistência com o Repositório

- [ ] O nome do arquivo segue as convenções de `docs/01-governance/naming-conventions.md`
- [ ] O documento está no diretório correto conforme a estrutura do repositório
- [ ] Todos os links internos (`docs/caminho/arquivo.md`) estão válidos e apontam para arquivos existentes
- [ ] Referências bidirecionais: se este doc lista outro nos Relacionamentos, o outro lista este também
- [ ] Nenhum conteúdo foi duplicado de outro documento (usar referência, não cópia)

### Qualidade do Conteúdo

- [ ] Linguagem em português brasileiro, ativa, direta e sem ambiguidades
- [ ] Nenhuma decisão arquitetural nova foi tomada sem ADR correspondente
- [ ] Termos do domínio usados estão em `docs/00-project/glossary.md` ou `docs/03-domain/ubiquitous-language.md`
- [ ] O documento é compreensível por um novo membro da equipe sem contexto adicional

### Para documentos com status `aprovado`

- [ ] Pelo menos 1 revisor (além do autor) aprovou via GitHub Review
- [ ] Para documentos de prioridade `crítica`: aprovação do Arquiteto Líder confirmada
- [ ] `MASTER_INDEX.md` foi atualizado com este documento

---

## Impacto em Outros Documentos

> Liste quaisquer documentos que precisam ser atualizados como consequência desta mudança.

| Documento | Ação Necessária | Responsável |
|---|---|---|
| [Caminho] | [O que precisa mudar] | [Nome] |

---

## Observações para o Revisor

> Contexto adicional que o revisor precisa para avaliar este PR.

---

*Este PR segue o processo definido em `docs/01-governance/editorial-process.md`
e o padrão estabelecido em `DOCUMENTATION_GUIDE.md`.*
