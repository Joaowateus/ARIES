---
name: NFR_AVAILABILITY
purpose: >
  Define os requisitos de disponibilidade do SOE: SLA de uptime por ambiente e
  por módulo, janelas de manutenção permitidas, RTO (Recovery Time Objective) e
  RPO (Recovery Point Objective) em caso de falha. Fundamenta as decisões de
  redundância e disaster recovery.
responsibility: >
  Arquiteto Líder com validação da Diretoria Executiva para os SLAs.
relationships:
  - docs/10-infrastructure/disaster-recovery.md    # plano derivado destes requisitos
  - docs/10-infrastructure/environments.md         # ambientes com seus SLAs específicos
  - docs/04-requirements/non-functional/performance.md  # performance e disponibilidade se relacionam
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
