/**
 * Layout prune + spacer persistence test.
 * Self-contained: creates and drops its own throwaway table/layout.
 */
import { db } from '@/lib/db';
import { getTranslator } from '@/lib/services';

let failures = 0;
function check(label: string, ok: boolean, extra?: any) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ''}`);
  if (!ok) failures++;
}

async function main() {
  const tenant = await db.tenant.findFirstOrThrow({});
  const tl = getTranslator();
  const table = await tl.createTable(tenant.id, 'Prune Test', 'prune_test');
  const f1 = await tl.addFieldDef(table.id, 'Field One', 'field_one', 'text', 'short_text');
  const f2 = await tl.addFieldDef(table.id, 'Field Two', 'field_two', 'text', 'short_text');
  const f3 = await tl.addFieldDef(table.id, 'Field Three', 'field_three', 'text', 'short_text');

  const makeConfig = () => ({
    sections: [{ id: 's1', title: 'S', columns: 2 }],
    recordTitleField: f1.id,
    blocks: [
      { id: 'b1', blockType: 'field', fieldId: f1.id, sectionId: 's1', position: 0, width: 6, visible: true },
      { id: 'b2', blockType: 'spacer', sectionId: 's1', position: 1, width: 12, visible: true, height: 48 },
      { id: 'b3', blockType: 'field', fieldId: f3.id, sectionId: 's1', position: 2, width: 6, visible: true,
        conditions: [{ fieldId: f2.id }], validations: [{ fieldId: f2.id }] },
      { id: 'b4', blockType: 'tab_group', sectionId: 's1', position: 3, width: 12, visible: true,
        tabs: [{ id: 't1', label: 'Tab', sectionIds: [], blocks: [
          { id: 'b5', blockType: 'field', fieldId: f2.id, width: 12, visible: true },
        ] }] },
    ],
  });

  const layout = await db.tableLayout.create({
    data: {
      tableId: table.id, layoutType: 'data', viewType: 'FORM', name: 'Test Form', systemName: 'test_form',
      config: makeConfig() as any,
      publishedConfig: makeConfig() as any,
    },
  });

  // Spacer survives a save/publish round trip (opaque JSON).
  const saved = await db.tableLayout.findUniqueOrThrow({ where: { id: layout.id } });
  const savedBlocks = (saved.config as any).blocks;
  const spacer = savedBlocks.find((b: any) => b.blockType === 'spacer');
  check('spacer persists with height in layout config', !!spacer && spacer.height === 48 && spacer.width === 12, spacer);

  // Delete field_one → prune from config + publishedConfig.
  await tl.removeFieldDef(f1.id);
  const pruned = await db.tableLayout.findUniqueOrThrow({ where: { id: layout.id } });
  const cfg = pruned.config as any;
  const pub = pruned.publishedConfig as any;

  check('orphaned field block pruned from config', !cfg.blocks.some((b: any) => b.fieldId === f1.id), cfg.blocks.map((b: any) => b.blockType));
  check('orphaned field block pruned from publishedConfig', !pub.blocks.some((b: any) => b.fieldId === f1.id));
  check('spacer retained after prune', cfg.blocks.some((b: any) => b.blockType === 'spacer'));
  check('unrelated field block retained', cfg.blocks.some((b: any) => b.blockId ?? b.fieldId === f3.id) || cfg.blocks.some((b: any) => b.fieldId === f3.id));
  const tabBlocks = cfg.blocks.find((b: any) => b.blockType === 'tab_group').tabs[0].blocks;
  check('tab-nested field block for surviving field retained', tabBlocks.length === 1 && tabBlocks[0].fieldId === f2.id, tabBlocks);
  check('recordTitleField cleared', cfg.recordTitleField === null, cfg.recordTitleField);

  // Delete field_two → condition/validation refs stripped + tab block pruned.
  await tl.removeFieldDef(f2.id);
  const pruned2 = await db.tableLayout.findUniqueOrThrow({ where: { id: layout.id } });
  const cfg2 = pruned2.config as any;
  const b3 = cfg2.blocks.find((b: any) => b.fieldId === f3.id);
  check('conditions referencing deleted field stripped', Array.isArray(b3.conditions) && b3.conditions.length === 0, b3.conditions);
  check('validations referencing deleted field stripped', Array.isArray(b3.validations) && b3.validations.length === 0, b3.validations);
  const tabBlocks2 = cfg2.blocks.find((b: any) => b.blockType === 'tab_group').tabs[0].blocks;
  check('tab-nested block for deleted field pruned', tabBlocks2.length === 0, tabBlocks2);

  // Cleanup
  await db.tableLayout.delete({ where: { id: layout.id } });
  await tl.removeTable(table.id);
  console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error('CRASH', e); process.exit(1); });
