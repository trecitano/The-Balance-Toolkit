import React from "react";
import clsx from "clsx";

interface ModalProps {
  open: boolean; // whether the modal is visible
  onClose?: () => void; // optional close handler (e.g. clicking backdrop)
  children: React.ReactNode; // consumer-provided content
  className?: string; // allow custom styling for inner box
}

export const Modal: React.FC<ModalProps> = ({
                                              open,
                                              onClose,
                                              children,
                                              className,
                                            }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/35 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className={clsx(
          "bg-[#ffffff] px-20 py-12 rounded-lg shadow-lg text-center",
          className
        )}
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
      >
        {children}
      </div>
    </div>
  );
};