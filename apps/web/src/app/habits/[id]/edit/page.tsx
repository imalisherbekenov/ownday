import { notFound } from "next/navigation";
import { HabitForm } from "@ownday/ui";
import { getCurrentUserId, services } from "@/lib/services";
import { saveHabitAction } from "../../actions";
import { PrimaryActionAdapter } from "@/components/primary-action-adapter";
export default async function EditHabitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    userId = await getCurrentUserId(),
    habit = (await services.listHabits(userId, true)).find((h) => h.id === id);
  if (!habit) notFound();
  return (
    <main className="page py-6">
      <header className="app-header mb-6">
        <p className="label">Редактирование</p>
        <h1 className="text-[32px] font-extrabold tracking-[-.03em]">{habit.title}</h1>
      </header>
      <div id="edit-habit-form">
        <HabitForm initial={habit} action={saveHabitAction.bind(null, id)} />
      </div>
      <PrimaryActionAdapter formId="edit-habit-form">Сохранить изменения</PrimaryActionAdapter>
    </main>
  );
}
