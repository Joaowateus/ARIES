---
id: MOD-CAP-01
titulo: "CAP-01 — Inteligência de Mercado"
versao: "2.0.0"
status: aprovado
categoria: Commercial-OS-Module
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-29
dependencias:
  - ARC-ENG-000
  - ARC-ENG-001
  - ARC-ENG-002
  - ARC-ENG-003
  - ARC-ENG-004
  - ARC-ENG-005
  - ARC-ENG-006
  - ARC-ENG-009
  - ARC-ENG-010
tags: [commercial-os, cap-01, market-intelligence, icp, segmentacao, win-loss, inteligencia-competitiva]
---

# CAP-01 — Inteligência de Mercado

> **Módulo do Commercial Operating System**
> Infraestrutura compartilhada: `docs/02-architecture/engine-autogestao/`
> Contrato de integração: `ENGINE-CONTRATO-DE-INTEGRACAO.md` (ARC-ENG-099)

---

## 1. Identificação

| Campo | Valor |
|-------|-------|
| **ID do Módulo** | CAP-01 |
| **Nome** | Inteligência de Mercado |
| **Domínio** | Epistêmico — Fundação do Commercial OS |
| **Versão** | 2.0.0 |
| **Tier** | Core — obrigatório para todos os demais módulos |
| **Posição na cadeia** | Upstream de todos os módulos comerciais |
| **Registro na Engine** | `ENGINE-REGISTRATION.yaml` (seção 16) |

---

## 2. Objetivo

Prover ao Commercial OS a **base de conhecimento de mercado** necessária para que todos os outros módulos operem com precisão estratégica. O CAP-01 é a camada epistêmica do sistema: ele define quem é o cliente ideal, como o mercado está segmentado, o que a concorrência faz, por que negócios são ganhos ou perdidos, e quais sinais de mercado devem alterar o comportamento dos demais módulos.

Sem o CAP-01, os outros módulos operam no escuro — gerando leads sem critério de qualidade, vendendo para perfis inadequados, precificando sem referência competitiva e perdendo negócios por razões que nunca foram compreendidas.

**O CAP-01 não vende. Ele garante que o sistema saiba para quem, como e por quê vender.**

---

## 3. Escopo

### 3.1 Dentro do Escopo
- Definição, versionamento e publicação do Perfil de Cliente Ideal (ICP)
- Definição e manutenção da segmentação de mercado (segmentos, verticais, personas)
- Coleta, análise e síntese de inteligência competitiva
- Execução do protocolo de análise Win/Loss em oportunidades encerradas
- Identificação e processamento de sinais de mercado (mudanças regulatórias, tecnológicas, competitivas)
- Manutenção do catálogo de perguntas de qualificação por segmento
- Calibração periódica do ICP com base em dados reais de resultado

### 3.2 Fora do Escopo
- Geração de leads → CAP-02
- Qualificação individual de leads → CAP-02
- Definição de preços → CAP-06
- Definição da oferta de produtos/serviços → CAP-06
- Onboarding e retenção de clientes → CAP-05
- Análise de performance de vendedores → CAP-07

---

## 4. Responsabilidades

| # | Responsabilidade | Frequência |
|---|-----------------|-----------|
| R-01 | Manter o ICP atualizado com critérios objetivos e mensuráveis | Revisão trimestral obrigatória |
| R-02 | Publicar `mercado.icp.atualizado` sempre que o ICP mudar | Por mudança |
| R-03 | Executar análise Win/Loss em 100% das oportunidades encerradas | Por evento de encerramento |
| R-04 | Manter o mapa competitivo com pelo menos 3 concorrentes monitorados | Contínuo |
| R-05 | Manter segmentação de mercado com critérios de entrada/saída explícitos | Revisão semestral |
| R-06 | Identificar padrões de Win/Loss e publicar insights para ENG-10 | Mensal |
| R-07 | Calibrar perguntas de qualificação com base nos padrões aprendidos | Trimestral |
| R-08 | Responder a sinais de mercado com atualização de posicionamento | Por sinal detectado |
| R-09 | Manter o scoring model do ICP com pesos validados empiricamente | Revisão semestral |

---

## 5. Capacidades Internas

### CAP-01.1 — Gestão do ICP (Ideal Customer Profile)

O ICP é a especificação formal do cliente para o qual o Commercial OS está otimizado. Ele opera como um **contrato epistêmico** que todos os módulos devem respeitar.

