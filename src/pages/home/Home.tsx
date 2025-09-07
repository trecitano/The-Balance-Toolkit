import React, { useRef, useState } from "react";
import logoLettering from "@/assets/logo/logo-lettering-white.svg";
import fileIcon from "@/assets/file-icon.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { Activity, Device, LastSessionInformation } from "@/types.ts";
import { getBlockImage } from "@/utils/activityImages.ts";
import CarouselIndicators from "@/components/CarouselIndicators.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import wbbIcon from "@/assets/wbb-top-white.svg";
import wbbIconBlue from "@/assets/wbb-top-blue.svg";
import PageSubtitle from "@/components/PageSubtitle.tsx";
import rippleIcon from "@/assets/ripple-icon.svg";

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
      <div className="flex gap-6 items-center grid grid-cols-3">
        {/* Left: Greeting */}
        <img className={"w-34"} src={logoLettering} draggable={false}  />

        {/* Center: Circle logo */}
        <h1 className="text-6xl italic leading-tight font-semibold text-center">Welcome!</h1>

        {/* Right: Links */}
        <div className="mt-auto flex flex-col items-end gap-3">
          <button className="inline-flex items-center gap-2 text-white/95 hover:text-white" type="button">
            <span className="text-base">Cite</span>
          </button>

          <button className="inline-flex items-center gap-2 text-white/95 hover:text-white" type="button">
            <span className="text-base">Source Code</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Last Session Card
const LastSessionCard: React.FC<{ sessionDetails?: LastSessionInformation }> = ({ sessionDetails }) => {
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

  const user = sessionDetails?.user;
  const activity = sessionDetails?.activity;

  return (
    <div className="flex h-full flex-col gap-5 p-(--space-sm)">
      <PageSubtitle>Last session</PageSubtitle>

      <div className="flex grid flex-1 grid-cols-2 grid-rows-2">
        <div>
          <span className="mb-2 flex text-base font-semibold">Stats</span>
          <div className="text-gray-700">
            <div>Duration: {sessionDetails.sessionStats.duration.secs} seconds</div>
            <div>Board Hz: {sessionDetails.sessionStats.boardSamplingRate.toFixed(2)}</div>
          </div>
        </div>

        <div>
          <span className="mb-2 flex text-base font-semibold">User</span>
          <div className="text-gray-700">
            <div>Name: {user.name}</div>
            {user.age && <div>Age: {user.age}</div>}
            {user.weight && (
              <div>
                Weight: {user.weight} {user.weightMetric}
              </div>
            )}
            {user.gender && <div>Gender: {user.gender}</div>}
          </div>
        </div>

        {activity ? (
          <div>
            <span className="mb-2 flex text-base font-semibold">Activity</span>
            <div className="text-gray-700">
              <div>{activity.title}</div>
              <div>Activity steps: {activity.timelineBlocks.length}</div>
              <div>Number of boards: {activity.boardsRequired} </div>
            </div>
          </div>
        ) : (
          <div>
            <span className="mb-2 flex text-base font-semibold">Activity</span>
            <div className="text-gray-700">
              <div>No Activity chosen</div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex">
          <img className="h-4 w-4" src={fileIcon} draggable={false} />
          <span className="flex text-base font-semibold">File</span>
        </div>

        <div>
          <div className="text-base text-gray-700">{sessionDetails.fileLocation}</div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <ToolkitButton to="/replay" color={"grey"}>
          {" "}
          Go to Replay →
        </ToolkitButton>
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
      <PageSubtitle>Activities</PageSubtitle>

      <div className="flex-1">
        <ul ref={listRef} className="activities-list flex gap-8 overflow-hidden px-[calc(50%-125px)] py-5">
          {activities.map((activity, i) => {
            const active = i === selected;
            return (
              <li
                key={activity.id}
                data-activityid={activity.id}
                onClick={() => handleSelectActivity(i)}
                className={`flex h-29 cursor-pointer snap-center flex-col items-center justify-between rounded-lg bg-(--light-accent) p-4 opacity-45 shadow transition-all hover:bg-[#e9eef5] hover:shadow-lg ${active ? "z-10 scale-115 bg-[#e0eafc] font-bold opacity-100 shadow-lg ring-1 ring-(--primary)" : ""} `}
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
        <ToolkitButton to="/activities" color={"grey"}>
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
  const numberConnectedDevices = devices?.filter((device) => device.isConnected).length ?? 0;

  return (
    <div className="flex h-full flex-col gap-5 p-(--space-sm)">
      <PageSubtitle>Connection</PageSubtitle>

      {hasAnyDevices ? (
        <>
          <div className="text-base">
            <p className="font-semibold">There are no connected devices!</p>
            <p> Go to the devices page to scan for boards.</p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <img className={"h-40 object-contain"} src={wbbIcon} />
          </div>
        </>
      ) : numberConnectedDevices === 0 ? (
        <>
          <div className="text-base">
            <p className="font-semibold">A Board has been previously connected.</p>
            <p> Please turn on the board!</p>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <img className={"h-40 object-contain"} src={wbbIcon} />
          </div>
        </>
      ) : (
        <>
          <div className="text-base">
            {numberConnectedDevices === 1 ? (
              <p className="font-semibold">There is one connected board!</p>
            ) : (
              <p className="font-semibold">There are {numberConnectedDevices} connected boards!</p>
            )}
            <p> Go to the Devices page to select them to start a session.</p>
          </div>

          <div className="relative flex flex-1 items-center justify-center">
            <img src={rippleIcon} className="absolute inset-0 h-full w-full opacity-10" />
            <img src={wbbIconBlue} className="z-10 h-4/5 w-4/5 object-contain" />
          </div>
        </>
      )}

      <div className="mt-auto flex justify-end">
        <ToolkitButton to="/devices" color={"grey"}>
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
        <PageSubtitle>Help and Support</PageSubtitle>
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
        <PageSubtitle>Documentation</PageSubtitle>
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
      <PageSubtitle>Other Resources</PageSubtitle>

      <div className="flex flex-1 items-center justify-center">
        <span className="text-lg font-bold text-gray-500 italic">🚧 This section is under construction 🚧</span>
      </div>
    </div>
  );
};

export default Home;
