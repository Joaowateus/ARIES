# Pró-Labore · Módulo Social Media com acesso isolado
## Especificação completa para construção

> **Regra principal:** tudo o que está neste documento e nos arquivos da pasta `referencia-visual/` deve ser construído. Nada é opcional, exceto o que estiver marcado explicitamente como **[CONFIRMAR COM O JOÃO]**. Ao final de cada fase, percorra o **Checklist de aceite (seção 18)** e só avance quando todos os itens daquela fase estiverem marcados.

---

## 0. Como usar este pacote

| Arquivo | Para que serve |
|---|---|
| `ESPECIFICACAO_SOCIAL_MEDIA.md` | Este documento. É a fonte da verdade para regras, dados, cálculos e comportamento. |
| `PROMPT_CLAUDE_CODE.md` | Instrução inicial a ser colada no Claude Code. |
| `referencia-visual/*.html` | O protótipo aprovado, tela por tela. É a fonte da verdade para layout, hierarquia, textos, cores e espaçamentos. |

**Sobre os arquivos de `referencia-visual/`:**
- Foram feitos num editor de design com uma sintaxe própria de template. Leia-os como **pseudo-JSX**:
  - `{{variavel}}` = interpolação;
  - `<sc-for list="{{x}}" as="item">` = `x.map(item => …)`;
  - `<sc-if value="{{cond}}">` = renderização condicional;
  - `<dc-import name="Assistente" aba="calendario">` = `<Assistente aba="calendario" />`;
  - o bloco `<script type="text/x-dc">` contém a lógica do componente: `this.state`, `setState`, e `renderVals()` funcionando como um `render` que devolve os valores usados no template.
- Eles **não abrem sozinhos no navegador** (dependem de um runtime do editor). Use-os como especificação, não como código para copiar e colar.
- Os links internos apontam para `Nome.dc.html`. O arquivo correspondente nesta pasta é `Nome.html`.
- **Os números e nomes dentro dos protótipos são ilustrativos** (ex.: "Bia", "Rafael S.", valores por post, retenção 31%). No sistema real, todo número vem dos dados. Os únicos dados reais da conta usados como exemplo são: 10.297 seguidores, 44 publicações em 30 dias, 118 leads orgânicos, 5 vendas, R$ 117.900 negociados, 1.575 visitas ao perfil, 116 toques em links e o desempenho dos reels FZ25 Cinza (2.501 contas), CB 500X (1.487) e MT-03 (1.582).

| Tela | Arquivo |
|---|---|
| 01 · Hoje (cockpit) | `Main.html` |
| 02 · Calendário editorial | `Calendario.html` |
| 03 · Produção | `Producao.html` |
| 04 · Atendimento | `Atendimento.html` |
| 05 · Desempenho | `Desempenho.html` |
| 06 · Vendas por post | `Atribuicao.html` |
| 07 · Permissões (visão do gestor) | `Permissoes.html` |
| 08 · Primeiro acesso | `Onboarding.html` |
| 09 · Modo foco | `Foco.html` |
| 10 · Paleta de comandos e atalhos | `Comandos.html` |
| 11 · Retrospectiva da semana | `Retro.html` |
| 12 · Celular: pulso, captura e aprovação | `Celular.html` |
| 13 · Recepção (saudações por momento) | `Recepcao.html` |
| Componente · Assistente da aba | `Assistente.html` |

---

## 1. Contexto

- **Empresa:** MM Negócios & Veículos. Revenda de motos novas e seminovas em Belém e região metropolitana (PA).
- **Instagram:** `@mmnegociosveiculos`, conta comercial.
- **Sistema:** Pró-Labore, aplicação web React que já existe.
  - Tem as abas Dashboard, CRM, Agenda, Reuniões, Anotações, Vendas, Social Media, Tráfego e Assistente Comercial, além dos grupos Equipe e Sistema.
  - A aba Social Media atual mostra a análise da conta.
- **Objetivo:** criar um **papel "Social Media" com acesso isolado**. Quem entra com esse papel vê só o seu espaço de trabalho, que cobre o ciclo completo:
  - Planejar → Produzir → Publicar → Atender → Medir → Vender → Aprender.
  - Recepção, assistente e rituais em todas as telas.

**Antes de escrever código:**
1. Mapeie o repositório: stack, roteamento, gerenciamento de estado, autenticação, modelo atual de usuários e papéis, componentes e tokens de design existentes, integração atual com o Instagram e o modelo do CRM (leads, vendas, consultores).
2. Escreva um plano curto de como cada seção abaixo se encaixa no que já existe.
3. **Reaproveite** o que já existe (tokens, componentes, CRM) em vez de duplicar.
4. Se algo deste documento conflitar com a arquitetura atual, registre o conflito no plano e proponha a adaptação que preserva o comportamento descrito.

**Restrições de design já definidas pelo João:**
- O Pró-Labore segue a disciplina de um design system consistente (tokens e componentes) com a paleta da marca Aries Sales Systems: preto + prata/metálico.
- Verde e vermelho são usados só para status semântico.
- A aba Social Media atual e o protótipo usam azul (`#3B82F6` / `#4C8DF6`) como cor de dados nos gráficos. Mantenha.

---

## 2. Design system (extraído do protótipo)

### 2.1 Cores (tema escuro, padrão)

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#0A0A0B` | Fundo da página |
| `bg-sidebar` | `#0D0D0F` | Menu lateral |
| `bg-focus` | `#070708` | Modo foco e retrospectiva |
| `surface` | `#121214` | Cartões |
| `surface-2` | `#18181B` | Blocos internos e botões secundários |
| `surface-3` | `#1C1C21` | Item selecionado |
| `border` | `#232328` | Borda de cartão |
| `border-strong` | `#2C2C32` | Borda de botão e input |
| `divider` | `#1E1E22` | Linhas entre itens |
| `text` | `#EDEDEF` | Texto padrão |
| `text-strong` | `#F4F4F6` | Títulos |
| `text-muted` | `#A1A1AA` | Texto secundário |
| `text-faint` | `#8A8A93` | Legendas e rótulos mono |
| `silver` | `#ECECEF` | Botão primário, item ativo do menu (texto `#0A0A0B`) |
| `data-blue` | `#4C8DF6` | Barras e gráficos |
| `data-blue-dark` | `#2D5BA8` | Barras secundárias |
| `badge-blue` | `#3B82F6` | Contador no menu |
| `brand-yellow` | `#F5C518` | Avatar "MM" da conta |

**Pares semânticos (fundo / texto) para chips:**

