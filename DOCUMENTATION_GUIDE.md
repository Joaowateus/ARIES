# DOCUMENTATION GUIDE — SOE MM Negócios

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID** | DOC-GOV-001 |
| **Título** | Guia Oficial de Documentação Técnica do SOE |
| **Tipo** | Guia |
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

Este guia é a lei fundamental da documentação do projeto SOE. Ele define como qualquer
documento deve ser escrito, estruturado, revisado, versionado e publicado neste repositório.

Nenhum documento produzido neste projeto — independente do autor, da área ou da urgência —
pode fugir das regras aqui estabelecidas. A uniformidade não é uma preferência estética:
é um requisito arquitetural que garante rastreabilidade, auditoria e sustentabilidade da
base de conhecimento ao longo de anos de desenvolvimento.

A documentação é a única fonte oficial da verdade. O código é consequência da documentação.
Portanto, a qualidade documental é, diretamente, a qualidade do sistema.

---

## 3. Escopo

### 3.1 O que este documento cobre

- O template único obrigatório para todos os documentos do projeto
- A anatomia e a finalidade de cada seção do template
- As regras de preenchimento de cada campo
- O processo de criação, revisão e publicação de documentos
- As convenções de nomenclatura de arquivos e diretórios
- Os critérios de qualidade que todo documento deve atender
- As regras de versionamento de documentos

### 3.2 O que este documento NÃO cobre

- O processo de aprovação de Pull Requests → ver `docs/01-governance/review-policy.md`
- As convenções de nomes de branches, commits e variáveis → ver `docs/01-governance/naming-conventions.md`
- A política de versionamento semântico (SemVer) → ver `docs/01-governance/versioning-policy.md`
- O processo editorial completo (quem propõe, quem aprova, prazos) → ver `docs/01-governance/editorial-process.md`

---

## 4. Dependências

| ID | Título | Status | Motivo |
|---|---|---|---|
| ADR-0001 | Template Oficial de Documentação Técnica | aprovado | Decisão arquitetural que originou este guia |

---

## 5. Relacionamentos

| Direção | ID | Título | Natureza |
|---|---|---|---|
| `← origina-se de` | ADR-0001 | Template Oficial de Documentação | Este guia operacionaliza aquela decisão |
| `referencia →` | `docs/01-governance/editorial-process.md` | Processo Editorial | Processo que aplica este guia |
| `referencia →` | `docs/01-governance/review-policy.md` | Política de Revisão | Critérios de aprovação derivados deste guia |
| `referencia →` | `docs/01-governance/naming-conventions.md` | Convenções de Nomenclatura | Complementa este guia |
| `referencia →` | `templates/TEMPLATE-OFICIAL.md` | Template Oficial | Artefato central definido aqui |
| `← referenciado por` | `CONTRIBUTING.md` | Guia de Contribuição | Resume este guia para novos colaboradores |
| `← referenciado por` | `.github/PULL_REQUEST_TEMPLATE.md` | Template de PR | Valida conformidade com este guia |

---

## 6. Conteúdo Principal

### 6.1 O Template Oficial

**Todo documento do projeto SOE deve usar exclusivamente o arquivo:**

```
templates/TEMPLATE-OFICIAL.md
```

Estabelecido pelo [ADR-0001](docs/02-architecture/adr/ADR-0001-template-oficial-de-documentacao.md).

**Como usar:**
1. Copie `templates/TEMPLATE-OFICIAL.md` para o diretório correto
2. Renomeie conforme as convenções de nomenclatura (seção 6.4)
3. Preencha todas as seções — campos com `N/A` são preferíveis a campos em branco
4. Remova os blocos de instrução em itálico antes de abrir o PR
5. O documento só vai para `aprovado` após revisão via Pull Request

---

### 6.2 Anatomia do Template — Campo a Campo

#### Seção 1 — Identificação

