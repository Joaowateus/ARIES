---
name: AUDITORIA_PRO_LABORE_2026_10
purpose: >
  Registro da auditoria visual e de uso de todas as abas do painel
  Pró-Labore (outubro de 2026): o que foi medido, as referências de mercado
  usadas, o que já mudou e o que fica para as próximas fases.
responsibility: Frontend do Pró-Labore.
relationships:
  - docs/12-ux/design-system.md
version: 1.0.0
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
