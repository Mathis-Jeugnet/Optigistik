"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface A11yContextType {
  showToolbar: boolean;
  setShowToolbar: (v: boolean) => void;
}

const A11yContext = createContext<A11yContextType>({
  showToolbar: true,
  setShowToolbar: () => {},
});

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const [showToolbar, setShowToolbarState] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("a11y-toolbar");
    if (stored !== null) setShowToolbarState(stored === "true");
    setMounted(true);
  }, []);

  const setShowToolbar = (v: boolean) => {
    setShowToolbarState(v);
    localStorage.setItem("a11y-toolbar", String(v));
    const uid = auth.currentUser?.uid;
    if (uid) {
      updateDoc(doc(db, "users", uid), { "settings.showToolbar": v }).catch(() => {});
    }
  };

  if (!mounted) return <>{children}</>;

  return (
    <A11yContext.Provider value={{ showToolbar, setShowToolbar }}>
      {children}
    </A11yContext.Provider>
  );
}

export const useA11y = () => useContext(A11yContext);
