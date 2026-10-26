---
name: ARIES_WHATSAPP
purpose: >
  Como funciona e como ativar o Aries, o agente do Pró-Labore no WhatsApp:
  um número só dele, com a logo da loja, que conversa com o dono e com a
  equipe como uma pessoa.
responsibility: Produto Pró-Labore.
relationships:
  - docs/13-ai-agents/agent-catalog.md
version: 1.0.0
status: ativo
---

# Aries no WhatsApp

Inspirado no Pierre (o assistente financeiro da CloudWalk). O Aries fica numa conversa separada do WhatsApp de vendas e usa a logo da loja como foto. Ele:

- **Responde** com os números do sistema:
  - quem atender agora (a fila do Copiloto);
  - a agenda do dia (rotinas, follows e tarefas);
  - o plano do Copiloto;
  - os números do dia, da semana e do mês;
  - leads quentes, follows e quem está esperando;
  - a situação de um lead;
  - a ficha de uma moto e simulações.
- **Anota** na agenda. Exemplo: *anota: ligar pro banco às 15h* entra no "Meu dia".
- **Avisa**:
  - manda o resumo da manhã no horário escolhido;
  - avisa quando um lead está esperando (o aviso sai pelo Aries em vez do chat "Você").
- **Para o dono**, também responde sobre vendas do mês, equipe, tráfego e financeiro.

## Ativar

1. **Conectar o número.** Em **Configurações › Aries no WhatsApp**, clique em **Conectar número do agente** e leia o QR com um chip só para o agente.
   - Não use o seu WhatsApp pessoal nem o de vendas.
   - Ao conectar, o sistema aplica o nome "Aries", o recado e a foto (a logo `sm-icone-512.png` do site).
   - Para outra imagem, defina `AGENTE_FOTO_URL` no projeto da API na Vercel.
2. **Vincular cada pessoa.** Clique em **Gerar código** para a pessoa. Ela também pode gerar o próprio código em **Copiloto › Converse com o Aries**.
   - O link já abre a conversa com o agente com *ARIES 123456* escrito.
   - Quando a pessoa manda o código, o número dela fica vinculado.
3. **Ajustar cada pessoa.** Ela pode desligar o resumo da manhã e os avisos, pela tela ou mandando *parar avisos*.

## Segurança

- **Quem recebe dados:** só números vinculados por código recebem dados. Número desconhecido recebe só a apresentação, no máximo a cada 12 horas.
- **Vendedor:** recebe só o que é dele. Os números da loja inteira (vendas, equipe, tráfego e financeiro) ficam com o dono.
- **Como as respostas são montadas:** as respostas com números saem de modelos prontos, sem IA.
  - A IA só entra em dois casos:
    - classificar a pergunta que as regras não entenderam. Ela recebe só o texto da mensagem, com valores mascarados.
    - a conversa livre de mentor do Copiloto, sem valores em reais.
- **Ritmo:** cada resposta tem "digitando..." proporcional ao tamanho e vai em até 3 mensagens, no ritmo de uma pessoa.
