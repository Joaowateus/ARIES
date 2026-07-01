import { UsuarioAdministrado, UsuarioAdministradoProps, PapelSistema, StatusUsuarioAdmin } from '../../domain/entities/UsuarioAdministrado'
import { Time, TimeProps } from '../../domain/entities/Time'
import { Filial, FilialProps } from '../../domain/entities/Filial'
import { IUsuarioAdminRepository, ITimeRepository, IFilialRepository, IAuditLog } from '../../application/ports/Repositories'

export class InMemoryUsuarioAdminRepository implements IUsuarioAdminRepository {
  private store = new Map<string, UsuarioAdministradoProps>()

  async save(usuario: UsuarioAdministrado): Promise<void> {
    this.store.set(usuario.id, usuario.toObject())
  }

  async findById(id: string): Promise<UsuarioAdministrado | undefined> {
    const props = this.store.get(id)
    return props ? UsuarioAdministrado.reconstitute(props) : undefined
  }

  async findByEmail(empresaId: string, email: string): Promise<UsuarioAdministrado | undefined> {
    for (const props of this.store.values()) {
      if (props.empresaId === empresaId && props.email === email) {
        return UsuarioAdministrado.reconstitute(props)
      }
    }
    return undefined
  }

  async findByEmpresa(empresaId: string, filtros?: { status?: StatusUsuarioAdmin; papel?: PapelSistema }): Promise<UsuarioAdministrado[]> {
    return Array.from(this.store.values())
      .filter(p => {
        if (p.empresaId !== empresaId) return false
        if (filtros?.status && p.status !== filtros.status) return false
        if (filtros?.papel && p.papel !== filtros.papel) return false
        return true
      })
      .map(p => UsuarioAdministrado.reconstitute(p))
  }
}

export class InMemoryTimeRepository implements ITimeRepository {
  private store = new Map<string, TimeProps>()

  async save(time: Time): Promise<void> {
    this.store.set(time.id, time.toObject())
  }

  async findById(id: string): Promise<Time | undefined> {
    const props = this.store.get(id)
    return props ? Time.reconstitute(props) : undefined
  }

  async findByEmpresa(empresaId: string): Promise<Time[]> {
    return Array.from(this.store.values())
      .filter(p => p.empresaId === empresaId)
      .map(p => Time.reconstitute(p))
  }
}

export class InMemoryFilialRepository implements IFilialRepository {
  private store = new Map<string, FilialProps>()

  async save(filial: Filial): Promise<void> {
    this.store.set(filial.id, filial.toObject())
  }

  async findById(id: string): Promise<Filial | undefined> {
    const props = this.store.get(id)
    return props ? Filial.reconstitute(props) : undefined
  }

  async findByEmpresa(empresaId: string): Promise<Filial[]> {
    return Array.from(this.store.values())
      .filter(p => p.empresaId === empresaId)
      .map(p => Filial.reconstitute(p))
  }
}

type AuditEntry = { tipo: string; empresaId: string; atorId: string; alvoId: string; detalhe?: Record<string, unknown>; ocorridoEm: string }

export class InMemoryAuditLog implements IAuditLog {
  entries: AuditEntry[] = []

  async registrar(evento: AuditEntry): Promise<void> {
    this.entries.push(evento)
  }

  async findByEmpresa(empresaId: string): Promise<AuditEntry[]> {
    return this.entries.filter(e => e.empresaId === empresaId)
  }
}
