import { useState, useEffect } from "react";
import { Modal } from "@/components/Modal.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { Device } from "@/types";
import ledImage1 from "@/assets/wbb-top-white.svg";
import ledImage2 from "@/assets/wbb-top-white-blink.svg";

interface IdentifyDeviceModalProps {
  device: Device | null;
  onClose: () => void;
}

export default function IdentifyDeviceModal({ device, onClose }: IdentifyDeviceModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isOpen = !!device;

  useEffect(() => {
    if (!isOpen) {
      setCurrentImageIndex(0);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    let currentCycle = 0;
    const totalCycles = 10;

    const runFlashSequence = () => {
      if (currentCycle >= totalCycles) {
        setCurrentImageIndex(1); // LED stays on at the end
        return;
      }

      // First flash: ON
      setCurrentImageIndex(1);
      timeoutId = setTimeout(() => {
        // First flash: OFF
        setCurrentImageIndex(0);
        timeoutId = setTimeout(() => {
          // Second flash: ON
          setCurrentImageIndex(1);
          timeoutId = setTimeout(() => {
            // Second flash: OFF
            setCurrentImageIndex(0);
            timeoutId = setTimeout(() => {
              currentCycle++;
              runFlashSequence(); // Start next cycle
            }, 800); // 800ms pause between cycles
          }, 100);
        }, 100);
      }, 100);
    };

    // Start with LED off, then begin sequence
    setCurrentImageIndex(0);
    timeoutId = setTimeout(runFlashSequence, 100);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOpen]);

  return (
    <Modal open={isOpen} onClose={onClose}>
      <h4 className="mb-4 text-lg font-bold">Identifying {device?.name}</h4>

      <p className="text-base leading-relaxed text-gray-700">
        A flashing sequence will appear on the LED of the board.
      </p>

      <img
        src={currentImageIndex === 0 ? ledImage1 : ledImage2}
        alt="LED flashing animation"
        className="mx-auto size-80 object-contain transition-opacity duration-200"
      />

      <ToolkitButton type="button" color="grey" onClick={onClose}>
        Close
      </ToolkitButton>
    </Modal>
  );
}