# @soe/core — Kernel da Plataforma SOE

Infraestrutura transversal obrigatória. Todos os CAPs e Engines consomem exclusivamente estes packages.

## Packages

| Package | Versão | Descrição |
|---|---|---|
| `@soe/core-time` | 1.0.0 | CORE-07 — Provedor único de tempo (UTC, timezone, simulação) |
| `@soe/core-config` | 1.0.0 | CORE-01 — Configuration Engine (env vars, feature flags, MUP) |
| `@soe/core-errors` | 1.0.0 | CORE-03 — Hierarquia de erros padronizados (6 categorias) |
| `@soe/core-identity` | 1.0.0 | CORE-05 — Identity Layer (AsyncLocalStorage, D0-D4, permissões) |
| `@soe/core-validation` | 1.0.0 | CORE-08 — Validation Framework (Zod + regras de domínio) |
| `@soe/core-logger` | 1.0.0 | CORE-02 — Logging Engine (JSON estruturado, correlação automática) |
| `@soe/core-events` | 1.0.0 | CORE-04 — Event Publisher (CUE, validação, retry, dead letter) |
| `@soe/core-audit` | 1.0.0 | CORE-06 — Audit Engine (append-only, before/after, wrap) |
| `@soe/core-health` | 1.0.0 | CORE-09 — Health Engine (ISA, checker registry, /health) |
| `@soe/core-observability` | 1.0.0 | CORE-10 — Observability (metrics, tracing, duration) |

## Criando um novo módulo CAP ou Engine

```bash
# 1. Declare dependências no package.json do módulo:
{
  "dependencies": {
    "@soe/core-config": "*",
    "@soe/core-logger": "*",
    "@soe/core-errors": "*",
    "@soe/core-time": "*",
    "@soe/core-identity": "*",
    "@soe/core-validation": "*",
    "@soe/core-events": "*",
    "@soe/core-audit": "*",
    "@soe/core-health": "*",
    "@soe/core-observability": "*"
  }
}
```

```typescript
// 2. Padrão de imports em qualquer módulo:
import { Config }         from '@soe/core-config'
import { createLogger }   from '@soe/core-logger'
import { BusinessError }  from '@soe/core-errors'
import { Time }           from '@soe/core-time'
import { Identity }       from '@soe/core-identity'
import { Validation, z }  from '@soe/core-validation'
import { EventPublisher } from '@soe/core-events'
import { Audit }          from '@soe/core-audit'
import { Health }         from '@soe/core-health'
import { Observability }  from '@soe/core-observability'

// 3. Logger por módulo (não singleton global):
const log = createLogger({ component: 'cap-03', cap: 'cap-03' })

// 4. Health check do módulo:
Health.register('cap-03', async () => ({
  component: 'cap-03',
  version: Config.require('SOE_CAP_CAP_03_VERSION'),
  status: 'HEALTHY',
  dependencies: [],
  lastHeartbeat: Time.nowISO(),
  operationalState: 'Operational',
}))
```

## Executar testes

```bash
# Todos os testes do kernel:
npm test

# Com coverage:
npm run test:coverage

# Teste de um package específico:
npx jest packages/core/events
```

## Convenções obrigatórias

| ✅ Faça | ❌ Não faça |
|---|---|
| `Time.nowISO()` | `new Date().toISOString()` |
| `Config.require('KEY')` | `process.env.KEY` |
| `createLogger({ component })` | `console.log()` |
| `throw new BusinessError(...)` | `throw new Error(...)` |
| `EventPublisher.publish(...)` | Publicar diretamente no broker |
| `Audit.record(...)` | Inserir em tabela de auditoria manualmente |
| `Validation.schema(schema).parse(input)` | Validar inline com `if` |
| `Identity.requireUser()` | Receber `userId` como parâmetro |
