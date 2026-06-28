---
name: ENCRYPTION_POLICY
purpose: >
  Política de criptografia do SOE: algoritmos aprovados, gerenciamento de chaves,
  criptografia em repouso (dados sensíveis no banco), criptografia em trânsito
  (TLS), criptografia de backups e processo de rotação de chaves.
responsibility: Arquiteto de Segurança.
relationships:
  - docs/09-security/security-policy.md      # política geral que inclui esta
  - docs/06-data/lgpd/data-mapping.md        # dados pessoais que exigem criptografia
  - docs/10-infrastructure/cloud-architecture.md  # serviços de KMS utilizados
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
