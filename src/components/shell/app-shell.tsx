import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { ContentTransition } from "./content-transition";
import { MobileBottomBar } from "./mobile-bottom-bar";
import { MobileDrawer } from "./mobile-drawer";
import { Nav } from "./nav";
import { ShellProvider, SidebarRegistrar } from "./shell-provider";
import { ShortcutsDialog } from "./shortcuts-dialog";

/**
 * The shell is split in two so navigation never rebuilds the chrome:
 *
 * - ShellFrame lives in the (app) route-group layout. It mounts ONCE and
 *   persists across every in-app navigation: nav, command palette,
 *   shortcuts dialog, mobile bottom bar. Switching chats or modes only
 *   swaps what renders below it.
 *
 * - ShellContent lives in section layouts (chat, session) or directly in
 *   pages without a section (home, settings). It provides the
 *   sidebar/main/right-panel grid. When it sits in a section layout it
 *   also persists across that section's navigations, so the sidebar does
 *   not remount when you switch conversations.
 *
 * The shell never scrolls the page; only `main` scrolls.
 */

type ShellUser = { name: string | null; email: string } | null;

export function ShellFrame({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const signedIn = Boolean(user);

  return (
    <ShellProvider enableShortcuts={signedIn}>
      <div className="flex h-dvh flex-col">
        <Nav user={user} />
        <div className="min-h-0 flex-1">{children}</div>

        {signedIn && <MobileBottomBar />}
        {signedIn && (
          <>
            <CommandPalette />
            <ShortcutsDialog />
          </>
        )}
      </div>
    </ShellProvider>
  );
}

type ShellContentProps = {
  /** Reserve bottom space for the signed-in mobile bottom bar. */
  signedIn?: boolean;
  sidebar?: React.ReactNode;
  rightPanel?: React.ReactNode;
  children: React.ReactNode;
};

export function ShellContent({
  signedIn = true,
  sidebar,
  rightPanel,
  children,
}: ShellContentProps) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0",
        "grid-cols-1",
        sidebar && rightPanel
          ? "lg:grid-cols-[var(--sidebar-w)_1fr_var(--rightpanel-w)]"
          : sidebar
            ? "lg:grid-cols-[var(--sidebar-w)_1fr]"
            : rightPanel
              ? "lg:grid-cols-[1fr_var(--rightpanel-w)]"
              : "lg:grid-cols-1",
      )}
    >
      {sidebar && (
        <aside
          className={cn(
            "hidden lg:block",
            "min-h-0 overflow-y-auto",
            "border-r border-[color:var(--border-soft)]",
            "bg-[color:var(--surface-soft)] backdrop-blur",
            "p-[var(--space-5)]",
          )}
        >
          {sidebar}
        </aside>
      )}

      <main className="min-h-0 overflow-y-auto">
        <ContentTransition>
          <div
            className={cn(
              "mx-auto w-full",
              "px-4 pt-5 md:px-[var(--space-6)] md:pt-[var(--space-8)]",
              // Leave room for the fixed bottom bar (h-14 + safe area)
              // on signed-in mobile layouts.
              signedIn
                ? "pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.25rem)] lg:pb-[var(--space-8)]"
                : "pb-5 md:pb-[var(--space-8)]",
            )}
            style={{ maxWidth: "var(--content-max)" }}
          >
            {children}
          </div>
        </ContentTransition>
      </main>

      {rightPanel && (
        <aside
          className={cn(
            "hidden lg:block",
            "min-h-0 overflow-y-auto",
            "border-l border-[color:var(--border-soft)]",
            "bg-[color:var(--surface-soft)] backdrop-blur",
            "p-[var(--space-5)]",
          )}
        >
          {rightPanel}
        </aside>
      )}

      {sidebar && (
        <>
          <SidebarRegistrar />
          <MobileDrawer>{sidebar}</MobileDrawer>
        </>
      )}
    </div>
  );
}
