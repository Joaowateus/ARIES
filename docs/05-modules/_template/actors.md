---
name: MODULE_ACTORS_TEMPLATE
purpose: >
  Template — Define os atores (usuários, sistemas, papéis) que interagem com
  o módulo: quem usa, quem administra, quais sistemas externos se integram e
  quais são as permissões de cada ator.
responsibility: Líder do Módulo com aprovação do Arquiteto Líder.
relationships:
  - docs/05-modules/_template/use-cases.md    # atores participam dos casos de uso
  - docs/09-security/access-control.md        # permissões dos atores mapeadas em RBAC
  - docs/12-ux/personas.md                    # personas que correspondem aos atores
version: 0.1.0
status: template
priority: alta
---

> **[TEMPLATE — NÃO EDITAR ESTE DIRETÓRIO]**
