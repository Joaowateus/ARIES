# ADR-0010 — Architecture Freeze Baseado em Evidência de Produção, não em Calendário

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0010 |
| **Título** | Critério de Revisão do Architecture Freeze é Evidência Operacional, não Data |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ARCH-001, ENG-12 |

---

## Contexto

Ao declarar um Architecture Freeze, existe uma decisão secundária que raramente é explicitada: quando o freeze termina? A resposta mais comum é uma data ("o freeze dura 6 meses"). Datas de expiração de freeze criam um problema: elas incentivam revisões arquiteturais no momento errado — não quando há evidência de que algo precisa mudar, mas quando o calendário diz que é hora de revisar.

O resultado típico é que, na data de expiração, a equipe se reúne para decidir se estende o freeze ou o levanta — sem dados suficientes para tomar essa decisão bem, porque poucos módulos foram implementados em produção. A reunião produz mais debate do que aprendizado.

A alternativa é que o critério de revisão seja baseado em evidência operacional: o freeze é revisado quando houver dados reais sobre como a arquitetura se comporta em produção, não antes.

---

## Decisão

O Architecture Freeze v1.0 não tem data de expiração. Ele é reavaliado quando **pelo menos três módulos CAP estiverem em produção** e houver dados suficientes para avaliar se a arquitetura precisa de ajustes estruturais.

A lógica é: se a arquitetura suportar a implementação dos primeiros três CAPs com poucas mudanças estruturais, isso é evidência forte de que a base é sólida. Se mudanças estruturais forem necessárias, elas emergirão de problemas reais de implementação — não de especulação antecipada.

A única forma de antecipar a revisão é via RFC ARCHITECTURAL aprovado em D4 — o que significa que há uma razão concreta e urgente para mudar, não apenas vontade de refinar.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Freeze com data de expiração fixa | Pressão artificial para revisar sem dados; reuniões de revisão sem evidência produzem mais debate especulativo do que aprendizado |
| Freeze permanente (sem mecanismo de revisão) | Arquitetura nunca evolui; freeze vira dogma; mudanças necessárias baseadas em evidência não têm caminho formal |
| Freeze por módulo (cada CAP pode pedir revisão independentemente) | Fragmenta a arquitetura; um módulo que tem dificuldade de implementar não é evidência suficiente de que a arquitetura precisa mudar — pode ser problema de implementação |

---

## Consequências Positivas

- **Decisões arquiteturais baseadas em evidência:** quando o freeze for revisado, haverá dados reais de como a arquitetura se comporta, não hipóteses
- **Sem pressão artificial:** a equipe não passa tempo em reuniões especulativas de revisão arquitetural enquanto deveria estar implementando
- **Clareza sobre o que está congelado:** ARCH-001 documenta explicitamente o que está e o que não está congelado — o freeze não bloqueia evolução de conteúdo, apenas de estrutura

## Trade-offs Aceitos

- **Freeze pode durar mais do que o necessário:** se os primeiros três CAPs forem implementados rapidamente e não revelarem problemas, o freeze será mantido; isso é aceito — freeze desnecessariamente longo é menos custoso que mudanças arquiteturais prematuras
- **Critério subjetivo:** "pelo menos três CAPs em produção" é mais objetivo que uma data, mas ainda depende de julgamento sobre o que "em produção" significa; esse julgamento é deliberadamente deixado para o momento da revisão, quando haverá contexto suficiente
