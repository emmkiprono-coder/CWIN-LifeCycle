export default function Home() {
  return (
    <main style={{ padding: 40, maxWidth: 720 }}>
      <h1>CWIN Care Operations OS</h1>
      <p>
        Phase 1 scaffold: Connecteam timesheet import, pay/rate rules engine,
        reconciliation exceptions, invoice and pay-stub generation.
      </p>
      <p>
        This system runs separately from the live CWIN At Home app while it's
        being built out — see <code>README.md</code> for the architecture and
        migration plan.
      </p>
      <ul>
        <li>
          <code>POST /api/import/connecteam</code> — upload a Connecteam
          timesheet export (.xlsx)
        </li>
        <li>
          <code>GET /api/health</code> — service health check
        </li>
      </ul>
    </main>
  );
}