| Significado | Fundo | Texto |
|---|---|---|
| Sucesso / ponto forte | `#0F2A20` | `#6EE7B7` |
| Atenção | `#2A2110` | `#FCD58A` |
| Urgente / erro | `#2B1414` | `#FCA5A5` |
| Informação / post | `#13213A` | `#93C5FD` |
| Aprendizado | `#221A3A` | `#C4B5FD` |
| Neutro | `#1A1A1E` | `#A1A1AA` |

**Cores dos pilares de conteúdo** (usadas em chips e no calendário):

| Pilar | Fundo | Texto | Cor de barra |
|---|---|---|---|
| Estoque e produto | `#13213A` | `#93C5FD` | `#4C8DF6` |
| Prova social (entregas) | `#0F2A20` | `#6EE7B7` | `#34D399` |
| Educação (financiamento) | `#2A2110` | `#FCD58A` | `#F5B544` |
| Bastidores | `#221A3A` | `#C4B5FD` | `#A78BFA` |

**Banners:**
- Atenção: fundo `#16130C`, borda `#5A4316`.
- Sucesso: fundo `#0D1F17`, borda `#1F4A37`.
- Insight: fundo `#0F1A2E`, borda `#22406E`.

O tema claro precisa existir como preferência (seção 15.5). Derive os tokens claros mantendo a mesma semântica e um contraste mínimo de 4,5:1.

### 2.2 Tipografia (Google Fonts)

| Uso | Fonte e estilo |
|---|---|
| Títulos e números grandes | **Manrope** 700/800 |
| Texto | **IBM Plex Sans** 400/500/600 |
| Rótulos | **IBM Plex Mono** 500, 11px, caixa alta, `letter-spacing: .08em`, cor `text-faint` (classe `.mono` no protótipo) |

Escala usada: H1 de página 34px · H1 de foco/onboarding 38 a 52px · título de cartão 18px · KPI 30px · texto 14 a 15px · legenda 12px.

### 2.3 Forma e espaçamento

- **Raios:** cartão 14px · botão 10 a 12px · chip 999px · telefone 44px · modal/retrospectiva 18 a 24px.
- **Espaçamento:** padding de cartão 20px · gap entre cartões 14 a 18px · padding da página 32px 40px.
- **Toque:** todo alvo de toque tem no mínimo 44px de altura.
- **Responsivo:** o menu lateral empilha no celular; tabelas largas rolam dentro de um container com `overflow-x: auto`.

### 2.4 Componentes base a criar (ou mapear para os existentes)

`Card`, `Chip` (variantes semânticas e de pilar), `Button` (primário prata e secundário), `SegmentedControl`, `Toggle` (role="switch"), `KpiCard`, `ProgressBar`, `Banner` (atenção, sucesso, insight), `Kbd`, `Sidebar` do papel Social Media, `AccountStatusCard`, `EmptyState`, `Skeleton`, `Toast` com desfazer.

### 2.5 Acessibilidade obrigatória

- Botões reais (`<button>`) e links reais (`<a>`); nunca `onClick` em `div`.
- `aria-pressed` em controles segmentados e `aria-expanded` no recolher.
- `aria-label` em botões só com ícone.
- Labels em todos os inputs.
- Foco visível: `outline: 2px solid #8FB4FF`.
- Ícones em SVG de traço (o protótipo traz os paths) e **nenhum emoji na interface**.

---

## 3. Arquitetura e dados

### 3.1 Papéis e permissões

Criar o papel `social_media`. O gestor (João, papel admin/gestor) configura o acesso na tela 07. Matriz padrão:

| Módulo | Nível padrão | Escopo |
|---|---|---|
| Social Media · análise | Completo | Todos os indicadores da conta |
| Calendário e produção | Completo | Criar, editar e enviar pautas para aprovação |
| Atendimento do Instagram | Completo | Direct, comentários e envio de leads ao CRM |
| Estoque | Leitura | Modelo, ano, cor e dias em estoque. **Sem custo e sem margem.** |
| CRM | Leitura | Só cria lead e acompanha os leads de origem orgânica |
| Vendas | Leitura | Só as vendas atribuídas ao orgânico |
| Tráfego | Leitura | Só o gasto com impulsionamento de posts |
| Financeiro e pró-labore | Sem acesso | |
| Dashboard geral e equipe | Sem acesso | |

**Regras gerais de permissão:**
- Os níveis são Completo / Leitura / Sem acesso e ficam configuráveis por módulo.
- Aplique as regras **no backend** (consultas filtradas e campos omitidos), não só escondendo elementos na tela.

**Regras configuráveis na tela 07:**

| Regra | Padrão |
|---|---|
| Aprovação do gestor antes de publicar | ligado |
| Mostrar valores em R$ nas vendas atribuídas | ligado |
| Relatório semanal toda segunda às 8h para o gestor | ligado |
| Assistente de roteiro com IA | desligado |

**Convite por e-mail** do responsável, também na tela 07.

**Login do papel `social_media`:** cai direto na tela 01 (ou na 08, se for o primeiro acesso). O menu lateral mostra só:
- **TRABALHO:** Hoje, Calendário, Produção, Atendimento (com contador de pendências).
- **RESULTADO:** Desempenho, Vendas por post.
- **Rodapé:** cartão da conta (`@mmnegociosveiculos`, "Conta da empresa", status de sincronização) e o nome do papel com o botão Sair.

### 3.2 Conexão com o Instagram (corrige a falha atual "API access blocked")

- A conexão passa a pertencer **à empresa**, via usuário de sistema no Meta Business Manager com token de longa duração. Não depende do login pessoal de ninguém.
- O texto atual "Cada pessoa da equipe conecta o próprio" deixa de valer para a conta da empresa.
- **[CONFIRMAR COM O JOÃO]** se outras pessoas da equipe continuarão conectando contas pessoais. Se sim, mantenha esse fluxo separado.
- Permissões da Meta necessárias:
  - `instagram_basic`, `instagram_manage_insights`, `instagram_manage_comments`, `instagram_manage_messages`, `instagram_content_publish`;
  - `pages_show_list`, `pages_read_engagement`, `business_management`.
- O app da Meta precisa estar em modo Live, com as permissões aprovadas.

**Sincronização:**

| Job | Frequência | O que faz |
|---|---|---|
| Conta | a cada 1h | Seguidores, seguindo, posts e insights diários da conta (alcance, views, interações, visitas ao perfil, toques em links, novos seguidores e deixaram de seguir, seguidores online por hora, demografia) |
| Mídias recentes | a cada 1h | Insights de cada mídia publicada nos últimos 7 dias |
| Mídias de 7 a 90 dias | 1 vez por dia | Mesmo que o anterior |
| Stories | a cada 1h | **Captura obrigatória** enquanto o story está no ar, porque a API só entrega as métricas nas 24h de vida |
| Miniaturas | ao sincronizar a mídia | Baixar e **guardar em armazenamento próprio**, porque as URLs do CDN do Instagram expiram (isso causa as miniaturas quebradas de hoje) |
| Webhooks | em tempo real | Comentários, menções e mensagens (Messaging API) |

