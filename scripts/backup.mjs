import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
const data = path.resolve(process.env.DATA_DIR || 'data');
const folder = path.join(
  data,
  'backups',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
await mkdir(folder, { recursive: true });
const db = new DatabaseSync(path.join(data, 'mercaz.sqlite'));
await backup(db, path.join(folder, 'mercaz.sqlite'));
db.close();
await cp(path.join(data, 'uploads'), path.join(folder, 'uploads'), {
  recursive: true,
});
await writeFile(
  path.join(folder, 'LEIA-ME.txt'),
  'Backup SQLite consistente + uploads. Preserve também .env/TOKEN_ENCRYPTION_KEY separadamente. Não restaure sobre um serviço em execução.',
);
console.log(folder);
