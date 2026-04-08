interface PillarCardProps {
  imageUrl: string;
  title: string;
  subtitle: string;
  link?: string;
  overlayColor?: string;
}

export default function PillarCard({
  imageUrl,
  title,
  subtitle,
  link = '#',
  overlayColor = 'rgba(0,0,0,0.65)',
}: PillarCardProps) {
  return (
    <div className="pillar-card relative h-[480px] rounded-2xl overflow-hidden group cursor-pointer shadow-xl">
      {/* Background image with zoom on hover */}
      <div
        className="pillar-bg absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
      {/* Colored overlay */}
      <div className="absolute inset-0" style={{ background: overlayColor }} />
      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
        <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</h3>
        <p className="text-white/80 text-sm leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
}
