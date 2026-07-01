# Platform Readiness — Commercial OS (SOE)

> Indicador de maturidade operacional da plataforma.
> Atualizado a cada commit que conclui um componente MVP.
> Meta da Fase 1: todos os 9 CAPs comunicando-se via CUE com fluxos principais operacionais.

---

## Índice de Prontidão Geral

```
███░░░░░░░░░░░░░░░░░  ~20% operacional   (atualizado: 2026-07-01)
```

| Indicador | Realizado | Meta MVP | % |
|---|---|---|---|
| CAPs implementados (MVP) | 2 | 9 | 22% |
| CORE Engines integradas | 10 | 10 | 100% |
| Casos de uso implementados | 13 | 40 | 33% |
| Eventos CUE implementados | 9 | 30 | 30% |
| Regras de negócio implementadas | 13 | 41 | 32% |
| Integrações entre CAPs (event consumers) | 1 | 10 | 10% |
| Testes automatizados | 162 | 400 | 41% |
| Cobertura estimada de linhas | ~85% | ≥95% | 89% |

---

## Detalhamento por CAP

### CAP-01 — Inteligência de Mercado

**Status: ✅ MVP Concluído**

| Componente | Status |
|---|---|
| Entities: IcpDefinition, WinLossAnalysis, MarketSegment, Competitor, MarketSignal | ✅ |
| Value Objects: IcpScore, IcpCriteria, WinLossResult | ✅ |
| Business Rules: RN-01 a RN-09 | ✅ |
| Use Cases: CriarIcp, AtivarIcp, AvaliarProspect, RegistrarWinLoss, SubmeterAnalise, CriarSegmento, CriarConcorrente, RegistrarSinal | ✅ |
| Repositories: InMemory (5) | ✅ |
| CUE Events: icp.ativado, win_loss.registrada, win_loss.analisada, sinal.critico, concorrente.desatualizado, alerta.cobertura | ✅ |
| Event Handler: OportunidadeEncerrada → RegistrarWinLoss | ✅ |
| Bootstrap Module | ✅ |
| Testes: 54 unitários + integração | ✅ |

**Evolução (Fase 2):**
- KPIs MI-01 a MI-09 completos
- Scheduler de freshness de concorrentes
- Dashboard de inteligência competitiva
- Alertas automáticos ALT-MI-01 a ALT-MI-05

---

### CAP-02 — Gestão de Pipeline

**Status: ✅ MVP Concluído**

| Componente | Status |
|---|---|
| Entity: Opportunity (máquina de estados: PROSPECCAO→QUALIFICACAO→PROPOSTA→NEGOCIACAO→GANHA/PERDIDA/CANCELADA) | ✅ |
| Business Rules: RN-P01 a RN-P04 | ✅ |
| Use Cases: CriarOportunidade, AvancarEstagio, EncerrarOportunidade, ConsultarPipeline | ✅ |
| Repositories: InMemory | ✅ |
| CUE Events: oportunidade.criada, oportunidade.estagio_avancou, oportunidade.encerrada | ✅ |
| Bootstrap Module | ✅ |
| Testes: 23 unitários + integração | ✅ |

**Evolução (Fase 2):**
- Filtros avançados de pipeline (por responsável, segmento, período)
- Análise de funil (conversion rate por estágio)
- Alertas de oportunidades estagnadas
- Integração com forecast (CAP-07)

---

### CAP-03 — Qualificação e Fechamento

**Status: 🔲 Não iniciado**

| Componente | Status |
|---|---|
| Entity: QualificationRecord | 🔲 |
| Entity: DealClose | 🔲 |
| Business Rules: RN-Q01 a RN-Q05 | 🔲 |
| Use Cases: QualificarOportunidade, FecharVenda, RegistrarPerda | 🔲 |
| CUE Events: oportunidade.ganha (payload enriquecido), oportunidade.perdida | 🔲 |
| Integração: publica para CAP-04 e CAP-05 via `oportunidade.ganha` | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

### CAP-04 — Receita e Contratos

**Status: 🔲 Não iniciado**

| Componente | Status |
|---|---|
| Entity: Contract | 🔲 |
| Entity: RevenueRecord (MRR) | 🔲 |
| Business Rules: RN-R01 a RN-R04 | 🔲 |
| Use Cases: CriarContrato, AtualizarMRR, RegistrarChurn | 🔲 |
| CUE Events: contrato.criado, receita.mrr_atualizado, receita.churn_detectado | 🔲 |
| Integração: consome `oportunidade.ganha` (CAP-03) | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

### CAP-05 — Customer Success

**Status: 🔲 Não iniciado**

