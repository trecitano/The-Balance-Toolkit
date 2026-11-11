import clsx from "clsx";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import folderIcon from "@/assets/folder-icon.svg";
import { replayIcon, sessionIcon } from "@/assets/icons";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import PageSubtitle from "@/components/PageSubtitle.tsx";
import { LastSessionInformation, User } from "@/types.ts";
import { getBlockImage, LOGO_IMAGE, showLogoInstead } from "@/utils/activityImages.ts";
import { formatDate, formatDateTime, formatDuration, formatRelativeDay } from "@/utils/dates.ts";
import { userColor } from "@/utils/userColors.ts";

function UserAvatar({ user }: { user: User }) {
  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: userColor(user) }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0" title={title}>
      <dt className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">{label}</dt>
      <dd className="truncate text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

// Last Session Card
export default function LastSessionCard({ sessionDetails }: { sessionDetails?: LastSessionInformation | null }) {
  if (!sessionDetails) {
    return (
      <div className="flex h-full flex-col p-(--space-sm)">
        <PageSubtitle>Last session</PageSubtitle>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-base font-semibold text-gray-700">No sessions yet</p>
          <p className="text-sm text-gray-500">Your latest recording will appear here, ready to replay.</p>
          <ToolkitButton to="/session" color="blue" size="sm" iconUrl={sessionIcon} className="mt-2">
            Start a session →
          </ToolkitButton>
        </div>
      </div>
    );
  }

  const { user, activity, sessionStats, fileLocation } = sessionDetails;
  const recordedAt = new Date(sessionDetails.recordedAt);
  const samplingRate = sessionStats.boardSamplingRate;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-(--space-sm)" title={fileLocation}>
      <div className="flex items-baseline justify-between gap-3">
        <PageSubtitle>Last session</PageSubtitle>
        <span className="text-xs font-medium text-gray-400">{formatRelativeDay(recordedAt)}</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-4">
        <div className="flex aspect-square h-full max-h-28 min-h-20 shrink-0 items-center justify-center rounded-xl bg-(--bg-light) p-2.5">
          <img
            src={activity ? getBlockImage(activity.staticImage) : LOGO_IMAGE}
            onError={showLogoInstead}
            alt=""
            draggable={false}
            className={clsx("max-h-full max-w-full object-contain", !activity && "opacity-30")}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <p className="truncate text-lg leading-tight font-bold text-gray-900" title={activity?.title}>
            {activity?.title ?? "No activity chosen"}
          </p>
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar user={user} />
            <span className="truncate text-sm font-medium text-gray-600" title={user.name}>
              {user.name}
            </span>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-gray-200 border-y border-gray-200 py-2.5">
        <Stat label="Recorded" value={formatDate(recordedAt)} title={formatDateTime(recordedAt)} />
        <Stat label="Duration" value={formatDuration(sessionStats.duration.secs)} />
        <Stat label="Sampling" value={samplingRate > 0 ? `${Math.round(samplingRate)} Hz` : "Unknown"} />
      </dl>

      <div className="flex items-center justify-end gap-3">
        {/* Opens File Explorer (Finder on macOS) with the session's files selected. */}
        <ToolkitButton
          type="button"
          color="white"
          onClick={() => void revealItemInDir(fileLocation).catch((error) => console.error(error))}
        >
          <span className="flex items-center gap-2">
            <img src={folderIcon} alt="" className="size-4 object-contain opacity-70" draggable={false} />
            Open folder
          </span>
        </ToolkitButton>
        <ToolkitButton to="/replay" color="blue" iconUrl={replayIcon}>
          Replay →
        </ToolkitButton>
      </div>
    </div>
  );
}
