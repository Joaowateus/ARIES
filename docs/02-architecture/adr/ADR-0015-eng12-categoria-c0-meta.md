# ADR-0015 — ENG-12 como Categoria C0-Meta: Governança do Sistema pelo Sistema

---

## Metadados

| Campo | Valor |
|---|---|
| **ID** | ADR-0015 |
| **Título** | A Engine de Governança do Sistema Opera em Categoria Distinta das Demais Engines |
| **Status** | Aprovado |
| **Autor** | Guardião da Documentação Técnica |
| **Data** | 2026-07-01 |
| **Última Revisão** | 2026-07-01 |
| **Versão** | 1.0.0 |
| **Componentes Afetados** | ENG-12, ARCH-001 |

---

## Contexto

As engines ENG-01 a ENG-11 governam operações de negócio — processos, KPIs, alertas, diagnósticos, decisões. Quando a ENG-12 foi projetada, surgiu uma questão: ela é uma engine como as outras ou algo diferente?

A diferença é fundamental. ENG-01 rastreia instâncias de processo. ENG-11 decide como responder a situações. Ambas respondem a eventos de negócio. A ENG-12, por outro lado, não responde a eventos de negócio — ela responde a mudanças no próprio sistema. Ela é ativada quando um artefato é adicionado ao RS, quando um RFC é submetido, quando um Health Check revela inconsistência. Seus "clientes" não são vendedores, gestores ou clientes — são as próprias engines e módulos.

Colocar a ENG-12 na mesma categoria das outras engines obscurece essa diferença fundamental. Uma pessoa entendendo a arquitetura poderia assumir que a ENG-12 trata problemas de vendas ou clientes — quando na verdade ela trata problemas da arquitetura em si.

---

## Decisão

A ENG-12 opera na categoria **C0-Meta** — uma categoria distinta das categorias operacionais (C3), estratégicas (C2) e fundacionais (C1). A hierarquia completa de categorias:

| Categoria | Engines | Governa |
|-----------|---------|---------|
| C3-Operacional | ENG-01, ENG-03, ENG-05, ENG-07, ENG-08 | Execução operacional |
| C2-Estratégica | ENG-02, ENG-04, ENG-06, ENG-09, ENG-10 | Análise e conhecimento |
| C1-Fundacional | ENG-11 | Decisão e cognição |
| **C0-Meta** | **ENG-12** | **O próprio sistema** |

A categoria C0-Meta tem propriedades únicas:
- Não é instanciada por eventos de negócio
- Seus gatilhos são mudanças no RS, RFCs e ciclos de auditoria arquitetural
- Não escreve dados em módulos CAP diretamente
- Pode bloquear ações de outras engines (ex: bloquear RFCs em status CRÍTICO)

---

## Alternativas Consideradas

| Alternativa | Motivo da Rejeição |
|---|---|
| ENG-12 como C1-Fundacional ao lado da ENG-11 | Cria confusão entre "decidir operações" (ENG-11) e "governar o sistema" (ENG-12); propósitos fundamentalmente diferentes |
| ENG-12 como C2-Estratégica | A governança sistêmica não é análise estratégica do negócio; é manutenção da integridade da arquitetura; categoria diferente |
| Sem categorização de engines (flat) | Perda de informação; arquiteto novo não consegue inferir o nível de abstração de uma engine pelo seu posicionamento; categorias comunicam propósito |

---

## Consequências Positivas

- **Clareza de propósito:** qualquer pessoa que vê "C0-Meta" entende imediatamente que essa engine é diferente em natureza das demais
- **Prevenção de uso incorreto:** a categoria sinaliza que a ENG-12 não deve ser usada para resolver problemas operacionais; problemas operacionais vão para C3 ou C1
- **Extensibilidade conceitual:** se no futuro surgir outro componente que governa o sistema (não as operações), a categoria C0-Meta já existe como recipiente conceitual

## Trade-offs Aceitos

- **Uma categoria com um único membro:** C0-Meta tem apenas a ENG-12; isso pode parecer desnecessário; aceito porque a categoria comunica uma propriedade real (essa engine é diferente) e não é criada para ter múltiplos membros
- **Hierarquia de categorias pode ser confusa:** C0 < C1 numericamente mas C0 está "acima" na hierarquia; escolha intencional — C0 como "meta" (que governa tudo), C1-C3 como "operacional" em níveis crescentes de concretude
