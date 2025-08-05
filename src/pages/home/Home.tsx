import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ChevronRightIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  DocumentIcon,
  CodeBracketIcon,
  EnvelopeIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import balanceToolkitLogo from "@/assets/balance-icon.svg"
import fileIcon from "@/assets/file-icon.svg"
import userIcon from "@/assets/user-icon.svg";
import wbbIconLine from "@/assets/wbb-icon-line.svg";
import {Button} from "@/components/Button.tsx";
import activitiesConfig from "@/config/activities.config.ts";

interface StatusIndicator {
  value: string;
  label: string;
  color: 'green' | 'orange' | 'blue';
  icon: React.ComponentType<{ className?: string }>;
}

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="grid grid-flow-col grid-cols-3 grid-rows-3 gap-6 max-w-7xl mx-auto mt-6">
        {/* Left Column */}
        <div className="row-span-1 col-span-1 rounded-lg border-2 border-red-500 p-5">
          <LastSessionCard />
        </div>
        <div className="row-span-2 col-span-1 rounded-lg border-2 border-red-500 p-5">
          <ActivitiesCard />
        </div>

        {/* Middle Column */}
        <div className="row-span-3 rounded-lg border-2 border-red-500 p-5"> <ConnectionCard /> </div>

        {/* Right Column */}
        <div className="row-span-1 rounded-lg border-2 border-red-500 p-5"> <HelpSupportCard /> </div>
        <div className="row-span-1 rounded-lg border-2 border-red-500 p-5"> <DocumentationCard /> </div>
        <div className="row-span-1 rounded-lg border-2 border-red-500 p-5"> <OtherResourcesCard /> </div>
      </div>
    </div>
  );
};