**Status e falhas:**
- Grave o status de cada sincronização: sucesso ou erro, horário e mensagem.
- Cartão da conta: "Sincronizado há X min" em verde, ou "Falha na sincronização" em vermelho com o motivo.
- Toda falha gera alerta ao gestor e ao social media e faz nova tentativa com backoff exponencial.
- **Lacunas de dados:** dias sem sincronização ficam marcados. Os cálculos e insights consultam essa marcação (seção 13.2).

### 3.3 Métricas de mídia a coletar

Para cada mídia: alcance, views, curtidas, comentários, compartilhamentos, salvos, total de interações, visitas ao perfil, seguidores gerados, tempo médio assistido, tempo total assistido, **taxa de pulo nos 3 primeiros segundos** e reposts.

- A Meta incluiu a métrica de pulo de reels nos insights em dezembro de 2025. Verifique o nome exato na documentação atual da Graph API.
- Para reels cruzados com o Facebook, existem métricas de views separadas por plataforma.
- Grave também: **duração do vídeo**, formato (reels, carrossel, foto, story), legenda, data e hora, link permanente e se é trial reel.
- **Separar pago de orgânico:** identifique posts impulsionados e anúncios cruzando com a integração do módulo Tráfego (Marketing API: anúncios que usam `effective_instagram_media_id` ou equivalente), além da quebra de alcance por origem que a API fornecer.
- Toda métrica de alcance e engajamento precisa existir em três versões: **Orgânico, Pago e Total**.

### 3.4 Modelo de dados (sugestão; adapte ao banco existente)

**Conta e mídia:**
- `ig_account`: id, username, token_ref, status_sync, ultimo_sync_em, erro.
- `ig_account_daily`: data, seguidores, novos, saídas, alcance_unico, views, interações, visitas_perfil, toques_link, online_por_hora (json), sincronizado (bool).
- `ig_media`: id, tipo, legenda, publicado_em, duracao_s, permalink, thumb_url_local, is_trial, post_code, pauta_id, pilar.
- `ig_media_insights`: media_id, coletado_em, origem (organico, pago, total), alcance, views, curtidas, comentarios, envios, salvos, visitas_perfil, seguidores_gerados, tempo_medio_s, pulo_3s, reposts.
- `ig_story` e `ig_story_insights`: mesmos campos aplicáveis, mais respostas, toques para avançar e voltar, saídas.
- `ig_audience_snapshot`: data, genero, faixa_etaria, cidades, paises.

**Produção:**
- `pauta`: id, titulo, pilar, formato, status (ideia, roteiro, gravacao, edicao, aprovacao, agendado, publicado), prazo, responsavel_id, origem (estoque, insight, calendário, venda no CRM, audiência), moto_estoque_id, gancho, retencao, recompensa, cta, checklist (json), agendado_para, media_id, aprovado_por, aprovado_em, comentario_aprovacao.
- `pauta_midia`: uploads da captura (tomada n, arquivo, status).

**Atendimento e atribuição:**
- `conversa`: id, canal (direct, comentario, comentario_automacao, resposta_story), cliente_ig, nome, ultima_msg_em, respondida_em, status, media_origem_id, post_code, moto_interesse, lead_id.
- `mensagem`: conversa_id, direcao (in, out), texto, enviada_em.
- `automacao`: tipo (palavra_chave_comentario, fora_do_horario), palavra, resposta_template, ativa, disparos, leads_gerados.
- `resposta_rapida`: título, texto.
- `link_rastreado`: code, media_id ou "BIO", destino (WhatsApp com mensagem pré-preenchida), cliques.

**Metas, rituais e IA:**
- `meta_semanal`: usuario_id, semana, dias_com_post, tempo_resposta_max_min, leads_organicos.
- `teste_ab`: hipótese, variável (horário, gancho, formato), amostra_alvo, posts (json), status, resultado, confiança.
- `biblioteca_gancho`: texto, exemplos (media_ids), pulo_medio.
- `conquista`: usuario_id, tipo, semana.
- `ritual_execucao`: usuario_id, data, tarefas_concluidas, duração, sequência.
- `saudacao_frase` e `saudacao_exibida`: momento, texto com placeholders, ultima_exibicao_por_usuario.
- `notificacao`: tipo, destinatário, canal, payload, enviada_em, lida_em.

**Integração com o CRM:** o lead criado pelo módulo grava `origem = "Instagram orgânico"`, `post_code`, `media_id`, `canal_entrada` e `conversa_id`. A venda fechada no CRM herda essas informações do lead, e é isso que permite creditar a venda ao post de origem.

### 3.5 Atribuição (o coração do "Vendas por post")

1. **Código por post:** cada pauta agendada recebe um código no formato `#P-DDMM-MODELO` (ex.: `#P-0917-XRE`). Stories usam `#S-…` e a bio usa `#BIO`.
2. **Link rastreado:** `/r/{code}` registra o clique e redireciona para o WhatsApp da loja com uma mensagem pré-preenchida que contém o código. Exemplo: "Oi! Vi a XRE 300 no Instagram (#P-0917-XRE)". Quando a mensagem chega, o CRM ou o atendimento reconhece o código.
3. **Automação "Comente QUERO":**
   - comentário com a palavra-chave dispara uma DM com a ficha da moto daquele post;
   - a conversa nasce já ligada ao post;
   - contar disparos e leads gerados.
4. **Direct:** se a conversa começou como resposta a um story ou compartilhamento de post, ligue ao post de origem. Senão, a origem é "Perfil (sem post)".
5. **Botão "Transformar em lead"** (tela 04): cria o lead no CRM com os campos pré-preenchidos e a distribuição para consultor pelo **rodízio automático** já existente no CRM.
6. **Venda:** uma venda é creditada ao post do lead **mesmo quando é fechada depois do período** analisado.
7. **Tempo até venda:** do primeiro contato até a data da venda. Também contar os leads ainda em negociação.

---

## 4. Tela 01 · Hoje (cockpit) · `Main.html`

Tela inicial do papel. Estrutura de cima para baixo:

