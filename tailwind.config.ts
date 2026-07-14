import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Spec §1: acid = lime-400. Used for primary actions, focus rings,
        // module tags, and the deploy gradient.
        acid: '#a3e635',
        // Spec §1.1 / §1.2: zinc-tinted institutional palette.
        // 0 = base background, 1 = panel, 2 = row hover / card, 3 = overlay.
        surface: {
          0: '#09090b', // zinc-950 — base
          1: '#0c0c0f', // panel
          2: '#18181b', // zinc-900 — row hover / interactive bg
          3: '#27272a', // zinc-800 — overlay / strong card
        },
        ink: {
          DEFAULT: '#f8fafc', // slate-50 — primary text
          dim: '#d4d4d8',     // zinc-300 — data values
          mute: '#71717a',    // zinc-500 — labels
          fade: '#52525b',    // zinc-600 — secondary labels
          ghost: '#3f3f46',   // zinc-700 — empty-state copy
        },
        // Panel borders. Spec uses border-zinc-800 (#27272A) — solid, not rgba,
        // because the panels sit on a darker base and need defined edges.
        line: '#27272a',
        profit: '#10b981', // emerald-500
        loss: '#f43f5e',   // rose-500
        warn: '#eab308',   // yellow-500 (used for order block markers)
        info: '#38bdf8',   // sky-400
        // Specific shades referenced by the spec
        emerald: {
          400: '#34d399',
          500: '#10b981',
          800: '#065f46',
          950: '#022c22',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        acid: '0 0 80px rgba(163,230,53,0.25)',
        deploy: '0 0 20px rgba(163,230,53,0.3)',
        panel: '0 1px 0 rgba(255,255,255,0.04) inset, 0 0 0 1px rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
}

export default config