**Estrutura do ICP:**
```yaml
icp_definition:
  versao: "3.1.0"
  valido_a_partir: "2026-07-01"

  criterios_firmograficos:
    - dimensao: "porte_empresa"
      operador: "entre"
      valores: ["50_funcionarios", "500_funcionarios"]
      peso: 0.25
    - dimensao: "setor"
      operador: "in"
      valores: ["manufatura", "distribuicao", "varejo_b2b", "servicos_profissionais"]
      peso: 0.20
    - dimensao: "faturamento_anual"
      operador: "maior_que"
      valor: "R$5.000.000"
      peso: 0.20
    - dimensao: "maturidade_comercial"
      operador: "minimo"
      valor: "equipe_comercial_dedicada"
      peso: 0.15

  criterios_comportamentais:
    - dimensao: "dor_principal"
      valores: ["previsibilidade_receita", "controle_funil", "eficiencia_time_comercial"]
      peso: 0.10
    - dimensao: "ciclo_decisao"
      operador: "menor_que"
      valor: "90_dias"
      peso: 0.10

  scoring:
    formula: "soma_ponderada(criterios)"
    escala: "0_a_10"
    limiares:
      icp_forte: ">= 7.5"
      icp_adequado: ">= 5.0"
      fora_do_icp: "< 5.0"

  exclusoes_absolutas:
    - "startups com menos de 12 meses de operação"
    - "empresas com processo judicial relevante em andamento"

  fonte_de_calibracao: "analise_win_loss_ultimos_90_dias"
  ultima_calibracao: "2026-06-15"
  proxima_revisao: "2026-09-15"
```

### CAP-01.2 — Segmentação de Mercado

Mantém a taxonomia de segmentos que estrutura todas as análises do Commercial OS.

**Estrutura de segmento:**
```yaml
segmento_definition:
  id: "SEG-001"
  nome: "Identificador do segmento"
  criterios_entrada:
    - "dimensão: operador: valor"
  proposta_de_valor_principal: "benefício central para este segmento"
  personas_compradoras:
    - id: "PERSONA-ID"
      titulo: "Título do comprador"
      dores_principais: []
      gatilhos_de_compra: []
  perguntas_de_qualificacao: []
  objecoes_comuns:
    - objecao: "texto da objeção"
      resposta_posicionamento: "como responder"
  kpis_benchmark:
    win_rate_esperado: null
    ciclo_medio_dias: null
    ticket_medio: null
```

### CAP-01.3 — Protocolo de Análise Win/Loss

Análise estruturada de **todas** as oportunidades encerradas — ganhas e perdidas.

**Ciclo de vida:**
```
OPORTUNIDADE_ENCERRADA → PENDENTE_ANALISE → EM_ANALISE → ANALISADA → INSIGHTS_PUBLICADOS
                                                               ↓
                                                   DESCARTADA (dados insuficientes — registrar motivo)
```

**Estrutura da análise:**
```yaml
win_loss_analysis:
  oportunidade_id: "OPP-ID"
  resultado: "won | lost"
  segmento_id: "SEG-ID"
  valor_estimado: 0
  ciclo_dias: 0

  razao_primaria: "categoria principal"
  razao_secundaria: "categoria secundária"
  razao_terciaria: "categoria terciária"
  concorrente_vencedor: null  # se lost

  fatores_negativos: []
  fatores_positivos: []
  sinais_de_alerta_ignorados: []
  aprendizados: []

  ia_sugestao_json: {}        # sugestão da ENG-10 — requer validação humana
  validado_por: "responsável"
  fonte_evento: "oportunidade.encerrada"
```

### CAP-01.4 — Inteligência Competitiva

Mapa estruturado dos concorrentes relevantes com atualização contínua.

```yaml
competitive_map:
  concorrente_id: "COMP-ID"
  nome: "Nome do concorrente"
  tier: "direto | indireto | substituto | entrante"
  posicionamento: "como se posiciona no mercado"
  preco_referencia: "faixa de preço"
  pontos_fortes: []
  pontos_fracos: []
  como_vencer: []
  win_rate_contra: null       # calculado a partir do Win/Loss
  ultima_atualizacao: "data"
  fonte_ultima_atualizacao: "win_loss | pesquisa | cliente | outra"
```

### CAP-01.5 — Monitoramento de Sinais de Mercado

