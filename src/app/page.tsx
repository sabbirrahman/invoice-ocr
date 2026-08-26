export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Invoice Intake</h1>
      <p className="text-zinc-600">
        Extract Japanese invoices with AI, verify amounts, review with a human,
        then register into the accounting API.
      </p>
      <p className="text-sm text-zinc-500">
        Queue UI arrives in a later batch. Run{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
          pnpm dev
        </code>{" "}
        to start the app and mock accounting API.
      </p>
    </main>
  );
}
