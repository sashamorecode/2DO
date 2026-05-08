import React from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/authStore';

const schema = z.object({
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, digits, and underscores only'),
});
type FormData = z.infer<typeof schema>;

export default function OnboardingScreen() {
  const setUser = useAuthStore((s) => s.setUser);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const user = await authApi.updateProfile({ username: data.username, timezone });
      await setUser(user);
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.response?.data?.error ?? 'Try a different username');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      style={styles.kav}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Pick a username</Text>
        <Text style={styles.subtitle}>This is how friends will find and tag you. You can change it later.</Text>

        <Controller
          control={control}
          name="username"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Username"
              value={value}
              onChangeText={onChange}
              autoCapitalize="none"
              autoFocus
              autoComplete="username-new"
              error={errors.username?.message}
            />
          )}
        />
        <Button title="Continue" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 24, paddingTop: 96, paddingBottom: 32, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: 32 },
});
