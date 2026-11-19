/**
 * TRAMPO lockup: orange pin with a "t" + "trampo" + "Serviços sob demanda".
 * `tone="dark"` renders the word in white for the navy sidebar.
 */
export function Logo({ tone = "light", size = 36 }: { tone?: "light" | "dark"; size?: number }) {
  const word = tone === "dark" ? "#FFFFFF" : "#041E42";
  return (
    <div className="flex items-center gap-2" aria-label="Trampo, serviços sob demanda">
      <svg width={size} height={size * 1.3} viewBox="0 0 100 130" aria-hidden>
        <path d="M50 0C22.4 0 0 21.6 0 48.5C0 68 16 86 48.6 128.5C49.3 129.4 50.7 129.4 51.4 128.5C84 86 100 68 100 48.5C100 21.6 77.6 0 50 0Z" fill="#FF6A00" />
        <path d="M53.3 22.5C53.3 19.5 51 17 47.5 17C42 17 37.5 19.5 35 24C31.5 30 27.5 35 24.5 39C21.5 43.5 23.5 51.3 28.5 51.3L33.7 51.3L33.7 72C33.7 85 43.5 93 56.5 93C67 93 75 87 75 79C75 73 70 68.5 65 70.3C62 71.3 60 71.8 58 71.6C55 71.3 53.3 68.8 53.3 65.2L53.3 51.3L68.3 51.3C72.5 51.3 75.3 47.5 75.3 42.8C75.3 38 72.5 34.4 68.3 34.4L53.3 34.4Z" fill="#FFFFFF" />
      </svg>
      <div className="leading-none">
        <div style={{ color: word, fontSize: size * 0.95, fontWeight: 900, letterSpacing: "-0.02em", fontFamily: "var(--font-brand), Nunito, system-ui, sans-serif" }}>trampo</div>
        <div style={{ color: word, fontSize: Math.max(9, size * 0.26), fontWeight: 800, fontFamily: "var(--font-brand), Nunito, system-ui, sans-serif" }} className="mt-0.5">
          Serviços <span className="text-brand">sob demanda</span>
        </div>
      </div>
    </div>
  );
}
