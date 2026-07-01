# ADR-0004 — At-Least-Once Delivery com Deduplicação por Consumidor

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0004 |
| **Título** | Garantia de Entrega At-Least-Once com Deduplicação Obrigatória por Consumidor |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ENGINE-CONTRATO-DE-INTEGRACAO, todos os consumidores de eventos |

---

## Contexto

Todo sistema de mensageria distribui eventos com uma das três garantias: at-most-once (pode perder), at-least-once (pode duplicar), exactly-once (nunca perde, nunca duplica). Exactly-once é teoricamente atraente mas na prática requer coordenação distribuída de alto custo, e raramente é verdadeiramente garantido em cenários de falha de rede ou reinicialização de consumidores.

A escolha da garantia de entrega determina onde reside a responsabilidade pela confiabilidade: no barramento (exactly-once) ou nos consumidores (at-least-once + deduplicação).

---

## Decisão

O barramento SOE garante **at-least-once delivery**. Todo consumidor de evento é responsável por implementar **deduplicação por `event_id`**.

O campo `event_id` é obrigatório em todos os eventos do CUE e é um UUID v4 gerado pelo publicador no momento da publicação. Consumidores mantêm um registro de `event_id` processados recentemente (janela mínima: 24 horas) e descartam silenciosamente eventos cujo `event_id` já foi processado.

Consequência direta: toda ação de consumidor deve ser **idempotente** — executar a mesma ação duas vezes com o mesmo `event_id` não deve produzir efeito diferente de executar uma vez.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Exactly-once delivery no barramento | Custo de implementação e latência desproporcional; "exactly-once" de barramentos como Kafka é exactly-once dentro do barramento, não end-to-end; não elimina a necessidade de idempotência nos consumidores |
| At-most-once (sem reentrega) | Perda de evento é aceitável em métricas de baixa criticidade, mas inaceitável para eventos de transição de processo (ex: `oportunidade.ganha` — perder esse evento significa não faturar nem fazer onboarding) |
| Deduplicação centralizada no barramento | Move complexidade para o barramento; consumidores com requisitos de deduplicação diferentes não conseguem configurar janelas individuais; acoplamento de lógica de negócio na infraestrutura |

---

## Consequências Positivas

- **Confiabilidade sem custo de exactly-once:** eventos críticos nunca são perdidos; o custo de duplicatas é tratado pela deduplicação
- **Recuperação de falhas simples:** se um consumidor reinicia, ele reprocessa eventos com seus `event_id`; a deduplicação descarta os que já foram tratados
- **Clareza de responsabilidade:** o barramento garante entrega; o consumidor garante idempotência; não há ambiguidade sobre quem faz o quê

## Trade-offs Aceitos

- **Cada consumidor implementa deduplicação:** isso é custo real de desenvolvimento; compensado por ser um padrão bem conhecido com implementação padronizável
- **Janela de deduplicação finita:** eventos com `event_id` idêntico separados por mais de 24h podem ser processados duas vezes; esse cenário é considerado exceção operacional, não caso normal
- **Consumidores devem ser idempotentes:** impõe restrição de design em toda lógica de consumidor; restrição considerada saudável pois força design defensivo
