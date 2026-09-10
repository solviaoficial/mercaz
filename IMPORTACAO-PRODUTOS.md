# Importação de catálogos para a Mercaz

A Mercaz passa a oferecer **Área do vendedor → Importar produtos**, em `/vendedor/importar`. O vendedor envia arquivos, confere o reconhecimento das colunas, revisa os produtos e confirma o lote. A aplicação processa a importação em segundo plano, copia fotos públicas para seu armazenamento e registra os resultados no banco. O histórico permite acompanhar o processamento depois de sair da página.

## Pesquisa dos formatos de origem

### Mercado Livre

O fluxo oficial **Modificar com Excel** exporta informações selecionadas de anúncios existentes. Há opções de condições gerais e características dos produtos. O vendedor pode escolher campos e anúncios; preço, estoque, título, SKU, descrição e categoria constam entre as informações editáveis. Portanto, não existe uma única disposição de colunas que se possa presumir para todas as contas. A documentação informa validade de 30 dias para reenviar a planilha ao próprio Mercado Livre; isso não equivale a uma validade técnica dos dados na Mercaz.¹

O **Anunciador em massa** tem outro objetivo: criar anúncios. Ele pode gerar planilhas por categorias, usar códigos universais e links, e importar planilhas da Shopee. Os dados podem ocupar abas diferentes e variações podem exigir linhas adicionais. Uma planilha de cadastro vazia não é um backup de produtos existentes. Para migrar um catálogo, prefira a exportação preenchida dos anúncios. A gestão de fotos pode estar vinculada a ferramentas do Mercado Livre; um link para o gerenciador de fotos não é uma URL direta de imagem.²

**Implementação:** reconhecimento de rótulos em português e inglês, leitura das abas e escolha manual de cabeçalho/colunas. Arquivos complementares são combinados pelo identificador externo. Não se depende de letras fixas como coluna A ou G. Categorias precisam corresponder às categorias Mercaz.

### Shopee

O guia oficial regional de Mass Update documenta arquivos separados: **Basic Info**, **Sales Info**, **Shipping Info** e **DTS Info**. Informações básicas tratam nome e descrição; informações de vendas tratam preço e estoque por produto ou variação; os demais arquivos tratam logística. Isso fundamenta a importação de um conjunto de arquivos ligados pelo ID do produto.³

**Limite da evidência:** o PDF disponível é regional, da Malásia, com interface histórica. Ele não comprova que toda conta brasileira de 2026 tenha exatamente os mesmos menus, rótulos ou a opção de mídia. Não foi disponibilizada uma exportação real da conta brasileira do vendedor. O adaptador foi testado com arquivos sintéticos representativos, e permite correção manual das colunas. A compatibilidade com um modelo específico deve ser conferida na prévia.

**Implementação:** juntar XLSX/CSV de informações básicas, vendas e, quando fornecida, mídia; reconhecer Product ID/ID do produto, Variation ID/ID da variação, SKU, nomes, descrições, preços, estoques e URLs de fotos. O importador aceita colunas de imagens numeradas. Frete e prazo de preparação continuam sendo os configurados na loja Mercaz; não se convertem automaticamente contratos logísticos de outra plataforma.

### Shopify

A Shopify exporta produtos em CSV e documenta identificadores, informações descritivas e campos de variações. O formato atual e versões anteriores podem usar rótulos diferentes. Linhas suplementares podem representar imagens; informações de estoque em múltiplos locais podem exigir uma exportação de inventário separada. A documentação alerta que reordenar linhas sem preservar relações pode associar imagens e variações incorretamente.⁴ ⁵

**Implementação:** reconhecer Handle/URL handle, Title, Body (HTML)/Description, Variant SKU/SKU, Variant Price/Price e Variant Inventory Qty/Inventory quantity; combinar imagens suplementares pelo handle. Cada variação herda os campos descritivos do produto e conserva a própria quantidade. Estoque por depósito não é somado automaticamente: é necessário mapear uma quantidade disponível apropriada para a Mercaz.

### WooCommerce e outros sistemas

O exportador nativo do WooCommerce produz CSV com IDs, tipos, SKU, nomes, descrição, preços, estoque, imagens e relações Parent. Variações podem apontar para o pai por SKU ou por `id:100`. O importador nativo também usa mapeamento de colunas, reforçando a necessidade de uma etapa de correspondência em migrações entre plataformas.⁶

**Implementação:** suporte a produtos simples e variações, com herança da descrição, categoria e fotos do pai quando presentes. Produtos agrupados, externos, virtuais ou de download são recusados para revisão, pois têm comportamento comercial diferente. Outros ERPs e marketplaces podem usar CSV/XLSX com mapeamento manual ou o modelo Mercaz. Não há afirmação de compatibilidade nativa com todas as versões de Amazon, Magalu, TikTok Shop ou ERPs.

## O conjunto de planilhas

