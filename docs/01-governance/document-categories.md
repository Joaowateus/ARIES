# Categorias de Documentos — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-005 |
| **Título** | Categorias de Documentos do SOE |
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

Classifica todos os documentos do SOE em categorias que determinam seu nível de
criticidade, o processo de aprovação aplicável, a frequência de revisão obrigatória,
quem tem autoridade para aprová-los e o prazo de retenção após obsolescência.

As categorias não substituem os tipos de documento (RF, ADR, MOD, etc.) — elas se
sobrepõem a eles. Um `RF-CRM-001` pode ser Categoria 1 ou Categoria 2 dependendo de
seu impacto. Conhecer a categoria de um documento é saber imediatamente o rigor
de governança que deve ser aplicado a ele.

---

## 3. Escopo

### 3.1 O que este documento cobre

- As quatro categorias de documentos e seus critérios de classificação
- Os atributos de governança definidos por categoria (aprovação, revisão, retenção)
- O processo de classificação de novos documentos
- O processo de reclassificação quando o impacto de um documento muda

### 3.2 O que este documento NÃO cobre

- O processo detalhado de aprovação → ver `DOC-GOV-007`
- A frequência de revisão periódica → ver `DOC-GOV-008`
- As regras de arquivamento → ver `DOC-GOV-009`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Categorias são componente do sistema |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `implementa →` | DOC-GOV-007 | Regras de Aprovação | Aprovação varia por categoria |
| `implementa →` | DOC-GOV-008 | Regras de Revisão | Frequência de revisão varia por categoria |
| `implementa →` | DOC-GOV-009 | Regras de Arquivamento | Retenção varia por categoria |
| `referencia →` | DOC-GOV-004 | Sistema de Identificação | Categorias embasam os prefixos de ID |

---

## 6. Conteúdo Principal

### 6.1 As Quatro Categorias

```
CATEGORIA 1 — FUNDACIONAL
  ↓
CATEGORIA 2 — ESTRATÉGICA
  ↓
CATEGORIA 3 — OPERACIONAL
  ↓
CATEGORIA 4 — SUPORTE
```

A hierarquia é de impacto: documentos Categoria 1 afetam o projeto inteiro;
documentos Categoria 4 afetam apenas um processo ou tarefa específica.

---

### 6.2 Categoria 1 — Fundacional

#### Definição
Documentos que definem as bases imutáveis do projeto. Sua alteração tem impacto
cascata em todos os outros documentos. São a pedra angular sobre a qual tudo é construído.

#### Critérios de Classificação
Um documento é Categoria 1 se atender a **pelo menos dois** dos critérios abaixo:

- [ ] Sua alteração exige revisão de mais de 50% dos documentos do projeto
- [ ] Sua ausência impede a criação de qualquer documento de outra categoria
- [ ] Define identidade, propósito ou limites do sistema como um todo
- [ ] É referenciado por documentos de todas as outras categorias
- [ ] Sua invalidade colocaria em risco a conformidade legal do projeto

#### Exemplos de Documentos Categoria 1

| ID | Documento |
|---|---|
| DOC-GOV-001 | DOCUMENTATION_GUIDE |
| DOC-GOV-002 | Sistema de Governança Documental |
| ADR-* | Todos os ADRs |
| `docs/00-project/vision.md` | Visão do Projeto |
| `docs/00-project/scope.md` | Escopo do Projeto |
| `docs/02-architecture/principles.md` | Princípios de Engenharia |
| `docs/09-security/security-policy.md` | Política de Segurança |
| `docs/06-data/lgpd/data-mapping.md` | Mapeamento LGPD |
| `templates/TEMPLATE-OFICIAL.md` | Template Oficial |

#### Atributos de Governança — Categoria 1

| Atributo | Regra |
|---|---|
| **Aprovadores mínimos** | Arquiteto Líder + 1 membro da Diretoria Executiva |
| **Prazo de revisão** | Mínimo de revisão semestral |
| **Prazo para PR** | Máximo 5 dias úteis para revisão completa |
| **Retroatividade** | Mudanças em C1 devem ser avaliadas contra todos os documentos que referenciam o documento alterado |
| **Retenção pós-obsolescência** | Permanente — nunca pode ser excluído do histórico git |
| **Notificação** | Toda alteração notifica TODA a equipe |

