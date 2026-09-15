import { ReactNode, useRef, useState } from "react";
import logoLettering from "@/assets/logo/logo-lettering-white.svg";
import fileIcon from "@/assets/file-icon.svg";
import userIcon from "@/assets/user-icon.svg";
import calendarIcon from "@/assets/calendar-icon.svg";
import activitiesIconUrl from "@/assets/activities-icon.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { useQuery } from "@tanstack/react-query";
import { ActivitiesQuery, DevicesQuery, LastSessionQuery } from "@/queries/toolkit";
import { QueryStatus } from "@/components/QueryStatus";
import { Modal } from "@/components/Modal";
import { Activity, NintendoDevice, LastSessionInformation } from "@/types.ts";
import { getBlockImage } from "@/utils/activityImages.ts";
import CarouselIndicators from "@/components/CarouselIndicators.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import githubIcon from "@/assets/github-icon.svg";
import wbbIcon from "@/assets/wbb-top-white.svg";
import wbbIconBlue from "@/assets/wbb-top-blue.png";
import PageSubtitle from "@/components/PageSubtitle.tsx";
import rippleIcon from "@/assets/ripple-icon.svg";
import underConstructionHelp from "@/assets/under-construction-1-grey.svg";
import underConstructionDoc from "@/assets/under-construction-2-grey.svg";
import underConstructionResources from "@/assets/under-construction-3-grey.svg";
import { activitiesIcon, devicesIcon, replayIcon } from "@/assets/icons";

// Filenames look like "tbt-2026-05-26T14-43-10.settings.json" — pull the
// embedded timestamp out and render it as a friendly date. The backend names
// sessions with UTC time, so parse it as UTC before formatting in local time.
const formatSessionDate = (fileName: string): string | null => {
  const match = fileName.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [year = 0, month = 1, day = 1, hour = 0, minute = 0, second = 0] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function Home() {
  const activitiesQuery = useQuery(ActivitiesQuery);
  const devicesQuery = useQuery(DevicesQuery);
  const lastSessionQuery = useQuery(LastSessionQuery);
  const pending = activitiesQuery.isPending || devicesQuery.isPending || lastSessionQuery.isPending;
  const error = activitiesQuery.error || devicesQuery.error || lastSessionQuery.error;
  if (pending || error)
    return (
      <QueryStatus
        pending={pending}
        error={error}
        onRetry={() => {
          void activitiesQuery.refetch();
          void devicesQuery.refetch();
          void lastSessionQuery.refetch();
        }}
      />
    );
  const activities = activitiesQuery.data ?? [];
  const devices = devicesQuery.data?.devices ?? [];
  const lastSessionDetails = lastSessionQuery.data;

  return (
    <>
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="mt-6 grid grid-cols-3 grid-rows-6 gap-8">
        <ToolkitContainer className="row-span-3">
          <LastSessionCard sessionDetails={lastSessionDetails} />
        </ToolkitContainer>

        <ToolkitContainer className="row-span-6">
          <ConnectionCard devices={devices} />
        </ToolkitContainer>

        <ToolkitContainer className="row-span-2" background={"bg-gray-100"}>
          <HelpSupportCard />
        </ToolkitContainer>

        <ToolkitContainer className="row-span-2" background={"bg-gray-100"}>
          <DocumentationCard />
        </ToolkitContainer>

        <ToolkitContainer className="row-span-3">
          <ActivitiesCard activities={activities} />
        </ToolkitContainer>

        <ToolkitContainer className="row-span-2" background={"bg-gray-100"}>
          <OtherResourcesCard />
        </ToolkitContainer>
      </div>
    </>
  );
}

function Header() {
  const [information, setInformation] = useState<"citation" | "source" | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const content =
    information === "citation"
      ? "Valente, A., Kothari, N., Ahmed-Mahmoud, H., Esteves, A., & Billinghurst, M. (2026). The Balance Toolkit: Democratizing balance-based interaction through open-source software for repurposed Wii Balance Boards. In Proceedings of the Annual Symposium on Computer-Human Interaction in Play (CHI PLAY '26). ACM."
      : "https://github.com/trecitano/The-Balance-Toolkit";
  return (
    <div className="bg-(--red) px-6 py-6 text-white">
      <div className="grid grid-cols-3 items-center gap-6">
        <img alt="The Balance Toolkit" className={"w-34"} src={logoLettering} draggable={false} />

        {/* Center: Circle logo */}
        <h1 className="text-center text-6xl leading-tight font-semibold italic">Welcome!</h1>

        {/* Right: Links */}
        <div className="mt-auto flex flex-col items-end gap-3">
          <button
            className="inline-flex items-center gap-2 text-white/95 hover:text-white"
            type="button"
            onClick={() => {
              setInformation("citation");
              setCopyStatus("");
            }}
          >
            <span className="text-base">Cite</span>
          </button>

          <button
            className="inline-flex h-5 items-center gap-2 text-white/95 hover:text-white"
            type="button"
            onClick={() => {
              setInformation("source");
              setCopyStatus("");
            }}
          >
            <img alt="" src={githubIcon} className={"h-full object-contain"} />
            <span className="text-base">Source Code</span>
          </button>
        </div>
      </div>
      <Modal
        open={information !== null}
        label={information === "citation" ? "Citation" : "Source code"}
        onClose={() => setInformation(null)}
        className="w-2xl text-gray-900"
      >
        <h2 className="mb-4 text-lg font-bold">
          {information === "citation" ? "Cite The Balance Toolkit" : "Source code"}
        </h2>
        <textarea
          readOnly
          aria-label={information === "citation" ? "Paper citation" : "Repository address"}
          rows={information === "citation" ? 6 : 2}
          className="w-full resize-none rounded border border-gray-300 p-3 text-sm"
          value={content}
          onFocus={(event) => event.target.select()}
        />
        <p role="status" className="my-3 text-sm">
          {copyStatus}
        </p>
        <div className="flex justify-center gap-3">
          <ToolkitButton
            type="button"
            color="blue"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(content);
                setCopyStatus("Copied.");
              } catch {
                setCopyStatus("Select the text above and copy it with your keyboard.");
              }
            }}
          >
            Copy {information === "citation" ? "citation" : "repository link"}
          </ToolkitButton>
          <ToolkitButton type="button" color="grey" onClick={() => setInformation(null)}>
            Close
          </ToolkitButton>
        </div>
      </Modal>
    </div>
  );
}

