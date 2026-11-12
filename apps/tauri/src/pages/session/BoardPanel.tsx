import clsx from "clsx";
import type { ReactNode } from "react";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { convertNumberToMacAddress } from "@/utils/macAddress.ts";

/** A board's card on the Session and Replay pages: its name and MAC address, then its plots. */
export function BoardPanel({ name, macAddress, children }: { name: string; macAddress: number; children: ReactNode }) {
  return (
    <ToolkitContainer className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-2 text-sm">
        <p className="font-semibold">{name}</p>
        <p>{convertNumberToMacAddress(macAddress)}</p>
      </div>
      {children}
    </ToolkitContainer>
  );
}

/** One cell of a board's plot grid. The zero minimum sizes let a plot shrink with its grid. */
export function PlotCell({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("min-h-0 min-w-0 bg-gray-100 p-2", className)}>{children}</div>;
}
