---
name: WORKFLOW_SPEC_TEMPLATE
purpose: >
  Template de especificação de workflow/automação: propósito, gatilho (evento ou
  agendamento), passos da automação, sistemas envolvidos, tratamento de erros,
  idempotência, rastreabilidade das execuções e critérios de sucesso/falha.
responsibility: Arquiteto Líder / Líder do Módulo.
relationships:
  - docs/14-automations/automation-catalog.md    # workflow listado no catálogo
  - docs/03-domain/domain-events.md              # eventos que disparam o workflow
  - docs/07-integrations/                         # integrações utilizadas no workflow
version: 0.1.0
status: template
priority: alta

# ─── INSTRUÇÕES DE USO ────────────────────────────────────────────────────────
# Copie para docs/14-automations/workflows/NOME-DO-WORKFLOW/workflow-spec.md
# ─────────────────────────────────────────────────────────────────────────────
---

> **[TEMPLATE — NÃO EDITAR ESTE ARQUIVO]**
