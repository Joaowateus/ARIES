---
name: VERSIONING_POLICY
purpose: >
  Define a estratégia de versionamento de todos os artefatos do projeto: documentos,
  APIs, schemas de banco de dados, contratos de integração e releases de software.
  Adota SemVer (MAJOR.MINOR.PATCH) e define o que constitui cada tipo de mudança.
  Também define o ciclo de vida de documentos: draft → review → approved → deprecated.
responsibility: >
  Arquiteto Líder com aplicação por toda a equipe.
relationships:
  - CHANGELOG.md                               # versões registradas aqui
  - CONTRIBUTING.md                            # processo que aplica esta política
  - docs/08-api/changelog/                     # versionamento específico de APIs
  - docs/01-governance/editorial-process.md    # ciclo de vida documental
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
