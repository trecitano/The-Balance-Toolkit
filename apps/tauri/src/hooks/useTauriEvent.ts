import { useEffect, useEffectEvent } from "react";
import type { Event, UnlistenFn } from "@tauri-apps/api/event";

type TauriEvent<T> = { listen: (handler: (event: Event<T>) => void) => Promise<UnlistenFn> };

export function useTauriEvent<T>(event: TauriEvent<T>, handler: (event: Event<T>) => void) {
  const onEvent = useEffectEvent(handler);
  useEffect(() => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    void event
      .listen((message) => {
        if (!disposed) onEvent(message);
      })
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      })
      .catch((error) => console.error("Could not subscribe to desktop events", error));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [event]);
}
