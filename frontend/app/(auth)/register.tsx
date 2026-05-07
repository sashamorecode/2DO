import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { authApi } from '../../services/auth.api';
import { useAuthStore } from '../../store/authStore';

const schema = z.object({
  username: z.string().min(3, 'At least 3 characters').max(50),
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      const res = await authApi.register(data);
      await setAuth(res.token, res.user);
    } catch (e: any) {
      Alert.alert('Registration Failed', e?.response?.data?.error ?? 'Something went wrong');
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>

        <Controller
          control={control}
          name="username"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Username"
              value={value}
              onChangeText={onChange}
              autoCapitalize="none"
              autoComplete="username"
              error={errors.username?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Email"
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Password"
              value={value}
              onChangeText={onChange}
              secureTextEntry
              autoComplete="new-password"
              error={errors.password?.message}
            />
          )}
        />

        <Button title="Create Account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={{ marginTop: 8 }} />

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign In</Text></Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 24, paddingVertical: 32, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 32 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.textMuted, fontSize: 15 },
  linkBold: { color: colors.accent, fontWeight: '700' },
});
