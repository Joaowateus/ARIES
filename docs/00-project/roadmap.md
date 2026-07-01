---
name: ROADMAP
purpose: >
  Define a linha do tempo macro do projeto SOE: fases, marcos, entregas e
  critérios de transição entre fases. A arquitetura está congelada (v1.0).
  Este roadmap é inteiramente orientado a software e evidência — não a documentos.
responsibility: >
  Arquiteto Líder + Gerente de Projeto com aprovação da Diretoria Executiva.
relationships:
  - docs/00-project/vision.md
  - docs/00-project/scope.md
  - docs/02-architecture/ARCH-001-system-architecture.md
  - docs/01-governance/DOD-PLATAFORMA-001.md
  - docs/02-architecture/adr/
  - CHANGELOG.md
version: 1.0.0
status: aprovado
priority: alta
freeze: "Architecture Freeze v1.0 — 2026-07-01"
---

# Roadmap de Implementação — Commercial OS

> **Evidence First.** A arquitetura está completa. A partir daqui, toda energia vai para implementação. O único caminho de volta para a arquitetura é um RFC baseado em evidência produzida pelo software.

---

## Princípio de Sequência

A ordem de implementação segue uma lógica específica:

```
1. Infraestrutura antes de código de negócio
2. Kernel antes de módulos
3. Motor cognitivo antes de módulos que dependem de decisão
4. Módulo mais conectado primeiro (CAP-03 conversa com todos)
5. Observabilidade junto à produção, não depois
```

Cada fase tem um **critério de saída verificável**. Não existe transição de fase por calendário — apenas por evidência.

---

## Visão das Fases

```
FASE 1 — ARQUITETURA          ██████████████████████ 100%  [CONCLUÍDA — 2026-07-01]
FASE 2 — KERNEL               ░░░░░░░░░░░░░░░░░░░░░░  0%   [PRÓXIMA]
FASE 3 — MOTOR COGNITIVO      ░░░░░░░░░░░░░░░░░░░░░░  0%
FASE 4 — MÓDULOS COMERCIAIS   ░░░░░░░░░░░░░░░░░░░░░░  0%
FASE 5 — INTEGRAÇÕES          ░░░░░░░░░░░░░░░░░░░░░░  0%
FASE 6 — OBSERVABILIDADE      ░░░░░░░░░░░░░░░░░░░░░░  0%
FASE 7 — PRODUÇÃO             ░░░░░░░░░░░░░░░░░░░░░░  0%
FASE 8 — EVOLUÇÃO             ░░░░░░░░░░░░░░░░░░░░░░  0%   [CONTÍNUA]
```

---

## FASE 1 — Arquitetura ✓

**Status:** CONCLUÍDA  
**Período:** até 2026-07-01

**O que foi entregue:**
- 9 módulos CAP (CAP-01 a CAP-09) especificados
- 12 engines (ENG-01 a ENG-12) especificadas
- Framework Operacional Universal (FOB-01 a FOB-10)
- ENGINE-CONTRATO-DE-INTEGRACAO v1.1.0
- CUE — Catálogo Universal de Eventos (74+ eventos)
- CUA — Catálogo Universal de Ações (57 ações)
- BUD — Biblioteca Universal de Decisões
- ARCH-001 — System Architecture
- POL-ENGINE-001 — Critérios de novas Engines
- ADR-0001 a ADR-0015 — Histórico de decisões arquiteturais
- Architecture Freeze v1.0 declarado

**O que esta fase NÃO entregou:** nenhuma linha de código de produção.

---

## FASE 2 — Kernel (Sprint 0 + Sprint 1)

**Objetivo:** construir a infraestrutura que todos os módulos irão usar. Nenhum módulo de negócio é implementado nesta fase. Se o kernel estiver errado, tudo que vier depois estará errado.

---

### Sprint 0 — Infraestrutura de Desenvolvimento

**Duração sugerida:** 1–2 semanas  
**Critério de saída:** todo desenvolvedor consegue clonar o repositório, rodar os testes e fazer deploy em ambiente de staging com um único comando.

**Entregas:**

