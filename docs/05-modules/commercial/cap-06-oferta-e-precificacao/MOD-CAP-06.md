---
id: MOD-CAP-06
titulo: "Módulo Operacional — Gestão de Oferta e Precificação"
versao: "1.0.0"
status: aprovado
categoria: C3-Operacional
autor: Guardião da Documentação Técnica
criado-em: 2026-06-28
atualizado-em: 2026-06-28
dependencias:
  - MOD-CAP-01
  - MOD-CAP-04
  - MOD-CAP-08
tags: [oferta, precificacao, portfolio, pricing, produtos, servicos, proposta-de-valor]
---

# MOD-CAP-06 — Gestão de Oferta e Precificação

---

## 1. Objetivo da Capacidade

Definir, estruturar, precificar e manter atualizado o portfólio de soluções da empresa de forma que cada oferta comunique valor claramente, seja precificada de forma lucrativa e competitiva, e permita ao time comercial vender com segurança — sem improvisação, sem subvenda e sem descontos desnecessários.

---

## 2. Resultado Esperado

| # | Resultado | Critério de Aceitação |
|---|-----------|----------------------|
| R1 | Portfólio documentado e acessível | 100% das soluções ativas com documentação completa no repositório oficial |
| R2 | Tabela de preços vigente e aprovada | Uma única tabela de preços oficial, aprovada pela liderança, usada por toda a equipe |
| R3 | Margens garantidas | Desconto médio concedido não supera limite que compromete a margem mínima definida |
| R4 | Proposta de valor por segmento documentada | Cada segmento de ICP tem uma proposta de valor específica e mensagem de posicionamento |
| R5 | Revisão periódica garantida | Precificação revisada pelo menos anualmente (ou por gatilho crítico) |

**Definição de Sucesso:** Qualquer vendedor consegue, sem improviso, apresentar qualquer solução com sua proposta de valor, seus critérios de inclusão/exclusão e sua política de preço — sem consultar o gestor.

---

## 3. Entradas Necessárias

### 3.1 Entradas Primárias
| Entrada | Fonte | Formato | Frequência |
|---------|-------|---------|-----------|
| Benchmarks competitivos de preço | CAP-01 (Inteligência Comercial) | Relatório | Trimestral |
| ARPU e ticket médio realizado | CAP-04 (Gestão de Receita) | Estruturado | Mensal |
| Win/loss por preço (objeções de preço) | CAP-03 (Processo de Vendas) + CAP-01 | CRM + análise | Mensal |
| Custo real de entrega das soluções | Operações / Financeiro | Estruturado | Trimestral |
| Feedback sobre adequação da oferta | CAP-05 (Gestão de Clientes) | Semiestruturado | Mensal |
| Metas de receita e ticket médio | CAP-08 (Performance) | Estruturado | Anual / revisão |

---

## 4. Saídas Obrigatórias

### 4.1 Documentos de Portfólio
| Saída | Destinatário | Periodicidade |
|-------|-------------|--------------|
| Documento de Portfólio de Soluções | Toda a equipe comercial | Por versão (atualização) |
| Tabela de Preços Oficial | Toda a equipe comercial | Por versão (aprovada pela liderança) |
| Política de Descontos | Equipe comercial + gerentes | Por versão |
| Proposta de Valor por Segmento | Equipe comercial + marketing | Por versão |
| Competitive Pricing Brief | CAP-01 + CAP-03 | Trimestral |

### 4.2 Dados para Outros Módulos
| Dado | Destinatário | Uso |
|------|-------------|-----|
| Limites de CPL por segmento | CAP-02 (Demanda) | Calibrar investimento por canal |
| Template de proposta comercial | CAP-03 (Vendas) | Base para elaboração de propostas |
| Limites de desconto por segmento | CAP-03 (Vendas) | Autonomia da equipe |

---

## 5. Regras de Negócio

### RN-01: Versão Única e Oficial
- DEVE existir apenas UMA versão oficial e vigente da tabela de preços em circulação
- Qualquer proposta ou contrato DEVE referenciar a versão vigente da tabela
- Versão anterior deve ser arquivada imediatamente após aprovação de nova versão

