import { useState, useEffect } from 'react';
import { Switch } from "@/components/ui/switch";
import { MoonIcon, SunIcon } from "@radix-ui/react-icons";

const ThemeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Initialize state based on localStorage or system preference
    if (localStorage.theme === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }
  }, []);

  const toggleTheme = (checked) => {
    if (!checked) {
      // Switch to light mode
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setDarkMode(false);
    } else {
      // Switch to dark mode
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setDarkMode(true);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <SunIcon className="h-4 w-4 text-muted-foreground" />
      <Switch 
        checked={darkMode} 
        onCheckedChange={toggleTheme}
        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      />
      <MoonIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
};

export default ThemeToggle;
