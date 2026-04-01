/* ═══════════════════════════════════════════════════════════════════════════
 * Rio No Ponto · SVG Icon Library
 *
 * Pure React SVG icons — no emoji, no external dependencies.
 * Consistent 24x24 viewBox, stroke-based for iOS feel.
 * ═══════════════════════════════════════════════════════════════════════════ */

import { memo } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  filled?: boolean;
}

const defaults = { size: 24, color: 'currentColor', strokeWidth: 1.8 };

export const IconMap = memo(function IconMap({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className, filled }: IconProps) {
  if (filled) return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 2L4 5v15l5-3 6 3 5-3V2l-5 3-6-3z" fill={color} opacity={0.2} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M9 2v15M15 5v15" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 2L4 5v15l5-3 6 3 5-3V2l-5 3-6-3z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
      <path d="M9 2v15M15 5v15" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  );
});

export const IconBus = memo(function IconBus({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className, filled }: IconProps) {
  if (filled) return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="3" width="16" height="16" rx="3" fill={color} opacity={0.2} stroke={color} strokeWidth={strokeWidth}/>
      <path d="M4 13h16M8 19v2M16 19v2M8.5 16h.01M15.5 16h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M4 7h16" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="3" width="16" height="16" rx="3" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M4 13h16M8 19v2M16 19v2M8.5 16h.01M15.5 16h.01" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M4 7h16" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  );
});

export const IconSettings = memo(function IconSettings({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className, filled }: IconProps) {
  if (filled) return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="3" fill={color} opacity={0.2} stroke={color} strokeWidth={strokeWidth}/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  );
});

export const IconLocation = memo(function IconLocation({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  );
});

export const IconLocate = memo(function IconLocate({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  );
});

export const IconBusStop = memo(function IconBusStop({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="7" y="2" width="10" height="14" rx="2" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M12 16v6M8 22h8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M10 6h4M10 10h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  );
});

export const IconSearch = memo(function IconSearch({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="7" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  );
});

export const IconX = memo(function IconX({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  );
});

export const IconShare = memo(function IconShare({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M16 6l-4-4-4 4M12 2v13" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const IconFollow = memo(function IconFollow({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" stroke={color} strokeWidth={strokeWidth}/>
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth}/>
    </svg>
  );
});

export const IconSpeed = memo(function IconSpeed({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2a10 10 0 0 0-6.88 17.23" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M12 2a10 10 0 0 1 6.88 17.23" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <path d="M12 12l3.5-7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill={color}/>
    </svg>
  );
});

export const IconClock = memo(function IconClock({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M12 6v6l4 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  );
});

export const IconSun = memo(function IconSun({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="4" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  );
});

export const IconMoon = memo(function IconMoon({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
    </svg>
  );
});

export const IconMonitor = memo(function IconMonitor({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" stroke={color} strokeWidth={strokeWidth}/>
      <path d="M8 21h8M12 17v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/>
    </svg>
  );
});

export const IconChevronDown = memo(function IconChevronDown({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 9l6 6 6-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const IconNavigation = memo(function IconNavigation({ size = defaults.size, color = defaults.color, strokeWidth = defaults.strokeWidth, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 11l19-9-9 19-2-8-8-2z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/>
    </svg>
  );
});
