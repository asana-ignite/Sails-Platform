async function run() {
  console.log("🚀 Starting Full CRUD API Test...");

  const BASE_URL = "http://localhost:3000";

  // 1. Provision Tenant
  console.log("\n1. Provisioning New Tenant...");
  const provisionResponse = await fetch(`${BASE_URL}/api/tenant/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "CRUD Test Corp",
      adminEmail: "admin@crudtest.com"
    })
  });

  const provisionResult = await provisionResponse.json();
  if (!provisionResponse.ok) {
    console.error("   ❌ Tenant Provisioning Failed:", provisionResult.error);
    return;
  }
  const tenantId = provisionResult.tenant.id;
  const adminTeamId = provisionResult.adminTeam.id;
  console.log("   ✅ Tenant Provisioned:", tenantId);

  // 2. Create App (C)
  console.log("\n2. Creating New App...");
  const appResponse = await fetch(`${BASE_URL}/api/console/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: "Initial App", icon: "Box", tenantId })
  });
  const appResult = await appResponse.json();
  const appId = appResult.id;
  console.log("   ✅ App Created:", appId);

  // 3. Update App (U)
  console.log("\n3. Updating App Name...");
  const patchResponse = await fetch(`${BASE_URL}/api/console/apps/${appId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: "Updated App Name" })
  });
  if (patchResponse.ok) {
    console.log("   ✅ App Updated");
  }

  // 4. Create Menu (C)
  console.log("\n4. Creating Nav Menu...");
  const menuResponse = await fetch(`${BASE_URL}/api/console/menus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appId, label: "Home", icon: "Home", path: "/home" })
  });
  const menuResult = await menuResponse.json();
  const menuId = menuResult.id;
  console.log("   ✅ Menu Created:", menuId);

  // 5. Read App (R)
  console.log("\n5. Reading App Details...");
  const getResponse = await fetch(`${BASE_URL}/api/console/apps/${appId}`);
  const getResult = await getResponse.json();
  console.log("   ✅ App Name from API:", getResult.name);
  console.log("   ✅ Menus Count:", getResult.menus.length);

  // 6. Delete Menu (D)
  console.log("\n6. Deleting Menu...");
  const deleteMenuResp = await fetch(`${BASE_URL}/api/console/menus/${menuId}`, { method: 'DELETE' });
  if (deleteMenuResp.status === 204) {
    console.log("   ✅ Menu Deleted");
  }

  // 7. Delete App (D)
  console.log("\n7. Deleting App...");
  const deleteAppResp = await fetch(`${BASE_URL}/api/console/apps/${appId}`, { method: 'DELETE' });
  if (deleteAppResp.status === 204) {
    console.log("   ✅ App Deleted");
  }

  console.log("\n🏁 Full CRUD Verification complete.");
}

run();
