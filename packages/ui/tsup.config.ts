import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/checkbox.tsx",
    "src/counter.tsx",
    "src/empty-state.tsx",
    "src/habit-form.tsx",
    "src/habit-row.tsx",
    "src/heatmap.tsx",
    "src/icons.tsx",
    "src/primary-action.tsx",
    "src/streak-pill.tsx",
    "src/week-strip.tsx",
  ],
  format: ["esm"],
  bundle: false,
  dts: true,
  clean: true,
  sourcemap: true,
});
