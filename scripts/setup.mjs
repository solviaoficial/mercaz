import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) {
  console.error('O arquivo .env já existe. Não foi alterado.');
  process.exit(1);
}
const password = 'Mercaz-' + randomBytes(15).toString('base64url');
const key = randomBytes(32).toString('hex');
const content = readFileSync('.env.example', 'utf8')
  .replace('DEMO_PASSWORD=', 'DEMO_PASSWORD=' + password)
  .replace('TOKEN_ENCRYPTION_KEY=', 'TOKEN_ENCRYPTION_KEY=' + key);
writeFileSync('.env', content, { mode: 0o600 });
console.log(
  'Ambiente de demonstração configurado. Contas: comprador@mercaz.local e vendedor1@mercaz.local até vendedor4@mercaz.local.',
);
console.log('Senha de demonstração: ' + password);
console.log(
  'Guarde a senha. Ela também está no .env. Não use estas contas para produção.',
);
