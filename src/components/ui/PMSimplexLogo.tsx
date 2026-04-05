import React, { useId } from 'react';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  variant?: 'default' | 'compact' | 'icon';
  squareColor?: string;
  textColor?: string;
  pColor?: string;
}

export const PMSimplexLogo: React.FC<LogoProps> = ({
  width = 360,
  height = 80,
  className = '',
  variant = 'default',
  squareColor = '#1A1A6E',
  textColor = '#7A7A8C',
  pColor = '#FFFFFF',
}) => {

  // ID unique par instance → évite les collisions de clipPath dans le DOM
  // quand plusieurs instances du logo coexistent (ex: sidebar ouverte/fermée)
  const uid = useId().replace(/:/g, '');
  const clipId = `pmClip_${uid}`;

  const PPath = ({ x = 8, y = 8, size = 62 }: { x?: number; y?: number; size?: number }) => {
    const left = x + size * 0.22;
    const right = left + size * 0.16;
    const top = y + size * 0.10;
    const bottom = y + size * 0.92;
    const bowlRight = x + size * 0.78;
    const bowlMid = y + size * 0.52;
    const bowlTop = y + size * 0.10;
    const innerRight = x + size * 0.62;
    const innerTop = y + size * 0.18;
    const innerBottom = y + size * 0.44;

    return (
      <path
        d={`
          M ${left} ${top}
          L ${left} ${bottom}
          L ${right} ${bottom}
          L ${right} ${bowlMid}
          L ${x + size * 0.58} ${bowlMid}
          Q ${bowlRight} ${bowlMid} ${bowlRight} ${(bowlTop + bowlMid) / 2}
          Q ${bowlRight} ${bowlTop} ${x + size * 0.58} ${bowlTop}
          L ${left} ${bowlTop}
          Z
          M ${right} ${innerTop}
          L ${x + size * 0.55} ${innerTop}
          Q ${innerRight} ${innerTop} ${innerRight} ${(innerTop + innerBottom) / 2}
          Q ${innerRight} ${innerBottom} ${x + size * 0.55} ${innerBottom}
          L ${right} ${innerBottom}
          Z
        `}
        fill={pColor}
        fillRule="evenodd"
      />
    );
  };

  if (variant === 'icon') {
    return (
      <svg width={height} height={height} viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <clipPath id={clipId}>
            <polygon points="8,8 57,8 62,13 62,62 8,62" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect x="8" y="8" width="54" height="54" fill={squareColor} />
          <PPath x={8} y={8} size={54} />
        </g>
      </svg>
    );
  }

  if (variant === 'compact') {
    return (
      <svg width={width} height={height} viewBox="0 0 280 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
          <clipPath id={clipId}>
            <polygon points="6,8 58,8 64,14 64,66 6,66" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect x="6" y="8" width="58" height="58" fill={squareColor} />
          <PPath x={6} y={8} size={58} />
        </g>
        <text 
          x="74" 
          y="41" 
          fontSize="30" 
          fontFamily="Arial, sans-serif" 
          dominantBaseline="middle"
          translate="no"
          className="notranslate"
        >
          <tspan fill={textColor} fontWeight="400">PM</tspan>
          <tspan fill={squareColor} fontWeight="700">Simplex</tspan>
        </text>
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox="0 0 420 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <clipPath id={clipId}>
          <polygon points="8,8 59,8 70,19 70,70 8,70" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="8" y="8" width="62" height="62" fill={squareColor} />
        <PPath x={8} y={8} size={62} />
      </g>
      <text 
        x="90" 
        y="43" 
        fontSize="54" 
        fontFamily="Arial, sans-serif" 
        dominantBaseline="middle"
        translate="no"
        className="notranslate"
      >
        <tspan fill={textColor} fontWeight="400">PM</tspan>
        <tspan fill={squareColor} fontWeight="700">Simplex</tspan>
      </text>
    </svg>
  );
};

export default PMSimplexLogo;

export const logoConfig = {
  default: {
    width: 420,
    height: 80,
    squareColor: '#1A1A6E',
    textColor: '#7A7A8C',
    pColor: '#FFFFFF',
  },
  dark: {
    squareColor: '#1A1A6E',
    textColor: '#9A9AAC',
    pColor: '#FFFFFF',
  },
  light: {
    squareColor: '#1A1A6E',
    textColor: '#7A7A8C',
    pColor: '#FFFFFF',
  }
};