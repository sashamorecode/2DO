import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Switch, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

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
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDate(true)}>
          <CalendarIcon size={16} color={date ? colors.accentLight : colors.textDim} strokeWidth={2.2} />
          <Text style={date ? styles.dateText : styles.datePlaceholder}>{dateLabel}</Text>
        </TouchableOpacity>
        {date && (
          <TouchableOpacity
            onPress={() => {
              onDate(null);
              onHasTime(false);
            }}
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
