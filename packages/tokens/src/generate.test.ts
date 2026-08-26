import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCss, generate, readDesignTokens } from "./generate.js";

describe("design token generation", () => {
  it("round-trips every documented token and emits all light colors in bare root", async () => {
    const source = await readDesignTokens();
    await generate();
    const raw = JSON.parse(await readFile(path.resolve("dist/tokens.json"), "utf8"));
    expect(raw).toEqual(source);
    const css = createCss(source);
    const bareRoot = css.slice(css.indexOf(":root {"), css.indexOf("@media"));
    const mediaDark = css.slice(
      css.indexOf(':root:not([data-theme="light"])'),
      css.indexOf("}\n  }"),
    );
    const explicitDark = css.slice(css.indexOf(':root[data-theme="dark"]'));
    for (const [name, value] of Object.entries(source.color.light))
      expect(bareRoot).toContain(`--color-${name}: ${value};`);
    for (const [name, value] of Object.entries(source.color.dark)) {
      expect(mediaDark).toContain(`--color-${name}: ${value};`);
      expect(explicitDark).toContain(`--color-${name}: ${value};`);
    }
    expect(await readFile(path.resolve("dist/tokens.css"), "utf8")).toBe(css);
  });
});
