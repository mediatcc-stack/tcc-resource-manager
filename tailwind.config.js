/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./App.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-light": "var(--primary-light)",
        accent: "var(--accent)",
        "neutral-bg": "var(--neutral-bg)",
        "neutral-ink": "var(--neutral-ink)",
        "neutral-muted": "var(--neutral-muted)",
        border: "var(--border)",
        danger: "var(--danger)",
        success: "var(--success)",
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontFamily: {
        prompt: ["Prompt", "sans-serif"],
      },
    },
  },
  plugins: [],
}
