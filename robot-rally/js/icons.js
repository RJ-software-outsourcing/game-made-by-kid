const paths = {
  swap: '<path d="M3 7h16m-4-4 4 4-4 4M21 17H5m4 4-4-4 4-4"/>',
  magnify: '<circle cx="10" cy="10" r="6.2"/><path d="m15 15 5.8 5.8"/>',
  palette:
    '<path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.4-3.4 1.7 1.7 0 0 1 1.2-2.9H17A4 4 0 0 0 21 11c0-4.6-4.2-8-9-8Z"/><circle cx="7.7" cy="11" r="1"/><circle cx="11" cy="7.3" r="1"/><circle cx="16" cy="8.7" r="1"/>',
  bolt: '<path d="m13.6 2-9 12h6L10.3 22l9.1-12h-6.1z"/>',
  nut: '<path d="m12 2 8.7 5v10L12 22l-8.7-5V7z"/><circle cx="12" cy="12" r="4"/>',
  sound: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  trophy:
    '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4m-4 2v5m-5 2h10m-7-2h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 3.7 2.2c-1 .5-1.4 1-1.4 2.3m0 3h.01"/>',
  flag: '<path d="M4 21V4c5-3 10 3 16 0l-.7 10c-6 3-10-3-15.3 0"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 3v3m6-3v3m3 3h3m-3 6h3M9 18v3m6-3v3M3 9h3m-3 6h3"/>',
  route:
    '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>',
  wheel:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="m6 6 2 2m8 8 2 2m0-12-2 2M8 16l-2 2"/>',
  battery: '<rect x="2.5" y="6" width="17" height="12" rx="2"/><path d="M22 10v4m-15-5v6m4-6v6m4-6v6"/>',
  shield:
    '<path d="M12 2.8c2.5 2.1 5.5 3.2 8 3.6 0 7.2-1.6 11.2-8 15-6.4-3.8-8-7.8-8-15 2.5-.4 5.5-1.5 8-3.6z"/>',
  eye: '<rect x="3" y="5" width="18" height="14" rx="6"/><circle cx="12" cy="12" r="4"/>',
  cube: '<path d="m12 2 9 5-9 5-9-5zM3 7v10l9 5 9-5V7m-9 5v10"/>',
  rotate:
    '<path d="M8 5c1.2-.4 2.6-.6 4-.6 5 0 9 2.7 9 6.1s-4 6.2-9 6.2c-5.3 0-9-2.6-9-6.2M8 2.7l-2 3.5 3.8 1.6"/>',
  scan: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/><circle cx="12" cy="12" r="3"/>',
  wrench:
    '<path d="M20.4 3.6a5 5 0 0 1-6.8 6.8l-8 8a2.1 2.1 0 0 1-3-3l8-8a5 5 0 0 1 6.8-6.8L14 4.3l2.8 2.8z" transform="translate(1 1) scale(.94)"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3.5"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
  reset: '<path d="M4 9a8 8 0 1 1 .2 6M4 3v6h6"/>',
  book: '<path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2zM12 6v14"/>',
  coin: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" fill="#f4b94f" stroke="#976b27"/><circle cx="12" cy="12" r="7.1" stroke="#ffdc86"/><path stroke="#8c5b25" fill="#fff3bd" stroke-width="1.2" d="m13 5-6 8h4l-1 6 7-9h-4z"/>',
  bulb: '<path d="M9 18v-2c-1-1-3-3-3-6a6 6 0 0 1 12 0c0 3-2 5-3 6v2zM10 21h4"/>',
  audio: '<path d="M3 10v4m4-7v10m5-14v18m5-14v10m4-7v4"/>'
}
export const icon = (name, size = 20) =>
  '<svg aria-hidden="true" width="' +
  size +
  '" height="' +
  size +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
  (paths[name] || '') +
  '</svg>'