Um lote pertence a uma plataforma e a uma conta de origem. Por exemplo, arquivos `informacoes-basicas.xlsx`, `informacoes-vendas.xlsx` e `midia.xlsx` da mesma loja Shopee podem ser enviados juntos. O mesmo ID deve identificar o mesmo produto em cada arquivo. Para outra conta ou plataforma, crie outro lote.

| Dados | Uso na Mercaz | Ausência ou conflito |
|---|---|---|
| ID externo/SKU | Associação entre arquivos e prevenção de repetição | Produto sem identificador é recusado |
| Título | Nome do anúncio | Fora de 5–180 caracteres é recusado |
| Descrição | Texto do anúncio, com HTML convertido em texto | Descrição incompleta leva a rascunho |
| Preço | Valor em reais convertido em centavos | Valores vazios, negativos e ambíguos são recusados |
| Estoque | Quantidade inteira disponível | Vazio é erro; zero é preservado |
| Categoria | Categoria permitida na Mercaz | Selecionar correspondência ou padrão |
| Fotos | Download de URLs HTTPS diretas | Falhas geram avisos e rascunho |
| Variação | Anúncio individual com nome, preço e estoque próprios | Relação registrada pelo identificador de origem |

O importador não escolhe arbitrariamente entre preços ou estoques divergentes em arquivos do mesmo lote. A prévia informa o conflito. Cabe ao vendedor remover a versão desatualizada ou corrigir os dados antes de enviar novamente. Campos vazios não devem ser usados para inventar quantidade, preço ou conteúdo do anúncio.

## Variações, estoque e duplicações

O catálogo atual da Mercaz utiliza um preço e um estoque por anúncio. Simplesmente juntar várias variações importadas e somar seus estoques permitiria vender uma combinação esgotada. Nesta implementação cada SKU/variação cria um anúncio individual. Isso preserva as quantidades e os valores no checkout já existente. A prévia informa essa conversão; variações com aviso entram como rascunho para revisão.

A identificação de repetição é composta por **loja Mercaz + plataforma + nome da conta de origem + ID externo/variação**. Um segundo envio dessa mesma identidade não cria outro produto e não sobrescreve um anúncio editado ou com estoque alterado por vendas. Os IDs pertencem à origem; nunca são usados como IDs internos da Mercaz.

Produtos iguais oferecidos em plataformas diferentes não são fundidos automaticamente. Um SKU repetido entre contas não prova que estoque, unidades e condições comerciais sejam iguais. Uma futura central de estoque compartilhado exigirá associação explícita de SKUs e contabilização das reservas de todos os canais.

## Operação do vendedor

1. Entre como vendedor e abra **Importar produtos**.
2. Escolha a origem e informe um nome estável para a conta de origem.
3. Selecione os arquivos preenchidos. Podem ser enviados até seis arquivos, com até 5 MB cada e até 20 MB no total.
4. Confira quais abas estão incluídas. Abas de instruções podem ser desmarcadas. O cabeçalho pode estar nas primeiras 25 linhas.
5. Confira a correspondência das colunas. O campo de ID deve ligar os arquivos complementares; o SKU/ID de variação distingue unidades diferentes.
6. Gere a prévia, veja as categorias de origem e ajuste as correspondências necessárias.
7. Confira erros e avisos. O relatório CSV também pode ser baixado antes da execução.
8. Confirme a importação. Produtos com erros serão registrados no relatório sem criação de anúncio.
9. Abra os anúncios criados, confira fotos, texto, estoque e condições da loja antes de vender.

A publicação automática é opcional e desmarcada inicialmente. Se marcada, só publica itens sem avisos e com download bem-sucedido das imagens. Itens incompletos ficam como rascunho. A falta de uma foto não provoca publicação de um anúncio com imagem inventada.

## Arquitetura e persistência

`server/import-parser.mjs` faz leitura e normalização; `import-worker.mjs` executa a leitura dos arquivos fora da thread HTTP, com limites de memória e tempo. O servidor suporta XLSX e CSV. XLS binário antigo deve ser salvo como XLSX no Excel ou LibreOffice. Fórmulas não são executadas e devem ser substituídas por valores. Links de células só são úteis quando apontam diretamente para os dados esperados.

`server/imports.mjs` expõe endpoints autenticados de configuração, envio, prévia, início, consulta, cancelamento, histórico, relatório e modelo CSV. A autorização de cada lote é verificada contra a loja da sessão. O cliente não escolhe o proprietário do produto criado.

As tabelas adicionais `mercaz.import_batches` e `mercaz.import_links` guardam o lote e seus vínculos com anúncios. A inicialização aplica uma migração aditiva idempotente; o SQL correspondente está em `supabase/migrations/202609090002_product_imports.sql`. A conexão precisa ter permissão de criação de tabelas, como a conexão de administração usada na instalação. Se o operador usar credenciais de execução restritas, deve aplicar o SQL previamente com uma conta autorizada. As tabelas têm RLS e não concedem acesso a `anon` ou `authenticated`; a aplicação acessa pelo backend.

