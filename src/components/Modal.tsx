import React from "react";
import clsx from "clsx";

interface ModalProps {
  open: boolean; // whether the modal is visible
  onClose?: () => void; // optional close handler (e.g. clicking backdrop)
  children: React.ReactNode; // consumer-provided content
  className?: string; // allow custom styling for inner box
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, children, className }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35" onClick={onClose}>
      <div
        className={clsx("rounded-lg bg-[#ffffff] px-20 py-12 text-center shadow-lg", className)}
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
      >
        {children}
      </div>
    </div>
  );
};
