# Social Media · Progresso

> Atualizado a cada entrega. Checklist da seção 18 da especificação, mais as decisões tomadas e as pendências externas.

## Situação atual

- **Etapa:** Fase 0 · Base confiável.
- **Status:** plano aprovado em 06/10/2026. Em construção.

## Checklist de aceite (seção 18)

### Fase 0 · Base confiável
- [x] Mapeamento do repositório e plano de encaixe entregues ([PLANO_DE_ENCAIXE.md](PLANO_DE_ENCAIXE.md)) · aprovado em 06/10/2026
- [ ] Tokens, fontes e componentes base (seção 2)
- [x] Conexão pela empresa com status, alertas e nova tentativa (0b: usuário do sistema pelo Graph do Facebook, diagnóstico, nova tentativa com backoff de 5 min a 6 h, aviso agrupado ao gestor e ao Social Media, selo no menu)
- [x] Jobs de sincronização (conta, mídias, stories de hora em hora, webhooks) (0b: `/sm/cron/hora`, `/sm/cron/dia`, `/sm/cron/minuto` e `/sm/webhook/instagram` com assinatura verificada; os eventos ficam guardados para o Atendimento da Fase 2)
- [ ] Cache de miniaturas
- [x] Marcação de lacunas de dados (0a)
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

## Seção 17 · Correções da aba atual

| # | Correção | Status |
|---|---|---|
| 1 | "API access blocked": conexão pela empresa, alertas e nova tentativa | Feito (0b): conexão pelo usuário do sistema, diagnóstico que aponta a causa, nova tentativa automática e aviso |
| 2 | Sincronização congelada sem aviso | Feito (0a): banner de qualidade dos dados, dias sem sincronizar marcados (`sincronizado`), tendências avisam ou somem com mais de 20% de lacunas. A sincronização também passou a buscar os dias que ficaram para trás (antes, uma pausa virava buraco permanente). |
| 3 | Meta de frequência contraditória | Feito (0a): card "Dias com post" e cadência numa leitura só, com o maior intervalo calculado junto |
| 4 | Funil errado | Feito (0a): funil alcance único → visitas → conversas → leads → vendas. O alcance único vem da API (até 30 dias) e fica em cache por período. |
| 5 | Interações divergentes | Feito (0a): a composição usa a mesma fonte do card e mostra a diferença como "Outras" |
| 6 | "0,0%" em valores pequenos | Feito (0a): o formatador aumenta as casas e nunca mostra 0,0% para um valor que não é zero |
| 7 | Insights com amostra pequena como fato | Feito (0a): 5+ posts por grupo é fato, 3 ou 4 é hipótese de confiança baixa, 1 ou 2 não gera insight |
| 8 | Miniaturas quebradas | Fase 0c |
| 9 | Stories nunca registrados | Feito (0b): o job de hora em hora captura os stories no ar e as métricas deles. Depende da tarefa de hora em hora no cron-job.org. |
| 10 | Linha do período anterior desalinhada | Conferido (0a): o gráfico já alinha por índice do dia (dia 1 com dia 1) |
| 11 | Pago misturado com orgânico | Fase 0c |
| 12 | "Seguidores gerados n/d" nos reels | Feito (0a): mostra o número quando a API manda; senão, "—" com dica explicando o motivo |

## Decisões tomadas

Plano aprovado em 06/10/2026. As perguntas que ficaram sem resposta seguem a recomendação do plano. Todas podem ser trocadas depois.

| # | Decisão (padrão adotado) | Origem |
|---|---|---|
| P1 | Mesmo app da Meta e mesmo usuário do sistema do Tráfego, com as permissões do Instagram acrescentadas. | Recomendação do plano |
| P2 | Contas pessoais continuam no fluxo atual (login do Instagram), separadas da conta da empresa. | Padrão seguro |
| P3 | Estoque leve dentro do Pró-Labore (`SmMotoEstoque`): modelo, ano, cor, entrada e situação, mantido pelo gestor, sem custo nem margem. Dá para ligar ao ARIES principal depois. | Padrão sem dependência externa |
| P4 | Rodízio: consultores ativos com login, em ordem fixa, guardando o último atendido. Vale para os leads do Social Media. | Recomendação do plano |
| P5 | IA pela API da Anthropic, com chave só na Vercel. Sem chave, o produto usa textos por template. | Recomendação do plano |
| P6 | Autorização de imagem: checkbox "cliente autorizou" com foto do termo anexada à pauta de entrega. | Padrão mais simples |
| P7 | PWA instalável com Web Push. | Recomendação do plano |
| P8 | Armazenamento com camada própria: Vercel Blob quando houver token, senão o Postgres para imagens pequenas. Vídeo exige o Blob. | Recomendação do plano |
| P9 | O consultor cola o código no lead e o CRM reconhece sozinho. O reconhecimento automático no WhatsApp fica para quando a Evolution for ligada. | Padrão sem dependência externa |
| P10 | E-mail por provedor configurável (Resend). Sem chave, o convite vira link para copiar e o relatório fica na tela e no push. | Recomendação do plano |
| P11 | Avisos por push e e-mail. WhatsApp quando a Evolution estiver ativa. | Recomendação do plano |
| P12 | Lista de concorrentes editável pelo gestor na própria tela. | Padrão sem dependência externa |
| P13 | Expediente configurável, padrão seg a sex das 8h às 18h, fuso America/Belem. | Padrão |
| P14 | Manrope nos títulos só no espaço do Social Media. | Recomendação do plano |
| P15 | Nome, tratamento e e-mail informados pelo gestor no convite (tela 07). | Padrão |

## Perguntas em aberto

As perguntas P1 a P15 estão na seção 4 do [plano](PLANO_DE_ENCAIXE.md#4-perguntas-todas-de-uma-vez).

## Pendências externas (fora do código)

- [ ] Instagram da empresa ligado a uma Página no Business Manager, com usuário do sistema e token com as permissões da seção 3.2
- [ ] App Review da Meta e app em modo Live
- [ ] Tarefas no cron-job.org, todas `POST` com o cabeçalho `x-cron-secret: <SOCIAL_MEDIA_CRON_SECRET>`:
  - `https://<api>/pro-labore/sm/cron/hora`, de hora em hora (substitui a tarefa antiga `/social-media/sincronizar-cron`, que continua funcionando);
  - `https://<api>/pro-labore/sm/cron/dia`, uma vez por dia (madrugada);
  - `https://<api>/pro-labore/sm/cron/minuto`, a cada 5 minutos.
- [ ] Webhook no app da Meta: Webhooks → Instagram → callback `https://<api>/pro-labore/sm/webhook/instagram`, token de verificação igual a `META_WEBHOOK_VERIFY_TOKEN`, campos comments, mentions, messages e story_insights. `META_APP_SECRET` = Chave Secreta do app.
- [ ] Conectar pela empresa: aba Social Media → "Conectar pela empresa" → colar o token do usuário do sistema. O histórico atual é mantido.
- [ ] Chaves na Vercel: IA, armazenamento, e-mail, VAPID, token do webhook da Meta
