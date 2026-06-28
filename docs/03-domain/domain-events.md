---
name: DOMAIN_EVENTS
purpose: >
  Catálogo de todos os eventos de domínio do SOE: fatos significativos que ocorrem
  no negócio e que o sistema deve registrar e/ou reagir. Para cada evento: nome
  (no passado), contexto de origem, payload, consumidores conhecidos e consequências.
  Base para design orientado a eventos e para auditoria.
responsibility: >
  Arquiteto Líder com especialistas de domínio — toda nova funcionalidade deve
  identificar e registrar seus eventos aqui.
relationships:
  - docs/03-domain/bounded-contexts.md     # eventos pertencem a contextos
  - docs/08-api/contracts/                 # eventos viram contratos AsyncAPI
  - docs/05-modules/                        # eventos são referenciados nas specs de módulo
  - docs/09-security/audit-logging.md      # eventos críticos devem ser auditados
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
