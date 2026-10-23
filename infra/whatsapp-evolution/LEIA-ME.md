# Servidor do WhatsApp no Oracle Cloud (grátis)

É o servidor que mantém o WhatsApp dos vendedores conectado 24h, como um
WhatsApp Web sempre aberto. **Um servidor só atende a equipe toda.** Sem ele, o
cadastro automático de leads e o Assistente Comercial não funcionam.

Tempo total: uns 40 minutos. O instalador faz a parte técnica sozinho.

Conta do Oracle demorando a ser liberada? Use o Google Cloud, que ativa na
hora: [LEIA-ME-GOOGLE.md](LEIA-ME-GOOGLE.md).

## 1. Criar a conta

1. Acesse **oracle.com/br/cloud/free** e clique em **Comece gratuitamente**.
2. Em **Home Region**, escolha **Brazil East (Sao Paulo)**. Essa escolha não
   muda depois.
3. O cartão é só para verificação: o Oracle faz uma cobrança de teste e
   devolve. A liberação da conta pode levar de minutos a algumas horas.

## 2. Criar a máquina

No menu: **Compute → Instances → Create instance**.

- **Name:** `whatsapp`
- **Image:** clique em **Change image** e escolha **Canonical Ubuntu 24.04**.
- **Shape:** clique em **Change shape → Ampere → VM.Standard.A1.Flex** com
  **1 OCPU e 6 GB** de memória (dentro do gratuito).
- **Networking:** deixe criar a rede nova e confira que
  **Assign a public IPv4 address** está ligado.
- **SSH keys:** marque **Generate a key pair for me** e clique em
  **Download private key**. Guarde esse arquivo: é a chave para entrar.
- Clique em **Create**. Quando ficar verde (Running), copie o
  **Public IP address**.

Se aparecer **Out of capacity**: troque o **Availability domain** (AD-1, AD-2,
AD-3) ou tente de novo mais tarde. Plano B: o shape **VM.Standard.E2.1.Micro**
(AMD, também gratuito). O instalador cria memória extra para ele.

## 3. Liberar as portas 80 e 443

Na página da máquina, clique no nome da **Subnet** → **Security Lists** →
**Default Security List** → **Add Ingress Rules**:

- **Source CIDR:** `0.0.0.0/0`
- **IP Protocol:** TCP
- **Destination Port Range:** `80,443`

Clique em **Add Ingress Rules**.

## 4. Entrar na máquina

No Windows, abra o **PowerShell** e rode, trocando `SEU_IP` pelo IP do passo 2
(o nome do arquivo da chave começa com `ssh-key-`):

```powershell
cd $HOME\Downloads
icacls .\ssh-key-*.key /inheritance:r /grant:r "$($env:USERNAME):(R)"
ssh -i (Get-Item .\ssh-key-*.key).Name ubuntu@SEU_IP
```

Na primeira vez ele pergunta se confia na máquina: digite `yes`.

## 5. Rodar o instalador

Já dentro da máquina (o terminal mostra `ubuntu@whatsapp`), cole:

```bash
curl -fsSL https://raw.githubusercontent.com/Joaowateus/ARIES/claude/soe-project-setup-sqgryt/infra/whatsapp-evolution/instalar-oracle.sh -o instalar.sh
sudo bash instalar.sh
```

Leva de 3 a 8 minutos. No fim aparece:

```
EVOLUTION_API_URL = https://...sslip.io
EVOLUTION_API_KEY = ...
```

A chave é a senha do servidor: cole só na Vercel, nunca em print ou conversa.

## 6. Ligar no sistema (Vercel)

No projeto da API (**ariessistemacomercial**): **Settings → Environment
Variables**, adicione as duas variáveis do passo 5 em **Production** (marque a
chave como **Sensitive**). Depois, em **Deployments**, abra o último deploy de
produção e clique em **Redeploy**.

## 7. Conectar o primeiro WhatsApp

1. Abra **Assistente Comercial → WhatsApp**, escolha o vendedor e clique em
   **Gerar QR Code**.
2. No celular do vendedor: **WhatsApp → Aparelhos conectados → Conectar um
   aparelho** e leia o QR.
3. Para os primeiros testes, toque em **Respondendo leads novos** para deixar
   as respostas pausadas. Mantenha **Cadastrando leads no CRM** ligado.
4. De um número que nunca falou com o vendedor, mande uma mensagem. Em até um
   minuto o lead aparece em **CRM → Leads** com o selo **WhatsApp**.

## 8. Depois que funcionar

O Oracle pode desligar máquinas gratuitas que passam 7 dias quase paradas, e
um servidor de WhatsApp fica a maior parte do tempo esperando mensagens. Para
evitar isso, converta a conta para **Pay As You Go** (**Billing → Upgrade**).
Continua sem custo enquanto o uso ficar dentro do gratuito. Crie também um
**alerta de orçamento** de US$ 1 para ser avisado de qualquer cobrança.

## Comandos úteis (dentro da máquina)

```bash
cd /opt/evolution
sudo docker compose ps                     # situação dos serviços
sudo docker compose logs --tail 50 evolution   # últimas mensagens do servidor
sudo docker compose restart                # reiniciar
sudo grep AUTHENTICATION_API_KEY .env      # ver a chave de novo
```

Rodar `sudo bash instalar.sh` de novo é seguro: mantém a chave, os dados e os
WhatsApps conectados.
