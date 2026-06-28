---
name: MODULE_EVENTS_TEMPLATE
purpose: >
  Template — Lista os eventos de domínio produzidos e consumidos pelo módulo:
  nome do evento, payload, produtor, consumidores, canal e garantias de entrega.
responsibility: Arquiteto Líder / Líder do Módulo.
relationships:
  - docs/03-domain/domain-events.md           # catálogo global de eventos
  - docs/08-api/contracts/                    # contratos AsyncAPI derivados
  - docs/05-modules/_template/integrations.md # eventos são mecanismo de integração
version: 0.1.0
status: template
priority: alta
---

> **[TEMPLATE — NÃO EDITAR ESTE DIRETÓRIO]**
