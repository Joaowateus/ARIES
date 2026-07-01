---
id: DOD-PLATAFORMA-001
titulo: "Definition of Done da Plataforma — Commercial OS"
versao: "1.0.0"
status: aprovado
categoria: POL
autor: Guardião da Documentação Técnica
criado-em: 2026-07-01
atualizado-em: 2026-07-01
aprovado-por: Arquitetura — Architecture Freeze v1.0
nivel-decisao-alteracao: D3
aplica-se-a: "Todo módulo CAP, engine, conector e componente de infraestrutura"
tags:
  [dod, definition-of-done, qualidade, plataforma, modulo, criterios, sprint]
---

# DOD-PLATAFORMA-001 — Definition of Done da Plataforma

> **Este é o critério objetivo para dizer que um componente do Commercial OS está concluído.**
> Não existe "quase pronto", "funcional mas sem testes", ou "falta só documentar". Um componente está pronto quando passa em todos os critérios aplicáveis ao seu tipo. Antes disso, está em desenvolvimento.

---

## 1. Por que um DoD da Plataforma, não do Código

O DoD convencional de desenvolvimento de software verifica se o código está correto. O DoD da Plataforma verifica se o **componente está integrado corretamente no Commercial OS** — se ele honra os contratos, se não viola regras arquiteturais, se pode ser governado pela ENG-12, se é observável, se é testável de forma independente.

Um módulo com código correto mas que viola o contrato do CUE não está pronto. Um módulo com testes unitários excelentes mas sem registro no RS não está pronto. Um módulo que implementa sua própria lógica de priorização não está pronto, mesmo que essa lógica seja melhor que a MUP.

O DoD da Plataforma garante que o todo seja consistente, não apenas que as partes individualmente funcionem.

---

## 2. Estrutura do DoD

O DoD é organizado em **oito blocos**. Cada bloco cobre uma dimensão diferente de "pronto". Todos os blocos são obrigatórios para todos os componentes. Blocos com critérios opcionais por tipo são marcados explicitamente.

```
BLOCO 1 — CONTRATO DE INTERFACE
BLOCO 2 — EVENTOS E BARRAMENTO
BLOCO 3 — INTEGRAÇÃO COM ENGINES
BLOCO 4 — GOVERNANÇA E REGISTRO
BLOCO 5 — QUALIDADE E TESTES
BLOCO 6 — OBSERVABILIDADE
BLOCO 7 — OPERAÇÃO E SEGURANÇA
BLOCO 8 — VERIFICAÇÃO FINAL
```

---

## BLOCO 1 — Contrato de Interface

*O componente honra seu contrato declarado na arquitetura.*

```
□ 1.1  O componente implementa integralmente o contrato definido em seu documento
       de especificação (MOD-CAP-XX.md ou ENG-XX-*.md)

□ 1.2  Todos os campos obrigatórios dos contratos de evento (CUE) estão presentes
       no payload de cada evento publicado

□ 1.3  Nenhum campo obrigatório foi removido ou renomeado sem RFC aprovado

□ 1.4  Campos adicionados além do contrato original (se houver) são opcionais
       e estão declarados no CUE antes de serem publicados

□ 1.5  O componente está registrado no ENGINE-REGISTRATION com:
       □ Lista completa de eventos publicados (com versao_schema)
       □ Lista completa de eventos consumidos (com versao_schema)
       □ Lista de engines utilizadas
       □ Lista de módulos dos quais depende
       □ Lista de conectores externos utilizados (se houver)
```

---

## BLOCO 2 — Eventos e Barramento

*O componente se comunica exclusivamente via barramento e honra o CUE.*

```
□ 2.1  Nenhuma chamada direta a outro módulo CAP existe no código
       (zero imports de pacotes de outros módulos; zero chamadas HTTP/RPC diretas)

□ 2.2  Todos os eventos publicados pelo componente estão declarados no CUE
       com tipo, versao_schema e publicador correto

□ 2.3  Publicar evento com tipo não listado no CUE retorna erro em tempo de execução

□ 2.4  Todo evento publicado contém os campos obrigatórios:
       □ event_id (UUID v4, gerado no momento da publicação)
       □ event_type (tipo conforme CUE)
       □ published_at (timestamp ISO 8601)
       □ correlacao_id (propagado do evento gatilho, ou novo se origem externa)
       □ payload (conforme schema do CUE)

□ 2.5  Todo consumidor implementa deduplicação por event_id
       □ Janela mínima de 24h de histórico de event_ids processados
       □ Evento com event_id repetido é descartado silenciosamente (sem erro)

□ 2.6  Todo consumidor é idempotente
       □ Teste automatizado: processar o mesmo evento duas vezes produz o mesmo
         resultado que processar uma vez

□ 2.7  Todo consumidor implementa dead letter: evento que falha após N retentativas
       é enviado para dead letter queue (não descartado silenciosamente)

□ 2.8  Convenção de nomenclatura de eventos respeitada:
       [dominio].[entidade].[acao_passado]
       □ Verificado automaticamente por linter ou teste
```