1. **Cabeçalho com recepção** (regras completas na seção 14):
   - rótulo mono `Café com a MM · {dia da semana}, {dd de mês}`;
   - H1 com a saudação (ex.: "Bom dia, {nome}. Café passado?");
   - parágrafo com o resumo do dia (posts de hoje, clientes esperando, moto parada há mais tempo);
   - botão primário "Começar o ritual da manhã", que leva à tela 09;
   - à direita, os botões "Ver calendário" e "+ Nova pauta".
2. **Banner de retomada de cadência**: aparece quando o maior intervalo sem post no feed é de 3 dias ou mais. Exemplo: "Retomada de cadência: 18 dias sem post no feed". Mostra o plano da semana e o progresso de posts agendados contra a meta (ex.: 3/5).
3. **Metas da semana** (4 KPIs):
   - Dias com post (x / meta);
   - Resposta a DMs (tempo médio, com chip dentro ou fora da meta);
   - Leads orgânicos (x / meta, com barra);
   - Retenção dos reels (com chip da meta).
4. **Coluna principal:**
   - **Publicar hoje:** hora, formato, título, chip do pilar, código rastreado e status (Agendado em verde ou Aguardando aprovação em amarelo).
   - **Estoque sem conteúdo:** motos com mais dias em estoque e menos posts. Status por dias: Parada (≥ 30 dias e 0 posts), Atenção (≥ 20 dias), Ok. O botão "Gerar pauta" cria uma pauta com origem "Estoque".
   - **Últimos posts vs. mediana:** os 3 mais recentes, com contas alcançadas e múltiplo da mediana de 90 dias.
5. **Coluna lateral:**
   - **Fila de atendimento:** DMs sem resposta, comentários sem resposta e a conversa mais antiga com tempo e assunto. Botão "Abrir atendimento".
   - **Produção:** atrasadas, aguardando aprovação, prontas para agendar.
   - **Insights da semana:** cartões com nível de confiança e um botão que transforma o insight em tarefa ou teste (seção 13).

> O protótipo não mostra o Assistente da aba na tela Hoje, porque a própria recepção e os insights já cumprem esse papel.

---

## 5. Tela 02 · Calendário editorial · `Calendario.html`

- **Cabeçalho:** "Outubro 2026" (mês corrente), alternância Mês/Semana, botão "+ Nova pauta".
- **Assistente da aba** (seção 16).
- **Filtros/legenda** dos 4 pilares.
- **Grade mensal**, semana começando na segunda, com dias de outros meses esmaecidos. Cada dia mostra:
  - os posts como blocos `hora · formato` + título, na cor do pilar;
  - selo **Hoje** com borda prata;
  - **"sem post"** em vermelho nos dias passados sem publicação (fundo `#170F10`);
  - selo **Rajada** com borda vermelha em dias com mais posts do que o limite;
  - **"+ slot livre"** tracejado nos dias futuros vazios dentro do horizonte de planejamento, que ao clicar abre a criação de pauta para aquele dia.
- Arrastar e soltar posts entre dias, revalidando as regras na hora.
- **Painel de regras de cadência** (configuráveis pelo gestor), cada uma com status OK, Ajustar ou Atenção:
  - mínimo de 4 dias com post por semana;
  - máximo de 2 posts por dia;
  - intervalo máximo de 2 dias sem post.
- **Mix de pilares do mês:** percentual planejado contra a meta (padrão: Estoque 40%, Prova social 20%, Educação 25%, Bastidores 15%), com barras. Nota: "Regra 3 para 1: a cada 3 posts de valor, 1 post de oferta direta".
- **Melhores janelas:** dia + faixa horária, calculadas a partir do mapa de calor.
  - Status "Comprovado" com 5 posts ou mais na janela; "Em teste" quando há um teste A/B ativo.
  - Nota: horários de Brasília.

---

## 6. Tela 03 · Produção · `Producao.html`

- **Cabeçalho:** botões "Sugestões do estoque (n)" e "+ Nova pauta".
- **Assistente da aba.**
- **Quadro (kanban)** com 6 colunas: Ideias, Roteiro, Gravação, Edição, Aprovação, Agendado, cada uma com contador.
  - Cartão: chip do pilar, título, formato e prazo. Se atrasada, mostra "Atrasada · {prazo}" em vermelho.
  - Arrastar entre colunas.
  - A coluna Aprovação só avança com a aprovação do gestor quando a regra estiver ligada.
- **Painel de briefing** da pauta selecionada:
  - coluna e título; chips de pilar, formato e origem;
  - os blocos **Gancho (0 a 3s)**, **Retenção (meio)**, **Recompensa (final)** e **Chamada para ação**;
  - **checklist antes de aprovar:** link rastreado gerado, legenda com 300+ caracteres, capa e texto na tela, horário dentro da janela;
  - botões **"Testar como Trial Reel"** (publica como trial reel pela Content Publishing API) e **"Enviar para aprovação"**.
- **Aprovação:** o gestor aprova ou pede ajuste, com comentário opcional, pela web e pelo celular (tela 12). O envio para aprovação notifica o gestor.
- **Publicação:** pauta aprovada e agendada é publicada automaticamente no horário pela API, já com o código e o link rastreado. Se falhar, notifica.
- **Origem automática de pautas:**
  - **Estoque:** moto parada sem conteúdo;
  - **Venda no CRM:** venda fechada gera a pauta "Entrega: {modelo}" no pilar Prova social, com o roteiro de 3 tomadas;
  - **Insight:** pautas criadas a partir de insights;
  - **Audiência:** pautas sugeridas a partir da demografia (ex.: conteúdo para mulheres, que são 46% dos seguidores);
  - **Calendário:** pautas criadas a partir de slots.
- **[CONFIRMAR COM O JOÃO]** como registrar a autorização de imagem do cliente nas entregas.

---

## 7. Tela 04 · Atendimento · `Atendimento.html`

- **Cabeçalho:** tempo médio de resposta e conversas que viraram lead na semana.
- **Assistente da aba.**
- **Três colunas:**
  1. **Lista de conversas:** filtros Todos, Direct e Comentários, com contadores. Cada item mostra nome, idade da última mensagem (vermelha se passou da meta de resposta), prévia da mensagem, canal e moto de interesse.
  2. **Conversa:**
     - cabeçalho com nome e canal, e o cartão "Veio do post {título} · Código {code}" com miniatura;
     - mensagens com bolha de entrada escura e de saída prata;
     - respostas rápidas: Disponibilidade, Simular financiamento, Agendar visita, Aceita troca (editáveis pelo gestor);
     - campo de resposta e botão Enviar. O envio usa a Messaging API, e a resposta a comentários usa a API de comentários.
  3. **Transformar em lead:**
     - campos Nome, WhatsApp, Moto de interesse (pré-preenchida pelo post) e Forma de pagamento (Financiamento, À vista, Consórcio);
     - texto "Origem automática: Instagram orgânico · {code}" e "Consultor: rodízio automático do CRM";
     - botão "Enviar ao CRM".
