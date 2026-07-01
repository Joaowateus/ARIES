# Platform Readiness — Commercial OS (SOE)

> Mede **o que o sistema consegue fazer**, não apenas o que foi implementado.
> Atualizado a cada sprint. Dois ângulos complementares:
> — **Platform Readiness**: esforço (código existente)
> — **Operational Readiness**: capacidade (o que o sistema executa de ponta a ponta)

---

## Operational Readiness — O que o sistema consegue fazer hoje

> Este é o indicador que importa para investidores, diretores e para a equipe daqui a um ano.

| Capacidade Operacional | Status | Habilitado por |
|---|---|---|
| Definir e versionar ICP | ✅ Operacional | CAP-01 |
| Avaliar fit de prospect vs ICP | ✅ Operacional | CAP-01 |
| Registrar e analisar Win/Loss | ✅ Operacional | CAP-01 |
| Mapear concorrentes e battlecards | ✅ Operacional | CAP-01 |
| Registrar sinal de mercado | ✅ Operacional | CAP-01 |
| Criar e segmentar mercado | ✅ Operacional | CAP-01 |
| Criar oportunidade no pipeline | ✅ Operacional | CAP-02 |
| Avançar oportunidade nos estágios | ✅ Operacional | CAP-02 |
| Consultar snapshot do pipeline | ✅ Operacional | CAP-02 |
| Fechar venda (ganha/perdida) | ⏳ CAP-03 em andamento | CAP-03 |
| Publicar evento oportunidade.ganha | ⏳ CAP-03 em andamento | CAP-03 |
| Gerar contrato e receita (MRR) | ❌ Não disponível | CAP-04 |
| Iniciar onboarding de cliente | ❌ Não disponível | CAP-05 |
| Criar proposta comercial | ❌ Não disponível | CAP-06 |
| Calcular forecast e quota | ❌ Não disponível | CAP-07 |
| Medir performance de rep | ❌ Não disponível | CAP-08 |
| Configurar modo MUP e limiares | ❌ Não disponível | CAP-09 |
| Detectar desvio de KPI | ❌ Não disponível | CAP-04+09 |
| Autoescalonar incidente | ❌ Não disponível | CAP-09 |
| Executar ritmo de gestão | ❌ Não disponível | CAP-07+08+09 |

**Fluxos de negócio completos (ponta a ponta):**

| Fluxo | Status | CAPs Envolvidos |
|---|---|---|
| ICP → Avaliação de prospect | ✅ Completo | CAP-01 |
| Lead → Oportunidade → Estágios | ✅ Completo | CAP-02 |
| Lead → Fechamento de venda | ⏳ Pendente CAP-03 | CAP-02 + CAP-03 |
| Fechamento → Receita | ❌ | CAP-03 + CAP-04 |
| Fechamento → Onboarding | ❌ | CAP-03 + CAP-05 |
| Oportunidade encerrada → Win/Loss | ⏳ Handler pronto, CAP-03 pendente | CAP-01 + CAP-03 |
| Ciclo completo Lead → Receita → CS | ❌ | CAP-01..05 |

**Eventos CUE efetivamente exercitados em integração:**

| Evento | Produzido por | Consumido por | Testado em integração |
|---|---|---|---|
| cap01.win_loss.registrada | CAP-01 | — | ❌ |
| cap02.oportunidade.encerrada | CAP-02 | CAP-01, CAP-07 | ❌ |
| cap03.oportunidade.ganha | CAP-03 | CAP-04, CAP-05 | ❌ |
| cap03.oportunidade.perdida | CAP-03 | CAP-01, CAP-08 | ❌ |

> Meta Fase 1: todos os eventos com ✅ em testes de integração ponta a ponta.

---

## Platform Readiness — Indicadores de Esforço

```
████░░░░░░░░░░░░░░░░  ~27% implementado   (atualizado: 2026-07-01)
```

| Indicador | Realizado | Meta MVP | % |
|---|---|---|---|
| CAPs implementados (MVP) | 3 | 9 | 33% |
| CORE Engines integradas | 10 | 10 | 100% |
| Casos de uso implementados | 16 | 40 | 40% |
| Eventos CUE implementados | 12 | 30 | 40% |
| Regras de negócio implementadas | 18 | 41 | 44% |
| Integrações entre CAPs (event consumers) | 1 | 10 | 10% |
| Fluxos de negócio completos | 2 | 7 | 29% |
| Eventos exercitados em integração | 0 | 12 | 0% |
| Testes automatizados | 196 | 400 | 49% |

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

**Evolução (Fase 2):** KPIs MI-01..09, Scheduler de freshness, Dashboard, Alertas ALT-MI-01..05

---

### CAP-02 — Gestão de Pipeline

