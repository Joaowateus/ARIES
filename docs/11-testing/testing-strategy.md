---
name: TESTING_STRATEGY
purpose: >
  Define a estratégia de qualidade do SOE: pirâmide de testes (unitários, integração,
  e2e), cobertura mínima por camada, ferramentas de teste, critérios de aceite por
  tipo de entrega, testes obrigatórios antes de cada promoção de ambiente e
  responsabilidades da equipe em relação à qualidade.
responsibility: Lead de QA / Arquiteto Líder.
relationships:
  - docs/11-testing/acceptance-criteria.md    # critérios de aceite que os testes validam
  - docs/04-requirements/non-functional/maintainability.md  # metas de cobertura
  - docs/10-infrastructure/deployment-strategy.md  # gates de qualidade no pipeline
  - tests/                                     # testes que implementam esta estratégia
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