```
□ Estrutura de diretórios do repositório (src/, tests/, infra/, docs/ já existem)
□ Linguagem(ns) e runtime definidos e configurados
□ Gerenciador de dependências configurado (lock file commitado)
□ Linter e formatter com rules fixas (zero warnings em código vazio)
□ Pipeline de CI configurado:
    □ Lint automático em todo PR
    □ Testes automáticos em todo PR
    □ Build automático em todo merge na main
□ Schema de banco de dados versionado (migration tool configurada)
□ Ambiente de staging acessível e isolado de produção
□ Secrets management definido (nunca hardcoded)
□ Estrutura de logs definida (formato JSON estruturado com campos obrigatórios)
□ Health check endpoint /health respondendo em staging
□ README de onboarding: novo desenvolvedor consegue rodar em < 30 minutos
```

**Definição de Done:** CI verde; `make dev` funciona do zero num ambiente limpo; staging acessível.

---

### Sprint 1 — Event Bus, Registry e Contracts

**Duração sugerida:** 2–3 semanas  
**Critério de saída:** é possível publicar um evento, verificar que foi entregue, e confirmar que o schema está no CUE — tudo em código, não em documentação.

**Entregas:**

```
BARRAMENTO DE EVENTOS
□ Event Bus implementado (escolha de tecnologia: Kafka / RabbitMQ / SQS / NATS)
□ At-least-once delivery verificado em teste automatizado
□ Deduplicação por event_id implementada e testada
□ Retry policy com backoff exponencial implementada
□ Dead letter queue configurada para eventos não processáveis

CUE — CATÁLOGO UNIVERSAL DE EVENTOS (código)
□ CUE implementado como código (não apenas documento)
    □ Todo evento tem schema declarado em código (ex: JSON Schema / Protobuf / Avro)
    □ Validação automática: publicar evento fora do CUE retorna erro
    □ Validação de nomenclatura [dominio].[entidade].[acao_passado] automática
□ CLI ou ferramenta para inspecionar CUE em runtime

REGISTRO SISTÊMICO (RS)
□ Banco de dados do RS criado com schema definido em migration
□ Tabelas: rs_artefatos, rs_versoes (append-only)
□ API interna do RS: registrar artefato, consultar versão, listar dependências
□ Seed inicial: todos os 9 CAPs e 12 Engines registrados no RS como RASCUNHO

CONTRATO DE INTEGRAÇÃO
□ Constantes sistêmicas implementadas como código (ex: config file versionado)
    □ JANELA_CLAWBACK_DIAS = 90
    □ ICP_SCORE_MQL = 7
    □ HEALTH_SCORE_LIMIARES = {verde: 70, amarelo: 40}
    □ + demais constantes do ENGINE-CONTRATO-DE-INTEGRACAO
□ Nenhum módulo acessa constante diretamente no código — consulta via API do RS

SCHEDULER (SOE-SYS-SCHEDULER)
□ Scheduler implementado e integrado ao Event Bus
□ Emite sistema.periodo_encerrado nos ciclos definidos (diário/semanal/mensal)
□ Timezone configurado como parâmetro (não hardcoded)
□ Re-trigger manual disponível para operação
□ Testado: evento não emitido duas vezes para o mesmo período
```

**Definição de Done:** teste end-to-end — publicar evento → barramento → consumidor → confirmar deduplicação funciona com event_id repetido.

---

## FASE 3 — Motor Cognitivo (Sprint 2 + Sprint 3)

**Objetivo:** implementar a inteligência central do sistema antes dos módulos. Módulos vão depender de priorização (ENG-11) e de verificação de integridade (ENG-12) desde o primeiro dia.

---

### Sprint 2 — ENG-11: Decision Engine

**Duração sugerida:** 3–4 semanas  
**Critério de saída:** dado um evento de entrada, o sistema classifica, prioriza com MUP, e registra a situação — tudo verificável em teste automatizado.

**Entregas:**

