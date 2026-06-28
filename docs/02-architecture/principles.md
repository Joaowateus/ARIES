---
name: ENGINEERING_PRINCIPLES
purpose: >
  Define os princípios de engenharia e arquitetura que governam TODAS as decisões
  técnicas do projeto SOE. São imutáveis no curto prazo e funcionam como filtro:
  qualquer proposta técnica que viole um princípio exige um ADR justificando a exceção.
  Exemplos: "API-first", "documentação antes do código", "segurança por design",
  "dados como ativo estratégico", "observabilidade como requisito".
responsibility: >
  Arquiteto Líder com aprovação da Diretoria Executiva de Tecnologia.
relationships:
  - docs/00-project/vision.md                   # visão que origina os princípios
  - docs/02-architecture/overview.md            # arquitetura que aplica os princípios
  - docs/02-architecture/adr/                   # ADRs que documentam quando princípios guiam decisões
  - docs/02-architecture/constraints.md         # restrições que complementam os princípios
version: 0.1.0
status: draft
priority: crítica
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