É o cabeçalho de identidade do documento. Todos os campos são **obrigatórios**.
Nenhum documento existe sem identificação completa.

| Campo | Obrigatoriedade | Regra de Preenchimento |
|---|---|---|
| **ID** | Obrigatório | Formato: `[DOMÍNIO]-[MÓDULO]-[SEQUENCIAL]`. Ver tabela de prefixos na seção 6.3 |
| **Título** | Obrigatório | Descritivo, sem abreviações. Máximo 80 caracteres |
| **Tipo** | Obrigatório | Usar exatamente um dos valores listados no template |
| **Autor** | Obrigatório | Nome completo + papel (ex: "João Silva — Arquiteto Líder") |
| **Data de Criação** | Obrigatório | Formato ISO 8601: `AAAA-MM-DD` |
| **Última Revisão** | Obrigatório | Atualizado em toda mudança, mesmo que mínima |
| **Próxima Revisão** | Condicional | Obrigatório para Políticas e Runbooks. Opcional para demais |
| **Versão** | Obrigatório | SemVer: `MAJOR.MINOR.PATCH`. Começa em `0.1.0` (rascunho) |
| **Status** | Obrigatório | Um dos quatro valores: `rascunho` / `em-revisão` / `aprovado` / `obsoleto` |
| **Prioridade** | Obrigatório | `crítica` / `alta` / `média` / `baixa` |
| **Domínio** | Obrigatório | Área de negócio ou técnica (ex: CRM, Financeiro, Segurança, Governança) |

**Regra de Versão por Status:**

| Status | Faixa de Versão |
|---|---|
| `rascunho` | `0.x.x` |
| `em-revisão` | `0.x.x` (o mesmo da submissão para revisão) |
| `aprovado` | `1.0.0` ou superior |
| `obsoleto` | Versão congelada no momento da obsolescência |

---

#### Seção 2 — Objetivo

**Propósito:** Responde *por que este documento existe*.

**Regras:**
- Mínimo 1 parágrafo, máximo 3
- Deve ser compreensível sem conhecimento prévio do projeto
- Deve deixar claro o problema que ficaria sem solução sem este documento
- **Proibido:** copiar o título; usar frases genéricas como "Este documento descreve..."

**Teste de qualidade:** Um novo membro da equipe deve conseguir, após ler esta seção,
decidir se este é o documento que ele precisa ler.

---

#### Seção 3 — Escopo

**Propósito:** Elimina ambiguidade sobre o que está dentro e fora deste documento.

**Regras:**
- A subseção "O que NÃO cobre" é tão importante quanto "O que cobre"
- Cada item de "O que NÃO cobre" deve indicar onde encontrar aquela informação
- Mínimo 2 itens em cada subseção; usar `N/A` apenas se genuinamente não aplicável

---

#### Seção 4 — Dependências

**Propósito:** Garante ordem de leitura e ordem de criação de documentos.

**Regras:**
- Uma dependência é um documento que **precisa existir e estar aprovado** antes que
  este possa ser finalizado
- Se uma dependência está em `rascunho`, este documento também deve ficar em `rascunho`
- Relações de "é bom ter" vão em Relacionamentos (seção 5), não aqui
- `N/A` apenas se genuinamente não houver dependências

---

#### Seção 5 — Relacionamentos

**Propósito:** Constrói o grafo de conhecimento do projeto — permite navegar da visão
geral até o detalhe e vice-versa.

**Regras:**
- Use as direções padronizadas do template (`origina →`, `← origina-se de`, etc.)
- Todo documento deve ter pelo menos um relacionamento (senão, ele existe para quê?)
- Ao criar um relacionamento, verifique se o documento do outro lado o lista também
  (rastreabilidade bidirecional)

---

#### Seção 6 — Conteúdo Principal

**Propósito:** O corpo do documento — a única seção com estrutura variável por tipo.

