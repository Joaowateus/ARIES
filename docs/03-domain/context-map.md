---
name: CONTEXT_MAP
purpose: >
  Diagrama e descrição das relações entre os bounded contexts do SOE: padrões de
  integração entre contextos (Anti-Corruption Layer, Shared Kernel, Customer/Supplier,
  Conformist, etc.) e o impacto dessas relações no desenvolvimento. É o "mapa político"
  do domínio — mostra quem depende de quem e como.
responsibility: >
  Arquiteto Líder — atualizado a cada novo módulo ou integração significativa.
relationships:
  - docs/03-domain/bounded-contexts.md     # contextos que este mapa relaciona
  - docs/07-integrations/internal/         # implementação das relações mapeadas aqui
  - docs/02-architecture/overview.md        # reflexo arquitetural deste mapa
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
