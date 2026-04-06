interface QuoteBlockProps {
  quote: string;
  attribution: string;
  subtext?: string;
  ctaLabel?: string;
  ctaHref?: string;
  accentColor?: string;
  textColor?: string;
  subColor?: string;
}

export default function QuoteBlock({
  quote,
  attribution,
  subtext,
  ctaLabel,
  ctaHref = '#',
  accentColor = '#6B21A8',
  textColor = '#3b0764',
  subColor = '#0D9488',
}: QuoteBlockProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Giant decorative quote mark */}
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 text-[260px] leading-none font-serif select-none pointer-events-none"
        style={{ color: accentColor, opacity: 0.06 }}
        aria-hidden="true"
      >
        "
      </span>
      <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
        <p
          className="font-serif italic text-3xl md:text-4xl leading-snug mb-6"
          style={{ color: textColor }}
        >
          "{quote}"
        </p>
        <p className="font-semibold tracking-wide text-sm uppercase" style={{ color: textColor + 'aa' }}>
          — {attribution}
        </p>
        {subtext && (
          <p className="mt-3 text-sm font-medium" style={{ color: subColor }}>
            {subtext}
          </p>
        )}
        {ctaLabel && (
          <a
            href={ctaHref}
            className="inline-block mt-8 px-7 py-3 rounded-full font-semibold text-sm no-underline transition-all duration-200"
            style={{
              border: `1.5px solid ${accentColor}`,
              color: accentColor,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = accentColor;
              (e.currentTarget as HTMLElement).style.color = 'white';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = accentColor;
            }}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
