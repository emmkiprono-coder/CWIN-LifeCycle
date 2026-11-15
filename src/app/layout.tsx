export const metadata = {
  title: "CWIN Care Operations OS",
  description: "Time ingestion, pay rules, invoicing, CRM, and reconciliation for CWIN At Home.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