function SessionLabel({
  icon,
  iconClassName = "",
  children,
}: {
  icon: string;
  iconClassName?: string;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 font-semibold">
      <img alt="" className={`h-4 w-4 object-contain ${iconClassName}`} src={icon} draggable={false} />
      {children}
    </span>
  );
}

// Last Session Card
function LastSessionCard({ sessionDetails }: { sessionDetails?: LastSessionInformation | null }) {
  if (!sessionDetails) {
    return (
      <div className="flex h-full flex-col p-(--space-sm)">
        <div className="mb-4 flex items-center space-x-2">
          <PageSubtitle>Last session</PageSubtitle>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <span className="text-lg font-bold text-gray-500 italic">There are no previous sessions!</span>
        </div>
      </div>
    );
  }

  const { user, activity } = sessionDetails;
  const fileLocation = String(sessionDetails.fileLocation);
  const fileName = fileLocation.split(/[\\/]/).pop() ?? fileLocation;
  const sessionDate = formatSessionDate(fileName);

  return (
    <div className="flex h-full flex-col gap-5 p-(--space-sm) text-xs">
      <PageSubtitle>Last session</PageSubtitle>

      <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-3">
        <SessionLabel icon={userIcon}>User</SessionLabel>
        <p className="min-w-0 truncate">{user.name}</p>

        <SessionLabel icon={activitiesIconUrl} iconClassName="invert">
          Activity
        </SessionLabel>
        {activity ? (
          <p className="min-w-0 truncate">{activity.title}</p>
        ) : (
          <p className="text-gray-500 italic">No activity chosen</p>
        )}

        {sessionDate && (
          <>
            <SessionLabel icon={calendarIcon}>Date</SessionLabel>
            <p className="text-gray-700">{sessionDate}</p>
          </>
        )}

        <SessionLabel icon={fileIcon}>File</SessionLabel>
        <p className="min-w-0 truncate text-gray-700" title={fileLocation}>
          {fileName}
        </p>
      </div>

      <div className="mt-auto flex justify-end">
        <ToolkitButton to="/replay" color="grey" iconUrl={replayIcon}>
          Replay →
        </ToolkitButton>
      </div>
    </div>
  );
}

