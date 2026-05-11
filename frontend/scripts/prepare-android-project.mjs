import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = dirname(scriptDir);
const androidRoot = join(frontendRoot, 'android');

if (!existsSync(androidRoot)) {
  throw new Error('frontend/android is missing. Run `npx expo prebuild --platform android` first.');
}

const gradleWrapperPath = join(androidRoot, 'gradle/wrapper/gradle-wrapper.properties');
const appBuildGradlePath = join(androidRoot, 'app/build.gradle');

const releaseSigningHelpers = `def getReleaseSigningValue = { name ->
    def gradleValue = findProperty(name)
    if (gradleValue != null && gradleValue.toString().trim()) {
        return gradleValue.toString().trim()
    }

    def envValue = System.getenv(name)
    if (envValue != null && envValue.trim()) {
        return envValue.trim()
    }

    return null
}
def releaseStoreFile = getReleaseSigningValue('ANDROID_SIGNING_STORE_FILE')
def releaseStorePassword = getReleaseSigningValue('ANDROID_SIGNING_STORE_PASSWORD')
def releaseKeyAlias = getReleaseSigningValue('ANDROID_SIGNING_KEY_ALIAS')
def releaseKeyPassword = getReleaseSigningValue('ANDROID_SIGNING_KEY_PASSWORD')
def hasReleaseSigning = releaseStoreFile && releaseStorePassword && releaseKeyAlias && releaseKeyPassword
def requiresReleaseSigning = gradle.startParameter.taskNames.any { taskName ->
    def normalized = taskName.toLowerCase()
    normalized.contains('release') || normalized.contains('bundle')
}`;

const originalSigningBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
`;

const patchedSigningBlock = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        if (hasReleaseSigning) {
            release {
                storeFile file(releaseStoreFile)
                storePassword releaseStorePassword
                keyAlias releaseKeyAlias
                keyPassword releaseKeyPassword
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            if (hasReleaseSigning) {
                signingConfig signingConfigs.release
            } else if (requiresReleaseSigning) {
                throw new GradleException('Release signing is not configured. Set ANDROID_SIGNING_STORE_FILE, ANDROID_SIGNING_STORE_PASSWORD, ANDROID_SIGNING_KEY_ALIAS, and ANDROID_SIGNING_KEY_PASSWORD.')
            }
`;

function updateFile(filePath, transform) {
  const current = readFileSync(filePath, 'utf8');
  const next = transform(current);
  if (next !== current) {
    writeFileSync(filePath, next);
  }
}

updateFile(gradleWrapperPath, (content) =>
  content.replace(/distributionUrl=.*gradle-[\d.]+-bin\.zip/, 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip')
);

updateFile(appBuildGradlePath, (content) => {
  let next = content;

  next = next.replace(/^\s*hermesCommand = .*require\.resolve\('hermes-compiler\/package\.json'.*\n/m, '');

  if (!next.includes("def getReleaseSigningValue = { name ->")) {
    next = next.replace(
      /def projectRoot = rootDir\.getAbsoluteFile\(\)\.getParentFile\(\)\.getAbsolutePath\(\)\n/,
      (match) => `${match}${releaseSigningHelpers}\n\n`
    );
  }

  if (!next.includes("throw new GradleException('Release signing is not configured.")) {
    if (!next.includes(originalSigningBlock)) {
      throw new Error('Unable to locate the default Android signing block in frontend/android/app/build.gradle');
    }
    next = next.replace(originalSigningBlock, patchedSigningBlock);
  }

  return next;
});