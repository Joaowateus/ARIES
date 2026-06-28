# Sistema de Identificação de Documentos — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-004 |
| **Título** | Sistema de Identificação de Documentos do SOE |
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

Define o sistema de identificação único e permanente para todos os documentos do projeto
SOE. Um ID de documento é sua identidade imutável: ele nunca muda, mesmo que o título
mude, o documento seja movido de diretório ou reescrito completamente.

O sistema garante que referências entre documentos nunca ficam órfãs: ao citar
`RF-CRM-001`, qualquer pessoa sabe exatamente qual documento está sendo referenciado,
independente de onde ele está armazenado ou de como seu título evoluiu.

---

## 3. Escopo

### 3.1 O que este documento cobre

- A estrutura completa do ID de documento (anatomia do código)
- O catálogo de prefixos por tipo e domínio
- As regras de atribuição de novos IDs
- As regras de imutabilidade de IDs
- O registro central de IDs (onde consultar IDs já atribuídos)
- Os padrões de IDs especiais (ADRs, atas, incidentes)

### 3.2 O que este documento NÃO cobre

- A nomenclatura de arquivos no sistema de arquivos → ver `docs/01-governance/naming-conventions.md`
- O versionamento dos documentos identificados → ver `DOC-GOV-003`
- As categorias de documentos além dos prefixos → ver `DOC-GOV-005`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| DOC-GOV-002 | Sistema de Governança Documental | aprovado | Este sistema é componente daquele |
| DOC-GOV-005 | Categorias de Documentos | aprovado | Categorias determinam os prefixos usados aqui |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | DOC-GOV-002 | Sistema de Governança | Componente daquele sistema |
| `referencia →` | DOC-GOV-005 | Categorias de Documentos | Categorias são a base dos prefixos |
| `referencia →` | `docs/01-governance/naming-conventions.md` | Nomenclatura | Complementa IDs com nomes de arquivo |
| `← referenciado por` | `MASTER_INDEX.md` | Índice Mestre | O índice organiza documentos pelo ID definido aqui |
| `← referenciado por` | `DOC-GOV-011` | Política de Rastreabilidade | IDs são o mecanismo de rastreabilidade |
| `← referenciado por` | `DOC-GOV-012` | Sistema de Relacionamento | IDs são usados para definir relações |

---

## 6. Conteúdo Principal

### 6.1 Anatomia do ID

Todo documento do SOE recebe um ID único com a seguinte estrutura:

```
[PREFIXO]-[CÓDIGO-DE-MÓDULO]-[SEQUENCIAL]
    │              │               │
    │              │               └── Número sequencial com zeros à esquerda
    │              │                   Escopo: dentro do prefixo+módulo
    │              │                   Formato: 3 dígitos mínimo (001, 042, 100)
    │              │
    │              └── Código do módulo ou subdomínio (2-4 letras maiúsculas)
    │                  Omitido quando o prefixo já define o escopo completamente
    │
    └── Prefixo que define o tipo do documento (2-4 letras maiúsculas)
```

#### Exemplos

| ID | Leitura |
|---|---|
| `RF-CRM-001` | Requisito Funcional número 1 do módulo CRM |
| `RF-FIN-042` | Requisito Funcional número 42 do módulo Financeiro |
| `RNF-SEC-003` | Requisito Não-Funcional número 3 da área de Segurança |
| `ADR-0001` | Architecture Decision Record número 1 (sequencial global) |
| `DOC-GOV-004` | Documento de Governança número 4 |
| `MOD-CRM-001` | Documento de Especificação de Módulo CRM número 1 |
| `AGT-CRM-001` | Especificação de Agente IA número 1 do módulo CRM |
| `ATA-2026-001` | Ata de Reunião número 1 do ano 2026 |
| `INC-2026-001` | Relatório de Incidente número 1 do ano 2026 |

---

### 6.2 Catálogo Completo de Prefixos

