# Mercaz — arquivos para sua VPS

Marketplace em português, baseado no **Guia Mercaz — Marca, experiência, estrutura do site e telas essenciais**. O código foi preparado para hospedagem própria. **Nada foi publicado.**

## O que está implementado

- Home, categorias, busca com filtros e ordenação, descoberta editorial, lojas e página de produto.
- Cadastro e login, sessão protegida, endereço, alteração de senha, favoritos de produtos e lojas e notificações internas.
- Carrinho persistido no navegador, checkout com pedidos separados por vendedor, reserva transacional de estoque, acompanhamento e confirmação de recebimento.
- Pix Mercado Pago, conexão OAuth de cada vendedor, split da comissão Mercaz, QR Code, consulta do pagamento, webhook autenticado, recuperação idempotente de tentativas e reembolso integral.
- Avaliações vinculadas a compras entregues, fotos e vídeos enviados, reações de utilidade, denúncias e painel de moderação.
- Perguntas de produtos, respostas da loja, atendimentos com mensagens e registro de resolução.
- Cadastro da loja, painel, criação e edição de anúncios, imagens, variações, preço, estoque, pausa, configuração de preparo e frete.
- Assistente de anúncio com IA opcional e checklist explícito quando não configurada. Simulador de margem, desempenho, reputação, biblioteca de vídeos e financeiro com exportação CSV.
- Páginas institucionais, ajuda, condições de uso, privacidade e explicação do ranking.
- Layout responsivo, componentes acessíveis, banco SQLite e arquivos em volume persistente.

O escopo segue a **primeira versão descrita na seção 14 do guia**. Descoberta é editorial. Frete é fixo nacional por loja, com postagem e rastreio informados pelo vendedor. O estoque é compartilhado entre as variações de um anúncio. Para estoques separados, crie anúncios separados.

Não inclui transportadoras contratadas, cálculo de frete por API, etiquetas, nota fiscal, aplicativo móvel, recuperação de senha por e-mail, verificação documental/KYC própria, antifraude adicional ao provedor ou recomendações por aprendizado de máquina. Não há depoimentos nem vídeos falsos. Esses serviços não foram fornecidos no guia.

## Subir para testar — somente Docker

Na VPS Linux, você precisa de Docker Engine e Docker Compose v2. Extraia o ZIP e entre na pasta `mercaz`.

Crie o `.env` com uma senha aleatória para as contas de demonstração:

```bash
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD:/setup" -w /setup \
  node:24.20.0-bookworm-slim node scripts/setup.mjs
```

O comando imprime a senha e a salva no `.env`. Se já existir `.env`, ele não será sobrescrito. Como alternativa, copie `.env.example` para `.env` e preencha `DEMO_PASSWORD` com pelo menos 12 caracteres.

```bash
docker compose -p mercaz-demo up -d --build
docker compose -p mercaz-demo ps
docker compose -p mercaz-demo logs --tail=100 mercaz
curl http://127.0.0.1:3000/api/health
```

O serviço fica em **127.0.0.1:3000**, sem expor a porta diretamente à internet. Para testar no seu computador, use um túnel SSH:

```bash
ssh -L 3000:127.0.0.1:3000 usuario@IP_DA_VPS
```

Abra `http://localhost:3000` no navegador. A compra começa na home; a área do vendedor fica em `/vendedor`.

### Contas de demonstração

Todas usam a senha `DEMO_PASSWORD` gerada na instalação:

| Conta | Papel |
|---|---|
| `comprador@mercaz.local` | Comprador |
| `vendedor1@mercaz.local` | Casa Aurora |
| `vendedor2@mercaz.local` | Tech & Co. |
| `vendedor3@mercaz.local` | Cozinha Viva |
| `vendedor4@mercaz.local` | Novos Caminhos |

Os produtos, preços e lojas são demonstrativos. O modo `demo` **não cobra dinheiro**: o detalhe do pedido tem um botão para simular pagamento aprovado. Você pode testar entrega e avaliação entrando na conta do vendedor e depois voltando à conta do comprador.

## Ativar pagamentos reais com Mercado Pago

Faça esta configuração somente quando decidir abrir a operação. O projeto não contém suas credenciais e **não foi homologado com uma conta real do Mercado Pago**.

1. Cadastre uma aplicação no Mercado Pago para o marketplace e configure a integração Pix/split e OAuth conforme a habilitação da sua conta. Cada vendedor autoriza sua própria conta pelo painel da loja; não há um token de vendedor exposto no navegador.
2. Configure a URL de retorno OAuth como `https://SEU_DOMINIO/api/payments/callback`.
3. Configure notificações de **pagamentos** para `https://SEU_DOMINIO/api/payments/webhook` e copie a chave secreta de assinatura para `MP_WEBHOOK_SECRET`. A integração espera `data.id` na query, `x-signature` e `x-request-id` conforme o contrato do provedor.
4. Preencha o `.env`:

