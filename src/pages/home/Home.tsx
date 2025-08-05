// Home.tsx
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ChevronRightIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  DocumentTextIcon,
  DocumentIcon,
  CodeBracketIcon,
  EnvelopeIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import fileIcon from "@/assets/file-icon.svg"
import userIcon from "@/assets/user-icon.svg";
import wbbIconLine from "@/assets/wbb-icon-line.svg";
import wbbTopdown from "@/assets/wbb-topdown.svg";

// Types
interface Activity {
  id: number;
  name: string;
  icon: string;
}

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
      <div className="p-6">
        <div className="grid grid-flow-col grid-cols-4 grid-rows-3 gap-6 max-w-7xl mx-auto">
          {/* Left Column */}
          <div className="row-span-1 col-span-2 rounded-lg border-2 border-red-500 p-6">
            <LastSessionCard />
          </div>
          <div className="row-span-2 col-span-2 rounded-lg border-2 border-red-500 p-6">
            <ActivitiesCard />
          </div>

          {/* Middle Column */}
          <div className="row-span-3 rounded-lg border-2 border-red-500 p-6"> <ConnectionCard /> </div>

          {/* Right Column */}
          <div className="row-span-1 rounded-lg border-2 border-red-500 p-6"> <HelpSupportCard /> </div>
          <div className="row-span-1 rounded-lg border-2 border-red-500 p-6"> <DocumentationCard /> </div>
          <div className="row-span-1 rounded-lg border-2 border-red-500 p-6"> <OtherResourcesCard /> </div>
        </div>
      </div>
    </div>
  );
};

// Header Component
const Header: React.FC = () => {
  return (
    <div className="bg-red-600 text-white">
      <div className="max-w-4xl flex justify-between pt-6 pl-6">
        <div>
          <h1 className="text-5xl font-bold mb-2">Hello!</h1>
          <p className="text-lg opacity-90">Welcome back to the balance tool kit</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="bg-white text-red-600 rounded-full p-4 flex flex-col items-center">
            <div className="text-sm font-semibold">The</div>
            <div className="text-sm font-semibold">Balance</div>
            <div className="text-2xl my-1">🏃‍♂️</div>
            <div className="text-sm font-semibold">Toolkit</div>
          </div>
        </div>

        <div className="space-x-2">
          <button
            className="text-white px-4 py-2 rounded-lg flex items-center space-x-1"
            type="button"
          >
            <DocumentIcon className="w-4 h-4" />
            <span>Cite</span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
          <button
            className="text-white px-4 py-2 rounded-lg flex items-center space-x-1"
            type="button"
          >
            <CodeBracketIcon className="w-4 h-4" />
            <span>Source Code</span>
            <ChevronRightIcon className="w-4 h-4" />
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

          <button
            className="bg-white border-2 border-red-600 text-red-600 px-6 py-2 rounded-full hover:bg-red-50"
            type="button"
          >
            Resume
          </button>
        </div>
      </div>
    </>
  );
};

type Slide = {
  id: string;
  imgSrc: string;
  label: string;
};

const allSlides: Slide[] = [
  { id: "1", imgSrc: "/img/a.png", label: "New User 1", date: "26/06/2025" },
  { id: "2", imgSrc: "/img/b.png", label: "New User 2", date: "26/06/2025" },
  { id: "3", imgSrc: "/img/c.png", label: "New User 3", date: "26/06/2025" },
  { id: "4", imgSrc: "/img/d.png", label: "New User 4", date: "26/06/2025" },
  { id: "5", imgSrc: "/img/e.png", label: "New User 5", date: "26/06/2025" },
  { id: "6", imgSrc: "/img/f.png", label: "New User 6", date: "26/06/2025" },
];

const VISIBLE = 3; // show exactly 3 at a time

