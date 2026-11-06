import { Text } from 'react-native';
import { AppDialog, useDialogStore } from '../../services/appDialog';
import { colors } from '../../constants/colors';
import { ThemedDialog } from './ThemedDialog';
import { DateTimeDialog } from './DateTimeDialog';

export function AppDialogHost() {
  const request = useDialogStore((state) => state.queue[0]);
  if (!request) return null;
  return (
    <ThemedDialog
      title={request.title}
      onClose={() => AppDialog.respond(request.id, request.actions.find((action) => action.style === 'cancel'))}
      actions={request.actions.map((action) => ({ ...action, onPress: () => AppDialog.respond(request.id, action) }))}
    >
      {request.dateTime ? <DateTimeDialog
        key={request.id}
        mode={request.dateTime.mode}
        value={request.dateTime.value}
        onClose={() => AppDialog.respond(request.id)}
        onSave={(value) => AppDialog.respond(request.id, { text: 'Save', onPress: () => request.dateTime!.onSave(value) })}
      /> : request.message ? <Text style={{ color: colors.textMuted, fontSize: 16, lineHeight: 24 }}>{request.message}</Text> : null}
    </ThemedDialog>
  );
}