**Regras:**
- O conteúdo varia por tipo de documento (ver guias no template)
- Os títulos das subseções são livres, mas devem ser descritivos
- Máximo de 4 níveis de heading (`####`)
- Diagramas devem ter legenda e texto alternativo
- Tabelas devem ter header em negrito
- Listas com mais de 7 itens devem ser agrupadas em subcategorias

**O que NUNCA fazer no Conteúdo Principal:**
- Redefinir termos que já estão no Glossário → referenciar
- Copiar conteúdo de outro documento → referenciar
- Decidir algo que não está documentado em um ADR → criar o ADR primeiro
- Usar linguagem ambígua: "geralmente", "às vezes", "pode ser que" → ser preciso

---

#### Seção 7 — Critérios de Aceitação

**Propósito:** Define objetivamente quando um documento está completo e pode ser aprovado.
Transforma a revisão de subjetiva em objetiva.

**Regras:**
- Os critérios genéricos do template são obrigatórios em todo documento
- Critérios específicos do conteúdo do documento devem ser adicionados
- Cada critério deve ser verificável — se não puder ser marcado como "feito" ou "não feito",
  reescreva até ser verificável
- O revisor usa esta lista como checklist durante a revisão

---

#### Seção 8 — Glossário Relacionado

**Propósito:** Garante que termos técnicos tenham definição acessível sem interromper
a leitura do documento principal.

**Regras:**
- Não redefina termos aqui — aponte para onde a definição oficial está
- Todo termo técnico ou de domínio específico do SOE deve ser listado
- Termos de uso geral na área de TI (ex: "API", "banco de dados") não precisam ser listados
- `N/A` apenas se o documento não usar nenhum termo específico do projeto

---

#### Seção 9 — Referências

**Propósito:** Dá crédito e permite verificação das fontes que embasam o documento.

**Regras:**
- Referências internas: caminho relativo a partir da raiz do repositório
- Referências externas: URL completa + título + data de acesso quando relevante
- Normas e regulações devem citar número e ano (ex: "LGPD — Lei 13.709/2018")
- Não liste referências que não são realmente consultadas no documento

---

#### Seção 10 — Observações

**Propósito:** Captura contexto temporário ou informações que não têm seção própria.

**Regras:**
- Se uma observação permanecer relevante por mais de 3 meses, promova-a para seção própria
- Nunca usar esta seção para esconder decisões que deveriam estar num ADR
- `N/A` é a resposta esperada na maioria dos documentos maduros

---

#### Seção 11 — Histórico de Alterações

**Propósito:** Cria rastreabilidade temporal — permite entender a evolução do documento
e o raciocínio por trás de mudanças.

**Regras:**
- A versão `0.1.0` (criação) pode ser omitida ou listada brevemente
- A partir da versão `1.0.0` (aprovação), toda mudança deve ter entrada
- O campo "Tipo de Mudança" deve usar um dos valores padronizados do template
- Nunca editar entradas já existentes — apenas adicionar novas

---

### 6.3 Tabela de Prefixos de ID

| Prefixo | Tipo de Documento | Exemplo |
|---|---|---|
| `ADR` | Architecture Decision Record | `ADR-0001` |
| `RF` | Requisito Funcional | `RF-CRM-001` |
| `RNF` | Requisito Não-Funcional | `RNF-SEC-003` |
| `DOC` | Documento de Governança/Guia | `DOC-GOV-001` |
| `MOD` | Especificação de Módulo | `MOD-CRM-001` |
| `INT` | Contrato de Integração | `INT-EXT-001` |
| `API` | Contrato de API | `API-CRM-001` |
| `SEC` | Documento de Segurança | `SEC-POL-001` |
| `DAT` | Documento de Dados | `DAT-DIC-001` |
| `INF` | Documento de Infraestrutura | `INF-ENV-001` |
| `TST` | Documento de Testes | `TST-STR-001` |
| `UXD` | Documento de UX/Design | `UXD-DES-001` |
| `AGT` | Especificação de Agente IA | `AGT-CRM-001` |
| `WFL` | Especificação de Workflow | `WFL-FIN-001` |
| `RUN` | Runbook Operacional | `RUN-OPS-001` |
| `INC` | Relatório de Incidente | `INC-2026-001` |
| `ATA` | Ata de Reunião | `ATA-2026-001` |

