# Regras de Arquivamento de Documentos — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-009 |
| **Título** | Regras de Arquivamento de Documentos do SOE |
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

Define como os documentos do SOE são preservados ao longo do tempo — tanto os que
continuam ativos quanto os que foram obsoletados ou descartados. O arquivamento
garante que o histórico de decisões, requisitos e especificações nunca se perde,
mesmo após anos de evolução do sistema.

No contexto deste projeto, arquivamento não significa exclusão — significa organização
controlada e preservação acessível da história documental. O Git é o arquivo primário;
esta política define como usá-lo corretamente para fins de preservação.

---

## 3. Escopo

### 3.1 O que este documento cobre

- O princípio geral de preservação histórica no Git
- Os prazos de retenção por categoria de documento
- O tratamento de documentos descartados antes da aprovação
- O tratamento de versões anteriores de documentos aprovados
- O processo de arquivamento de documentos obsoletos
- O acesso a documentos arquivados

### 3.2 O que este documento NÃO cobre

- Quando e por que um documento se torna obsoleto → ver `DOC-GOV-010`
- Arquivamento de código-fonte → responsabilidade do time de engenharia
- Arquivamento de dados de produção → ver `docs/06-data/data-lifecycle.md`
- Backup de infraestrutura → ver `docs/10-infrastructure/disaster-recovery.md`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Componente do sistema |
| DOC-GOV-005 | Categorias de Documentos | aprovado | Prazos de retenção definidos por categoria |
| DOC-GOV-010 | Regras de Obsolescência | aprovado | Obsolescência precede arquivamento |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `referencia →` | DOC-GOV-005 | Categorias | Prazos de retenção por categoria |
| `← referenciado por` | DOC-GOV-010 | Regras de Obsolescência | Obsolescência aciona arquivamento |
| `referencia →` | `docs/06-data/data-lifecycle.md` | Ciclo de Vida de Dados | Dados têm política similar e relacionada |

---

## 6. Conteúdo Principal

### 6.1 Princípio Fundamental — O Git como Arquivo

O repositório Git **é** o arquivo primário da documentação do SOE. Por design:

- Nenhum arquivo é fisicamente deletado do histórico Git (apenas do HEAD)
- Todo estado anterior de qualquer documento pode ser recuperado via hash de commit
- O histórico de commits é a trilha de auditoria da evolução documental
- **Nunca usar `git push --force` ou `git rebase` em commits já publicados**

Isto significa que "arquivar" um documento não é deletá-lo — é mover para uma
localização controlada e marcar com status adequado, preservando o histórico completo.

---

### 6.2 Prazos de Retenção no Diretório Ativo

"Diretório ativo" refere-se ao estado atual da branch principal — o que qualquer
pessoa vê ao clonar o repositório. Prazos abaixo determinam por quanto tempo um
documento obsoleto permanece visível no diretório ativo antes de ser movido para o
arquivo morto.

| Categoria | Prazo de Retenção no Ativo (após obsolescência) |
|---|---|
| **Categoria 1 — Fundacional** | Permanente no ativo (nunca movido) |
| **Categoria 2 — Estratégica** | 6 meses no ativo, depois movido para `archive/` |
| **Categoria 3 — Operacional** | 3 meses no ativo, depois movido para `archive/` |
| **Categoria 4 — Suporte** | 1 mês no ativo, depois movido para `archive/` |

**Documentos Categoria 1 obsoletos** permanecem em seus diretórios originais com
status `obsoleto` e banner de aviso visível. Jamais são movidos — sua localização
original faz parte da rastreabilidade histórica.

---

### 6.3 Estrutura do Arquivo Morto

Documentos removidos do diretório ativo são movidos para:

```
archive/
├── [AAAA]/                    ← ano em que o documento foi arquivado
│   ├── [categoria]/           ← categoria do documento arquivado
│   │   ├── [ID]-[titulo].md   ← documento arquivado (imutável)
│   │   └── [ID]-[titulo].md
│   └── ...
└── ...
```

**Exemplo:**
```
archive/
├── 2027/
│   ├── categoria-2/
│   │   └── RF-CRM-001-cadastro-de-cliente-v1.md
│   └── categoria-3/
│       └── CDU-CRM-005-exportar-contatos.md
└── 2028/
    └── ...
```

