---
name: BOUNDED_CONTEXTS
purpose: >
  Mapeia os contextos delimitados (bounded contexts) do SOE: quais são, quais
  responsabilidades cada um tem, quais entidades e regras pertencem a cada contexto.
  É a pedra fundamental do design orientado a domínio — define as fronteiras onde
  modelos diferentes coexistem sem conflito.
responsibility: >
  Arquiteto Líder com especialistas de domínio de cada área.
relationships:
  - docs/03-domain/ubiquitous-language.md  # linguagem específica de cada contexto
  - docs/03-domain/context-map.md          # relações entre os contextos
  - docs/05-modules/                        # módulos são frequentemente alinhados a contextos
  - docs/02-architecture/overview.md        # arquitetura reflete os bounded contexts
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
