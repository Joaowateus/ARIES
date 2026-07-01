# ADR-0003 — CUE como Contrato Único e Autoritativo de Eventos

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0003 |
| **Título** | Catálogo Universal de Eventos (CUE) como Contrato Único e Autoritativo |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | Todos os módulos CAP, ENG-11 (§13), ENG-12 |

---

## Contexto

Em uma arquitetura orientada a eventos, o maior risco não é a falta de eventos — é a proliferação não governada de eventos. Cada módulo, se livre para criar seus próprios eventos, tende a criar nomes ligeiramente diferentes para o mesmo conceito, payloads incompatíveis entre si, e duplicação de semântica.

O problema não é visível no início. Aparece quando o sistema cresce: "qual evento devo consumir para saber que um cliente cancelou?" — `cliente.churned`, `cliente.cancelado`, `cliente.cancelamento`, `receita.churn_confirmado`? Cada módulo escolheu um nome diferente para a mesma coisa.

---

## Decisão

O **Catálogo Universal de Eventos (CUE)** é o contrato único de todos os eventos do barramento SOE. Suas propriedades:

1. **Fechado por padrão:** nenhum evento pode ser publicado sem estar no CUE
2. **Extensível por RFC:** adicionar evento ao CUE é uma mudança MINOR (RFC simplificado, D2)
3. **Autoritativo:** em caso de conflito entre o que um módulo documenta e o que o CUE declara, o CUE prevalece
4. **Versionado:** cada entrada no CUE tem `versao_schema`; mudanças de schema seguem SemVer
5. **Agnóstico à implementação:** o CUE declara semântica e payload, não tecnologia de transporte

A convenção de nomenclatura `[dominio].[entidade].[acao_passado]` é obrigatória e verificável automaticamente pelo Health Check da ENG-12.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Catálogos por módulo (cada CAP define seus próprios eventos) | Nenhuma visão consolidada; consumidores precisam conhecer todos os catálogos individuais; deriva de nomenclatura inevitável |
| Schema Registry técnico sem catálogo semântico | Controla formato mas não semântica; dois eventos com schema idêntico mas significado diferente passam sem detecção |
| Convenção de nomenclatura sem enforcement | Convenções sem enforcement são sugestões; deriva acontece por acidente, não por má-fé |

---

## Consequências Positivas

- **Vocabulário único:** qualquer desenvolvedor encontra qualquer evento em um lugar
- **Detecção automática de violações:** Health Check da ENG-12 verifica se todo evento publicado está no CUE
- **Evolução controlada:** adicionar evento é RFC; remover evento é protocolo de depreciação; nada acontece silenciosamente
- **ENG-11 pode processar qualquer evento:** por ter semântica conhecida de todos os eventos, o Decision Engine pode classificar situações sem configuração por módulo

## Trade-offs Aceitos

- **Fricção inicial:** criar um evento novo requer RFC simplificado; isso é intencional — a fricção é menor que o custo de deriva
- **CUE pode crescer:** com 74+ eventos iniciais e adições via RFC, o CUE pode se tornar grande; compensado pela organização por domínio e pela capacidade de busca