function ActivitiesCard({ activities }: { activities: Activity[] }) {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const scrollToActivity = (index: number) => {
    const activity = activities[index];
    if (!activity) return;
    const el = listRef.current?.querySelector(`[data-activityid="${activity.id}"]`);
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const handleSelectActivity = (index: number) => {
    setSelected(index);
    scrollToActivity(index);
  };

  return (
    <div className="flex h-full min-h-66 flex-col p-(--space-sm)">
      <PageSubtitle>Activities</PageSubtitle>

      <div className="flex-1">
        <ul ref={listRef} className="mask-horizontal-fade flex gap-8 overflow-hidden px-[calc(50%-125px)] py-5">
          {activities.map((activity, i) => {
            const active = i === selected;
            return (
              <li
                key={activity.id}
                data-activityid={activity.id}
                onClick={() => handleSelectActivity(i)}
                className={`flex h-23 w-43 cursor-pointer snap-center flex-col items-center justify-between rounded-lg bg-(--light-accent) p-4 opacity-45 shadow transition-all hover:bg-[#e9eef5] hover:shadow-lg ${active ? "z-10 scale-115 bg-[#e0eafc] font-bold opacity-100 shadow-lg ring-1 ring-(--primary)" : ""} `}
              >
                <div className="flex h-7/10 w-45 items-center justify-center">
                  <img
                    src={getBlockImage(activity.staticImage)}
                    alt=""
                    draggable={false}
                    className="max-h-full object-contain"
                  />
                </div>
                <div
                  className={`mt-2 h-[30%] text-xs font-semibold ${active ? "text-neutral-900" : "text-neutral-500"}`}
                >
                  {activity.title}
                </div>
              </li>
            );
          })}
        </ul>
        <CarouselIndicators
          entries={activities.map((activity) => activity.id)}
          selectedIndex={selected}
          onSelect={handleSelectActivity}
          nearbyThreshold={2}
          className={"mt-2"}
        />
      </div>

      <div className="flex justify-end">
        <ToolkitButton
          to={`/activities${activities[selected] ? `/${activities[selected].id}` : ""}`}
          color="grey"
          iconUrl={activitiesIcon}
        >
          Activities →
        </ToolkitButton>
      </div>
    </div>
  );
}

// Connection Card
function ConnectionCard({ devices }: { devices?: NintendoDevice[] }) {
  const noDevices = !devices || devices.length === 0;
  const numberConnectedDevices = devices?.filter((device) => device.isConnected).length ?? 0;

  return (
    <div className="flex h-full flex-col gap-5 p-(--space-sm)">
      <PageSubtitle>Connection</PageSubtitle>

      {noDevices ? (
        <>
          <div className="text-sm">
            <p className="font-semibold">There are no connected devices!</p>
            <p> Go to the devices page to scan for boards.</p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <img alt="" className={"h-40 object-contain"} src={wbbIcon} />
          </div>
        </>
      ) : numberConnectedDevices === 0 ? (
        <>
          <div className="text-sm">
            <p className="font-semibold">A Board has been previously connected.</p>
            <p> Please turn on the board!</p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <img alt="" className={"h-40 object-contain"} src={wbbIcon} />
          </div>
        </>
      ) : (
        <>
          <div className="text-sm">
            {numberConnectedDevices === 1 ? (
              <p className="font-semibold">There is one connected board!</p>
            ) : (
              <p className="font-semibold">There are {numberConnectedDevices} connected boards!</p>
            )}
            <p> Go to the Devices page to select them to start a session.</p>
          </div>

          <div className="relative flex flex-1 items-center justify-center">
            <img alt="" src={rippleIcon} className="absolute inset-0 h-full w-full opacity-10" />
            <img alt="" src={wbbIconBlue} className="z-10 w-50 object-contain" />
          </div>
        </>
      )}

      <div className="mt-auto flex justify-end">
        <ToolkitButton to="/devices" color="grey" iconUrl={devicesIcon}>
          Devices →
        </ToolkitButton>
      </div>
    </div>
  );
}

// Help Support Card
function HelpSupportCard() {
  return (
    <div className="relative z-1 flex h-full flex-col overflow-hidden p-(--space-sm)">
      <img
        alt=""
        src={underConstructionHelp}
        className="absolute inset-0 -z-1 m-auto w-1/2 opacity-60"
        draggable={false}
      />

      <div className="mb-4 flex items-center space-x-2">
        <PageSubtitle>Help and Support</PageSubtitle>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-lg font-bold text-gray-500 italic">🚧 This section is under construction 🚧</span>
      </div>
    </div>
  );
}

// Documentation Card
function DocumentationCard() {
  return (
    <div className="relative z-1 flex h-full flex-col p-(--space-sm)">
      <img
        alt=""
        src={underConstructionDoc}
        className="absolute inset-0 -z-1 m-auto w-1/2 opacity-60"
        draggable={false}
      />

      <div className="mb-4 flex items-center space-x-2">
        <PageSubtitle>Documentation</PageSubtitle>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-lg font-bold text-gray-500 italic">🚧 This section is under construction 🚧</span>
      </div>
    </div>
  );
}

// Other Resources Card
function OtherResourcesCard() {
  return (
    <div className="relative z-1 flex h-full flex-col p-(--space-sm)">
      <img
        alt=""
        src={underConstructionResources}
        className="absolute inset-0 -z-1 m-auto w-1/2 opacity-60"
        draggable={false}
      />

      <PageSubtitle>Other Resources</PageSubtitle>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-lg font-bold text-gray-500 italic">🚧 This section is under construction 🚧</span>
      </div>
    </div>
  );
}

export default Home;
