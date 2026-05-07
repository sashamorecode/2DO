import { Audio } from 'expo-av';

let soundObject: Audio.Sound | null = null;

export async function playCompletionSound() {
  try {
    if (soundObject) {
      await soundObject.unloadAsync();
    }
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/complete.mp3'),
      { shouldPlay: true, volume: 0.8 }
    );
    soundObject = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        soundObject = null;
      }
    });
  } catch {
    // sound is non-critical
  }
}
