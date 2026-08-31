/**
 * base64 编解码（浏览器 / Node / Proxima isolated-vm 通用）。
 * 禁止静态 import 'buffer'——isolated-vm ESM 会挂掉整个 trigger。
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function getBufferCtor(): typeof Buffer | undefined {
  if (typeof Buffer !== 'undefined') return Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const mod = typeof require === 'function' ? require('buffer') : null;
    const ctor = mod?.Buffer || mod?.default?.Buffer;
    if (typeof ctor === 'function') return ctor as typeof Buffer;
  } catch {
    // ignore
  }
  return undefined;
}

/** UTF-8 / Latin1 文本 → base64（Basic Auth 等） */
export function encodeUtf8ToBase64(text: string): string {
  const Buf = getBufferCtor();
  if (Buf) return Buf.from(text, 'utf8').toString('base64');
  if (typeof btoa === 'function') return btoa(text);

  let result = '';
  for (let i = 0; i < text.length; i += 3) {
    const a = text.charCodeAt(i);
    const b = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
    const c = i + 2 < text.length ? text.charCodeAt(i + 2) : 0;
    const bitmap = (a << 16) | (b << 8) | c;
    result += BASE64_CHARS.charAt((bitmap >> 18) & 63);
    result += BASE64_CHARS.charAt((bitmap >> 12) & 63);
    result += i + 1 < text.length ? BASE64_CHARS.charAt((bitmap >> 6) & 63) : '=';
    result += i + 2 < text.length ? BASE64_CHARS.charAt(bitmap & 63) : '=';
  }
  return result;
}

/** `Basic xxx` Authorization 头 */
export function toBasicAuthHeader(username: string, password: string): string {
  return `Basic ${encodeUtf8ToBase64(`${username}:${password}`)}`;
}