---

### 6.3 Categoria 2 — Estratégica

#### Definição
Documentos que definem como o sistema funciona em alto nível: especificações de módulo,
requisitos funcionais críticos, políticas de segurança por módulo, contratos de
integração e decisões de design importantes. Afetam uma área ou módulo inteiro.

#### Critérios de Classificação
Um documento é Categoria 2 se atender a **pelo menos dois** dos critérios abaixo:

- [ ] Afeta o comportamento de um módulo inteiro ou de uma integração crítica
- [ ] É base para mais de 10 documentos de Categoria 3
- [ ] Define comportamento que impacta múltiplos usuários ou sistemas externos
- [ ] Sua alteração exige atualização de contratos de API ou banco de dados
- [ ] Contém regras de negócio que afetam receita, conformidade legal ou segurança

#### Exemplos de Documentos Categoria 2

| Tipo | Exemplo |
|---|---|
| Especificação de Módulo | `docs/05-modules/crm/overview.md` |
| Requisitos Funcionais críticos | `RF-FIN-001` (regra de DRE) |
| Contratos de API | `API-CRM-001` |
| Contratos de Integração | `INT-EXT-001` |
| Modelo de Dados por módulo | `DAT-CRM-001` |
| Regras de Negócio | `RN-FIN-001` |

#### Atributos de Governança — Categoria 2

| Atributo | Regra |
|---|---|
| **Aprovadores mínimos** | Arquiteto Líder + Líder do Módulo afetado |
| **Prazo de revisão** | Trimestral, ou a cada release que afete o módulo |
| **Prazo para PR** | Máximo 3 dias úteis para revisão |
| **Retroatividade** | Mudanças devem ser avaliadas contra documentos do mesmo módulo |
| **Retenção pós-obsolescência** | 5 anos |
| **Notificação** | Líderes de módulos dependentes + time de arquitetura |

---

### 6.4 Categoria 3 — Operacional

#### Documentos que especificam comportamentos individuais, casos de uso, requisitos
funcionais de baixo impacto, planos de teste, runbooks e procedimentos.
Afetam funcionalidades específicas ou operações pontuais.

#### Critérios de Classificação
Um documento é Categoria 3 se atender à maioria dos critérios abaixo:

- [ ] Afeta um caso de uso, uma funcionalidade ou um procedimento específico
- [ ] É referenciado por menos de 10 outros documentos
- [ ] Pode ser alterado sem impacto em contratos de API ou banco de dados
- [ ] Não contém regras de negócio que afetam diretamente receita ou compliance

#### Exemplos de Documentos Categoria 3

| Tipo | Exemplo |
|---|---|
| Casos de Uso individuais | `CDU-CRM-001` |
| Requisitos Funcionais de baixo impacto | `RF-ADM-001` |
| Planos de Teste | `PLT-CRM-001` |
| Runbooks operacionais | `RUN-OPS-001` |
| Jornadas de UX | `JOR-CRM-001` |
| Especificações de Workflow | `WFL-FIN-001` |
| Especificações de Agente | `AGT-CRM-001` |

#### Atributos de Governança — Categoria 3

| Atributo | Regra |
|---|---|
| **Aprovadores mínimos** | Líder do Módulo + 1 revisor par |
| **Prazo de revisão** | A cada 6 meses ou quando o módulo mudar de versão MAJOR |
| **Prazo para PR** | Máximo 2 dias úteis para revisão |
| **Retroatividade** | Impacto avaliado apenas no escopo do módulo |
| **Retenção pós-obsolescência** | 2 anos |
| **Notificação** | Time do módulo afetado |

---

### 6.5 Categoria 4 — Suporte

#### Definição
Documentos de apoio ao processo: atas de reunião, relatórios de incidente, notas
de decisão, documentos temporários, análises exploratórias e registros de contexto.
Não definem comportamento do sistema — registram o que aconteceu ou apoiam decisões.

