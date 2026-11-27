import Svg, { Circle, Path, Rect } from 'react-native-svg'

/** Icônes au trait (mêmes dessins que la barre latérale du site). */
const PATHS = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6',
  plus: 'M12 5v14M5 12h14',
  cart: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  alert: 'M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 10v4M12 17.5v.01',
  sparkles: 'M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6zM18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z',
  message: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9M10.3 20a1.9 1.9 0 0 0 3.4 0',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6',
  logout: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10',
  box: 'M12 3 4 7v10l8 4 8-4V7zM4 7l8 4 8-4M12 11v10',
  inbox: 'M4 13l2.5-8h11L20 13v6H4zM4 13h4.5l1 2h5l1-2H20',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  truck: 'M2 6h11v10H2zM13 9h4l3 3v4h-7M6.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6zM9 12l2 2 4-4',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  chart: 'M5 20V13M10 20V9M15 20v-5M20 20V5',
  send: 'M4 12 20 4l-6 16-3-7z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
  building: 'M5 21V4h10v17M15 9h4v12M9 8h2M9 12h2M9 16h2M3 21h18',
  users: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3 5.5',
  check: 'M5 12.5 10 17 19 7',
  tag: 'M3 12V4h8l9 9-8 8zM7.5 8.5h.01',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5M3.5 4v4.5H8M12 8v4l3 2',
  menu: 'M4 6h16M4 12h16M4 18h16',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  reply: 'M10 9 5 14l5 5M5 14h9a5 5 0 0 0 5-5V5',
}

export default function Icon({ name, size = 20, color = '#5f6078', strokeWidth = 1.9 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={PATHS[name] ?? PATHS.grid} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** Emblème TijaraLink (même dessin que le site). */
export function LogoMark({ size = 36 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="16" fill="#5b4bdb" />
      <Path d="M17 22h30" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <Path d="M32 22v26" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <Circle cx="17" cy="22" r="6.5" fill="#fff" />
      <Circle cx="47" cy="22" r="6.5" fill="#f58a3d" />
      <Circle cx="47" cy="22" r="2.6" fill="#fff" />
    </Svg>
  )
}
