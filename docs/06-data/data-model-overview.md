---
name: DATA_MODEL_OVERVIEW
purpose: >
  Visão geral do modelo de dados do SOE: diagrama entidade-relacionamento de alto
  nível, principais agregados, relacionamentos entre módulos e estratégia de
  persistência (SQL, NoSQL, cache, blob). Não é o schema completo — é a visão
  que qualquer engenheiro precisa para entender o modelo em 10 minutos.
responsibility: Arquiteto de Dados / Arquiteto Líder.
relationships:
  - docs/06-data/data-dictionary.md       # detalhamento de cada entidade vista aqui
  - docs/03-domain/bounded-contexts.md    # contextos que organizam o modelo
  - database/schemas/                      # implementação detalhada
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
