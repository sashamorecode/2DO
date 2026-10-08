// Commit the running JS bundle was built from. Expo inlines EXPO_PUBLIC_* at
// bundle time, so the value reflects the commit the OTA update / APK was built
// from. Falls back to 'dev' for local runs without the env var set.
function resolveCommitHash(): string {
  const value = process.env.EXPO_PUBLIC_COMMIT_HASH?.trim();
  if (!value) return 'dev';
  return value.slice(0, 7);
}

export const COMMIT_HASH = resolveCommitHash();
