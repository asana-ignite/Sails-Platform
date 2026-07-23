import fs from 'fs';
import path from 'path';

function getFiles(dir: string): string[] {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const files = dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  });
  return Array.prototype.concat(...files);
}

const files = [...getFiles('tests'), ...getFiles('scripts'), ...getFiles('src')].filter(f => f.endsWith('.ts'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // fix auditLog -> dataAuditLog
  if (content.includes('db.auditLog.')) {
    content = content.replace(/db\.auditLog\./g, 'db.dataAuditLog.');
    changed = true;
  }

  // fix canRead: true/false -> readScope: 'TEAM', modifyScope: 'TEAM'
  // Actually, let's just use regex to replace the old boolean flags with the new enum logic in test files.
  if (file.includes('test-') || file.includes('scratch/')) {
    if (content.includes('canRead:')) {
      content = content.replace(/canRead:\s*(true|false),?/g, "readScope: 'TEAM',");
      content = content.replace(/canUpdate:\s*(true|false),?/g, "modifyScope: 'TEAM',");
      content = content.replace(/viewAllData:\s*(true|false),?/g, "");
      content = content.replace(/modifyAllData:\s*(true|false),?/g, "");
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}
