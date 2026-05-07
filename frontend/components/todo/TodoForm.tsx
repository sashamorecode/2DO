import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { Priority, PRIORITIES } from '../../constants/priorities';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CreateTodoInput } from '../../services/todos.api';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  priority: z.enum(['A', 'B', 'C']),
  deadline: z.date().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  initialValues?: Partial<FormData>;
  onSubmit: (data: CreateTodoInput) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

export function TodoForm({ initialValues, onSubmit, submitLabel = 'Save', loading }: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      priority: initialValues?.priority ?? 'B',
      deadline: initialValues?.deadline ?? null,
    },
  });

  const deadline = watch('deadline');

  async function submit(data: FormData) {
    await onSubmit({
      title: data.title,
      description: data.description,
      priority: data.priority,
      deadline: data.deadline ? data.deadline.toISOString() : null,
    });
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Title"
            value={value}
            onChangeText={onChange}
            placeholder="What needs to be done?"
            error={errors.title?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Description (optional)"
            value={value}
            onChangeText={onChange}
            placeholder="More details..."
            multiline
            numberOfLines={3}
            style={{ height: 80, textAlignVertical: 'top' }}
          />
        )}
      />

      <Text style={styles.label}>Priority</Text>
      <Controller
        control={control}
        name="priority"
        render={({ field: { onChange, value } }) => (
          <View style={styles.priorityRow}>
            {(['A', 'B', 'C'] as Priority[]).map((p) => {
              const { color, description } = PRIORITIES[p];
              const selected = value === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityBtn, { borderColor: color, backgroundColor: selected ? color + '33' : 'transparent' }]}
                  onPress={() => onChange(p)}
                >
                  <Text style={[styles.priorityLabel, { color }]}>{p}</Text>
                  <Text style={[styles.priorityDesc, { color: selected ? color : colors.textMuted }]}>{description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />

      <Text style={styles.label}>Deadline (optional)</Text>
      <TouchableOpacity
        style={styles.dateBtn}
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={deadline ? styles.dateText : styles.datePlaceholder}>
          {deadline ? deadline.toLocaleString() : 'Set a deadline...'}
        </Text>
        {deadline && (
          <TouchableOpacity onPress={() => setValue('deadline', null)}>
            <Text style={styles.clearDate}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={deadline ?? new Date()}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
          onChange={(_, date) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (date) setValue('deadline', date);
            else setShowDatePicker(false);
          }}
          themeVariant="dark"
        />
      )}

      <Button
        title={submitLabel}
        onPress={handleSubmit(submit)}
        loading={loading}
        style={styles.submitBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  priorityBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  priorityLabel: { fontWeight: '900', fontSize: 18 },
  priorityDesc: { fontSize: 10, textAlign: 'center' },
  dateBtn: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  dateText: { color: colors.text, fontSize: 15 },
  datePlaceholder: { color: colors.textMuted, fontSize: 15 },
  clearDate: { color: colors.error, fontSize: 16, fontWeight: '700' },
  submitBtn: { marginTop: 8 },
});
