// frontend/tailwind.config.js
//
// Purpose: Tailwind CSS configuration.
//
// Customisations:
//   - Content paths: ./src/**/*.{js,jsx}
//   - Theme extensions (to be added during implementation):
//       colours, fonts, animation keyframes for TokenChangeAlert flash

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Add custom tokens here during Phase 4/5
    },
  },
  plugins: [],
}
