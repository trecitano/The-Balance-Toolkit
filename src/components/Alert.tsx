import { Modal } from "@/components/Modal.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";

interface AlertModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export function AlertModal({ open, onClose, title, message }: AlertModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      {title && <h4 className="mb-4 text-lg font-bold">{title}</h4>}
      <p className="mb-6 text-base leading-relaxed text-gray-700">{message}</p>
      <div className="flex justify-center">
        <ToolkitButton type="button" color="blue" onClick={onClose}>
          Ok
        </ToolkitButton>
      </div>
    </Modal>
  );
}