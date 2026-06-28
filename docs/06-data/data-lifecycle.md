---
name: DATA_LIFECYCLE
purpose: >
  Define o ciclo de vida de cada categoria de dado no SOE: como é criado,
  quem pode modificar, por quanto tempo é retido, quando é arquivado e quando
  é expurgado. Fundamental para LGPD, auditoria e gestão de custos de armazenamento.
responsibility: Arquiteto de Dados + Jurídico (para dados pessoais).
relationships:
  - docs/06-data/lgpd/retention-policy.md    # política de retenção para dados pessoais
  - docs/06-data/data-dictionary.md           # categorias de dados com seus ciclos
  - docs/09-security/audit-logging.md         # auditoria de operações sobre dados
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
