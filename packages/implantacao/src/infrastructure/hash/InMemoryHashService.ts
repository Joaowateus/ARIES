/**
 * InMemoryHashService — implementação de teste para IHashService.
 *
 * Em produção substituir por bcrypt ou argon2.
 * Não usar em ambiente real — sem salt, sem custo computacional.
 */

import { createHash } from 'crypto'
import { IHashService } from '../../domain/services/HashService'

export class InMemoryHashService implements IHashService {
  async hash(plain: string): Promise<string> {
    return 'hash:' + createHash('sha256').update(plain).digest('hex')
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    return hashed === await this.hash(plain)
  }
}
