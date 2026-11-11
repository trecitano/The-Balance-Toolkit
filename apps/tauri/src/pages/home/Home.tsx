import { ReactNode, useRef, useState } from "react";
import clsx from "clsx";
import logoLettering from "@/assets/logo/logo-lettering-white.svg";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { useQuery } from "@tanstack/react-query";
import { ActivitiesQuery, DevicesQuery, LastSessionQuery } from "@/queries/toolkit";
import { QueryStatus } from "@/components/QueryStatus";
import { Activity } from "@/types.ts";
import { getBlockImage, showLogoInstead } from "@/utils/activityImages.ts";
import CarouselIndicators from "@/components/CarouselIndicators.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import PageSubtitle from "@/components/PageSubtitle.tsx";
import { activitiesIcon } from "@/assets/icons";
import ConnectionCard from "@/pages/home/ConnectionCard.tsx";
import LastSessionCard from "@/pages/home/LastSessionCard.tsx";
import { DocumentationCard, HelpSupportCard, OtherResourcesCard } from "@/pages/home/ResourceCards.tsx";
import ZoomToFill from "@/pages/home/ZoomToFill.tsx";

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
    // Fill the page so the cards share the remaining height and the bottom margin matches
    // the other pages instead of leaving a blank band under content-sized rows.
    <ZoomToFill className="page-fade-in flex h-full flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="mt-6 grid min-h-0 flex-1 grid-cols-3 grid-rows-6 gap-8">
        {/* Placed explicitly, column by column, so the order on screen doesn't depend on the order here. */}
        <ToolkitContainer className="col-start-1 row-span-3 row-start-1 min-h-0">
          <LastSessionCard sessionDetails={lastSessionDetails} />
        </ToolkitContainer>

        <ToolkitContainer className="col-start-1 row-span-3 row-start-4">
          <ActivitiesCard activities={activities} />
        </ToolkitContainer>

        <ToolkitContainer className="col-start-2 row-span-6 row-start-1">
          <ConnectionCard
            devices={devices}
            selected={devicesQuery.data?.selectedDevicesMacAddress ?? []}
            isScanning={devicesQuery.data?.isScanning ?? false}
          />
        </ToolkitContainer>

        <ToolkitContainer className="col-start-3 row-span-2 row-start-1 min-h-0" background={"bg-gray-100"}>
          <DocumentationCard />
        </ToolkitContainer>

        <ToolkitContainer className="col-start-3 row-span-2 row-start-3 min-h-0" background={"bg-gray-100"}>
          <OtherResourcesCard />
        </ToolkitContainer>

        <ToolkitContainer className="col-start-3 row-span-2 row-start-5 min-h-0" background={"bg-gray-100"}>
          <HelpSupportCard />
        </ToolkitContainer>
      </div>
    </ZoomToFill>
  );
}

function Header() {
  return (
    <div className="bg-(--red) px-6 py-6 text-white">
      <div className="grid grid-cols-3 items-center gap-6">
        <img alt="The Balance Toolkit" className={"w-34"} src={logoLettering} draggable={false} />

        <h1 className="text-center text-6xl leading-tight font-semibold italic">Welcome!</h1>
      </div>
    </div>
  );
}

function ActivitiesCard({ activities }: { activities: Activity[] }) {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const current = activities[selected];

  const handleSelectActivity = (index: number) => {
    setSelected(index);
    const activity = activities[index];
    if (!activity) return;
    listRef.current?.querySelector(`[data-activityid="${activity.id}"]`)?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  return (
    <div className="flex h-full min-h-66 flex-col gap-2 p-(--space-sm)">
      <div className="flex items-center justify-between gap-3">
        <PageSubtitle>Activities</PageSubtitle>
        <Chip>
          {activities.length} {activities.length === 1 ? "activity" : "activities"}
        </Chip>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {/* Activities can't be added in the app, so an empty list means the activities file was emptied. */}
        {activities.length === 0 && <p className="text-center text-sm text-gray-500">No activities found.</p>}
        <ul ref={listRef} className="mask-horizontal-fade flex gap-4 overflow-hidden px-[calc(50%-80px)] py-3">
          {activities.map((activity, i) => {
            const active = i === selected;
            return (
              <li key={activity.id} data-activityid={activity.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSelectActivity(i)}
                  className={clsx(
                    "flex w-40 cursor-pointer flex-col overflow-hidden rounded-xl bg-white text-left shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                    active ? "shadow-md ring-2 ring-(--primary)" : "opacity-55 ring-1 ring-black/5 hover:opacity-90",
                  )}
                >
                  <span className="flex h-20 items-center justify-center bg-(--bg-light) p-2">
                    <img
                      src={getBlockImage(activity.staticImage)}
                      onError={showLogoInstead}
                      alt=""
                      draggable={false}
                      className="max-h-full object-contain"
                    />
                  </span>
                  <span
                    title={activity.title}
                    className={clsx(
                      "truncate px-3 py-2 text-xs font-semibold",
                      active ? "text-gray-900" : "text-gray-500",
                    )}
                  >
                    {activity.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <CarouselIndicators
          entries={activities.map((activity) => activity.id)}
          selectedIndex={selected}
          onSelect={handleSelectActivity}
          nearbyThreshold={2}
          className={"mt-1"}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* One line whatever the activity, so switching activities never moves the carousel. */}
        <div className="flex min-w-0 flex-nowrap gap-1.5 overflow-hidden">
          {current && (
            <>
              <Chip>
                {current.boardsRequired} {current.boardsRequired === 1 ? "board" : "boards"}
              </Chip>
              <Chip>
                {current.timelineBlocks.length} {current.timelineBlocks.length === 1 ? "step" : "steps"}
              </Chip>
              {current.loops > 1 && <Chip title={`Repeats ${current.loops} times`}>×{current.loops}</Chip>}
            </>
          )}
        </div>
        <ToolkitButton
          to={`/activities${current ? `/${current.id}` : ""}`}
          color="grey"
          iconUrl={activitiesIcon}
          className="shrink-0"
        >
          {current ? "Open activity →" : "Activities →"}
        </ToolkitButton>
      </div>
    </div>
  );
}

function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="shrink-0 rounded-full bg-(--light) px-2.5 py-1 text-xs font-medium whitespace-nowrap text-gray-700"
    >
      {children}
    </span>
  );
}

export default Home;
