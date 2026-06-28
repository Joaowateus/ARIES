---
name: INCIDENT_REPORT_TEMPLATE
purpose: >
  Template para relatório pós-incidente (post-mortem): linha do tempo do incidente,
  impacto, causa raiz (root cause analysis), ações de contenção tomadas, ações
  corretivas planejadas e lições aprendidas. Toda ocorrência P1/P2 em produção
  deve ter um post-mortem.
responsibility: Líder técnico do incidente — produzido até 48h após resolução.
relationships:
  - docs/09-security/incident-response.md    # processo que este template documenta
  - docs/10-infrastructure/runbooks/         # runbooks que podem ter sido acionados
  - docs/09-decisions/DECISION_LOG.md        # decisões tomadas durante o incidente
version: 0.1.0
status: template
priority: alta
---

> **[TEMPLATE]**
> Copiar para `docs/10-infrastructure/runbooks/incidents/YYYY-MM-DD-descricao.md`
