import { Audio } from 'expo-av';

let preloaded: Audio.Sound | null = null;
let modeConfigured = false;

async function ensureMode() {
  if (modeConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      // Play through the speaker even when iOS is in silent mode — this is a
      // user-triggered celebration sound, not background media.
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });
  } catch (e) {
    console.warn('Audio.setAudioModeAsync failed:', e);
  }
  modeConfigured = true;
}

async function ensureLoaded() {
  if (preloaded) return preloaded;
  const { sound } = await Audio.Sound.createAsync(
    require('../../assets/sounds/complete.mp3'),
    { shouldPlay: false, volume: 0.85 }
  );
  preloaded = sound;
  return sound;
}

export async function playCompletionSound() {
  try {
    await ensureMode();
    const sound = await ensureLoaded();
    // Replay from the beginning — multiple completes in quick succession should
    // each trigger the chime, not be ignored mid-playback.
    await sound.stopAsync().catch(() => {});
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (e) {
    console.warn('playCompletionSound failed:', e);
  }
}
