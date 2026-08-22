const tokens = require("@ownday/tokens/tokens.json");

module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: { ownday: tokens.color.light },
      fontFamily: {
        sans: [tokens.typography.families.ui],
        mono: [tokens.typography.families.mono],
      },
    },
  },
};
