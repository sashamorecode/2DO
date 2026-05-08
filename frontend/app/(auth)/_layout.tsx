import { Stack } from 'expo-router';
import { colors } from '../../constants/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="email-otp" options={{ title: 'Enter Code' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Choose a Username', headerBackVisible: false }} />
    </Stack>
  );
}
