---
name: DATA_FLOW_VIEW
purpose: >
  Documenta como os dados fluem pelo sistema SOE: de onde originam, por quais
  componentes passam, onde são persistidos, transformados ou consumidos. Inclui
  fluxos síncronos (API), assíncronos (eventos) e batch. Essencial para análise
  de impacto e auditoria de dados.
responsibility: >
  Arquiteto Líder com contribuição dos líderes de módulo.
relationships:
  - docs/06-data/data-model-overview.md         # entidades que fluem
  - docs/07-integrations/overview.md            # integrações que participam do fluxo
  - docs/02-architecture/c4/level-3-component/  # componentes que processam os dados
  - docs/09-security/audit-logging.md           # o que deve ser auditado no fluxo
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
