import { useRef } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { Modal } from "@/components/Modal.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Icon } from "@/components/Icons.tsx";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  /**
   * For actions that delete or lose something: a red button and a warning sign, and Cancel takes
   * the focus so Enter can't confirm by accident.
   */
  destructive?: boolean;
}

export function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "OK",
  cancelText = "Cancel",
  destructive = false,
}: ConfirmModalProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      label={title ?? "Confirm"}
      open={open}
      onClose={onCancel}
      className="w-lg"
      initialFocus={destructive ? cancelButton : undefined}
    >
      <span
        className={clsx(
          "mx-auto mb-4 flex size-12 items-center justify-center rounded-full",
          destructive ? "bg-(--red-light) text-(--red)" : "bg-(--primary-light) text-(--primary)",
        )}
      >
        <Icon name={destructive ? "warning" : "question"} className="size-6" />
      </span>
      {title && <h2 className="mb-2 text-lg font-bold text-gray-900">{title}</h2>}
      <p className="text-base leading-relaxed text-gray-600">{message}</p>
      <div className="mt-8 flex justify-center gap-3">
        <ToolkitButton type="button" color={destructive ? "red" : "blue"} className="min-w-32" onClick={onConfirm}>
          {confirmText}
        </ToolkitButton>
        <ToolkitButton ref={cancelButton} type="button" color="grey" className="min-w-32" onClick={onCancel}>
          {cancelText}
        </ToolkitButton>
      </div>
    </Modal>
  );
}
