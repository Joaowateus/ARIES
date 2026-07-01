# ADR-0009 — Grafo de Dependências Calculado do RS, não Mantido Manualmente

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0009 |
| **Título** | Grafo de Dependências é Derivado Automaticamente do Registro Sistêmico |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ENG-12 (Sistema 4) |

---

## Contexto

Em qualquer sistema com múltiplos componentes, existe a necessidade de entender quem depende de quem: se ENG-01 muda, quais módulos são afetados? Se um evento muda de schema, quais consumidores precisam migrar?

A abordagem mais comum é manter esse mapa manualmente — um diagrama de dependências atualizado por humanos quando mudanças são feitas. O problema é que diagramas manuais ficam desatualizados. A primeira vez que alguém esquece de atualizar o diagrama ao fazer uma mudança, ele passa a mentir. E diagramas que mentem são piores que nenhum diagrama — criam falsa confiança.

Existe uma alternativa: o Grafo de Dependências não é mantido — ele é **calculado**. Se os dados de declaração de dependências são mantidos no Registro Sistêmico (RS), o grafo é uma derivação determinística desses dados. Quando o RS é atualizado, o grafo é recalculado. O grafo nunca fica desatualizado porque nunca é editado diretamente.

---

## Decisão

O Grafo de Dependências da ENG-12 é **calculado em tempo real a partir do Registro Sistêmico (RS)**. Nenhuma pessoa edita o grafo diretamente. O grafo é uma view derivada do RS.

Quando um módulo declara no RS que consome o evento `oportunidade.ganha`, essa declaração cria automaticamente uma dependência `CONSOME_EVENTO` entre o módulo e CAP-03 no grafo. Quando a declaração é removida (via RFC), a dependência some do grafo.

A consequência é que o grafo é sempre consistente com o RS — por construção, não por disciplina humana.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Diagrama manual atualizado por pull request | Fica desatualizado inevitavelmente; requer disciplina que não escala; falsa confiança quando desatualizado |
| Grafo declarado em arquivo separado | Dois lugares para manter a mesma informação (RS + grafo); divergência garantida com o tempo |
| Descoberta automática via análise de código (code scanning) | Captura dependências de runtime mas não semântica intencional; uma dependência pode existir no código por acidente ou legado |

---

## Consequências Positivas

- **Impossível ficar desatualizado:** o grafo reflete o estado atual do RS; se o RS está correto, o grafo está correto
- **Inconsistências detectáveis:** se uma dependência existe no RS mas não no código (ou vice-versa), é detectável — o RS é a fonte de verdade declarada
- **Análise de impacto automática:** o Motor de RFC usa o grafo para calcular automaticamente quais componentes são afetados por uma mudança proposta
- **Alertas de anomalia:** dependências circulares, eventos sem publicador, componentes órfãos — detectáveis automaticamente porque o grafo é estruturado

## Trade-offs Aceitos

- **RS precisa ser atualizado:** a qualidade do grafo depende da qualidade do RS; se um componente não declara suas dependências no RS, o grafo não as conhece; compensado pelo Health Check que verifica completude do RS
- **Grafo é tão bom quanto as declarações:** declarações incorretas produzem grafo incorreto; o processo de RFC e o Health Check são as salvaguardas
