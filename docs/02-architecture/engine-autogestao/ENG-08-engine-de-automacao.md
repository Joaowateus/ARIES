---
id: ARC-ENG-008
titulo: "ENG-08 — Engine de Automação"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-007
tags: [engine, automacao, integracao, crm, erp, api, rpa, conectores, sistemas-externos]
---

# ENG-08 — Engine de Automação

---

## 1. Objetivo

Fornecer a **camada de integração e execução técnica** que conecta o SOE a todos os sistemas externos — CRM, ERP, e-mail, mensageria, gateways de pagamento, ferramentas de assinatura eletrônica, APIs de enriquecimento de dados, e qualquer outro sistema que a empresa utilize — através de um catálogo centralizado de conectores que podem ser invocados por qualquer outra Engine sem que cada uma precise conhecer os detalhes técnicos de cada integração.

A ENG-08 é a **camada de execução técnica** do SOE: ela não decide o que fazer (isso é responsabilidade das outras Engines e dos módulos), mas garante que as ações decididas sejam executadas com confiabilidade, rastreabilidade e tratamento de falhas padronizado.

---

## 2. Responsabilidades

- **Registrar e manter** o catálogo de conectores do SOE (um conector por sistema externo)
- **Executar** operações em sistemas externos quando invocada por ENG-07 (Workflows) ou outras Engines
- **Abstrair** a complexidade técnica de cada integração — quem chama não precisa saber como o CRM funciona
- **Gerenciar** autenticação, refresh de tokens, e credenciais de forma centralizada e segura
- **Implementar** retry automático com backoff exponencial em falhas transitórias
- **Registrar** log completo de cada chamada: o que foi enviado, o que foi recebido, tempo de resposta, sucesso ou falha
- **Monitorar** a saúde dos conectores (latência, taxa de erro, disponibilidade)
- **Alertar** via ENG-03 quando um sistema externo está indisponível ou degradado
- **Normalizar** dados entre sistemas — garantir que os dados fluam no formato correto entre o SOE e cada sistema

---

## 3. Entradas

### 3.1 Entradas de Configuração (Design Time)
```yaml
conector_definition:
  id: "CONN-CRM-PRINCIPAL"
  nome: "CRM Principal (HubSpot / Salesforce / Pipedrive)"
  tipo: "rest_api"                        # rest_api | graphql | webhook | database | rpa | email_smtp
  base_url: "https://api.crm.exemplo.com"
  autenticacao:
    tipo: "oauth2"
    client_id: "{{env.CRM_CLIENT_ID}}"    # nunca hard-coded — sempre via variável de ambiente
    client_secret: "{{env.CRM_SECRET}}"
    token_endpoint: "/oauth/token"
    escopos: ["contacts.read", "contacts.write", "deals.read", "deals.write"]
  operacoes:
    - id: "calcular_icp_score"
      metodo: "POST"
      endpoint: "/contacts/{{lead_id}}/score"
      payload_schema: {lead_id: "string"}
      response_schema: {icp_score: "number", segmento: "string"}
      timeout_ms: 5000
    - id: "atualizar_status_lead"
      metodo: "PATCH"
      endpoint: "/contacts/{{lead_id}}"
      payload_schema: {status: "string", motivo_descarte: "string?"}
      timeout_ms: 3000
    - id: "criar_oportunidade"
      metodo: "POST"
      endpoint: "/deals"
      payload_schema: {contact_id: "string", nome: "string", valor_estimado: "number", etapa: "string"}
      response_schema: {deal_id: "string"}
      timeout_ms: 5000
  health_check:
    endpoint: "/ping"
    frequencia_minutos: 5
    timeout_ms: 2000
  sla:
    disponibilidade_minima: 99.5          # %
    latencia_p95_ms: 1000
  retry:
    max_tentativas: 3
    backoff_ms: [1000, 3000, 9000]
    erros_retriable: [429, 500, 502, 503, 504]
```

