"use client";

import { cn } from "@/lib/utils";

type AttachmentChipProps = {
  fileName: string;
  mediaType: string;
  previewUrl?: string;
  onRemove?: () => void;
  status?: "uploading" | "done" | "error";
  errorReason?: string;
  onRetry?: () => void;
};

export function AttachmentChip({
  fileName,
  mediaType,
  previewUrl,
  onRemove,
  status,
  errorReason,
  onRetry,
}: AttachmentChipProps) {
  const isImage = mediaType.startsWith("image/");
  const isPdf = mediaType === "application/pdf";
  const failed = status === "error";

  if (isImage && previewUrl && !failed) {
    return (
      <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--border-soft)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={fileName}
          className="h-full w-full object-cover"
        />
        {status === "uploading" ? (
          <span
            role="status"
            aria-label={`Uploading ${fileName}`}
            className="absolute inset-0 flex items-center justify-center bg-[#0d3320]/40"
          >
            <RingSpinner className="h-5 w-5 text-[#f5fbf7]" />
          </span>
        ) : null}
        {onRemove ? (
          <RemoveButton onRemove={onRemove} fileName={fileName} floating />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "glass-soft inline-flex max-w-[16rem] items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-1.5",
        failed && "border-[color:var(--lavender-400)]/60",
      )}
    >
      <span
        aria-hidden="true"
        className="shrink-0 text-[color:var(--lavender-600)]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 2.25h5L12.25 5.5V13a.75.75 0 0 1-.75.75h-7.5A.75.75 0 0 1 3.25 13V3a.75.75 0 0 1 .75-.75Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M9 2.5V5.5h3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="min-w-0 truncate font-medium text-[color:var(--color-ink)] text-[var(--text-2xs)]">
          {fileName}
        </span>
        {failed && errorReason ? (
          <span className="min-w-0 truncate text-[color:var(--lavender-600)] text-[var(--text-2xs)]">
            {errorReason}
          </span>
        ) : null}
      </span>
      {isPdf && !failed ? (
        <span className="shrink-0 text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
          (PDF)
        </span>
      ) : null}
      {status === "uploading" ? (
        <span role="status" aria-label={`Uploading ${fileName}`}>
          <RingSpinner className="h-3.5 w-3.5 shrink-0 text-[color:var(--mint-700)]" />
        </span>
      ) : null}
      {failed && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          aria-label={`Retry uploading ${fileName}`}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[color:var(--lavender-600)] transition-colors hover:bg-white/60 hover:text-[color:var(--lavender-800)]"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 6a4 4 0 1 1-1.17-2.83M10 2v2.25H7.75"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
      {onRemove ? (
        <RemoveButton onRemove={onRemove} fileName={fileName} />
      ) : null}
    </div>
  );
}

function RingSpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn("animate-spin", className)}
    >
      <circle
        cx="10"
        cy="10"
        r="7.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.4"
      />
      <path
        d="M17.5 10a7.5 7.5 0 0 0-7.5-7.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RemoveButton({
  onRemove,
  fileName,
  floating,
}: {
  onRemove: () => void;
  fileName: string;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${fileName}`}
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
        "transition-colors",
        floating
          ? "absolute top-1 right-1 bg-[color:var(--mint-900)]/70 text-[color:var(--color-bg)] hover:bg-[color:var(--mint-900)]"
          : "text-[color:var(--color-ink-subtle)] hover:bg-white/60 hover:text-[color:var(--color-ink)]",
      )}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
