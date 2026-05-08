import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { colors } from '../../constants/colors';
import { Screen } from '../../components/ui/Screen';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/authStore';
import { signOutGoogle } from '../../services/googleSignIn';

const schema = z.object({
  username: z
    .string()
    .min(3, 'At least 3 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, digits, and underscores only'),
});
type FormData = z.infer<typeof schema>;

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [editing, setEditing] = useState(false);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { username: user?.username ?? '' },
  });

  async function onSave(data: FormData) {
    try {
      const updated = await authApi.updateProfile(data.username);
      await setUser(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Could Not Save', e?.response?.data?.error ?? 'Try a different username');
    }
  }

  function onCancel() {
    reset({ username: user?.username ?? '' });
    setEditing(false);
  }

  function onLogout() {
    Alert.alert('Log Out?', 'You will need to sign in again to access your tasks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await signOutGoogle();
          await clearAuth();
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? ''}</Text>

        <View style={{ height: 24 }} />

        {editing ? (
          <>
            <Controller
              control={control}
              name="username"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Username"
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="none"
                  error={errors.username?.message}
                />
              )}
            />
            <Button title="Save" onPress={handleSubmit(onSave)} loading={isSubmitting} />
            <View style={{ height: 8 }} />
            <Button title="Cancel" variant="secondary" onPress={onCancel} />
          </>
        ) : (
          <>
            <Text style={styles.label}>Username</Text>
            <Text style={styles.value}>{user?.username ?? '—'}</Text>
            <View style={{ height: 16 }} />
            <Button title="Edit Username" variant="secondary" onPress={() => setEditing(true)} />
          </>
        )}

        <View style={{ height: 48 }} />
        <Button title="Log Out" variant="danger" onPress={onLogout} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  value: { color: colors.text, fontSize: 18, fontWeight: '600' },
});