### 3.2 Entradas de Execução (Run Time)
| Entrada | Origem | Quando |
|---------|--------|--------|
| Solicitação de operação | ENG-07 (Workflows) | Ao executar ação de workflow |
| Solicitação de operação | ENG-09 (Melhoria Contínua) | Em ações de melhoria automatizadas |
| Solicitação de operação | ENG-10 (IA/Conhecimento) | Para enriquecimento de dados |
| Webhook recebido de sistema externo | CRM, Pagamentos, DocuSign | Por evento no sistema externo |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Resultado da operação (payload de resposta) | Engine solicitante (ENG-07) | Por chamada |
| Evento `automacao.operacao_concluida` | ENG-07, barramento SOE | Por operação bem-sucedida |
| Evento `automacao.operacao_falhou` | ENG-07, ENG-03 | Por falha não recuperável |
| Evento `automacao.sistema_indisponivel` | ENG-03 (Alertas) | Quando health check falha |
| Log de execução (imutável) | `automacao_logs` | Por operação |
| Relatório de saúde dos conectores | Dashboard técnico | Tempo real |
| Relatório de taxa de erro por conector | ENG-09 (Melhoria Contínua) | Diário |

---

## 5. Regras Gerais

### RG-01: Credenciais Nunca em Código
Toda credencial de sistema externo DEVE ser armazenada em cofre de segredos (ex: HashiCorp Vault, AWS Secrets Manager, variáveis de ambiente protegidas). Nunca em arquivos de configuração versionados ou banco de dados não criptografado.

### RG-02: Idempotência via Chave de Deduplicação
Toda operação DEVE suportar uma `chave_deduplicacao` opcional. Se a mesma chave for enviada duas vezes (ex: em retentativa), o conector identifica e retorna o resultado da primeira chamada sem executar novamente — prevenindo duplicações em sistemas externos (ex: e-mail enviado duas vezes, fatura emitida duas vezes).

### RG-03: Timeout Sempre Configurado
Nenhuma operação pode executar sem timeout configurado. O timeout padrão global é 10 segundos; operações longas podem configurar até 60 segundos, com justificativa documentada.

### RG-04: Log Completo e Imutável
Todo log de operação registra: timestamp de início, payload enviado, payload recebido, código HTTP/status, tempo de resposta, ID de tentativa, resultado final. Logs de operações com dados sensíveis devem mascarar campos marcados como PII/confidencial.

### RG-05: Isolamento de Falha por Conector
Falha em um conector NÃO deve afetar outros conectores. Circuit breaker por conector: se um sistema externo tem >50% de erros em 5 minutos, o circuit breaker abre e todas as novas chamadas para aquele sistema são rejeitadas imediatamente (retornam erro rápido), até o sistema se recuperar.

### RG-06: Dados Normalizados no Barramento Interno
O SOE opera com seu próprio modelo de dados interno. O conector é responsável por traduzir entre o modelo interno do SOE e o modelo do sistema externo — nunca o contrário. O resto do SOE nunca fala "HubSpot" ou "Salesforce" — fala "CRM_PRINCIPAL".

### RG-07: Webhooks São Transformados em Eventos SOE
Quando um sistema externo envia um webhook (ex: "pagamento confirmado" do gateway), a ENG-08 o recebe, valida a autenticidade, transforma no formato de evento SOE, e publica no barramento. O resto do SOE não sabe que veio de um webhook.

---

## 6. Interfaces com os Módulos

