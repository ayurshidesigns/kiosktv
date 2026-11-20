// Builds the address a TV uses to read a file it stored locally (via Fully Kiosk's localhost mapping)
export const DEFAULT_LOCAL_BASE = 'https://localhost/sdcard/Android/data/de.ozerov.fully/files/media/';

export function localUrl(base, name) {
  const b = base.endsWith('/') ? base : base + '/';
  return b + String(name).split('/').map(encodeURIComponent).join('/');
}
