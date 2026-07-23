import { db } from '../src/lib/db';

async function main() {
  console.log('Updating Connected Apps menu path in PostgreSQL database...');
  const updated = await db.consoleMenu.updateMany({
    where: { componentKey: 'AdminConnectedApps' },
    data: { path: '/admin/connected-apps' }
  });
  console.log(`Updated ${updated.count} menu records.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await db.$disconnect();
  });
