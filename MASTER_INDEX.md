---
name: MASTER_INDEX
purpose: >
  Índice mestre e rastreável de todos os documentos oficiais do projeto SOE.
  É o mapa de navegação da documentação: lista cada documento com seu status,
  versão, responsável e localização. Permite auditoria de completude documental.
responsibility: >
  Guardião da Documentação Técnica — atualizado automaticamente via script
  (scripts/generate-index.sh) e manualmente a cada novo documento criado.
relationships:
  - README.md                          # referenciado como destino de navegação
  - todos os documentos em docs/       # indexados aqui
  - scripts/generate-index.sh          # utilitário que mantém este índice atualizado
version: 0.1.0
status: draft
priority: crítica
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
