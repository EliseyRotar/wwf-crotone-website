/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx,js,jsx}",
    "./src/app/**/*.{ts,tsx,js,jsx}",
    "./src/components/**/*.{ts,tsx,js,jsx}",
    "./src/messages/**/*.json"
  ],
  theme: {
    extend: {
      colors: {
        // WWF brand — these stay the same in dark mode (brand colors)
        wwf: {
          green: "#007932",
          "green-dark": "#005a25",
          "green-light": "#a5d961",
          "green-pale": "#c9e8a0",
          orange: "#eb9c4b",
          "orange-hover": "#e3913d",
          "orange-light": "#efb06f",
          yellow: "#f5c956",
          teal: "#00728f",
          "teal-pale": "#cce3e9",
          purple: "#7d4c94",
          red: "#ed2b00"
        },
        // Neutrals — use CSS variables that change in dark mode
        ink: {
          DEFAULT: "var(--c-ink)",
          2: "var(--c-ink-2)",
          grey: "var(--c-ink-grey)",
          "grey-light": "var(--c-ink-grey-light)"
        },
        sand: {
          DEFAULT: "var(--c-sand)",
          cream: "var(--c-sand-cream)"
        },
        // Semantic surface colors that adapt
        surface: {
          DEFAULT: "var(--c-surface)",
          elevated: "var(--c-surface-elevated)",
          border: "var(--c-border)"
        }
      },
      fontFamily: {
        head: ["var(--font-head)", "Arial", "sans-serif"],
        body: ["var(--font-body)", "Arial", "sans-serif"]
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        card: "4px",
        btn: "4px",
        tag: "22px"
      },
      maxWidth: {
        container: "137.5rem"
      },
      letterSpacing: {
        head: "0.03em",
        cta: "0.028em"
      },
      lineHeight: {
        head: "1.05"
      }
    }
  },
  plugins: []
};