```
□ Tabelas: decisao_situacoes, decisao_priorizacoes, decisao_diagnosticos,
           decisao_incidentes, cua_acoes, bud_entradas (migrations)
□ MUP implementada com pesos configuráveis (lê de PARAM-MUP-PESOS no RS)
□ 4 modos de MUP implementados (padrao, crise_financeira, crescimento_acelerado, auditoria_intensiva)
□ Validação: soma dos pesos = 1.00 antes de aceitar qualquer configuração
□ Fluxo cognitivo 12 passos implementado como state machine
□ BUD seed inicial: 6 categorias com subcategorias e ações recomendadas
□ CUA seed inicial: 57 ações do catálogo com metadados
□ Motor de Escalonamento: SLA monitoring com escalada automática
□ Motor de Aprendizado: 5 destinos (playbook/processo/kpi/auditoria/engine)
□ Eventos publicados: todos os 8 eventos do domínio decisao.*
□ Eventos consumidos: todos listados na seção 15 da ENG-11
□ Testes obrigatórios:
    □ MUP produz score correto para todas as combinações de 5 dimensões
    □ Modificadores automáticos elevam prioridade corretamente
    □ Situação com prioridade EMERGENCIAL escala em ≤ 15min (teste de timeout)
    □ Encerramento sem 4 condições é bloqueado
    □ Ignorar alerta sem D2 é rejeitado
```

**Definição de Done:** teste de integração — evento `kpi.limiar_cruzado` → ENG-11 classifica → MUP calcula → situação registrada → responsável notificado → DoD verificado por checklist automático.

---

### Sprint 3 — ENG-12: System Governance Engine

**Duração sugerida:** 2–3 semanas  
**Critério de saída:** o sistema consegue detectar automaticamente uma inconsistência arquitetural (evento sem publicador, dependência circular) e emitir alerta correspondente.

**Entregas:**

```
□ Tabelas: rfcs, deprecacoes, health_checks, parametros_dinamicos (migrations)
□ RS API completa: registrar, versionar, consultar, listar por tipo
□ Motor de RFC implementado: fluxo 6 fases com validações por tipo de mudança
□ Grafo de Dependências: calculado do RS, não editável diretamente
□ Health Check automatizado: 7 blocos, 24 itens, ISA calculado
□ Health Check agendado: semanal via Scheduler
□ Alertas do Grafo: 7 anomalias detectadas automaticamente
□ Protocolo de Depreciação: 4 fases com alertas em 25%/50%/75%/D-7
□ Parâmetros Dinâmicos: CRUD com histórico imutável e validação de nível de decisão
□ Catálogo Sistêmico: snapshot consolidado calculado automaticamente
□ Testes obrigatórios:
    □ Health Check CRÍTICO bloqueia aprovação de novos RFCs MAJOR
    □ Dependência circular detectada em ≤ 1 ciclo de verificação
    □ RFC sem template completo é rejeitado na triagem
    □ Configuração de MUP com soma ≠ 1.00 é rejeitada automaticamente
    □ Parâmetro sistêmico alterado sem decisão adequada é bloqueado
```

**Definição de Done:** Health Check completo do sistema (com RS seed de todos os 9 CAPs e 12 ENG) produz resultado SAUDÁVEL; ISA ≥ 97%.

---

## FASE 4 — Módulos Comerciais

**Objetivo:** implementar os módulos CAP na ordem que maximiza a aprendizagem sobre a arquitetura. Cada módulo implementado é um teste da arquitetura.

**Princípio da ordem:** começar pelo módulo mais conectado (CAP-03), depois pelo módulo de performance que depende de todos (CAP-08), depois pelo módulo de receita que fecha o loop financeiro (CAP-04), e assim por diante.

---

### Sprint 4 — CAP-03: Processo de Vendas

**Por que primeiro:** CAP-03 publica o evento mais crítico do sistema (`oportunidade.ganha`), consome de CAP-02, é consumido por CAP-04 e CAP-05. Se a arquitetura de eventos funcionar para CAP-03, aumenta muito a confiança no padrão para os demais.

```
□ Processo PROC-CAP03-VENDAS registrado na ENG-01
□ Processo PROC-CAP035-CONTRATOS registrado na ENG-01
□ KPIs KPI-PV-01 a KPI-PV-05 registrados na ENG-02
□ Alertas do CAP-03 registrados na ENG-03
□ Workflows AUT-VP-01 a AUT-VP-07 registrados na ENG-07
□ oportunidade.ganha publicado com payload completo (v2.0.0)
□ demanda.sql.criado consumido com deduplicação
□ performance.metas_atualizadas consumido
□ DoD da Plataforma (DOD-PLATAFORMA-001) verificado integralmente
```

**Marco arquitetural:** primeira validação real da arquitetura event-driven em módulo de negócio.

---

### Sprint 5 — CAP-08: Performance e Autogestão

