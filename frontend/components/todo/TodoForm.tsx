import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Calendar as CalendarIcon, Clock as ClockIcon, X, Lock } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { Priority, PRIORITIES, PRIORITY_ORDER } from '../../constants/priorities';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { CreateTodoInput } from '../../services/todos.api';
import { serializeTodoDateInTimeZone } from '../../services/timezone';
import { useAuthStore } from '../../store/authStore';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  priority: z.enum(['A', 'B', 'C']),
  deadline: z.date().optional().nullable(),
  deadlineHasTime: z.boolean(),
  plannedAt: z.date().optional().nullable(),
  plannedHasTime: z.boolean(),
  isPrivate: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export interface TodoFormInitial {
  title?: string;
  description?: string;
  priority?: Priority;
  deadline?: Date | null;
  deadlineHasTime?: boolean;
  plannedAt?: Date | null;
  plannedHasTime?: boolean;
  isPrivate?: boolean;
}

interface Props {
  initialValues?: TodoFormInitial;
  onSubmit: (data: CreateTodoInput) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

export function TodoForm({ initialValues, onSubmit, submitLabel = 'Save', loading }: Props) {
  const timezone = useAuthStore((s) => s.user?.timezone);
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      priority: initialValues?.priority ?? 'B',
      deadline: initialValues?.deadline ?? null,
      deadlineHasTime: initialValues?.deadlineHasTime ?? false,
      plannedAt: initialValues?.plannedAt ?? null,
      plannedHasTime: initialValues?.plannedHasTime ?? false,
      isPrivate: initialValues?.isPrivate ?? false,
    },
  });

  async function submit(data: FormData) {
    await onSubmit({
      title: data.title,
      description: data.description,
      priority: data.priority,
      deadline: data.deadline
        ? serializeTodoDateInTimeZone(data.deadline, data.deadlineHasTime, 'end', timezone)
        : null,
      planned_at: data.plannedAt
        ? serializeTodoDateInTimeZone(data.plannedAt, data.plannedHasTime, 'morning', timezone)
        : null,
      is_private: data.isPrivate,
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

      <Text style={styles.label}>Importance</Text>
      <Controller
        control={control}
        name="priority"
        render={({ field: { onChange, value } }) => (
          <View style={styles.priorityRow}>
            {PRIORITY_ORDER.map((p) => {
              const { color, label, description } = PRIORITIES[p];
              const selected = value === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBtn,
                    { borderColor: color, backgroundColor: selected ? color + '33' : 'transparent' },
                  ]}
                  onPress={() => onChange(p)}
                >
                  <Text style={[styles.priorityLabel, { color }]}>{label}</Text>
                  <Text style={[styles.priorityDesc, { color: selected ? color : colors.textMuted }]}>
                    {description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />

      <DateTimeField
        label="Due date (optional)"
        date={watch('deadline')}
        hasTime={watch('deadlineHasTime')}
        onDate={(d) => setValue('deadline', d)}
        onHasTime={(b) => setValue('deadlineHasTime', b)}
      />

      <DateTimeField
        label="Do date (optional)"
        date={watch('plannedAt')}
        hasTime={watch('plannedHasTime')}
        onDate={(d) => setValue('plannedAt', d)}
        onHasTime={(b) => setValue('plannedHasTime', b)}
      />

      <Controller
        control={control}
        name="isPrivate"
        render={({ field: { onChange, value } }) => (
          <View style={styles.privateRow}>
            <Lock size={20} color={value ? colors.accentLight : colors.textDim} strokeWidth={2.2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.privateLabel}>Private</Text>
              <Text style={styles.privateDesc}>
                Hide from friends. They won't see this task or be notified about it.
              </Text>
            </View>
            <Switch
              value={value}
              onValueChange={onChange}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        )}
      />

      <Button
        title={submitLabel}
        onPress={handleSubmit(submit)}
        loading={loading}
        style={styles.submitBtn}
      />
    </ScrollView>
  );
}

function DateTimeField({
  label,
  date,
  hasTime,
  onDate,
  onHasTime,
}: {
  label: string;
  date: Date | null | undefined;
  hasTime: boolean;
  onDate: (d: Date | null) => void;
  onHasTime: (b: boolean) => void;
}) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const dateLabel = date
    ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Pick a date…';
  const timeLabel = date && hasTime
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : 'No time set';

  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowDate(true)}>
          <CalendarIcon size={16} color={date ? colors.accentLight : colors.textDim} strokeWidth={2.2} />
          <Text style={date ? styles.dateText : styles.datePlaceholder}>{dateLabel}</Text>
        </TouchableOpacity>
        {date && (
          <TouchableOpacity onPress={() => { onDate(null); onHasTime(false); }} style={styles.clearBtn}>
            <X size={16} color={colors.error} strokeWidth={2.4} />
          </TouchableOpacity>
        )}
      </View>

      {date && (
        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>Add time</Text>
          <Switch
            value={hasTime}
            onValueChange={(b) => {
              onHasTime(b);
              if (b) setShowTime(true);
            }}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
          {hasTime && (
            <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTime(true)}>
              <ClockIcon size={14} color={colors.accentLight} strokeWidth={2.2} />
              <Text style={styles.dateText}>{timeLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showDate && (
        <DateTimePicker
          value={date ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, picked) => {
            setShowDate(Platform.OS === 'ios');
            if (picked) {
              const next = new Date(picked);
              if (date && hasTime) {
                next.setHours(date.getHours(), date.getMinutes(), 0, 0);
              }
              onDate(next);
            }
          }}
          themeVariant="dark"
        />
      )}
      {showTime && date && (
        <DateTimePicker
          value={date}
          mode="time"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, picked) => {
            setShowTime(Platform.OS === 'ios');
            if (picked) {
              const next = new Date(date);
              next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
              onDate(next);
            }
          }}
          themeVariant="dark"
        />
      )}
    </View>
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
  priorityLabel: { fontWeight: '900', fontSize: 14 },
  priorityDesc: { fontSize: 10, textAlign: 'center' },
  dateBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: { color: colors.text, fontSize: 15 },
  datePlaceholder: { color: colors.textMuted, fontSize: 15 },
  clearBtn: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  timeLabel: { color: colors.textMuted, fontSize: 13 },
  timeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  privateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    marginBottom: 16,
    gap: 12,
  },
  privateLabel: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  privateDesc: { color: colors.textMuted, fontSize: 12 },
  submitBtn: { marginTop: 8, marginBottom: 32 },
});