### RN-02: Aprovação de Precificação
- Mudanças na tabela de preços DEVEM ser aprovadas pela liderança antes de entrar em vigor
- Novos produtos ou soluções DEVEM ter sua precificação aprovada antes de qualquer venda
- Precificação de projetos especiais (fora do portfólio) DEVE seguir processo específico com aprovação formal

### RN-03: Política de Descontos
- Os limites de desconto (por nível de aprovação) DEVEM estar documentados e acessíveis à equipe
- Desconto NÃO PODE ser concedido abaixo do preço que compromete a margem mínima estabelecida
- Todo desconto concedido DEVE ser registrado no CRM com justificativa

### RN-04: Validade e Revisão
- A tabela de preços DEVE ser revisada pelo menos anualmente
- Gatilhos obrigatórios de revisão antecipada: inflação acima de [X]% no período, aumento de custos de entrega >15%, mudança competitiva significativa
- Clientes com contrato vigente têm preço garantido pelo período contratado (salvo cláusula de reajuste)

### RN-05: Documentação de Oferta
- Cada solução do portfólio DEVE ter documentado: descrição, entregáveis incluídos, exclusões, prazo médio, público-alvo (segmento do ICP), proposta de valor, preço e condições
- Solução sem documentação completa NÃO pode ser vendida ativamente

### RN-06: Margem Mínima
- A empresa DEVE ter definida (e documentada de forma confidencial) a margem mínima por linha de solução
- Proposta abaixo da margem mínima DEVE ser aprovada pela liderança e é uma exceção, não regra

---

## 6. Fluxo Operacional Completo

```
ENTRADA
│
├─► Demanda por nova solução (mercado, estratégia, feedback de clientes)
├─► Necessidade de revisão de preço (gatilho: custo, concorrência, meta)
└─► Solicitação de solução customizada (oportunidade específica)
│
▼
PROCESSAMENTO — Desenvolvimento de Oferta

Para NOVA SOLUÇÃO:
│
├─► Pesquisa de demanda: há mercado para essa solução? (CAP-01)
├─► Definição de escopo: o que está incluído / excluído?
├─► Cálculo de custo de entrega (operações + financeiro)
├─► Benchmark de preço do mercado (CAP-01)
├─► Definição de margem mínima e preço base
├─► Definição de proposta de valor por segmento
├─► Criação do documento de portfólio da nova solução
└─► Aprovação formal pela liderança
│
Para REVISÃO DE PRECIFICAÇÃO:
│
├─► Levantar dados: ARPU realizado, margem atual, objeções de preço, churn por preço
├─► Análise competitiva atualizada (CAP-01)
├─► Análise de elasticidade (histórico de objeções de preço vs. fechamento)
├─► Proposta de nova tabela com justificativa
└─► Aprovação formal pela liderança
│
▼
DECISÃO
│
├─► [Aprovada] → Publicar nova versão, arquivar versão anterior, comunicar equipe
└─► [Reprovada] → Revisar e reapresentar com ajustes
│
▼
DISTRIBUIÇÃO E COMUNICAÇÃO
│
├─► Nova versão publicada no repositório oficial (CRM + repositório de docs)
├─► Comunicado à equipe comercial com o que mudou
└─► Treinamento quando mudanças são significativas
│
▼
MONITORAMENTO (ciclo contínuo)
│
├─► Acompanhar ticket médio realizado vs. tabela (CAP-04)
├─► Acompanhar desconto médio (CAP-03)
├─► Acompanhar win/loss por preço (CAP-01)
├─► Verificar aderência ao portfólio (soluções sendo vendidas conforme documentado)
└─► Identificar gap de portfólio (demandas não atendidas pelas soluções existentes)
│
▼
REGISTRO
│
├─► Histórico de versões da tabela de preços preservado com DocSemVer
├─► Justificativas de revisão documentadas
└─► Descontos excepcionais registrados no CRM com aprovação anexada
│
▼
AUDITORIA
│
└─► Trimestral: competitividade do preço, aderência ao portfólio, margem realizada
```

---

## 7. Indicadores de Desempenho (KPIs)

### 7.1 KPIs de Portfólio
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-OP-01 | Cobertura do portfólio documentado | Soluções com doc completa / Total soluções ativas × 100 | 100% | Mensal |
| KPI-OP-02 | Aderência ao portfólio | Contratos dentro do portfólio oficial / Total contratos × 100 | ≥ 85% | Mensal |
| KPI-OP-03 | Tempo de aprovação de nova solução | Dias entre proposta e aprovação da liderança | ≤ [N] dias | Por evento |

