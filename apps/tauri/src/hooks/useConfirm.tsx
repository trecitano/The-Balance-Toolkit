import { useState, useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { ConfirmModal } from "@/components/Confirm";

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  useEffect(
    () => () => {
      resolver.current?.(false);
      resolver.current = null;
    },
    [],
  );
  const confirm = useCallback((next: ConfirmOptions): Promise<boolean> => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const finish = useCallback((accepted: boolean) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setOptions(null);
  }, []);
  const ConfirmDialog = options ? (
    <ConfirmModal open {...options} onConfirm={() => finish(true)} onCancel={() => finish(false)} />
  ) : null;
  return { confirm, ConfirmDialog };
}
