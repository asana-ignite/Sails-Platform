import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const appId = '0b3f86f3-b3d7-4743-a681-b1cf1ad1f81d'; // Sales Manager

async function main() {
  console.log('🌱 Seeding Menus for Sales Manager...');

  const menus = [
    { label: 'Team Performance', icon: 'BarChart3', path: '/manager/performance', order: 0 },
    { label: 'Agent Monitoring', icon: 'Monitor', path: '/manager/monitoring', order: 1 },
    { label: 'Pipeline Review', icon: 'GitMerge', path: '/manager/pipeline', order: 2 },
    { label: 'Targets & Quotas', icon: 'Trophy', path: '/manager/targets', order: 3 },
  ];

  for (const menuData of menus) {
    await prisma.consoleMenu.create({
      data: {
        appId,
        label: menuData.label,
        icon: menuData.icon,
        path: menuData.path,
        order: menuData.order,
        actionType: 'plugin'
      }
    });
    console.log(`✅ Created Menu: ${menuData.label}`);
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