#### Grupo A — Requisitos

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `RF` | Requisito Funcional | Obrigatório | `RF-CRM-001` |
| `RNF` | Requisito Não-Funcional | Obrigatório | `RNF-SEC-003` |
| `RC` | Restrição (Constraint) | Obrigatório | `RC-GOV-001` |

#### Grupo B — Arquitetura

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `ADR` | Architecture Decision Record | Omitido (sequencial global) | `ADR-0001` |
| `ARC` | Documento de Arquitetura (visões, overview) | Obrigatório | `ARC-SYS-001` |
| `PAD` | Padrão de Design (Pattern) | Obrigatório | `PAD-INT-001` |

#### Grupo C — Domínio

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `DOM` | Documento de Domínio (bounded context, linguagem ubíqua) | Obrigatório | `DOM-CRM-001` |
| `EVT` | Catálogo de Eventos de Domínio | Obrigatório | `EVT-CRM-001` |
| `GLO` | Verbete de Glossário | Omitido | `GLO-001` |

#### Grupo D — Especificações de Módulo

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `MOD` | Especificação de Módulo (visão geral) | Obrigatório | `MOD-CRM-001` |
| `CDU` | Caso de Uso | Obrigatório | `CDU-CRM-001` |
| `RN` | Regra de Negócio | Obrigatório | `RN-FIN-001` |

#### Grupo E — Dados

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `DAT` | Documento de Dados (dicionário, modelo, lifecycle) | Obrigatório | `DAT-CRM-001` |
| `ESQ` | Schema de Dados | Obrigatório | `ESQ-CRM-001` |
| `MIG` | Script/Política de Migração | Obrigatório | `MIG-CRM-001` |

#### Grupo F — Integração e API

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `INT` | Contrato de Integração | Obrigatório | `INT-EXT-001` |
| `API` | Contrato de API (OpenAPI/AsyncAPI) | Obrigatório | `API-CRM-001` |

#### Grupo G — Segurança e Compliance

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `SEC` | Documento de Segurança | Obrigatório | `SEC-POL-001` |
| `CPL` | Documento de Compliance | Obrigatório | `CPL-LGPD-001` |
| `PRI` | Documento de Privacidade (LGPD) | Obrigatório | `PRI-MAP-001` |

#### Grupo H — Infraestrutura e Operações

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `INF` | Documento de Infraestrutura | Obrigatório | `INF-ENV-001` |
| `RUN` | Runbook Operacional | Obrigatório | `RUN-OPS-001` |
| `INC` | Relatório de Incidente | ANO (4 dígitos) | `INC-2026-001` |

#### Grupo I — Qualidade e Testes

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `TST` | Documento de Estratégia de Testes | Obrigatório | `TST-STR-001` |
| `PLT` | Plano de Teste | Obrigatório | `PLT-CRM-001` |
| `CDT` | Caso de Teste | Obrigatório | `CDT-CRM-001` |

#### Grupo J — UX e Design

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `UXD` | Documento de UX/Design | Obrigatório | `UXD-DES-001` |
| `PER` | Persona | Omitido | `PER-001` |
| `JOR` | Mapa de Jornada | Obrigatório | `JOR-CRM-001` |

#### Grupo K — IA e Automação

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `AGT` | Especificação de Agente IA | Obrigatório | `AGT-CRM-001` |
| `WFL` | Especificação de Workflow | Obrigatório | `WFL-FIN-001` |

#### Grupo L — Governança Documental

| Prefixo | Tipo de Documento | Código de Módulo | Exemplo |
|---|---|---|---|
| `DOC` | Documento de Governança / Guia / Política | Obrigatório | `DOC-GOV-001` |
| `ATA` | Ata de Reunião | ANO (4 dígitos) | `ATA-2026-001` |
| `TPL` | Template Oficial | Obrigatório | `TPL-DOC-001` |

---

### 6.3 Tabela de Códigos de Módulo

