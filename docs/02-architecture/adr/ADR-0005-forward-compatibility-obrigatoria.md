# ADR-0005 — Forward Compatibility Obrigatória em Todos os Contratos de Evento

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0005 |
| **Título** | Forward Compatibility Obrigatória: Consumidores Ignoram Campos Desconhecidos |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ENGINE-CONTRATO-DE-INTEGRACAO, ENG-12, todos os consumidores |

---

## Contexto

Em um sistema com múltiplos publicadores e consumidores de eventos, a evolução dos schemas é inevitável. A questão é: quando um publicador adiciona um novo campo a um evento, o que acontece com os consumidores que não conhecem esse campo?

Existem duas posições possíveis:
1. **Estrito (strict):** consumidores falham ao encontrar campo desconhecido
2. **Tolerante (tolerant):** consumidores ignoram campos desconhecidos

A posição estrita parece mais segura — "se eu não conheço, não processo". Mas na prática, cria uma coordenação obrigatória entre publicador e todos os consumidores para qualquer adição de campo, mesmo que a adição seja puramente aditiva e os consumidores não precisem do novo campo.

---

## Decisão

Todo consumidor de evento no barramento SOE **deve ignorar campos desconhecidos** sem falhar. Esta é a política de **forward compatibility** obrigatória.

Combinada com a regra de que novas adições a um schema de evento devem ser campos opcionais (nunca obrigatórios em mudanças MINOR), isso permite que:
- Um publicador adicione campos a um evento sem coordenação com consumidores existentes
- Consumidores adotem os novos campos no seu próprio ritmo
- O sistema evolua sem "big bang upgrades"

A remoção de campos permanece uma mudança MAJOR, sujeita ao protocolo de depreciação (mínimo 90 dias para eventos).

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| Strict mode (falhar em campo desconhecido) | Coordenação obrigatória entre publicador e todos os consumidores para qualquer adição de campo; impossível em sistema com muitos consumidores; "deploy wall" artificial |
| Versionamento de URL/tópico por versão (v1/, v2/) | Consumidores devem subscrever em múltiplos tópicos durante migração; complexidade operacional alta; não elimina problema de coordenação |
| Schema Registry com validação de compatibilidade | Útil como ferramenta complementar, mas a política é anterior à ferramenta; a regra "ignorar desconhecidos" deve existir no contrato, não depender de uma ferramenta específica |

---

## Consequências Positivas

- **Deploys independentes:** publicador pode adicionar campos e fazer deploy sem coordenar com todos os consumidores
- **Evolução gradual:** consumidores adotam novos campos quando precisam deles, não quando o publicador os publica
- **Resiliência:** consumidores não quebram ao receber versões mais novas de eventos

## Trade-offs Aceitos

- **Novos campos opcionais por padrão:** publicadores não podem tornar obrigatório um campo novo em mudança MINOR; se campo obrigatório for necessário, é mudança MAJOR com protocolo de migração
- **Consumidores devem ser explícitos sobre o que consomem:** sem strict mode, é responsabilidade do consumidor documentar quais campos utiliza; compensado pela declaração no ENGINE-REGISTRATION de cada módulo
