import { useEffect, useRef, useState, useCallback } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutosave<T>(
  data: T,
  saveFn: (data: T) => Promise<any>,
  options: { delay?: number; enabled?: boolean } = {},
) {
  const { delay = 1500, enabled = true } = options;
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const latestData = useRef(data);
  latestData.current = data;

  const save = useCallback(async () => {
    setStatus('saving');
    try {
      await saveFn(latestData.current);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }, [saveFn]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, delay, enabled, save]);

  return { status, saveNow: save };
}