O processamento usa uma reserva temporária do lote e grava o anúncio, o vínculo e o avanço na mesma transação. Depois de uma interrupção, a reserva expira e o processamento retoma. Cada rodada trata até dez itens, permitindo avanços persistentes. Cancelar interrompe o restante e conserva anúncios concluídos. A prévia não cria produtos. O reenvio do comando de início é idempotente.

Fotos são baixadas pelo servidor somente de endereços HTTPS públicos. A resolução DNS é validada e fixada na conexão; cada redirecionamento é validado novamente. Endereços privados, loopback, link-local e URLs com credenciais são bloqueados. Há limite de 5 MB por foto, tempo de download e conferência de assinatura JPG/PNG/WebP. As imagens ficam no volume `/app/data/uploads`; inclua esse volume na estratégia de backup. O Supabase armazena os registros, não os arquivos de mídia dessa implementação.

Arquivos enviados não são preservados como anexos públicos. Os dados normalizados ficam no lote durante a revisão, e as planilhas são removidas do registro ao iniciar ou cancelar. O histórico mantém os dados dos anúncios e resultados. O relatório CSV neutraliza prefixos que poderiam ser interpretados como fórmulas pelo Excel.

## Importação automática e integração por API

A funcionalidade entregue automatiza a transformação e a gravação dos arquivos confirmados. Ela não acessa silenciosamente a conta Shopee/Mercado Livre, nem atualiza diariamente preço e estoque externos. A autenticação de clientes da Mercaz, inclusive Google, também não concede acesso aos catálogos de vendedores dessas plataformas.

O Mercado Livre documenta OAuth para acessar recursos privados do vendedor, com aplicação registrada, consentimento, tokens, renovação e escopos.⁷ Para uma futura sincronização contínua, a Mercaz precisa de credenciais e autorização de cada plataforma, reconciliação de estoque, controle de limites de API, definição da origem de verdade e tratamento de revogação. Essa etapa deve usar as APIs oficiais e não presumir acesso a lojas privadas com base em um link público.

## Validação e limites

Foram criados testes de leitura XLSX/CSV, combinação de arquivos, números brasileiros, variantes Shopify/WooCommerce, conflitos, fórmulas, arquivos inválidos, limites, mapeamento manual, URLs inseguras, isolamento entre lojas, prévia sem alterações, duplicação, cancelamento, retomada e relatório privado. A suíte completa inclui os fluxos existentes de compra, estoque e pagamentos.

Os exemplos de marketplaces nos testes são sintéticos: não são exportações reais de contas brasileiras fornecidas pelo vendedor. Uma planilha real deve ser conferida na prévia antes da primeira importação comercial. Fotos podem exigir login, retornar bloqueio do CDN ou não estar incluídas na exportação; esses casos são relatados e exigem envio manual no editor. A função não transfere avaliações, vendas, clientes, reputação, promoções, contratos de frete ou documentos fiscais.

## Fontes

Pesquisa consultada em 9 de setembro de 2026. Páginas sem data editorial explícita são identificadas pela data de consulta; o guia Shopee é histórico e regional.

1. Mercado Livre. [Aprenda a modificar anúncios com Excel](https://vendedores.mercadolivre.com.br/nota/altere-seus-anuncios-pelo-arquivo-excel). Central de aprendizagem, consultada em 09/09/2026.
2. Mercado Livre. [Conheça como usar o Anunciador em massa em 5 passos](https://vendedores.mercadolivre.com.br/nota/anuncie-varios-produtos-de-uma-vez-nuevo?guideKeyId=GE29). Central de aprendizagem, consultada em 09/09/2026.
3. Shopee. [Mass Update Feature — User Guide, MY](https://cdngarenanow-a.akamaihd.net/shopee/seller/seller_cms/0d2c26fbb95ca5f4ec8fe2c632f61f30/%5BMY%5D%20Mass%20Update%20User%20Guide.pdf). Material regional histórico, especialmente páginas 8 e 12–15; consulta em 09/09/2026.
4. Shopify. [Using CSV files to import and export products](https://help.shopify.com/en/manual/products/import-export/using-csv). Help Center, consultado em 09/09/2026.
5. Shopify. [Exporting products](https://help.shopify.com/en/manual/products/import-export/export-products). Help Center, consultado em 09/09/2026.
6. WooCommerce. [Product CSV Importer and Exporter](https://woocommerce.com/document/product-csv-importer-exporter/). Documentação do exportador nativo, consultada em 09/09/2026.
7. Mercado Livre Developers. [Autenticação e Autorização](https://developers.mercadolivre.com.br/autenticacao-e-autorizacao). Atualização indicada: 29/12/2025; consulta em 09/09/2026.
