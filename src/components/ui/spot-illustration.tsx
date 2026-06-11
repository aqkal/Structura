import { cn } from "@/lib/utils";

type SpotKind = "chat" | "compass" | "sparkle" | "missing";

const STROKE = 1.6;
const MINT = "var(--mint-700)";
const LAVENDER = "var(--lavender-600)";

const ART: Record<SpotKind, React.ReactNode> = {
  chat: (
    <>
      <rect
        x="6"
        y="9"
        width="25"
        height="17"
        rx="6"
        stroke={MINT}
        strokeWidth={STROKE}
      />
      <path
        d="M13 26v5l6-5"
        stroke={MINT}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="21"
        y="22"
        width="21"
        height="14"
        rx="5.5"
        fill="var(--color-bg)"
        stroke={LAVENDER}
        strokeWidth={STROKE}
      />
      <circle cx="27.5" cy="29" r="1.1" fill={LAVENDER} />
      <circle cx="31.5" cy="29" r="1.1" fill={LAVENDER} />
      <circle cx="35.5" cy="29" r="1.1" fill={LAVENDER} />
      <path
        d="M38 36v4l-4.5-4"
        stroke={LAVENDER}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  compass: (
    <>
      <circle cx="24" cy="24" r="16" stroke={MINT} strokeWidth={STROKE} />
      <path
        d="M24 5.5v3M24 39.5v3M42.5 24h-3M8.5 24h-3"
        stroke={MINT}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M30.5 17.5 26.5 26.5 17.5 30.5 21.5 21.5Z"
        stroke={LAVENDER}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="1.4" fill={LAVENDER} />
    </>
  ),
  sparkle: (
    <>
      <path
        d="M24 8c1.6 8.4 7.6 14.4 16 16-8.4 1.6-14.4 7.6-16 16-1.6-8.4-7.6-14.4-16-16 8.4-1.6 14.4-7.6 16-16Z"
        stroke={MINT}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <path
        d="M38 8.5v5M35.5 11h5"
        stroke={LAVENDER}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <path
        d="M10 34.5v4M8 36.5h4"
        stroke={LAVENDER}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </>
  ),
  missing: (
    <>
      <circle
        cx="24"
        cy="24"
        r="15.5"
        stroke={MINT}
        strokeWidth={STROKE}
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      <path
        d="M19.5 19.5c0-2.6 2-4.3 4.5-4.3s4.5 1.7 4.5 4.2c0 3.4-4.5 3.6-4.5 7.1"
        stroke={LAVENDER}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <circle cx="24" cy="31.5" r="1.3" fill={LAVENDER} />
    </>
  ),
};

export function SpotIllustration({
  kind,
  className,
}: {
  kind: SpotKind;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={cn("h-12 w-12", className)}
    >
      {ART[kind]}
    </svg>
  );
}
