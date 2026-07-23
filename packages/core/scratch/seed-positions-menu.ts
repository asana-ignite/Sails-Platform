import { db } from '../src/lib/db';

async function seedPositionMenu() {
  const usersMenu = await db.consoleMenu.findFirst({
    where: { componentKey: 'AdminUserManager' }
  });

  if (!usersMenu) {
    console.log("Users menu item not found.");
    return;
  }

  const existing = await db.consoleMenu.findFirst({
    where: { componentKey: 'AdminPositionManager' }
  });

  if (existing) {
    console.log("Position menu item already exists.");
    return;
  }

  await db.consoleMenu.create({
    data: {
      appId: usersMenu.appId,
      parentId: usersMenu.parentId,
      label: 'Positions',
      icon: 'Award',
      path: '/admin/positions',
      order: 1,
      requiredCapability: 'system.users.manage',
      componentKey: 'AdminPositionManager',
      actionType: 'plugin'
    }
  });

  console.log("Successfully seeded Positions menu item!");
}

seedPositionMenu().catch(console.error).finally(() => process.exit(0));
