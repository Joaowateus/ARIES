/**
 * HashService — contrato para hashing de senhas.
 *
 * Implementações de produção usam bcrypt ou argon2.
 * Testes usam a implementação in-memory (SHA-256 simples).
 */

export interface IHashService {
  hash(plain: string): Promise<string>
  verify(plain: string, hashed: string): Promise<boolean>
}
