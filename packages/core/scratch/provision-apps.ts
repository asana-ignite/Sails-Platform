async function run() {
  console.log("🚀 Provisioning Apps and Menus for Default Tenant...");

  const BASE_URL = "http://localhost:3000";

  const config = [
    {
      app: { name: "Sales", icon: "ShoppingBag", order: 0 },
      menus: [
        { label: "Leads", icon: "Users", path: "/table/leads" },
        { label: "Accounts", icon: "Building", path: "/table/accounts" },
        { label: "Contacts", icon: "UserSquare", path: "/table/contacts" },
        { label: "Opportunities", icon: "Target", path: "/table/opportunities" },
        { label: "Quotes", icon: "FileText", path: "/table/quotes" }
      ]
    },
    {
      app: { name: "Sales Manager", icon: "Briefcase", order: 1 },
      menus: [
        { label: "Team Performance", icon: "BarChart3", path: "/dashboard/performance" },
        { label: "Sales Forecast", icon: "LineChart", path: "/dashboard/forecast" },
        { label: "Territory Management", icon: "Map", path: "/table/territories" },
        { label: "Commission Reports", icon: "BadgeDollarSign", path: "/table/commissions" },
        { label: "Approval Requests", icon: "ClipboardCheck", path: "/approvals" }
      ]
    },
    {
      app: { name: "Marketing", icon: "Megaphone", order: 2 },
      menus: [
        { label: "Campaigns", icon: "Flag", path: "/table/campaigns" },
        { label: "Email Templates", icon: "Mail", path: "/table/templates" },
        { label: "Content Library", icon: "Library", path: "/library" },
        { label: "Social Analytics", icon: "Share2", path: "/dashboard/social" },
        { label: "Customer Segments", icon: "Users2", path: "/table/segments" }
      ]
    },
    {
      app: { name: "Services", icon: "LifeBuoy", order: 3 },
      menus: [
        { label: "Support Cases", icon: "Inbox", path: "/table/cases" },
        { label: "Knowledge Base", icon: "BookOpen", path: "/kb" },
        { label: "SLA Management", icon: "ShieldCheck", path: "/table/sla" },
        { label: "Customer Feedback", icon: "MessageSquare", path: "/table/feedback" },
        { label: "Resource Scheduling", icon: "Calendar", path: "/calendar/resources" }
      ]
    }
  ];

  const TENANT_ID = "ffecbf6e-2574-4636-bc99-d228c9f869a7";

  for (const item of config) {
    console.log(`\n📦 Creating App: ${item.app.name}...`);
    const appResp = await fetch(`${BASE_URL}/api/console/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item.app,
        tenantId: TENANT_ID
      })
    });
    
    if (!appResp.ok) {
        console.error(`   ❌ Failed to create app ${item.app.name}:`, await appResp.text());
        continue;
    }
    
    const app = await appResp.json();
    console.log(`   ✅ App Created: ${app.id}`);

    for (const menu of item.menus) {
        const menuResp = await fetch(`${BASE_URL}/api/console/menus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...menu,
                appId: app.id,
                actionType: 'table'
            })
        });

        if (menuResp.ok) {
            console.log(`      ✅ Menu Created: ${menu.label}`);
        } else {
            console.error(`      ❌ Failed to create menu ${menu.label}:`, await menuResp.text());
        }
    }
  }

  console.log("\n🏁 Provisioning complete.");
}

run();
