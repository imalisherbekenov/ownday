import { describe, expect, it } from "vitest";
import { en } from "./en.js";
import { ru } from "./ru.js";
import { t } from "./index.js";

describe("i18n", () => {
  it("has exactly the same keys in both languages", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });

  it("replaces every occurrence of a placeholder", () => {
    expect(t("en", "createQuestion", { title: "x" })).not.toContain("{title}");
  });
});
