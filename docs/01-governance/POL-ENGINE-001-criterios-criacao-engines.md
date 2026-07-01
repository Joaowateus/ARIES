---
id: POL-ENGINE-001
titulo: "Critérios para Criação de Novas Engines"
versao: "1.0.0"
status: aprovado
categoria: POL
autor: Guardião da Documentação Técnica
criado-em: 2026-07-01
atualizado-em: 2026-07-01
aprovado-por: Arquitetura — Architecture Freeze v1.0
nivel-decisao-alteracao: D4
tags: [politica, engine, arquitetura, governanca, proliferacao, criterios]
---

# POL-ENGINE-001 — Critérios para Criação de Novas Engines

---

## 1. Propósito

Esta política existe para prevenir um dos fenômenos mais comuns e destrutivos em plataformas empresariais: **Engine Proliferation**.

O fenômeno começa de forma inofensiva:

```
ENG-01 ... ENG-12
```

E evolui silenciosamente:

```
ENG-13  ENG-14  ENG-15  ENG-16 ...
```

Até o ponto em que nenhuma pessoa consegue responder com confiança: *"quem é responsável por isso?"* — e responsabilidades se fragmentam entre engines que se sobrepõem, se contradizem ou duplicam capacidades.

Esta política impõe **três critérios obrigatórios e um critério de exclusão** que toda proposta de nova Engine deve satisfazer antes de ser considerada. O não cumprimento de qualquer critério é motivo suficiente para rejeição da proposta.

---

## 2. Contexto: O que é uma Engine

Uma Engine é um **serviço de infraestrutura sistêmica** — uma capacidade compartilhada que múltiplos módulos de domínio (CAP) utilizam para executar uma função que seria impossível, ineficiente ou inconsistente se cada módulo a implementasse de forma independente.

Engines não pertencem a domínios de negócio. Não executam lógica de vendas, de clientes ou de finanças. Elas proveem mecanismos: rastrear, medir, alertar, diagnosticar, decidir, auditar, governar.

O Commercial OS possui 12 Engines (ENG-01 a ENG-12). Esse número não é arbitrário — é o resultado de um processo deliberado de design que identificou os mecanismos sistêmicos fundamentais e os separou com precisão cirúrgica.

---

## 3. Os Três Critérios Obrigatórios

### CRITÉRIO 1 — Problema Sistêmico

> **A Engine proposta deve resolver um problema da plataforma — não um problema de negócio.**

Um problema sistêmico é aquele que:
- Afeta a capacidade do sistema de funcionar corretamente para *qualquer* módulo que o utilize
- Existe independentemente de qualquer domínio de negócio específico
- Persiste mesmo que todo o conteúdo de negócio (CAPs, processos, KPIs) seja substituído por conteúdo completamente diferente

Exemplos de problemas sistêmicos legítimos: rastreamento de estado de processos, controle de versão de artefatos, detecção de anomalias em métricas, orquestração de sequências de ações.

Exemplos que **não são** problemas sistêmicos: calcular comissão de parceiros, priorizar leads, gerar proposta comercial, calcular churn. Esses são problemas de domínio — pertencem a CAPs.

**Teste de validação:** Se o problema desaparece quando se troca o domínio de negócio (de vendas para saúde, de SaaS para manufatura), é um problema de domínio. Problemas sistêmicos são agnósticos ao domínio.

---

### CRITÉRIO 2 — Utilização por Três ou Mais Módulos CAP

> **A Engine proposta deve ser utilizada por pelo menos três módulos CAP distintos e independentes.**

Uma capacidade utilizada por apenas um ou dois módulos não é infraestrutura sistêmica — é uma capacidade de módulo que foi extraída prematuramente.

A regra de três módulos existe porque:
- Com um módulo: é capacidade do módulo, não infraestrutura
- Com dois módulos: pode ser um contrato de integração entre dois módulos, não uma Engine
- Com três ou mais módulos independentes: a capacidade é genuinamente transversal e justifica abstração como Engine

**Teste de validação:** Listar os três módulos CAP que utilizariam a Engine proposta. Para cada um, descrever *como especificamente* utilizariam. Se a descrição for vaga ou forçada para pelo menos um dos três, o critério não foi satisfeito.

**Corolário:** Se futuramente uma Engine existente passa a ser utilizada por apenas um módulo (os outros dois migraram ou foram descontinuados), a Engine entra em candidatura para depreciação via protocolo ENG-12.

---

### CRITÉRIO 3 — Não Implementável como Extensão de Engine Existente

> **A Engine proposta não pode ser implementada como uma extensão, sub-sistema ou novo módulo dentro de qualquer Engine existente.**

