---
name: Ownday
colors:
  background: '#f3f6f1'
  on-background: '#101a17'
  surface: '#f3f6f1'
  surface-dim: '#e8ede5'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ffffff'
  surface-container: '#e8ede5'
  surface-container-high: '#e8ede5'
  surface-container-highest: '#d4ddd5'
  surface-variant: '#e8ede5'
  on-surface: '#101a17'
  on-surface-variant: '#6e8078'
  inverse-surface: '#131e1b'
  inverse-on-surface: '#e9f0eb'
  outline: '#6e8078'
  outline-variant: '#d4ddd5'
  surface-tint: '#1b8a62'
  primary: '#1b8a62'
  on-primary: '#ffffff'
  primary-container: '#d5ede2'
  on-primary-container: '#0e5e42'
  inverse-primary: '#38c68d'
  secondary: '#b9700f'
  on-secondary: '#ffffff'
  secondary-container: '#fae9ce'
  on-secondary-container: '#8a5309'
  tertiary: '#101a17'
  on-tertiary: '#ffffff'
  tertiary-container: '#101a17'
  on-tertiary-container: '#ffffff'
  error: '#af4034'
  on-error: '#ffffff'
  error-container: '#f6deda'
  on-error-container: '#8a2a21'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  title-sm:
    fontFamily: Hanken Grotesk
    fontSize: 19px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0em
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  counter-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0em
  counter-sm:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.14em
rounded:
  sm: 0.375rem
  DEFAULT: 0.5rem
  md: 0.625rem
  lg: 0.875rem
  xl: 1.25rem
  full: 9999px
spacing:
  margin-page: 20px
  gutter-stack: 12px
  padding-card: 16px
  radius-chip: 6px
  radius-check: 8px
  radius-input: 10px
  radius-card: 14px
  radius-sheet: 20px
---

## Brand & Style

A calm, disciplined habit tracker. The tone is quiet competence, not gamified hype.
Visual restraint is the point: the interface should recede so the data reads instantly.
Interactions are snappy and literal. No decorative flourishes.

## Colors

Exactly **two accent colors** exist, and each is locked to one meaning. An element does
not get its own color just because it is important.

- **Success accent `#1B8A62`** — completion and nothing else: filled checkbox, progress
  bar, positive trend. This is `primary`.
- **Streak accent `#B9700F`** — streak length and nothing else: consecutive-day count,
  "hot" indicator. This is `secondary`.
- **Ink `#101A17`** — neutral primary action. The "Add Habit" and "Save" buttons use an
  ink background with white text. Ink is **not** a third accent; it is neutral, and it
  must never be replaced by the success accent.

### The streak rule — important

In a **list**, the streak pill is neutral: `#6E8078` text on `#E8EDE5`.
The streak accent `#B9700F` is used **only** when the streak is 7 days or longer, or
when it is a personal record. On a detail screen, an achievement screen, or a home-screen
widget, the streak number always uses the streak accent.

Never render six orange pills in a six-row list. If everything is highlighted, the streak
stops reading as an achievement. On a typical screen one or two pills are accented.

### Zero streak

When the streak is 0, **render no pill at all** — leave empty space. Never display
"0" next to a flame icon.

### Habit color is not an accent

The user picks a color per habit. That is **user data, not part of the accent system**.

A habit's color tints **only** its icon chip, and its own line or bar on charts that
compare several habits. Checkboxes, progress bars, streak pills and every state
indicator always use the system colors — success green, streak orange, neutral grey,
error red — regardless of the habit's color. An app with purple checkmarks no longer
reads green as "done".

The habit color palette is a fixed curated set of eight, never a free color picker:
`#1B8A62` moss, `#1C6C8C` ocean, `#3B4E9B` indigo, `#7A3E86` plum, `#A8452F` clay,
`#B9700F` amber, `#5F7327` olive, `#4A5A63` slate.

## Typography

**Hanken Grotesk** for the entire interface and all headings. Headings carry −2% to −3%
tracking for a locked-in, engineered feel. No serif face is used anywhere.

**JetBrains Mono** for every number: counters, streaks, percentages, dates. Always enable
tabular figures so digits do not shift width when a value increments.

## Layout & Spacing

Strict vertical stack, optimized for one-handed mobile use. Page margins 20px.
Base 4px grid; only 4, 8, 12, 16, 24, 32, 48, 64 are permitted. No intermediate values.
Content column caps at 640px on wide screens.

## Elevation & Depth

- Base layer: the `#F3F6F1` background.
- Card layer: white, with one soft shadow `0 1px 2px rgba(16,26,23,.05), 0 4px 12px rgba(16,26,23,.05)`.
- Pressed state: shadow blur decreases and the row scales to 98%.

**No gradients anywhere.** All depth is tonal plus one soft shadow.

## Shapes

- Cards and modals: 14px radius
- Inputs and large buttons: 10px radius
- Checkboxes and progress pips: 8px radius
- Chips and pills: 6px radius, or fully rounded for streak pills
- Bottom sheets: 20px radius

## Components

### Habit list — single container

The habit list is **one** white card with **one** shadow, containing rows separated by
thin `#D4DDD5` dividers. It is **not** a stack of six separate cards with six shadows —
that becomes an endless loose scroll at ten habits. Each row is at least 44px tall.

Row anatomy: checkbox (left) · title with schedule caption (middle) · streak pill (right).

### Checkbox

24px, 8px radius. Unchecked: 2px `#6E8078` border, transparent fill. Checked: filled with
`#1B8A62`, white check glyph. A completed row's title turns `#6E8078` and is struck through.

### Counter habit

A −/+ stepper (8px radius, `#E8EDE5` fill) with the value between them in JetBrains Mono,
and a 6px progress bar below: `#E8EDE5` track, `#1B8A62` fill, fully rounded.

### Three day states

- **Done** — success accent
- **Skip** — neutral `#6E8078` on `#E8EDE5`. A deliberate freeze for holidays and illness.
  It does **not** break the streak and is excluded from the completion percentage.
- **Miss** — error color, used sparingly

The skip state is a product requirement, not decoration. Without it the tracker punishes
people for having a life, and they abandon it in week two.

### Week strip

Seven columns: weekday letter (label-caps, `#6E8078`), date number, and below it an
indicator showing **what fraction of that day's habits were completed** — an empty ring,
then partial fill, then a solid success-colored circle. Today's date sits on an ink dot.
Future days show an empty `#D4DDD5` ring. The strip shows progress, not merely dates.

### Primary action button

Full width, 10px radius, `#101A17` background, white text.

**Not a floating action button.** A FAB covers the last row of the list and collides with
the Telegram Mini App main button. The action lives in the flow below the list, or as an
icon in the header.

### Year heatmap

11px cells with 3px gaps, 2.5px radius. Five levels from `#E8EDE5` through increasing
mixes of `#1B8A62` up to the solid accent.

## Dark theme

A dark theme exists and is mandatory in production. Ground `#0C1513`, surface `#131E1B`,
ink `#E9F0EB`, success `#38C68D`, streak `#E8A33D`. Contrast must stay legible and both
accents must keep working on the dark ground; do not naively invert the light palette.

## Do not

- No gradients, anywhere
- No third accent color
- No Material-3 token names such as `on-tertiary-fixed-variant` — this system does not use them
- No raster icons in the interface; interface icons are vector line icons
- No spacing values outside the 4px scale
- No animation longer than 200ms except the achievement screen
