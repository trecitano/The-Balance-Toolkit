import clsx from "clsx";
import { useEffect, useRef } from "react";
import type { PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { usePageZoom } from "@/components/ZoomToFill.tsx";

interface ModalProps extends PropsWithChildren {
  open: boolean;
  onClose: () => void;
  className?: string;
  defaultLayout?: boolean;
  label?: string;
}

export function Modal({ open, onClose, children, className, defaultLayout = true, label = "Dialog" }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // The dialog is drawn outside the page, so it takes the page's zoom from context.
  const zoom = usePageZoom();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);

  if (!open) return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={label}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-4 text-inherit backdrop:bg-black/35 open:flex open:items-center open:justify-center"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={clsx(
          "max-h-full overflow-auto",
          defaultLayout && "rounded-lg bg-white px-20 py-12 text-center shadow-lg",
          className,
        )}
        style={{ zoom }}
      >
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