```dotenv
APP_URL=https://SEU_DOMINIO
PAYMENT_MODE=mercadopago
SEED_DEMO=false
DEMO_PASSWORD=
TRUST_PROXY=1
MP_CLIENT_ID=ID_DA_APLICACAO
MP_CLIENT_SECRET=SEGREDO_DA_APLICACAO
MP_WEBHOOK_SECRET=SEGREDO_DA_ASSINATURA
TOKEN_ENCRYPTION_KEY=CHAVE_HEXADECIMAL_DE_64_CARACTERES
PLATFORM_FEE_BPS=500
OPERATOR_NAME=RAZAO_SOCIAL_E_IDENTIFICACAO_DO_OPERADOR
SUPPORT_EMAIL=SEU_EMAIL_DE_ATENDIMENTO
ADMIN_EMAILS=EMAIL_DA_CONTA_DE_MODERACAO
POLICIES_APPROVED=true
```

Gere `TOKEN_ENCRYPTION_KEY` com `openssl rand -hex 32` ou use a chave criada pelo instalador. **Guarde a chave junto ao backup do `.env`**; sem ela, tokens de lojas e solicitações pendentes criptografadas não podem ser recuperados. Não rotacione essa chave com dados existentes sem uma migração dos registros.

`PLATFORM_FEE_BPS=500` representa **5% sobre o subtotal dos produtos**, valor inicial configurável, não uma taxa definida no PDF. O frete não entra nessa base. O Mercado Pago pode cobrar sua própria tarifa, separada da comissão da Mercaz. Confira as condições e o split disponíveis na conta do provedor.

`POLICIES_APPROVED=true` deve ser usado **depois** de finalizar os textos em `app/info.tsx`, os dados do operador, os canais e as condições da operação. Sem isso, o checkout real permanece fechado. A configuração não substitui essa revisão.

5. Use **um banco novo**, separado da demonstração:

```bash
docker compose -p mercaz-demo down
docker compose -p mercaz-producao up -d --build
```

Os nomes de projeto criam volumes diferentes; o volume de demonstração é preservado. Nunca reutilize as contas e produtos de teste para vender de verdade. O modo real não aceita `SEED_DEMO=true`.

6. Crie as contas reais, cadastre as lojas e os produtos. Em **Configurações da loja → Conectar Mercado Pago**, cada vendedor autoriza a conexão OAuth. Faça a homologação do ciclo Pix, notificação e reembolso com as credenciais adequadas antes da abertura comercial.

### Funcionamento do pagamento

Um carrinho com duas lojas gera dois pedidos e dois Pix. Os totais são calculados no servidor em centavos; valores enviados pelo cliente não definem o preço. A reserva de estoque é atômica. A criação usa uma chave idempotente por pedido e guarda temporariamente o corpo exato da solicitação criptografado para recuperação de timeouts. Esse corpo é removido quando o ID do pagamento é vinculado ao pedido.

Webhooks só disparam a consulta autenticada ao Mercado Pago após a validação HMAC. O servidor confere moeda, valor e referência do pedido antes de confirmar. Há uma rotina de reconciliação a cada cinco minutos. Solicitações incertas conservam a reserva até que seja possível confirmar ou cancelar no provedor; acompanhe os logs quando houver indisponibilidade prolongada.

O botão de reembolso do vendedor solicita **reembolso integral**. Em produção, aguarda o estado do provedor para atualizar o pedido. O estoque volta ao catálogo; o vendedor deve ajustar a disponibilidade se o item devolvido estiver danificado. Reembolsos parciais não estão incluídos.

## Domínio e HTTPS na VPS

O arquivo `deploy/nginx.conf` é um exemplo de proxy reverso. Ajuste o domínio e a porta se necessário e adicione HTTPS com o gerenciador de certificados que utiliza. O exemplo supõe um único Nginx diretamente na frente da aplicação; nesse cenário use `TRUST_PROXY=1`. Se houver outros proxies, ajuste a topologia e a confiança de acordo.

Mantenha `APP_URL` igual à origem usada no navegador, sem barra no final. Essa variável controla cookies seguros, proteção de origem e as URLs do Mercado Pago. No modo real, HTTPS é obrigatório. O limite de upload do proxy deve permitir 32 MB.

O Dockerfile contém build em etapas, testes, imagem final sem ferramentas de build, processo sem root e healthcheck. O Compose utiliza volume persistente, filesystem da imagem somente leitura, reinício automático e rotação de logs. Execute apenas **uma réplica** usando esse SQLite. Para várias réplicas, a persistência e os jobs precisam ser adaptados a uma arquitetura compartilhada.

## IA para anúncios — opcional

Preencha `AI_API_KEY` com sua chave de API OpenAI e, se necessário, `AI_MODEL`. O modelo inicial configurável é `gpt-4.1-mini`. O uso é cobrado na conta do provedor e está limitado a 30 solicitações por hora por IP nesta versão.

