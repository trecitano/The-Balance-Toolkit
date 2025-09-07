import { Modal } from "@/components/Modal.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "blue" | "red" | "grey";
}

export function ConfirmModal({
                               open,
                               onClose,
                               title,
                               message,
                               onConfirm,
                               onCancel,
                               confirmText = "OK",
                               cancelText = "Cancel",
                               confirmColor = "blue"
                             }: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleCancel}>
      {title && <h4 className="mb-4 text-lg font-bold">{title}</h4>}
      <p className="mb-6 text-base leading-relaxed text-gray-700">{message}</p>
      <div className="mt-12 flex justify-center gap-6">
        <ToolkitButton type="button" color={confirmColor} onClick={handleConfirm}>
          {confirmText}
        </ToolkitButton>
        <ToolkitButton type="button" color="grey" onClick={handleCancel}>
          {cancelText}
        </ToolkitButton>
      </div>
    </Modal>
  );
}