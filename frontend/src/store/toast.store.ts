import { create } from 'zustand';

type Severity = 'success' | 'error' | 'warning' | 'info';

/**
 * Ação oferecida junto da mensagem — na prática, desfazer.
 *
 * Sistema com desfazer visível é sistema em que a pessoa clica sem medo, e
 * gente sem medo aprende a tela sozinha. Vale dobrado aqui, onde quem erra é a
 * mesma pessoa que confere. A confirmação prévia fica só para o que não tem
 * volta: cancelar conta, fechar o mês.
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  open: boolean;
  message: string;
  severity: Severity;
  actions: ToastAction[];
  show: (message: string, severity?: Severity, actions?: ToastAction | ToastAction[] | null) => void;
  close: () => void;
}

export const useToastStore = create<ToastState>(set => ({
  open: false,
  message: '',
  severity: 'success',
  actions: [],
  show: (message, severity = 'success', actions) =>
    set({
      open: true,
      message,
      severity,
      actions: !actions ? [] : Array.isArray(actions) ? actions.filter(Boolean) : [actions],
    }),
  close: () => set({ open: false, actions: [] }),
}));

export const useToast = () => useToastStore(s => s.show);
