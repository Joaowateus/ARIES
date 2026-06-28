# [TÍTULO DO DOCUMENTO]

> **Template Oficial de Documentação Técnica — SOE MM Negócios**
> Versão do template: 1.0.0 | Estabelecido por: ADR-0001
>
> **INSTRUÇÕES DE USO (remover antes de publicar)**
> 1. Copie este arquivo para o diretório correto com o nome adequado
> 2. Preencha todos os campos obrigatórios (marcados com `*`)
> 3. Campos não aplicáveis devem receber `N/A` — nunca deixar em branco
> 4. Remova este bloco de instruções antes de abrir o Pull Request
> 5. O documento só pode ser publicado com status diferente de `rascunho`
>    após aprovação conforme `docs/01-governance/review-policy.md`

---

## 1. Identificação

| Campo | Valor |
|---|---|
| **ID \*** | `[DOMÍNIO]-[MÓDULO]-[SEQUENCIAL]` — ex: `DOC-GOV-001`, `RF-CRM-042`, `ADR-0005` |
| **Título \*** | Nome completo e descritivo do documento |
| **Tipo \*** | `Requisito Funcional` / `Requisito Não-Funcional` / `ADR` / `Especificação de Módulo` / `Política` / `Runbook` / `Guia` / `Contrato de API` / `Contrato de Integração` / `Especificação de Agente` / `Especificação de Workflow` / `Ata de Reunião` / `Relatório de Incidente` / `Outro` |
| **Autor \*** | Nome completo + papel no projeto |
| **Data de Criação \*** | AAAA-MM-DD |
| **Última Revisão \*** | AAAA-MM-DD |
| **Próxima Revisão** | AAAA-MM-DD (obrigatório para Políticas e Runbooks; opcional para demais) |
| **Versão \*** | Seguir SemVer: `MAJOR.MINOR.PATCH` — ver `docs/01-governance/versioning-policy.md` |
| **Status \*** | `rascunho` / `em-revisão` / `aprovado` / `obsoleto` |
| **Prioridade \*** | `crítica` / `alta` / `média` / `baixa` |
| **Domínio \*** | Área do projeto a que pertence — ex: `Governança`, `Arquitetura`, `CRM`, `Financeiro`, `Segurança` |

---

## 2. Objetivo

> **Campo obrigatório.** Descreva em **1 a 3 parágrafos** a razão de existência deste documento.
> Responda: *Por que este documento existe? Qual problema resolve? O que ficaria indefinido
> sem ele?* Escreva para um leitor que nunca viu o projeto — ele deve entender o propósito
> sem precisar consultar outros documentos.

[Descrever o objetivo aqui]

---

## 3. Escopo

### 3.1 O que este documento cobre

> Liste explicitamente o que está dentro do escopo deste documento.

- [Item 1]
- [Item 2]

### 3.2 O que este documento NÃO cobre

> Lista igualmente importante — previne que o leitor procure aqui o que está em outro lugar.

- [Item 1 — com referência ao documento correto quando aplicável]
- [Item 2]

---

## 4. Dependências

> Documentos que **devem existir e estar aprovados** antes que este documento possa ser
> finalizado. Se uma dependência estiver em rascunho, este documento também permanece
> em rascunho.

| ID do Documento | Título | Status | Motivo da Dependência |
|---|---|---|---|
| [ID] | [Título] | [Status] | [Por que este doc precisa daquele] |

*Se não houver dependências, preencher com `N/A`.*

---

## 5. Relacionamentos

> Outros documentos que se relacionam com este, sem relação de dependência obrigatória.
> Use as direções abaixo para indicar o tipo de relação.

| Direção | ID | Título | Natureza do Relacionamento |
|---|---|---|---|
| `origina →` | [ID] | [Título] | Este documento deu origem àquele |
| `← origina-se de` | [ID] | [Título] | Aquele documento deu origem a este |
| `implementa →` | [ID] | [Título] | Este documento implementa aquele |
| `← implementado por` | [ID] | [Título] | Aquele documento implementa este |
| `refina →` | [ID] | [Título] | Este documento detalha aquele |
| `← refinado por` | [ID] | [Título] | Aquele documento detalha este |
| `referencia →` | [ID] | [Título] | Este documento referencia aquele |
| `← referenciado por` | [ID] | [Título] | Aquele documento referencia este |

*Se não houver relacionamentos, preencher com `N/A`.*

---

## 6. Conteúdo Principal

