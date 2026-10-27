# Balonca design notes

Goal: **professional but cute**. Calm pastel surfaces, one confident violet accent, generous space,
rounded corners, soft shadows, small playful touches that never get childish.

## Colour
All colours are CSS variables in `src/styles/tokens.css`; components never hard-code them (except the
subtitle overlay, which sits on top of arbitrary video and has its own fixed palette).

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#fbf8ff` | `#141220` | page |
| `--surface` | `#ffffff` | `#1e1b2e` | cards, inputs |
| `--surface-2` | `#f3eefc` | `#272339` | tab bars, code, chips |
| `--text` | `#29243d` | `#f0ecfa` | body |
| `--muted` | `#655e80` | `#aaa3c4` | secondary text (≥ 4.5:1) |
| `--accent` | `#6a4bd8` | `#b6a6ff` | actions, links, active states |
| `--accent-ink` | `#ffffff` | `#181326` | text on accent (≥ 4.5:1) |
| `--accent-soft` | `#ece6ff` | `#2e2852` | active row, selected tab |
| `--pink` | `#ff8fb8` | `#ff9dc2` | saved-word underline, pop animation, mascot cheeks |
| `--good` / `--danger` | `#1f8a5f` / `#c0334f` | `#52d6a0` / `#ff7a93` | status |

Dark mode is a separate palette (lighter accent, dark ink on accent, stronger shadows), not an inversion.
Theme is `auto` (follows the OS), `light` or `dark`.

## Typography
- **Headings / display: Nunito** (variable, rounded, 800). Logo, page titles, big numbers, flashcard word.
- **Body / subtitles / UI: Atkinson Hyperlegible** (400/700), designed for character distinction at small sizes.
- Both are self-hosted through `@fontsource`, so no third-party font requests and a strict CSP.

## Spacing, shape, depth
- Scale: 4 · 8 · 12 · 16 · 24 · 40 px (`--space-1…6`).
- Radius: 18 px cards (`--radius`), 12 px controls (`--radius-sm`), pills for chips and the main CTA.
- Shadow: one soft violet-tinted shadow for cards, a larger one for the video and floating things.
- Tap targets are at least 44 × 44 px on every button, input and select.

## Subtitles
Four overlay styles, all tested against bright video: **boxed** (default, adjustable darkness),
**outlined** (stroke + shadow), **shadow**, and **high contrast** (yellow `#ffe14a` on solid black, ≈ 15:1).
Size scales with the video width, so phones and fullscreen both stay readable.
Saved words get a wavy pink underline everywhere; saving plays a short "pop".

## Motion
Page enter (6 px rise + fade, 250 ms), word pop (320 ms), mascot bob (3 s), toast rise.
A global `prefers-reduced-motion` rule disables all animation and transitions.

## Components
`Header` · `Mascot` · `VideoStage` (player, controls, fullscreen) · `Overlay` · `Transcript` + `VirtualList` ·
`WordRow` (clickable words) · `Tabs` (ARIA tablist) · `TracksPanel` · `SettingsPanel` · `WordsMini` ·
`Review` (flashcards) · `ConfirmButton` (two-step destructive actions) · `Toasts` (announced with `aria-live`).

## Mascot
A **speech bubble with a friendly face** ("Balon"): rounded-square bubble with a small tail, two dot eyes,
a smile and pink cheeks. Flat, single accent colour, no outline. It appears only for **brand** (logo,
favicon), **empty states**, **onboarding** and **success** (review finished). Never in dense UI.
Original artwork; it is a plain SVG in `src/components/Mascot.svelte`, colours follow the theme.

## Voice
Warm, short, plain. Turkish first, English second (`src/lib/i18n`). Emoji only in empty states (🫧).
