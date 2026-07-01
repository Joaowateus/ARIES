import type { Config } from 'jest'
import { pathsToModuleNameMapper } from 'ts-jest'

// Paths mapeados para resolver @soe/* em testes e em source files importados
const paths = {
  '@soe/core-config': ['./packages/core/config/src/index.ts'],
  '@soe/core-logger': ['./packages/core/logger/src/index.ts'],
  '@soe/core-errors': ['./packages/core/errors/src/index.ts'],
  '@soe/core-time': ['./packages/core/time/src/index.ts'],
  '@soe/core-identity': ['./packages/core/identity/src/index.ts'],
  '@soe/core-validation': ['./packages/core/validation/src/index.ts'],
  '@soe/core-events': ['./packages/core/events/src/index.ts'],
  '@soe/core-audit': ['./packages/core/audit/src/index.ts'],
  '@soe/core-health': ['./packages/core/health/src/index.ts'],
  '@soe/core-observability': ['./packages/core/observability/src/index.ts'],
  '@soe/cap-01': ['./packages/cap-01/src/index.ts'],
  '@soe/cap-02': ['./packages/cap-02/src/index.ts'],
  '@soe/cap-03': ['./packages/cap-03/src/index.ts'],
  '@soe/cap-04': ['./packages/cap-04/src/index.ts'],
  '@soe/cap-04/*': ['./packages/cap-04/src/*'],
  '@soe/cap-02/*': ['./packages/cap-02/src/*'],
  '@soe/cap-03/*': ['./packages/cap-03/src/*'],
}

const config: Config = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/packages/core/*/tests/**/*.test.ts',
    '<rootDir>/packages/cap-01/tests/**/*.test.ts',
    '<rootDir>/packages/cap-02/tests/**/*.test.ts',
    '<rootDir>/packages/cap-03/tests/**/*.test.ts',
    '<rootDir>/packages/cap-04/tests/**/*.test.ts',
    '<rootDir>/tests/business-flows/**/*.test.ts',
  ],
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'packages/core/*/src/**/*.ts',
    '!packages/core/*/src/index.ts',
    'packages/cap-01/src/**/*.ts',
    '!packages/cap-01/src/index.ts',
    'packages/cap-02/src/**/*.ts',
    '!packages/cap-02/src/index.ts',
    'packages/cap-03/src/**/*.ts',
    '!packages/cap-03/src/index.ts',
    'packages/cap-04/src/**/*.ts',
    '!packages/cap-04/src/index.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
}

export default config
