---
id: ARC-ENG-004
titulo: "ENG-04 — Engine de Diagnóstico"
versao: "1.0.0"
status: aprovado
categoria: C2-Estratégica
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - ARC-ENG-000
  - ARC-ENG-002
  - ARC-ENG-003
tags: [engine, diagnostico, causa-raiz, desvios, analise, 5-whys, ishikawa]
---

# ENG-04 — Engine de Diagnóstico

---

## 1. Objetivo

Fornecer o mecanismo estruturado pelo qual o SOE **analisa automaticamente e auxilia os responsáveis a identificar a causa raiz** de qualquer desvio de KPI ou anomalia operacional — transformando o diagnóstico de um exercício intuitivo e variável em um processo padronizado, documentado e auditável.

A ENG-04 é a **capacidade analítica** do SOE: ela garante que a empresa não apenas detecte problemas (ENG-03), mas entenda por que eles ocorreram — evitando planos de ação que tratam sintomas em vez de causas.

---

## 2. Responsabilidades

- **Receber** alertas críticos da ENG-03 e iniciar sessão de diagnóstico automaticamente
- **Coletar** automaticamente o contexto relevante: histórico do KPI, dados de módulos relacionados, eventos recentes
- **Estruturar** o diagnóstico através de frameworks padronizados (5 Whys, Ishikawa, decomposição de KPI)
- **Sugerir** hipóteses de causa raiz baseadas em padrões históricos (assistência de ENG-10)
- **Registrar** o diagnóstico conduzido pelo responsável (causa raiz escolhida, evidências, raciocínio)
- **Classificar** a causa raiz em categorias padronizadas (Processo / Pessoa / Ferramenta / Dado / Estratégia / Externo)
- **Vincular** o diagnóstico ao alerta original e ao plano de ação que será gerado (ENG-05)
- **Manter** histórico completo de diagnósticos para alimentar aprendizado organizacional (ENG-10)

---

## 3. Entradas

### 3.1 Entradas de Configuração (Design Time)
```yaml
diagnostico_template:
  id: "DIAG-CAP01-WIN-RATE"
  modulo: "CAP-01"
  kpi_associado: "KPI-IC-03"
  nome: "Diagnóstico de Win Rate Abaixo da Meta"
  contexto_automatico:
    - "historico_kpi: KPI-IC-03, ultimos_6_meses"
    - "kpi_correlacionados: [KPI-DM-05, KPI-DM-06, KPI-PV-02]"
    - "win_loss_ultimos_90_dias: CAP-01.win_loss_analysis"
    - "objecoes_mais_frequentes: CAP-03.objecoes_registro"
  hipoteses_iniciais:
    - "ICP desatualizado → verificar aderência ao ICP de deals perdidos"
    - "Qualidade de leads (MQL→SQL) degradada → verificar KPI-DM-06"
    - "Habilidade de negociação → verificar desconto médio e etapa de saída"
    - "Concorrência → verificar competitive intelligence (CAP-01)"
    - "Oferta desalinhada → verificar objeções de produto/preço"
  categorias_causa_raiz:
    - "Processo"
    - "Pessoa/Habilidade"
    - "Ferramenta/CRM"
    - "Dado/ICP"
    - "Estratégia/Oferta"
    - "Externo/Mercado"
  framework: "5_whys"                   # 5_whys | ishikawa | decomposicao_kpi
```

### 3.2 Entradas de Execução (Run Time)
| Entrada | Origem | Quando |
|---------|--------|--------|
| Evento `alerta.criado` com requer_diagnostico = true | ENG-03 | Alerta crítico disparado |
| Solicitação manual de diagnóstico | Gerente / Liderança | Ad hoc (qualquer desvio) |
| Histórico de KPI (série temporal) | ENG-02 | Ao iniciar sessão de diagnóstico |
| Dados de contexto dos módulos relacionados | ENG-02, CRM | Ao iniciar sessão |
| Diagnósticos históricos similares | ENG-04 (histórico próprio) | Ao iniciar sessão |
| Sugestões de hipóteses (IA) | ENG-10 | Ao iniciar sessão |

---

## 4. Saídas

| Saída | Destino | Frequência |
|-------|---------|-----------|
| Sessão de diagnóstico criada (com contexto automático) | Responsável (interface) | Por alerta crítico |
| Relatório de diagnóstico concluído | ENG-05 (para criar plano de ação) | Por sessão concluída |
| Evento `diagnostico.causa_raiz_identificada` | ENG-05 | Ao concluir diagnóstico |
| Evento `diagnostico.aberto` | ENG-03 (atualiza alerta) | Ao iniciar sessão |
| Causa raiz classificada + registrada | ENG-10 (base de conhecimento) | Por sessão concluída |
| Relatório de causas raiz frequentes | ENG-09 (Melhoria Contínua) | Mensal |

