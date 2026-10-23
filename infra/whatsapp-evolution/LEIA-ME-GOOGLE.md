# Servidor do WhatsApp no Google Cloud

Alternativa ao Oracle quando a conta de lá demora a ser liberada. Conta nova
ganha **US$ 300 de crédito por 90 dias** e nada é cobrado durante o teste. A
máquina **e2-micro** é gratuita para sempre nas regiões dos EUA; depois dos 90
dias, só o endereço IP da máquina passa a custar cerca de US$ 4 por mês (ou você
migra para o Oracle sem custo, trocando duas variáveis na Vercel).

O instalador é o mesmo do Oracle. Tempo total: uns 30 minutos.

## 1. Criar a conta

1. Acesse **console.cloud.google.com/freetrial** com a sua conta Google.
2. País **Brasil**, tipo de conta **Individual**, aceite os termos.
3. Cadastre o cartão (é só verificação: durante o teste não há cobrança) e
   clique em **Iniciar teste sem custo**.

## 2. Criar a máquina

Menu (☰) → **Compute Engine → Instâncias de VM**. Na primeira vez, clique em
**Ativar** e espere a API ligar (1 a 2 minutos). Depois, **Criar instância**:

- **Nome:** `whatsapp`
- **Região:** `us-central1 (Iowa)` (ou `us-east1` / `us-west1`; só essas três
  são gratuitas). Zona: qualquer uma.
- **Configuração da máquina:** série **E2**, tipo **e2-micro**.
- **SO e armazenamento → Mudar:**
  - Sistema operacional: **Ubuntu**
  - Versão: **Ubuntu 24.04 LTS (x86/64)**
  - Tipo de disco: **Disco permanente padrão** (o "equilibrado", que vem
    marcado, não é gratuito)
  - Tamanho: **30 GB** → **Selecionar**
- **Rede → Firewall:** marque **Permitir tráfego HTTP** e **Permitir tráfego
  HTTPS**.
- Clique em **Criar**.

## 3. Entrar na máquina

Quando a máquina aparecer com o círculo verde, clique em **SSH** na linha dela.
Abre um terminal no próprio navegador (autorize se ele pedir). Não precisa de
chave nem de PowerShell.

## 4. Rodar o instalador

No terminal que abriu, cole:

```bash
curl -fsSL https://raw.githubusercontent.com/Joaowateus/ARIES/claude/soe-project-setup-sqgryt/infra/whatsapp-evolution/instalar-oracle.sh -o instalar.sh
sudo bash instalar.sh
```

O nome do arquivo diz "oracle", mas ele funciona igual no Google. Na máquina
pequena a primeira instalação leva de 5 a 15 minutos. No fim aparece:

```
EVOLUTION_API_URL = https://...sslip.io
EVOLUTION_API_KEY = ...
```

A chave é a senha do servidor: cole só na Vercel, nunca em print ou conversa.
Se a janela do terminal fechar no meio, abra o SSH de novo e rode
`sudo bash instalar.sh` outra vez: ele continua de onde parou.

## 5. Vercel e primeiro teste

Igual aos passos 6 e 7 do [LEIA-ME.md](LEIA-ME.md): as duas variáveis no
projeto **ariessistemacomercial** (Production, chave como Sensitive) →
**Redeploy** → **Assistente Comercial → WhatsApp → Gerar QR Code** → ler no
celular do vendedor → pausar as respostas e mandar uma mensagem de um número
novo.

## Antes dos 90 dias

O Google avisa por e-mail quando o teste estiver acabando. Para continuar no
Google, clique em **Ativar conta completa** (aí passa a custar cerca de US$ 4
por mês pelo IP). Sem isso, a máquina é desligada no fim do teste, e você pode
migrar para o Oracle: roda o mesmo instalador lá, troca as duas variáveis na
Vercel e cada vendedor lê o QR de novo.
