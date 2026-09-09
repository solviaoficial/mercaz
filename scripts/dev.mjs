import { spawn } from 'node:child_process';
const opts = {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
};
const api = spawn(
  process.execPath,
  ['--env-file-if-exists=.env', 'server/index.mjs'],
  opts,
);
const web = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], opts);
const stop = () => {
  api.kill();
  web.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', () => web.kill());
web.on('exit', () => api.kill());
