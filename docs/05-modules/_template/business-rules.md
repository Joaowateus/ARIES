---
name: MODULE_BUSINESS_RULES_TEMPLATE
purpose: >
  Template — Catálogo das regras de negócio do módulo: validações, cálculos,
  restrições, políticas e exceções. Cada regra recebe um ID único (BR-MODULO-XXXX),
  descrição em linguagem de negócio e critério de validação.
responsibility: Especialista de Domínio / Líder do Módulo.
relationships:
  - docs/05-modules/_template/use-cases.md      # casos de uso que aplicam as regras
  - docs/03-domain/ubiquitous-language.md        # termos usados nas regras
  - docs/04-requirements/functional/             # RFs que originam as regras
  - docs/11-testing/test-plans/                  # testes que validam as regras
version: 0.1.0
status: template
priority: crítica
---

> **[TEMPLATE — NÃO EDITAR ESTE DIRETÓRIO]**
