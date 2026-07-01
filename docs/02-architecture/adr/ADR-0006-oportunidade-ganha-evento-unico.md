# ADR-0006 — oportunidade.ganha como Evento Único de Conversão com Payload Enriquecido

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0006 |
| **Título** | CAP-03 Publica Único Evento de Conversão com Payload Completo; Downstream Derivam seus Domínios |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | CAP-03, CAP-04, CAP-05, ENG-01, ENG-07, ENG-11 |

---

## Contexto

Quando uma oportunidade é ganha em CAP-03, múltiplos módulos precisam agir: CAP-04 inicia o faturamento, CAP-05 inicia o onboarding, ENG-01 instancia processos. A questão é: CAP-03 deve publicar um evento por módulo que precisa reagir, ou um único evento que todos consomem?

A alternativa de múltiplos eventos foi considerada: CAP-03 publicaria `cliente.contrato_assinado` para CAP-05, `receita.contrato_novo` para CAP-04, e `oportunidade.ganha` para ENG-01. Isso parece intuitivo — cada módulo recebe exatamente o que precisa.

O problema é que cria **domain pollution**: CAP-03 (domínio de vendas) passa a publicar eventos nos domínios `cliente.*` e `receita.*`, que pertencem a CAP-05 e CAP-04 respectivamente. CAP-03 assume conhecimento e responsabilidade sobre como outros domínios devem se ver afetados por uma conversão de vendas.

---

## Decisão

CAP-03 publica **um único evento** ao fechar uma venda: `oportunidade.ganha`, com payload enriquecido contendo todos os dados necessários para que qualquer consumidor derive seus próprios eventos de domínio:

```yaml
payload: {oportunidade_id, contrato_id, cliente_id, valor_total, mrr,
          segmento_id, ciclo_dias, data_inicio, data_fim, forma_pagamento,
          condicoes_json, responsavel_cs_id}
```

CAP-04, ao consumir `oportunidade.ganha`, deriva seus eventos de receita internamente. CAP-05, ao consumir `oportunidade.ganha`, deriva seus eventos de cliente internamente. Nenhum módulo depende de outro módulo para publicar eventos em seu domínio.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| CAP-03 publica `cliente.contrato_assinado` e `receita.contrato_novo` | Domain pollution: CAP-03 invade domínios alheios; mudança na estrutura de CAP-04 ou CAP-05 pode exigir mudança em CAP-03 |
| CAP-03 publica múltiplos eventos por consumidor previsto | Acoplamento implícito: CAP-03 precisa conhecer todos os módulos que dependem de uma conversão; adicionar novo consumidor requer mudança em CAP-03 |
| Evento genérico sem payload estruturado | Consumidores não têm dados suficientes; cada um precisa fazer queries adicionais para obter contexto; latência e acoplamento via query |

---

## Consequências Positivas

- **CAP-03 não conhece seus consumidores:** adicionar um novo módulo que reage a `oportunidade.ganha` não requer qualquer mudança em CAP-03
- **Domínios preservados:** eventos `cliente.*` são publicados por CAP-05; eventos `receita.*` são publicados por CAP-04; cada módulo controla seu próprio domínio
- **Payload auto-contido:** consumidores têm tudo que precisam no evento; nenhuma query adicional necessária para processar o evento
- **Rastreabilidade:** um único `correlacao_id` conecta todos os fluxos derivados de uma conversão

## Trade-offs Aceitos

- **Payload maior:** `oportunidade.ganha` carrega mais dados do que qualquer consumidor individual precisa; custo de largura de banda aceito em troca de desacoplamento
- **Consumidores derivam eventos:** CAP-04 e CAP-05 precisam publicar seus próprios eventos derivados; isso é considerado comportamento correto, não overhead
