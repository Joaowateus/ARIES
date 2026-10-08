# Social Media · Verificação final

> Feita em 08/10/2026, depois das Fases 0 a 6. Este documento fecha a seção 18 ("Verificação final") da especificação:
> - protótipos conferidos elemento por elemento;
> - especificação conferida seção por seção;
> - lista do que estava marcado como **[CONFIRMAR COM O JOÃO]** e o que foi decidido.
>
> O andamento de cada fase, os ajustes e as pendências externas estão no [PROGRESSO](PROGRESSO.md).

## 1. Protótipos (`referencia-visual/`)

**Como foi feito**

- Todos os textos visíveis dos 14 arquivos (cerca de 590) foram extraídos e procurados no código do produto, nas telas e na API.
- Ficaram sem correspondência literal só três tipos de texto:
  - **Variáveis de template** (`{{c.name}}`, `{{k.value}}`...). No produto, vêm dos dados reais.
  - **Dados ilustrativos**: nomes, números e títulos de exemplo, como "Bia", "Rafael S.", "Financiamento sem entrada: como funciona na MM" e "João Mateus". A seção 0 manda trocá-los pelos dados reais.
  - **Legendas de prancheta do editor** ("Social Media · Hoje", "Pulso do post", "Gravou, subiu, a pauta anda sozinha no quadro"). Descrevem a tela, não fazem parte dela.
- Cada tela também foi comparada por print com o protótipo na fase em que foi entregue.

**O que faltava e foi feito nesta verificação**

- **Hoje (`Main.html`):** botão **"Ver calendário"** ao lado do CTA da recepção.
- **Recepção (`Recepcao.html`):** a barra **"Pergunte ao assistente · Ctrl K"**, que abre a paleta. A paleta também responde perguntas.

| Tela | Arquivo | Onde está no produto | Resultado |
|---|---|---|---|
| 01 · Hoje | `Main.html` | `/pro-labore/sm` | Completa (com os dois itens acima) |
| 02 · Calendário editorial | `Calendario.html` | `/pro-labore/sm/calendario` | Completa; na Fase 6, ganhou as datas comerciais e o planejamento do mês |
| 03 · Produção | `Producao.html` | `/pro-labore/sm/producao` | Completa; ganhou a captura na loja (5c) e o "Usar do acervo" (6) |
| 04 · Atendimento | `Atendimento.html` | `/pro-labore/sm/atendimento` | Completa |
| 05 · Desempenho | `Desempenho.html` | `/pro-labore/sm/desempenho` | Completa; ganhou a subseção Concorrentes (6) |
| 06 · Vendas por post | `Atribuicao.html` | `/pro-labore/sm/vendas-por-post` | Completa |
| 07 · Permissões | `Permissoes.html` | `/pro-labore/equipe/acessos` | Completa |
| 08 · Primeiro acesso | `Onboarding.html` | `/pro-labore/sm/boas-vindas` | Completa |
| 09 · Modo foco | `Foco.html` | `/pro-labore/sm/foco` | Completa |
| 10 · Paleta e atalhos | `Comandos.html` | Ctrl/Cmd + K em qualquer tela; `?` para os atalhos | Completa |
| 11 · Retrospectiva | `Retro.html` | `/pro-labore/sm/retrospectiva` | Completa |
| 12 · Celular | `Celular.html` | Avisos no celular (PWA), `/pro-labore/sm/captura` e `/pro-labore/sm/aprovar` | Completa |
| 13 · Recepção | `Recepcao.html` | Recepção da tela Hoje e o simulador do gestor em `/pro-labore/sm/recepcao` | Completa (com a barra acima) |
| Componente · Assistente da aba | `Assistente.html` | Telas 02 a 07 | Completo |

## 2. Especificação, seção por seção

