import { db } from '@/lib/db';

/**
 * Shared auto-repair: ensures expected Platform Studio sub-menus exist.
 * Handles migrations when new menu items are added to the codebase
 * but tenants were provisioned before the change.
 */
export async function ensurePlatformStudioMenus(tenantId: string) {
  const adminApp = await db.consoleApp.findFirst({
    where: { tenantId, name: 'Settings & Admin' }
  });
  if (!adminApp) return;

  const platformStudio = await db.consoleMenu.findFirst({
    where: { appId: adminApp.id, label: 'Platform Studio', parentId: null },
    include: { children: true }
  });
  if (!platformStudio) return;

  const existingChildren = platformStudio.children || [];

  const expectedMenus = [
    { label: 'Views', icon: 'LayoutTemplate', path: '/admin/views', order: 1, requiredCapability: 'system.schema.manage', componentKey: 'AdminViewManager', actionType: 'plugin' }
  ];

  for (const expected of expectedMenus) {
    const exists = existingChildren.some((c: any) => c.label === expected.label);
    if (exists) continue;

    const siblingsToShift = existingChildren.filter((c: any) => c.order >= expected.order);
    for (const sib of siblingsToShift) {
      await db.consoleMenu.update({
        where: { id: sib.id },
        data: { order: sib.order + 1 }
      });
    }

    await db.consoleMenu.create({
      data: {
        appId: adminApp.id,
        parentId: platformStudio.id,
        ...expected
      }
    });

    console.log(`[AUTO-REPAIR] Added '${expected.label}' menu under Platform Studio for tenant ${tenantId}`);
  }
}