| Tipo | Exemplos | Impacto no Sistema |
|------|---------|-------------------|
| Regulatório | Nova legislação, norma setorial | ICP exclusion, proposta de valor |
| Tecnológico | Novo concorrente com IA, automação | Mapa competitivo, posicionamento |
| Econômico | Crise setorial, câmbio, juros | Segmento prioridade, pricing |
| Competitivo | Concorrente lança produto, faz M&A | Battlecard, objeções |
| Comportamental | Mudança no processo de compra B2B | Perguntas qualificação, ciclo |

---

## 6. Fluxo Operacional

```
[FLUXO A — CICLO DE VIDA DO ICP]

[TRIGGER: trimestral obrigatório OU sinal de mercado crítico OU queda de KPI]
│
├─► Coletar dados para calibração (via ENG-10 + ENG-02):
│   ├─ Win Rate dos últimos 90 dias por perfil de cliente
│   ├─ NRR por tier de ICP (via CAP-04 → ENG-02)
│   ├─ Health Score médio por ICP tier (via CAP-05 → ENG-02)
│   └─ Churn Rate por perfil de cliente (via CAP-05 → ENG-02)
│
├─► Análise: quais características dos clientes ganhos/retidos diferem
│   dos perdidos/churned? → Ajustar pesos dos critérios
│
├─► Propor nova versão do ICP (mantendo histórico — imutabilidade ENG-01)
│
├─► Aprovação: responsável do módulo CAP-01 → DECISION_LOG (ENG-09)
│
└─► Publicar: mercado.icp.atualizado
    ├─► CAP-02 recalibra critérios de qualificação
    ├─► CAP-06 revisa posicionamento de preço por segmento
    └─► ENG-10 indexa nova versão como conhecimento institucional


[FLUXO B — ANÁLISE WIN/LOSS]

[TRIGGER: oportunidade.encerrada recebido de CAP-03]
│
├─► Criar instância de análise (status: pendente_analise) via ENG-01
│
├─► Coletar dados automaticamente (ENG-07 + ENG-08 → CONN-CRM-PRINCIPAL):
│   ├─ Dados da oportunidade (payload do evento recebido)
│   ├─ Histórico de interações no CRM
│   ├─ Estágio em que encerrou e por quê
│   └─ Concorrentes mencionados durante o ciclo
│
├─► ENG-10 sugere: razão provável, padrões similares a casos anteriores
│
├─► Responsável valida/complementa análise (formulário estruturado)
│
├─► Atualizar métricas (ENG-02):
│   ├─ KPI-MI-01 (cobertura)
│   ├─ KPI-MI-02/03 (win rate geral e por segmento)
│   └─ KPI-MI-04 (win rate vs. concorrente)
│
├─► Se padrão detectado (3+ ocorrências iguais):
│   └─► Publicar: mercado.analise_resultado.padrao_identificado → ENG-09
│
└─► Publicar: mercado.analise_resultado.registrada


[FLUXO C — DETECÇÃO DE SINAL DE MERCADO]

[TRIGGER: entrada manual OU fonte automatizada (feed de notícias, alerta)]
│
├─► Classificar: tipo, urgência, segmentos impactados
│
├─► Avaliar impacto em: ICP, segmentação, posicionamento, mapa competitivo
│
├─► Se impacto alto ou crítico:
│   ├─► Criar alerta via ENG-03
│   └─► Publicar: mercado.sinal.detectado
│
└─► Registrar sinal na base de conhecimento (ENG-10)
```

---

## 7. Estados

### 7.1 Estados do ICP
```
RASCUNHO → EM_REVISAO → APROVADO → ATIVO
                                     ↓
                              DESCONTINUADO (ao ser substituído por versão nova)
                              (versão anterior arquivada — nunca deletada)
```

### 7.2 Estados da Análise Win/Loss
```
PENDENTE_ANALISE → EM_ANALISE → ANALISADA → INSIGHTS_PUBLICADOS
                                    ↓
                             DESCARTADA (dados insuficientes — motivo registrado)
```

### 7.3 Estados do Segmento de Mercado
```
PROPOSTO → VALIDADO → ATIVO → EM_REVISAO → DESCONTINUADO
```

### 7.4 Estados do Concorrente
```
ATIVO → DESATUALIZADO (> 180 dias sem atualização) → MONITORAMENTO_REDUZIDO | DESCONTINUADO
```

---

## 8. Regras de Negócio

### RN-01 — ICP com Critérios Objetivos e Mensuráveis
Todo critério do ICP DEVE ser expresso com: dimensão + operador + valor(es) + peso. Critérios subjetivos sem operacionalização mensurável são proibidos. Um ICP não operacionalizável é equivalente a não ter ICP.

