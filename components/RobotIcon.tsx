export default function RobotIcon({ color = "#00e5ff", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Antenna */}
      <line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="16" cy="2" r="1.2" fill={color}/>

      {/* Head */}
      <rect x="10" y="6" width="12" height="9" rx="2" fill="none" stroke={color} strokeWidth="1.4"/>

      {/* Eyes */}
      <rect x="12" y="9" width="3" height="2" rx="0.5" fill={color} opacity="0.9"/>
      <rect x="17" y="9" width="3" height="2" rx="0.5" fill={color} opacity="0.9"/>

      {/* Neck */}
      <line x1="14" y1="15" x2="14" y2="17" stroke={color} strokeWidth="1.2"/>
      <line x1="18" y1="15" x2="18" y2="17" stroke={color} strokeWidth="1.2"/>

      {/* Body */}
      <rect x="8" y="17" width="16" height="10" rx="2" fill="none" stroke={color} strokeWidth="1.4"/>

      {/* Chest panel */}
      <rect x="11" y="19.5" width="4" height="2.5" rx="0.5" fill={color} opacity="0.4"/>
      <rect x="17" y="19.5" width="2" height="2.5" rx="0.5" fill={color} opacity="0.6"/>
      <line x1="11" y1="24" x2="21" y2="24" stroke={color} strokeWidth="0.8" opacity="0.4"/>

      {/* Arms */}
      <rect x="3" y="18" width="4" height="7" rx="1.5" fill="none" stroke={color} strokeWidth="1.3"/>
      <rect x="25" y="18" width="4" height="7" rx="1.5" fill="none" stroke={color} strokeWidth="1.3"/>

      {/* Wheels / base */}
      <rect x="9" y="27" width="5" height="3" rx="1.5" fill={color} opacity="0.7"/>
      <rect x="18" y="27" width="5" height="3" rx="1.5" fill={color} opacity="0.7"/>
    </svg>
  )
}