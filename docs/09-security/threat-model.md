---
name: THREAT_MODEL
purpose: >
  Modelo de ameaças do SOE usando a metodologia STRIDE: identifica ativos críticos,
  superfícies de ataque, ameaças por categoria (Spoofing, Tampering, Repudiation,
  Information Disclosure, Denial of Service, Elevation of Privilege), probabilidade,
  impacto e controles mitigadores para cada ameaça.
responsibility: Arquiteto de Segurança — revisado anualmente e a cada mudança arquitetural.
relationships:
  - docs/09-security/security-policy.md      # política que responde às ameaças
  - docs/02-architecture/views/security-view.md  # visão arquitetural de segurança
  - docs/09-security/penetration-testing/    # pentests que validam o modelo
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
