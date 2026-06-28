---
name: INTEGRATIONS_OVERVIEW
purpose: >
  Mapa completo de todas as integrações do SOE: sistemas internos, sistemas externos,
  protocolos utilizados, direção do fluxo de dados e criticidade de cada integração.
  É o índice do capítulo de integrações — cada integração tem seu próprio contrato
  em internal/ ou external/.
responsibility: Arquiteto Líder com contribuição dos líderes de módulo.
relationships:
  - docs/07-integrations/internal/        # contratos de integração interna
  - docs/07-integrations/external/        # contratos de integração externa
  - docs/02-architecture/views/data-flow-view.md  # fluxo de dados entre integrações
  - docs/08-api/contracts/                # contratos técnicos das integrações
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
