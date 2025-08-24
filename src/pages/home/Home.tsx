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
import wbbIconLine from "@/assets/wbb-icon-line.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { useQuery } from "@tanstack/react-query";
import { commands } from "@/utils/requests.ts";
import { Activity } from "@/types.ts";
import { getActivityAssetFullPath } from "@/utils/activityImages.ts";

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
      return { activities };
    },
  });

  if (isLoading) {
    return <div></div>;
  }

  if (error) {
    return <div></div>;
  }

  const activities = data?.activities ?? [];

  return (
    <div className="h-full px-20">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="mt-6 grid grid-flow-col grid-cols-3 grid-rows-3 gap-8">
        {/* Left Column */}
        <div className="col-span-1 row-span-1 rounded-lg border-2 border-red-500 bg-white p-5">
          <LastSessionCard />
        </div>
        <div className="col-span-1 row-span-2 rounded-lg border-2 border-red-500 bg-white p-5">
          <ActivitiesCard activities={activities} />
        </div>

        {/* Middle Column */}
        <div className="row-span-3 rounded-lg border-2 border-red-500 bg-white p-5">
          <ConnectionCard />{" "}
        </div>

        {/* Right Column */}
        <div className="row-span-1 rounded-lg border-2 border-red-500 bg-white p-5">
          <HelpSupportCard />{" "}
        </div>
        <div className="row-span-1 rounded-lg border-2 border-red-500 bg-white p-5">
          <DocumentationCard />{" "}
        </div>
        <div className="row-span-1 rounded-lg border-2 border-red-500 bg-white p-5">
          <OtherResourcesCard />{" "}
        </div>
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  return (
    <div className="bg-red-600 px-6 py-6 text-white">
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
const LastSessionCard: React.FC = () => {
  return (
    <>
      <h2 className="mb-4 text-xl font-semibold">Last session</h2>

      <div className="flex justify-between">
        {/* User Section */}
        <div>
          <div className="flex">
            <div className="h-4 w-4">
              <img src={userIcon} draggable={false} />
            </div>
            <span className="font-medium">Username</span>
          </div>

          <div className="space-y-1 text-xs text-gray-600">
            <div>Weight:</div>
            <div>Sex:</div>
            <div>Age:</div>
          </div>
        </div>

        {/* Stats Section */}
        <div>
          <div className="mb-2 flex items-center space-x-2">
            <DocumentTextIcon className="h-4 w-4 text-red-600" />
            <span className="font-medium">Stats</span>
          </div>
          <div className="space-y-1 text-xs text-gray-600">
            <div>Duration:</div>
            <div>Something else:</div>
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
    </>
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
    <div className="flex h-full flex-col">
      <h2 className="text-2xl font-semibold text-neutral-900">Activities</h2>

      <div className="mt-4">
        <ul ref={listRef} className="activities-list flex gap-8 overflow-hidden px-[calc(50%-65px)] py-[2.5vh]">
          {activities.map((activity, i) => {
            const active = i === selected;
            return (
              <li
                key={activity.id}
                data-activityid={activity.id}
                onClick={() => handleSelectActivity(i)}
                className={`flex aspect-square w-[120px] flex-shrink-0 cursor-pointer snap-center flex-col items-center justify-between rounded-lg bg-[var(--light)] p-4 opacity-45 shadow transition-all hover:bg-[#e9eef5] hover:shadow-lg ${active ? "z-10 scale-115 border-2 border-[var(--primary)] bg-[#e0eafc] font-bold opacity-100 shadow-lg" : ""} `}
              >
                <div className="flex h-[80%] items-center justify-center">
                  <img
                    src={getActivityAssetFullPath(activity.id, activity.staticImage)}
                    alt=""
                    draggable={false}
                    className="max-h-full max-w-full object-contain"
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
      </div>

      {/* Dot indicators */}
      <div className="mt-4 flex justify-center gap-2">
        {activities.map((_, i) => {
          const active = i === selected;
          return (
            <button
              key={i}
              onClick={() => handleSelectActivity(i)}
              className={`h-3 w-3 rounded-full ${active ? "bg-red-600" : "bg-neutral-400"}`}
              type="button"
            />
          );
        })}
      </div>

      <div className="mt-auto">
        <ToolkitButton to="/activities" variant={"grey"}>
          {" "}
          Go to Activities →
        </ToolkitButton>
      </div>
    </div>
  );
};

// Connection Card
const ConnectionCard: React.FC = () => {
  const [selectedDevice, setSelectedDevice] = React.useState<string>("Andreia's WBB");

  const statusIndicators: StatusIndicator[] = [
    {
      value: "Strong",
      label: "Signal",
      color: "green",
      icon: SignalIcon,
    },
    {
      value: "48%",
      label: "Battery",
      color: "orange",
      icon: SignalIcon,
    },
    {
      value: "24 C",
      label: "Temp",
      color: "blue",
      icon: SignalIcon,
    },
  ];

  const getStatusClasses = (color: "green" | "orange" | "blue"): string => {
    switch (color) {
      case "green":
        return "bg-green-50 border-green-200 text-green-600";
      case "orange":
        return "bg-orange-50 border-orange-200 text-orange-600";
      case "blue":
        return "bg-blue-50 border-blue-200 text-blue-600";
      default:
        return "bg-gray-50 border-gray-200 text-gray-600";
    }
  };

  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedDevice(event.target.value);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Connection</h2>
      </div>

      <div className="mb-10">
        <select
          className="w-full rounded-lg border border-gray-300 p-2"
          value={selectedDevice}
          onChange={handleDeviceChange}
        >
          <option value="Andreia's WBB">{`Andreia's WBB`}</option>
          <option value="Device 2">Device 2</option>
          <option value="Device 3">Device 3</option>
        </select>
      </div>

      {/* Balance Board Illustration */}
      <div className="mb-6 flex justify-center">
        <img src={wbbIconLine} alt="Balance Board" draggable={false} />
      </div>

      {/* Status Indicators */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {statusIndicators.map((indicator: StatusIndicator, index: number) => {
          const IconComponent = indicator.icon;
          return (
            <div key={index} className={`rounded-lg border p-3 text-center ${getStatusClasses(indicator.color)}`}>
              <IconComponent className="mx-auto mb-1 h-6 w-6" />
              <div className="text-sm font-semibold">{indicator.value}</div>
              <div className="text-xs">{indicator.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto ">
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
    <>
      <div className="mb-4 flex items-center space-x-2">
        <div className="rounded-full bg-red-600 p-1 text-white">
          <QuestionMarkCircleIcon className="h-4 w-4" />
        </div>
        <h2 className="text-xl font-semibold">Help and Support</h2>
      </div>

      <p className="mb-4 text-gray-600">
        Go through a quick tutorial and see how you can make the most of The Balance Toolkit
      </p>

      <div className="mt-auto flex justify-end">
        <ToolkitButton variant={"grey"}>Go to Tutorial →</ToolkitButton>
      </div>
    </>
  );
};

// Documentation Card
const DocumentationCard: React.FC = () => {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center space-x-2">
        <div className="rounded bg-red-600 p-1 text-white">
          <DocumentTextIcon className="h-4 w-4" />
        </div>
        <h2 className="text-xl font-semibold">Documentation</h2>
      </div>

      <div className="mt-auto flex justify-end">
        <ToolkitButton variant={"grey"}>Read More →</ToolkitButton>
      </div>
    </div>
  );
};

// Other Resources Card
const OtherResourcesCard: React.FC = () => {
  interface ResourceLink {
    icon: React.ComponentType<{ className?: string }>;
    text: string;
    onClick: () => void;
  }

  const handleCitationClick = (): void => {
    console.log("Citation clicked");
  };

  const handleSourceCodeClick = (): void => {
    console.log("Source code clicked");
  };

  const handleContactClick = (): void => {
    console.log("Contact clicked");
  };

  const resourceLinks: ResourceLink[] = [
    {
      icon: DocumentIcon,
      text: "Read our citation",
      onClick: handleCitationClick,
    },
    {
      icon: CodeBracketIcon,
      text: "View our source code",
      onClick: handleSourceCodeClick,
    },
    {
      icon: EnvelopeIcon,
      text: "Contact us",
      onClick: handleContactClick,
    },
  ];

  return (
    <>
      <h2 className="mb-4 text-xl font-semibold">Other Resources</h2>

      <div className="space-y-3">
        {resourceLinks.map((link: ResourceLink, index: number) => {
          const IconComponent = link.icon;
          return (
            <button
              key={index}
              className="flex w-full items-center space-x-3 text-left text-gray-600 hover:text-gray-800"
              onClick={link.onClick}
              type="button"
            >
              <IconComponent className="h-5 w-5" />
              <span>{link.text}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default Home;
