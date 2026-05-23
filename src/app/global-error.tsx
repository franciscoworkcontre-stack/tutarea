"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "sans-serif", padding: "2rem", background: "#0a0a0a", color: "#fff" }}>
        <h2 style={{ color: "#ef4444" }}>Error de aplicación</h2>
        <pre style={{ background: "#1a1a1a", padding: "1rem", borderRadius: "8px", overflow: "auto", fontSize: "12px", color: "#f87171" }}>
          {error.message}
          {"\n\n"}
          {error.stack}
          {error.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
        <button onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>
          Reintentar
        </button>
      </body>
    </html>
  );
}
