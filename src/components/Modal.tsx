import clsx from "clsx";
import React, {useEffect} from "react";

interface ModalProps extends React.PropsWithChildren {
  open: boolean;
  onClose: () => void;
  className?: string;
  defaultLayout?: boolean;
}

export function Modal({ open, onClose, children, className, defaultLayout = true }: ModalProps) {
  if (!open) return null;

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
