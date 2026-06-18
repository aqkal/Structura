"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useShortcuts } from "@/lib/hooks/use-shortcuts";

type ShellContextValue = {
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  paletteOpen: boolean;
  setPaletteOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shortcutsOpen: boolean;
  setShortcutsOpen: React.Dispatch<React.SetStateAction<boolean>>;

  hasSidebar: boolean;
  setHasSidebar: React.Dispatch<React.SetStateAction<boolean>>;
};

const ShellContext = React.createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = React.useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used inside <ShellProvider>");
  }
  return ctx;
}

export function ShellProvider({
  enableShortcuts = false,
  children,
}: {
  enableShortcuts?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [hasSidebar, setHasSidebar] = React.useState(false);

  const onCommandPalette = React.useCallback(() => {
    setShortcutsOpen(false);
    setPaletteOpen((open) => !open);
  }, []);

  const onShortcutsDialog = React.useCallback(() => {
    setPaletteOpen(false);
    setShortcutsOpen((open) => !open);
  }, []);

  const onNewChat = React.useCallback(() => {
    setPaletteOpen(false);
    setShortcutsOpen(false);
    setDrawerOpen(false);
    router.push("/chat");
  }, [router]);

  useShortcuts({
    enabled: enableShortcuts,
    onCommandPalette,
    onShortcutsDialog,
    onNewChat,
  });

  const value = React.useMemo(
    () => ({
      drawerOpen,
      setDrawerOpen,
      paletteOpen,
      setPaletteOpen,
      shortcutsOpen,
      setShortcutsOpen,
      hasSidebar,
      setHasSidebar,
    }),
    [drawerOpen, paletteOpen, shortcutsOpen, hasSidebar],
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function SidebarRegistrar() {
  const { setHasSidebar, setDrawerOpen } = useShell();
  React.useEffect(() => {
    setHasSidebar(true);
    return () => {
      setHasSidebar(false);
      setDrawerOpen(false);
    };
  }, [setHasSidebar, setDrawerOpen]);
  return null;
}