### 7.2 KPIs de Precificação
| Código | Indicador | Fórmula | Meta | Frequência |
|--------|-----------|---------|------|-----------|
| KPI-OP-04 | Ticket médio por segmento | Receita por segmento / Nº de clientes por segmento | ≥ meta por segmento | Mensal |
| KPI-OP-05 | Desconto médio concedido | Soma de descontos / Soma do valor cheio × 100 | ≤ [X]% | Mensal |
| KPI-OP-06 | % de contratos com desconto acima do limite padrão | Contratos com desconto > nível 1 / Total × 100 | ≤ [Y]% | Mensal |
| KPI-OP-07 | Win rate por faixa de preço | Win rate em cada faixa de preço do portfólio | Análise de benchmark | Trimestral |
| KPI-OP-08 | Margem bruta média realizada | (Receita − Custo de entrega) / Receita × 100 | ≥ Meta de margem | Trimestral |

---

## 8. Gatilhos e Alertas Operacionais

| Código | Condição | Ação | Responsável |
|--------|----------|------|-------------|
| ALT-OP-01 | Desconto médio supera [X+5]% por 2 meses | Revisão urgente da política de descontos + treinamento de equipe | Gerente + Liderança |
| ALT-OP-02 | Win/loss analysis mostra >30% de perdas por preço | Análise de competitividade do pricing + possível revisão | Gerente + CAP-01 |
| ALT-OP-03 | Custo de entrega sobe >15% em relação ao período anterior | Revisão de margem e possível revisão de preços | Liderança + Financeiro |
| ALT-OP-04 | Concorrente muda preço significativamente | Revisão competitiva de pricing | CAP-01 + Liderança |
| ALT-OP-05 | Solução vendida sem documentação de portfólio | Bloqueio e regularização + revisão do processo | Gerente |
| ALT-OP-06 | Contrato com desconto abaixo da margem mínima identificado | Investigação imediata + aprovação retroativa se necessário | Liderança |

---

## 9. Diagnóstico de Desvios e Análise de Causa Raiz

| Desvio Observado | Possíveis Causas Raiz | Método de Diagnóstico |
|-----------------|----------------------|----------------------|
| Ticket médio abaixo da meta | Desconto excessivo; venda de soluções de menor valor; mix de soluções inadequado | Análise de composição de receita por solução; desconto médio por vendedor |
| Alto % de descontos | Falta de confiança no preço; pressão de concorrência; ausência de proposta de valor clara; segmento errado | Análise de win/loss por preço; pesquisa de objeções com a equipe |
| Portfólio inadequado às necessidades do mercado | ICP desalinhado com portfólio; portfólio desatualizado; gaps não identificados | Análise de demandas não atendidas; feedback de CS e vendedores |
| Margem abaixo da meta | Custos de entrega subestimados; descontos excessivos; inflação não repassada | Análise de custo por projeto/cliente; margem por linha de solução |

---

## 10. Planos de Ação Padronizados

### PA-OP-01: Alto Desconto Médio (Acima do Limite por 2 Meses)
```
Semana 1: Auditoria dos contratos com desconto acima do limite — razão de cada um
Semana 2: Analisar padrão: é concentrado em vendedores específicos? segmentos? soluções?
Semana 3: Se problema de confiança → sessão de valor training com a equipe
           Se problema de competitividade → análise de pricing vs. mercado
Semana 4: Revisar política de descontos se necessário; reforçar autorização
```

### PA-OP-02: Portfólio com Gap Identificado (Demanda Recorrente Não Atendida)
```
Semana 1: Documentar a demanda: quantos prospects/clientes pediram? qual o ticket potencial?
Semana 2: Avaliar capacidade de entrega (operações) e custo estimado
Semana 3: Definir proposta preliminar da nova solução (escopo, preço, proposta de valor)
Semana 4: Apresentar para aprovação da liderança
Mês 2: Se aprovado — documentar, treinar equipe, lançar
```

### PA-OP-03: Revisão Anual de Precificação
```
Mês -2 (antes da vigência): Levantar dados — ARPU, margem, desconto médio, benchmark
Mês -1: Análise competitiva (CAP-01) + cálculo de custos atualizados
Semana -3: Proposta de nova tabela para liderança
Semana -2: Aprovação e comunicação interna
Semana -1: Treinamento da equipe com as novas condições
Vigência: Tabela nova entra em vigor; versão anterior arquivada
```

