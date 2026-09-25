import React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "../context/ThemeContext";

export const ThemeToggle: React.FC = () => {
  const { toggleTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className="relative h-9 w-9 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-500" />
    </Button>
  );
};
