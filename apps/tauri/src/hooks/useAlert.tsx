import { useState, useCallback } from "react";
import { AlertModal } from "@/components/Alert.tsx";

interface AlertOptions {
  title?: string;
  message: string;
}

export function useAlert() {
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    options: AlertOptions;
  }>({ isOpen: false, options: { message: "" } });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertState({ isOpen: true, options });
  }, []);

  const handleClose = useCallback(() => {
    setAlertState({ isOpen: false, options: { message: "" } });
  }, []);

  const AlertDialog = useCallback(() => {
    if (!alertState.isOpen) return null;

    return (
      <AlertModal
        open={alertState.isOpen}
        onClose={handleClose}
        title={alertState.options.title}
        message={alertState.options.message}
      />
    );
  }, [alertState, handleClose]);

  return { showAlert, AlertDialog };
}
