import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const tenantId = 'cb5586fd-37df-4d81-8b68-c9414a5c41a7';

async function main() {
  console.log('🌱 Seeding UI Metadata...');

  // 1. Create Apps
  const apps = [
    { name: 'Sales', icon: 'ShoppingBag', order: 0 },
    { name: 'Sales Manager', icon: 'Users', order: 1 },
    { name: 'Marketing', icon: 'Megaphone', order: 2 },
  ];

  for (const appData of apps) {
    const app = await prisma.consoleApp.create({
      data: {
        tenantId,
        name: appData.name,
        icon: appData.icon,
        order: appData.order,
      }
    });
    console.log(`✅ Created App: ${app.name}`);

    // Add 4 menus to the Sales app
    if (app.name === 'Sales') {
      const menus = [
        { label: 'Overview', icon: 'Activity', path: '/', order: 0 },
        { label: 'Leads', icon: 'Target', path: '/crm/leads', order: 1 },
        { label: 'Customers', icon: 'UserCheck', path: '/crm/customers', order: 2 },
        { label: 'Settings', icon: 'Settings', path: '/crm/settings', order: 3 },
      ];

      for (const menuData of menus) {
        await prisma.consoleMenu.create({
          data: {
            appId: app.id,
            label: menuData.label,
            icon: menuData.icon,
            path: menuData.path,
            order: menuData.order,
            actionType: 'table'
          }
        });
        console.log(`   - Created Menu: ${menuData.label}`);
      }
    }
  }

  console.log('✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
