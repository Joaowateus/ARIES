---
name: MODULE_DATA_ENTITIES_TEMPLATE
purpose: >
  Template — Especifica as entidades de dados do módulo: atributos, tipos,
  cardinalidades, restrições de integridade e relacionamentos com entidades
  de outros módulos. É a entrada para o dicionário de dados e para o modelo de banco.
responsibility: Arquiteto de Dados / Líder do Módulo.
relationships:
  - docs/06-data/data-dictionary.md           # entidades registradas no dicionário global
  - docs/05-modules/_template/business-rules.md  # regras que impactam as entidades
  - database/schemas/                          # schema de banco derivado desta especificação
version: 0.1.0
status: template
priority: alta
---

> **[TEMPLATE — NÃO EDITAR ESTE DIRETÓRIO]**
