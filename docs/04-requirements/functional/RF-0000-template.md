---
name: FUNCTIONAL_REQUIREMENT_TEMPLATE
purpose: >
  Template padrão para especificação de requisitos funcionais (RF). Cada RF documenta
  uma capacidade que o sistema deve prover: descrição, atores envolvidos, fluxo principal,
  fluxos alternativos, regras de negócio aplicáveis, critérios de aceite e rastreabilidade
  até a visão/módulo de origem.
responsibility: >
  Analista de Negócios / Líder de Módulo — revisado pelo Arquiteto Líder.
relationships:
  - docs/00-project/vision.md               # requisito deve rastrear até a visão
  - docs/05-modules/                         # módulo ao qual o RF pertence
  - docs/03-domain/ubiquitous-language.md   # termos usados no RF devem estar aqui
  - docs/11-testing/test-plans/             # plano de teste derivado deste RF
version: 0.1.0
status: template
priority: crítica

# ─── INSTRUÇÕES DE USO ────────────────────────────────────────────────────────
# 1. Copie para docs/04-requirements/functional/RF-XXXX-nome-curto.md
# 2. Substitua XXXX pelo ID sequencial no escopo do módulo
# 3. Preencha todas as seções
# ─────────────────────────────────────────────────────────────────────────────
---

> **[TEMPLATE — NÃO EDITAR ESTE ARQUIVO]**
> Copie e preencha conforme as instruções no cabeçalho.
