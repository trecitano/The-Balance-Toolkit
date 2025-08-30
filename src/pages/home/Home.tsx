import React, { useRef, useState } from "react";
import {
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  DocumentIcon,
  CodeBracketIcon,
  EnvelopeIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
import balanceToolkitLogo from "@/assets/balance-icon.svg";
import fileIcon from "@/assets/file-icon.svg";
import userIcon from "@/assets/user-icon.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { Activity, Device, LastSessionInformation } from "@/types.ts";
import { getActivityAssetFullPath } from "@/utils/activityImages.ts";
import CarouselIndicators from "@/components/CarouselIndicators.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import wbbIcon from "@/assets/wbb-icon-line.svg";
import wbbIconBlue from "@/assets/wbb-icon-line-blue.svg";

interface StatusIndicator {
  value: string;
  label: string;
  color: "green" | "orange" | "blue";
  icon: React.ComponentType<{ className?: string }>;
}

const HOME_QUERY_KEY = ["home"];

const Home: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: HOME_QUERY_KEY,
    queryFn: async () => {
      const activities = await commands.activity.getActivities();
      const lastSessionDetails = await commands.replay.loadLastSessionDetails();
      const devices = await commands.devices.fetchDevices();
      return { activities, lastSessionDetails, devices };
    },
  });

  if (isLoading) {
    return <div></div>;
  }

  if (error) {
    return <div></div>;
  }

  const activities = data?.activities ?? [];
  const lastSessionDetails = data?.lastSessionDetails;
  const devices = data?.devices;

  return (
    <>
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="mt-6 grid h-full grid-flow-col grid-cols-3 grid-rows-3 gap-8">
        <div className="col-span-2 row-span-3 grid grid-cols-2 grid-rows-10 gap-8">
          <ToolkitContainer className="col-span-1 row-span-6">
            <LastSessionCard sessionDetails={lastSessionDetails} />
          </ToolkitContainer>

          <ToolkitContainer className="col-span-1 row-span-6">
            <ConnectionCard devices={devices} />{" "}
          </ToolkitContainer>

          <ToolkitContainer className="col-span-2 row-span-4">
            <ActivitiesCard activities={activities} />
          </ToolkitContainer>
        </div>

        <ToolkitContainer className="row-span-1" background={"bg-gray-100"}>
          <HelpSupportCard />{" "}
        </ToolkitContainer>
        <ToolkitContainer className="row-span-1" background={"bg-gray-100"}>
          <DocumentationCard />{" "}
        </ToolkitContainer>
        <ToolkitContainer className="row-span-1" background={"bg-gray-100"}>
          <OtherResourcesCard />{" "}
        </ToolkitContainer>
      </div>
    </>
  );
};

