/**
 * Single source of truth for the app version and build identity.
 *
 * - APP_VERSION is the human release identifier.
 * - COMMIT_SHA is injected at BUILD TIME by scripts/build-pages.mjs from the
 *   actual git commit being built (CI: the exact SHA that gets deployed).
 *   "dev" marks a local build without git information — never shipped.
 *
 * Every user-visible version label (Scan Hub notice, Settings/About) must
 * derive from these constants so stale strings like "NutriLens 2.3" cannot
 * reappear. tests/version-consistency.test.ts enforces this.
 */

export const APP_VERSION = '2.4.1';

/** Short commit SHA of the deployed build, or "dev" for local builds. */
export const COMMIT_SHA: string =
  (process.env.NEXT_PUBLIC_COMMIT_SHA || 'dev').slice(0, 7);

/** True when the SHA was injected by a real git-backed build. */
export function isReleaseBuild(): boolean {
  return COMMIT_SHA !== 'dev';
}

/** Human-readable build label, e.g. "v2.4.1 (a1b2c3d)". */
export function buildLabel(): string {
  return `v${APP_VERSION} (${COMMIT_SHA})`;
}

/**
 * The Scan Hub capability notice (local-first mode). Built from the same
 * constants as Settings/About — one source of truth, no stale version
 * strings.
 */
export function scanHubNotice(cloudVisionConfigured: boolean): string {
  if (cloudVisionConfigured) {
    return `NutriLens ${APP_VERSION}: on-device analysis (recognition model + local OCR + public product database) with the optional cloud adapter configured. Build ${COMMIT_SHA}.`;
  }
  return (
    `NutriLens ${APP_VERSION}: on-device recognition (Food-101 model, ~9.4 MB one-time download) + ` +
    `local OCR + public product database + curated Indian-dish registry (21 dishes, regional dishes ` +
    `marked experimental). No cloud, no API keys. Build ${COMMIT_SHA}.`
  );
}