---

### 6.4 Convenções de Nomenclatura de Arquivos

#### Regra geral

```
[tipo-abreviado]-[id-sequencial]-[titulo-em-kebab-case].md
```

#### Exemplos por tipo

```
# Requisito Funcional
rf-001-cadastro-de-cliente.md

# ADR
ADR-0001-template-oficial-de-documentacao.md

# Especificação de módulo (arquivo dentro do diretório do módulo)
overview.md
use-cases.md

# Ata de reunião
2026-06-28-alinhamento-arquitetural.md

# Relatório de incidente
2026-06-28-falha-autenticacao-producao.md
```

#### Regras absolutas

- Apenas letras minúsculas, números e hífens nos nomes de arquivo
- Sem espaços, underscores, acentos ou caracteres especiais
- Sem abreviações não estabelecidas no Glossário
- Extensão sempre `.md` para documentos de texto
- Exceções documentadas: `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
  `CLAUDE.md`, `MASTER_INDEX.md`, `DOCUMENTATION_GUIDE.md`, `SYSTEM.md`,
  `LICENSE`, `CODEOWNERS`, `TEMPLATE-OFICIAL.md`, `ADR-XXXX-*.md`

---

### 6.5 Idioma e Estilo de Escrita

| Aspecto | Regra |
|---|---|
| **Idioma** | Português brasileiro para todo conteúdo. Exceções: nomes próprios de tecnologias, termos técnicos consagrados em inglês (API, backend, deploy), identificadores de código |
| **Voz** | Ativa e direta. "O sistema valida" — não "A validação é realizada pelo sistema" |
| **Tempo verbal** | Presente do indicativo para regras e descrições; futuro para comprometimentos de roadmap |
| **Nível de detalhe** | Específico o suficiente para ser implementado sem ambiguidade — mas não tão específico que impeça evolução do design |
| **Listas** | Usar para 3+ itens paralelos; não usar para 1-2 itens (virar prosa) |
| **Tabelas** | Usar para comparações e dados estruturados; não usar para texto corrido |
| **Diagramas** | Sempre incluir descrição textual equivalente (acessibilidade) |
| **Comprimento** | O necessário — nem mais, nem menos. Documentos curtos e completos são superiores a documentos longos e vagos |

---

### 6.6 Workflow de Criação de um Documento

```
1. PROPOSTA
   └── Abrir Issue usando o template "doc-request" no GitHub
       └── Incluir: tipo, título, objetivo resumido, urgência

2. ATRIBUIÇÃO
   └── Guardião da Documentação designa autor e prazo

3. CRIAÇÃO
   └── Autor copia templates/TEMPLATE-OFICIAL.md para o diretório correto
   └── Preenche com status = "rascunho" e versão = "0.1.0"
   └── Commit na branch feature/doc-[ID]-[titulo-curto]

4. REVISÃO INTERNA
   └── Autor verifica os próprios Critérios de Aceitação (seção 7)
   └── Status muda para "em-revisão", versão para "0.2.0"
   └── Pull Request aberto com PULL_REQUEST_TEMPLATE preenchido

5. REVISÃO FORMAL
   └── Revisores designados pelo CODEOWNERS verificam:
       ├── Conformidade com este DOCUMENTATION_GUIDE
       ├── Completude dos Critérios de Aceitação
       ├── Consistência com documentos relacionados
       └── Qualidade do conteúdo
   └── Aprovação mínima: 1 revisor + Arquiteto Líder (para docs críticos)

6. PUBLICAÇÃO
   └── Merge na branch principal
   └── Status muda para "aprovado", versão muda para "1.0.0"
   └── MASTER_INDEX.md atualizado

