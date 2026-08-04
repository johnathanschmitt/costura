import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  /** No formato `ação:recurso`, ex.: `read:financial`. */
  permissions?: string[];
}

interface AuthState {
  token: string | null;
  user: User | null;
  /** Verdadeiro quando a sessão não pôde ser gravada e some ao fechar a aba. */
  storageUnavailable: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

/**
 * O navegador pode recusar o localStorage — janela anônima, bloqueio de dados
 * do site, cota estourada. Sem esta proteção a gravação lança e derruba o login
 * inteiro: a sessão nem chega a existir em memória, e a tela volta para o
 * formulário como se a senha estivesse errada.
 *
 * Aqui a falha é absorvida: a sessão vale na aba aberta e o app fica sabendo
 * pelo sinalizador `storageUnavailable`.
 */
let storageFailed = false;

const safeStorage: StateStorage = {
  getItem: name => {
    try {
      return localStorage.getItem(name);
    } catch {
      storageFailed = true;
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      storageFailed = true;
    }
  },
  removeItem: name => {
    try {
      localStorage.removeItem(name);
    } catch {
      storageFailed = true;
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      token: null,
      user: null,
      storageUnavailable: false,
      setAuth: (token, user) => set({ token, user, storageUnavailable: storageFailed }),
      logout: () => {
        set({ token: null, user: null });
        window.location.href = '/login';
      },
    }),
    {
      name: 'atelie-auth',
      storage: createJSONStorage(() => safeStorage),
      // `storageUnavailable` descreve a sessão atual, não algo a persistir.
      partialize: state => ({ token: state.token, user: state.user }) as AuthState,
    },
  ),
);