| Seção | Regra | Onde e como | Fase |
|---|---|---|---|
| 0 · Como usar | Protótipos lidos como pseudo-JSX; números sempre dos dados reais | Nenhum número de exemplo no produto; sem dado, a tela diz "—" e explica | Todas |
| 1 · Contexto | Espaço do Social Media dentro do Pró-Labore, com acesso isolado | Papel próprio, menu só com Trabalho e Resultado, e o gestor no "ver como" | 1a |
| 2.1 · Cores | Tema escuro padrão | Tokens `--sm-*`, tema escuro padrão e claro nas Preferências | 0d, 4e |
| 2.2 · Tipografia | Manrope nos títulos; IBM Plex Sans e Mono | Manrope só no espaço do Social Media (P14) | 0d |
| 2.3 · Forma e espaçamento | Raios, espaços e o grid do protótipo | Seguido em todas as telas | 0d |
| 2.4 · Componentes base | Componentes compartilhados | `sm/_ui`: Card, Chip, Botão, KPI, Segmentado, Modal, Toast, Sidebar, Assistente e Paleta | 0d |
| 2.5 · Acessibilidade | Contraste, foco, alvos, leitores de tela, movimento | Contraste mínimo de 4,5:1 (contador do menu ajustado), foco visível, alvos de 44 px, `aria-*` e respeito a "reduzir movimento" | 0d e todas |
| 3.1 · Papéis e permissões | Níveis por módulo e as 4 regras | Garantidos no servidor (`contextoSM`); "ver como" só leitura | 1a |
| 3.2 · Conexão com o Instagram | Conta da empresa, alertas e nova tentativa | Usuário do sistema do Business Manager; contas pessoais no fluxo antigo (P2) | 0b |
| 3.3 · Métricas de mídia | Coleta completa | Incluídos: retenção, pulo nos 3 s, envios, salvos, reposts, duração e navegação de story | 0a, 3a |
| 3.4 · Modelo de dados | Adaptado ao banco existente | Modelos `Sm*` no Prisma, com migrações por fase | Todas |
| 3.5 · Atribuição | Código, link rastreado, CRM e Vendas por post | `#P-DDMM-MODELO`, `/r/{slug}`, reconhecimento do código no lead e tela Vendas por post | 2b |
| 4 · Hoje | Cockpit | Recepção, ritmo, filas, publicar hoje, metas e o assistente | 1d, 4a |
| 5 · Calendário | Grade, regras, mix e janelas | Arrastar, "+ slot livre", rajada, mix 40/20/25/15 e janelas comprovadas; datas comerciais (6) | 1c, 6 |
| 6 · Produção | Kanban, briefing, checklist, aprovação e publicação | Pautas automáticas (estoque, venda, insight, audiência, calendário), Trial Reels, captura (5c) e acervo (6) | 1b, 5c, 6 |
| 7 · Atendimento | Direct e comentários | Janela de 24 h, automações e "Transformar em lead" com rodízio (P4) | 2a |
| 8 · Desempenho | 6 KPIs, consistência, funil, reels e análise completa | Orgânico, pago e total separados; concorrentes (6) | 3a, 6 |
| 9 · Vendas por post | Leads e vendas por publicação | Valores só com a regra "mostrar valores" | 2b |
| 10 · Permissões | Tela 07 do gestor | Níveis, regras, convite e "ver como" | 1a |
| 11.1 a 11.6 · Telas de experiência | Primeiro acesso, modo foco, paleta, retrospectiva, celular e recepção | Ver tabela 1 | 4a a 4d, 5 |
| 12 · Métricas | Fórmulas | Retenção, pulo ponderado, envios e salvos por mil, consistência e funil | 3a |
| 13 · Insights | Estrutura, regras de qualidade, testes A/B e regras mínimas | 5+ posts é fato, 3 ou 4 é hipótese, 1 ou 2 não gera insight; testes A/B com confiança explicada | 3b, 3c |
| 14 · Saudação | Momentos, prioridade e regras | 8 frases por momento, sem repetir em 7 dias, recolhe depois da primeira ação e respeita o expediente | 4a |
| 15 · Detalhes de experiência | Os 8 itens | Desfazer, vazios que ensinam, esqueletos, textos humanos, tema, avisos agrupados, comemorações e qualidade dos dados | 4e, 5b |
| 16 · Assistente da aba | Componente único e IA | IA sem custo, margem ou valores (seção 16.3); sem chave, por template (P5) | 3c, 3d |
| 17 · Correções da aba atual | As 12 correções | Todas feitas ou conferidas (ver o PROGRESSO) | 0a a 0c |
| 18 · Fases e checklist | Fases 0 a 6 | Todos os itens marcados no PROGRESSO | Todas |

