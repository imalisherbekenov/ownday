import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./telegram-provider", () => ({ useTelegram: () => ({ webApp: null }) }));
import { SettingsForm } from "./settings-form";
afterEach(cleanup);
it("keeps deletion outside the preferences form and requires a deliberate confirmation", () => {
  render(
    <SettingsForm
      timezone="UTC"
      dayStartHour={0}
      theme="dark"
      action={vi.fn()}
      signOutAction={vi.fn()}
      deleteAction={vi.fn()}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Тема" })).toHaveValue("dark");
  expect(screen.queryByRole("button", { name: "Удалить навсегда" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Удалить аккаунт" }));
  const button = screen.getByRole("button", { name: "Удалить навсегда" });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Введи DELETE для удаления" }), {
    target: { value: "DELETE" },
  });
  expect(button).toBeEnabled();
  expect(button.closest("form")).not.toBe(
    screen.getByRole("button", { name: "Сохранить настройки" }).closest("form"),
  );
});
it("keeps entered preferences available after a failed save", async () => {
  const action = vi.fn().mockRejectedValue(new Error("offline"));
  render(
    <SettingsForm
      timezone="UTC"
      dayStartHour={4}
      theme="system"
      action={action}
      signOutAction={vi.fn()}
      deleteAction={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Часовой пояс" }), {
    target: { value: "Asia/Tashkent" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Сохранить настройки" }).closest("form")!);
  await screen.findByRole("alert");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Сохранить настройки" })).toBeEnabled(),
  );
  expect(screen.getByRole("textbox", { name: "Часовой пояс" })).toHaveValue("Asia/Tashkent");
});