#### Critérios de Classificação
Um documento é Categoria 4 se atender à maioria dos critérios abaixo:

- [ ] Registra um fato passado (reunião, incidente, exploração)
- [ ] Não é fonte de verdade para implementação
- [ ] Perde relevância com o tempo (atas, relatórios pontuais)
- [ ] Não é referenciado por documentos de Categoria 1 ou 2

#### Exemplos de Documentos Categoria 4

| Tipo | Exemplo |
|---|---|
| Atas de Reunião | `ATA-2026-001` |
| Relatórios de Incidente | `INC-2026-001` |
| Registros de contexto | `docs/01-governance/meeting-notes/` |
| Análises exploratórias | Documentos de spike/pesquisa |

#### Atributos de Governança — Categoria 4

| Atributo | Regra |
|---|---|
| **Aprovadores mínimos** | 1 revisor (pode ser o próprio autor para atas) |
| **Prazo de revisão** | Não aplicável — documentos de registro histórico são imutáveis |
| **Prazo para PR** | Máximo 1 dia útil |
| **Retroatividade** | Não aplicável |
| **Retenção pós-obsolescência** | 1 ano para análises exploratórias; permanente para atas e incidentes |
| **Notificação** | Participantes do contexto registrado |

---

### 6.6 Tabela Comparativa de Categorias

| Atributo | Cat. 1 — Fundacional | Cat. 2 — Estratégica | Cat. 3 — Operacional | Cat. 4 — Suporte |
|---|---|---|---|---|
| **Impacto** | Projeto inteiro | Módulo / integração | Funcionalidade / proc. | Registro / apoio |
| **Aprovadores** | Arquiteto + Diretoria | Arquiteto + Líder Módulo | Líder Módulo + par | 1 revisor |
| **Revisão** | Semestral | Trimestral / por release | Semestral por módulo | N/A |
| **Prazo PR** | 5 dias úteis | 3 dias úteis | 2 dias úteis | 1 dia útil |
| **Retenção** | Permanente | 5 anos | 2 anos | 1 ano / permanente |
| **Notificação** | Toda a equipe | Módulos dependentes | Time do módulo | Participantes |

---

### 6.7 Processo de Classificação

1. **Ao propor um documento:** o autor sugere a categoria na issue de criação
2. **Na triagem:** o Guardião valida a categoria usando os critérios desta seção
3. **Em caso de dúvida:** classificar sempre na categoria mais alta (mais restritiva)
4. **Reclassificação:** se o impacto de um documento crescer, o Guardião pode reclassificá-lo
   upward. A reclassificação downward exige aprovação do Arquiteto Líder.
5. **A categoria é registrada** no campo "Prioridade" do Template Oficial usando os
   termos: `crítica` (C1), `alta` (C2), `média` (C3), `baixa` (C4)

---

## 7. Critérios de Aceitação

- [ ] Todo documento aprovado no repositório tem categoria definida (via campo Prioridade)
- [ ] Documentos Categoria 1 têm todos os aprovadores mínimos registrados no histórico do PR
- [ ] Nenhum documento Categoria 1 foi aprovado sem revisão da Diretoria Executiva
- [ ] A tabela comparativa está sendo aplicada nos processos de revisão e aprovação

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| Guardião da Documentação Técnica | `docs/01-governance/roles-and-responsibilities.md` |
| Arquiteto Líder | `docs/01-governance/roles-and-responsibilities.md` |
| Pull Request | `docs/01-governance/editorial-process.md` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `docs/01-governance/approval-rules.md` | Processo de aprovação por categoria |
| `docs/01-governance/review-rules.md` | Frequência de revisão por categoria |
| `docs/01-governance/archiving-rules.md` | Retenção por categoria |

### 9.2 Referências Externas

| URL | Título |
|---|---|
| https://www.iso.org/standard/73479.html | ISO 15489 — Gestão de Registros |

---

## 10. Observações

N/A

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Categorias de documentos estabelecidas |
