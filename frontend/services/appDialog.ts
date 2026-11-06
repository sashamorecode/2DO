import { create } from 'zustand';

export interface DialogAction {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  actions: DialogAction[];
  dateTime?: {
    mode: 'date' | 'time';
    value: Date;
    onSave: (value: Date) => void;
  };
}

let nextId = 0;
export const useDialogStore = create<{ queue: DialogRequest[] }>(() => ({ queue: [] }));

export const AppDialog = {
  dateTime(mode: 'date' | 'time', value: Date, onSave: (value: Date) => void) {
    const request: DialogRequest = {
      id: ++nextId, title: mode === 'date' ? 'Choose a date' : 'Choose a time', actions: [],
      dateTime: { mode, value, onSave },
    };
    useDialogStore.setState((state) => ({ queue: [...state.queue, request] }));
    return request.id;
  },
  dismiss(id: number) {
    useDialogStore.setState((state) => ({ queue: state.queue.filter((request) => request.id !== id) }));
  },
  alert(title: string, message?: string, actions: DialogAction[] = [{ text: 'OK' }]) {
    const request = { id: ++nextId, title, message, actions: actions.length ? actions : [{ text: 'OK' }] };
    useDialogStore.setState((state) => ({ queue: [...state.queue, request] }));
  },
  respond(id: number, action?: DialogAction) {
    // Ignore duplicate presses or callbacks from an already dismissed dialog.
    if (useDialogStore.getState().queue[0]?.id !== id) return;
    useDialogStore.setState((state) => ({ queue: state.queue.slice(1) }));
    Promise.resolve().then(() => action?.onPress?.()).catch((error) => {
      AppDialog.alert('Could not complete action', error instanceof Error ? error.message : 'Please try again.');
    });
  },
};
