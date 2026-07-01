# ADR-0012 — Pesos da MUP como Parâmetro Sistêmico Dinâmico Gerenciado pela ENG-12

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0012 |
| **Título** | Pesos da Matriz Universal de Priorização são Parâmetros Dinâmicos, não Hardcoded |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ENG-11, ENG-12 (PARAM-MUP-PESOS) |

---

## Contexto

A Matriz Universal de Priorização (MUP) calcula a prioridade de qualquer situação usando cinco dimensões: Impacto (30%), Urgência (25%), Frequência (20%), Tendência (15%), Risco (10%). Esses pesos foram calibrados para refletir a operação normal da empresa.

Mas empresas não operam sempre no mesmo contexto. Durante uma crise de receita, o impacto financeiro de qualquer problema é proporcionalmente mais crítico que em período de crescimento. Durante expansão acelerada, a frequência de problemas (indicativo de escala) e a tendência (problemas que pioram) merecem mais peso. Durante preparação para auditoria, o risco de cascata merece mais atenção.

Se os pesos são fixos no código, mudar o comportamento de priorização do sistema inteiro requer uma mudança de código — com todo o processo de deploy correspondente. Isso cria duas opções ruins: ou os pesos são estáticos (imprecisos em contextos não-padrão) ou qualquer ajuste requer deploy (lento e arriscado).

---

## Decisão

Os pesos da MUP são um **parâmetro dinâmico do sistema (PARAM-MUP-PESOS)**, gerenciado pela ENG-12. Diferentes "modos" de pesos podem ser definidos com antecedência (via RFC MINOR, D2) e ativados conforme o contexto (via decisão D3).

Modos definidos na v1.0:
- `padrao`: pesos calibrados para operação normal
- `crise_financeira`: peso de Impacto elevado para 40% (ativa quando MRR < 85% da meta por 2 períodos)
- `crescimento_acelerado`: peso de Frequência e Tendência elevados (ativa quando novos clientes MoM > 20%)
- `auditoria_intensiva`: peso de Risco elevado para 20% (ativa quando ISA < 90%)

A ENG-11 consulta PARAM-MUP-PESOS antes de calcular cada score. Mudar o modo ativo altera imediatamente o comportamento de priorização do sistema inteiro — sem deploy.

**Invariante:** a soma de todos os pesos deve ser exatamente 1.00 (100%). A ENG-12 valida matematicamente antes de aceitar qualquer configuração; soma ≠ 1.00 é rejeitada automaticamente.

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Pesos fixos hardcoded na ENG-11 | Qualquer ajuste requer mudança de código e deploy; não permite adaptação ao contexto empresarial sem intervenção técnica |
| Pesos configuráveis por módulo CAP | Fragmenta a consistência; "alta prioridade" passa a ter pesos diferentes por módulo; impossível comparar prioridades cross-módulo |
| Pesos livres sem modos pré-definidos (qualquer combinação) | Risco de configuração inválida (soma ≠ 1.0); sem modos nomeados, é difícil comunicar para a equipe em qual "estado" o sistema está |

---

## Consequências Positivas

- **Adaptabilidade sem deploy:** o comportamento de priorização do sistema pode ser ajustado em minutos, não dias
- **Auditabilidade:** todo ajuste de modo é registrado com: decisão D3, responsável, data, modo anterior e novo
- **Modos explícitos:** "estamos em modo crise_financeira" é uma comunicação clara para toda a equipe sobre o estado atual do sistema
- **Invariante verificável:** a soma = 1.00 é verificada automaticamente; configuração matematicamente inválida não chega ao sistema

## Trade-offs Aceitos

- **D3 para ativar modo não-padrão:** ativar um modo alternativo requer decisão diretorial; isso é intencional — mudar o comportamento de priorização do sistema inteiro é uma decisão estratégica
- **Modos precisam ser definidos antecipadamente via RFC:** não é possível criar um modo no calor do momento; a definição de novos modos requer RFC MINOR; aceito porque modos ad-hoc sem revisão seriam mais perigosos que modos pré-validados