---

## BLOCO 3 — Integração com Engines

*O componente usa as engines corretamente e não reimplementa capacidades delas.*

```
□ 3.1  [CAPs com processos] Todo processo do módulo está registrado na ENG-01
       como blueprint com:
       □ Gatilho definido
       □ Etapas com SLAs definidos
       □ Exit criteria por etapa
       □ Transições definidas

□ 3.2  [CAPs com KPIs] Todos os KPIs declarados no módulo estão registrados
       na ENG-02 com template completo (15+ campos obrigatórios do FOB-03)

□ 3.3  [CAPs com alertas] Todos os alertas declarados estão registrados na ENG-03
       com classificação de nível (INFO/ATENÇÃO/CRÍTICO/EMERGENCIAL)

□ 3.4  O módulo NÃO implementa lógica de priorização própria
       □ Toda priorização de situações passa pela ENG-11 (MUP)
       □ Verificado por code review e teste

□ 3.5  O módulo NÃO mantém sua própria cópia de constantes sistêmicas
       □ Valores como JANELA_CLAWBACK_DIAS, ICP_SCORE_MQL são lidos do RS
       □ Verificado por grep: nenhuma constante sistêmica hardcoded no código

□ 3.6  [CAPs com workflows automáticos] Todos os workflows estão registrados
       na ENG-07 com:
       □ Gatilho definido
       □ Sequência de ações com política em_falha por ação
       □ Timeout configurado para cada ação que chama sistema externo
       □ Política em_falha_geral definida

□ 3.7  [CAPs com integrações externas] Cada integração usa um CONN registrado
       □ CONN registrado no RS com sistema alvo, direção e SLA
       □ Timeout configurado (não hardcoded)
       □ Retry com backoff exponencial
       □ Evento publicado somente após confirmação do conector (nunca especulativo)
```

---

## BLOCO 4 — Governança e Registro

*O componente é visível, versionado e governável pela ENG-12.*

```
□ 4.1  O componente está registrado no RS (ENG-12) com:
       □ id único (CAP-XX ou ENG-XX ou CONN-XX)
       □ versao_atual em formato SemVer
       □ status = ATIVO
       □ responsavel_arquitetural designado
       □ documento_referencia apontando para o arquivo de especificação
       □ interfaces completas (eventos publicados e consumidos com versao_schema)
       □ dependencias completas (engines, módulos, contratos, conectores)

□ 4.2  O Health Check da ENG-12 retorna SAUDÁVEL para este componente
       (todos os itens dos 7 blocos verificados sem reprovação)

□ 4.3  Nenhuma dependência do componente aponta para componente com status
       DEPRECIADO ou ARQUIVADO no RS

□ 4.4  Se houve mudança MAJOR ou BREAKING durante a implementação:
       □ RFC correspondente está com status VALIDADO
       □ ADR correspondente foi criado documentando a decisão

□ 4.5  O Grafo de Dependências da ENG-12 reflete corretamente todas as
       dependências do componente após o registro
       □ Verificado: nenhuma dependência circular introduzida

□ 4.6  A versão do componente no RS é consistente com:
       □ A versão no documento de especificação
       □ A versão no package/manifest do código
       □ A versão no CHANGELOG
```

---

## BLOCO 5 — Qualidade e Testes

*O componente tem qualidade verificável, não apenas percebida.*