- **Automações:** "Comente QUERO → ficha da moto no direct" (status, disparos e leads gerados na semana) e "Resposta fora do horário".
- **Regras:**
  - o tempo de resposta é medido do recebimento até a primeira resposta humana; automações não contam;
  - a janela de 24h de mensagens da Meta deve ser respeitada: avise quando estiver perto de fechar.

---

## 8. Tela 05 · Desempenho · `Desempenho.html`

- **Cabeçalho:** período (os mesmos filtros da aba atual: Hoje, 7 dias, Esta semana, 30 dias, Este mês, Mês passado, 90 dias, Personalizado, sempre comparados ao período anterior de mesma duração) e controle **Orgânico | Pago | Total**, que troca todos os valores da tela.
- **Assistente da aba.**
- **Banner de qualidade dos dados:**
  - verde: "Dados completos · X de Y dias sincronizados · N stories capturados";
  - amarelo ou vermelho quando houver lacunas, listando os dias e avisando que as comparações ficam comprometidas.
- **6 KPIs "Os sinais que o Instagram mais pesa"**, cada um com valor, chip de meta/status e texto explicativo curto. Fórmulas na seção 12.
  1. Retenção média
  2. Pulo nos 3 primeiros segundos
  3. Envios por mil alcançados
  4. Salvos por mil alcançados
  5. Curtidas por alcance
  6. Alcance em não seguidores
- **Consistência:**
  - grade de dias do período (seg a dom), com cor por quantidade de posts: 0 → `#1A1A1E`; 1 a 2 → `#2D5BA8`; 3 a 4 → `#4C8DF6`; mais de 4 → `#B42318` (rajada);
  - três números: dias com post / total, maior intervalo e pico de posts num dia.
- **Funil do Instagram até a venda** (substitui o funil atual, que tem erro de lógica). Cada etapa com valor e taxa sobre a anterior:
  - Alcance único do período (não a soma diária)
  - → Visitas ao perfil
  - → Conversas iniciadas (direct + WhatsApp por link rastreado)
  - → Leads no CRM
  - → Vendas
- **Diagnóstico dos reels:** tabela com Reel, Duração, Retenção, Pulo 3s, Envios/mil, vs. mediana e Veredito. Vereditos:
  - "Repetir estrutura": ≥ 2,5× a mediana **e** pulo < 40%;
  - "Bom": ≥ 1,3×;
  - "Gancho fraco": pulo ≥ 60%;
  - "Abaixo": demais casos.
- **Teste em andamento:** hipótese, descrição, amostra atual / alvo com barra. O resultado só é declarado quando a amostra fica completa (seção 13.3).

**Manter as seções da aba atual**, reorganizadas dentro desta tela ou em subabas, aplicando as correções da seção 17:
- evolução diária;
- composição das interações;
- radar de impacto;
- desempenho por formato;
- de onde vem o alcance;
- publicações em destaque;
- hashtags e legendas;
- reels;
- stories;
- desempenho por dia da semana;
- mapa de calor dia × horário;
- seguidores online por hora;
- calendário de publicações;
- crescimento de seguidores;
- audiência;
- tabela "Todas as publicações" com Exportar CSV, ganhando as colunas novas: retenção, pulo 3s, envios/mil, código, leads e vendas.

---

## 9. Tela 06 · Vendas por post · `Atribuicao.html`

- **Cabeçalho:** "Qual conteúdo vende moto" e o período.
- **Assistente da aba.**
- **5 KPIs:** Leads orgânicos, Vendas, Valor negociado, Lead → venda (%), Ticket médio. Os valores em R$ obedecem à regra "Mostrar valores em R$".
- **Banner "O que os dados dizem":** gerado pela regra de concentração (ex.: "42% dos leads vieram de 3 reels de estoque…"), com o botão "Criar pautas no mesmo formato".
- **Tabela de atribuição** com alternância **Por post | Por canal**:
  - colunas: Post/Canal (com subtítulo de formato, data e código), Toques no link, Conversas, Leads, Vendas, Valor negociado (em verde quando há valor, "—" quando não há);
  - **por post:** os posts com leads em ordem decrescente e uma linha final "Outros N posts";
  - **por canal:** Link rastreado → WhatsApp, Direct, Comente QUERO → direct;
  - os totais precisam bater com os KPIs.
- **Leads por formato:** posts, leads e leads por post de cada formato, com o aviso "amostra pequena" quando houver menos de 5 posts.
- **Ciclo de venda:** tempo médio (ou mediano) do primeiro contato à venda e quantidade de leads ainda em negociação. Nota de que vendas posteriores continuam sendo creditadas ao post.

---

## 10. Tela 07 · Permissões (visão do gestor) · `Permissoes.html`

- Fica dentro do menu do gestor: **Equipe → Acessos e permissões**. O menu lateral desta tela é o do sistema completo.
- **Cabeçalho:** "O que o Social Media enxerga" e o botão **"Ver como Social Media"** (modo de pré-visualização do papel).
- **Assistente da aba** (versão do gestor, seção 16).
- **Lista de módulos** com controle segmentado Completo / Leitura / Sem acesso, cada um com a descrição do escopo (seção 3.1).
- **Responsável:** e-mail e botão "Enviar convite".
- **Regras:** os 4 toggles da seção 3.1.
- **Cartão "Conexão do Instagram":** "Conectado pela empresa" e a explicação de que a conta não depende de login pessoal.

---

## 11. Telas de experiência

### 11.1 Tela 08 · Primeiro acesso · `Onboarding.html`

Assistente de 4 passos. À esquerda, a lista de passos com estado (concluído ✓, atual em prata, futuro em cinza) e a nota "Leva menos de 3 minutos. Dá para mudar tudo depois em Preferências".

1. **Boas-vindas:** "Este é o seu espaço de trabalho na MM." e 3 cartões: Todo dia (ritual de 15 min), Toda semana (retrospectiva pronta), Sempre (o trabalho vira venda visível).
2. **Ponto de partida:** "A conta hoje, sem filtro." com os números **reais**: seguidores, leads orgânicos em 30 dias, vendas vindas do Instagram, maior intervalo sem post (em destaque amarelo, com o texto "sua primeira vitória é zerar isso").
3. **Metas da semana:** opções para Dias com post (3, 4 ou 5), Tempo máximo de resposta (15 min, 30 min ou 1h) e Leads orgânicos por semana (20, 30 ou 40). Vem pré-selecionado com a sugestão do sistema baseada nos últimos 90 dias. O gestor vê e pode ajustar.
4. **Seu ritmo:** os três rituais (Modo foco diário às 9h, Retrospectiva na sexta, Planejamento no dia 25) e os canais de aviso (WhatsApp, Celular/app, E-mail).