### RN-02 — Versionamento Obrigatório do ICP
Cada alteração no ICP gera nova versão semântica (major.minor.patch). A versão anterior é arquivada, nunca deletada. Módulos dependentes devem referenciar a versão utilizada até concluírem migração para a nova versão.

### RN-03 — Cobertura de 100% das Análises Win/Loss
Toda oportunidade encerrada — ganha ou perdida — DEVE passar pelo protocolo de Win/Loss. A taxa de cobertura é KPI primário deste módulo. Oportunidades sem análise em até 10 dias úteis após encerramento geram alerta automático.

### RN-04 — ICP Calibrado por Dados, Não por Opinião
A revisão trimestral DEVE ser fundamentada em dados dos últimos 90 dias (Win Rate, NRR, Churn por perfil). Ajustes sem evidência requerem aprovação e registro no DECISION_LOG (ENG-09).

### RN-05 — Mínimo de 3 Concorrentes Ativos no Mapa Competitivo
O módulo DEVE manter pelo menos 3 concorrentes com informações atualizadas (últimos 6 meses). Concorrente sem atualização há mais de 6 meses entra em status `desatualizado` e gera alerta.

### RN-06 — ICP É Contrato, Não Recomendação
O ICP não é sugestão. É o contrato operacional que define comportamento de CAP-02, CAP-03, CAP-06 e CAP-09. Desvios do ICP requerem aprovação explícita e registro no DECISION_LOG.

### RN-07 — Separação Obrigatória entre ICP e Persona
ICP define a organização (firmografia, comportamento, maturidade). Persona define o comprador individual dentro dessa organização. Os dois coexistem mas não são intercambiáveis. Um ICP pode ter múltiplas personas.

### RN-08 — Win/Loss Não Nomeia Indivíduos como Causa de Perda
O protocolo identifica causas sistêmicas, processuais e estruturais. Nunca nomeia indivíduos como responsáveis por perdas. (Princípio de segurança psicológica — RG-06 da ENG-09.)

### RN-09 — Sinal de Mercado Requer Avaliação de Impacto Declarada
Todo sinal registrado DEVE ter avaliação de impacto: qual elemento é afetado (ICP, segmentação, mapa competitivo, perguntas de qualificação) e urgência de revisão (imediata / próxima revisão programada / monitorar).

---

## 9. Eventos Publicados

| Evento | Quando | Payload Principal |
|--------|--------|-----------------|
| `mercado.icp.atualizado` | Nova versão de ICP aprovada e ativada | `{icp_versao_nova, icp_versao_anterior, criterios_alterados[], segmentos_impactados[]}` |
| `mercado.icp.revisao_solicitada` | Gatilho de revisão disparado | `{motivo, prazo_conclusao, dados_contexto_json}` |
| `mercado.segmento.atualizado` | Segmento criado, alterado ou descontinuado | `{segmento_id, acao: criado\|alterado\|descontinuado, diferencas_json}` |
| `mercado.analise_resultado.registrada` | Análise de oportunidade concluída | `{oportunidade_id, resultado: won\|lost, razao_primaria, segmento_id, concorrente_vencedor?}` |
| `mercado.analise_resultado.padrao_identificado` | Padrão recorrente detectado (≥ 3×) | `{padrao_tipo, frequencia, segmentos_afetados[], recomendacao}` |
| `mercado.competidor.atualizado` | Dado de concorrente atualizado | `{concorrente_id, campos_alterados[], nova_ameaca: boolean}` |
| `mercado.sinal.detectado` | Sinal de mercado avaliado | `{sinal_tipo, urgencia: baixa\|media\|alta\|critica, elementos_impactados[], descricao}` |
| `mercado.qualificacao.criterios_atualizados` | Perguntas de qualificação revisadas | `{segmento_id, criterios_anteriores, criterios_novos, motivo}` |

---

## 10. Eventos Consumidos

| Evento | Origem | Ação ao Receber |
|--------|--------|----------------|
| `oportunidade.encerrada` | CAP-03 | Criar instância de análise Win/Loss |
| `cliente.cancelamento.confirmado` | CAP-05 | Criar análise Win/Loss retroativa; atualizar perfil de risco do segmento |
| `cliente.expandido` | CAP-05 | Registrar como dado de calibração positiva do ICP |
| `kpi.limiar.cruzado` | ENG-02 | Se KPI é `KPI-MI-02` ou `KPI-MI-08`: avaliar revisão antecipada do ICP |
| `melhoria.item.implementado` | ENG-09 | Se melhoria afeta CAP-01: revisar elementos impactados |
| `sistema.periodo_encerrado` | Scheduler | Calcular KPIs e iniciar revisão trimestral do ICP |

