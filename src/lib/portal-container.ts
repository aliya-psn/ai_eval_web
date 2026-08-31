/**
 * Portal mount target for Radix overlays (Dialog / Select / Popover / …).
 *
 * App CSS is scoped under `#ai_eval_web` via postcss-selector-namespace.
 * Portals that mount on `document.body` sit outside that
 * namespace, so their styles and stacking break. Mount inside the app root instead.
 */
const APP_ROOT_ID = 'ai_eval_web';

export function getPortalContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.getElementById(APP_ROOT_ID) ?? undefined;
}
