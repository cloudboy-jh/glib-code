# glib-code Visual Primitives Reference

---

## 1. Theme Tokens

Theme tokens live in `shared/src/theme/presets.ts` as HSL values (space-separated, no `hsl()` wrapper — applied via CSS variables). The runtime writes them to `document.documentElement` via `web/src/lib/theme.ts`. Default theme on first load: `catppuccin-mocha`.

The **`minimal-dark`** preset specifically:

```ts
"minimal-dark": {
  background: "0 0% 9%",
  foreground: "0 0% 95%",
  card: "0 0% 12%",
  cardForeground: "0 0% 95%",
  border: "0 0% 25%",
  input: "0 0% 25%",
  ring: "0 0% 70%",
  primary: "0 0% 70%",
  primaryForeground: "0 0% 9%",
  muted: "0 0% 15%",
  mutedForeground: "0 0% 65%"
}
```

Full `shared/src/theme/presets.ts` (all 28 presets):

```ts
export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  input: string;
  ring: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
};

export const THEME_PRESETS = {
  "tokyo-night": {
    background: "222 47% 5%",
    foreground: "215 25% 91%",
    card: "223 36% 9%",
    cardForeground: "215 25% 91%",
    border: "216 21% 18%",
    input: "216 21% 18%",
    ring: "224 71% 62%",
    primary: "224 71% 62%",
    primaryForeground: "210 40% 98%",
    muted: "219 27% 14%",
    mutedForeground: "217 12% 65%"
  },
  "catppuccin-mocha": {
    background: "240 21% 10%",
    foreground: "226 64% 88%",
    card: "237 24% 13%",
    cardForeground: "226 64% 88%",
    border: "232 14% 26%",
    input: "232 14% 26%",
    ring: "267 84% 81%",
    primary: "267 84% 81%",
    primaryForeground: "240 21% 10%",
    muted: "235 17% 17%",
    mutedForeground: "227 27% 72%"
  },
  "gruvbox-dark": {
    background: "42 23% 10%",
    foreground: "42 45% 82%",
    card: "42 22% 14%",
    cardForeground: "42 45% 82%",
    border: "35 18% 24%",
    input: "35 18% 24%",
    ring: "40 88% 62%",
    primary: "40 88% 62%",
    primaryForeground: "42 23% 10%",
    muted: "39 18% 18%",
    mutedForeground: "40 22% 65%"
  },
  "nord": {
    background: "220 27% 12%",
    foreground: "218 27% 88%",
    card: "220 25% 16%",
    cardForeground: "218 27% 88%",
    border: "218 16% 28%",
    input: "218 16% 28%",
    ring: "213 32% 62%",
    primary: "213 32% 62%",
    primaryForeground: "220 27% 12%",
    muted: "220 22% 19%",
    mutedForeground: "218 20% 66%"
  },
  "rose-pine": {
    background: "249 22% 12%",
    foreground: "245 50% 91%",
    card: "247 23% 15%",
    cardForeground: "245 50% 91%",
    border: "249 15% 28%",
    input: "249 15% 28%",
    ring: "2 55% 83%",
    primary: "2 55% 83%",
    primaryForeground: "249 22% 12%",
    muted: "248 18% 19%",
    mutedForeground: "248 20% 68%"
  },
  "rose-pine-moon": {
    background: "246 24% 17%",
    foreground: "245 50% 91%",
    card: "247 23% 20%",
    cardForeground: "245 50% 91%",
    border: "248 15% 33%",
    input: "248 15% 33%",
    ring: "35 88% 72%",
    primary: "35 88% 72%",
    primaryForeground: "246 24% 17%",
    muted: "247 18% 24%",
    mutedForeground: "248 20% 72%"
  },
  "dracula": {
    background: "231 15% 12%",
    foreground: "60 30% 96%",
    card: "232 14% 16%",
    cardForeground: "60 30% 96%",
    border: "232 14% 28%",
    input: "232 14% 28%",
    ring: "326 100% 74%",
    primary: "326 100% 74%",
    primaryForeground: "231 15% 12%",
    muted: "232 14% 21%",
    mutedForeground: "225 27% 78%"
  },
  "kanagawa-wave": {
    background: "240 21% 10%",
    foreground: "43 38% 81%",
    card: "230 20% 14%",
    cardForeground: "43 38% 81%",
    border: "225 15% 25%",
    input: "225 15% 25%",
    ring: "37 62% 67%",
    primary: "37 62% 67%",
    primaryForeground: "240 21% 10%",
    muted: "229 18% 18%",
    mutedForeground: "42 17% 65%"
  },
  "kanagawa-dragon": {
    background: "60 8% 8%",
    foreground: "42 22% 74%",
    card: "70 7% 11%",
    cardForeground: "42 22% 74%",
    border: "48 8% 22%",
    input: "48 8% 22%",
    ring: "80 24% 56%",
    primary: "80 24% 56%",
    primaryForeground: "60 8% 8%",
    muted: "55 7% 15%",
    mutedForeground: "45 12% 58%"
  },
  "everforest-dark": {
    background: "90 12% 10%",
    foreground: "45 35% 82%",
    card: "88 11% 14%",
    cardForeground: "45 35% 82%",
    border: "78 10% 25%",
    input: "78 10% 25%",
    ring: "68 36% 55%",
    primary: "68 36% 55%",
    primaryForeground: "90 12% 10%",
    muted: "85 10% 18%",
    mutedForeground: "49 17% 65%"
  },
  "solarized-dark": {
    background: "192 100% 8%",
    foreground: "44 87% 94%",
    card: "194 76% 11%",
    cardForeground: "44 87% 94%",
    border: "194 43% 22%",
    input: "194 43% 22%",
    ring: "45 100% 35%",
    primary: "45 100% 35%",
    primaryForeground: "192 100% 8%",
    muted: "193 62% 15%",
    mutedForeground: "186 8% 60%"
  },
  "github-dark": {
    background: "216 28% 7%",
    foreground: "210 17% 82%",
    card: "215 21% 11%",
    cardForeground: "210 17% 82%",
    border: "215 14% 25%",
    input: "215 14% 25%",
    ring: "212 92% 45%",
    primary: "212 92% 45%",
    primaryForeground: "210 40% 98%",
    muted: "215 17% 16%",
    mutedForeground: "217 10% 64%"
  },
  "ayu-dark": {
    background: "220 29% 7%",
    foreground: "39 54% 79%",
    card: "220 26% 10%",
    cardForeground: "39 54% 79%",
    border: "217 18% 22%",
    input: "217 18% 22%",
    ring: "35 100% 58%",
    primary: "35 100% 58%",
    primaryForeground: "220 29% 7%",
    muted: "219 22% 14%",
    mutedForeground: "40 21% 62%"
  },
  "one-dark": {
    background: "220 13% 13%",
    foreground: "220 14% 71%",
    card: "220 13% 17%",
    cardForeground: "220 14% 71%",
    border: "220 10% 28%",
    input: "220 10% 28%",
    ring: "207 82% 66%",
    primary: "207 82% 66%",
    primaryForeground: "220 13% 13%",
    muted: "220 11% 21%",
    mutedForeground: "220 9% 58%"
  },
  "monokai-pro": {
    background: "70 8% 15%",
    foreground: "60 30% 96%",
    card: "70 8% 18%",
    cardForeground: "60 30% 96%",
    border: "70 6% 29%",
    input: "70 6% 29%",
    ring: "53 92% 57%",
    primary: "53 92% 57%",
    primaryForeground: "70 8% 15%",
    muted: "70 7% 22%",
    mutedForeground: "60 12% 70%"
  },
  "oxocarbon-dark": {
    background: "240 10% 4%",
    foreground: "240 12% 90%",
    card: "240 8% 8%",
    cardForeground: "240 12% 90%",
    border: "240 6% 22%",
    input: "240 6% 22%",
    ring: "277 84% 79%",
    primary: "277 84% 79%",
    primaryForeground: "240 10% 4%",
    muted: "240 7% 13%",
    mutedForeground: "240 7% 64%"
  },
  "night-owl": {
    background: "222 68% 7%",
    foreground: "210 40% 88%",
    card: "222 55% 10%",
    cardForeground: "210 40% 88%",
    border: "220 40% 22%",
    input: "220 40% 22%",
    ring: "180 100% 45%",
    primary: "180 100% 45%",
    primaryForeground: "222 68% 7%",
    muted: "222 45% 14%",
    mutedForeground: "210 24% 68%"
  },
  "material-palenight": {
    background: "230 24% 12%",
    foreground: "232 38% 86%",
    card: "230 21% 16%",
    cardForeground: "232 38% 86%",
    border: "231 16% 30%",
    input: "231 16% 30%",
    ring: "266 89% 78%",
    primary: "266 89% 78%",
    primaryForeground: "230 24% 12%",
    muted: "230 18% 20%",
    mutedForeground: "232 20% 67%"
  },
  "poimandres": {
    background: "220 54% 7%",
    foreground: "210 60% 88%",
    card: "220 45% 10%",
    cardForeground: "210 60% 88%",
    border: "220 25% 24%",
    input: "220 25% 24%",
    ring: "191 97% 77%",
    primary: "191 97% 77%",
    primaryForeground: "220 54% 7%",
    muted: "220 35% 14%",
    mutedForeground: "212 23% 68%"
  },
  "github-light": {
    background: "0 0% 100%",
    foreground: "215 25% 27%",
    card: "0 0% 98%",
    cardForeground: "215 25% 27%",
    border: "214 32% 91%",
    input: "214 32% 91%",
    ring: "212 92% 45%",
    primary: "212 92% 45%",
    primaryForeground: "0 0% 100%",
    muted: "210 40% 96%",
    mutedForeground: "215 16% 47%"
  },
  "solarized-light": {
    background: "44 87% 94%",
    foreground: "192 100% 8%",
    card: "44 87% 92%",
    cardForeground: "192 100% 8%",
    border: "186 8% 60%",
    input: "186 8% 60%",
    ring: "45 100% 35%",
    primary: "45 100% 35%",
    primaryForeground: "44 87% 94%",
    muted: "44 87% 90%",
    mutedForeground: "192 100% 20%"
  },
  "catppuccin-latte": {
    background: "220 23% 97%",
    foreground: "234 16% 35%",
    card: "220 23% 95%",
    cardForeground: "234 16% 35%",
    border: "223 16% 83%",
    input: "223 16% 83%",
    ring: "267 84% 81%",
    primary: "267 84% 81%",
    primaryForeground: "220 23% 97%",
    muted: "220 23% 93%",
    mutedForeground: "234 13% 58%"
  },
  "ayu-mirage": {
    background: "220 29% 13%",
    foreground: "39 54% 79%",
    card: "220 26% 16%",
    cardForeground: "39 54% 79%",
    border: "217 18% 28%",
    input: "217 18% 28%",
    ring: "35 100% 58%",
    primary: "35 100% 58%",
    primaryForeground: "220 29% 13%",
    muted: "219 22% 20%",
    mutedForeground: "40 21% 62%"
  },
  "nightfox": {
    background: "224 35% 11%",
    foreground: "223 35% 81%",
    card: "224 35% 14%",
    cardForeground: "223 35% 81%",
    border: "224 30% 22%",
    input: "224 30% 22%",
    ring: "355 65% 65%",
    primary: "355 65% 65%",
    primaryForeground: "224 35% 11%",
    muted: "224 30% 18%",
    mutedForeground: "223 25% 64%"
  },
  "carbon": {
    background: "0 0% 7%",
    foreground: "0 0% 93%",
    card: "0 0% 10%",
    cardForeground: "0 0% 93%",
    border: "0 0% 20%",
    input: "0 0% 20%",
    ring: "195 85% 41%",
    primary: "195 85% 41%",
    primaryForeground: "0 0% 7%",
    muted: "0 0% 15%",
    mutedForeground: "0 0% 65%"
  },
  "synthwave": {
    background: "266 83% 8%",
    foreground: "266 33% 91%",
    card: "266 83% 12%",
    cardForeground: "266 33% 91%",
    border: "266 40% 30%",
    input: "266 40% 30%",
    ring: "322 100% 54%",
    primary: "322 100% 54%",
    primaryForeground: "266 83% 8%",
    muted: "266 60% 16%",
    mutedForeground: "266 25% 70%"
  },
  "matrix": {
    background: "120 100% 2%",
    foreground: "120 73% 75%",
    card: "120 100% 4%",
    cardForeground: "120 73% 75%",
    border: "120 60% 20%",
    input: "120 60% 20%",
    ring: "120 100% 50%",
    primary: "120 100% 50%",
    primaryForeground: "120 100% 2%",
    muted: "120 100% 8%",
    mutedForeground: "120 40% 60%"
  },
  "minimal-dark": {
    background: "0 0% 9%",
    foreground: "0 0% 95%",
    card: "0 0% 12%",
    cardForeground: "0 0% 95%",
    border: "0 0% 25%",
    input: "0 0% 25%",
    ring: "0 0% 70%",
    primary: "0 0% 70%",
    primaryForeground: "0 0% 9%",
    muted: "0 0% 15%",
    mutedForeground: "0 0% 65%"
  },
  "paper": {
    background: "45 29% 97%",
    foreground: "20 14% 20%",
    card: "45 29% 95%",
    cardForeground: "20 14% 20%",
    border: "45 15% 85%",
    input: "45 15% 85%",
    ring: "25 95% 53%",
    primary: "25 95% 53%",
    primaryForeground: "45 29% 97%",
    muted: "45 20% 90%",
    mutedForeground: "20 10% 45%"
  }
} as const satisfies Record<string, ThemeTokens>;

export type ThemePreset = keyof typeof THEME_PRESETS;
export const THEME_PRESET_IDS = Object.keys(THEME_PRESETS) as ThemePreset[];
```

