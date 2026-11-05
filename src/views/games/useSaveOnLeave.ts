import { useEffect, useRef } from 'react';

/**
 * Saves a game's progress when the player leaves it: going back to the Games list,
 * switching tabs, or putting the phone away. `get` returns what to save, and is
 * read fresh each time. Returns `paused`, true while the page is out of sight.
 */
export function useSaveOnLeave(get: () => unknown, save: (data: unknown) => void, done: () => boolean) {
  const getRef = useRef(get), saveRef = useRef(save), doneRef = useRef(done);
  getRef.current = get; saveRef.current = save; doneRef.current = done;
  useEffect(() => {
    const flush = () => { if (!doneRef.current()) saveRef.current(getRef.current()); };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); flush(); };
  }, []);
}