// Header Component
const Header: React.FC = () => {
  return (
      <div className="bg-red-600 text-white mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-12 items-start gap-6">
          {/* Left: Greeting */}
          <div className="col-span-12 md:col-span-5">
            <h1 className="text-6xl font-bold leading-tight">Hello!</h1>
            <p className="mt-2 text-xl opacity-90">
              Welcome back to the balance tool kit
            </p>
          </div>

          {/* Center: Circle logo */}
          <div className="col-span-12 md:col-span-3 flex justify-center">
            <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-4 border-white">
              <div className="text-center leading-tight">
                <div className="text-lg font-bold">The</div>
                <div className="text-lg font-bold">Balance</div>
                <div className="w-16 h-16">
                  <img
                    src={balanceToolkitLogo}
                    draggable={false}
                  />
                </div>
                <div className="text-lg font-bold">Toolkit</div>
              </div>
            </div>
          </div>

          {/* Right: Links */}
          <div className="col-span-12 md:col-span-4 flex flex-col items-end gap-3">
            <button
              className="inline-flex items-center gap-2 text-white/95 hover:text-white"
              type="button"
            >
              <DocumentIcon className="h-5 w-5" />
              <span className="text-base">Cite</span>
              <ChevronRightIcon className="h-5 w-5" />
            </button>

            <button
              className="inline-flex items-center gap-2 text-white/95 hover:text-white"
              type="button"
            >
              <CodeBracketIcon className="h-5 w-5" />
              <span className="text-base">Source Code</span>
              <ChevronRightIcon className="h-5 w-5" />
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
      <h2 className="text-xl font-semibold mb-4">Last session</h2>

      <div className="flex justify-between">
        {/* User Section */}
        <div>
          <div className="flex">
            <div className="w-4 h-4">
              <img
                src={userIcon}
                draggable={false}
              />
            </div>
            <span className="font-medium">Username</span>
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <div>Weight:</div>
            <div>Sex:</div>
            <div>Age:</div>
            <div>Handedness:</div>
          </div>
        </div>

        {/* Stats Section */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <DocumentTextIcon className="w-4 h-4 text-red-600" />
            <span className="font-medium">Stats</span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Duration:</div>
            <div>Something else:</div>
            <div>Something else:</div>
          </div>
        </div>

        {/* File */}
        <div>
          <div className="flex w-4 h-4 mb-2">
            <img
              src={fileIcon}
              draggable={false}
            />
            <span className="text-xs">Name of file</span>
          </div>

          <div>
            <div className="text-xs text-gray-500">/location of file</div>
          </div>

          <Button variant="outline">Resume</Button>
        </div>
      </div>
    </>
  );
};

const ActivitiesCard: React.FC = () => {
  const [selected, setSelected] = useState(1); // start at second
  const scrollerRef = useRef<HTMLDivElement>(null);

  // derive a width array (active wider)
  const widths = useMemo(
    () =>
      activitiesConfig.map((_, i) => (i === selected ? 130 : 110)),
    [activitiesConfig, selected]
  );

  // compute cumulative X of each card's left edge
  const leftOffsets = useMemo(() => {
    const arr: number[] = [];
    let x = 0;
    for (let i = 0; i < widths.length; i++) {
      arr.push(x);
      x += widths[i] + 5;
    }
    return arr;
  }, [widths]);

  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + 5 * Math.max(0, widths.length - 1);

  const scrollToCenter = (index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const viewport = scroller.clientWidth;

    // target center position for the selected card
    const cardLeft = leftOffsets[index] ?? 0;
    const cardWidth = widths[index] ?? 80;
    const targetCenter = cardLeft + cardWidth / 2;

    const newScrollLeft = Math.max(
      0,
      Math.min(targetCenter - viewport / 2, totalWidth - viewport)
    );

    console.log("scroller position: ", scroller)
    console.log("Viewport: ", viewport);
    console.log("New scroll left: ", newScrollLeft);

    scroller.scrollTo({ left: newScrollLeft, behavior: "smooth" });
  };

  const onCardClick = (index: number) => {
    setSelected(index);
    scrollToCenter(index);
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-semibold text-neutral-900">Activities</h2>

      <div className="mt-4 flex items-center gap-4">
        <div
          ref={scrollerRef}
          className="relative w-full overflow-x-hidden overflow-y-hidden"
        >
          <div
            className="flex h-40 items-center gap-1"
            style={{ width: totalWidth }}
          >
            {activitiesConfig.map((s, i) => {
              const active = i === selected;

              const cardBase =
                "relative rounded-2xl border transition-all duration-600 " +
                "flex shrink-0 flex-col items-center justify-center text-center bg-[var(--bg-light)]";

              const cardSize = active
                ? `w-[130px] h-[130px] border-2 border-[var(--primary)] shadow-[0_6px_20px_rgba(0,0,0,0.12)]`
                : `w-[110px] h-[110px] border-neutral-200 opacity-70 hover:border-sky-700`;

              return (
                <button
                  key={String(s.id)}
                  onClick={() => onCardClick(i)}
                  className={`${cardBase} ${cardSize}`}
                  type="button"
                >
                  <div className="h-[70%]">
                    <img
                      src={s.staticImage}
                      alt=""
                      draggable={false}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div
                    className={`mt-2 font-semibold h-[30%] ${
                      active ? "text-base text-neutral-900" : "text-sm text-neutral-500"
                    }`}
                  >
                    {s.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {activitiesConfig.map((_, i) => {
          const active = i === selected;
          return (
            <button
              key={i}
              onClick={() => {
                setSelected(i);
                scrollToCenter(i);
              }}
              className={`h-3 w-3 rounded-full ${
                active ? "bg-red-600" : "bg-neutral-400"
              }`}
              type="button"
            />
          );
        })}
      </div>

      <div className="mt-auto">
        <Button rightIcon={<ChevronRightIcon className="h-4 w-4" />}>
          Explore More
        </Button>
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
      icon: SignalIcon
    },
    {
      value: "48%",
      label: "Battery",
      color: "orange",
      icon: SignalIcon
    },
    {
      value: "24 C",
      label: "Temp",
      color: "blue",
      icon: SignalIcon
    }
  ];

  const getStatusClasses = (color: 'green' | 'orange' | 'blue'): string => {
    switch (color) {
      case 'green':
        return 'bg-green-50 border-green-200 text-green-600';
      case 'orange':
        return 'bg-orange-50 border-orange-200 text-orange-600';
      case 'blue':
        return 'bg-blue-50 border-blue-200 text-blue-600';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-600';
    }
  };

  const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedDevice(event.target.value);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Connection</h2>
      </div>

      <div className="mb-10">
        <select
          className="w-full p-2 border border-gray-300 rounded-lg"
          value={selectedDevice}
          onChange={handleDeviceChange}
        >
          <option value="Andreia's WBB">Andreia's WBB</option>
          <option value="Device 2">Device 2</option>
          <option value="Device 3">Device 3</option>
        </select>
      </div>

      {/* Balance Board Illustration */}
      <div className="flex justify-center mb-6">
        <img
          src={wbbIconLine}
          alt="Balance Board"
          draggable={false}
        />
      </div>

      {/* Status Indicators */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {statusIndicators.map((indicator: StatusIndicator, index: number) => {
          const IconComponent = indicator.icon;
          return (
            <div
              key={index}
              className={`border rounded-lg p-3 text-center ${getStatusClasses(indicator.color)}`}
            >
              <IconComponent className="w-6 h-6 mx-auto mb-1" />
              <div className="text-sm font-semibold">{indicator.value}</div>
              <div className="text-xs">{indicator.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto">
        <Button rightIcon={<ChevronRightIcon className="w-4 h-4" />}>
          Manage
        </Button>
      </div>
    </div>
  );
};

// Help Support Card
const HelpSupportCard: React.FC = () => {
  return (
    <>
      <div className="flex items-center space-x-2 mb-4">
        <div className="bg-red-600 text-white rounded-full p-1">
          <QuestionMarkCircleIcon className="w-4 h-4" />
        </div>
        <h2 className="text-xl font-semibold">Help and Support</h2>
      </div>

      <p className="text-gray-600 mb-4">
        Go through a quick tutorial and see how you can make the most of The Balance Toolkit
      </p>

      <div className="mt-auto flex justify-end">
        <Button rightIcon={<ChevronRightIcon className="w-4 h-4" />}>
          Go to Tutorial
        </Button>
      </div>
    </>
  );
};

// Documentation Card
const DocumentationCard: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center space-x-2 mb-4">
        <div className="bg-red-600 text-white rounded p-1">
          <DocumentTextIcon className="w-4 h-4" />
        </div>
        <h2 className="text-xl font-semibold">Documentation</h2>
      </div>

      <div className="mt-auto flex justify-end">
        <Button rightIcon={<ChevronRightIcon className="w-4 h-4" />}>
          Read More
        </Button>
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
    console.log('Citation clicked');
  };

  const handleSourceCodeClick = (): void => {
    console.log('Source code clicked');
  };

  const handleContactClick = (): void => {
    console.log('Contact clicked');
  };

  const resourceLinks: ResourceLink[] = [
    {
      icon: DocumentIcon,
      text: "Read our citation",
      onClick: handleCitationClick
    },
    {
      icon: CodeBracketIcon,
      text: "View our source code",
      onClick: handleSourceCodeClick
    },
    {
      icon: EnvelopeIcon,
      text: "Contact us",
      onClick: handleContactClick
    }
  ];

  return (
    <>
      <h2 className="text-xl font-semibold mb-4">Other Resources</h2>

      <div className="space-y-3">
        {resourceLinks.map((link: ResourceLink, index: number) => {
          const IconComponent = link.icon;
          return (
            <button
              key={index}
              className="flex items-center space-x-3 text-gray-600 hover:text-gray-800 w-full text-left"
              onClick={link.onClick}
              type="button"
            >
              <IconComponent className="w-5 h-5" />
              <span>{link.text}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default Home;