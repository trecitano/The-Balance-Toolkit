import { Modal } from "@/components/Modal.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";

interface ScanningModalProps {
  open: boolean;
  onClose: () => void;
  foundDevicesCount: number;
}

export default function ScanningModal({ open, onClose, foundDevicesCount }: ScanningModalProps) {
  return (
    <Modal className="min-w-sm" open={open} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div>
          <span className="spinner" />
        </div>
        <span className="text-2xl font-semibold text-(--primary)">Scanning...</span>

        <p className="text-lg font-medium">{`Found ${foundDevicesCount} devices so far...`}</p>

        <ToolkitButton type="button" color="blue" onClick={onClose}>
          OK
        </ToolkitButton>
      </div>
    </Modal>
  );
}
