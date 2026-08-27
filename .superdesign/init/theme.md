# ResQNow theme

## Compact token summary

- Fonts: `Inter` globally; tracking UI explicitly prefers `Plus Jakarta Sans`, then `Inter`.
- Light background/card: white; foreground: deep slate `hsl(222 84% 15%)`.
- Brand/action primary: emergency red `hsl(0 84% 60%)`; primary foreground white.
- Secondary/muted surfaces: `hsl(210 40% 96%)`; muted copy `hsl(215 16% 47%)`.
- Borders/inputs: `hsl(220 13% 91%)`.
- Supporting states: emerald live/success, amber reconnect/payment, indigo arrival, zinc terminal.
- Base radius: `0.75rem`; map/status cards commonly use `1.5rem`–`2rem` radii.
- Shadows: restrained card shadow plus stronger floating white-card shadows over maps.
- Mobile safe-area tokens and `100dvh` are part of the tracking layout.
- Motion: 0.3s standard transition, 2.4s marker pulse, 3s destination ripple, 3.6s marker float; all disabled by `prefers-reduced-motion`.
- Breakpoint focus: mobile under 768px; Tailwind defaults otherwise.

## Actual CSS variable source (`src/index.css`)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222 84% 15%;
  --card: 0 0% 100%;
  --card-foreground: 222 84% 15%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 84% 15%;
  --primary: 0 84% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 84% 15%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 217 91% 95%;
  --accent-foreground: 217 91% 40%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 220 13% 91%;
  --input: 220 13% 91%;
  --ring: 0 84% 60%;
  --radius: 0.75rem;
  --mobile-header-height: 4rem;
  --mobile-safe-area-bottom: env(safe-area-inset-bottom, 0);
  --mobile-content-padding: 1rem;
  --mobile-section-gap: 2rem;
  --mobile-card-padding: 1rem;
  --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --gradient-primary: linear-gradient(135deg, hsl(0 84% 60%), hsl(25 95% 53%));
  --shadow-elegant: 0 10px 30px -10px hsl(0 84% 60% / 0.2);
  --shadow-card: 0 2px 8px rgba(0,0,0,0.08);
  --shadow-card-hover: 0 4px 16px rgba(0,0,0,0.12);
}
```

## Tailwind source

`tailwind.config.ts` maps semantic colors to the CSS variables above, defines `lg/md/sm` radii from `--radius`, centers the container with 2rem padding and a 1400px 2xl width, and enables `tailwindcss-animate`. The full 96-line source is passed directly to Superdesign as target context.

## Tracking marker source

The actual selectors in `src/index.css:371:542` define `.tracking-live-map`, `.tracking-tech-marker` and its white ETA bubble/red pulse/pin, plus `.tracking-destination-marker` with two concentric ripples and a dark destination pin. The reduced-motion source is `src/index.css:903:909`.
