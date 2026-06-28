---
name: ARCHITECTURE_CONSTRAINTS
purpose: >
  Lista todas as restrições não negociáveis que a arquitetura deve respeitar:
  tecnológicas (stack obrigatória ou proibida), legais (LGPD, regulações),
  orçamentárias, operacionais e de segurança. Qualquer decisão técnica deve
  ser verificada contra esta lista antes de ser tomada.
responsibility: >
  Arquiteto Líder com validação do Jurídico, Segurança e Diretoria Executiva.
relationships:
  - docs/00-project/project-context.md          # contexto que origina as restrições
  - docs/02-architecture/principles.md          # princípios que geram restrições
  - docs/04-requirements/non-functional/compliance.md  # restrições de conformidade
  - docs/02-architecture/adr/                   # ADRs tomados dentro das restrições
version: 0.1.0
status: draft
priority: crítica
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
