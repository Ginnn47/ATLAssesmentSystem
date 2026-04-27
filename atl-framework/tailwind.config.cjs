module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#EAB308",
        secondary: "#CBAC04",
        tertiary: "#9D9E03",
        neutral: "#85773C",
      },
      fontFamily: {
        headline: ["Lexend", "sans-serif"],
        body: ["Lexend", "sans-serif"],
        label: ["Lexend", "sans-serif"],
      },
    },
  },
  plugins: [],
};
