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

  /**
   * O erro é sinalizado no indicador **e** repassado a quem chamou.
   *
   * Engolindo a exceção aqui, o `catch` de quem clicou em "Salvar" nunca
   * rodava: a tela seguia como se tivesse dado certo — no cadastro de cliente,
   * uma criação que falhava mandava a usuária de volta para a lista sem
   * mensagem nenhuma, e a cliente simplesmente não estava lá.
   */
  const save = useCallback(async () => {
    setStatus('saving');
    try {
      await saveFn(latestData.current);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      setStatus('error');
      throw e;
    }
  }, [saveFn]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    // O salvamento automático não tem quem trate a falha: o indicador já
    // mostrou "erro", e deixar a promessa rejeitada solta derrubaria o console
    // a cada digitação com a rede fora do ar.
    timerRef.current = setTimeout(() => { save().catch(() => {}); }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, delay, enabled, save]);

  return { status, saveNow: save };
}