Botões Voltar e Continuar; no último passo, "Começar meu primeiro dia". Tudo é gravado nas preferências e em `meta_semanal`.

### 11.2 Tela 09 · Modo foco (ritual do dia) · `Foco.html`

- Tela cheia, fundo `bg-focus`.
- **Topo:** "Modo foco · Ritual da manhã", barra segmentada de progresso, contador "n de N" e botão "Sair (Esc)".
- **Uma tarefa por vez:**
  - etiqueta de tipo com cor e tempo estimado;
  - título grande e o "porquê";
  - caixa de conteúdo: resposta sugerida editável, checklist, roteiro ou ação;
  - botão primário com atalho **Enter** e "Adiar para depois" com atalho **A**.
- **Ordem da fila** (gerada no backend):
  1. **Cliente esperando:** conversas acima da meta de resposta, da mais antiga para a mais nova;
  2. **Vai ao ar hoje:** conferência final de cada post agendado para o dia, com o checklist;
  3. **Produção atrasada;**
  4. **Aprender:** o post da véspera, quando acima de 1,5× ou abaixo de 0,5× da mediana, com a sugestão de salvar o gancho na biblioteca.
- Cada ação executa de verdade: enviar a resposta e virar lead, enviar ao CRM, confirmar o agendamento, notificar o consultor, salvar o gancho.
- **Tela de conclusão:**
  - "Manhã resolvida em X minutos." e o próximo compromisso do dia;
  - 3 números: tarefas concluídas, leads enviados ao CRM, sequência de dias com o ritual feito;
  - botões "Voltar ao Hoje" e "Rever o ritual";
  - grava em `ritual_execucao`.
- **Rodapé:** "Uma coisa por vez. O sistema ordena por urgência…".

### 11.3 Tela 10 · Paleta de comandos e atalhos · `Comandos.html`

**Paleta (Ctrl/Cmd + K, de qualquer tela):**
- busca global agrupada em Ações, Estoque, Posts e Conversas, com ícone, título e subtítulo informativo;
- navegação por ↑ ↓, Enter abre e Tab mostra as ações do item;
- as ações podem chamar a IA (ex.: "Gerar 3 ganchos para XRE 300");
- o campo também aceita perguntas em linguagem natural, que vão para o assistente (seção 16.3).

**Atalhos globais:**

| Atalho | Ação |
|---|---|
| Ctrl K | Abrir a paleta |
| F | Começar modo foco |
| N | Nova pauta |
| G H | Ir para Hoje |
| G C | Ir para Calendário |
| G A | Ir para Atendimento |
| L | Responder e virar lead |
| ? | Ver todos os atalhos |

Desative os atalhos de uma letra quando o foco estiver num campo de texto. Mostre o atalho como dica ao passar o mouse sobre o botão correspondente.

### 11.4 Tela 11 · Retrospectiva da semana · `Retro.html`

- Gerada **automaticamente na sexta-feira**, no formato de stories: 5 partes com barra de progresso clicável e botões Anterior/Próximo.
  1. **Título da semana** gerado pelo assistente e as **conquistas** desbloqueadas.
  2. **Metas da semana:** os 4 indicadores com status e a variação contra a semana anterior.
  3. **Post da semana:** maior múltiplo da mediana, com pulo 3s, leads e o "por que funcionou".
  4. **O que você aprendeu:** o teste A/B concluído na semana (comparação em barras, amostra e confiança, sugestão de virar padrão). Se não houver teste concluído, mostrar o maior aprendizado de formato ou horário.
  5. **Próxima semana:** 3 focos gerados a partir dos gaps e os botões "Enviar ao gestor" e "Baixar como imagem" (exportação PNG).
- **Conquistas medem processo, nunca curtidas.** As três iniciais:

| Conquista | Critério |
|---|---|
| Semana sem buracos | Todos os dias da meta com post e nenhuma rajada |
| Gancho de ouro | Pelo menos um reel com pulo nos 3s abaixo de 35% |
| Resposta relâmpago | Tempo médio de resposta na semana ≤ 12 min (ou 80% da meta) |

- A retrospectiva é a base do **relatório semanal ao gestor** (segunda às 8h, quando a regra estiver ligada).

### 11.5 Tela 12 · Celular · `Celular.html`

Versão mobile como **PWA** (instalável, com Web Push). **[CONFIRMAR COM O JOÃO]** se prefere app nativo. Todas as telas são responsivas; estes três fluxos são prioritários no celular:

1. **Notificações "Pulso":**

| Gatilho | Mensagem (exemplo) |
|---|---|
| Post na 1ª hora ≥ 2× a mediana da 1ª hora | "{título} está decolando. 2,1× acima da mediana na 1ª hora. Responda os N comentários agora para manter o ritmo." |
| Venda creditada a um post | "Venda creditada ao seu post. A {moto} vendida hoje veio do reel de {data}. Esse post já soma N leads." |
| Cliente esperando acima da meta | "Cliente esperando há X min. {nome} perguntou sobre a {moto}." |
| Pauta enviada para aprovação | Para o gestor |
| Falha de sincronização ou de publicação | Para o social media e o gestor |

   Os avisos são agrupados para não virar barulho. Só "Cliente esperando" interrompe na hora.
2. **Captura na loja:** abrir a pauta em gravação, ver a tomada atual com instrução, formato e duração máxima e o checklist das tomadas (Enviada, Agora, Pendente), e gravar ou subir direto pela câmera. Ao completar as tomadas, a pauta avança para Edição.
3. **Aprovação do gestor:** fila "Para aprovar · N", com o horário de publicação em destaque, prévia do post, metadados (legenda, link rastreado, pilar, horário), comentário opcional e os botões "Pedir ajuste" e "Aprovar".

### 11.6 Tela 13 · Recepção · `Recepcao.html`

Contém o simulador de momentos, que é um artefato de design, e as regras. No produto, isso se traduz no **motor de saudação** da seção 14. Recomendo construir também o simulador numa rota interna só para o gestor, para revisar as frases.

---

## 12. Definições de métricas (fórmulas)

