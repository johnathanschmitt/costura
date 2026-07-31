import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export function useUnsavedChanges(isDirty: boolean) {
  // Block in-app navigation
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname,
  );

  // Block browser refresh / tab close
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Confirm dialog when blocker is active
  useEffect(() => {
    if (blocker.state === 'blocked') {
      const ok = window.confirm('Há alterações não salvas. Deseja sair mesmo assim?');
      if (ok) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
}