---

## 5. Regras Gerais

### RG-01: Diagnóstico Obrigatório para Alertas Críticos
Todo alerta de severidade `critical` ou `bloqueante` que possui `requer_diagnostico = true` DEVE ter uma sessão de diagnóstico aberta. Sem diagnóstico, o plano de ação não pode ser criado (ENG-05 requer vínculo com diagnóstico).

### RG-02: Tempo Máximo de Diagnóstico
Uma sessão de diagnóstico DEVE ser iniciada em até 24 horas após a abertura do alerta. Uma sessão deve ser concluída em até 5 dias úteis. Sessões não concluídas no prazo geram novo alerta de ENG-03.

### RG-03: Diagnóstico Baseado em Dados, Não em Intuição
A causa raiz identificada DEVE ser acompanhada de evidência (dado quantitativo, log, registro do CRM, ou análise documentada). Diagnósticos sem evidência são sinalizados como `hipotético` e NÃO devem ser usados como base de planos de ação definitivos.

### RG-04: Separação de Sintoma e Causa
O responsável pelo diagnóstico DEVE identificar explicitamente: (a) o sintoma observado (o que o KPI mostra), (b) a causa imediata (o que explica o sintoma), e (c) a causa raiz (o que gerou a causa imediata). Um plano de ação que trata apenas o sintoma é inválido.

### RG-05: Causas Externas São Registradas mas Não Ignoradas
Causas classificadas como `Externo/Mercado` não isentam o sistema de ação. O diagnóstico deve adicionalmente identificar: o que internamente poderia ter mitigado o impacto? O que pode ser feito para reduzir exposição no futuro?

### RG-06: Diagnósticos São Patrimônio da Empresa
Cada diagnóstico concluído é armazenado e indexado por: módulo, KPI afetado, categoria de causa raiz, e período. Esse repositório é a memória diagnóstica da empresa e alimenta a ENG-10.

---

## 6. Interfaces com os Módulos

| Módulo | Templates de Diagnóstico Registrados |
|--------|--------------------------------------|
| CAP-01 | Win rate abaixo da meta, ICP desatualizado, dados de IC desatualizados |
| CAP-02 | Volume de SQLs abaixo, qualidade de leads baixa, LRT alto |
| CAP-03 | Win rate por etapa, ciclo longo, alto desconto médio |
| CAP-04 | NRR abaixo de 100%, inadimplência alta, forecast impreciso |
| CAP-05 | Churn acima da meta, NPS baixo, onboarding atrasado |
| CAP-06 | Ticket médio abaixo, margem comprimida, portfólio inadequado |
| CAP-07 | Equipe abaixo de quota, turnover alto, ramp-up lento |
| CAP-08 | MRR abaixo da meta, LTV/CAC < 3, pipeline inadequado |
| CAP-09 | Canal de parceiros sem resultado, qualidade de leads baixa |

---

## 7. Estrutura de Dados Necessária

### 7.1 Tabela: `diagnostico_templates`
```
id                      TEXT PRIMARY KEY
modulo                  TEXT
kpi_associado           TEXT
nome                    TEXT
contexto_automatico_json JSONB           -- queries e dados a coletar
hipoteses_iniciais_json  JSONB
categorias_causa_raiz_json JSONB
framework               ENUM(5_whys, ishikawa, decomposicao_kpi, livre)
ativo                   BOOLEAN
```

### 7.2 Tabela: `diagnostico_sessoes`
```
id                      UUID PRIMARY KEY
template_id             TEXT REFERENCES diagnostico_templates
alerta_id               UUID            -- alerta que originou (se automático)
modulo                  TEXT
kpi_afetado             TEXT
periodo_referencia      DATE
status                  ENUM(aberto, em_andamento, concluido, abandonado)
responsavel             TEXT
contexto_coletado_json  JSONB           -- dados e histórico coletados automaticamente
hipoteses_avaliadas_json JSONB          -- hipóteses com avaliação (confirmada/descartada + evidência)
sintoma                 TEXT
causa_imediata          TEXT
causa_raiz              TEXT
categoria_causa_raiz    TEXT
evidencia               TEXT
nivel_confianca         ENUM(alto, medio, baixo, hipotetico)
observacoes             TEXT
criado_em               TIMESTAMP
concluido_em            TIMESTAMP
```

