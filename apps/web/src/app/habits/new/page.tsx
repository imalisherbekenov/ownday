import { HabitForm } from "@/components/habit-form";
import { saveHabitAction } from "../actions";
export default function NewHabitPage() {
  return (
    <main className="page py-6">
      <header className="mb-6">
        <p className="label">Новая привычка</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">Соберите ритм</h1>
        <p className="mt-2 text-ink-3">Начните с действия, которое легко повторить завтра.</p>
      </header>
      <HabitForm action={saveHabitAction.bind(null, undefined)} />
    </main>
  );
}
