import { useCallback, useLayoutEffect, useState } from 'react';
import { Text } from 'react-native';
import { AppDialog, useDialogStore } from '../../services/appDialog';
import { colors } from '../../constants/colors';
import { ThemedDialog } from './ThemedDialog';
import { DateTimeDialog } from './DateTimeDialog';

export function AppDialogHost() {
  const queuedRequest = useDialogStore((state) => state.queue[0]);
  const [retainedRequest, setRetainedRequest] = useState<typeof queuedRequest | undefined>(queuedRequest);
  useLayoutEffect(() => {
    if (queuedRequest) setRetainedRequest(queuedRequest);
  }, [queuedRequest]);
  const request = queuedRequest ?? retainedRequest;
  const requestId = request?.id;
  const onExited = useCallback(() => {
    setRetainedRequest((current) => current?.id === requestId ? undefined : current);
  }, [requestId]);
  if (!request) return null;
  return (
    <ThemedDialog
      key={request.id}
      title={request.title}
      exiting={!queuedRequest}
      onExited={onExited}
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
