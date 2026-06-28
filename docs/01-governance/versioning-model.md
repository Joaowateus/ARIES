# Modelo de Versionamento Documental — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-003 |
| **Título** | Modelo de Versionamento Documental do SOE |
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

Define como os documentos do SOE evoluem ao longo do tempo de forma controlada,
previsível e rastreável. Estabelece o significado exato de cada número de versão,
os gatilhos que obrigam incremento de versão e as regras de transição entre
os estados do ciclo de vida documental.

Um modelo de versionamento consistente permite à equipe saber, ao olhar para um número
de versão, exatamente o quanto um documento mudou desde a última vez que foi lido —
sem precisar ler o Histórico de Alterações completo.

---

## 3. Escopo

### 3.1 O que este documento cobre

- O esquema de versionamento semântico aplicado a documentos (DocSemVer)
- O ciclo de vida completo de um documento e suas transições de status
- Os gatilhos que obrigam incremento de versão em cada componente (MAJOR, MINOR, PATCH)
- As regras de versionamento para tipos especiais de documento (ADRs, templates, atas)
- O relacionamento entre versão e status

### 3.2 O que este documento NÃO cobre

- Versionamento de código-fonte → usar SemVer padrão (https://semver.org)
- Versionamento de APIs → ver `docs/08-api/changelog/`
- Versionamento de schemas de banco de dados → ver `database/migrations/`
- O processo de aprovação que acompanha mudanças de versão → ver `DOC-GOV-007`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Este modelo é um componente daquele sistema |
| ADR-0001 | Template Oficial | aprovado | O campo Versão do template é regido por este modelo |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança Documental | Componente daquele sistema |
| `referencia →` | DOC-GOV-007 | Regras de Aprovação | Aprovação é gatilho de versão MAJOR |
| `referencia →` | DOC-GOV-010 | Regras de Obsolescência | Obsolescência é estado terminal do ciclo de vida |
| `← referenciado por` | `DOCUMENTATION_GUIDE.md` | Guia de Documentação | O guia aplica este modelo |
| `← referenciado por` | `templates/TEMPLATE-OFICIAL.md` | Template Oficial | O campo Versão segue este modelo |

---

## 6. Conteúdo Principal

### 6.1 O Esquema DocSemVer

O SOE adota **DocSemVer** — a aplicação dos princípios do Versionamento Semântico
(SemVer) ao contexto documental. A versão é composta por três números: `MAJOR.MINOR.PATCH`.

```
        MAJOR . MINOR . PATCH
          │       │       │
          │       │       └── Correções sem mudança de conteúdo
          │       └────────── Adições sem quebra de leitores existentes
          └────────────────── Mudanças que invalidam leituras anteriores
```

---

### 6.2 Significado de Cada Componente

#### MAJOR — Mudança Estrutural ou de Escopo

Incrementar MAJOR quando qualquer uma destas condições ocorrer:

| Gatilho | Exemplo |
|---|---|
| O escopo do documento muda significativamente | Documento de CRM passa a cobrir CRM + Comercial |
| Uma seção inteira é removida ou renomeada | Seção "Fluxo Principal" removida |
| Decisões anteriores são revertidas | RF que definia comportamento X agora define comportamento Y oposto |
| O documento é completamente reescrito | Novo entendimento do domínio invalida a versão anterior |
| O público-alvo do documento muda | Documento técnico reescrito para gestores |

**Regra de incremento MAJOR:** resetar MINOR e PATCH para zero.
`1.4.2 → 2.0.0`

**Atenção:** Incremento de MAJOR **não** significa que o documento anterior estava errado.
Significa que leitores da versão anterior precisam reler para ter o entendimento atual.

#### MINOR — Adição de Conteúdo

Incrementar MINOR quando qualquer uma destas condições ocorrer:

| Gatilho | Exemplo |
|---|---|
| Nova subseção adicionada | Adição de "Fluxo Alternativo 3" |
| Nova regra de negócio documentada | Nova BR adicionada ao business-rules.md |
| Novo relacionamento com outro documento | Seção 5 recebe novo item |
| Expansão de uma seção existente | Critérios de aceitação ganham novos itens |
| Novos atores ou casos de uso | Módulo ganha novo perfil de usuário |

**Regra de incremento MINOR:** resetar PATCH para zero, manter MAJOR.
`1.4.2 → 1.5.0`

#### PATCH — Correção Sem Mudança de Conteúdo

Incrementar PATCH quando qualquer uma destas condições ocorrer:

| Gatilho | Exemplo |
|---|---|
| Correção de erros de digitação ou gramaticais | Typos corrigidos |
| Melhoria de clareza sem mudança de significado | Frase reescrita para ficar mais clara |
| Atualização de links internos quebrados | Caminho de arquivo corrigido |
| Atualização de referências a outros documentos | ID de documento referenciado atualizado |
| Formatação sem alteração de conteúdo | Tabela reformatada |

**Regra de incremento PATCH:** manter MAJOR e MINOR.
`1.4.2 → 1.4.3`

---

### 6.3 Ciclo de Vida de um Documento

```
                    ┌─────────────┐
                    │   PROPOSTA  │ (Issue aberta — sem versão ainda)
                    └──────┬──────┘
                           │ Guardião atribui autor e ID
                           ▼
                    ┌─────────────┐
                    │  RASCUNHO   │ versão 0.x.x
                    │  (draft)    │ Autor redige. PR não aberto.
                    └──────┬──────┘
                           │ Autor abre PR
                           ▼
                    ┌─────────────┐
                    │ EM REVISÃO  │ versão 0.x.x (mesma do rascunho)
                    │(em-revisão) │ Revisores analisam. Autor corrige.
                    └──────┬──────┘
                           │ Aprovação via PR (mínimo de revisores atingido)
                           ▼
                    ┌─────────────┐
                    │  APROVADO   │ versão 1.0.0 (primeira aprovação)
                    │ (aprovado)  │ Merge na branch principal.
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
    ┌─────────────────┐       ┌─────────────────┐
    │  ATUALIZAÇÃO    │       │   OBSOLESCÊNCIA  │
    │  (novo PR)      │       │   (PR final)     │
    │  versão 1.x.x   │       │   status=obsoleto│
    │  ou 2.0.0       │       └─────────────────┘
    └────────┬────────┘
             │
             └──── retorna a "APROVADO" após merge
```

---

### 6.4 Tabela de Versão por Status

| Status | Faixa de Versão Permitida | Transição |
|---|---|---|
| `rascunho` | `0.1.0` até `0.99.99` | → `em-revisão` quando PR é aberto |
| `em-revisão` | Mesma versão do rascunho submetido | → `aprovado` quando PR é aceito |
| `aprovado` | `1.0.0` ou superior | → `aprovado` (nova versão) ou → `obsoleto` |
| `obsoleto` | Versão congelada | Estado terminal — não há mais transições |

**Regra de ouro:** Nenhum documento pode ir de `rascunho` diretamente para `aprovado`
sem passar por `em-revisão`. O processo de revisão é obrigatório.

---

### 6.5 Regras Especiais por Tipo de Documento

#### ADRs (Architecture Decision Records)

ADRs são **imutáveis após aprovação**. Nunca incrementam versão após `1.0.0`.
Se uma decisão muda, um novo ADR é criado referenciando e supersedendo o anterior.
O ADR original é marcado como `obsoleto` com link para o novo.

#### Templates

Templates seguem o versionamento normal, mas com regra adicional:
qualquer mudança que force atualização em documentos existentes que usam o template
é obrigatoriamente um incremento de MAJOR.

#### Atas de Reunião

Atas são imutáveis após aprovação. Versão sempre `1.0.0`. Correções são feitas
via errata (novo documento com ID `ATA-YYYY-NNN-errata`).

#### Documentos de Módulo em Construção

Módulos em desenvolvimento ativo podem manter versão `0.x.x` por até 90 dias.
Após este prazo, o documento deve ser aprovado (`1.0.0`) ou descartado.

---

### 6.6 Controle de Versão no Git

| Versão do Documento | Prática Git |
|---|---|
| `0.1.0` (criação) | Branch `docs/[ID]-[titulo-curto]` |
| `0.x.x` (rascunho iterativo) | Commits na mesma branch com mensagem `docs(rascunho): [ID] [descrição]` |
| `1.0.0` (primeira aprovação) | Merge na branch principal via PR aprovado |
| `1.x.x` (atualização menor) | Novo PR com título `docs(update): [ID] v1.x.x - [descrição]` |
| `2.0.0` (reestruturação) | Novo PR com título `docs(major): [ID] v2.0.0 - [descrição]` |
| Obsolescência | PR com título `docs(obsolete): [ID] - substituído por [novo ID]` |

---

## 7. Critérios de Aceitação

- [ ] Todo documento no repositório tem versão no formato `MAJOR.MINOR.PATCH`
- [ ] Nenhum documento `aprovado` tem versão `0.x.x`
- [ ] Nenhum documento `rascunho` tem versão `1.0.0` ou superior
- [ ] Todo incremento de MAJOR tem entrada descritiva no Histórico de Alterações
- [ ] ADRs aprovados nunca têm versão diferente de `1.0.0`
- [ ] O PR template verifica conformidade de versão com status

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| SemVer | https://semver.org/lang/pt-BR/ |
| ADR | `docs/02-architecture/adr/ADR-0000-template.md` |
| Pull Request | `docs/01-governance/editorial-process.md` |
| Ciclo de vida documental | Este documento (seção 6.3) |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `docs/01-governance/document-governance.md` | Sistema de Governança Documental |
| `docs/01-governance/approval-rules.md` | Regras de Aprovação (DOC-GOV-007) |
| `docs/01-governance/obsolescence-rules.md` | Regras de Obsolescência (DOC-GOV-010) |

### 9.2 Referências Externas

| URL | Título |
|---|---|
| https://semver.org/lang/pt-BR/ | Especificação SemVer 2.0.0 |
| https://keepachangelog.com/pt-BR/1.0.0/ | Keep a Changelog |

---

## 10. Observações

N/A

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Modelo de versionamento documental estabelecido |
