import clsx from "clsx";
import React, { useEffect, useRef } from "react";

interface ModalProps extends React.PropsWithChildren {
  open: boolean;
  onOpen?: () => void;
  onClose: () => void;
  className?: string;
  defaultLayout?: boolean;
}

export function Modal({ open, onOpen, onClose, children, className, defaultLayout = true }: ModalProps) {
  const previousOpenRef = useRef(open);

  if (open && !previousOpenRef.current && onOpen) {
    onOpen();
  }
  previousOpenRef.current = open;

  // Keyboard support
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/35" onClick={onClose}>
      {defaultLayout ? (
        <div
          className={clsx("rounded-lg bg-[#ffffff] px-20 py-12 text-center shadow-lg", className)}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