### 7.3 Tabela: `diagnostico_5whys` (para framework 5 Whys)
```
id                      UUID PRIMARY KEY
sessao_id               UUID REFERENCES diagnostico_sessoes
numero_why              INTEGER         -- 1 a 5
pergunta                TEXT
resposta                TEXT
evidencia               TEXT
timestamp               TIMESTAMP
```

### 7.4 Tabela: `diagnostico_ishikawa` (para framework Ishikawa)
```
id                      UUID PRIMARY KEY
sessao_id               UUID REFERENCES diagnostico_sessoes
categoria               TEXT            -- Processo, Pessoa, Ferramenta, etc.
causa_identificada      TEXT
evidencia               TEXT
classificacao           ENUM(primaria, contributiva, descartada)
```

---

## 8. Fluxo Operacional

```
[1] ABERTURA AUTOMÁTICA (por alerta crítico)
│
└─► ENG-03 emite alerta.criado com requer_diagnostico = true
    └─► ENG-04 recebe evento
        └─► Localiza template de diagnóstico para o kpi/modulo do alerta
            ├─► Template encontrado → criar sessão com template
            └─► Template não encontrado → criar sessão "livre" (sem hipóteses predefinidas)
                └─► Coletar contexto automático (histórico KPI, dados correlacionados)
                    └─► Consultar ENG-10 por diagnósticos similares anteriores
                        └─► Montar sessão com: contexto, hipóteses iniciais, casos similares
                            └─► Notificar responsável (ENG-03: alerta.diagnostico_aberto)
                                └─► Emitir diagnostico.aberto

[2] CONDUÇÃO DO DIAGNÓSTICO (responsável humano + assistência do sistema)
│
└─► Responsável acessa sessão de diagnóstico
    └─► Sistema apresenta: contexto coletado, hipóteses iniciais, casos similares
        └─► Responsável avalia cada hipótese:
            ├─► Confirmada → registrar evidência
            └─► Descartada → registrar motivo
            └─► Executa framework (5 Whys ou Ishikawa)
                └─► Identifica: sintoma → causa imediata → causa raiz
                    └─► Classifica causa raiz em categoria padronizada
                        └─► Registra nível de confiança (alto/médio/baixo/hipotético)

[3] CONCLUSÃO DO DIAGNÓSTICO
│
└─► Responsável submete diagnóstico como concluído
    └─► ENG-04 valida: causa raiz preenchida? evidência presente? categoria definida?
        ├─► Válido → salvar sessao com status = concluido
        │   └─► Emitir diagnostico.causa_raiz_identificada
        │       └─► ENG-05 recebe e prepara criação de plano de ação
        │           └─► ENG-10 recebe para indexar na base de conhecimento
        │
        └─► Inválido → retornar campos obrigatórios faltantes; sessão permanece em_andamento

[4] TIMEOUT (sessão não concluída no prazo)
│
└─► Scheduler verifica sessões abertas há >5 dias úteis
    └─► Emitir alerta.diagnostico_vencido para ENG-03
        └─► ENG-03 escala alerta para gerente/liderança
```

---

## 9. Eventos que Dispara

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `diagnostico.aberto` | Sessão criada | `{sessao_id, alerta_id, modulo, kpi, responsavel}` |
| `diagnostico.contexto_coletado` | Coleta automática concluída | `{sessao_id, dados_resumo}` |
| `diagnostico.hipotese_confirmada` | Hipótese marcada como confirmada | `{sessao_id, hipotese, evidencia}` |
| `diagnostico.causa_raiz_identificada` | Sessão concluída com causa | `{sessao_id, causa_raiz, categoria, confianca}` |
| `diagnostico.vencido` | Sessão sem conclusão no prazo | `{sessao_id, dias_aberta, responsavel}` |
| `diagnostico.padrao_detectado` | Mesma causa raiz em >3 sessões em 90 dias | `{causa_raiz, categoria, frequencia, modulos_afetados}` — para ENG-09 |

---

## 10. Eventos que Consome

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `alerta.criado` (requer_diagnostico = true) | ENG-03 | Abrir sessão de diagnóstico automaticamente |
| `kpi.calculado` | ENG-02 | Atualizar contexto de sessões abertas com novo valor |
| `ia.hipoteses_geradas` | ENG-10 | Adicionar hipóteses sugeridas pela IA à sessão |
| `ia.casos_similares_encontrados` | ENG-10 | Apresentar casos similares ao responsável |
| `diagnostico.causa_raiz_identificada` | ENG-04 (self) | Verificar se há padrão acumulado → emitir padrao_detectado |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação da especificação da ENG-04 |
