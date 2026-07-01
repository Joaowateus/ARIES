# ADR-0014 — Prevenção de Engine Proliferation: Limite em 12 com Critérios de Entrada D4

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0014 |
| **Título** | O Sistema é Fechado em 12 Engines; Novas Engines Requerem RFC Arquitetural com Aprovação D4 |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | POL-ENGINE-001, ENG-12, ARCH-001 |

---

## Contexto

Plataformas empresariais complexas tendem a acumular componentes de infraestrutura indefinidamente. A lógica é sempre razoável: "esse problema é recorrente em múltiplos módulos, então deveria ser uma engine". O que parece uma decisão sensata individualmente se torna um problema sistêmico quando repetido dezenas de vezes.

O fenômeno é conhecido como Engine Proliferation: quando existe um número grande de engines, ninguém sabe ao certo onde uma responsabilidade pertence, engines passam a se sobrepor, as fronteiras ficam ambíguas, e o custo de entender o sistema cresce com cada nova engine adicionada.

Grandes ERPs são exemplos desse fenômeno: sistemas com centenas de módulos de infraestrutura onde cada um foi criado por uma razão legítima, mas o conjunto é impossível de compreender ou manter.

---

## Decisão

O Commercial OS opera com **exatamente 12 engines** (ENG-01 a ENG-12). Esse número foi alcançado deliberadamente após identificar os mecanismos sistêmicos fundamentais e confirmar que nenhuma responsabilidade importante estava faltando ou sendo duplicada.

Criar uma 13ª engine (ou qualquer subsequente) requer satisfazer três critérios obrigatórios (POL-ENGINE-001):
1. Resolve um problema sistêmico (não de domínio)
2. É utilizada por ≥ 3 módulos CAP distintos
3. Não pode ser implementada como extensão de engine existente (6 perguntas obrigatórias)

A proposta é feita via RFC ARCHITECTURAL com aprovação mínima D4 (fundadores/board). Sem RFC aprovado, qualquer implementação que crie de facto uma nova engine é tratada como inconsistência arquitetural CRÍTICA pela ENG-12.

---

## Por que 12 e não outro número

As 12 engines cobrem os mecanismos fundamentais identificados:
- **Execução** (ENG-01): estado de processos e instâncias
- **Medição** (ENG-02): KPIs e métricas
- **Alerta** (ENG-03): notificação de desvios
- **Diagnóstico** (ENG-04): investigação de causas
- **Correção** (ENG-05): planos de ação
- **Registro** (ENG-06): auditoria imutável
- **Automação de fluxo** (ENG-07): workflows
- **Integração** (ENG-08): sistemas externos
- **Melhoria** (ENG-09): melhoria contínua
- **Conhecimento** (ENG-10): IA e base de conhecimento
- **Cognição** (ENG-11): decisão e priorização
- **Meta-governança** (ENG-12): governança do sistema

Cada engine cobre uma capacidade distinta. A verificação de completude: existe algum mecanismo sistêmico que múltiplos módulos precisariam e que nenhuma das 12 engines provê? Se a resposta for não, o conjunto está completo.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Engines criadas conforme necessidade (sem limite) | Engine Proliferation inevitável; fronteiras ambíguas com o tempo; custo de compreensão cresce indefinidamente |
| Menos engines (ex: consolidar ENG-04 e ENG-11 em uma "análise" única) | Mistura mecanismos com propósitos diferentes; engine genérica demais perde coesão; diagnóstico (estruturar investigação) é diferente de decisão (escolher resposta) |
| Aprovar novas engines via D3 em vez de D4 | D4 é intencional: criar uma engine é uma decisão fundacional que afeta toda a arquitetura; deve ser tratada com o mesmo peso que mudar o modelo de negócio |

---

## Consequências Positivas

- **Compreensibilidade:** 12 engines é um número que uma pessoa consegue memorizar e compreender; responsabilidades são localizáveis
- **Fronteiras claras:** com poucas engines bem definidas, é mais fácil detectar quando uma capacidade está no lugar errado
- **Resistência a decisões de curto prazo:** a barreira D4 evita que engines sejam criadas sob pressão de prazo sem análise adequada de impacto

## Trade-offs Aceitos

- **Pode não cobrir casos futuros:** se o negócio evoluir para um contexto radicalmente diferente, 12 engines podem ser insuficientes; o mecanismo de RFC ARCHITECTURAL existe exatamente para esse caso — ele abre o caminho de forma deliberada e rastreada
- **Forçar capacidades em engines existentes:** alguns problemas podem ser mais naturalmente resolvidos com uma nova engine mas serão resolvidos como extensão de uma existente; aceito porque a coesão de uma engine existente pode ser ampliada com cuidado, mas engine proliferation é irreversível sem refatoração major
