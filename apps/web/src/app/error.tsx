"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-ink-2">Your data is safe. Try loading this view again.</p>
      <button
        className="rounded-input bg-ink px-5 py-3 text-surface active:scale-[.98]"
        onClick={reset}
      >
        Try again
      </button>
    </main>
  );
}
