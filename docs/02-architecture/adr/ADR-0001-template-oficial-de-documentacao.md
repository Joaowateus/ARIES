# ADR-0001 — Template Oficial de Documentação Técnica

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0001 |
| **Título** | Adoção de Template Oficial Único para Toda a Documentação do SOE |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-06-28 |
| **Última Revisão** | 2026-06-28 |
| **Versão** | 1.0.0 |

---

## Contexto

O projeto SOE é um sistema de alta complexidade que será desenvolvido por múltiplas pessoas
ao longo de anos. Sem um padrão único de documentação, documentos produzidos em momentos
diferentes teriam estruturas distintas, tornando impossível:

- Auditar a completude de qualquer documento
- Automatizar validações de qualidade documental
- Navegar e comparar documentos de forma previsível
- Garantir que campos críticos (responsável, status, critérios de aceite) nunca sejam omitidos

A fase anterior criou 191 arquivos com metadados YAML no cabeçalho (front-matter). Esses
metadados capturam campos importantes, mas não definem a estrutura interna do corpo do
documento — o que deixa cada autor livre para organizar o conteúdo da maneira que preferir,
gerando inconsistência ao longo do tempo.

---

## Decisão

Adotar um **Template Oficial de Documentação Técnica** único, obrigatório e versionado,
localizado em:

```
templates/TEMPLATE-OFICIAL.md
```

Todos os documentos produzidos a partir desta decisão devem seguir exatamente as seções
definidas nesse template, na ordem definida, com os campos obrigatórios preenchidos.
Documentos que não seguirem o template não serão aceitos via Pull Request (validado
pelo checklist do `PULL_REQUEST_TEMPLATE.md`).

O `DOCUMENTATION_GUIDE.md` é atualizado para referenciar este ADR e o template como
a única fonte de verdade sobre estrutura documental.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Manter front-matter YAML sem estrutura de corpo padronizada | Inconsistência inevitável no conteúdo; campos críticos seriam omitidos por descuido |
| Usar ferramentas externas de gestão de docs (Confluence, Notion) | Viola o princípio de "documentação como código" e cria dependência de ferramenta proprietária |
| Ter templates diferentes por tipo de documento | Aumenta carga cognitiva; seções como "Critérios de Aceite" e "Histórico" são universais |

---

## Consequências

**Positivas:**
- Qualquer membro da equipe sabe exatamente o que esperar de qualquer documento
- Validações automáticas (CI) podem verificar presença de seções obrigatórias
- Auditoria de qualidade documental é trivial e objetiva
- Novos membros aprendem o padrão uma única vez

**Negativas / Trade-offs:**
- Documentos muito simples terão seções com valor "N/A" — custo aceitável pela uniformidade
- Migração dos 191 documentos existentes para o novo formato é necessária (trabalho planejado)

---

## Referências

- `templates/TEMPLATE-OFICIAL.md` — o template resultante desta decisão
- `DOCUMENTATION_GUIDE.md` — guia que torna este ADR operacional
- `docs/01-governance/review-policy.md` — política de revisão que reforça este padrão
- `.github/PULL_REQUEST_TEMPLATE.md` — checklist que valida conformidade