| Código | Módulo / Área |
|---|---|
| `CRM` | CRM — Gestão de Relacionamento com Cliente |
| `COM` | Commercial — Módulo Comercial |
| `FIN` | Financial — Módulo Financeiro |
| `OPS` | Operations — Módulo de Operações |
| `HRH` | HR — Recursos Humanos |
| `PRO` | Procurement — Compras e Fornecedores |
| `LEG` | Legal — Jurídico |
| `BIR` | BI — Business Intelligence |
| `ADM` | Admin — Administração do Sistema |
| `NOT` | Notifications — Central de Notificações |
| `GOV` | Governance — Governança do Projeto |
| `SEC` | Security — Segurança |
| `INF` | Infrastructure — Infraestrutura |
| `SYS` | System — Sistema como um todo |
| `DAT` | Data — Domínio de Dados |
| `EXT` | External — Sistemas Externos |
| `INT` | Internal — Integrações Internas |
| `DES` | Design — Design System e UX |
| `POL` | Policy — Políticas gerais |
| `STR` | Strategy — Estratégias |
| `ENV` | Environment — Ambientes |
| `LGPD` | LGPD — Privacidade e Proteção de Dados |
| `MAP` | Mapping — Mapeamentos |

---

### 6.4 Regras de Atribuição de IDs

#### Regra 1 — Unicidade Global
Nenhum ID pode ser atribuído a dois documentos diferentes, mesmo que um deles
seja obsoleto. IDs são permanentes e únicos para sempre.

#### Regra 2 — Atribuição Antecipada
O ID é atribuído quando a issue de criação do documento é aberta — não quando
o documento é escrito. O Guardião da Documentação atribui o ID na triagem da issue.

#### Regra 3 — Sequencial Nunca Regride
Se um documento com ID `RF-CRM-005` é criado e depois descartado sem aprovação,
o próximo requisito funcional do CRM receberá `RF-CRM-006`. O número 5 não será
reutilizado.

#### Regra 4 — ID é Imutável
Após a criação da issue e atribuição do ID, ele nunca muda. Mudança de título,
de diretório, de escopo ou de tipo não altera o ID.

#### Regra 5 — Registro no MASTER_INDEX
Todo ID atribuído deve ser registrado no `MASTER_INDEX.md` no momento da atribuição,
mesmo que o documento ainda não exista. O índice é a fonte de verdade sobre IDs em uso.

#### Regra 6 — IDs de ADR são Globais
ADRs usam sequencial global sem código de módulo. O próximo ADR é sempre
`ADR-[último ADR + 1]`, independente do domínio tratado.

---

### 6.5 Registro de IDs Atribuídos

O registro central de IDs é o `MASTER_INDEX.md`. A seção de IDs do índice deve conter:

| Campo | Descrição |
|---|---|
| ID | O identificador único |
| Título | Título atual do documento |
| Status | Status atual |
| Versão | Versão atual |
| Caminho | Localização no repositório |
| Data de Atribuição | Quando o ID foi criado |

---

## 7. Critérios de Aceitação

- [ ] Todo documento no repositório tem um ID único no formato definido aqui
- [ ] Nenhum ID é compartilhado por dois documentos
- [ ] O MASTER_INDEX.md contém todos os IDs atribuídos (inclusive de documentos descartados)
- [ ] Nenhum ID de documento descartado foi reutilizado
- [ ] Todo prefixo usado no repositório consta no Catálogo desta seção

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| MASTER_INDEX | `MASTER_INDEX.md` |
| Guardião da Documentação Técnica | `docs/01-governance/roles-and-responsibilities.md` |
| Status de documento | `DOC-GOV-003` — Modelo de Versionamento |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `MASTER_INDEX.md` | Registro central de todos os IDs |
| `docs/01-governance/naming-conventions.md` | Nomenclatura de arquivos |
| `docs/01-governance/document-categories.md` | Categorias que embasam os prefixos |

### 9.2 Referências Externas

N/A

---

## 10. Observações

N/A

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Sistema de identificação estabelecido |
