/**
 * TRAMPO lockup: orange pin with a "t" + "trampo" + "Serviços sob demanda".
 * `tone="dark"` renders the word in white for the navy sidebar.
 */
export function Logo({ tone = "light", size = 36 }: { tone?: "light" | "dark"; size?: number }) {
  const word = tone === "dark" ? "#FFFFFF" : "#041E42";
  return (
    <div className="flex items-center gap-2" aria-label="Trampo, serviços sob demanda">
      <svg width={size} height={size * 1.18} viewBox="0 0 100 118" aria-hidden>
        <path
          d="M50 2C23.5 2 2 23.1 2 49.2c0 17.6 9.8 31.2 21.6 43.3L50 116l26.4-23.5C88.2 80.4 98 66.8 98 49.2 98 23.1 76.5 2 50 2z"
          fill="#FF6A00"
        />
        <text x="51" y="76" fill="#FFFFFF" fontSize="72" fontWeight="900" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">
          t
        </text>
      </svg>
      <div className="leading-none">
        <div style={{ color: word, fontSize: size * 0.8, fontWeight: 900, letterSpacing: "-0.04em" }}>trampo</div>
        <div style={{ color: word, fontSize: Math.max(9, size * 0.26), fontWeight: 700 }} className="mt-0.5">
          Serviços <span className="text-brand">sob demanda</span>
        </div>
      </div>
    </div>
  );
}
