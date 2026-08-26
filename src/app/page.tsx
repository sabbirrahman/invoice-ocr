import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <p className="text-muted-foreground text-sm tracking-wide">
          Sample Trading Co.
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Invoice Intake
        </h1>
        <p className="text-muted-foreground text-pretty">
          Extract Japanese invoices with AI, verify amounts against the
          accounting API, then review before anything is posted. Nothing is
          registered automatically.
        </p>
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
