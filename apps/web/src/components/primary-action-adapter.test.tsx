import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TelegramContext } from "./telegram-provider";

const mainButton = {
  setText: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  onClick: vi.fn(),
  offClick: vi.fn(),
};
vi.mock("./telegram-provider", () => ({
  useTelegram: (): TelegramContext => ({
    status: "ready",
    webApp: {
      initData: "mock",
      ready: vi.fn(),
      expand: vi.fn(),
      MainButton: mainButton,
      BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
    },
    isMock: false,
    colorScheme: "light",
    error: null,
    retry: vi.fn(),
  }),
}));

import { PrimaryActionAdapter } from "./primary-action-adapter";

describe("PrimaryActionAdapter", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });
  it("leaves link actions visible and does not claim Telegram MainButton", () => {
    render(<PrimaryActionAdapter href="/habits/new">Add a habit</PrimaryActionAdapter>);
    expect(screen.getByRole("link", { name: "Add a habit" })).toHaveAttribute(
      "href",
      "/habits/new",
    );
    expect(mainButton.setText).not.toHaveBeenCalled();
    expect(mainButton.onClick).not.toHaveBeenCalled();
    expect(mainButton.show).not.toHaveBeenCalled();
  });

  it("does not render a duplicate web submit action for forms", () => {
    render(<PrimaryActionAdapter formId="wrapped-form">Save</PrimaryActionAdapter>);
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(mainButton.setText).toHaveBeenCalledWith("Save");
  });

  // Тридцать одна секунда нажатий дала семь одинаковых привычек, поэтому здесь
  // проверяется и запрет второго нажатия, и возврат к жизни: отказ сервера не
  // должен запирать единственную кнопку экрана навсегда.
  it("submits once while the form is busy and lets go when the form recovers", () => {
    const { requestSubmit, nativeButton } = mountForm();
    render(<PrimaryActionAdapter formId="wrapped-form">Save</PrimaryActionAdapter>);
    const press = mainButton.onClick.mock.calls[0]?.[0] as () => void;

    press();
    expect(requestSubmit).toHaveBeenCalledTimes(1);

    nativeButton.disabled = true;
    press();
    press();
    expect(requestSubmit).toHaveBeenCalledTimes(1);

    nativeButton.disabled = false;
    press();
    expect(requestSubmit).toHaveBeenCalledTimes(2);
  });
});

// Оболочка, которую адаптер ищет по formId: форма со своей нативной кнопкой,
// той самой, которую useFormStatus гасит на время ответа.
function mountForm() {
  const host = document.createElement("div");
  host.id = "wrapped-form";
  host.innerHTML = '<form><button class="primary" type="submit">Save</button></form>';
  document.body.append(host);
  const form = host.querySelector("form") as HTMLFormElement;
  const requestSubmit = vi.fn();
  form.requestSubmit = requestSubmit;
  return { requestSubmit, nativeButton: host.querySelector("button") as HTMLButtonElement };
}
