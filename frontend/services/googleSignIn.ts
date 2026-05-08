import Constants from 'expo-constants';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';
const isUnsupportedRuntime = isExpoGo || Platform.OS === 'web';

let configured = false;

function loadModule() {
  return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
}

export function configureGoogleSignIn() {
  if (configured || isUnsupportedRuntime) return;
  const { GoogleSignin } = loadModule();
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}

// signInWithGoogle returns the ID token from a successful Google sign-in,
// or null if the user cancelled the flow. Throws on any other error.
export async function signInWithGoogle(): Promise<string | null> {
  if (isUnsupportedRuntime) {
    throw new Error('Google Sign-In requires a development build (not Expo Go or web).');
  }
  configureGoogleSignIn();
  const { GoogleSignin, statusCodes } = loadModule();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (result.type === 'cancelled') return null;
    const idToken = result.data?.idToken;
    if (!idToken) throw new Error('Google did not return an ID token');
    return idToken;
  } catch (e: any) {
    if (
      e?.code === statusCodes.SIGN_IN_CANCELLED ||
      e?.code === statusCodes.IN_PROGRESS
    ) {
      return null;
    }
    throw e;
  }
}

export async function signOutGoogle() {
  if (!configured || isUnsupportedRuntime) return;
  try {
    const { GoogleSignin } = loadModule();
    await GoogleSignin.signOut();
  } catch {
    // ignore — user is being logged out locally regardless
  }
}
