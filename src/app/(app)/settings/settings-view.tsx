"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { fadeUp, staggerContainer } from "@/lib/motion";

import { DeleteAccountModal } from "./delete-account-modal";

const sectionHeadingClass =
  "text-[var(--text-base)] font-semibold text-[color:var(--color-ink)]";

const explainerClass =
  "leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-xs)]";

type SettingsViewProps = {
  name: string | null;
  email: string;
};

export function SettingsView({ name, email }: SettingsViewProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (exportTimer.current !== null) {
        window.clearTimeout(exportTimer.current);
      }
    };
  }, []);

  function onExportClick() {
    setExporting(true);
    if (exportTimer.current !== null) {
      window.clearTimeout(exportTimer.current);
    }
    exportTimer.current = window.setTimeout(() => setExporting(false), 4000);
  }

  return (
    <motion.div
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="mx-auto flex w-full max-w-[720px] flex-col gap-6"
    >
      <motion.header variants={fadeUp} className="flex flex-col gap-2">
        <div className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
          Account
        </div>
        <h1 className="font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] text-[var(--text-2xl)]">
          Settings
        </h1>
        <p className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
          Your profile, your data, and the controls to take it with you or
          remove it for good.
        </p>
      </motion.header>

      <motion.section
        variants={fadeUp}
        aria-labelledby="settings-profile-heading"
        className="glass flex flex-col gap-4 rounded-[var(--radius-lg)] p-[var(--space-6)]"
      >
        <h2 id="settings-profile-heading" className={sectionHeadingClass}>
          Profile
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="font-medium text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
              Name
            </dt>
            <dd className="text-[color:var(--color-ink)] text-[var(--text-sm)]">
              {name ?? "Not set"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-medium text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
              Email
            </dt>
            <dd className="break-all text-[color:var(--color-ink)] text-[var(--text-sm)]">
              {email}
            </dd>
          </div>
        </dl>
        <p className={explainerClass}>
          These come from how you sign in, so there is nothing to edit here.
          Sign in with a different email to use a different identity.
        </p>
      </motion.section>

      <motion.section
        variants={fadeUp}
        aria-labelledby="settings-appearance-heading"
        className="glass flex flex-col gap-4 rounded-[var(--radius-lg)] p-[var(--space-6)]"
      >
        <h2 id="settings-appearance-heading" className={sectionHeadingClass}>
          Appearance
        </h2>
        <p className={explainerClass}>
          Pick a theme, or let Structura follow your device. The choice is
          remembered on this browser.
        </p>
        <ThemeToggle className="self-start" />
      </motion.section>

      <motion.section
        variants={fadeUp}
        aria-labelledby="settings-data-heading"
        className="glass flex flex-col gap-4 rounded-[var(--radius-lg)] p-[var(--space-6)]"
      >
        <h2 id="settings-data-heading" className={sectionHeadingClass}>
          Your data
        </h2>
        <p className={explainerClass}>
          Download everything Structura stores about you: your profile, every
          guided session with its steps and hints, every chat with its messages,
          and links to your uploaded files. It arrives as a single JSON file.
          File links stay valid for one hour.
        </p>
        <a
          href="/api/account/export"
          download
          onClick={onExportClick}
          aria-busy={exporting}
          className="focus-visible:outline-lavender-400 inline-flex h-11 items-center justify-center gap-2 self-start rounded-full border border-[color:var(--border-soft)] bg-white/75 px-5 font-medium tracking-[-0.01em] text-[color:var(--color-ink)] text-[var(--text-base)] transition-colors select-none hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {exporting && (
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          )}
          {exporting ? "Preparing your download" : "Download everything"}
        </a>
      </motion.section>

      <motion.section
        variants={fadeUp}
        aria-labelledby="settings-danger-heading"
        className="glass flex flex-col gap-4 rounded-[var(--radius-lg)] p-[var(--space-6)]"
        style={{ borderColor: "var(--lavender-300)" }}
      >
        <h2
          id="settings-danger-heading"
          className="font-semibold text-[color:var(--lavender-800)] text-[var(--text-base)]"
        >
          Danger zone
        </h2>
        <p className={explainerClass}>
          Deleting your account removes every session, chat, message, and
          uploaded file. It happens immediately and cannot be undone. Export
          your data first if you want to keep a copy.
        </p>
        <Button
          type="button"
          variant="subtle"
          onClick={() => setDeleteOpen(true)}
          className="self-start"
        >
          Delete account and all data
        </Button>
      </motion.section>

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </motion.div>
  );
}
