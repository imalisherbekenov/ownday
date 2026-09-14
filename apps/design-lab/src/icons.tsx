export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    water: <path d="M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Zm-3 12c0 2 1 3 3 3" />,
    book: (
      <>
        <path d="M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1Z" />
      </>
    ),
    walk: (
      <>
        <circle cx="14" cy="4" r="2" />
        <path d="m7 21 4-7 3 2 1 5M5 11l4-1 3-4 3 5 4 1M12 7l-1 7" />
      </>
    ),
    pen: (
      <>
        <path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15Zm1-5 4 4" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    chart: (
      <>
        <path d="M4 3v17h17M8 15l4-5 4 2 5-7" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    moon: <path d="M20 14a8 8 0 0 1-10-10A9 9 0 1 0 20 14Z" />,
    flame: <path d="M12 3c1 4 6 5 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 3 1 4 2 4 2-3 2-6 1-9Z" />,
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4C8 2 2 9 7 16s15 0 13-12ZM5 21l10-11" />
      </>
    ),
    skip: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    back: <path d="M20 12H4m6-6-6 6 6 6" />,
    reset: (
      <>
        <path d="M4 9a8 8 0 1 1 0 6M4 3v6h6" />
      </>
    ),
    cloud: <path d="M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13 1 4.5 4.5 0 0 1 0 9ZM9 13l3-3 3 3m-3-3v7" />,
    offline: (
      <>
        <path d="m3 3 18 18M2 8c2-2 4-3 7-3m7 1c3 0 5 2 6 3M5 12a10 10 0 0 1 7-3m-4 7a5 5 0 0 1 8 0" />
        <circle cx="12" cy="20" r="1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.leaf}
    </svg>
  );
}