// Activities Card
const ActivitiesCard: React.FC = () => {
  // start selected on the second activity (index 1)
  const [selected, setSelected] = useState(1);
  // window start index (which slice of 3 we render)
  const [start, setStart] = useState(0);

  const end = start + VISIBLE - 1;

  const windowSlides = useMemo(
    () => allSlides.slice(start, start + VISIBLE),
    [start]
  );

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  const canPrev = start > 0;
  const canNext = start + VISIBLE < allSlides.length;

  const shiftLeft = () => setStart((s) => clamp(s - 1, 0, allSlides.length - VISIBLE));
  const shiftRight = () =>
    setStart((s) => clamp(s + 1, 0, allSlides.length - VISIBLE));

  // Handle clicking a card:
  // - If clicking leftmost visible, shift left and select that card.
  // - If clicking rightmost visible, shift right and select that card.
  // - Otherwise just select.
  const onCardClick = (absoluteIndex: number) => {
    if (absoluteIndex === start && canPrev) {
      setSelected(absoluteIndex - 1 >= 0 ? absoluteIndex : absoluteIndex);
      shiftLeft();
      return;
    }
    if (absoluteIndex === end && canNext) {
      setSelected(absoluteIndex + 1 < allSlides.length ? absoluteIndex : absoluteIndex);
      shiftRight();
      return;
    }
    setSelected(absoluteIndex);
  };

  // Ensure selected stays inside the current window on init/edge cases
  if (selected < start) setStart(selected);
  if (selected > end) setStart(clamp(selected - (VISIBLE - 1), 0, allSlides.length - VISIBLE));

  return (
    <div className="w-full">
      <h2 className="text-2xl font-semibold text-neutral-900">Activities</h2>

      {/* Track: exactly 3 items shown */}
      <div className="mt-6 flex items-end justify-center gap-6">
        {/* Prev spacer/chevron (optional) */}
        <button
          onClick={shiftLeft}
          disabled={!canPrev}
          className={`h-10 w-10 rounded-full border border-neutral-200 text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ‹
        </button>

        {windowSlides.map((s, i) => {
          const absoluteIndex = start + i;
          const active = absoluteIndex === selected;

          const cardBase =
            "relative transition-all duration-200 rounded-2xl " +
            "bg-white border flex flex-col items-center justify-start";

          // Sizes match your pattern: center one looks bigger when active
          const cardSize = active
            ? "w-[360px] h-[260px] border-[#2a69ac] shadow-[0_6px_20px_rgba(0,0,0,0.12)]"
            : "w-[280px] h-[220px] border-neutral-200 opacity-70";

          return (
            <button
              key={s.id}
              onClick={() => onCardClick(absoluteIndex)}
              className={`${cardBase} ${cardSize} px-8 pt-6 pb-4 text-center hover:border-[#2a69ac]`}
            >
              {/* Selected pill */}
              {active && (
                <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white">
                  Selected
                </span>
              )}

              {/* Avatar circle */}
              <div
                className={`mt-4 grid place-items-center rounded-full border-4 ${
                  active ? "border-lime-400" : "border-indigo-300"
                }`}
                style={{ width: active ? 112 : 84, height: active ? 112 : 84 }}
              >
                <img
                  src={s.imgSrc}
                  alt=""
                  className={`${active ? "scale-100" : "scale-90"} transition`}
                />
              </div>

              {/* Name */}
              <div
                className={`mt-4 font-semibold ${
                  active ? "text-lg text-neutral-900" : "text-neutral-500"
                }`}
              >
                {s.label}
              </div>

              {/* Updated line */}
              <div className="mt-2 text-xs text-neutral-400">
                Updated
                <div className="mt-1">{s.date}</div>
              </div>
            </button>
          );
        })}

        {/* Next spacer/chevron (optional) */}
        <button
          onClick={shiftRight}
          disabled={!canNext}
          className={`h-10 w-10 rounded-full border border-neutral-200 text-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ›
        </button>
      </div>

      {/* Dots for pages (2 pages: 0..1 for 6 items with 3 visible) */}
      <div className="mt-4 flex justify-center gap-4">
        {Array.from({ length: Math.ceil(allSlides.length / VISIBLE) }).map(
          (_, page) => {
            const active = page === Math.floor(start / VISIBLE);
            return (
              <button
                key={page}
                onClick={() => setStart(page * VISIBLE)}
                className={`h-3 w-3 rounded-full ${
                  active ? "bg-red-600" : "bg-neutral-400"
                }`}
              />
            );
          }
        )}
      </div>
    </div>
  );
}

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
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Connection</h2>
        <button
          className="bg-red-600 text-white rounded-full p-2 hover:bg-red-600"
          type="button"
          aria-label="Add connection"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-4">
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

      <button
        className="w-full bg-red-600 text-white py-2 px-4 rounded-full flex items-center justify-center space-x-2 hover:bg-red-600"
        type="button"
      >
        <span>Manage</span>
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </>
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

      <button
        className="bg-red-600 text-white px-6 py-2 rounded-full flex items-center space-x-2 hover:bg-red-600"
        type="button"
      >
        <span>Go to Tutorial</span>
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </>
  );
};

// Documentation Card
const DocumentationCard: React.FC = () => {
  return (
    <>
      <div className="flex items-center space-x-2 mb-4">
        <div className="bg-red-600 text-white rounded p-1">
          <DocumentTextIcon className="w-4 h-4" />
        </div>
        <h2 className="text-xl font-semibold">Documentation</h2>
      </div>

      <p className="text-xs text-gray-500 mb-4 font-mono">

      </p>

      <button
        className="bg-red-600 text-white px-6 py-2 rounded-full flex items-center space-x-2 hover:bg-red-600"
        type="button"
      >
        <span>Read More</span>
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    </>
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