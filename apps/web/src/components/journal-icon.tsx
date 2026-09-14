export function JournalIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths: Record<string, string> = {
    sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    water: "M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Z",
    book: "M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z",
    leaf: "M4 20 18 6M4 15C4 5 13 3 21 3c0 8-2 17-12 17",
    grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
    chart: "M5 20V10m7 10V4m7 16V8",
    settings:
      "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6 2.1 2.1m8.6 8.6 2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6 2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    plus: "M12 5v14M5 12h14",
    check: "m5 12 4 4L19 6",
    timer: "M9 2h6M12 8v5l3 2M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.leaf} />
    </svg>
  );
}
