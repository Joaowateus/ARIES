---
name: ENVIRONMENTS
purpose: >
  Define todos os ambientes do SOE: desenvolvimento, staging, produção e eventuais
  ambientes especiais (sandbox, demo). Para cada ambiente: propósito, quem tem acesso,
  dados utilizados, SLA, processo de promoção entre ambientes e configurações
  que diferem entre eles.
responsibility: Arquiteto de Infraestrutura / Arquiteto Líder.
relationships:
  - docs/10-infrastructure/deployment-strategy.md  # como o código chega a cada ambiente
  - docs/04-requirements/non-functional/availability.md  # SLAs por ambiente
  - docs/09-security/access-control.md              # controle de acesso por ambiente
  - infrastructure/                                  # IaC que provisiona os ambientes
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
