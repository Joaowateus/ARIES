---
name: AUDITORIA_PRO_LABORE_2026_10
purpose: >
  Registro da auditoria visual e de uso de todas as abas do painel
  Pró-Labore (outubro de 2026): o que foi medido, as referências de mercado
  usadas, o que já mudou e o que fica para as próximas fases.
responsibility: Frontend do Pró-Labore.
relationships:
  - docs/12-ux/design-system.md
version: 1.7.0
status: ativo
---

# Auditoria do painel Pró-Labore — outubro de 2026

## Como foi feita

- **Abas:** as 18 abas do dono, em notebook (1440×900, claro) e celular (390×844, escuro).
  - Dashboard, Copiloto, CRM, Reativação, Agenda, Reuniões, Anotações, Vendas e Financeiro.
  - Social Media, Tráfego, Assistente, Vendedores, Ocorrências, Acessos, Indicadores, Plano e Configurações.
- **O que foi medido em cada aba:**
  - erros no console;
  - rolagem lateral no celular;
  - fonte que de fato carregou;
  - altura da página;
  - chamadas à API.
- **Referências de mercado:**
  - Linear e Vercel: tipografia, menu, Ctrl K;
  - Stripe: números e cards de indicador;
  - Pipedrive e HubSpot: quadro do CRM em primeiro lugar e painel lateral do lead;
  - Raycast: paleta de comandos.

## O que mudou nesta fase

| Área | Antes | Agora |
|---|---|---|
| Fontes | 4 famílias (Sora, Manrope, Plex Sans, Plex Mono) por `@import` do Google Fonts, que travava a primeira pintura | Geist e Geist Mono pelo `next/font`, sem requisição externa. Ficam em tokens `--pl-font-sans/display/num/mono` |
| Números | Fonte monoespaçada em todo valor, pesada e larga | Geist com algarismos tabulares, que alinham em coluna como no Stripe. A mono ficou só para código e atalho |
| Títulos | 32px/800 com tracking −0,02em | 30px/700 com tracking −0,035em. Seções com 19px e cards com 15px |
| Chips e botões | Chip mono com canto 10px; botão em 700 | Chip em Geist, formato pílula; botão em 600 |
| Botão primário no escuro | Prata #c7cbd1, que parecia desabilitado | Quase branco #e8eaee |
| Menu lateral | Os 18 itens não cabiam em 900px de altura (o grupo "Sistema" ficava escondido) | Itens mais densos e tudo visível. Subtítulo "Gestão comercial" no lugar de "Liquidez & pró-labore", que era cortado |
| Busca | Nenhuma | Paleta **Ctrl K** (ou o botão "Buscar…"; no celular, a lupa no topo) para ir a qualquer aba, achar lead por nome, telefone ou moto, cadastrar lead e abrir "WhatsApp fora do CRM" |
| Dashboard | 7 indicadores em 6 colunas, com um card sozinho na segunda linha | 7 numa fileira só. No vendedor, os 4 ocupam a linha inteira |
| Dashboard no celular | Rolava de lado (463px numa tela de 390). Meses quebravam em 4 linhas | Etapas rolam juntas dentro do card. Meses numa faixa que já abre no mês escolhido |
| CRM | Métricas por etapa (R$, conversão, metas) antes do quadro, que só aparecia depois de ~850px | Resumo numa linha (oportunidade, comissão prevista e perdida, etapas fora da meta) e o quadro logo abaixo. As métricas abrem sob demanda e a escolha fica salva |
| Cabeçalho das páginas | Ações alinhadas ao topo do rótulo | Ações alinhadas à base do título; quando não cabem, descem |

## Achados que ficam registrados

- **Limite da API por IP (resolvido em 26/10).**
  - Antes: 200 chamadas por minuto por IP. Na loja todo mundo sai pelo mesmo IP, e cada aba fazia ~12 chamadas.
  - Agora: quem está logado (token válido) conta pelo próprio login, com 300 por minuto. Sem login, ou com token inválido, continua pelo IP com 200. Os webhooks do WhatsApp seguem fora do limite.
  - Os quatro selos do menu lateral (ao vivo, pedidos de reunião, follows do dia e avisos do Instagram) viraram uma chamada só, `GET /barra-lateral`.
  - Com a aba do navegador escondida, o menu, o Copiloto, o "Meu dia", o Assistente e as Reuniões param de consultar. O menu atualiza na hora quando a pessoa volta.
  - Resultado: o Dashboard caiu de ~12 para ~9 chamadas por abertura, e cada pessoa tem o próprio limite.