```
□ 5.1  Cobertura de testes unitários ≥ 80% nas regras de negócio do componente
       □ Regras críticas têm cobertura ≥ 95% (ex: exit criteria, MRR Bridge, MUP)

□ 5.2  Testes de integração cobrem:
       □ Publicação de cada evento obrigatório (com payload completo)
       □ Consumo de cada evento declarado no ENGINE-REGISTRATION
       □ Deduplicação (mesmo event_id processado duas vezes = mesmo resultado)
       □ Comportamento em falha de conector externo (se aplicável)

□ 5.3  Testes de contrato verificam:
       □ Payload de evento publicado é válido conforme schema do CUE
       □ Campos obrigatórios presentes em 100% das publicações
       □ event_id é único a cada publicação

□ 5.4  Testes de regressão para cada regra arquitetural:
       □ Chamada direta a outro módulo CAP → teste deve falhar (garantir que não existe)
       □ Constante sistêmica hardcoded → linter deve detectar
       □ Evento fora do CUE → runtime deve rejeitar

□ 5.5  CI verde: todos os testes passam na pipeline de CI em 100% das execuções
       da última semana (sem flakiness)

□ 5.6  Lint: zero warnings no código do componente

□ 5.7  [Para engines] Testes de carga: engine suporta volume 3x o volume
       esperado em produção no dia 1 sem degradação de latência p99
```

---

## BLOCO 6 — Observabilidade

*O componente é visível em produção sem acesso ao código.*

```
□ 6.1  Todos os eventos publicados incluem correlacao_id que permite rastrear
       o fluxo de ponta a ponta via ferramenta de tracing

□ 6.2  Logs estruturados em JSON com campos obrigatórios:
       □ timestamp (ISO 8601)
       □ level (DEBUG/INFO/WARN/ERROR)
       □ component (id do módulo/engine)
       □ event_id (quando processando um evento)
       □ correlacao_id (quando disponível)
       □ message (descrição humana do que ocorreu)

□ 6.3  Métricas exportadas (Prometheus ou equivalente configurado):
       □ Contador de eventos publicados por tipo
       □ Contador de eventos consumidos por tipo
       □ Contador de eventos na dead letter por tipo
       □ Latência de processamento de evento (histograma)
       □ [Para módulos de negócio] KPIs principais do módulo como métricas

□ 6.4  Health check endpoint /health (ou equivalente) respondendo com:
       □ Status do componente (UP/DEGRADED/DOWN)
       □ Status de cada conector externo utilizado
       □ Último evento processado (timestamp)

□ 6.5  Nenhuma informação sensível exposta em logs
       □ Sem PII (CPF, email, dados pessoais) em log level INFO ou acima
       □ Sem credenciais, tokens ou secrets em nenhum nível de log
```

---

## BLOCO 7 — Operação e Segurança

*O componente pode ser operado e é seguro.*

```
□ 7.1  Secrets são injetados via variável de ambiente ou secrets manager
       □ Zero credenciais hardcoded no código ou em arquivos commitados

□ 7.2  O componente pode ser reiniciado sem perda de estado crítico
       □ Estado transitório é recuperável do barramento (replay de eventos)
       □ Estado persistente está no banco de dados, não em memória

□ 7.3  Migrations de banco de dados são versionadas e reversíveis
       □ Cada migration tem up e down implementados e testados

□ 7.4  Inputs externos são validados antes de serem processados
       □ Payloads de eventos validados contra schema antes de processar
       □ Dados de conectores externos validados antes de persistir

□ 7.5  O componente não expõe endpoints HTTP públicos sem autenticação
       □ APIs internas usam autenticação de serviço (mTLS ou equivalente)

□ 7.6  Dependências de terceiros verificadas:
       □ Nenhuma dependência com vulnerabilidade conhecida de severidade HIGH ou CRITICAL
       □ Lock file commitado (versões fixas, não ranges)

□ 7.7  [Para módulos que processam dados pessoais] Mapeamento LGPD básico:
       □ Campos com PII identificados
       □ Retenção definida (quanto tempo esses dados ficam no sistema)
       □ Exclusão implementada (right to be forgotten)
```

---

## BLOCO 8 — Verificação Final

*Checklist de encerramento antes de marcar como PRONTO.*

```
□ 8.1  Code review realizado por pelo menos um revisor além do autor
       □ Revisor verificou especificamente os itens dos Blocos 1-7

□ 8.2  O componente foi testado em ambiente de staging com dados representativos
       (não apenas dados mínimos de teste)

□ 8.3  O documento de especificação (MOD-CAP-XX.md ou ENG-XX-*.md) está
       atualizado e consistente com o código implementado

□ 8.4  O CHANGELOG do projeto foi atualizado com a entrega

□ 8.5  O RS foi atualizado: status do componente = ATIVO (antes era RASCUNHO)

□ 8.6  Health Check da ENG-12 executado após o registro final:
       resultado = SAUDÁVEL; ISA não regrediu

□ 8.7  Responsável pelo componente assinou o DoD:
       confirma que revisou e verificou todos os 8 blocos pessoalmente
       (não delegou a verificação para outro membro)
```