Sem chave, a ferramenta retorna um **checklist de qualidade identificado como sem IA**. Com a chave, o título e a descrição são enviados ao provedor. As sugestões nunca publicam nem alteram o anúncio automaticamente: o vendedor decide aplicar e salvar.

## Persistência, backup e atualização

O volume `mercaz_data` de cada projeto Compose contém:

```text
/app/data/mercaz.sqlite       banco principal
/app/data/mercaz.sqlite-wal   log transacional, quando presente
/app/data/uploads/           fotos e vídeos
/app/data/backups/           backups gerados
```

Crie um backup consistente com a API de backup do SQLite:

```bash
docker compose -p mercaz-producao exec mercaz node scripts/backup.mjs
docker compose -p mercaz-producao cp mercaz:/app/data/backups ./backups
```

O script copia o banco e os uploads. Guarde também o `.env` separadamente, com acesso restrito, e copie os backups para outro disco/servidor. Para restaurar, pare a aplicação, restaure o banco e a pasta `uploads` em um volume novo, assegure acesso de escrita ao usuário `node` (UID 1000) e reinicie com o `.env` correspondente. Não copie apenas o arquivo principal do banco em uso ignorando o WAL.

Para atualizar código:

```bash
docker compose -p mercaz-producao exec mercaz node scripts/backup.mjs
docker compose -p mercaz-producao up -d --build
```

Não execute `docker compose down -v` em produção: essa opção remove o volume com os dados. Os backups devem ter uma política de retenção definida pelo operador. Os uploads não são transcodificados; vídeos longos devem ser otimizados pelo usuário antes do envio.

## Desenvolvimento sem Docker

Use Node.js 24 ou superior e npm:

```bash
npm ci
node scripts/setup.mjs
npm run dev
```

Frontend local: `http://127.0.0.1:5173`. API: porta 3000. Se o `.env` já existir, pule o setup. Para executar o build de produção:

```bash
npm run build
npm test
npm start
```

## Organização do código

| Local | Conteúdo |
|---|---|
| `app/main.tsx` | Navegação, sessão, carrinho, cabeçalho e rodapé |
| `app/catalog.tsx` | Home, busca, produto, lojas, descoberta e avaliações |
| `app/buyer.tsx` | Conta, checkout, pedidos, suporte e favoritos |
| `app/seller.tsx` | Operação, anúncios, estoque, financeiro e reputação |
| `app/info.tsx` | Ajuda, institucional, políticas e moderação |
| `app/shared.tsx` | Componentes e acesso à API |
| `app/globals.css`, `app/pages.css` | Identidade visual e responsividade |
| `server/index.mjs` | API, autenticação, permissões, uploads e pedidos |
| `server/db.mjs` | Esquema, transações e consultas SQLite |
| `server/payments.mjs` | Pix, OAuth, criptografia e reconciliação |
| `server/seed.mjs` | Dados opcionais de demonstração |
| `tests/` | Testes de fluxos, autorização, estoque e pagamento |
| `public/assets/` | Marca extraída do guia e imagens demonstrativas |
| `Dockerfile`, `compose.yaml` | Execução na VPS |

O painel de moderação está em `/moderacao`, restrito às contas presentes em `ADMIN_EMAILS`. Não há acesso administrativo baseado em um botão oculto: a autorização é verificada no servidor.

## Validação e limites do ambiente de entrega

Consulte `VALIDACAO.md` para os resultados. O build TypeScript/Vite e os testes de API foram executados localmente. Os contratos de Pix/OAuth foram testados com um provedor simulado, sem cobrança. Não foram usadas credenciais reais de Mercado Pago ou IA. Docker não estava instalado no ambiente de desenvolvimento, portanto a imagem deve ser construída e validada na sua VPS. O Dockerfile executa o build e os testes durante a construção.

## Fontes e ativos

A marca foi extraída do PDF fornecido. As fotos de produtos são exemplos do catálogo DummyJSON e sua origem está em `public/assets/sources.json`; não representam estoque real nem uma afiliação com as marcas fotografadas. Substitua os itens e as fotos de demonstração por conteúdo autorizado das lojas antes de abrir vendas.

Referências técnicas usadas:

- [Mercado Pago — Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix)
- [Mercado Pago — integração de marketplace e split](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/how-tos/integrate-marketplace)
- [Mercado Pago — notificações e assinaturas](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-content/notifications/webhooks)
- [OpenAI — Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [Docker — build em etapas](https://docs.docker.com/build/building/multi-stage/)
- [Node — imagem oficial](https://hub.docker.com/_/node)

Dependências de terceiros conservam suas respectivas licenças. `server/package-lock.json` fixa apenas as dependências usadas pela API na imagem final; `package-lock.json` fixa o ambiente completo de desenvolvimento e build.
