# CORE-PLATFORM-001 — Kernel da Plataforma SOE

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | CORE-PLATFORM-001 |
| **Título** | Kernel da Plataforma: 10 Componentes CORE Obrigatórios |
| **Status** | Ativo |
| **Versão** | 1.0.0 |
| **Data** | 2026-07-01 |
| **Stack** | TypeScript 5.5+ / Node.js 20+ / npm workspaces |

---

## Propósito

O Kernel da Plataforma (Core Platform) é o conjunto de componentes de infraestrutura transversal que **todo componente do SOE** deve utilizar obrigatoriamente. Nenhum CAP, Engine ou conector pode reimplementar qualquer uma das capacidades providas pelo Kernel.

**Regra de ouro:** Se um componente faz qualquer uma das ações abaixo com código próprio, está violando o Kernel:

| Proibido fazer diretamente | Use |
|---|---|
| `console.log()` | `createLogger()` (CORE-02) |
| `process.env.X` diretamente | `Config.get()` (CORE-01) |
| `new Date()` / `Date.now()` | `Time.now()` (CORE-07) |
| Lançar `new Error()` genérico | Subclasse de `SOEError` (CORE-03) |
| Publicar evento no barramento | `EventPublisher.publish()` (CORE-04) |
| Escrever auditoria manualmente | `Audit.record()` (CORE-06) |
| Validar schema/regra inline | `Validation.schema()` (CORE-08) |
| Verificar permissão de usuário | `Identity.hasPermission()` (CORE-05) |
| Expor `/health` próprio | `Health.register()` (CORE-09) |
| Registrar métrica própria | `Observability.metrics` (CORE-10) |

---

## Diagrama de Dependências

```
┌─────────────────────────────────────────────────────┐
│                   CAPs / Engines                    │
└───────────┬──────────┬────────────┬─────────────────┘
            │          │            │
            ▼          ▼            ▼
┌──────────────┐  ┌─────────┐  ┌──────────────┐
│  CORE-04     │  │ CORE-06 │  │  CORE-09     │
│  Events      │  │  Audit  │  │  Health      │
└──────┬───────┘  └────┬────┘  └──────┬───────┘
       │               │              │
       ▼               ▼              ▼
┌──────────────────────────────────────────────┐
│              CORE-02 Logger                  │
├──────────────────────────────────────────────┤
│              CORE-08 Validation              │
├──────────────────────────────────────────────┤
│              CORE-03 Errors                  │
├──────────────────────────────────────────────┤
│              CORE-05 Identity                │
├──────────────────────────────────────────────┤
│              CORE-01 Config                  │
├──────────────────────────────────────────────┤
│              CORE-07 Time                    │
│              (sem dependências internas)      │
└──────────────────────────────────────────────┘

CORE-10 Observability usa: CORE-02, CORE-07, CORE-05
```

**Ordem de instanciação (bootstrap):**

```
CORE-07 (Time) → CORE-01 (Config) → CORE-03 (Errors) → CORE-05 (Identity)
→ CORE-02 (Logger) → CORE-08 (Validation) → CORE-04 (Events)
→ CORE-06 (Audit) → CORE-09 (Health) → CORE-10 (Observability)
```

---

## Componentes

### CORE-01 — Configuration Engine
**Package:** `@soe/core-config`

Centraliza toda configuração. Fonte primária: variáveis de ambiente com prefixos padronizados.

| Namespace | Variável de ambiente |
|---|---|
| Ambiente | `SOE_ENV` |
| Feature flags | `SOE_FLAG_<NOME>` |
| Engine params | `SOE_ENGINE_<ID>_<PARAM>` |
| CAP params | `SOE_CAP_<ID>_<PARAM>` |
| MUP mode | `SOE_MUP_MODE` |
| Scheduler | `SOE_SCHEDULER_<PARAM>` |
| FOB | `SOE_FOB_<PARAM>` |

```typescript
import { Config } from '@soe/core-config'

const port = Config.getOr('SOE_GATEWAY_PORT', '3000')
const mup = Config.mup() // { mode: 'padrao', weights: {...}, isaTarget: 97 }
const debugMode = Config.flag('DEBUG_MODE')
```

---

### CORE-02 — Logging Engine
**Package:** `@soe/core-logger`

Logs estruturados em JSON. Correlation ID e User ID injetados automaticamente via CORE-05.

```typescript
import { createLogger } from '@soe/core-logger'

const log = createLogger({ component: 'cap-03', cap: 'cap-03' })

log.info('Oportunidade criada', { oportunidade_id: 'opp-001' })
// → { timestamp, level, message, component, correlationId, userId, payload }

const childLog = log.child({ engine: 'eng-11' })
```