## 3. Itens [CONFIRMAR COM O JOÃO] e o que foi decidido

Todos têm um padrão já funcionando e podem ser trocados depois sem refazer nada.

| # | Onde | Pergunta | O que está no produto (padrão adotado) | O que precisa de você |
|---|---|---|---|---|
| 1 | §3.2 | Outras pessoas da equipe continuam conectando contas pessoais? | **Sim, separado (P2).** A conta da empresa vai pelo Business Manager; as contas pessoais seguem no login do Instagram, sem misturar. | Confirmar se mantém as contas pessoais. |
| 2 | §6 | Como registrar a autorização de imagem do cliente nas entregas? | **Checkbox "Cliente autorizou" e foto do termo anexada à pauta (P6).** A captura lembra disso nas pautas de Prova social. O termo não entra no acervo. | Confirmar se o termo em foto basta ou se prefere assinatura digital. |
| 3 | §11.5 | PWA ou app nativo? | **PWA instalável com Web Push (P7).** No Android, os avisos chegam com o app instalado ou só aberto no navegador; no iPhone, com o app adicionado à Tela de Início. | Confirmar o PWA. App nativo só se precisar de algo que o navegador não faz. |
| 4 | §16.3 | Qual provedor e modelo de IA? | **API da Anthropic (P5)**, modelo padrão `claude-opus-5-5` (troca por `SM_IA_MODELO`), limite de 300 chamadas por dia por conta. A IA nunca recebe custo, margem nem valores em R$; sem a chave, tudo funciona por template. | Pôr `ANTHROPIC_API_KEY` na API, ou dizer se prefere outro provedor. |
| 5 | §18 · Fase 6 | Quais perfis de concorrentes acompanhar? | **Lista editável pelo gestor na própria tela (P12).** Fica em Desempenho → Concorrentes: até 10 perfis, adicionados pelo @ ou pelo link. Precisa da conta da empresa conectada. | Mandar os @ (ou adicionar direto na tela). |

As outras perguntas do plano (P1 a P15) também seguiram a recomendação. A tabela completa está em [Decisões tomadas](PROGRESSO.md#decisões-tomadas):

- conexão (P1);
- estoque leve (P3);
- rodízio (P4);
- armazenamento (P8);
- código no CRM (P9);
- e-mail (P10);
- canais de aviso (P11);
- expediente (P13);
- fonte dos títulos (P14);
- responsável (P15).

## 4. O que ainda depende de configuração fora do código

A lista completa, com o passo a passo, está em [Pendências externas](PROGRESSO.md#pendências-externas-fora-do-código). Resumo do que liga cada parte:

| Parte | O que precisa |
|---|---|
| Conta da empresa | Instagram ligado a uma Página no Business Manager e o token do usuário do sistema colado em Social Media → "Conectar pela empresa". É o que habilita os concorrentes, a publicação pela API e o atendimento. |
| Rotinas automáticas | As 3 tarefas no cron-job.org: hora, dia e a cada 5 minutos. A de 5 minutos dispara os avisos e publica no horário; a do dia tira o retrato dos concorrentes e faz o planejamento do dia 25. |
| Avisos no celular | Chaves VAPID na API. |
| Vídeo pela captura na loja | Vercel Blob (`BLOB_READ_WRITE_TOKEN`). |
| IA | `ANTHROPIC_API_KEY`. |
| E-mail | `RESEND_API_KEY` e `EMAIL_FROM`. |
| Meta | App Review da Meta e o webhook do Instagram. |