---

## 11. Procedimentos de Auditoria

### 11.1 Auditoria Mensal (Gerente Comercial)
**Checklist:**
- [ ] Ticket médio calculado por segmento (KPI-OP-04)
- [ ] Desconto médio calculado (KPI-OP-05)
- [ ] Nenhum contrato com desconto abaixo da margem mínima (verificação amostral)
- [ ] Portfólio documentado está completo e atualizado

### 11.2 Auditoria Trimestral (Liderança + Gerente)
**Checklist:**
- [ ] Win rate por faixa de preço analisado
- [ ] Benchmark competitivo realizado (CAP-01)
- [ ] Aderência ao portfólio calculada
- [ ] Margem bruta média calculada (KPI-OP-08)
- [ ] Gaps de portfólio identificados e priorizados
- [ ] Revisar se a política de descontos reflete a realidade do mercado

### 11.3 Auditoria Anual (Liderança + Conselho)
**Checklist:**
- [ ] Revisão formal de toda a tabela de preços
- [ ] Revisão estratégica do portfólio (o que manter, criar, descontinuar)
- [ ] Análise de lucratividade por linha de solução
- [ ] Posicionamento competitivo do portfólio avaliado

---

## 12. Possibilidades de Automação

### 12.1 CRM e Processo Comercial
| Automação | Trigger | Ação |
|-----------|---------|------|
| Tabela de preços no CRM | Versão publicada | Atualização automática dos campos de preço nas oportunidades novas |
| Cálculo automático de desconto | Vendedor insere preço de venda | CRM calcula % de desconto e verifica limite de aprovação necessário |
| Alerta de desconto excessivo | Desconto > limite configurado | Notificação para aprovador antes de enviar a proposta |
| Template de proposta dinâmico | Solução selecionada no CRM | Preenche automaticamente descrição, escopo e preços da proposta |

### 12.2 Inteligência Artificial
| Automação | Aplicação |
|-----------|----------|
| Pricing inteligente | IA sugere preço ótimo por oportunidade com base em ticket histórico do segmento e histórico de win rate |
| Detecção de gap de portfólio | IA analisa feedbacks de CS e vendedores para identificar demandas recorrentes não cobertas pelo portfólio |
| Competitive pricing tracking | IA monitora preços e ofertas dos concorrentes e atualiza benchmark automaticamente |

### 12.3 Dashboards
| Dashboard | Métricas | Público |
|-----------|---------|---------|
| Portfólio Performance | Receita por solução, aderência, ticket médio | Gerente + Liderança (mensal) |
| Pricing Monitor | Desconto médio, % acima do limite, ticket médio vs. meta | Gerente (tempo real) |
| Margin Analysis | Margem bruta por solução, tendência | Liderança + Financeiro (trimestral) |

---

## 13. Interfaces e Dependências com Outros Módulos

### 13.1 Matriz de Interfaces

| Módulo | Tipo | CAP-06 Fornece | CAP-06 Recebe |
|--------|------|----------------|---------------|
| CAP-01 Inteligência Comercial | Bilateral | Dados de ticket médio e ARPU para benchmarking | Benchmarks competitivos de preço; posicionamento de mercado |
| CAP-02 Gestão de Demanda | Fornece | Limites de CPL por segmento | — |
| CAP-03 Processo de Vendas | Fornece | Portfólio documentado, tabela de preços, política de descontos, template de proposta | Feedback de objeções de preço; win/loss por preço |
| CAP-04 Gestão de Receita | Bilateral | — | ARPU e ticket médio realizado; margem bruta por linha |
| CAP-05 Gestão de Clientes | Recebe | — | Feedback de adequação da oferta às necessidades reais do cliente |
| CAP-08 Performance e Autogestão | Bilateral | Dados de ticket médio, margem, desconto médio | Metas de ticket médio e margem |

---

## Histórico de Alterações

| Versão | Data | Autor | Descrição |
|--------|------|-------|-----------|
| 1.0.0 | 2026-06-28 | Guardião da Documentação | Criação inicial do Módulo Operacional CAP-06 |
