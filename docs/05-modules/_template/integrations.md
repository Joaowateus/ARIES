---
name: MODULE_INTEGRATIONS_TEMPLATE
purpose: >
  Template — Mapeia as integrações do módulo: dependências de outros módulos
  internos, sistemas externos consumidos ou expostos, contratos de API e eventos
  utilizados. Define o que o módulo precisa de fora e o que oferece para fora.
responsibility: Arquiteto Líder / Líder do Módulo.
relationships:
  - docs/07-integrations/                     # contratos detalhados de integração
  - docs/05-modules/_template/events.md       # eventos como mecanismo de integração
  - docs/08-api/contracts/                    # contratos OpenAPI/AsyncAPI
version: 0.1.0
status: template
priority: alta
---

> **[TEMPLATE — NÃO EDITAR ESTE DIRETÓRIO]**
