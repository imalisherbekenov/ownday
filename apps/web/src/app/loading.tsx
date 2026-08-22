export default function Loading() {
  return (
    <main className="page animate-pulse py-6" aria-busy="true">
      <div className="mb-6 h-10 w-48 rounded-input bg-surface-2" />
      <div className="h-20 rounded-card bg-surface-2" />
      <div className="mt-6 h-72 rounded-card bg-surface-2" />
    </main>
  );
}