---

## 11. KPIs

> Registrados e calculados via ENG-02. Definições completas no ENGINE-REGISTRATION.yaml (seção 16).

| ID | Nome | Fórmula | Meta | Frequência |
|----|------|---------|------|-----------|
| KPI-MI-01 | Taxa de Cobertura Win/Loss | `análises_concluídas / oportunidades_encerradas × 100` | ≥ 95% | Mensal |
| KPI-MI-02 | Win Rate Geral | `oportunidades_ganhas / oportunidades_encerradas × 100` | Baseline por segmento | Mensal |
| KPI-MI-03 | Win Rate por Segmento | `ganhas_seg / encerradas_seg × 100` | Definido por segmento | Mensal |
| KPI-MI-04 | Win Rate por Concorrente | `ganhas_vs_comp / total_vs_comp × 100` | ≥ 50% vs. cada direto | Mensal |
| KPI-MI-05 | Precisão do ICP Score | `clientes_high_icp_sucesso / total_high_icp × 100` | ≥ 80% | Trimestral |
| KPI-MI-06 | Tempo Médio de Análise Win/Loss | `média(conclusão - criação)` | ≤ 5 dias úteis | Mensal |
| KPI-MI-07 | Freshness do Mapa Competitivo | `concorrentes_atualizados_6m / total × 100` | 100% | Mensal |
| KPI-MI-08 | Aderência ao ICP no Pipeline | `oportunidades_icp_adequado / total_pipeline × 100` | ≥ 70% | Semanal |
| KPI-MI-09 | NRR por Tier de ICP | `NRR_high_icp vs NRR_low_icp` | High ICP > Low ICP | Trimestral |

---

## 12. Alertas

> Gerenciados pela ENG-03.

| ID | Condição | Severidade | Ação Padrão |
|----|---------|-----------|------------|
| ALT-MI-01 | KPI-MI-01 < 80% | WARNING | Notificar responsável; listar pendências |
| ALT-MI-02 | KPI-MI-01 < 60% | CRITICAL | Escalar para gestor; bloquear fechamento do período |
| ALT-MI-03 | Análise Win/Loss pendente > 10 dias úteis | WARNING | Notificar analista; criar tarefa com prazo |
| ALT-MI-04 | Win Rate cai > 15pp vs. trimestre anterior | CRITICAL | Disparar diagnóstico automático (ENG-04) |
| ALT-MI-05 | Win Rate vs. concorrente específico < 30% | WARNING | Solicitar atualização do battlecard |
| ALT-MI-06 | ICP não revisado há > 120 dias | WARNING | Notificar responsável; criar agenda de revisão |
| ALT-MI-07 | Concorrente sem atualização > 180 dias | WARNING | Solicitar pesquisa competitiva |
| ALT-MI-08 | Aderência ao ICP no pipeline < 50% | CRITICAL | Notificar CAP-02; revisar critérios de qualificação |
| ALT-MI-09 | Padrão Win/Loss recorrente detectado (≥ 3×) | WARNING | Publicar `mercado.analise_resultado.padrao_identificado`; criar item em ENG-09 |

---

## 13. Planos de Ação Automáticos

> Executados via ENG-05.

### PA-MI-01 — Queda de Win Rate (Gatilho: ALT-MI-04)
```yaml
plano_acao:
  tipo: diagnostico_e_correcao
  prazo_dias: 30
  tarefas:
    - "ENG-04: coletar Win/Loss dos últimos 60 dias e identificar concentração"
    - "Analisar: queda é generalizada ou concentrada em segmento/concorrente específico?"
    - "Se concentrada em concorrente: atualizar battlecard; publicar mercado.competidor.atualizado"
    - "Se generalizada: revisar perguntas de qualificação e critérios de avanço de funil (CAP-03)"
    - "Se associada a mudança recente de ICP: avaliar se calibração foi prematura"
  metrica_sucesso: "Win Rate retorna ao baseline em 60 dias"
```