- **Rótulos longos nos indicadores** (ex.: "Gasto com anúncios") quebram em 2 linhas e desalinham o valor entre os cards. É aceitável hoje. Dá para resolver com subgrid quando o Dashboard for redesenhado.
- **Lint antigo:** `set-state-in-effect` e `exhaustive-deps` no Mapa Mental, no layout e no Dashboard. Nenhum vem das mudanças desta fase.

## Visual 2027 — versão minimalista (26/10)

A primeira versão do Visual 2027 trazia degradê violeta → azul, vidro, brilho e sombras. O dono pediu duas mudanças:
- trocar a cor da marca por um degradê de branco para cinza;
- um layout mais minimalista e objetivo, principalmente em formas e sombras, com mudança real de estrutura e não só de cor.

### Tokens (em `.pl-app`, claro e escuro)

| Grupo | Como ficou |
|---|---|
| Cor da marca | `--pl-grad-brand`. No escuro (tema padrão) é branco → cinza (#ffffff → #b4b4bc) com texto escuro. No claro o mesmo degradê fica invertido (grafite → cinza, #52525b → #18181b) com texto branco, porque branco sobre fundo branco some. Aparece só no botão principal, no item ativo do menu, no filtro escolhido, no dia escolhido da Agenda, na etapa atual do lead e no "Avançar" do quadro |
| Neutros | Cinza puro, sem puxar para azul. Moldura (`--pl-frame`), painel do conteúdo (`--pl-bg`), cards (`--pl-surface`) e raia do quadro do CRM (`--pl-lane`) |
| Destaque | `--pl-accent` passa a ser a própria tinta forte (quase branco no escuro, quase preto no claro). Links são texto com sublinhado discreto |
| Formas | Raios de 12, 10, 8 e 6px (`--pl-radius-xl/lg/md/sm`). Filtros e botões com 7–8px, sem pílula |
| Sombras | Nenhuma em card, botão, filtro ou indicador: a separação é a borda de 1px. Sombra só em janela, gaveta e paleta (`--pl-shadow-pop`). Sem vidro e sem brilho |
| Categóricas e status | Iguais (validadas para daltonismo). Nos indicadores, a cor aparece só num ponto de 6px ao lado do rótulo |

### Estrutura

- **Moldura e painel:**
  - o menu lateral fica rente à borda, sobre a moldura cinza, sem caixa própria;
  - o conteúdo fica num painel com borda de 1px e cantos de 12px.
- **Barra do topo:** fica dentro do painel, com 52px de altura. Tem o caminho ("Vendas / CRM") à esquerda, e a busca Ctrl K e o tema à direita.
- **Pessoa logada e sair:** foram para o rodapé do menu, com avatar, nome e papel.
- **Grupos do menu** em texto simples (Vendas, Rotina, Marketing, Gestão, Equipe, Sistema). A seta de recolher aparece ao passar o mouse.
- **Cabeçalho das páginas:**
  - título de 24px e descrição numa linha só, com ações à direita;
  - um traço separa o cabeçalho do conteúdo;
  - o rótulo acima do título saiu, porque o grupo já está no caminho;
  - Acessos, que usa os componentes do Social Media, segue o mesmo padrão.
- **Indicadores:** viraram uma faixa única com divisórias de 1px (Dashboard, Financeiro, Agenda, Ocorrências e Plano), em vez de cards soltos.
- **Abas da página** (Copiloto, Central do Assistente): passaram a ser sublinhadas. No celular, rolam de lado numa linha só. As alternâncias dentro de cards continuam como controle segmentado.
- **Outros ajustes:**
  - Vendedores: as ações da tabela quebram linha em vez de passar do espaço;
  - Anotações: os atalhos de criar perderam o fundo colorido, e a cor fica só no ícone.
- **Celular:**
  - o menu vira gaveta, com o tema e a pessoa logada no rodapé;
  - a busca vira a lupa no topo.

## CRM — notas da negociação (27/10)

Pedido: um espaço para anotar o que acontece na negociação com o lead, visível ao clicar no card.

- **No painel do lead** (abre no clique do card), logo abaixo dos dados, fica a seção **Notas da negociação**:
  - um campo para escrever (Ctrl + Enter salva) e a lista com a nota mais nova em cima;
  - cada nota mostra quem escreveu e quando, e aparece "editada" se mudou depois.
- **No card:**
  - um selo com o ícone de nota mostra quantas notas o lead tem;
  - o botão de nota, na barra de ações que aparece ao passar o mouse, abre o painel com o campo já em foco.
- **Quem pode o quê:**
  - quem enxerga o lead lê todas as notas, e o vendedor só enxerga os próprios leads;
  - só quem escreveu a nota, ou o dono, edita ou apaga;
  - quem só pode ver o CRM não vê o campo de escrever.
- **Observação do cadastro:** continua separada, com esse nome. É o campo do cadastro, que a captura do WhatsApp já preenche sozinha.
- **IA:** as notas não vão para nenhuma IA, porque podem ter valores e dados que o cliente contou.
- **Dados técnicos:**
  - modelo `LeadNota`, que é apagado junto com o lead;
  - rotas `GET/POST /pro-labore/leads/:id/notas` e `PATCH/DELETE /pro-labore/leads/notas/:id`;
  - a contagem vem no `GET /leads` (`_count.notas`).

## Conversas — ouvir áudios e ver fotos (27/10)

- O webhook do WhatsApp registra o áudio e a foto de cada mensagem gravada, recebida ou enviada pelo celular do vendedor.
- O arquivo é baixado na hora pela Evolution (`getBase64FromMediaMessage`), com prazo de 5 s.
  - Se não der, fica pendente e baixa quando alguém abre a conversa.
  - Depois de 3 tentativas sem arquivo, fica "indisponível": o WhatsApp apaga a mídia depois de um tempo.
- **Onde fica o arquivo:** no Vercel Blob (privado; se o store não aceitar, público com sufixo aleatório) ou no banco quando não há Blob. O endereço nunca vai para o navegador.
- **Rota:** `GET /pro-labore/assistente/midias/:mensagemId`, com login e no escopo da conversa.
- **O que não acontece:** conversa pessoal do vendedor continua sem nada guardado, e nada vai para a IA.
- **Na bolha da conversa:**
  - o áudio aparece como "Ouvir áudio · 0:07", toca no próprio painel e tem a opção "Baixar";
  - a foto carrega quando aparece na tela e abre em tamanho real.

## Processo de atendimento (27/10)

- **Aba "Processo" no Assistente**, logo depois de Conversas. É o guia da loja:
  - links oficiais;
  - fluxo do atendimento, com etapas e prazo;
  - respostas prontas por etapa;
  - regras e combinados.
- **Quem faz o quê:** o dono edita (pode começar com um modelo de loja de motos); a equipe lê e copia.
- **Na conversa:** o botão "Respostas do processo", ao lado do Enviar, preenche a mensagem e troca `{cliente}` e `{vendedor}` pelos nomes.
- **Rotas:** `GET/PUT /pro-labore/processo` (o PUT é só para o dono). Não vai para a IA.

## Ligações auditáveis (27/10)

- **Aba "Ligações" no menu**, em Vendas, com selo de atrasadas e de hoje. Tem três partes:
  - **Para ligar:** a fila do dia, com atrasadas, hoje e próximos dias.
  - **Auditoria:** para o dono e o supervisor.
  - **Cadências:** para o dono.
- **Cadência:** são passos como "5 min depois", "D+1 às 10h" e "D+3 às 10h", cada um com o que falar.
  - **Como começa:** sozinha no lead novo (todo lead, só de anúncio ou só do WhatsApp) ou à mão pelo painel do lead.
  - **Fora do horário:** passo de "minutos depois" que cai fora do horário vai para as 9h seguintes.
  - **Quando para:**
    - quando o cliente atende (opcional);
    - em número errado;
    - quando o lead fecha ou é perdido.
- **Ligar:** abre o discador (`tel:`) e registra a hora, quantas vezes e de qual aparelho.
- **Registrar:** o resultado é obrigatório.
  - "Atendeu" pede a duração e o que foi falado.
  - "Pediu retorno" cria a próxima ligação.
- **Alertas gravados no registro:**
  - sem discar;
  - duração maior que o tempo desde a discagem;
  - "atendeu" menos de 20 s depois de discar;
  - registros em série (menos de 45 s);
  - fora do horário (antes das 7h ou depois das 21h);
  - atraso de mais de 2 h.
- **Auditoria por pessoa:**
  - previstas, no prazo, atrasadas, não feitas, atendidas e com alerta;
  - tempo até ligar e duração média;
  - a lista "Para conferir".
- **Onde mais aparece:**
  - no painel do lead: a próxima ligação, agendar, iniciar cadência e o histórico;
  - no card: a próxima ligação;
  - no Meu dia: Ligar e Registrar.
- **Limite:** prova de que a ligação aconteceu (registro da operadora e gravação) só com uma central telefônica integrada. O sistema prova a discagem pela tela e a coerência do registro.

## Aviso de ligação (27/10)

A ligação automática pelo WhatsApp do vendedor não é possível pela Evolution (ela não faz chamadas de voz). No lugar, o sistema avisa quem vai ligar, para não esquecer.

- **Pelo WhatsApp, na hora marcada** (até 5 min antes):
  - o dono recebe pelo Aries, quando conversa com ele e deixou os avisos ligados;
  - o vendedor recebe no Aries (se tiver vínculo) ou no chat "Você" do assistente dele;
  - a mensagem traz o lead, a hora, o passo da cadência, o telefone, o que falar e o link para registrar;
  - as ligações da mesma pessoa vão juntas numa mensagem só.
- **Lembrete:** 30 min depois, se a ligação continuar sem registro. Vai uma vez só.
- **Quando não avisa:**
  - antes das 7h ou depois das 21h (Brasília);
  - ligação marcada há mais de 3 h (lembrete: mais de 6 h), para não chegar uma enxurrada de antigas.
- **Atraso em produção:** o job roda a cada 15 min, então a mensagem pode chegar até ~15 min depois da hora. O aviso na tela não depende do job.
- **Na tela, em qualquer aba** (canto inferior direito), quando chega a hora:
  - Ligar, Registrar, Adiar 15 min e fechar (volta em 10 min);
  - depois de tocar em Ligar, o aviso pede o registro.
- **No computador:** com a permissão do navegador ("Avisar também no computador"), aparece uma notificação do sistema, uma vez por ligação, mesmo com outra aba aberta.
- **Adiar:**
  - empurra a ligação, avisa de novo na nova hora e conta o adiamento;
  - a auditoria mostra "adiou Nx";
  - 3 adiamentos ou mais levam a ligação para "Para conferir".

## Follow por fluxos e crédito recusado (27/10)

**Fluxos automáticos por situação** (Assistente › Follow). Cada fluxo tem até 5 passos e liga e desliga sozinho:

| Fluxo | Quando entra | Dias de cada passo | Padrão |
|---|---|---|---|
| Parou de responder | Sumiu depois da resposta do vendedor, sem simulação | 1 a 30 | ligado |
| Depois da simulação | Recebeu a simulação (do robô ou do vendedor) e sumiu | 1 a 30, contando da simulação | ligado, avisa o vendedor no fim |
| Depois da aprovação | Recebeu a pré-análise aprovada e sumiu | 1 a 30, contando do envio | ligado, avisa o vendedor no fim |
| Resgate de perdido | Lead perdido (fora "comprou em outro lugar", "desistiu" e "sem crédito") | 3 a 180, contando da perda | desligado |

- **Fluxo fixo:** o fluxo é escolhido no 1º passo e fica até o cliente responder. Respondeu, recomeça pelo ponto de agora. A sequência antiga em andamento continua no fluxo geral.
- **Mídia por passo:** só texto, foto ou vídeo da moto de interesse (aba Estoque), ou imagem própria. A imagem própria é enviada pela tela e reduzida no navegador, e a mensagem vai como legenda.
- **Links das redes:** o editor tem "Inserir" com {nome}, {moto}, {vendedor} e os links da aba Processo. O link entra como palavra solta, para o WhatsApp deixar clicável.
- **Fim do fluxo:** opcional, "criar follow para o vendedor ligar". Dispara 2 dias depois do último passo sem resposta, só se o lead não tiver outro follow pendente.
- **Taxa de resposta:** por fluxo, nos últimos 30 dias. Conta como resposta o cliente escrever em até 3 dias depois da mensagem, e mostra quantos passaram para o vendedor.
- **Regras que continuam:** só conversa já assumida, 1 mensagem por dia por lead, teto por número, segunda a sábado no horário. Para quando o cliente pede.

**Crédito recusado** (follow do vendedor, nunca mensagem automática):
- **Quando cria:** quando nenhum banco aprovou (pelo menos uma recusa, nenhuma aprovada, nenhuma em análise). O follow "Nova análise" é marcado para daqui a 30 dias, às 10h (configurável de 7 a 120 dias, ou só à mão).
- **Quando cancela:** se algum banco aprova, ou se a venda fecha. O follow cancelado pelo vendedor não volta sozinho para a mesma recusa.
- **Na ficha da conversa:** marcar, remarcar ou cancelar (15, 30, 45 ou 60 dias).
- **No dia:**
  - aviso no WhatsApp do vendedor (Aries ou chat "Você"), com o link que abre o follow no CRM;
  - aparece no card ("Nova análise…"), no Meu dia e no menu.
- **No follow:**
  1. Chamar o cliente, com a mensagem pronta da config ou "Abrir no WhatsApp".
  2. Com a autorização nova do cliente, reabrir a pré-análise: as recusas voltam para "a enviar" (a recusa anterior fica na observação) e a nova autorização fica na ficha.
- **Privacidade:**
  - o nome dos bancos fica no contexto do follow, fora da nota que o Aries e os resumos leem;
  - o aviso no WhatsApp não cita banco nem restrição;
  - nada disso vai para a IA.
- **Convive com o follow comum:** agendar um follow comum não cancela a nova análise.

**Mensagem pelo WhatsApp em qualquer follow:**
- "Mandar mensagem" sai pelo WhatsApp do vendedor (conversa do sistema), com as respostas prontas da aba Processo.
- Já dá o follow como feito e pode agendar o próximo.
- Sem conversa no sistema, abre o WhatsApp com o texto pronto.

## Anotações: salvar texto longo e virar mapa mental (29/10)

- **"Erro ao salvar" ao colar textos longos:**
  - **Causa:** o texto colado inteiro virava um bloco só e passava do limite de 5 mil caracteres por bloco. O erro ainda descartava a edição.
  - **Agora, ao colar:** cada linha vira um bloco, com títulos (#), listas, numeração e o recuo das sublistas reconhecidos.
  - **Novos limites:** 20 mil caracteres por bloco e 200 mil por página.
  - **Quando der erro:** a edição volta para a fila e o sistema tenta de novo 3 vezes. A mensagem do erro aparece, com "Tentar de novo".
  - **Ao sair da página:** o que estiver pendente é salvo antes de sair.
- **Transformar em mapa mental:**
  - **Onde:** um botão na página. Também aparece uma oferta logo depois de colar um texto com 4 linhas ou mais.
  - **Como monta (sem IA):** a ideia central é o título da página. Os títulos viram ramos e subtítulos. A linha que introduz uma lista (ex.: "responder a três perguntas:") recebe os itens como filhos, e as sublistas recuadas descem um nível.
  - **Texto longo:** fica encurtado no nó, com até 140 caracteres.
  - **Onde salva:** o mapa é criado na mesma pasta e abre no layout de mapa mental. A página original continua.

## Próximas fases (mesmo pedido)

- **D — Copiloto Comercial:**
  - "próxima melhor ação" priorizada por lead, no estilo HubSpot Breeze e Pipedrive AI;
  - layout em blocos (Hoje, Conversas, Estudar, Evolução).
- **E — Agenda:**
  - linha do tempo "Meu dia", que junta tarefas, follows do CRM, leads esperando no WhatsApp e o plano do Copiloto;
  - visão de semana;
  - adicionar rápido.
- **F — Agente no WhatsApp, no estilo do Pierre:**
  - número próprio com foto (a logo);
  - responde como pessoa, com os dados das abas do usuário;
  - sem valores em reais para a IA.