| Sistema Externo | Conector | Usado Por |
|-----------------|----------|-----------|
| CRM (HubSpot/Salesforce/Pipedrive) | CONN-CRM-PRINCIPAL | CAP-01, CAP-02, CAP-03, CAP-05, CAP-09 |
| ERP / Sistema Financeiro | CONN-ERP-FINANCEIRO | CAP-04, CAP-07 |
| Assinatura Eletrônica (DocuSign/ClickSign) | CONN-ASSINATURA-ELETRONICA | CAP-03 (contratos) |
| Gateway de Pagamento (Stripe/PagSeguro) | CONN-GATEWAY-PAGAMENTO | CAP-04 |
| E-mail Transacional (SendGrid/SES) | CONN-EMAIL-TRANSACIONAL | CAP-04, CAP-05, ENG-03 |
| Mensageria (Slack/Teams/WhatsApp) | CONN-MENSAGERIA | ENG-03 (alertas) |
| Enriquecimento de Dados (Apollo/Clearbit) | CONN-ENRIQUECIMENTO | CAP-02 |
| LinkedIn Sales Navigator | CONN-LINKEDIN | CAP-02, CAP-09 |
| Google / LinkedIn Ads | CONN-ADS | CAP-02 |
| NPS (Typeform/SurveyMonkey/Delighted) | CONN-PESQUISA-NPS | CAP-05 |
| Banco / Open Finance | CONN-BANCO | CAP-04 (reconciliação) |
| Repositório de Documentos (Git/S3/Drive) | CONN-REPOSITORIO-DOCS | ENG-06, CAP-03 |

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `conector_definitions`
```
id                      TEXT PRIMARY KEY    -- "CONN-CRM-PRINCIPAL"
nome                    TEXT
tipo                    ENUM(rest_api, graphql, webhook, database, rpa, email_smtp)
configuracao_json       JSONB               -- base_url, auth, operações (sem credenciais)
secret_ref              TEXT                -- referência ao cofre de segredos
health_check_json       JSONB
sla_json                JSONB
retry_json              JSONB
circuit_breaker_status  ENUM(fechado, aberto, semi_aberto)
ativo                   BOOLEAN
criado_em               TIMESTAMP
```

### 7.2 Tabela: `automacao_logs` (append only — imutável)
```
id                      UUID PRIMARY KEY
conector_id             TEXT REFERENCES conector_definitions
operacao_id             TEXT
chamador_engine         TEXT               -- "ENG-07", "ENG-10", etc.
chamador_execucao_id    UUID               -- ID da execução de workflow ou processo
chave_deduplicacao      TEXT               -- para idempotência
payload_enviado_json    JSONB              -- mascarado para campos PII
payload_recebido_json   JSONB              -- mascarado para campos PII
status_http             INTEGER
resultado               ENUM(sucesso, falha_transitoria, falha_definitiva, timeout, deduplicado)
tentativas              INTEGER
iniciada_em             TIMESTAMP
concluida_em            TIMESTAMP
duracao_ms              INTEGER
erro_descricao          TEXT
correlacao_id           UUID
```

### 7.3 Tabela: `conector_health_history` (série temporal)
```
id                      UUID PRIMARY KEY
conector_id             TEXT
timestamp               TIMESTAMP
status                  ENUM(ok, degradado, indisponivel)
latencia_ms             INTEGER
codigo_resposta         INTEGER
erro_descricao          TEXT
```

### 7.4 Tabela: `webhook_recebidos` (append only)
```
id                      UUID PRIMARY KEY
conector_id             TEXT
origem_ip               TEXT
headers_json            JSONB              -- sem dados sensíveis
payload_raw             TEXT               -- payload original (para debugging)
payload_normalizado_json JSONB             -- payload em formato SOE
assinatura_valida       BOOLEAN
evento_soe_emitido      TEXT               -- tipo de evento gerado
processado_em           TIMESTAMP
```

---

## 8. Fluxo Operacional

