---
name: DATA_DICTIONARY
purpose: >
  Dicionário oficial de todos os dados do SOE: cada entidade, atributo, tipo,
  descrição, restrições, valores possíveis, origem e módulo proprietário.
  É a referência definitiva para qualquer dúvida sobre um dado — nenhum atributo
  existe no sistema sem estar documentado aqui.
responsibility: >
  Arquiteto de Dados — contribuições dos líderes de módulo via processo editorial.
relationships:
  - docs/05-modules/*/data-entities.md    # entidades por módulo que alimentam este dicionário
  - docs/06-data/data-model-overview.md   # visão geral dos relacionamentos
  - database/schemas/                      # implementação dos dados descritos aqui
  - docs/06-data/lgpd/data-mapping.md     # identificação de dados pessoais neste dicionário
version: 0.1.0
status: draft
priority: crítica
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
