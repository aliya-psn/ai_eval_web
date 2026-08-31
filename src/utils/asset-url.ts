const DEFAULT_BASE_URL = './';

export function getAssetUrl(path: string): string {
  const normalizedPath = path.replace(/^\//, '');
  if (typeof __webpack_public_path__ !== 'undefined' && __webpack_public_path__) {
    return `${__webpack_public_path__}${normalizedPath}`;
  }
  return `${DEFAULT_BASE_URL}${normalizedPath}`;
}
