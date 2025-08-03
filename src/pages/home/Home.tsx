// Home.tsx
import React from 'react';
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Left Column */}
          <div className="space-y-6">
            <LastSessionCard />
            <ActivitiesCard />
          </div>

          {/* Middle Column */}
          <div>
            <ConnectionCard />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <HelpSupportCard />
            <DocumentationCard />
            <OtherResourcesCard />
          </div>
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
    <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
      <h2 className="text-xl font-semibold mb-4">Last session</h2>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-4 h-4 bg-red-600 rounded-full"></div>
            <span className="font-medium">Username</span>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <div>Weight:</div>
            <div>Sex:</div>
            <div>Age:</div>
            <div>Handedness:</div>
          </div>
        </div>

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
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <DocumentIcon className="w-4 h-4 text-red-600" />
          <div>
            <div className="text-sm font-medium">Name of file</div>
            <div className="text-xs text-gray-500">/location of file</div>
          </div>
          <div className="w-2 h-2 bg-red-600 rounded-full"></div>
        </div>

        <button
          className="bg-white border-2 border-red-600 text-red-600 px-6 py-2 rounded-full hover:bg-red-50"
          type="button"
        >
          Resume
        </button>
      </div>
    </div>
  );
};

// Activities Card
const ActivitiesCard: React.FC = () => {
  const activities: Activity[] = [
    { id: 1, name: "Activity name", icon: "🧍" },
    { id: 2, name: "Activity name", icon: "🏃" },
    { id: 3, name: "Activity name", icon: "🧍" }
  ];

  const handleActivityClick = (activityId: number): void => {
    console.log(`Activity ${activityId} clicked`);
  };

  return (
    <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
      <h2 className="text-xl font-semibold mb-4">Activities</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {activities.map((activity: Activity) => (
          <div
            key={activity.id}
            className="bg-gray-100 rounded-lg p-4 text-center hover:bg-gray-200 cursor-pointer"
            onClick={() => handleActivityClick(activity.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleActivityClick(activity.id);
              }
            }}
          >
            <div className="text-2xl mb-2">{activity.icon}</div>
            <div className="text-sm font-medium">{activity.name}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-center space-x-2 mb-4">
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
        <div className="w-2 h-2 bg-red-600 rounded-full"></div>
        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
      </div>

      <button
        className="bg-red-600 text-white px-6 py-2 rounded-full flex items-center space-x-2 hover:bg-red-600"
        type="button"
      >
        <span>Explore more</span>
        <ChevronRightIcon className="w-4 h-4" />
      </button>
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
    <div className="bg-white rounded-lg border-2 border-blue-200 p-6">
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
        <div className="relative">
          <div className="w-48 h-32 bg-gray-200 rounded-lg border-2 border-gray-300 relative">
            <div className="absolute inset-4 grid grid-cols-2 gap-2">
              <div className="bg-white rounded border border-gray-400"></div>
              <div className="bg-white rounded border border-gray-400"></div>
              <div className="bg-white rounded border border-gray-400"></div>
              <div className="bg-white rounded border border-gray-400"></div>
            </div>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-gray-300 rounded"></div>
          </div>
        </div>
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
    </div>
  );
};

// Help Support Card
const HelpSupportCard: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border-2 border-red-200 p-6">
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
    </div>
  );
};

// Documentation Card
const DocumentationCard: React.FC = () => {
  return (
    <div className="bg-white rounded-lg border-2 border-red-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <div className="bg-red-600 text-white rounded p-1">
          <DocumentTextIcon className="w-4 h-4" />
        </div>
        <h2 className="text-xl font-semibold">Documentation</h2>
      </div>

      <p className="text-xs text-gray-500 mb-4 font-mono">
        awfsdzivja['pkepnzjfdjaipjekwnd,'cjxoypkjm,'cdjn,'0
        fivzmshdQjcz0=A,'vkcznjh*dvxnzskrjdgmzdrjxsjalz
        loejls'[jfeojfeojstojfeosjojejojejejojejojfejxjxjslfejle
        sjflesjifoslrfejslfo
      </p>

      <button
        className="bg-red-600 text-white px-6 py-2 rounded-full flex items-center space-x-2 hover:bg-red-600"
        type="button"
      >
        <span>Read More</span>
        <ChevronRightIcon className="w-4 h-4" />
      </button>
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
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
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
    </div>
  );
};

export default Home;