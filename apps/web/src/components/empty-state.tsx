export function EmptyState({
  title = "A clear day",
  description = "Add a habit to start shaping your routine.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 h-12 w-12 rounded-full border-2 border-dashed border-line" />
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-2 max-w-xs text-ink-3">{description}</p>
    </div>
  );
}