| Métrica | Fórmula | Meta padrão |
|---|---|---|
| Retenção média (reels) | média de `tempo_medio_s / duracao_s` dos reels do período | 45% |
| Pulo nos 3s | média da taxa de pulo da API, ponderada por views | abaixo de 40% |
| Envios por mil | `Σ envios / Σ alcance × 1000` | 3,0 |
| Salvos por mil | `Σ salvos / Σ alcance × 1000` | 3,0 |
| Curtidas por alcance | `Σ curtidas / Σ alcance` | 3% |
| Alcance em não seguidores | alcance de não seguidores / alcance total, **na fonte selecionada** | informativo |
| Taxa de engajamento | interações / alcance dos posts do período | informativo |
| Mediana de alcance | mediana do alcance dos posts dos últimos 90 dias (orgânico) | referência |
| Múltiplo da mediana | alcance do post / mediana | |
| Dias com post | dias distintos com ao menos 1 post no feed | meta semanal |
| Maior intervalo | maior sequência de dias sem post no feed | ≤ 2 dias |
| Rajada | dia com mais posts que o máximo configurado (padrão 2) | 0 |
| Tempo de resposta | mediana entre a mensagem recebida e a 1ª resposta humana | ≤ 15 min |
| Conversas iniciadas | conversas de direct novas + mensagens de WhatsApp com código | |
| Lead → venda | vendas / leads orgânicos do período | |
| Ticket médio | valor negociado / vendas | |

- Os números pequenos por alcance usam "por mil" ou 2 casas decimais. **Nunca mostrar "0,0%" para um valor que não é zero** (bug atual: compartilhamento de reels 0,05% aparecia como 0,0%).
- Todas as metas são editáveis pelo gestor.

---

## 13. Motor de insights e sugestões

### 13.1 Estrutura

Cada insight tem:
- `tipo`: urgente, atenção, oportunidade, ponto forte, aprendizado ou observação;
- `aba` onde aparece;
- título;
- texto;
- `confianca`: alta, média, baixa, hipótese;
- tamanho da amostra;
- ação (rótulo + operação executável);
- validade.

Ao clicar na ação, ela executa, o cartão fica no estado "Feito · desfazer em 5s" e a ação pode ser desfeita.

### 13.2 Regras de qualidade (obrigatórias)

- **Amostra mínima:** afirmações comparativas exigem pelo menos 5 posts por grupo. Com 3 a 4 posts, vira "Hipótese · confiança baixa (N posts)" e a ação sugerida é **validar com um teste**. Grupos de 1 a 2 posts nunca geram insight. Exemplo: "Carrosséis 2,2× melhores" com 3 carrosséis deve aparecer como hipótese, nunca como fato.
- **Lacunas de dados:** se o período tiver dias sem sincronização, insights de queda ou alta precisam avisar ("pode estar afetado por N dias sem dados") ou ser suprimidos quando mais de 20% dos dias faltarem.
- **Pago vs. orgânico:** comparações de alcance usam o orgânico, a menos que a tela esteja em Pago ou Total.
- **Sem contradição:** o sistema não pode mostrar ao mesmo tempo "Meta de frequência cumprida" e "18 dias sem publicar" (bug atual). A meta de frequência passa a ser **dias com post**, não contagem de posts.

### 13.3 Testes A/B

- Criados a partir de insights ou manualmente: hipótese, variável, grupos, amostra alvo (padrão 6, ou seja 3 por grupo).
- Os posts são marcados pelo calendário e pela produção. O resultado só é declarado com a amostra completa.
- Trial Reels podem ser usados para testar ganchos sem afetar o feed.
- Testes concluídos alimentam a retrospectiva e as "Melhores janelas".

### 13.4 Regras de insight (mínimo a implementar)

| Aba | Regra | Exemplo de saída |
|---|---|---|
| Hoje / Calendário | Maior intervalo sem post ≥ 3 dias | Banner de retomada |
| Calendário | Dia com posts acima do máximo | "Rajada: mover {post} para {dia livre mais próximo}" |
| Calendário | Dias futuros vazios que quebram o intervalo máximo | "19 a 23/10 sem posts. Separei N pautas do estoque" |
| Calendário | Pilar abaixo da meta do mix por 5 pontos ou mais | Sugere uma pauta do pilar num slot livre |
| Hoje / Calendário | Pico de seguidores online fora das faixas onde se publica | "Pico às 17h, quase nada depois das 15h" → criar teste |
| Produção | Pauta atrasada | "Atrasada: {pauta}" → avisar responsável ou consultor |
| Produção | Pauta em aprovação há mais de 24h | Lembrar o gestor |
| Produção | Roteiro sem gancho da biblioteca | Sugerir o gancho com menor pulo médio |
| Atendimento | Conversa acima da meta de resposta | Responder agora (com resposta sugerida pela IA) |
| Atendimento | Conversa com intenção de compra (simulação, preço, financiamento) sem lead | "Pronta para lead" |
| Atendimento | Mesma pergunta 3+ vezes na semana | Criar resposta rápida e uma pauta sobre o tema |
| Desempenho | Pulo médio acima da meta | Comparar ganchos dos melhores e piores reels |
| Desempenho | Envios por mil abaixo da meta | Testar uma CTA de envio |
| Desempenho | Dados completos | Ponto forte "dados confiáveis" |
| Vendas por post | Top 3 posts com 30%+ dos leads | Banner de concentração e "Criar pautas no mesmo formato" |
| Vendas por post | Leads orgânicos em negociação | Avisar o time comercial |
| Vendas por post | Formato com menos de 5 posts | Agendar teste |
| Estoque | Moto ≥ 20 dias em estoque sem post | Gerar pauta |
| Permissões (gestor) | Aprovações paradas | Ativar aviso no celular |
| Permissões (gestor) | Leitura do Tráfego desligada | Sugerir liberar para separar orgânico de pago |

---

## 14. Motor de saudação (recepção)

### 14.1 Onde aparece

No cabeçalho da tela 01, a cada abertura do sistema ou volta à aba após 30 min ou mais de inatividade.

### 14.2 Momentos e prioridade (o primeiro que se aplicar vence)

| Prioridade | Momento | Gatilho | Kicker | Saudação (exemplo) | CTA |
|---|---|---|---|---|---|
| 1 | Volta de folga | Mais de 2 dias sem acessar | "Bem-vindo(a) de volta" | "Que bom te ver de volta, {nome}." + resumo do período fora | "Colocar em dia em 10 minutos" → Foco |
| 2 | Venda creditada | Venda atribuída desde o último acesso | "Notícia boa logo cedo" | "Bom dia, {nome}. Tem venda com a sua assinatura." | "Ver vendas por post" |
| 3 | Semana difícil | Alcance dos 3 últimos posts abaixo de 0,7× da mediana, ou metas atrasadas na quarta-feira | "Vamos por partes" | "Semana pesada, um passo de cada vez." + hipótese | "Ver a hipótese" |
| 4 | Sexta-feira | Sexta, retrospectiva pronta | "Fechamento da semana" | "Sexta, {nome}. Sua retrospectiva está pronta." | "Abrir a retrospectiva" |
| 5 | Segunda-feira | Primeiro acesso da semana | "Começo de semana · {data}" | "Semana nova, calendário pronto." + metas | "Abrir o calendário" |
| 6 | Manhã | Antes das 12h | "Café com a MM · {data}" | "Bom dia, {nome}. Café passado?" + resumo | "Começar o ritual da manhã" |
| 7 | Tarde | 12h às 18h | "Depois do almoço · {data}" | "Boa tarde, {nome}. O que temos para a tarde?" + o que a manhã entregou | "Ver a tarde" |
| 8 | Noite | Depois das 18h | "Fim de expediente" | "Boa noite, {nome}. Hora de desligar." | "Ver o resumo do dia" |