```
[FLUXO A — OPERAÇÃO OUTBOUND: SOE → Sistema Externo]

[1] RECEBIMENTO DA SOLICITAÇÃO
│
└─► ENG-07 (ou outra Engine) solicita operação:
    {conector_id, operacao_id, parametros, chave_deduplicacao}
    │
    └─► ENG-08 verifica deduplicação:
        ├─► Chave já processada com sucesso → retornar resultado anterior (não re-executar)
        └─► Nova → prosseguir

[2] PRÉ-EXECUÇÃO
│
├─► Verificar status do circuit breaker do conector
│   ├─► Aberto → retornar erro rápido ("sistema indisponível") sem tentar
│   └─► Fechado/Semi-aberto → prosseguir
│
├─► Recuperar credenciais do cofre de segredos
├─► Validar parâmetros contra schema da operação
└─► Montar payload no formato esperado pelo sistema externo

[3] EXECUÇÃO COM RETRY
│
└─► Enviar chamada HTTP/API para sistema externo (com timeout configurado)
    │
    ├─► SUCESSO (2xx)
    │   └─► Normalizar resposta para formato SOE
    │       └─► Registrar log com sucesso
    │           └─► Atualizar métricas de saúde do conector
    │               └─► Retornar resultado para chamador
    │                   └─► Emitir automacao.operacao_concluida
    │
    ├─► ERRO RETRIABLE (429, 5xx) e tentativas < max
    │   └─► Aguardar backoff
    │       └─► Tentar novamente (até max_tentativas)
    │
    └─► ERRO DEFINITIVO (4xx não-retriable, ou esgotou tentativas)
        └─► Registrar log com falha
            └─► Atualizar circuit breaker (incrementar contador de falha)
                └─► Retornar erro para chamador
                    └─► Emitir automacao.operacao_falhou → ENG-07 aplica política em_falha

[FLUXO B — WEBHOOK INBOUND: Sistema Externo → SOE]

[1] RECEBIMENTO DO WEBHOOK
│
└─► Endpoint HTTP da ENG-08 recebe POST do sistema externo
    └─► Validar assinatura HMAC/token do remetente
        ├─► Inválida → rejeitar com 401; registrar tentativa suspeita
        └─► Válida → salvar payload raw em webhook_recebidos
            └─► Normalizar payload para formato de evento SOE
                └─► Publicar evento no barramento SOE
                    └─► Retornar 200 OK para sistema externo (rápido — não bloquear)
                        └─► ENG-07 processa o evento publicado de forma assíncrona

[FLUXO C — HEALTH CHECK CONTÍNUO]

└─► Scheduler executa health check de cada conector conforme frequência configurada
    └─► Chamada ao endpoint de saúde do sistema externo
        ├─► OK e dentro do SLA de latência → status = ok
        ├─► Lento mas disponível → status = degradado; alerta info para ENG-03
        └─► Indisponível → status = indisponivel
            └─► Abrir circuit breaker
                └─► Emitir automacao.sistema_indisponivel → ENG-03 (alerta crítico)
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `automacao.operacao_concluida` | Operação executada com sucesso | `{log_id, conector_id, operacao_id, duracao_ms, resultado_resumo}` |
| `automacao.operacao_falhou` | Falha definitiva após retentativas | `{log_id, conector_id, operacao_id, tentativas, erro}` |
| `automacao.sistema_indisponivel` | Health check falhou | `{conector_id, nome_sistema, tempo_indisponivel}` |
| `automacao.sistema_recuperado` | Health check volta a passar após indisponibilidade | `{conector_id, tempo_indisponivel_total}` |
| `automacao.circuit_breaker_aberto` | Circuit breaker abriu | `{conector_id, taxa_erro, janela_minutos}` |
| `automacao.webhook_recebido` | Webhook válido processado | `{webhook_id, conector_id, evento_soe_gerado}` |
| `automacao.webhook_suspeito` | Webhook com assinatura inválida | `{conector_id, origem_ip, timestamp}` |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `workflow.acao_iniciada` (tipo: crm/erp/api call) | ENG-07 | Executar operação no sistema externo correspondente |
| `sistema.credencial_atualizada` | Administrador SOE | Atualizar credencial em cache; testar conector |
| `sistema.conector_desativado` | Administrador SOE | Fechar circuit breaker; rejeitar chamadas futuras |
| `automacao.sistema_recuperado` | ENG-08 (self) | Fechar circuit breaker; retomar operações normais |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-08 |
