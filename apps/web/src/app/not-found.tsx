import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Habit not found</h1>
      <p className="text-ink-2">It may have been archived or removed.</p>
      <Link className="rounded-input bg-ink px-5 py-3 text-surface" href="/">
        Back to today
      </Link>
    </main>
  );
}
