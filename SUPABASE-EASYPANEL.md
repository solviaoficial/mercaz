# Supabase no Mercaz

As tabelas já estão no projeto `whhbymylamucawmofqdg`, no schema privado `mercaz`, com RLS habilitado. O site conversa com esse schema somente pelo backend Express.

O GitHub contém apenas nomes de variáveis. As credenciais precisam ficar nas variáveis de ambiente do serviço que executa o container, porque são segredos e não podem ser versionadas.

Configure:

```env
AUTH_PROVIDER=supabase
SUPABASE_URL=https://whhbymylamucawmofqdg.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
DATABASE_URL=postgresql://postgres:SENHA@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require
APP_URL=https://chatwoot-mercaz.7t6kue.easypanel.host
GOOGLE_AUTH_ENABLED=false
SEED_DEMO=false
PAYMENT_MODE=demo
```

Use a senha do banco e a string Session pooler copiada no painel do Supabase. O usuário `postgres` é usado apenas pelo backend privado; não o coloque no navegador nem no repositório. Um papel dedicado pode ser criado depois com `NOBYPASSRLS` e acesso somente ao schema `mercaz`.

Para ativar Google, crie um cliente OAuth Web no Google Cloud, informe como redirect URI a URL exibida na tela de configuração do provedor Google do Supabase, salve Client ID e Client Secret no provedor Google do Supabase e então altere `GOOGLE_AUTH_ENABLED=true`. O botão do site já está implementado com PKCE e callback validado.

Depois de salvar as variáveis, reinicie o serviço para o novo container. A rota `/api/health` confirma se o processo está vivo; uma falha com `Execute a migração ...` significa que `DATABASE_URL` apontou para outro projeto ou que a migração não foi executada.
