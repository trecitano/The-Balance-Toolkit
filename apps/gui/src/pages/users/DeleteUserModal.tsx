import {Modal} from "@/components/Modal.tsx";
import {ToolkitButton} from "@/components/ToolkitButton.tsx";

interface DeleteUserModalProps {
  open: boolean;
  userName: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteUserModal({
                           open,
                           userName,
                           onConfirm,
                           onCancel,
                         }: DeleteUserModalProps) {
  return (
    <Modal open={open} onClose={onCancel}>
      <h4 className="mb-4 text-lg font-bold">Confirm Delete</h4>
      <p className="mb-6 text-base leading-relaxed text-gray-700">
        Are you sure you want to delete user "{userName}"?
      </p>
      <div className="flex justify-center gap-6">
        <ToolkitButton type="button" color="red" onClick={onConfirm}>
          Delete
        </ToolkitButton>
        <ToolkitButton type="button" color="grey" onClick={onCancel}>
          Cancel
        </ToolkitButton>
      </div>
    </Modal>
  );
}