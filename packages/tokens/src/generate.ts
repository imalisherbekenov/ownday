import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "yaml";

export type Scalar = string | number;
export type TokenTree = { [key: string]: Scalar | Scalar[] | TokenTree };
export interface DesignTokens extends TokenTree {
  color: { light: Record<string, string>; dark: Record<string, string> };
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");

export async function readDesignTokens(): Promise<DesignTokens> {
  const markdown = await readFile(path.join(repoRoot, "docs/design.md"), "utf8");
  const match = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
  if (!match?.[1]) throw new Error("docs/design.md must start with YAML frontmatter");
  const parsed = parse(match[1]) as DesignTokens;
  for (const key of ["color", "typography", "space", "radius", "layout", "elevation"]) {
    if (!(key in parsed)) throw new Error(`Missing token section: ${key}`);
  }
  return parsed;
}

const kebab = (segments: string[]) => segments.join("-");
function flatten(value: unknown, prefix: string[] = []): Array<[string, Scalar]> {
  if (typeof value === "string" || typeof value === "number") return [[kebab(prefix), value]];
  if (Array.isArray(value))
    return value.flatMap((item, index) => flatten(item, [...prefix, String(index + 1)]));
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, [...prefix, key]),
  );
}
const cssValue = (name: string, value: Scalar) =>
  typeof value === "number" && !/(weight|version)$/.test(name) ? `${value}px` : String(value);
const declarations = (pairs: Array<[string, Scalar]>) =>
  pairs.map(([name, value]) => `  --${name}: ${cssValue(name, value)};`).join("\n");

export function createCss(tokens: DesignTokens): string {
  const nonColors = Object.entries(tokens)
    .filter(([key]) => !["color", "name", "version"].includes(key))
    .flatMap(([key, value]) => flatten(value, [key]));
  const light = flatten(tokens.color.light, ["color"]);
  const dark = flatten(tokens.color.dark, ["color"]);
  return `:root {\n${declarations([...light, ...nonColors])}\n}\n\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n${declarations(
    dark,
  )
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")}\n  }\n}\n\n:root[data-theme="dark"] {\n${declarations(dark)}\n}\n`;
}

function typescript(tokens: DesignTokens): string {
  const json = JSON.stringify(tokens, null, 2);
  return `// Generated from docs/design.md. Do not edit.\nexport const tokens = ${json} as const;\nexport const light = tokens.color.light;\nexport const dark = tokens.color.dark;\nexport type ColorTokenName = keyof typeof light;\nexport type SpaceTokenName = keyof typeof tokens.space;\nexport type RadiusTokenName = keyof typeof tokens.radius;\nexport type LayoutTokenName = keyof typeof tokens.layout;\nexport type TypographyTokenName = keyof typeof tokens.typography.scale;\nexport type ThemeName = keyof typeof tokens.color;\n`;
}

function javascript(tokens: DesignTokens): string {
  const json = JSON.stringify(tokens, null, 2);
  return `// Generated from docs/design.md. Do not edit.\nexport const tokens = ${json};\nexport const light = tokens.color.light;\nexport const dark = tokens.color.dark;\n`;
}

const declarationsFile = `export declare const tokens: typeof import("./tokens.js").tokens;\nexport declare const light: typeof tokens.color.light;\nexport declare const dark: typeof tokens.color.dark;\nexport type ColorTokenName = keyof typeof light;\nexport type SpaceTokenName = keyof typeof tokens.space;\nexport type RadiusTokenName = keyof typeof tokens.radius;\nexport type LayoutTokenName = keyof typeof tokens.layout;\nexport type TypographyTokenName = keyof typeof tokens.typography.scale;\nexport type ThemeName = keyof typeof tokens.color;\n`;

export async function generate(): Promise<void> {
  const tokens = await readDesignTokens();
  const output = path.join(packageRoot, "dist");
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(path.join(output, "tokens.css"), createCss(tokens)),
    writeFile(path.join(output, "tokens.ts"), typescript(tokens)),
    writeFile(path.join(output, "tokens.js"), javascript(tokens)),
    writeFile(path.join(output, "tokens.d.ts"), declarationsFile),
    writeFile(path.join(output, "tokens.json"), `${JSON.stringify(tokens, null, 2)}\n`),
  ]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await generate();