**Campos obrigatórios em todo log:**
- `timestamp` (UTC ISO), `level`, `message`, `component`

**Campos injetados automaticamente (quando disponíveis):**
- `correlationId`, `userId`, `tenantId` (via CORE-05 AsyncLocalStorage)

---

### CORE-03 — Error Engine
**Package:** `@soe/core-errors`

Hierarquia de 6 categorias de erro. Todo `throw` no SOE usa uma subclasse de `SOEError`.

| Classe | Categoria | Severidade padrão | Quando usar |
|---|---|---|---|
| `BusinessError` | BUSINESS | MEDIUM | Regra de negócio violada |
| `ValidationError` | VALIDATION | LOW | Input inválido |
| `InfrastructureError` | INFRASTRUCTURE | HIGH | Banco/cache/serviço externo offline |
| `SecurityError` | SECURITY | HIGH | Acesso não autorizado |
| `GovernanceError` | GOVERNANCE | CRITICAL | Violação de regra arquitetural |
| `UnexpectedError` | UNEXPECTED | CRITICAL | Erro não antecipado |

```typescript
import { BusinessError, ValidationError, isSOEError } from '@soe/core-errors'

throw new BusinessError(
  'CAP03-001',
  'Oportunidade sem proposta aprovada não pode ser fechada',
  'Não é possível fechar esta oportunidade agora.',
  'Vincule uma proposta aprovada antes de fechar.',
)
```

---

### CORE-04 — Event Publisher
**Package:** `@soe/core-events`

Publicador oficial do CUE. Garante: validação de envelope, event_id único, correlação automática, retry exponencial, dead letter.

```typescript
import { EventPublisher } from '@soe/core-events'

await EventPublisher.publish({
  event_type: 'oportunidade.ganha',
  schema_version: '1.0.0',
  correlacao_id: 'corr-001', // ou injetado via CORE-05
  producer: 'cap-03',
  payload: { oportunidade_id: 'opp-001', valor: 50000 },
})
```

**Campos gerados automaticamente:** `event_id` (UUID v4), `published_at` (UTC ISO)

**Registro de schema (CUE como código):**
```typescript
import { registerEventSchema } from '@soe/core-events'
import { z } from 'zod'

registerEventSchema('oportunidade.ganha', z.object({
  oportunidade_id: z.string().uuid(),
  valor: z.number().positive(),
}))
```

**Transport plugável:** O transport padrão é `InMemoryTransport` (desenvolvimento/testes). Sprint 1 substituirá pelo transport de produção (Kafka/RabbitMQ/NATS):
```typescript
EventPublisher.setTransport(new KafkaTransport(config))
```

---

### CORE-05 — Identity Layer
**Package:** `@soe/core-identity`

Contexto de identidade via `AsyncLocalStorage` — propaga automaticamente por toda a call chain sem passagem explícita de parâmetros.

```typescript
import { Identity, type UserContext } from '@soe/core-identity'

// Middleware (ex: Express/Fastify) — executado uma vez por request:
const ctx = { correlationId: req.headers['x-correlation-id'], user: parsedUser }
await Identity.runAs(ctx, async () => {
  // Dentro desta função e qualquer função chamada por ela:
  Identity.currentUser()        // → UserContext
  Identity.correlationId()      // → 'corr-xxx'
  Identity.hasPermission('cap03:write')  // → boolean
  Identity.canDecide('D2')      // → boolean
})

// Contexto de sistema (ações automatizadas):
const sysCtx = Identity.systemContext('corr-001', 'eng-11')
await Identity.runAs(sysCtx, async () => { ... })
```

---

### CORE-06 — Audit Engine
**Package:** `@soe/core-audit`

Auditoria automática, append-only (ADR-0013). Nunca altera registros — correções são novos registros.

```typescript
import { Audit } from '@soe/core-audit'

// Registro manual:
await Audit.record({
  entity_type: 'oportunidade',
  entity_id: 'opp-001',
  action: 'STATE_CHANGE',
  before: { status: 'em_negociacao' },
  after:  { status: 'ganha' },
  origin: 'cap-03',
  reason: 'Cliente assinou contrato',
})

// Wrapper automático (captura before/after):
await Audit.wrap(
  { entityType: 'oportunidade', entityId: 'opp-001', action: 'UPDATE', origin: 'cap-03' },
  () => db.find('oportunidade', 'opp-001'),
  () => db.update('oportunidade', 'opp-001', { valor: 60000 }),
)
```

**Persistence plugável:** `DefaultAuditStore` é in-memory. Sprint 1 substitui por `PostgresAuditStore`.

---

### CORE-07 — Time Engine
**Package:** `@soe/core-time`

Provedor único de tempo. `new Date()` é proibido fora deste módulo.

