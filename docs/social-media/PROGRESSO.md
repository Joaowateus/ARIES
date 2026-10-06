# Social Media · Progresso

> Atualizado a cada entrega. Checklist da seção 18 da especificação, mais as decisões tomadas e as pendências externas.

## Situação atual

- **Etapa:** passos 1 e 2 do prompt (leitura completa e plano de encaixe).
- **Status:** plano entregue em [PLANO_DE_ENCAIXE.md](PLANO_DE_ENCAIXE.md). **Aguardando a aprovação do João e as respostas das perguntas P1 a P15** antes de escrever código.

## Checklist de aceite (seção 18)

### Fase 0 · Base confiável
- [x] Mapeamento do repositório e plano de encaixe entregues ([PLANO_DE_ENCAIXE.md](PLANO_DE_ENCAIXE.md)) · aguardando aprovação
- [ ] Tokens, fontes e componentes base (seção 2)
- [ ] Conexão pela empresa com status, alertas e nova tentativa
- [ ] Jobs de sincronização (conta, mídias, stories de hora em hora, webhooks)
- [ ] Cache de miniaturas
- [ ] Marcação de lacunas de dados
- [ ] Separação orgânico, pago e total
- [ ] Todas as correções da seção 17

### Fase 1 · Acesso isolado e trabalho diário
- [ ] Papel `social_media` com permissões aplicadas no backend
- [ ] Tela 07 · Permissões, com convite, regras e "Ver como Social Media"
- [ ] Menu lateral do papel e cartão da conta
- [ ] Tela 01 · Hoje, completa
- [ ] Tela 02 · Calendário, com arrastar, regras, mix e janelas
- [ ] Tela 03 · Produção, com kanban, briefing, checklist, aprovação e publicação agendada pela API
- [ ] Trial Reels pela API
- [ ] Integração de leitura com o estoque e pautas automáticas (estoque, venda, insight, audiência, calendário)

### Fase 2 · Atendimento e prova de venda
- [ ] Tela 04 · Atendimento, com direct, comentários, respostas rápidas, janela de 24h e automações
- [ ] "Transformar em lead" integrado ao CRM com rodízio
- [ ] Códigos por post, link rastreado `/r/{code}` e reconhecimento do código no WhatsApp ou CRM
- [ ] Automação "Comente QUERO"
- [ ] Venda herdando a origem do lead
- [ ] Tela 06 · Vendas por post, com totais batendo com o CRM

### Fase 3 · Inteligência
- [ ] Tela 05 · Desempenho, com os 6 KPIs, consistência, funil, diagnóstico de reels, teste em andamento e todas as seções antigas corrigidas
- [ ] Motor de insights com todas as regras de 13.4 e de qualidade de 13.2
- [ ] Testes A/B (13.3)
- [ ] Biblioteca de ganchos
- [ ] Assistente da aba (seção 16) nas telas 02 a 07, com estado de recolher salvo
- [ ] Integração de IA (16.3) sem acesso a dados sensíveis

### Fase 4 · Experiência
- [ ] Tela 08 · Primeiro acesso
- [ ] Tela 09 · Modo foco, com fila real e ações reais
- [ ] Tela 10 · Paleta Ctrl+K e atalhos
- [ ] Tela 11 · Retrospectiva automática, conquistas, envio ao gestor, exportação PNG e relatório de segunda às 8h
- [ ] Motor de saudação (seção 14) com banco de frases e rotação de 7 dias
- [ ] Simulador de momentos (tela 13) em rota interna do gestor
- [ ] Todos os detalhes da seção 15

### Fase 5 · Celular
- [ ] Todas as telas responsivas, com o menu empilhando
- [ ] PWA instalável com Web Push
- [ ] Notificações da seção 11.5, com agrupamento
- [ ] Captura na loja
- [ ] Aprovação do gestor pelo celular

### Fase 6 · Itens da análise sem tela desenhada (também obrigatórios)
- [ ] **Concorrentes:** acompanhar seguidores, frequência e engajamento público de outras revendas da região pela Business Discovery API. Fazer uma subseção em Desempenho seguindo o mesmo design system. **[CONFIRMAR COM O JOÃO]** a lista de perfis.
- [ ] **Acervo de mídia por moto:** todos os arquivos capturados, organizados por moto do estoque e reaproveitáveis em novas pautas.
- [ ] **Datas comerciais** pré-carregadas no planejamento mensal (dia 25).

### Verificação final
- [ ] Percorrer cada arquivo de `referencia-visual/` e confirmar que **todo elemento visível** existe no produto
- [ ] Percorrer este documento seção por seção e confirmar cada regra
- [ ] Listar para o João tudo que ficou marcado como [CONFIRMAR COM O JOÃO] e o que foi decidido

## Decisões tomadas

| Data | Decisão | Origem |
|---|---|---|
| — | (aguardando as respostas do plano) | — |

## Perguntas em aberto

As perguntas P1 a P15 estão na seção 4 do [plano](PLANO_DE_ENCAIXE.md#4-perguntas-todas-de-uma-vez).

## Pendências externas (fora do código)

- [ ] Instagram da empresa ligado a uma Página no Business Manager, com usuário do sistema e token com as permissões da seção 3.2
- [ ] App Review da Meta e app em modo Live
- [ ] Tarefas no cron-job.org (5 min, 1 h, diária)
- [ ] Chaves na Vercel: IA, armazenamento, e-mail, VAPID, token do webhook da Meta
