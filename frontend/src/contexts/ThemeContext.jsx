import { createContext, useContext, useState, useEffect } from "react";

const THEMES = [
  { id: "default", name: "Default", description: "Classic warm tones" },
  { id: "evergreen", name: "Evergreen Forest", description: "Deep greens with nature-inspired tones" },
  { id: "lantern", name: "Lantern Glow", description: "Warm amber highlights" },
  { id: "misty", name: "Misty Morning", description: "Soft grays with cool undertones" },
  { id: "campfire", name: "Campfire Warmth", description: "Rich oranges and warm earth tones" },
];

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("thaddaeus-theme") || "default";
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme attributes
    root.removeAttribute("data-theme");
    
    // Apply the selected theme
    if (theme !== "default") {
      root.setAttribute("data-theme", theme);
    }
    
    // Save to localStorage
    localStorage.setItem("thaddaeus-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export { THEMES };
