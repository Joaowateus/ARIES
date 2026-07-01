import { Customer } from '../../domain/entities/Customer'
import { Onboarding } from '../../domain/entities/Onboarding'
import { CustomerHealth } from '../../domain/entities/CustomerHealth'
import { CustomerInteraction } from '../../domain/entities/CustomerInteraction'

export interface ICustomerRepository {
  save(customer: Customer): Promise<void>
  findById(id: string): Promise<Customer | null>
  findByClienteId(clienteId: string): Promise<Customer | null>
  findByOportunidade(oportunidadeId: string): Promise<Customer | null>
  findAtivos(): Promise<Customer[]>
  findAll(): Promise<Customer[]>
}

export interface IOnboardingRepository {
  save(onboarding: Onboarding): Promise<void>
  findById(id: string): Promise<Onboarding | null>
  findByOportunidade(oportunidadeId: string): Promise<Onboarding | null>
  findByCustomer(customerId: string): Promise<Onboarding[]>
  findAll(): Promise<Onboarding[]>
}

export interface ICustomerHealthRepository {
  save(health: CustomerHealth): Promise<void>
  findLatestByCustomer(customerId: string): Promise<CustomerHealth | null>
  findAllByCustomer(customerId: string): Promise<CustomerHealth[]>
}

export interface ICustomerInteractionRepository {
  save(interaction: CustomerInteraction): Promise<void>
  findByCustomer(customerId: string): Promise<CustomerInteraction[]>
  findAll(): Promise<CustomerInteraction[]>
}
