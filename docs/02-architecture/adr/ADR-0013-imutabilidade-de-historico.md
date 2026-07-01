# ADR-0013 — Imutabilidade de Histórico em Todos os Registros Transacionais

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0013 |
| **Título** | Registros de Transição, Auditoria, Diagnóstico e Decisão são Append-Only e Imutáveis |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ENG-01, ENG-04, ENG-06, ENG-11, ENG-12 |

---

## Contexto

Em sistemas de gestão empresarial, a tentação de "corrigir" registros históricos é constante: um diagnóstico que apontou a causa errada, uma transição de etapa registrada incorretamente, um alerta que deveria ter sido diferente. A correção parece razoável — afinal, o registro "errado" está preservado e será auditado.

O problema é que quando registros históricos podem ser alterados, perde-se uma propriedade fundamental: a capacidade de confiar em qualquer registro. Se um registro pode ter sido alterado depois, como saber se o que está registrado reflete o que realmente aconteceu? A auditabilidade do sistema depende inteiramente da confiança de que registros históricos são exatamente o que foram no momento em que foram criados.

Além disso, a possibilidade de "corrigir" histórico cria um incentivo perverso: erros cometidos por responsáveis podem ser apagados, reduzindo a responsabilização e comprometendo o aprendizado organizacional.

---

## Decisão

Os seguintes tipos de registro são **append-only e imutáveis** no Commercial OS:

- `processo_transicoes` (ENG-01) — transições de etapa de processos
- `workflow_acoes_log` (ENG-07) — log de ações de workflows
- `diagnosticos` (ENG-04/ENG-11) — sessões de diagnóstico e causa raiz
- Log de auditoria (ENG-06) — todos os eventos de auditoria
- `decisao_situacoes` e tabelas relacionadas (ENG-11) — incidentes e decisões
- `rs_versoes` (ENG-12) — histórico de versões de artefatos
- `rfcs` (ENG-12) — histórico de mudanças arquiteturais

**Política de correção:** se um registro histórico está incorreto, a correção é registrada como um **novo evento** que referencia o registro original. O registro original nunca é alterado. O histórico passa a conter tanto o registro original (incorreto) quanto o registro de correção, com timestamp e responsável pela correção.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Permitir edição de registros históricos com log de alteração | Registro original perde autoridade; log de alteração cria complexidade de "qual versão é a verdadeira?"; mantém a tentação de alterar |
| Soft delete (marcar como inválido sem apagar) | Ainda permite que o estado "corrente" seja diferente do estado histórico; não preserva totalmente a cadeia de eventos |
| Imutabilidade apenas em auditoria, não em operação | Cria dois padrões; a fronteira entre "operacional" e "auditável" é ambígua; simplificate mantendo um único padrão |

---

## Consequências Positivas

- **Auditabilidade real:** qualquer registro pode ser verificado; ninguém pode alterar o passado para proteger a narrativa do presente
- **Aprendizado honesto:** erros ficam registrados; padrões de erros podem ser detectados e usados para melhorar processos
- **Responsabilização:** responsáveis sabem que decisões ficam registradas de forma permanente; incentiva cuidado na tomada de decisão
- **Rastreabilidade completa:** dado qualquer ponto no presente, é possível reconstruir o caminho completo que levou até ele

## Trade-offs Aceitos

- **Correções são mais custosas:** em vez de editar um campo errado em 30 segundos, é necessário criar um novo registro de correção com referência e justificativa; esse custo é aceito como incentivo à precisão no momento da criação
- **Armazenamento cresce permanentemente:** registros imutáveis nunca são deletados; isso tem custo de armazenamento; aceito porque armazenamento é barato e a perda de auditabilidade seria irreparável
- **Queries de "estado atual" são mais complexas:** para saber o estado atual de algo com histórico imutável, é necessário agregar todos os eventos; compensado por views materializadas e snapshots periódicos
