---
name: NFR_COMPLIANCE
purpose: >
  Lista todas as obrigações regulatórias e legais que o SOE deve atender: LGPD,
  legislações trabalhistas (impacto no módulo RH), normas fiscais (impacto no
  Financeiro), regulações setoriais aplicáveis à MM Negócios e certificações
  desejadas. Cada requisito de compliance deve ser rastreável até uma regra de negócio.
responsibility: >
  Jurídico da MM Negócios + Arquiteto Líder — revisado anualmente ou a cada mudança
  regulatória relevante.
relationships:
  - docs/06-data/lgpd/                          # implementação dos requisitos LGPD
  - docs/15-compliance/regulatory-map.md        # mapa completo de regulações
  - docs/09-security/security-policy.md         # sobreposição com segurança
  - docs/05-modules/financial/business-rules.md # regras fiscais no módulo financeiro
version: 0.1.0
status: draft
priority: crítica
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
