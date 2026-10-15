/** Original hand-salute ("live long and prosper") mark, kept by request. Keep in sync with app/icon.svg. */
const HAND = `<g fill="#e2b866">
    <g transform="rotate(-11 266 340)">
      <rect x="148" y="118" width="60" height="230" rx="30"/>
      <rect x="206" y="72" width="62" height="276" rx="31"/>
    </g>
    <g transform="rotate(11 270 340)">
      <rect x="270" y="80" width="62" height="268" rx="31"/>
      <rect x="330" y="132" width="56" height="216" rx="28"/>
    </g>
    <rect x="64" y="327" width="150" height="66" rx="33" transform="rotate(32 205 360)"/>
    <path d="M138 296 H390 V352 C390 428 342 470 264 470 C186 470 138 428 138 352 Z"/>
  </g>
  <g stroke="#1b2433" stroke-width="7" stroke-linecap="round" fill="none">
    <path d="M207 150 V300" transform="rotate(-11 266 340)"/>
    <path d="M331 160 V300" transform="rotate(11 270 340)"/>
  </g>`;

export const ICON_BACKGROUND = "#1b2433";

/** Rounded-square icon, or full-bleed with the hand in the 80% safe zone for maskable use. */
export function iconSvg({ maskable = false }: { maskable?: boolean } = {}): string {
  const bg = maskable
    ? `<rect width="512" height="512" fill="${ICON_BACKGROUND}"/>`
    : `<rect width="512" height="512" rx="112" fill="${ICON_BACKGROUND}"/>`;
  const body = maskable ? `<g transform="translate(51.2 51.2) scale(0.8)">${HAND}</g>` : HAND;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${body}</svg>`;
}

export function iconDataUri(options?: { maskable?: boolean }): string {
  return `data:image/svg+xml;base64,${Buffer.from(iconSvg(options)).toString("base64")}`;
}

/** Wrap a PNG in a single-image ICO container (PNG-in-ICO is supported by all current browsers). */
export function pngToIco(png: Uint8Array, size: number): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, 1, true); // count
  header[6] = size >= 256 ? 0 : size; // width
  header[7] = size >= 256 ? 0 : size; // height
  header[8] = 0; // palette
  header[9] = 0; // reserved
  view.setUint16(10, 1, true); // color planes
  view.setUint16(12, 32, true); // bits per pixel
  view.setUint32(14, png.byteLength, true); // image size
  view.setUint32(18, 22, true); // offset
  const out = new Uint8Array(22 + png.byteLength);
  out.set(header, 0);
  out.set(png, 22);
  return out;
}
