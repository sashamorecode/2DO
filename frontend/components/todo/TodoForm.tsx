import { AppDialog } from '../../services/appDialog';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTimeField } from '../ui/DateTimeField';
import { Check, Plus, X, Lock } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { Priority, PRIORITIES, PRIORITY_ORDER } from '../../constants/priorities';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { KeyboardAwareScrollView } from '../ui/KeyboardAwareScrollView';
import { CreateTodoInput } from '../../services/todos.api';
import { serializeTodoDateInTimeZone } from '../../services/timezone';
import { useAuthStore } from '../../store/authStore';
import { tagsApi } from '../../services/tags.api';
import { useOfflineTagOps } from '../../services/tags.api.offline';
import { useOfflineStore } from '../../store/offlineStore';

const TAG_COLOR_NAMES = ['Rose', 'Gold', 'Teal', 'Blue', 'Lavender', 'Orange', 'Sky blue', 'Green'];
const TAG_COLOR_OPTIONS = ['#E07A91', '#E5B868', '#88B0A8', '#77A8D9', '#B48EFA', '#F38C63', '#7EC8E3', '#96D36D'];

let nextStepKey = 0;
function createStepKey(): string {
  return `step-${Date.now()}-${nextStepKey++}`;
}

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  priority: z.enum(['A', 'B', 'C']),
  tagIds: z.array(z.string()),
  deadline: z.date().optional().nullable(),
  deadlineHasTime: z.boolean(),
  plannedAt: z.date().optional().nullable(),
  plannedHasTime: z.boolean(),
  steps: z.array(z.object({ key: z.string(), name: z.string(), completed: z.boolean() })),
  isPrivate: z.boolean(),
});

type FormData = z.input<typeof schema>;

export interface TodoFormInitial {
  title?: string;
  description?: string;
  priority?: Priority;
  tagIds?: string[];
  deadline?: Date | null;
  deadlineHasTime?: boolean;
  plannedAt?: Date | null;
  plannedHasTime?: boolean;
  steps?: Array<{ name: string; completed: boolean }>;
  isPrivate?: boolean;
}

interface Props {
  initialValues?: TodoFormInitial;
  revision?: string;
  onSubmit: (data: CreateTodoInput) => Promise<void>;
  // When provided, the form is saved automatically as soon as it loses focus
  // (back button, swipe back, tab switch, or opening another screen), as long
  // as the title is non-empty and something actually changed.
  onAutoSave?: (data: CreateTodoInput) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
  // What the form should show after a successful save. New tasks reset to a
  // blank form; existing tasks keep the values that were just saved.
  resetOnSave?: 'current' | 'empty';
  // Set this ref to true to suppress the next auto-save (e.g. deleting a task).
  suspendAutoSaveRef?: React.RefObject<boolean>;
}

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  priority: 'B',
  tagIds: [],
  deadline: null,
  deadlineHasTime: false,
  plannedAt: null,
  plannedHasTime: false,
  steps: [],
  isPrivate: false,
};

function formValues(initialValues?: TodoFormInitial): FormData {
  return {
    title: initialValues?.title ?? '',
    description: initialValues?.description ?? '',
    priority: initialValues?.priority ?? 'B',
    tagIds: initialValues?.tagIds ?? [],
    deadline: initialValues?.deadline ?? null,
    deadlineHasTime: initialValues?.deadlineHasTime ?? false,
    plannedAt: initialValues?.plannedAt ?? null,
    plannedHasTime: initialValues?.plannedHasTime ?? false,
    steps: (initialValues?.steps ?? []).map(({ name, completed }) => ({
      key: createStepKey(),
      name,
      completed,
    })),
    isPrivate: initialValues?.isPrivate ?? false,
  };
}

