/**
 * Record-navigation helpers shared by controls and related-record blocks.
 */

/** Default DETAIL view (active + isDefault → active → first) of a target model. */
export async function resolveDefaultDetailLayout(targetTable: string): Promise<any> {
  try {
    const list = await fetch(
      `/api/console/layouts?tableId=${encodeURIComponent(targetTable)}&viewType=DETAIL&page=1&limit=100`
    ).then((r) => r.json());
    const rows: any[] = list?.data?.rows || [];
    return (
      rows.find((r: any) => r.status === 'active' && r.isDefault) ||
      rows.find((r: any) => r.status === 'active') ||
      rows[0] ||
      null
    );
  } catch {
    return null;
  }
}
