# Validação da entrega

Data: 09/09/2026.

## Executado localmente

- Compilação TypeScript e build Vite: aprovados.
- `npm test`: **34 verificações no relatório do runner, 34 aprovadas, nenhuma falha**. Inclui grupos e cenários internos.
- `npm audit`: nenhuma vulnerabilidade reportada no lockfile final.
- Auditoria das dependências isoladas do servidor: nenhuma vulnerabilidade reportada.
- Servidor local: resposta HTTP 200, catálogo com 12 produtos e quatro lojas no modo demonstrativo.
- Onze rotas profundas: fallback HTTP válido para a aplicação. Assets do build e as 12 imagens de produto: respostas válidas.
- Backup via API SQLite: executado; banco copiado e arquivos preservados.
- Integridade do banco de backup: `PRAGMA integrity_check` retornou `ok`.
- Imagens do catálogo baixadas e incluídas localmente. Marca extraída do PDF fornecido.

## Cenários cobertos

Autenticação, tentativas inválidas, origem e cabeçalho anti-CSRF, cadastro, endereço, favoritos, autorização de vendedor, pedidos separados por loja, cálculo de valores no servidor, idempotência de checkout, rollback por falta de estoque, quantidades/variações inválidas, isolamento entre contas e lojas, bloqueio de avaliações antes da entrega, transições de pedido, pagamento simulado, preparo, envio, recebimento, avaliação verificada, reação, denúncia, moderação, suporte, reembolso, liberação de estoque sem duplicação, rejeição de upload disfarçado, upload permitido, autorização das imagens, publicação, perguntas e assistente sem chave.

O módulo Pix foi testado com respostas controladas do provedor: payload criptografado em timeout, repetição com corpo e chave idênticos, total e comissão, token por loja, confirmação idempotente, renovação OAuth, reembolso, validação HMAC e rejeição de moeda/valor/referência incorretos.

## O que não foi executado

- Construção/execução da imagem Docker: Docker não está instalado neste ambiente. O Dockerfile executa o build e os testes durante a construção na VPS.
- Cobrança, OAuth e reembolso reais no Mercado Pago: dependem das credenciais e da habilitação da aplicação do operador.
- Chamada real de IA: nenhuma chave fornecida.
- Teste visual ou de interação em navegador: não executado. O preview foi aberto localmente; o build e os endpoints foram verificados por ferramentas de desenvolvimento.
- WebMCP em navegador compatível: a busca somente leitura foi registrada com detecção de suporte, mas não houve contexto WebMCP disponível para execução do contrato.
- Testes de carga e múltiplas réplicas: não executados. Esta entrega usa uma instância e SQLite local.

O build informa um bundle JavaScript de aproximadamente 528 KB antes de gzip (166 KB após gzip). Não impede a execução; é uma oportunidade para divisão de código por rotas conforme o catálogo e o produto evoluírem.

Nenhum serviço foi publicado e nenhuma cobrança real foi efetuada.