7. MANUTENÇÃO
   └── Revisões periódicas conforme campo "Próxima Revisão"
   └── Mudanças seguem o mesmo workflow a partir do passo 3
   └── Obsolescência: status = "obsoleto", adicionar link para substituto
```

---

### 6.7 Regras de Ouro — O Que Nunca Fazer

1. **Nunca criar documento sem usar o template** — sem exceção, sem urgência que justifique
2. **Nunca deixar campo obrigatório em branco** — usar `N/A` se genuinamente não aplicável
3. **Nunca copiar conteúdo entre documentos** — sempre referenciar a fonte original
4. **Nunca tomar decisão arquitetural dentro de um documento de requisito** — criar ADR
5. **Nunca aprovar documento com dependências em `rascunho`**
6. **Nunca usar linguagem ambígua** onde precisão é possível
7. **Nunca editar histórico de alterações retroativamente** — o histórico é imutável
8. **Nunca publicar sem preencher os Critérios de Aceitação**

---

## 7. Critérios de Aceitação

### Este documento está aceito quando:

- [ ] Todo novo documento criado no repositório usa `templates/TEMPLATE-OFICIAL.md`
- [ ] Todos os 11 campos da seção "Identificação" estão preenchidos em cada documento
- [ ] O checklist do Pull Request inclui verificação de conformidade com este guia
- [ ] Todos os membros da equipe confirmaram leitura deste guia (via issue de onboarding)
- [ ] O MASTER_INDEX.md reflete todos os documentos em conformidade com este padrão

---

## 8. Glossário Relacionado

| Termo | Definido em |
|---|---|
| ADR (Architecture Decision Record) | `docs/02-architecture/adr/ADR-0000-template.md` |
| SemVer | `docs/01-governance/versioning-policy.md` |
| Pull Request | `docs/01-governance/editorial-process.md` |
| CODEOWNERS | `.github/CODEOWNERS` |
| Bounded Context | `docs/03-domain/bounded-contexts.md` |

---

## 9. Referências

### 9.1 Referências Internas

| Caminho | Título |
|---|---|
| `templates/TEMPLATE-OFICIAL.md` | Template Oficial de Documentação Técnica |
| `docs/02-architecture/adr/ADR-0001-template-oficial-de-documentacao.md` | ADR que originou este guia |
| `docs/01-governance/editorial-process.md` | Processo Editorial Completo |
| `docs/01-governance/review-policy.md` | Política de Revisão |
| `docs/01-governance/naming-conventions.md` | Convenções de Nomenclatura |
| `docs/01-governance/versioning-policy.md` | Política de Versionamento |
| `.github/PULL_REQUEST_TEMPLATE.md` | Template de Pull Request |

### 9.2 Referências Externas

| URL | Título |
|---|---|
| https://semver.org/lang/pt-BR/ | Versionamento Semântico (SemVer) |
| https://adr.github.io/ | Architecture Decision Records — referência original |
| https://keepachangelog.com/pt-BR/ | Keep a Changelog — padrão de histórico |
| https://editorconfig.org/ | EditorConfig — padronização de formatação |

---

## 10. Observações

Este guia se aplica a todos os documentos criados **a partir de 2026-06-28**.
Os 191 documentos criados na fase inicial de estruturação do repositório estão em
formato legado (front-matter YAML) e serão migrados para o novo template de forma
gradual, priorizando os documentos com status `crítica` e `alta`.

A migração dos documentos legados deve ser rastreada via issues com a label
`doc-migration` e concluída antes da primeira entrega de fase do projeto.

---

## 11. Histórico de Alterações

| Versão | Data | Autor | Tipo | Descrição |
|---|---|---|---|---|
| `1.0.0` | 2026-06-28 | Guardião da Documentação Técnica | `criação` | Documento criado e aprovado. Substitui o front-matter YAML legado como padrão oficial |
