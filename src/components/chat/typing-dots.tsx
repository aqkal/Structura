export function TypingDots({
  label = "Qualia is thinking",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="glass-soft inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-lg)] rounded-bl-md px-3.5 py-3"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className="typing-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}