### PA-MI-02 — Cobertura Win/Loss Baixa (Gatilho: ALT-MI-02)
```yaml
plano_acao:
  tipo: correcao_operacional
  prazo_dias: 15
  tarefas:
    - "Listar todas as oportunidades encerradas sem análise"
    - "Notificar responsáveis com prazo de 5 dias úteis por oportunidade"
    - "Verificar se workflow WF-MI-01 está disparando corretamente para oportunidade.encerrada"
    - "Se falha sistêmica: abrir NC na ENG-06; acionar ENG-08 para diagnóstico do conector CRM"
  metrica_sucesso: "Cobertura ≥ 90% até fim do mês"
```

### PA-MI-03 — ICP Desatualizado (Gatilho: ALT-MI-06)
```yaml
plano_acao:
  tipo: revisao_programada
  prazo_dias: 20
  tarefas:
    - "Extrair: Win Rate, NRR, Churn dos últimos 90 dias por perfil de cliente (ENG-02)"
    - "Convocar sessão de revisão do ICP com stakeholders"
    - "Conduzir análise: critérios atuais predizem sucesso ou precisam ajuste?"
    - "Publicar nova versão OU confirmar versão atual como válida (registrar no DECISION_LOG)"
  metrica_sucesso: "ICP revisado e publicado com evidências documentadas"
```

---

## 14. Automações

> Executadas via ENG-07 (Workflows) + ENG-08 (Conectores).

| ID | Trigger | Ação Automatizada | Conector |
|----|---------|-----------------|---------|
| AUT-MI-01 | `oportunidade.encerrada` | Criar instância Win/Loss; coletar dados do CRM | CONN-CRM-PRINCIPAL |
| AUT-MI-02 | Análise Win/Loss pendente > 5 dias | Enviar lembrete ao responsável | CONN-MENSAGERIA |
| AUT-MI-03 | `sistema.periodo_encerrado` (trimestral) | Gerar relatório Win Rate por segmento/concorrente | CONN-EMAIL-TRANSACIONAL |
| AUT-MI-04 | `mercado.icp.atualizado` publicado | Notificar módulos dependentes; atualizar scoring no CRM | CONN-CRM-PRINCIPAL, CONN-MENSAGERIA |
| AUT-MI-05 | Padrão Win/Loss detectado (≥ 3 ocorrências iguais) | Publicar `mercado.analise_resultado.padrao_identificado`; criar item ENG-09 | Barramento SOE |
| AUT-MI-06 | `sistema.periodo_encerrado` (mensal) | Calcular KPI-MI-01 a KPI-MI-09; publicar para ENG-02 | ENG-02 |

---

## 15. Auditoria Operacional

> Executada via ENG-06.

### Checklist Mensal — CAP-01-AUD-MENSAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | ICP revisado nos últimos 90 dias | `icp_definitions.ultima_revisao` | Data ≤ 90 dias |
| 2 | Cobertura Win/Loss ≥ 95% | KPI-MI-01 | Valor do KPI |
| 3 | Análises Win/Loss concluídas em ≤ 5 dias úteis | KPI-MI-06 | Valor do KPI |
| 4 | Mapa competitivo: todos os concorrentes atualizados nos últimos 6 meses | KPI-MI-07 | 100% de freshness |
| 5 | Padrões Win/Loss encaminhados para ENG-09 | Log de eventos `mercado.analise_resultado.padrao_identificado` | Registro no período |
| 6 | Alertas do mês tratados dentro do SLA da ENG-03 | Taxa de resolução | ≥ 90% no SLA |

### Checklist Trimestral — CAP-01-AUD-TRIMESTRAL

| # | Item | Método | Evidência Esperada |
|---|------|--------|-------------------|
| 1 | Revisão do ICP concluída com base em dados | Ata de revisão + versão publicada | Documento de revisão com dados |
| 2 | Segmentação revisada | Datas de atualização dos segmentos | ≤ 180 dias |
| 3 | Win Rate por segmento calculado e comunicado | KPI-MI-03 publicado | Relatório trimestral |
| 4 | Perguntas de qualificação alinhadas ao ICP atual | Versão do catálogo de qualificação | Documento atualizado |
| 5 | Relatório de inteligência competitiva emitido | Verificar relatório do período | Relatório datado |

---

## 16. ENGINE-REGISTRATION.yaml

