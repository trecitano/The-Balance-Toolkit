import { Modal } from "@/components/Modal";
import { ToolkitButton } from "@/components/ToolkitButton";
import type { NintendoDevice } from "@/types";
import ledOff from "@/assets/wbb-top-white.svg";
import ledOn from "@/assets/wbb-top-white-blink.svg";

export default function IdentifyDeviceModal({
  device,
  onClose,
}: {
  device: NintendoDevice | null;
  onClose: () => void;
}) {
  if (!device) return null;
  return (
    <Modal open label={`Identifying ${device.name}`} onClose={onClose}>
      <h2 className="mb-4 text-lg font-bold">Identifying {device.name}</h2>
      <p>A flashing sequence will appear on the LED of the board.</p>
      <div key={device.macAddress} className="relative mx-auto size-80">
        <img src={ledOff} alt="Balance board" className="absolute size-full object-contain" />
        <img src={ledOn} alt="" className="identify-led absolute size-full object-contain" />
      </div>
      <ToolkitButton type="button" color="grey" onClick={onClose}>
        Close
      </ToolkitButton>
    </Modal>
  );
}
