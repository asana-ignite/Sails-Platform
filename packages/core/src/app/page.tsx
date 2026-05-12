// INIDOS Core — Headless API Engine
// No UI is served from this project. See INIDOS Console (/inidos-console) for the frontend.

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'monospace', color: '#888' }}>
      <h1>INIDOS Core API</h1>
      <p>This is a headless API engine. No UI is served here.</p>
      <p>API endpoints are available at <code>/api/*</code></p>
      <ul>
        <li><code>POST /api/tenant/provision</code></li>
        <li><code>POST /api/metadata/objects</code></li>
        <li><code>POST /api/metadata/fields</code></li>
        <li><code>GET /api/metadata/[tableName]</code></li>
        <li><code>POST /api/dynamic/[tableName]</code></li>
        <li><code>GET /api/dynamic/[tableName]</code></li>
      </ul>
    </main>
  );
}
