# ADR-0011 — Módulos CAP não Contêm Lógica de Priorização

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0011 |
| **Título** | Lógica de Priorização de Situações é Responsabilidade Exclusiva da ENG-11 |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | CAP-01 a CAP-09, ENG-11 |

---

## Contexto

Em sistemas de gestão sem arquitetura centralizada, cada módulo desenvolve sua própria lógica de priorização. O módulo de vendas decide que oportunidades acima de R$50k são "alta prioridade". O módulo de clientes decide que clientes com health score < 40 são "urgentes". O módulo financeiro decide que inadimplência acima de 30 dias é "crítica".

O resultado é uma proliferação de critérios de priorização inconsistentes entre si. Um problema "crítico" em vendas não tem o mesmo peso que um problema "crítico" em financeiro — e quando os dois colidem por atenção de um gestor, não existe nenhum mecanismo objetivo para decidir qual merece resposta primeiro.

Além disso, cada módulo com sua própria lógica de priorização precisa conhecer o contexto global do negócio (é período de fechamento? existe crise de receita?) para priorizar corretamente. Isso força módulos a manterem conhecimento sobre o estado global do sistema — acoplamento que viola o princípio de isolamento de domínio.

---

## Decisão

**Módulos CAP não contêm lógica de priorização.** Todo módulo publica eventos declarando o que aconteceu, sem qualificar a severidade. A qualificação de severidade e a priorização são responsabilidade exclusiva da **ENG-11 (Decision Engine)** via Matriz Universal de Priorização (MUP).

A MUP aplica cinco dimensões (Impacto × Urgência × Frequência × Tendência × Risco) com pesos configuráveis (gerenciados pela ENG-12 como parâmetros dinâmicos), produzindo uma prioridade objetiva e comparável entre situações de qualquer módulo.

Módulos podem declarar metadados que alimentam a MUP (ex: "este cliente é tier A"), mas nunca calculam a prioridade diretamente.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Cada módulo define prioridade de seus próprios eventos | Critérios inconsistentes entre módulos; impossível comparar prioridades cross-módulo objetivamente; cada módulo precisa de contexto global |
| Priorização por tipo de evento (ex: `oportunidade.ganha` é sempre ALTA) | Rígido; prioridade não depende apenas do tipo mas do contexto (ex: `oportunidade.ganha` de R$500 é menos importante que `cliente.churn_risco_detectado` de cliente tier A com R$50k MRR) |
| Priorização humana sem algoritmo | Subjetiva; varia por responsável; impossível auditar ou melhorar sistematicamente |

---

## Consequências Positivas

- **Priorização comparável:** qualquer situação de qualquer módulo recebe um score na mesma escala; um gestor pode comparar prioridades cross-módulo objetivamente
- **Priorização sensível ao contexto:** a ENG-12 pode ajustar os pesos da MUP conforme o contexto empresarial (crise financeira, crescimento acelerado) sem alterar nenhum módulo CAP
- **Módulos simples:** módulos não precisam conhecer o estado global do negócio para decidir se algo é urgente; eles apenas publicam o que aconteceu
- **Melhoria evolutiva:** a MUP pode ser refinada centralmente com base em aprendizado; melhora automaticamente para todos os módulos

## Trade-offs Aceitos

- **MUP pode não capturar nuances de domínio:** a MUP é genérica; situações muito específicas de um domínio podem precisar de modificadores para serem priorizadas corretamente; os modificadores automáticos da MUP cobrem os casos mais comuns (cliente tier A, período de fechamento)
- **ENG-11 é um ponto de centralização:** toda priorização passa pela ENG-11; se a ENG-11 tiver problema, a priorização do sistema inteiro é afetada; aceito porque a ENG-11 é uma engine de infraestrutura com requisitos de disponibilidade correspondentes