**Por que segundo:** CAP-08 consolida dados de todos os módulos. Implementá-lo cedo força a verificação de que os contratos de KPI da ENG-02 funcionam transversalmente.

```
□ Integração com ENG-02 para leitura de KPIs de todos os CAPs implementados
□ performance.metas_atualizadas publicado e consumido por CAP-03
□ performance.desvio.detectado publicado com campo severidade
□ performance.okrs.atualizados publicado
□ Rituais de gestão FOB-07 implementados como workflows automatizados
□ DoD da Plataforma verificado
```

---

### Sprint 6 — CAP-04: Gestão de Receita

**Por que terceiro:** CAP-04 fecha o loop financeiro. Consome `oportunidade.ganha` de CAP-03 e publica `receita.mrr_calculado`, que CAP-08 consolida.

```
□ Consumo de oportunidade.ganha (v2.0.0) com todos os campos do payload
□ MRR Bridge implementado: FINAL = INICIAL + NEW − CHURN − CONTRACTION + EXPANSION
□ Régua de inadimplência (D1/D5/D15/D30) com eventos corretos
□ CONN-PLATAFORMA-PRODUTO: suspensão via conector externo, não evento especulativo
□ CONN-ERP-FINANCEIRO integrado para faturamento
□ DoD da Plataforma verificado
```

---

### Sprint 7 — CAP-02: Gestão de Demanda

```
□ Qualificação de leads com ICP score via ENG-07
□ demanda.sql.criado publicado (consumido por CAP-03 já implementado)
□ demanda.pipeline.minimo_violado publicado e tratado pela ENG-11
□ CONN-MARKETING-AUTOMATION integrado
□ DoD da Plataforma verificado
```

---

### Sprints 8-12 — Módulos Remanescentes

| Sprint | Módulo | Dependências |
|--------|--------|-------------|
| 8 | CAP-05 — Clientes | CAP-04 (receita), CAP-03 (oportunidade.ganha) |
| 9 | CAP-07 — Equipe Comercial | CAP-08 (performance), CAP-03 (metas) |
| 10 | CAP-01 — Inteligência Comercial | CAP-03 (win/loss), CAP-05 (churn data) |
| 11 | CAP-09 — Canais e Parcerias | CAP-02 (leads), CAP-04 (receita), ENG-08 |
| 12 | CAP-06 — [Reservado] | A ser definido quando CAP-06 for especificado |

**Critério de transição para Fase 5:** todos os 9 CAPs com DoD verificado e Health Check da ENG-12 com ISA ≥ 97%.

---

## FASE 5 — Integrações Externas

**Objetivo:** conectar o Commercial OS aos sistemas externos (CRM, ERP, plataforma de produto, marketing automation). Esta fase pode ocorrer em paralelo com a Fase 4 a partir do Sprint 4.

```
□ CONN-CRM (bidirecional): sincronização com CRM principal
    □ Lead criado no CRM → evento lead.criado no barramento
    □ Atualização de oportunidade no barramento → sincronização no CRM
□ CONN-ERP-FINANCEIRO (saída): faturamento e contas a pagar
    □ receita.fatura_emitida → criação de fatura no ERP
    □ parceiro.comissao_calculada → registro de conta a pagar no ERP
□ CONN-PLATAFORMA-PRODUTO (saída): suspensão e ativação de serviço
    □ AUT-RV-07 aciona suspensão; evento publicado apenas após confirmação
□ CONN-MARKETING-AUTOMATION (bidirecional): nurturing de leads
    □ Lead fora do ICP → nurturing no marketing automation
    □ Lead nutrido e requalificado → retorna como lead.criado
□ Cada conector:
    □ Timeout configurado (não hardcoded)
    □ Retry com backoff exponencial
    □ Dead letter para falhas persistentes
    □ Status de saúde verificado pelo Health Check da ENG-12
    □ Registrado no RS como CONN-* com status e SLA
```

---

## FASE 6 — Observabilidade

**Objetivo:** o sistema deve ser possível de operar em produção. Operação sem observabilidade é operação às cegas.