CSS variable wiring in `web/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{vue,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      }
    }
  },
  plugins: []
} satisfies Config;
```

---

## 2. Fonts

**IBM Plex Mono and Familjen Grotesk are not used.** The actual fonts:

Google Fonts import at top of `web/src/main.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap");
```

CSS custom properties defining font stacks (`web/src/main.css`):

```css
--font-ui: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: "SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Monaco, monospace;
```

No `@font-face` declarations. No Fontsource packages. No Tailwind `fontFamily` config. Mono stack is system fonts only — no custom mono loaded.

---

## 3. Button Component

`web/src/components/ui/button.vue` — full file:

```vue
<template>
  <button :class="classes" :type="type"><slot /></button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "icon";
    class?: string;
    type?: "button" | "submit" | "reset";
  }>(),
  {
    variant: "default",
    size: "default",
    type: "button"
  }
);

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "bg-primary/90 text-primary-foreground hover:bg-primary",
        outline: "border border-border/80 bg-card/70 hover:bg-muted/70",
        ghost: "hover:bg-muted/70"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        icon: "h-9 w-9"
      }
    }
  }
);

const classes = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), props.class));
</script>
```

---

## 4. Global / Base CSS

`web/src/main.css` — full file:

```css
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap");

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --radius: 0.5rem;
  --background: 224 20% 8%;
  --foreground: 220 17% 92%;
  --card: 226 18% 11%;
  --card-foreground: 220 17% 92%;
  --border: 220 14% 21%;
  --input: 220 14% 21%;
  --ring: 225 62% 58%;
  --primary: 225 80% 66%;
  --primary-foreground: 225 33% 98%;
  --muted: 224 13% 16%;
  --muted-foreground: 220 11% 66%;
  --font-ui: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Monaco, monospace;
  --bg-sunken: 224 17% 10%;
}

html,
body,
#app {
  margin: 0;
  width: 100%;
  height: 100%;
  font-family: var(--font-ui);
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  overflow: hidden;
}

* {
  box-sizing: border-box;
}

* {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--border) / 0.9) hsl(var(--bg-sunken) / 0.5);
}

*::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

*::-webkit-scrollbar-track {
  background: hsl(var(--bg-sunken) / 0.45);
}

*::-webkit-scrollbar-thumb {
  border-radius: 999px;
  border: 2px solid hsl(var(--bg-sunken) / 0.45);
  background: hsl(var(--border) / 0.95);
}

*::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.85);
}

::selection {
  background: hsl(var(--primary) / 0.35);
}

code,
pre,
kbd,
samp,
.code,
.diff,
.terminal {
  font-family: var(--font-mono);
}

/* Markdown rendered in agent/assistant timeline messages */
.prose-agent {
  word-break: break-words;
}
.prose-agent p {
  margin: 0 0 0.5em;
  white-space: pre-wrap;
}
.prose-agent p:last-child {
  margin-bottom: 0;
}
.prose-agent h1 { font-size: 1.125rem; font-weight: 600; margin: 0.75em 0 0.4em; }
.prose-agent h2 { font-size: 1rem;     font-weight: 600; margin: 0.75em 0 0.4em; }
.prose-agent h3 { font-size: 0.875rem; font-weight: 600; margin: 0.6em 0 0.3em; }
.prose-agent h1:first-child,
.prose-agent h2:first-child,
.prose-agent h3:first-child { margin-top: 0; }
.prose-agent ul,
.prose-agent ol {
  margin: 0.4em 0 0.5em;
  padding-left: 1.4em;
}
.prose-agent li { margin: 0.15em 0; }
.prose-agent strong { font-weight: 600; }
.prose-agent em { font-style: italic; }
.prose-agent code {
  font-family: var(--font-mono);
  font-size: 0.8em;
  background: hsl(var(--muted) / 0.7);
  border: 1px solid hsl(var(--border) / 0.6);
  border-radius: 3px;
  padding: 0.1em 0.35em;
}
.prose-agent pre {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  background: hsl(var(--bg-sunken));
  border: 1px solid hsl(var(--border) / 0.5);
  border-radius: 6px;
  padding: 0.6em 0.8em;
  overflow-x: auto;
  margin: 0.5em 0;
}
.prose-agent pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: inherit;
}
.prose-agent a {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}
.prose-agent blockquote {
  border-left: 3px solid hsl(var(--border));
  margin: 0.5em 0;
  padding-left: 0.75em;
  color: hsl(var(--muted-foreground));
}
.prose-agent hr {
  border: none;
  border-top: 1px solid hsl(var(--border) / 0.5);
  margin: 0.75em 0;
}

/* Promote success animation */
.promote-success {
  background: radial-gradient(ellipse at 50% 60%, hsl(142 60% 30% / 0.07) 0%, transparent 70%);
}

.promote-check-wrap {
  position: relative;
  width: 72px;
  height: 72px;
}

.promote-check-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.promote-check-circle {
  stroke: hsl(142 60% 45% / 0.35);
  fill: hsl(142 60% 30% / 0.12);
  stroke-dasharray: 151;
  stroke-dashoffset: 151;
  animation: promote-circle-draw 0.45s ease-out 0.05s forwards;
}

.promote-check-tick {
  stroke: hsl(142 65% 55%);
  fill: none;
  stroke-dasharray: 36;
  stroke-dashoffset: 36;
  animation: promote-tick-draw 0.3s ease-out 0.45s forwards;
}

@keyframes promote-circle-draw {
  to { stroke-dashoffset: 0; }
}

@keyframes promote-tick-draw {
  to { stroke-dashoffset: 0; }
}

.promote-countdown-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.promote-countdown-track {
  fill: none;
  stroke: none;
}

.promote-countdown-arc {
  fill: none;
  stroke: hsl(142 60% 45% / 0.25);
  stroke-width: 2;
  stroke-dasharray: 151;
  stroke-dashoffset: 0;
  animation: promote-countdown 3s linear 0.8s forwards;
}

@keyframes promote-countdown {
  to { stroke-dashoffset: 151; }
}
```

