"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/app/context/AuthContext";
import { useA11y } from "@/app/context/A11yContext";

export default function SettingsApplier() {
  const { profile } = useAuth();
  const { setTheme } = useTheme();
  const { setShowToolbar } = useA11y();
  const appliedUid = useRef<string | null>(null);

  useEffect(() => {
    if (!profile || appliedUid.current === profile.uid) return;
    appliedUid.current = profile.uid;

    const s = profile.settings;
    if (!s) return;
    if (s.theme) setTheme(s.theme);
    if (s.showToolbar !== undefined) setShowToolbar(s.showToolbar);
  }, [profile]);

  return null;
}