```
□ Tracing distribuído: correlacao_id propagado em todos os eventos e logs
□ Métricas de negócio exportadas (Prometheus / DataDog / equivalente):
    □ MRR atual, variação MoM
    □ Pipeline volume e velocity
    □ ISA (Índice de Saúde Arquitetural) da ENG-12
    □ Taxa de eficácia do CUA
□ Métricas de sistema:
    □ Latência de processamento de evento (p50, p95, p99)
    □ Taxa de eventos na dead letter queue
    □ Lag de consumidores do barramento
□ Alertas operacionais configurados (infraestrutura, não negócio):
    □ Dead letter queue > threshold
    □ Lag de consumidor > threshold
    □ Latência de Health Check da ENG-12 > threshold
□ Dashboard de saúde da plataforma (operação, não apenas negócio)
□ Runbook documentado para os incidentes mais prováveis (top 5)
```

---

## FASE 7 — Produção

**Critérios de entrada em produção (todos obrigatórios):**

```
□ Todos os CAPs com DoD verificado (DOD-PLATAFORMA-001)
□ Health Check da ENG-12: ISA ≥ 97% por 2 semanas consecutivas em staging
□ Todas as integrações testadas com dados reais em ambiente de homologação
□ Testes de carga: sistema suporta volume 3x o volume esperado no dia 1
□ Runbook de incidentes publicado e revisado pela equipe
□ Processo de rollback testado e funcionando
□ On-call definido com escalada clara
□ Backup e restore testados
□ Penetration test básico concluído (pelo menos OWASP Top 10 coberto)
□ Privacy/dados pessoais mapeados (LGPD compliance básico)
```

---

## FASE 8 — Evolução Baseada em Dados (Contínua)

A partir do primeiro dia em produção, o ciclo de evolução muda completamente:

```
EVIDÊNCIA (o sistema produz dados)
    ↓
ANÁLISE (ENG-11 processa, ENG-02 mede, ENG-04 diagnostica)
    ↓
RFC (se mudança arquitetural for necessária — com dados reais)
    ↓
ADR (decisão documentada com contexto de produção)
    ↓
IMPLEMENTAÇÃO (ciclo de sprint normal)
    ↓
VALIDAÇÃO (Health Check + DoD verificado novamente)
    ↓
volta para EVIDÊNCIA
```

**O que esta fase implica:**
- Novas funcionalidades entram via RFC (MINOR ou MAJOR conforme impacto)
- Mudanças arquiteturais entram via RFC ARCHITECTURAL com evidência (dados reais)
- O Architecture Freeze v1.0 é revisado após 3 CAPs em produção por período suficiente
- KPIs do próprio sistema de gestão são monitorados (não apenas do negócio)

---

## Critérios de Transição Entre Fases

| Transição | Critério Verificável |
|-----------|---------------------|
| Fase 1 → 2 | Architecture Freeze declarado; ARCH-001 aprovado ✓ |
| Fase 2 → 3 | Evento publicado no barramento, consumido, deduplicado em teste E2E |
| Fase 3 → 4 | Health Check da ENG-12 retorna SAUDÁVEL com ISA ≥ 97% em dados seed |
| Sprint 4 → 5 | CAP-03 com DoD verificado; oportunidade.ganha consumível por outros módulos |
| Fase 4 → 5 | Todos os 9 CAPs com DoD verificado; ISA ≥ 97% em staging |
| Fase 5 → 6 | Todos os 4 conectores operacionais em homologação com dados reais |
| Fase 6 → 7 | Todos os critérios de entrada em produção satisfeitos |
| Fase 7 → 8 | Sistema em produção por ≥ 30 dias com dados reais; primeiro ciclo de revisão do freeze iniciado |

---

## O que o Roadmap NÃO contém

- **Datas fixas:** a única forma de definir datas realistas é depois do Sprint 0, quando a equipe e o stack estão definidos. Datas antes do Sprint 0 são ficção.
- **Novos documentos de arquitetura:** a fase de arquitetura está encerrada. Qualquer necessidade de documento arquitetural durante implementação = RFC + ADR, não novo documento avulso.
- **Novas engines ou CAPs:** o sistema está congelado. Se a implementação revelar necessidade de novo componente, o caminho é RFC ARCHITECTURAL com evidência, não adição direta.

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 0.1.0 | 2026-06-01 | Guardião | Placeholder criado |
| 1.0.0 | 2026-07-01 | Guardião da Documentação Técnica | Roadmap completo — Evidence First; Architecture Freeze v1.0 declarado |
