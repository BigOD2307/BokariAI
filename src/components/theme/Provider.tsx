'use client';
import { ThemeProvider } from 'next-themes';

const ThemeProviderComponent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Bokari Canvas is a light "paper" world — lock the whole app to light so the
  // site and the app share one coherent look. (Dormant dark: classes across the
  // app simply never activate. Remove forcedTheme to restore the light/dark toggle.)
  return (
    <ThemeProvider attribute="class" enableSystem={false} defaultTheme="light" forcedTheme="light">
      {children}
    </ThemeProvider>
  );
};

export default ThemeProviderComponent;
