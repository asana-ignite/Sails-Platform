import { db } from '../src/lib/db';

async function checkMenu() {
  const menus = await db.consoleMenu.findMany({
    where: { label: 'Positions' },
    include: { app: true }
  });
  console.log("Positions menu:", JSON.stringify(menus, null, 2));
}

checkMenu().catch(console.error).finally(() => process.exit(0));