Além da saudação, cada momento mostra três cartões ("O que temos para hoje", "Para as próximas horas", "Amanhã cedo", "Enquanto você esteve fora", conforme o caso) e três perguntas sugeridas para o assistente. Os textos de cada momento estão em `Recepcao.html`, no array `M` do script.

### 14.3 Regras

1. **Útil antes de simpática:** toda saudação traz pelo menos uma informação que muda o dia.
2. **Nunca repetida:** cada momento tem um banco de 8 a 10 variações (`saudacao_frase`), e a mesma frase não volta antes de 7 dias para o mesmo usuário. As partes de contexto (números, nomes, posts) são preenchidas na hora, por template ou pela IA.
3. **O tom acompanha o dia:** semana boa celebra, semana difícil acolhe sem cobrança, à noite libera.
4. **Some quando a pessoa começa:** depois da primeira ação, o bloco recolhe numa linha.
5. **Respeita o expediente:** fora do horário configurado, nenhuma pendência em vermelho. Só o resumo e o que espera amanhã.

Guarde no cadastro o **nome e a forma de tratamento** da pessoa, para a concordância de gênero (ex.: "Bem-vindo" ou "Bem-vinda").

---

## 15. Detalhes de experiência obrigatórios

1. **Desfazer em vez de confirmar:** ações reversíveis executam na hora e mostram um toast com "Desfazer" por 5s. Confirmação só para o que é destrutivo e irreversível.
2. **Estados vazios que ensinam:** todo vazio diz o próximo passo e traz um botão (ex.: "Nenhuma pauta aqui. Puxe uma do estoque").
3. **Esqueletos de carregamento** em vez de spinners de tela inteira. Nada de tela travada.
4. **Textos em tom humano,** curtos, sem jargão técnico.
5. **Tema claro e escuro** como preferência do usuário.
6. **Notificações agrupadas,** conforme a seção 11.5.
7. **Comemorações discretas:** só em marcos reais (meta batida, conquista, venda creditada). Nada de confete a cada clique.
8. Banner "Dados completos" ou "Dados com lacunas" sempre honesto.

---

## 16. Assistente da aba (componente único) · `Assistente.html`

### 16.1 Onde aparece

No topo das telas 02, 03, 04, 05, 06 e 07, logo abaixo do cabeçalho.

### 16.2 Estrutura

- Avatar "A", rótulo mono "Assistente · {nome da aba}" e a frase de leitura do momento.
- Botão **Recolher/Abrir** (`aria-expanded`). Recolhido, mostra só a frase numa linha com reticências. **O estado fica salvo por usuário e por aba.**
- **3 cartões de sugestão:** chip do tipo (cores da seção 2.1), texto e botão de ação. Depois de executar, o cartão fica verde com "Feito · desfazer em 5s".
- **Linha "Pergunte:"** com 3 perguntas sugeridas. Ao clicar, abre a conversa com o assistente (16.3) já com a pergunta.
- Componente **único**, parametrizado por `aba`. O conteúdo vem do motor de insights (seção 13), em ordem de prioridade e respeitando as regras de confiança.

### 16.3 Assistente de IA

- **Usos:**
  - redigir as frases (saudação, leitura do momento, título da retrospectiva);
  - respostas sugeridas no atendimento;
  - ganchos e roteiros a partir da ficha da moto (quando a regra estiver ligada);
  - responder perguntas em linguagem natural na paleta e no assistente da aba.
- **Contexto passado à IA:** só os dados que o papel pode ver. **A IA nunca recebe custo, margem ou financeiro.**
- **Números vêm do banco, nunca inventados pela IA:** a IA redige em cima de valores calculados.
- **[CONFIRMAR COM O JOÃO]** qual provedor e modelo usar (o Pró-Labore já tem um "Assistente Comercial"; reaproveite a mesma integração).

### 16.4 Conteúdo de exemplo por aba

Está no objeto `D` do script de `Assistente.html` (frase, 3 sugestões e 3 perguntas para calendário, produção, atendimento, desempenho, atribuição e permissões). Use como texto inicial e como teste de aceite: com dados equivalentes, o motor deve produzir saídas equivalentes.

---

## 17. Correções da aba atual (todas obrigatórias)

1. Falha "API access blocked": conexão pela empresa, alertas e nova tentativa (3.2).
2. Sincronização congelada sem aviso nas análises: banner de qualidade e insights cientes das lacunas (13.2).
3. Meta de frequência contraditória ("44 de 13 cumprida" ao lado de "18 dias sem publicar"): trocar por dias com post e maior intervalo.
4. Funil errado ("Leads = 42,9% dos novos seguidores" e alcance como soma diária): novo funil (seção 8).
5. Interações divergentes (1.677 no cartão contra 1.603 na composição): unificar a fonte, ou explicar a diferença em nota se forem métricas distintas (por exemplo, posts do período contra toda a conta).
6. "0,0%" para valores pequenos: usar "por mil" ou mais casas decimais.
7. Insights com amostra pequena apresentados como fato: aplicar as regras de 13.2.
8. Miniaturas quebradas em "Publicações em destaque": cache próprio.
9. Stories nunca registrados: captura de hora em hora.
10. Linha do "período anterior" desalinhada no gráfico de evolução diária: alinhar por índice do dia do período (dia 1 com dia 1).
11. Pago misturado com orgânico (anúncios = 56% do alcance): controle Orgânico/Pago/Total.
12. "Seguidores gerados n/d" nos reels: preencher quando a API fornecer; quando não fornecer, explicar o motivo numa dica.

---

## 18. Fases de construção e checklist de aceite

Construa nesta ordem. Ao fim de cada fase, rode testes, revise contra o protótipo e marque o checklist. **Não pule itens.**

### Fase 0 · Base confiável
- [ ] Mapeamento do repositório e plano de encaixe entregues
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