| Componente | Status |
|---|---|
| Entity: CustomerAccount (health score) | 🔲 |
| Entity: OnboardingPlan | 🔲 |
| Business Rules: RN-CS01 a RN-CS04 | 🔲 |
| Use Cases: IniciarOnboarding, AtualizarHealthScore, DetectarChurnRisk | 🔲 |
| CUE Events: cliente.onboarding_iniciado, cliente.health_atualizado, cliente.churn_risco | 🔲 |
| Integração: consome `oportunidade.ganha` (CAP-03) | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

### CAP-06 — Precificação e Proposta

**Status: 🔲 Não iniciado**

| Componente | Status |
|---|---|
| Entity: Proposal | 🔲 |
| Entity: PricingRule | 🔲 |
| Business Rules: RN-PR01 a RN-PR04 | 🔲 |
| Use Cases: CriarProposta, AplicarDesconto, AprovarProposta | 🔲 |
| CUE Events: proposta.criada, proposta.aprovada, desconto.excedido | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

### CAP-07 — Forecast e Quota

**Status: 🔲 Não iniciado**

| Componente | Status |
|---|---|
| Entity: Quota | 🔲 |
| Entity: ForecastEntry | 🔲 |
| Business Rules: RN-F01 a RN-F04 | 🔲 |
| Use Cases: DefinirQuota, RegistrarForecast, CalcularAttainment | 🔲 |
| CUE Events: quota.definida, forecast.atualizado, quota.em_risco | 🔲 |
| Integração: consome `oportunidade.encerrada` (CAP-02) | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

### CAP-08 — Performance Comercial

**Status: 🔲 Não iniciado**

| Componente | Status |
|---|---|
| Entity: PerformanceRecord | 🔲 |
| Entity: CoachingSession | 🔲 |
| Business Rules: RN-PE01 a RN-PE03 | 🔲 |
| Use Cases: RegistrarMetrica, GerarDiagnostico, AgendarCoaching | 🔲 |
| CUE Events: alerta.performance_abaixo, coaching.sessao_criada | 🔲 |
| Integração: consome eventos de CAP-02, CAP-03, CAP-07 | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

### CAP-09 — Governança e Configuração

**Status: 🔲 Não iniciado**

| Componente | Status |
|---|---|
| Entity: GlobalConfig (MUP mode) | 🔲 |
| Entity: KpiThreshold | 🔲 |
| Business Rules: RN-G01 a RN-G04 | 🔲 |
| Use Cases: AtualizarMUP, DefinirLimiarKPI, AtivarModoOperacional | 🔲 |
| CUE Events: configuracao.mup_alterado, kpi.limiar_cruzado, modo.ativado | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

## Mapa de Integrações CUE (MVP)

```
CAP-01 ←── cap03.oportunidade.encerrada   (registrar Win/Loss)
CAP-04 ←── cap03.oportunidade.ganha       (criar contrato)
CAP-05 ←── cap03.oportunidade.ganha       (iniciar onboarding)
CAP-07 ←── cap02.oportunidade.encerrada   (atualizar quota attainment)
CAP-08 ←── cap02.oportunidade.encerrada   (atualizar métricas de rep)
CAP-08 ←── cap03.oportunidade.ganha       (atualizar win rate)
CAP-08 ←── cap07.quota.em_risco           (gerar alerta de performance)
CAP-09 ←── cap04.receita.mrr_atualizado   (avaliar modo MUP)
CAP-01 ←── cap05.cliente.churn_detectado  (registrar sinal de mercado)
CAP-06 ←── cap02.oportunidade.criada      (iniciar proposta)
```

---

## Critério de "MVP Concluído" por CAP

Um CAP está **MVP Concluído** quando:
1. ✅ Todas as entidades de domínio com máquinas de estado implementadas
2. ✅ Todos os casos de uso listados acima implementados e testados
3. ✅ Repositórios in-memory implementados
4. ✅ Eventos CUE definidos e schemas Zod registrados
5. ✅ Ao menos um event handler cross-CAP implementado (se aplicável)
6. ✅ Bootstrap module wiring all dependencies
7. ✅ Cobertura de testes ≥ 80% das linhas do CAP

## CORE Platform Status

| Engine | Package | Status |
|---|---|---|
| CORE-01 Config | @soe/core-config | ✅ |
| CORE-02 Logger | @soe/core-logger | ✅ |
| CORE-03 Errors | @soe/core-errors | ✅ |
| CORE-04 Events | @soe/core-events | ✅ |
| CORE-05 Identity | @soe/core-identity | ✅ |
| CORE-06 Audit | @soe/core-audit | ✅ |
| CORE-07 Time | @soe/core-time | ✅ |
| CORE-08 Validation | @soe/core-validation | ✅ |
| CORE-09 Health | @soe/core-health | ✅ |
| CORE-10 Observability | @soe/core-observability | ✅ |