export function TodoForm({
  initialValues,
  revision,
  onSubmit,
  onAutoSave,
  submitLabel = 'Save',
  loading,
  resetOnSave = 'current',
  suspendAutoSaveRef,
}: Props) {
  const timezone = useAuthStore((s) => s.user?.timezone);
  const userId = useAuthStore((s) => s.user?.id) ?? '';
  const queryClient = useQueryClient();
  const refreshPending = useOfflineStore((s) => s.refreshPending);
  const { createTag: createTagOffline } = useOfflineTagOps(queryClient, userId);
  const [saving, setSaving] = useState(false);
  const [showTagCreator, setShowTagCreator] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_OPTIONS[0]);

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const createTagMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) => createTagOffline(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      refreshPending();
    },
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isDirty, isSubmitting, dirtyFields },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: formValues(initialValues),
  });

  function buildInput(data: FormData): CreateTodoInput {
    return {
      title: data.title,
      description: data.description,
      priority: data.priority,
      tag_ids: data.tagIds,
      deadline: data.deadline
        ? serializeTodoDateInTimeZone(data.deadline, data.deadlineHasTime, 'end', timezone)
        : null,
      planned_at: data.plannedAt
        ? serializeTodoDateInTimeZone(data.plannedAt, data.plannedHasTime, 'morning', timezone)
        : null,
      is_private: data.isPrivate,
      steps: data.steps
        .filter((step) => step.name.trim().length > 0)
        .map((step) => ({ name: step.name.trim(), completed: step.completed })),
    };
  }

  // Latest values captured in a ref so the focus/blur listener below can read
  // them without having to re-subscribe on every keystroke.
  const onAutoSaveRef = useRef(onAutoSave);
  useEffect(() => {
    onAutoSaveRef.current = onAutoSave;
  }, [onAutoSave]);

  // Keep the latest serializer (and its timezone) without re-subscribing the
  // focus listener on every render.
  const buildInputRef = useRef(buildInput);
  useEffect(() => {
    buildInputRef.current = buildInput;
  });

  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // True once a save (manual or automatic) has been kicked off so the blur
  // handler does not fire a second save.
  const savedRef = useRef(false);
  const pendingTagRef = useRef<Promise<void> | null>(null);
  const appliedRevision = useRef(revision);

  useEffect(() => {
    if (revision === appliedRevision.current || savedRef.current || saving) return;
    appliedRevision.current = revision;
    const current = getValues();
    const dirty = new Set(Object.keys(dirtyFields) as Array<keyof FormData>);
    for (const pair of [['deadline', 'deadlineHasTime'], ['plannedAt', 'plannedHasTime']] as const) {
      if (pair.some((field) => dirty.has(field))) pair.forEach((field) => dirty.add(field));
    }
    // Refresh untouched fields, retaining whole edited step/tag groups.
    reset(formValues(initialValues));
    for (const field of dirty) setValue(field, current[field], { shouldDirty: true });
  }, [revision, initialValues, saving, dirtyFields, getValues, reset, setValue]);

  const finishSave = useCallback(() => {
    isDirtyRef.current = false;
    if (resetOnSave === 'empty') {
      reset(EMPTY_FORM);
    } else {
      reset(getValues());
    }
    savedRef.current = false;
  }, [reset, getValues, resetOnSave]);

  async function submit(data: FormData) {
    if (savedRef.current) return;
    savedRef.current = true;
    setSaving(true);
    try {
      await onSubmit(buildInput(data));
      finishSave();
    } catch (error) {
      savedRef.current = false;
      AppDialog.alert('Could not save task', 'Your changes are still here. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (suspendAutoSaveRef) suspendAutoSaveRef.current = false;
      return () => {
        const save = onAutoSaveRef.current;
        if (!save) return;
        if (savedRef.current) return;
        if (suspendAutoSaveRef?.current) return;
        if (!isDirtyRef.current && !pendingTagRef.current) return;
        const title = (getValues('title') ?? '').trim();
        if (!title) return;
        savedRef.current = true;
        setSaving(true);
        const pendingTag = pendingTagRef.current;
        Promise.resolve(pendingTag).then(() => handleSubmit(
          async (data) => {
            try {
              await save(buildInputRef.current(data));
              finishSave();
            } catch (error: any) {
              savedRef.current = false;
              AppDialog.alert(
                'Could not save task',
                error?.response?.data?.error ?? 'Please try again.'
              );
            } finally {
              setSaving(false);
            }
          },
          () => {
            savedRef.current = false;
            setSaving(false);
            AppDialog.alert('Could not save task', 'Please fix the highlighted fields.');
          }
        )()).catch(() => {
          savedRef.current = false;
          setSaving(false);
          AppDialog.alert('Task not saved', 'Tag creation did not finish. Return to the task and try again.');
        });
      };
    }, [handleSubmit, getValues, finishSave, suspendAutoSaveRef])
  );

  const selectedTagIds = watch('tagIds') ?? [];
  const steps = watch('steps') ?? [];

  function updateStep(key: string, changes: { name?: string; completed?: boolean }) {
    setValue(
      'steps',
      getValues('steps').map((step) => step.key === key ? { ...step, ...changes } : step),
      { shouldDirty: true }
    );
  }

  function toggleTag(tagID: string) {
    const exists = selectedTagIds.includes(tagID);
    setValue(
      'tagIds',
      exists ? selectedTagIds.filter((id) => id !== tagID) : [...selectedTagIds, tagID],
      { shouldDirty: true }
    );
  }

  async function createTag() {
    if (pendingTagRef.current || savedRef.current) return;
    const name = newTagName.trim();
    if (!name) {
      AppDialog.alert('Tag name required', 'Please enter a name for the new tag.');
      return;
    }

    const operation = (async () => {
      const created = await createTagMutation.mutateAsync({ name, color: newTagColor });
      const latestTags = getValues('tagIds');
      if (!latestTags.includes(created.id)) {
        setValue('tagIds', [...latestTags, created.id], { shouldDirty: true });
      }
      setNewTagName('');
      setShowTagCreator(false);
    })();
    pendingTagRef.current = operation;
    try {
      await operation;
    } catch (error: any) {
      AppDialog.alert('Could not create tag', error?.response?.data?.error ?? 'Try a different name.');
    } finally {
      pendingTagRef.current = null;
    }
  }

  return (
    <KeyboardAwareScrollView style={styles.container}>
      <Controller
        control={control}
        name="title"
        render={({ field: { onChange, value, ref } }) => (
          <Input
            ref={ref}
            editable={!saving}
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
        render={({ field: { onChange, value, ref } }) => (
          <Input
            ref={ref}
            editable={!saving}
            label="Description"
            value={value}
            onChangeText={onChange}
            placeholder="More details..."
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
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
              const { color, label } = PRIORITIES[p];
              const selected = value === p;
              return (
                <TouchableOpacity
                  disabled={saving}
                  key={p}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={[
                    styles.priorityBtn,
                    { borderColor: color, backgroundColor: selected ? color + '33' : 'transparent' },
                  ]}
                  onPress={() => onChange(p)}
                >
                  <Text style={[styles.priorityLabel, { color }]}>{selected ? `✓ ${label}` : label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      />

      <Text style={styles.label}>Tags</Text>
      <View style={styles.tagsPanel}>
        {tagsQuery.isLoading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <View style={styles.tagsWrap}>
            {tagsQuery.data && tagsQuery.data.length > 0 ? (
              tagsQuery.data.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <TouchableOpacity
                    disabled={saving}
                    key={tag.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleTag(tag.id)}
                    style={[
                      styles.tagChoice,
                      {
                        borderColor: tag.color,
                        backgroundColor: selected ? `${tag.color}30` : 'transparent',
                      },
                    ]}
                  >
                    <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                    <Text style={[styles.tagChoiceText, { color: selected ? tag.color : colors.textMuted }]}>
                      {selected ? `✓ ${tag.name}` : tag.name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.emptyTagText}>No tags yet.</Text>
            )}

            <TouchableOpacity disabled={saving} accessibilityRole="button" accessibilityState={{ expanded: showTagCreator }} style={styles.tagCreateToggle} onPress={() => setShowTagCreator((v) => !v)}>
              <Text style={styles.tagCreateToggleText}>{showTagCreator ? 'Cancel' : 'Create tag'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showTagCreator ? (
          <View style={styles.tagCreatorCard}>
            <Input
              editable={!saving}
              label="Tag name"
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="e.g. School, Work, Health"
            />
            <Text style={styles.smallLabel}>Color</Text>
            <View style={styles.colorRow}>
              {TAG_COLOR_OPTIONS.map((color, index) => {
                const active = color === newTagColor;
                return (
                  <TouchableOpacity
                    disabled={saving}
                    key={color}
                    onPress={() => setNewTagColor(color)}
                    accessibilityRole="radio"
                    accessibilityLabel={TAG_COLOR_NAMES[index]}
                    accessibilityState={{ checked: active }}
                    style={styles.colorTarget}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: color, borderColor: active ? colors.text : colors.border }]}>
                      {active ? <Check size={16} color={colors.onAccent} /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Button
              title="Add Tag"
              disabled={saving}
              onPress={createTag}
              loading={createTagMutation.isPending}
              style={styles.addTagBtn}
            />
          </View>
        ) : null}
      </View>

      <DateTimeField
        disabled={saving}
        label="Due date"
        date={watch('deadline')}
        hasTime={watch('deadlineHasTime')}
        onDate={(d) => setValue('deadline', d, { shouldDirty: true })}
        onHasTime={(b) => setValue('deadlineHasTime', b, { shouldDirty: true })}
      />

      <DateTimeField
        disabled={saving}
        label="Do date"
        date={watch('plannedAt')}
        hasTime={watch('plannedHasTime')}
        onDate={(d) => setValue('plannedAt', d, { shouldDirty: true })}
        onHasTime={(b) => setValue('plannedHasTime', b, { shouldDirty: true })}
      />

      <View style={styles.stepsSection}>
        <Text style={styles.label}>Steps</Text>
        <View style={styles.stepsList}>
          {steps.map((step) => (
            <View key={step.key} style={styles.stepRow}>
              <TouchableOpacity
                disabled={saving}
                accessibilityRole="checkbox"
                accessibilityLabel={step.name.trim() || 'Step'}
                accessibilityState={{ checked: step.completed }}
                style={styles.stepToggle}
                onPress={() => updateStep(step.key, { completed: !step.completed })}
              >
                <View style={[styles.stepCheckbox, step.completed && styles.stepCheckboxCompleted]}>
                  {step.completed ? <Check size={14} color={colors.onAccent} strokeWidth={2.6} /> : null}
                </View>
              </TouchableOpacity>
              <TextInput
                editable={!saving}
                accessibilityLabel="Step name"
                value={step.name}
                onChangeText={(name) => updateStep(step.key, { name })}
                placeholder="What is the next step?"
                placeholderTextColor={colors.textMuted}
                style={[styles.stepInput, step.completed && styles.stepInputCompleted]}
              />
              <TouchableOpacity
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={`Delete step${step.name.trim() ? `: ${step.name.trim()}` : ''}`}
                style={styles.stepDelete}
                onPress={() => setValue(
                  'steps',
                  getValues('steps').filter((row) => row.key !== step.key),
                  { shouldDirty: true }
                )}
              >
                <X size={16} color={colors.textDim} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            disabled={saving}
            accessibilityRole="button"
            style={styles.addStepBtn}
            onPress={() => setValue(
              'steps',
              [...getValues('steps'), { key: createStepKey(), name: '', completed: false }],
              { shouldDirty: true }
            )}
          >
            <Plus size={14} color={colors.accentLight} strokeWidth={2.4} />
            <Text style={styles.tagCreateToggleText}>Add step</Text>
          </TouchableOpacity>
        </View>
      </View>

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
              disabled={saving}
              accessibilityLabel="Private task"
              accessibilityHint="Hides this task from friends and turns off friend notifications for it."
              value={value}
              onValueChange={onChange}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        )}
      />

      <Button
        title={submitLabel}
        disabled={createTagMutation.isPending}
        onPress={handleSubmit(submit)}
        loading={loading || saving || isSubmitting}
        style={styles.submitBtn}
      />
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  priorityRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  priorityBtn: {
    minHeight: 44,
    justifyContent: 'center',
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  priorityLabel: { fontWeight: '700', fontSize: 14, textAlign: 'center' },
  priorityDesc: { fontSize: 10, textAlign: 'center' },
  tagsPanel: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  tagChoice: {
    maxWidth: '100%',
    minHeight: 44,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagChoiceText: {
    flexShrink: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyTagText: {
    color: colors.textDim,
    fontSize: 12,
    fontStyle: 'italic',
  },
  tagCreateToggle: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
  },
  tagCreateToggleText: {
    color: colors.accentLight,
    fontWeight: '800',
    fontSize: 12,
  },
  tagCreatorCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.bg + '66',
  },
  smallLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  colorTarget: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  colorSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
  },
  colorSwatchActive: {
    transform: [{ scale: 1.08 }],
  },
  addTagBtn: { marginTop: 2 },
  stepsSection: { marginBottom: 18 },
  stepsList: { gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepToggle: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  stepCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCheckboxCompleted: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  stepInputCompleted: { textDecorationLine: 'line-through', color: colors.textDim },
  stepDelete: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addStepBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
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
