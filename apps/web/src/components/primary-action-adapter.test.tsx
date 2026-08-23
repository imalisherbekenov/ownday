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
    colorScheme: "light",
    error: null,
    retry: vi.fn(),
  }),
}));

import { PrimaryActionAdapter } from "./primary-action-adapter";

describe("PrimaryActionAdapter", () => {
  afterEach(() => {
    cleanup();
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
});