**Status: ✅ MVP Concluído**

| Componente | Status |
|---|---|
| Entity: Opportunity (PROSPECCAO→QUALIFICACAO→PROPOSTA→NEGOCIACAO→GANHA/PERDIDA/CANCELADA) | ✅ |
| Business Rules: RN-P01 a RN-P04 | ✅ |
| Use Cases: CriarOportunidade, AvancarEstagio, EncerrarOportunidade, ConsultarPipeline | ✅ |
| Repositories: InMemory | ✅ |
| CUE Events: oportunidade.criada, oportunidade.estagio_avancou, oportunidade.encerrada | ✅ |
| Bootstrap Module | ✅ |
| Testes: 23 unitários + integração | ✅ |

**Evolução (Fase 2):** Filtros avançados, Análise de funil, Alertas de estagnação, Integração com CAP-07

---

### CAP-03 — Qualificação e Fechamento

**Status: ✅ MVP Concluído**

| Componente | Status |
|---|---|
| Entity: QualificationRecord (critérios BANT, score 0-100) | ✅ |
| Entity: DealClose (payload enriquecido ADR-0006) | ✅ |
| Business Rules: RN-Q01 a RN-Q05 | ✅ |
| Use Cases: QualificarOportunidade, FecharVenda, RegistrarPerda | ✅ |
| CUE Events: oportunidade.ganha (payload ADR-0006), oportunidade.perdida, qualificacao.registrada | ✅ |
| Integração: oportunidade.ganha → CAP-04 (receita) e CAP-05 (onboarding) | ✅ (schemas prontos) |
| Bootstrap Module | ✅ |
| Testes: 19 unitários + 10 integração (CAP-02→CAP-03 fluxo completo) | ✅ |

---

### CAP-04 — Receita e Contratos

**Status: 🔲 Próximo**

| Componente | Status |
|---|---|
| Entity: Contract | 🔲 |
| Entity: RevenueRecord (MRR) | 🔲 |
| Business Rules: RN-R01 a RN-R04 | 🔲 |
| Use Cases: CriarContrato, AtualizarMRR, RegistrarChurn | 🔲 |
| CUE Events: contrato.criado, receita.mrr_atualizado, receita.churn_detectado | 🔲 |
| Event Handler: oportunidade.ganha → CriarContrato | 🔲 |
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
| Event Handler: oportunidade.ganha → IniciarOnboarding | 🔲 |
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
| Event Handler: oportunidade.encerrada → CalcularAttainment | 🔲 |
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
| Event Handler: oportunidade.encerrada + quota.em_risco → métricas | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

### CAP-09 — Governança e Configuração

**Status: 🔲 Não iniciado**

| Componente | Status |
|---|---|
| Entity: GlobalConfig (MUP mode — ADR-0012) | 🔲 |
| Entity: KpiThreshold | 🔲 |
| Business Rules: RN-G01 a RN-G04 | 🔲 |
| Use Cases: AtualizarMUP, DefinirLimiarKPI, AtivarModoOperacional | 🔲 |
| CUE Events: configuracao.mup_alterado, kpi.limiar_cruzado, modo.ativado | 🔲 |
| Bootstrap Module | 🔲 |
| Testes | 🔲 |

---

## Mapa de Integrações CUE (MVP Target)

```
CAP-01 ←── cap03.oportunidade.encerrada   (registrar Win/Loss)         ⏳
CAP-04 ←── cap03.oportunidade.ganha       (criar contrato)             ❌
CAP-05 ←── cap03.oportunidade.ganha       (iniciar onboarding)         ❌
CAP-07 ←── cap02.oportunidade.encerrada   (atualizar quota attainment) ❌
CAP-08 ←── cap02.oportunidade.encerrada   (atualizar métricas de rep)  ❌
CAP-08 ←── cap03.oportunidade.ganha       (atualizar win rate)         ❌
CAP-08 ←── cap07.quota.em_risco           (gerar alerta performance)   ❌
CAP-09 ←── cap04.receita.mrr_atualizado   (avaliar modo MUP)           ❌
CAP-01 ←── cap05.cliente.churn_detectado  (registrar sinal de mercado) ❌
CAP-06 ←── cap02.oportunidade.criada      (iniciar proposta)           ❌
```

---

## Critério de "MVP Concluído" por CAP

1. ✅ Entidades de domínio com máquinas de estado implementadas
2. ✅ Casos de uso listados implementados e testados
3. ✅ Repositórios in-memory
4. ✅ Eventos CUE definidos com schemas Zod
5. ✅ Ao menos um event handler cross-CAP implementado (se aplicável)
6. ✅ Bootstrap module
7. ✅ Cobertura de testes ≥ 80%

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
