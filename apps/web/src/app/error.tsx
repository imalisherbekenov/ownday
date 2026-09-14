"use client";
import { useInterfaceLocale } from "@/components/interface-locale";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useInterfaceLocale();
  return (
    <main className="page flex min-h-[70dvh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold">
        {t("Не удалось открыть страницу", "Could not open this page")}
      </h1>
      <p className="text-ink-2">
        {t("Попробуй загрузить её ещё раз.", "Try loading this view again.")}
      </p>
      <button
        className="rounded-input bg-ink px-5 py-3 text-surface active:scale-[.98]"
        onClick={reset}
      >
        {t("Попробовать снова", "Try again")}
      </button>
    </main>
  );
}
