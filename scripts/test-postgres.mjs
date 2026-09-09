import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['--experimental-loader','./tests/pglite-loader.mjs','--test','tests/marketplace.test.mjs','tests/payments-live.test.mjs','tests/supabase-auth.contract.mjs'],{stdio:'inherit',env:{...process.env,DATABASE_URL:'postgresql://test:test@localhost/mercaz',AUTH_PROVIDER:'local',NODE_ENV:'test'}});
child.on('exit',code=>process.exit(code??1));

