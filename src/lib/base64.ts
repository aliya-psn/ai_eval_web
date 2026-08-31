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

/** 字节 → base64（文件上传 / 下载包装） */
export function encodeBytesToBase64(bytes: Uint8Array): string {
  const Buf = getBufferCtor();
  if (Buf) return Buf.from(bytes).toString('base64');

  if (typeof btoa === 'function') {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const bitmap = (a << 16) | (b << 8) | c;
    result += BASE64_CHARS.charAt((bitmap >> 18) & 63);
    result += BASE64_CHARS.charAt((bitmap >> 12) & 63);
    result += i + 1 < bytes.length ? BASE64_CHARS.charAt((bitmap >> 6) & 63) : '=';
    result += i + 2 < bytes.length ? BASE64_CHARS.charAt(bitmap & 63) : '=';
  }
  return result;
}

/** base64 → 字节 */
export function decodeBase64ToBytes(base64: string): Uint8Array {
  const Buf = getBufferCtor();
  if (Buf) return new Uint8Array(Buf.from(base64, 'base64'));

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const output: number[] = [];
  for (let i = 0; i < cleaned.length; i += 4) {
    const enc1 = BASE64_CHARS.indexOf(cleaned[i]);
    const enc2 = BASE64_CHARS.indexOf(cleaned[i + 1]);
    const enc3 = BASE64_CHARS.indexOf(cleaned[i + 2]);
    const enc4 = BASE64_CHARS.indexOf(cleaned[i + 3]);
    output.push((enc1 << 2) | (enc2 >> 4));
    if (cleaned[i + 2] !== '=') output.push(((enc2 & 15) << 4) | (enc3 >> 2));
    if (cleaned[i + 3] !== '=') output.push(((enc3 & 3) << 6) | enc4);
  }
  return Uint8Array.from(output);
}

/** `Basic xxx` Authorization 头 */
export function toBasicAuthHeader(username: string, password: string): string {
  return `Basic ${encodeUtf8ToBase64(`${username}:${password}`)}`;
}
