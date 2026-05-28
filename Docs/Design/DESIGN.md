---
name: glib-code
description: Isolated AI coding workspace with deliberate promote control
colors:
  bg-canvas: "#10131A"
  bg-sunken: "#151923"
  surface-card: "#171A21"
  surface-muted: "#232730"
  text-primary: "#E8EBEF"
  text-muted: "#9EA5B3"
  border-default: "#2E333D"
  accent-primary: "#6388EE"
  accent-ring: "#5473D6"
  accent-on-primary: "#F8F9FC"
typography:
  display:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.accent-on-primary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-primary}"
    textColor: "{colors.accent-on-primary}"
  button-outline:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  input-default:
    backgroundColor: "{colors.bg-canvas}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
  nav-tab-active:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
---

# Design System: glib-code

## 1. Overview

**Creative North Star: "Control Room Quiet"**

glib-code should feel like a technical control room where each control has consequence and every visual decision lowers cognitive drag. The surface tone is calm and surgical, built for solo developers moving between repo context, session context, and high-impact settings changes without losing execution pace.

The system rejects dashboard theater. It avoids template SaaS card farms, loud neon devtool styling, and enterprise form bloat. Hierarchy is established through contrast, spacing rhythm, and type weight shifts rather than decorative flourish.

Interactive elements should read as tactile restraint: immediate, crisp, and predictable. Feedback is fast and unambiguous. Motion stays subordinate to state clarity.

**Key Characteristics:**
- Dark neutral canvas with one operational accent.
- Flat-by-default layers with border-led separation.
- Dense enough for expert throughput, quiet enough for long sessions.
- Explicit state contrast for active, focus, disabled, and destructive actions.

## 2. Colors

The palette is restrained and operational: cool graphite neutrals with a single signal blue reserved for action and focus guidance.

### Primary
- **Operator Blue** (`#6388EE`): Primary actions, active selection indicators, and high-importance affordances that require immediate recognition.

### Neutral
- **Canvas Ink** (`#10131A`): Global app background.
- **Sunken Graphite** (`#151923`): Recessed zones and scroll tracks.
- **Panel Slate** (`#171A21`): Modal and card surfaces.
- **Muted Surface** (`#232730`): Active row backplates and subtle control emphasis.
- **Boundary Steel** (`#2E333D`): Borders, input outlines, and separators.
- **Signal Text** (`#E8EBEF`): Primary text and high-contrast labels.
- **Secondary Text** (`#9EA5B3`): Metadata and helper content.

### Named Rules
**The One-Signal Rule.** Accent color is for action and focus only, not decorative fill. If everything is loud, nothing is loud.

## 3. Typography

**Display Font:** DM Sans (with system sans fallbacks)
**Body Font:** DM Sans (with system sans fallbacks)
**Label/Mono Font:** SF Mono stack for code, diffs, terminal, and machine-output surfaces

**Character:** Contemporary sans with compact confidence. Weight shifts carry hierarchy, while body copy remains highly legible in low-light environments.

### Hierarchy
- **Display** (600, 2rem, 1.2): Section-level settings titles and modal headlines.
- **Headline** (600, 1.25rem, 1.25): Major subsection titles.
- **Title** (600, 1rem, 1.3): Row-leading control labels.
- **Body** (400, 0.875rem, 1.5): Descriptions, metadata, and control helper copy.
- **Label** (600, 0.75rem, 0.08em tracking): Eyebrows, compact status labels, and dense navigation markers.

### Named Rules
**The Contrast-Not-Noise Rule.** Emphasis comes from weight and scale jumps, not color proliferation.

## 4. Elevation

This system is flat by default. Depth is communicated through tonal separation and border contrast. Shadows are used sparingly for overlays and only where stack order must be unmistakable.

### Shadow Vocabulary
- **Overlay Lift** (`0 20px 45px rgba(4, 6, 12, 0.45)`): Modal and high-priority floating surfaces.
- **Focus Glow** (`0 0 0 1px #5473D6`): Keyboard focus ring for interactive controls.

### Named Rules
**The Flat-at-Rest Rule.** Surfaces should not float unless they are truly above the current interaction layer.

## 5. Components

Components should feel precise, low-friction, and operationally calm.

### Buttons
- **Shape:** Controlled roundness (6px default, 8px for larger action groups).
- **Primary:** Operator Blue background with near-white text, medium weight, 36px height baseline.
- **Hover / Focus:** Slight accent consolidation on hover, explicit ring on focus-visible.
- **Outline / Ghost:** Neutral surfaces with border-led definition, no decorative fill gradients.

### Chips
- **Style:** Neutral background with subtle border and compact horizontal padding.
- **State:** Selected states use muted surface backplate plus text contrast increase, not broad accent floods.

### Cards / Containers
- **Corner Style:** 14px in settings sections and grouped containers.
- **Background:** Panel Slate over Canvas Ink.
- **Shadow Strategy:** None at rest in internal panels.
- **Border:** Boundary Steel at reduced opacity for section grouping.
- **Internal Padding:** 16px rows with tighter 10-12px vertical rhythm for dense control lists.

### Inputs / Fields
- **Style:** Dark canvas input wells with border-led delineation.
- **Focus:** Ring accent at 1px with no bounce animation.
- **Error / Disabled:** Error states should rely on text + border contrast shifts; disabled states drop opacity with preserved readability.

### Navigation
- **Settings rail tabs:** 40px row height, active tab uses muted surface fill with foreground contrast lift.
- **State model:** Default is quiet, hover is tonal, active is structural.

## 6. Do's and Don'ts

### Do:
- **Do** keep settings sections grouped by outcome, not by technical storage details.
- **Do** use one accent pathway (`#6388EE` / `#5473D6`) for action and focus semantics.
- **Do** keep row heights and spacing tight but consistent for high-throughput configuration work.
- **Do** preserve keyboard focus visibility on every interactive control.

### Don't:
- **Don't** use generic SaaS dashboard card-grid templates for settings content.
- **Don't** introduce flashy neon styling, decorative glow floods, or toy-like animation.
- **Don't** build enterprise-bloated forms with redundant labels and repetitive helper text.
- **Don't** use side-stripe border accents, gradient text, or default glassmorphism treatments.
