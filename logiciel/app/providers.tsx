"use client";

import { ThemeProvider } from "next-themes";
import { A11yProvider } from "@/app/context/A11yContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <A11yProvider>
        {children}
      </A11yProvider>
    </ThemeProvider>
  );
}
