import clsx from "clsx";
import PersonIcon from "@/assets/user-icon.svg?react";
import type { User } from "@/types";
import { userColor } from "@/utils/userColors.ts";

/** A round badge in the user's colour with a person on it. Size it with `className`; the person scales with it. */
export default function UserIcon({ user, className }: { user: Pick<User, "color">; className?: string }) {
  return (
    <span
      className={clsx("flex shrink-0 items-center justify-center rounded-full", className)}
      style={{ backgroundColor: userColor(user) }}
    >
      <PersonIcon className="size-3/5 text-white" />
    </span>
  );
}
