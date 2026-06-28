---
name: UBIQUITOUS_LANGUAGE
purpose: >
  Define a linguagem ubíqua do SOE: o conjunto preciso de termos que negócio e
  tecnologia usam com exatamente o mesmo significado, dentro de cada contexto
  delimitado (bounded context). Elimina a "tradução" entre áreas e previne bugs
  gerados por ambiguidade semântica.
responsibility: >
  Arquiteto Líder + Especialistas de Domínio de cada área de negócio.
  Todos têm direito de propor termos; Arquiteto Líder aprova.
relationships:
  - docs/00-project/glossary.md           # glossário geral que este documento especializa
  - docs/03-domain/bounded-contexts.md    # contextos onde cada termo é válido
  - docs/05-modules/                      # módulos cujos termos de domínio são definidos aqui
version: 0.1.0
status: draft
priority: alta
---

> **[DOCUMENTO EM ESTRUTURAÇÃO]**
> O conteúdo deste documento será elaborado na próxima fase do projeto.
