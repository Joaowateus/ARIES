---
name: ACCEPTANCE_CRITERIA
purpose: >
  Define como escrever critérios de aceite no padrão Gherkin (Given/When/Then)
  e como eles se relacionam com os casos de uso e testes automatizados. Garante
  que negócio e tecnologia concordem sobre o que significa "pronto" antes de
  começar a implementar qualquer funcionalidade.
responsibility: Lead de QA / Analista de Negócios.
relationships:
  - docs/05-modules/*/use-cases.md          # casos de uso que geram os critérios
  - docs/11-testing/testing-strategy.md     # estratégia que aplica estes critérios
  - tests/e2e/                              # testes e2e derivados dos critérios
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
