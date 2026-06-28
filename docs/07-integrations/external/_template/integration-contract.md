---
name: INTEGRATION_CONTRACT_TEMPLATE
purpose: >
  Template de contrato de integração com sistema externo: identificação do sistema,
  protocolo, autenticação, endpoints/tópicos consumidos e expostos, formato de dados,
  tratamento de erros, SLA de disponibilidade do terceiro e plano de contingência.
responsibility: Arquiteto Líder / Líder da integração.
relationships:
  - docs/07-integrations/overview.md     # integração listada no mapa geral
  - docs/08-api/contracts/               # contrato técnico OpenAPI/AsyncAPI
  - docs/09-security/access-control.md   # credenciais e permissões da integração
version: 0.1.0
status: template
priority: alta

# ─── INSTRUÇÕES DE USO ────────────────────────────────────────────────────────
# Copie para docs/07-integrations/external/NOME-DO-SISTEMA/integration-contract.md
# ─────────────────────────────────────────────────────────────────────────────
---

> **[TEMPLATE — NÃO EDITAR ESTE ARQUIVO]**
