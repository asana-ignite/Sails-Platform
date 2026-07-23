import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inspecting console_menus for Teams...');
  
  // Find menus labeled 'Teams' or with path containing 'teams'
  const teamMenus = await prisma.consoleMenu.findMany({
    where: {
      OR: [
        { label: { contains: 'Teams', mode: 'insensitive' } },
        { path: { contains: 'teams', mode: 'insensitive' } }
      ]
    }
  });

  console.log('Found menus:', teamMenus);

  // Update all of them to ensure path is /admin/teams, actionType is plugin, componentKey is AdminTeamManager
  for (const menu of teamMenus) {
    const updated = await prisma.consoleMenu.update({
      where: { id: menu.id },
      data: {
        path: '/admin/teams',
        actionType: 'plugin',
        componentKey: 'AdminTeamManager',
        requiredCapability: 'system.teams.manage'
      }
    });
    console.log('Updated menu:', updated);
  }

  // Also check if any menu items in general have invalid paths or missing componentKeys
  const allPluginMenus = await prisma.consoleMenu.findMany({
    where: { actionType: 'plugin' }
  });
  console.log('All plugin menus in DB:', allPluginMenus.map(m => ({ label: m.label, path: m.path, key: m.componentKey })));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
