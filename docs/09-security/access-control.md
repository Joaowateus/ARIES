---
name: ACCESS_CONTROL
purpose: >
  Define o modelo de controle de acesso do SOE (RBAC/ABAC): papéis do sistema,
  permissões por papel, recursos protegidos, políticas de acesso por módulo e
  regras de herança de permissão. É a referência para implementação de autorização
  em qualquer parte do sistema.
responsibility: Arquiteto de Segurança / Arquiteto Líder.
relationships:
  - docs/01-governance/roles-and-responsibilities.md  # papéis organizacionais mapeados aqui
  - docs/08-api/authentication.md                     # autenticação que precede autorização
  - docs/05-modules/admin/use-cases.md                # gestão de papéis no módulo admin
  - docs/09-security/audit-logging.md                 # acessos auditados
version: 0.1.0
status: draft
priority: crítica
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
