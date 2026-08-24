/**
 * Script to seed Customer fields, default LIST layout, and sample records for SAILS Platform.
 */
import { Pool } from 'pg';
import { db } from '../packages/core/src/lib/db';
import crypto from 'crypto';

function generateTimeOrderedId(): string {
  return Date.now().toString(36) + crypto.randomBytes(8).toString('hex');
}

async function main() {
  console.log('--- Starting Customer Schema & Sample Data Seeding ---');

  const tenant = await db.tenant.findFirst({
    where: { schemaName: 'tenant_sails_default' },
    include: { users: true }
  });

  if (!tenant) {
    throw new Error('Default tenant not found');
  }

  const adminUser = tenant.users.find(u => u.role === 'SUPER_ADMIN' || u.role === 'TENANT_ADMIN') || tenant.users[0];
  const adminId = adminUser?.id || 'admin_user';

  const customerTable = await db.tableDefinition.findFirst({
    where: { tenantId: tenant.id, tableName: 'customers' }
  });

  if (!customerTable) {
    throw new Error('Customer table definition not found in core.tables');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // 1. Add physical columns to tenant_sails_default.customers if not exist
  console.log('1. Adding physical columns to tenant_sails_default.customers...');
  await pool.query(`
    ALTER TABLE tenant_sails_default.customers 
      ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active',
      ADD COLUMN IF NOT EXISTS city VARCHAR(100);
  `);
  console.log('   ✅ Physical columns added/verified.');

  // 2. Register fields in core.fields
  console.log('2. Registering fields in core.fields...');
  const fieldsToRegister = [
    { name: 'Customer Name', fieldName: 'customer_name', physicalType: 'varchar', logicalType: 'text' },
    { name: 'Email', fieldName: 'email', physicalType: 'varchar', logicalType: 'email' },
    { name: 'Phone', fieldName: 'phone', physicalType: 'varchar', logicalType: 'phone' },
    { name: 'Company Name', fieldName: 'company_name', physicalType: 'varchar', logicalType: 'text' },
    { name: 'Status', fieldName: 'status', physicalType: 'varchar', logicalType: 'select', config: { options: ['Active', 'Lead', 'Inactive', 'VIP'] } },
    { name: 'City', fieldName: 'city', physicalType: 'varchar', logicalType: 'text' }
  ];

  for (const f of fieldsToRegister) {
    const existing = await db.fieldDefinition.findFirst({
      where: { tableId: customerTable.id, fieldName: f.fieldName }
    });
    if (!existing) {
      await db.fieldDefinition.create({
        data: {
          tableId: customerTable.id,
          name: f.name,
          fieldName: f.fieldName,
          physicalType: f.physicalType,
          logicalType: f.logicalType,
          config: f.config || {},
          isSystem: false,
          isNullable: true
        }
      });
      console.log(`   + Registered field: ${f.name} (${f.fieldName})`);
    } else {
      console.log(`   = Field already registered: ${f.fieldName}`);
    }
  }

  // 3. Create or update default LIST layout in core.table_layouts
  console.log('3. Configuring default LIST layout for customers...');
  const listConfig = {
    columns: ['customer_name', 'email', 'phone', 'company_name', 'status', 'city', 'created_at'],
    sortBy: [{ fieldId: 'created_at', direction: 'desc' }],
    recordsPerPage: 25,
    allowPaging: true,
    allowMultiSelect: true
  };

  const existingListLayout = await db.tableLayout.findFirst({
    where: { tableId: customerTable.id, viewType: 'LIST' }
  });

  if (!existingListLayout) {
    await db.tableLayout.create({
      data: {
        tableId: customerTable.id,
        name: 'Customer List View',
        systemName: `customers_list_${tenant.id.slice(0, 8)}`,
        viewType: 'LIST',
        layoutType: 'data',
        isDefault: true,
        status: 'active',
        config: listConfig,
        publishedConfig: listConfig,
        currentVersion: 1
      }
    });
    console.log('   ✅ Created and activated default Customer List View.');
  } else {
    await db.tableLayout.update({
      where: { id: existingListLayout.id },
      data: {
        isDefault: true,
        status: 'active',
        config: listConfig,
        publishedConfig: listConfig
      }
    });
    console.log('   ✅ Updated and activated existing Customer List View.');
  }

  // 4. Seed sample customer records
  console.log('4. Seeding sample customer records...');
  const sampleCustomers = [
    { name: 'John Doe', email: 'john.doe@techcorp.io', phone: '+1-555-0101', company: 'TechCorp Solutions', status: 'Active', city: 'San Francisco' },
    { name: 'Sarah Jenkins', email: 'sarah.j@innovate.co', phone: '+1-555-0102', company: 'Innovate Digital', status: 'VIP', city: 'New York' },
    { name: 'Michael Chang', email: 'mchang@apexlogistics.com', phone: '+1-555-0103', company: 'Apex Logistics', status: 'Active', city: 'Seattle' },
    { name: 'Elena Rostova', email: 'elena@nordicdesign.se', phone: '+46-8-555-0104', company: 'Nordic Design Studio', status: 'Lead', city: 'Stockholm' },
    { name: 'Liam O\'Connor', email: 'liam@emeraldhealth.ie', phone: '+353-1-555-0105', company: 'Emerald Healthcare', status: 'Active', city: 'Dublin' },
    { name: 'Amina Al-Mansoor', email: 'amina@gulfventures.ae', phone: '+971-4-555-0106', company: 'Gulf Ventures', status: 'VIP', city: 'Dubai' },
    { name: 'Somchai Prasert', email: 'somchai@siamconsulting.th', phone: '+66-2-555-0107', company: 'Siam Consulting Group', status: 'Active', city: 'Bangkok' }
  ];

  for (const c of sampleCustomers) {
    const id = generateTimeOrderedId();
    await pool.query(`
      INSERT INTO tenant_sails_default.customers 
        (id, tenant_id, owner_id, customer_name, email, phone, company_name, status, city, created_at, updated_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;
    `, [id, tenant.id, adminId, c.name, c.email, c.phone, c.company, c.status, c.city]);
  }
  console.log(`   ✅ Inserted ${sampleCustomers.length} sample customer records.`);

  // 5. Ensure rls_user grants on new columns
  await pool.query(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA tenant_sails_default TO rls_user;
  `);

  await pool.end();
  console.log('--- Customer Seeding Completed Successfully! ---');
}

main().catch(err => {
  console.error('Error seeding customers:', err);
  process.exit(1);
});