---

## 5. Logo

No SVG logo exists. All assets are PNG.

| Path | Notes |
|------|-------|
| `web/public/glibcode-iconlogo.png` | Icon logo, served as favicon |
| `assets/glibcode-iconlogo.png` | Same icon, source copy |
| `assets/glibcode-wordmark.png` | Wordmark (text logo) |
| `assets/desktop-icon-main.png` | Desktop app icon |
| `assets/diffs-glibiconmain.png` | Icon variant for diffs feature |
| `desktop/assets/icon.iconset/icon_16x16.png` | macOS iconset 16×16 |
| `desktop/assets/icon.iconset/icon_16x16@2x.png` | macOS iconset 16×16 @2x |
| `desktop/assets/icon.iconset/icon_32x32.png` | macOS iconset 32×32 |
| `desktop/assets/icon.iconset/icon_32x32@2x.png` | macOS iconset 32×32 @2x |
| `desktop/assets/icon.iconset/icon_64x64.png` | macOS iconset 64×64 |
| `desktop/assets/icon.iconset/icon_64x64@2x.png` | macOS iconset 64×64 @2x |
| `desktop/assets/icon.iconset/icon_128x128.png` | macOS iconset 128×128 |
| `desktop/assets/icon.iconset/icon_128x128@2x.png` | macOS iconset 128×128 @2x |
| `desktop/assets/icon.iconset/icon_256x256.png` | macOS iconset 256×256 |
| `desktop/assets/icon.iconset/icon_256x256@2x.png` | macOS iconset 256×256 @2x |
| `desktop/assets/icon.iconset/icon_512x512.png` | macOS iconset 512×512 |
| `desktop/assets/icon.iconset/icon_512x512@2x.png` | macOS iconset 512×512 @2x |
| `desktop/assets/icon.iconset/icon_1024x1024.png` | macOS iconset 1024×1024 |
