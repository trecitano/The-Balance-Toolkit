import clsx from "clsx";
import React from "react";

interface ModalProps extends React.PropsWithChildren {
  open: boolean;
  onClose: () => void;
  className?: string;
}

export function Modal({ open, onClose, children, className }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35" onClick={onClose}>
      <div
        className={clsx("rounded-lg bg-[#ffffff] px-20 py-12 text-center shadow-lg", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