---

## 3. Checklist Consolidado para Verificação Rápida

```
BLOCO 1 — CONTRATO DE INTERFACE (5 itens)
  □ 1.1 □ 1.2 □ 1.3 □ 1.4 □ 1.5

BLOCO 2 — EVENTOS E BARRAMENTO (8 itens)
  □ 2.1 □ 2.2 □ 2.3 □ 2.4 □ 2.5 □ 2.6 □ 2.7 □ 2.8

BLOCO 3 — INTEGRAÇÃO COM ENGINES (7 itens)
  □ 3.1 □ 3.2 □ 3.3 □ 3.4 □ 3.5 □ 3.6 □ 3.7

BLOCO 4 — GOVERNANÇA E REGISTRO (6 itens)
  □ 4.1 □ 4.2 □ 4.3 □ 4.4 □ 4.5 □ 4.6

BLOCO 5 — QUALIDADE E TESTES (7 itens)
  □ 5.1 □ 5.2 □ 5.3 □ 5.4 □ 5.5 □ 5.6 □ 5.7*

BLOCO 6 — OBSERVABILIDADE (5 itens)
  □ 6.1 □ 6.2 □ 6.3 □ 6.4 □ 6.5

BLOCO 7 — OPERAÇÃO E SEGURANÇA (7 itens)
  □ 7.1 □ 7.2 □ 7.3 □ 7.4 □ 7.5 □ 7.6 □ 7.7*

BLOCO 8 — VERIFICAÇÃO FINAL (7 itens)
  □ 8.1 □ 8.2 □ 8.3 □ 8.4 □ 8.5 □ 8.6 □ 8.7

* Itens com asterisco se aplicam condicionalmente (ver critério no bloco)

TOTAL: 52 itens | Itens obrigatórios universais: 48 | Condicionais: 4
```

---

## 4. O que Fazer com Itens Não Satisfeitos

| Situação | Ação |
|----------|------|
| Item técnico não satisfeito | Componente permanece em desenvolvimento; não é marcado como PRONTO |
| Item não se aplica ao tipo de componente | Documentar justificativa no PR; revisor confirma que realmente não se aplica |
| Item não pode ser satisfeito por limitação externa (ex: conector terceiro sem health check) | Abrir issue de rastreamento; documentar limitação conhecida; aprovação D2 para marcar PRONTO com exceção |
| Dúvida se item está satisfeito | Considerar NÃO satisfeito até que haja evidência clara |

**Regra de ouro:** em caso de dúvida, o componente não está pronto.

---

## 5. Como Este DoD Evolui

O DoD é versionado e pode ser atualizado via RFC (MINOR para adição de itens, MAJOR para remoção ou mudança de critério). Aprovação mínima D3.

Itens adicionados geralmente vêm de aprendizados de produção: "o item X não estava no DoD, mas a falha em produção mostrou que deveria estar". Esse é o mecanismo de aprendizado do próprio DoD.

O DoD não pode ser relaxado para atender um prazo. Se um componente não passa no DoD, o prazo é ajustado ou o escopo do componente é reduzido — o DoD não é negociado.

---

## 6. Relação com Outros Documentos

| Documento | Relação |
|-----------|---------|
| ARCH-001 | Define as regras arquiteturais que o Bloco 1-4 verifica |
| ENGINE-CONTRATO-DE-INTEGRACAO | Define os contratos que o Bloco 2 verifica |
| POL-ENGINE-001 | Define critérios que o Bloco 4 verifica para engines |
| ENG-12 (Health Check) | O item 4.2 do Bloco 4 requer resultado SAUDÁVEL da ENG-12 |
| ENG-11 | O item 3.4 do Bloco 3 verifica que a ENG-11 é usada para priorização |
| FOB-03 (KPIs) | O item 3.2 do Bloco 3 verifica que KPIs seguem template do FOB-03 |
| ADR-0002 a ADR-0015 | Fundamentam cada critério dos Blocos 1-4 |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-07-01 | Guardião da Documentação Técnica | Criação — parte do Architecture Freeze v1.0 e da transição para Evidence First |
