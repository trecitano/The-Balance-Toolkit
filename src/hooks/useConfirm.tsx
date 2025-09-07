import { useState, useCallback } from 'react';
import {ConfirmModal} from "@/components/Confirm.tsx";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "blue" | "red" | "grey";
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(true);
      setConfirmState(null);
    }
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(false);
      setConfirmState(null);
    }
  }, [confirmState]);

  const ConfirmDialog = useCallback(() => {
    if (!confirmState) return null;

    return (
      <ConfirmModal
        open={confirmState.isOpen}
        onClose={handleCancel}
        title={confirmState.options.title}
        message={confirmState.options.message}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        confirmText={confirmState.options.confirmText}
        cancelText={confirmState.options.cancelText}
        confirmColor={confirmState.options.confirmColor}
      />
    );
  }, [confirmState, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
}