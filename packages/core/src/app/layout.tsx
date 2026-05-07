// KLAO Core — Headless API Engine
// This layout exists only to satisfy Next.js App Router requirements.
// All functionality is exposed via /api/* routes.

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