Antes de propor uma nova Engine, o proponente deve responder explicitamente a cada uma das perguntas abaixo. Se *qualquer* resposta for "poderia, mas...", a proposta deve ser reescrita como extensão da Engine existente, não como nova Engine.

```
"Por que isso não pode existir dentro da ENG-12 (System Governance)?"
"Por que isso não cabe na ENG-11 (Decision Engine)?"
"Por que isso não pertence ao ENG-10 (IA/Conhecimento)?"
"Por que isso não é um novo sistema dentro do FOB?"
"Por que isso não é um contrato no ENGINE-CONTRATO-DE-INTEGRACAO?"
"Por que isso não é uma capacidade de um módulo CAP?"
```

A resposta a cada pergunta deve ser **extremamente clara e objetiva**. "Porque ficaria mais organizado separado" não é uma resposta válida. "Porque a ENG-12 já tem responsabilidade de X e adicionar Y criaria coesão inadequada entre Y e X por razão Z" é uma resposta válida.

**Teste de validação:** O proponente apresenta as respostas a todas as seis perguntas acima como parte obrigatória do RFC de proposta de Engine. Sem as respostas, o RFC é rejeitado na triagem sem análise de conteúdo.

---

## 4. O Critério de Exclusão (Automático)

Independentemente dos três critérios acima, uma Engine é automaticamente rejeitada se:

| Condição de Exclusão | Motivo |
|----------------------|--------|
| A Engine depende exclusivamente de dados de um único módulo CAP | É uma capacidade do módulo, não infraestrutura |
| A Engine executa lógica de domínio de negócio (preço, comissão, score, proposta) | É responsabilidade do módulo CAP correspondente |
| A Engine duplica responsabilidade já declarada em ENG-01 a ENG-12 | Redundância arquitetural — resolver via RFC na Engine existente |
| A Engine é proposta para resolver um problema de implementação, não de design | Problemas de implementação se resolvem em código, não em arquitetura |
| A Engine é proposta sem RFC formal e análise de impacto na ENG-12 | Violação do processo de governança (POL-ENGINE-001 + RFC obrigatório) |

---

## 5. Processo de Proposta

Uma nova Engine só pode ser proposta via **RFC ARCHITECTURAL** na ENG-12. O RFC deve obrigatoriamente incluir:

```yaml
proposta_engine:
  nome_proposto: "[ENG-XX — Nome]"
  criterio_1_problema_sistemico:
    descricao_do_problema: "[Descrição clara do problema sistêmico]"
    por_que_e_sistemico_nao_de_dominio: "[Justificativa]"
    persiste_apos_troca_de_dominio: true
  criterio_2_tres_modulos:
    modulo_1:
      id: "CAP-XX"
      como_utiliza: "[Descrição específica de uso]"
    modulo_2:
      id: "CAP-XX"
      como_utiliza: "[Descrição específica de uso]"
    modulo_3:
      id: "CAP-XX"
      como_utiliza: "[Descrição específica de uso]"
  criterio_3_nao_e_extensao:
    por_que_nao_eng12: "[Resposta clara e objetiva]"
    por_que_nao_eng11: "[Resposta clara e objetiva]"
    por_que_nao_eng10: "[Resposta clara e objetiva]"
    por_que_nao_fob: "[Resposta clara e objetiva]"
    por_que_nao_contrato: "[Resposta clara e objetiva]"
    por_que_nao_cap: "[Resposta clara e objetiva]"
  criterios_de_exclusao_verificados: true
  impacto_no_grafo_de_dependencias: "[Como afeta o RS e o Grafo]"
  justificativa_final: "[Argumento consolidado em 3-5 frases]"
```

O RFC é aprovado pelo nível D4 (Fundacional). Não existe aprovação de nova Engine em nível menor.

---

## 6. Penalidade de Violação

Uma mudança estrutural que crie, de facto, uma nova Engine sem RFC aprovado é classificada como **inconsistência arquitetural CRÍTICA** pela ENG-12. As consequências:

1. O Health Check arquitetural classifica o sistema como CRÍTICO
2. Todos os novos RFCs MAJOR ou superior são bloqueados até resolução
3. A "Engine" não aprovada é removida ou absorvida por Engine existente via RFC de correção
4. O histórico da violação permanece em ENG-06 (imutável)

---

## 7. Revisão desta Política

Esta política é revisada somente via RFC de tipo ARCHITECTURAL com aprovação D4. A versão atual (1.0.0) é parte integrante do Architecture Freeze v1.0 e não pode ser alterada enquanto o freeze estiver ativo.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-07-01 | Guardião da Documentação Técnica | Criação — parte do Architecture Freeze v1.0 |
