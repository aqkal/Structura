"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "linear-gradient(160deg, #c8f2dc 0%, #dcd0f5 100%)",
          color: "#14241a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: "380px",
            padding: "32px",
            borderRadius: "20px",
            background: "rgba(255, 255, 255, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.65)",
            boxShadow: "0 12px 32px -16px rgba(26, 92, 58, 0.22)",
          }}
        >
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: "20px",
              fontWeight: 600,
              color: "#0d3320",
            }}
          >
            Something went wrong.
          </h1>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: "14px",
              lineHeight: 1.55,
              color: "#3a5242",
            }}
          >
            The page hit an unexpected error. Trying again usually clears it.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              height: "44px",
              padding: "0 24px",
              borderRadius: "9999px",
              border: "none",
              background: "#0d3320",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
