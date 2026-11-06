import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { AppDialog, useDialogStore } from '../../services/appDialog';
import { Calendar as CalendarIcon, Clock as ClockIcon, X } from 'lucide-react-native';
import { colors } from '../../constants/colors';

interface Props {
  label: string;
  date: Date | null | undefined;
  hasTime: boolean;
  onDate: (d: Date | null) => void;
  onHasTime: (b: boolean) => void;
}

export function DateTimeField({ label, date, hasTime, onDate, onHasTime }: Props) {
  const dialogId = useRef<number | null>(null);
  useEffect(() => () => {
    if (dialogId.current !== null) AppDialog.dismiss(dialogId.current);
  }, []);
  const openPicker = (mode: 'date' | 'time') => {
    if (useDialogStore.getState().queue.some((request) => request.id === dialogId.current)) return;
    dialogId.current = AppDialog.dateTime(mode, date ?? new Date(), (picked) => {
      dialogId.current = null;
      onDate(picked);
      if (mode === 'time') onHasTime(true);
    });
  };

  const dateLabel = date
    ? date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Pick a date…';
  const timeLabel =
    date && hasTime
      ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : 'No time set';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateRow}>
        <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('date')}>
          <CalendarIcon size={16} color={date ? colors.accentLight : colors.textDim} strokeWidth={2.2} />
          <Text style={date ? styles.dateText : styles.datePlaceholder}>{dateLabel}</Text>
        </TouchableOpacity>
        {date && (
          <TouchableOpacity
            onPress={() => {
              onDate(null);
              onHasTime(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            style={styles.clearBtn}
          >
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
              if (b) openPicker('time');
              else onHasTime(false);
            }}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
          {hasTime && (
            <TouchableOpacity style={styles.timeBtn} onPress={() => openPicker('time')}>
              <ClockIcon size={14} color={colors.accentLight} strokeWidth={2.2} />
              <Text style={styles.dateText}>{timeLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 18 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateBtn: {
    flex: 1,
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
});
