import { notFound } from "next/navigation";
import { HabitForm } from "@/components/habit-form";
import { getCurrentUserId, services } from "@/lib/services";
import { saveHabitAction } from "../../actions";
export default async function EditHabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    userId = await getCurrentUserId(),
    habit = (await services.listHabits(userId, true)).find((h) => h.id === id);
  if (!habit) notFound();
  return (
    <main className="page py-6">
      <header className="mb-6">
        <p className="label">Редактирование</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">{habit.title}</h1>
      </header>
      <HabitForm initial={habit} action={saveHabitAction.bind(null, id)} />
    </main>
  );
}