```typescript
import { Time } from '@soe/core-time'

Time.now()              // Date UTC
Time.nowISO()           // '2026-07-01T10:00:00.000Z'
Time.nowMs()            // 1751364000000
Time.isBusinessDay(date, { holidays: ['2026-07-09'] }) // false
Time.addBusinessDays(date, 5)
Time.businessDaysBetween(from, to)

// Para testes determinísticos:
Time.simulate(new Date('2026-01-15'))
// ... testes ...
Time.resetSimulation()
```

---

### CORE-08 — Validation Framework
**Package:** `@soe/core-validation`

Centraliza validações. Nenhuma validação inline em módulos.

```typescript
import { Validation, CommonSchemas, z } from '@soe/core-validation'

// Schema Zod:
const OportunidadeSchema = z.object({
  id: CommonSchemas.uuid,
  valor: z.number().positive(),
  status: z.enum(['aberta', 'qualificada', 'ganha', 'perdida']),
})
const validator = Validation.schema(OportunidadeSchema)
const opp = validator.parse(rawInput) // lança SOEValidationError se inválido

// Regras de domínio:
const validator2 = Validation.rules([
  (opp) => opp.desconto > opp.valor * 0.5
    ? { field: 'desconto', message: 'Desconto máximo é 50%' }
    : null,
])

// Composição:
const fullValidator = Validation.compose(validator, validator2)
```

**Schemas reutilizáveis:** `CommonSchemas.uuid`, `.isoDatetime`, `.semver`, `.correlationId`, `.eventType`, `.decisionLevel`, `.pagination`

---

### CORE-09 — Health Engine
**Package:** `@soe/core-health`

Centraliza health checks. Todo componente registra seu checker. O endpoint `/health` agrega.

```typescript
import { Health, simpleChecker } from '@soe/core-health'

// Registrar componente:
Health.register('database', simpleChecker('database', '1.0.0', async () => {
  await db.ping() // lança se offline
}))

// Verificar tudo:
const result = await Health.checkAll()
// { status: 'HEALTHY', isa: 100, components: [...], checkedAt: '...' }

// ISA:
Health.currentISA() // → 100.0
```

**Limites de ISA (conforme ENG-12):**
- `≥ 97%` → HEALTHY
- `≥ 90%` → DEGRADED
- `< 90%` → UNHEALTHY

---

### CORE-10 — Observability
**Package:** `@soe/core-observability`

Métricas, tracing distribuído e correlação. Backend plugável via Sprint 6 (Prometheus/OTEL).

```typescript
import { Observability } from '@soe/core-observability'

// Métricas:
Observability.metrics.counter('events_published_total', 1, { producer: 'cap-03' })
Observability.metrics.gauge('queue_depth', 42)
Observability.metrics.histogram('request_duration_ms', 145)

// Tracing:
await Observability.tracer.withSpan('process-opportunity', async (span) => {
  span.setAttribute('oportunidade_id', 'opp-001')
  // ... lógica ...
})

// Medir duração automaticamente:
const result = await Observability.measureDuration(
  'db_query_ms',
  () => db.query('SELECT ...'),
  { table: 'oportunidades' },
)
```

---

## Critério Arquitetural — Verificações Obrigatórias

O CI deve rejeitar PRs que violem qualquer uma das regras abaixo:

```bash
# Zero console.log/warn/error direto (exceto no próprio CORE-02)
grep -r "console\.\(log\|warn\|error\)" packages/ --include="*.ts" \
  --exclude-path="*/core/logger/*"

# Zero new Date() / Date.now() fora do CORE-07
grep -r "new Date()\|Date\.now()" packages/ --include="*.ts" \
  --exclude-path="*/core/time/*"

# Zero process.env fora do CORE-01
grep -r "process\.env\." packages/ --include="*.ts" \
  --exclude-path="*/core/config/*"

# Zero throw new Error() genérico (sempre usar SOEError)
grep -r "throw new Error(" packages/ --include="*.ts" \
  --exclude-path="*/core/errors/*" \
  --exclude-path="*/core/identity/*"
```

---

## Extensão sem quebra de compatibilidade

Para adicionar capacidade a um componente CORE:

1. **Adição de método:** Adicionar à interface pública + implementação → sem quebra
2. **Modificação de campo obrigatório:** RFC MINOR (D2) + deprecação do campo anterior por 60 dias
3. **Remoção de método:** RFC MAJOR (D3) + deprecação por 90 dias + `@deprecated` JSDoc
4. **Mudança de comportamento:** RFC MAJOR (D3) + migration guide + feature flag temporário

**Nunca:**
- Remover export sem RFC aprovado
- Mudar tipo de parâmetro existente sem flag de compatibilidade
- Adicionar parâmetro obrigatório a função existente (adicione como opcional)