> **Esta é a única seção com estrutura variável.** O conteúdo depende do tipo de documento.
> Use as subseções que fazem sentido para o tipo. Mantenha os títulos das demais seções
> (7 em diante) exatamente como estão — apenas esta seção é livre.
>
> **Guias por tipo de documento:**
>
> - **Requisito Funcional:** Descrição, Atores, Fluxo Principal, Fluxos Alternativos, Regras de Negócio Aplicáveis
> - **ADR:** Contexto, Decisão, Alternativas Consideradas, Consequências
> - **Especificação de Módulo:** Visão Geral, Responsabilidades, Casos de Uso, Entidades, Eventos, Integrações
> - **Política / Guia:** Declaração da Política, Diretrizes, Exceções, Processo de Exceção
> - **Runbook:** Pré-condições, Passos, Validação, Rollback
> - **Contrato de API:** Endpoints, Request/Response, Erros, Rate Limits, Exemplos
> - **Contrato de Integração:** Sistema, Protocolo, Autenticação, Fluxos, Tratamento de Erros
> - **Especificação de Agente:** Propósito, Inputs/Outputs, Limites de Atuação, Métricas de Qualidade
> - **Especificação de Workflow:** Gatilho, Passos, Tratamento de Erro, Idempotência
> - **Ata de Reunião:** Participantes, Pauta, Discussões, Decisões, Ações
> - **Relatório de Incidente:** Linha do Tempo, Impacto, Causa Raiz, Contenção, Ações Corretivas

### 6.1 [Subseção conforme tipo do documento]

[Conteúdo]

### 6.2 [Subseção conforme tipo do documento]

[Conteúdo]

---

## 7. Critérios de Aceitação

> **Campo obrigatório para todos os documentos.** Define objetivamente como saber se este
> documento está completo, correto e pode ser aprovado. Use o formato Dado/Quando/Então
> para critérios verificáveis. Para documentos de política ou referência, use uma lista
> de critérios de completude.
>
> Estes critérios são usados pelo revisor no Pull Request para aceitar ou rejeitar o documento.

### Este documento está aceito quando:

- [ ] Todos os campos da seção "Identificação" estão preenchidos sem `[placeholder]`
- [ ] O "Objetivo" responde claramente por que o documento existe
- [ ] O "Escopo" define explicitamente o que está dentro E fora
- [ ] Todas as dependências listadas na seção 4 estão com status `aprovado`
- [ ] O "Conteúdo Principal" está completo conforme o tipo do documento
- [ ] Todos os critérios de aceitação específicos abaixo estão verificados
- [ ] O "Glossário Relacionado" referencia todos os termos técnicos usados
- [ ] Pelo menos um revisor com papel adequado aprovou via Pull Request
- [ ] [Critério específico deste documento — adicionar quantos forem necessários]

---

## 8. Glossário Relacionado

> Liste os termos técnicos ou de domínio usados neste documento que possuem definição
> oficial em `docs/00-project/glossary.md` ou `docs/03-domain/ubiquitous-language.md`.
> Não redefina os termos aqui — apenas referencie-os para que o leitor saiba onde encontrar.

| Termo | Definido em | Observação (opcional) |
|---|---|---|
| [Termo] | `docs/00-project/glossary.md#termo` | [Contexto de uso neste documento, se relevante] |

*Se nenhum termo especial for usado, preencher com `N/A`.*

---

## 9. Referências

> Links, documentos externos, normas, livros, RFCs ou outros materiais que fundamentam
> ou complementam este documento. Referências internas ao repositório usam caminho relativo.
> Referências externas usam URL completa.

### 9.1 Referências Internas

| ID / Caminho | Título | Relevância |
|---|---|---|
| `docs/00-project/glossary.md` | Glossário Oficial | Termos usados neste documento |
| [caminho] | [Título] | [Por que é referenciado] |

### 9.2 Referências Externas

| URL | Título | Relevância |
|---|---|---|
| [URL] | [Título] | [Por que é referenciada] |

*Se não houver referências externas, preencher com `N/A`.*

---

## 10. Observações

> Espaço para informações que não se encaixam nas seções anteriores: restrições de
> acesso ao documento, avisos temporários, contexto de decisões que não cabem no
> histórico, dependências de prazo, ou qualquer nota relevante para leitores futuros.
>
> **Regra:** se a observação permanecer válida por mais de 3 meses, ela deve ser
> promovida para uma seção própria no Conteúdo Principal.

[Observações aqui, ou `N/A`]

---

## 11. Histórico de Alterações

> Registro obrigatório de todas as mudanças neste documento após a versão inicial.
> A versão `0.1.0` (criação) não precisa de entrada aqui — ela é o estado inicial.
> A partir da primeira revisão substantiva, toda mudança deve ser registrada.

| Versão | Data | Autor | Tipo de Mudança | Descrição |
|---|---|---|---|---|
| `1.0.0` | AAAA-MM-DD | [Nome] | `criação` | Documento criado e aprovado |
| `1.1.0` | AAAA-MM-DD | [Nome] | `adição` | [O que foi adicionado] |
| `1.2.0` | AAAA-MM-DD | [Nome] | `alteração` | [O que foi alterado e por quê] |
| `2.0.0` | AAAA-MM-DD | [Nome] | `reestruturação` | [Mudança significativa de escopo ou estrutura] |
| `x.x.x` | AAAA-MM-DD | [Nome] | `obsolescência` | Documento substituído por [ID do substituto] |

**Tipos de mudança válidos:** `criação` / `adição` / `alteração` / `correção` / `remoção` / `reestruturação` / `obsolescência`

---

*Este documento segue o **Template Oficial de Documentação Técnica SOE v1.0.0**
estabelecido pelo [ADR-0001](../docs/02-architecture/adr/ADR-0001-template-oficial-de-documentacao.md).*