const Header: React.FC = () => {
  return (
    <div className="bg-(--red) px-6 py-6 text-white">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        {/* Left: Greeting */}
        <div className="mb-auto md:flex-1">
          <h1 className="text-6xl leading-tight font-bold">Hello!</h1>
          <p className="mt-2 text-xl opacity-90">Welcome back to the balance tool kit</p>
        </div>

        {/* Center: Circle logo */}
        <div className="flex w-full justify-center md:w-auto md:flex-1">
          <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-4 border-white">
            <div className="text-center leading-tight">
              <div className="text-lg font-bold">The</div>
              <div className="text-lg font-bold">Balance</div>
              <div className="h-16 w-16">
                <img src={balanceToolkitLogo} draggable={false} />
              </div>
              <div className="text-lg font-bold">Toolkit</div>
            </div>
          </div>
        </div>

        {/* Right: Links */}
        <div className="mt-auto flex w-full flex-col items-end gap-3 md:w-auto md:flex-1 md:items-end">
          <button className="inline-flex items-center gap-2 text-white/95 hover:text-white" type="button">
            <DocumentIcon className="h-5 w-5" />
            <span className="text-base">Cite</span>
          </button>

          <button className="inline-flex items-center gap-2 text-white/95 hover:text-white" type="button">
            <CodeBracketIcon className="h-5 w-5" />
            <span className="text-base">Source Code</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Last Session Card
const LastSessionCard: React.FC<{ sessionDetails?: LastSessionInformation }> = ({ sessionDetails }) => {
  console.log(sessionDetails);

  if (!sessionDetails) {
    return (
      <div className="p-(--space-sm)">
        <h2 className="mb-4 text-xl font-semibold">Last session</h2>

        <div className="flex h-full flex-col">
          <div className="mb-4 flex items-center space-x-2">
            <div className="rounded-full bg-red-600 p-1 text-white">There is no existing session!</div>
          </div>
        </div>
      </div>
    );
  }

  const user = sessionDetails?.user;
  const activity = sessionDetails?.activity;

  return (
    <div className="p-(--space-sm)">
      <h2 className="mb-4 text-xl font-semibold">Last session</h2>

      <div className="flex justify-between">
        {/* User Section */}
        <div>
          <div className="flex">
            <div className="h-4 w-4">
              <img src={userIcon} draggable={false} />
            </div>
            <span className="font-medium">{user.name}</span>
          </div>

          <div className="space-y-1 text-xs text-gray-600">
            <div>Weight: {user.weight}</div>
            <div>Gender: {user.gender}</div>
            <div>Age: {user.age}</div>
          </div>
        </div>

        {/* Stats Section */}
        <div>
          <div className="mb-2 flex items-center space-x-2">
            <DocumentTextIcon className="h-4 w-4 text-red-600" />
            <span className="font-medium">Stats</span>
          </div>
          <div className="space-y-1 text-xs text-gray-600">
            <div>Duration: {sessionDetails.sessionStats.duration.secs}</div>
            <div>Board Sampling Rate: {sessionDetails.sessionStats.boardSamplingRate}</div>
          </div>
        </div>

        {/* File */}
        <div>
          <div className="mb-2 flex h-4 w-4">
            <img src={fileIcon} draggable={false} />
            <span className="text-xs">Name of file</span>
          </div>

          <div>
            <div className="text-xs text-gray-500">/location of file</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivitiesCard: React.FC<{ activities: Activity[] }> = ({ activities }) => {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const scrollToActivity = (index: number) => {
    const el = listRef.current?.querySelector(`[data-activityid="${activities[index].id}"]`);
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
    <div className="flex h-full flex-col p-(--space-sm)">
      <h2 className="text-2xl font-semibold text-neutral-900">Activities</h2>

      <ul ref={listRef} className="activities-list flex gap-8 overflow-hidden px-[calc(50%-65px)] py-[2.5vh]">
        {activities.map((activity, i) => {
          const active = i === selected;
          return (
            <li
              key={activity.id}
              data-activityid={activity.id}
              onClick={() => handleSelectActivity(i)}
              className={`flex aspect-square w-[50px] flex-shrink-0 cursor-pointer snap-center flex-col items-center justify-between rounded-lg bg-[var(--light)] p-4 opacity-45 shadow transition-all hover:bg-[#e9eef5] hover:shadow-lg ${active ? "z-10 scale-115 border-2 border-[var(--primary)] bg-[#e0eafc] font-bold opacity-100 shadow-lg" : ""} `}
            >
              <div className="flex h-[80%] items-center justify-center">
                <img
                  src={getActivityAssetFullPath(activity.id, activity.staticImage)}
                  alt=""
                  draggable={false}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className={`mt-2 h-[30%] text-xs font-semibold ${active ? "text-neutral-900" : "text-neutral-500"}`}>
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
        nearbyThreshold={1}
        className={"mt-3"}
      />

      <div className="flex justify-end">
        <ToolkitButton to="/activities" variant={"grey"}>
          {" "}
          Go to Activities →
        </ToolkitButton>
      </div>
    </div>
  );
};

// Connection Card
const ConnectionCard: React.FC<{ devices?: Device[] }> = ({ devices }) => {
  const hasAnyDevices = !devices || devices.length === 0;
  const hasAnyConnectedDevices = devices && devices.some((device) => device.isConnected);

  return (
    <div className="flex h-full flex-col gap-5 p-(--space-sm)">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Connection</h2>
      </div>

      {hasAnyDevices ? (
        <>
          <div className="items-center">
            <p className="text-md font-semibold">There are no connected devices!</p>
            <p> Go to the devices page and scan for boards.</p>
          </div>

          <img className={"h-40 object-contain"} src={wbbIcon} />
        </>
      ) : hasAnyConnectedDevices ? (
        <div className="flex h-full flex-col p-(--space-sm)">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">A Board has been previously connected.Please turn on the Board!</h2>
          </div>
        </div>
      ) : (
        <>
          {/* Balance Board Illustration */}
          <div className="flex max-h-10 justify-center">
            <img src={userIcon} />
          </div>
        </>
      )}

      <div className="mt-auto flex justify-end">
        <ToolkitButton to="/devices" variant={"grey"}>
          {" "}
          Go to Devices →
        </ToolkitButton>
      </div>
    </div>
  );
};

// Help Support Card
const HelpSupportCard: React.FC = () => {
  return (
    <div className="flex h-full flex-col p-(--space-sm)">
      <div className="mb-4 flex items-center space-x-2">
        <div className="rounded-full bg-red-600 p-1 text-white">
          <QuestionMarkCircleIcon className="h-4 w-4" />
        </div>
        <h2 className="text-xl font-semibold">Help and Support</h2>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-lg font-bold text-gray-500 italic">🚧 This section is under construction 🚧</span>
      </div>
    </div>
  );
};

// Documentation Card
const DocumentationCard: React.FC = () => {
  return (
    <div className="flex h-full flex-col p-(--space-sm)">
      <div className="mb-4 flex items-center space-x-2">
        <div className="rounded bg-red-600 p-1 text-white">
          <DocumentTextIcon className="h-4 w-4" />
        </div>
        <h2 className="text-xl font-semibold">Documentation</h2>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-lg font-bold text-gray-500 italic">🚧 This section is under construction 🚧</span>
      </div>
    </div>
  );
};

// Other Resources Card
const OtherResourcesCard: React.FC = () => {
  return (
    <div className="flex h-full flex-col p-(--space-sm)">
      <h2 className="mb-4 text-xl font-semibold">Other Resources</h2>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-lg font-bold text-gray-500 italic">🚧 This section is under construction 🚧</span>
      </div>
    </div>
  );
};

export default Home;