```yaml
# ENGINE-REGISTRATION.yaml — CAP-01 Inteligência de Mercado
# Ref: ARC-ENG-099 (ENGINE-CONTRATO-DE-INTEGRACAO.md)

modulo:
  id: "CAP-01"
  nome: "Inteligência de Mercado"
  versao: "2.0.0"
  tier: "core"
  status: "ativo"

dependencias:
  engines:
    - id: "ENG-01"
      uso: "rastreamento de instâncias de análise Win/Loss e revisões de ICP"
    - id: "ENG-02"
      uso: "registro e cálculo de KPIs KPI-MI-01 a KPI-MI-09"
    - id: "ENG-03"
      uso: "gestão de alertas ALT-MI-01 a ALT-MI-09"
    - id: "ENG-04"
      uso: "diagnóstico de queda de win rate e padrões sistêmicos"
    - id: "ENG-05"
      uso: "execução de planos de ação PA-MI-01 a PA-MI-03"
    - id: "ENG-06"
      uso: "auditoria mensal e trimestral do módulo"
    - id: "ENG-07"
      uso: "workflows AUT-MI-01 a AUT-MI-06"
    - id: "ENG-08"
      uso: "integração com CRM para coleta de dados de oportunidades"
    - id: "ENG-09"
      uso: "encaminhamento de padrões aprendidos para melhoria contínua"
    - id: "ENG-10"
      uso: "indexação de Win/Loss, ICP e inteligência competitiva"

eventos_publicados:
  - evento: "mercado.icp.atualizado"
    condicao: "nova versão de ICP aprovada e ativada"
  - evento: "mercado.icp.revisao_solicitada"
    condicao: "gatilho trimestral ou manual"
  - evento: "mercado.segmento.atualizado"
    condicao: "segmento criado, alterado ou descontinuado"
  - evento: "mercado.analise_resultado.registrada"
    condicao: "análise Win/Loss concluída"
  - evento: "mercado.analise_resultado.padrao_identificado"
    condicao: "padrão detectado em 3+ análises"
  - evento: "mercado.competidor.atualizado"
    condicao: "dados de concorrente alterados"
  - evento: "mercado.sinal.detectado"
    condicao: "sinal de mercado registrado e avaliado"
  - evento: "mercado.qualificacao.criterios_atualizados"
    condicao: "critérios de qualificação revisados"

eventos_consumidos:
  - evento: "oportunidade.encerrada"
    origem: "CAP-03"
    acao: "iniciar protocolo Win/Loss"
  - evento: "cliente.cancelamento.confirmado"
    origem: "CAP-05"
    acao: "análise Win/Loss retroativa; atualizar perfil de risco"
  - evento: "cliente.expandido"
    origem: "CAP-05"
    acao: "calibração positiva do ICP"
  - evento: "kpi.limiar.cruzado"
    origem: "ENG-02"
    acao: "avaliar revisão antecipada do ICP se KPI-MI-02 ou KPI-MI-08"
  - evento: "melhoria.item.implementado"
    origem: "ENG-09"
    acao: "revisar elementos afetados do módulo"
  - evento: "sistema.periodo_encerrado"
    origem: "Scheduler"
    acao: "calcular KPIs e preparar revisão trimestral do ICP"

kpis_registrados:
  - id: "KPI-MI-01"
    nome: "Taxa de Cobertura Win/Loss"
    formula: "analises_concluidas / oportunidades_encerradas * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 95
    limiar_warning: 80
    limiar_critical: 60
  - id: "KPI-MI-02"
    nome: "Win Rate Geral"
    formula: "oportunidades_ganhas / oportunidades_encerradas * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: null
    meta_nota: "baseline histórico por segmento"
    limiar_warning: "queda_15pp_trimestre_anterior"
  - id: "KPI-MI-03"
    nome: "Win Rate por Segmento"
    formula: "ganhas_segmento / encerradas_segmento * 100"
    unidade: "percentual"
    dimensao: "segmento_id"
    frequencia_calculo: "mensal"
  - id: "KPI-MI-04"
    nome: "Win Rate por Concorrente"
    formula: "ganhas_vs_concorrente / total_vs_concorrente * 100"
    unidade: "percentual"
    dimensao: "concorrente_id"
    frequencia_calculo: "mensal"
    limiar_warning: 30
  - id: "KPI-MI-05"
    nome: "Precisão do ICP Score"
    formula: "clientes_high_icp_com_sucesso / total_clientes_high_icp * 100"
    unidade: "percentual"
    frequencia_calculo: "trimestral"
    meta_padrao: 80
  - id: "KPI-MI-06"
    nome: "Tempo Médio de Análise Win/Loss"
    formula: "media(data_conclusao - data_criacao)"
    unidade: "dias_uteis"
    frequencia_calculo: "mensal"
    meta_padrao: 5
    limiar_warning: 7
    limiar_critical: 10
  - id: "KPI-MI-07"
    nome: "Freshness do Mapa Competitivo"
    formula: "concorrentes_atualizados_6m / total_concorrentes * 100"
    unidade: "percentual"
    frequencia_calculo: "mensal"
    meta_padrao: 100
    limiar_warning: 80
  - id: "KPI-MI-08"
    nome: "Aderência ao ICP no Pipeline"
    formula: "oportunidades_icp_adequado / total_oportunidades * 100"
    unidade: "percentual"
    frequencia_calculo: "semanal"
    meta_padrao: 70
    limiar_warning: 60
    limiar_critical: 50
  - id: "KPI-MI-09"
    nome: "NRR por Tier de ICP"
    formula: "nrr_high_icp comparado a nrr_low_icp"
    unidade: "comparativo"
    frequencia_calculo: "trimestral"

alertas_registrados:
  - id: "ALT-MI-01"
    kpi_ref: "KPI-MI-01"
    condicao: "< 80"
    severidade: "warning"
    owner: "responsavel_cap01"
  - id: "ALT-MI-02"
    kpi_ref: "KPI-MI-01"
    condicao: "< 60"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-MI-03"
    condicao: "analise_win_loss.dias_pendente > 10"
    severidade: "warning"
    owner: "responsavel_cap01"
  - id: "ALT-MI-04"
    kpi_ref: "KPI-MI-02"
    condicao: "variacao_vs_trimestre_anterior < -15pp"
    severidade: "critical"
    owner: "gestor_comercial"
    acao_automatica: "disparar_diagnostico_eng04"
  - id: "ALT-MI-05"
    kpi_ref: "KPI-MI-04"
    condicao: "< 30 para qualquer concorrente_id"
    severidade: "warning"
    owner: "responsavel_cap01"
  - id: "ALT-MI-06"
    condicao: "icp.dias_sem_revisao > 120"
    severidade: "warning"
    owner: "responsavel_cap01"
  - id: "ALT-MI-07"
    condicao: "competidor.dias_sem_atualizacao > 180"
    severidade: "warning"
    owner: "responsavel_cap01"
  - id: "ALT-MI-08"
    kpi_ref: "KPI-MI-08"
    condicao: "< 50"
    severidade: "critical"
    owner: "gestor_comercial"
  - id: "ALT-MI-09"
    condicao: "padrao_win_loss.ocorrencias >= 3"
    severidade: "warning"
    owner: "responsavel_cap01"
    acao_automatica: "publicar_padrao_identificado"

workflows_registrados:
  - id: "WF-MI-01"
    nome: "Análise Win/Loss Automática"
    gatilho: "oportunidade.encerrada"
    descricao: "coleta dados CRM, cria instância, agenda análise, envia lembrete se pendente"
  - id: "WF-MI-02"
    nome: "Revisão Trimestral do ICP"
    gatilho: "sistema.periodo_encerrado (trimestral)"
    descricao: "coleta dados de calibração, gera relatório, agenda sessão de revisão"
  - id: "WF-MI-03"
    nome: "Propagação de ICP Atualizado"
    gatilho: "mercado.icp.atualizado"
    descricao: "notifica módulos dependentes, atualiza CRM, registra no ENG-10"

auditoria_checklists:
  - id: "CAP-01-AUD-MENSAL"
    tipo: "mensal"
    itens_count: 6
  - id: "CAP-01-AUD-TRIMESTRAL"
    tipo: "trimestral"
    itens_count: 5

conectores_utilizados:
  - "CONN-CRM-PRINCIPAL"
  - "CONN-MENSAGERIA"
  - "CONN-EMAIL-TRANSACIONAL"

permissoes_necessarias:
  - recurso: "icp_definitions"
    acoes: ["read", "write", "version"]
  - recurso: "win_loss_analyses"
    acoes: ["read", "write"]
  - recurso: "competitive_map"
    acoes: ["read", "write"]
  - recurso: "segment_definitions"
    acoes: ["read", "write"]
  - recurso: "qualification_catalog"
    acoes: ["read", "write"]
  - recurso: "kpi_values.KPI-MI-*"
    acoes: ["read", "write_via_eng02"]
  - recurso: "eventos_barramento"
    acoes: ["publish", "subscribe"]
```

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do módulo operacional |
| 2.0.0 | 2026-06-29 | Guardião da Documentação | Redesenho como microserviço do Commercial OS — infraestrutura extraída para Engine de Autogestão, arquitetura orientada a eventos, 16 seções obrigatórias, ENGINE-REGISTRATION.yaml integrado |
