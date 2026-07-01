# ADR-0002 — Arquitetura Orientada a Eventos como Mecanismo Único de Comunicação

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0002 |
| **Título** | Arquitetura Orientada a Eventos como Mecanismo Único de Comunicação entre Módulos |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | CAP-01 a CAP-09, ENG-01 a ENG-12, CUE |

---

## Contexto

O Commercial OS é composto por 9 módulos de domínio (CAP) e 12 engines compartilhadas (ENG). Esses componentes precisam se comunicar — um lead qualificado em CAP-02 precisa chegar ao processo de vendas em CAP-03; uma oportunidade ganha em CAP-03 precisa ativar o faturamento em CAP-04 e o onboarding em CAP-05.

A questão é: como esses componentes se comunicam sem criar acoplamento?

O acoplamento direto (CAP-03 chama CAP-04 diretamente) cria um problema estrutural: cada módulo passa a depender dos detalhes de implementação dos outros. Uma mudança em CAP-04 pode quebrar CAP-03. Uma mudança em CAP-03 exige coordenação simultânea com CAP-04 e CAP-05. O sistema como um todo se torna difícil de evoluir e impossível de testar isoladamente.

---

## Decisão

Toda comunicação entre módulos CAP e entre módulos e engines ocorre exclusivamente via **barramento de eventos SOE**, seguindo o Catálogo Universal de Eventos (CUE).

Regras derivadas desta decisão:
- Nenhum módulo CAP acessa dados de outro módulo CAP diretamente (sem chamada direta, sem banco de dados compartilhado)
- Todo evento publicado deve estar declarado no CUE antes de ser publicado
- Eventos seguem a convenção `[dominio].[entidade].[acao_passado]`
- O barramento garante at-least-once delivery; consumidores implementam deduplicação por `event_id`

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Chamadas diretas entre módulos (REST/RPC) | Cria acoplamento estrutural; mudança em qualquer módulo exige coordenação com todos os dependentes; impossibilita evolução independente |
| Banco de dados compartilhado | Acoplamento via schema; qualquer mudança de schema é uma mudança breaking para todos os módulos; viola isolamento de domínio |
| Mensageria com tópicos livres (sem catálogo) | Deriva de nomenclatura inevitável; sem contrato formal, consumidores dependem de conhecimento implícito do publicador |
| GraphQL Federation | Útil para queries; não serve para comunicação assíncrona baseada em estado; não representa mudanças de domínio |

---

## Consequências Positivas

- **Isolamento real:** cada módulo pode ser desenvolvido, testado e implantado independentemente
- **Rastreabilidade:** todo evento carrega `event_id` e `correlacao_id`; é possível rastrear qualquer fluxo de ponta a ponta
- **Extensibilidade:** adicionar um novo consumidor a um evento existente não requer mudança no publicador
- **Auditabilidade:** o barramento é a fonte de verdade de tudo que aconteceu no sistema

## Trade-offs Aceitos

- **Consistência eventual:** módulos não veem as mudanças uns dos outros imediatamente; consistência forte requer coordenação explícita
- **Complexidade de debugging:** rastrear um fluxo distribuído requer ferramentas de tracing (coberto pelo `correlacao_id`)
- **Duplicatas possíveis:** at-least-once significa que consumidores devem ser idempotentes; esse custo é conhecido e aceito