**Regras do arquivo morto:**
- Documentos no `archive/` são imutáveis — nenhuma edição é permitida
- O arquivo morto **não** está incluído no MASTER_INDEX ativo
- Um índice separado `archive/ARCHIVE_INDEX.md` lista todos os documentos arquivados
- Documentos arquivados continuam acessíveis e referenciáveis via caminho completo

---

### 6.4 Tratamento de Documentos Descartados (Nunca Aprovados)

Documentos que foram criados mas nunca aprovados (rascunhos abandonados) seguem
processo específico:

| Situação | Ação |
|---|---|
| Rascunho em branch não mergeada | Branch fechada sem merge; ID reservado permanece no MASTER_INDEX como "descartado" |
| Rascunho mergeado por engano | Revertido via PR de rollback; ID marcado como "descartado" |
| Rascunho abandonado há mais de 90 dias sem atividade | Guardião fecha a branch e marca ID como "descartado" após notificação ao autor |

**IDs descartados nunca são reutilizados** (ver `DOC-GOV-004`).

---

### 6.5 Versões Anteriores de Documentos Ativos

Para documentos que passaram por atualização MAJOR (ex: de `1.x.x` para `2.0.0`):

- A versão anterior não precisa ser arquivada manualmente — o Git preserva o histórico
- O Guardião cria uma tag Git no commit da última versão antes do MAJOR:
  `doc-[ID]-v[MAJOR-anterior].x.x-final`
- Isto permite recuperar rapidamente qualquer versão MAJOR anterior via `git checkout`
- Documento atualizado registra no Histórico de Alterações: "Supersede a versão `1.x.x`"

**Exemplo de tag:** `doc-RF-CRM-001-v1.4.2-final`

---

### 6.6 Retenção por Tipo de Conteúdo Especial

| Tipo | Retenção | Justificativa |
|---|---|---|
| ADRs | Permanente (nunca arquivados) | Registro imutável de decisões arquiteturais |
| Atas de Reunião | Permanente | Registro histórico de decisões corporativas |
| Relatórios de Incidente | Permanente | Requisito legal e de auditoria |
| Documentos LGPD | Mínimo 5 anos após obsolescência | Requisito LGPD Art. 37 (manutenção de registros) |
| Políticas de Segurança | Mínimo 5 anos após obsolescência | Requisito de auditoria de segurança |
| Contratos de API | 2 anos após desativação da API | Suporte a clientes e auditoria |

---

### 6.7 Acesso a Documentos Arquivados

- Documentos em `archive/` são acessíveis a todos com acesso ao repositório
- Busca via `git log --all --full-history -- [caminho]` para histórico completo
- O ARCHIVE_INDEX fornece índice navegável dos documentos arquivados
- Solicitações de recuperação de versão específica: abrir issue com label `archive-retrieval`

---

## 7. Critérios de Aceitação

- [ ] O diretório `archive/` existe e tem a estrutura definida na seção 6.3
- [ ] O `archive/ARCHIVE_INDEX.md` existe e lista todos os documentos arquivados
- [ ] Nenhum documento foi fisicamente deletado do histórico Git
- [ ] Tags Git existem para todas as versões MAJOR finais de documentos Categoria 1 e 2
- [ ] Documentos LGPD obsoletos têm retenção mínima de 5 anos confirmada

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Arquivo Morto | Este documento (seção 6.3) |
| Diretório Ativo | Este documento (seção 6.2) |
| Categoria de Documento | `DOC-GOV-005` |
| Obsolescência | `DOC-GOV-010` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `docs/01-governance/obsolescence-rules.md` | Processo que antecede o arquivamento |
| `docs/06-data/data-lifecycle.md` | Política de ciclo de vida de dados (análoga) |
| `docs/06-data/lgpd/retention-policy.md` | Retenção de dados pessoais (requisito legal) |

### 9.2 Referências Externas

| URL | Título |
|---|---|
| https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm | Lei 13.709/2018 (LGPD) — Art. 37 |
| https://www.iso.org/standard/73479.html | ISO 15489 — Gestão de Registros |

---

## 10. Observações

O diretório `archive/` não existe ainda — será criado quando o primeiro documento
for arquivado. O `ARCHIVE_INDEX.md` deve ser criado junto com o primeiro arquivamento.

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Regras de arquivamento estabelecidas |
