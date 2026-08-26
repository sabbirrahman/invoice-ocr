"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useLocalStorage } from "react-use";

type Theme = "light" | "dark" | "system";
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: Exclude<Theme, "system">;
}

function getSystemTheme(): Exclude<Theme, "system"> {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Exclude<Theme, "system">) {
  if (typeof document === "undefined") return;

  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({
  defaultTheme,
  children,
}: {
  defaultTheme?: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useLocalStorage<Theme>(
    "theme",
    defaultTheme || "system",
  );

  const [systemTheme, setSystemTheme] = useState<Exclude<Theme, "system">>(() =>
    getSystemTheme(),
  );

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme as Exclude<Theme, "system">);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider
      value={{
        resolvedTheme: resolvedTheme as Exclude<Theme, "system">,
        theme: theme as Theme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
