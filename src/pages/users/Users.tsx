import React, { useState, useEffect, useRef } from "react";
import { UserPageInformation, UserType } from "@/types.ts";
import "./Users.css";
import PersonIcon from "@/assets/user-icon.svg?react";
import personIcon from "@/assets/user-icon.svg";
import paletteIcon from "@/assets/palette-icon.svg";
import calendarIcon from "@/assets/calendar-icon.svg";
import sexIcon from "@/assets/sex-icon.svg";
import heightIcon from "@/assets/measure-icon.svg";
import weightIcon from "@/assets/weight-icon.svg";
import handIcon from "@/assets/hand-icon.svg";
import searchIcon from "@/assets/search-icon.svg";
import { commands } from "@/utils/requests.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { SingleColumn } from "@/components/SingleColumn.tsx";
import { InputPrimitive } from "@/components/InputPrimitive.tsx";
import { SelectPrimitive } from "@/components/SelectPrimitive.tsx";
import PageTitle from "@/components/PageTitle.tsx";
import { Channel } from "@tauri-apps/api/core";
import CarouselIndicators from "@/components/CarouselIndicators.tsx";
import ToolkitContainer from "@/components/ToolkitContainer.tsx";
import { useAlert } from "@/hooks/useAlert.tsx";
import { useConfirm } from "@/hooks/useConfirm.tsx";
import clsx from "clsx";
import WeightMeasureModal from "@/pages/users/WeightMeasureModal.tsx";
import DeleteUserModal from "@/pages/users/DeleteUserModal.tsx";

const USERS_QUERY_KEY = ["users"];

export default function Users() {
  const [editingUserData, setEditingUserData] = useState<UserType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showColorDropdown, setShowColorDropdown] = useState<boolean>(false);

  // Weight Measuring
  const [liveWeight, setLiveWeight] = useState<number | null>(null);
  const [showWeightMeasure, setShowWeightMeasure] = useState<boolean>(false);
  const [selectedWeightMeasureDeviceMac, setSelectedWeightMeasureDeviceMac] = useState<number | null>(null);
  const weightChannelRef = useRef<Channel<number> | null>(null);
  const [isMeasuringWeight, setIsMeasuringWeight] = useState<boolean>(false);

  // Modals
  const { showAlert, AlertDialog } = useAlert();
  const { confirm: customConfirm, ConfirmDialog } = useConfirm();

  const hasInitialScroll = useRef(false);
  const userListRef = useRef<HTMLUListElement>(null);
  const fixedColors = ["#e55d82", "#409edb", "#e8bd00", "#894c2f", "#dd2020", "#2a2a2a", "#989898", "#9bbc0f"];

  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const { users, selectedUserId, sessionDevices } = await commands.users.userPageInformation();
      return { users, selectedUserId: selectedUserId, sessionDevices };
    },
  });

  const users = data?.users ?? [];
  const selectedUserId = data?.selectedUserId ?? 0;
  const sessionDevices = data?.sessionDevices ?? [];
  const selectedUserData = users.find((user) => user.id === selectedUserId)!;
  const isSearching = searchTerm.trim().length > 0;
  const sortedUsers = [...users].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  const searchResults = searchTerm.trim()
    ? users.filter((user) => user.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];
  const currentIndex = sortedUsers.findIndex((user) => user.id === selectedUserId);

  // Keyboard navigation setup
  useEffect(() => {
    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT");

      if (editingUserData || isInputFocused) {
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();

        if (sortedUsers.length <= 1) return;

        let newIndex;
        if (e.key === "ArrowLeft") {
          newIndex = currentIndex > 0 ? currentIndex - 1 : sortedUsers.length - 1;
        } else {
          newIndex = currentIndex < sortedUsers.length - 1 ? currentIndex + 1 : 0;
        }

        const newSelectedUser = sortedUsers[newIndex];
        if (newSelectedUser) {
          await handleSelectUser(newSelectedUser.id);
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [sortedUsers]);

  // Mouse wheel navigation setup
  useEffect(() => {
    const handleGlobalWheel = async (e: WheelEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT");

      if (editingUserData || isInputFocused) {
        return;
      }

      const target = e.target as Element;
      const isOverUserListPanel = target.closest(".users-list-panel");

      if (!isOverUserListPanel) {
        return;
      }

      if (sortedUsers.length <= 1) return;

      const delta = e.deltaY || e.deltaX;

      if (Math.abs(delta) < 10) return;

      e.preventDefault();

      let newIndex;
      if (delta < 0) {
        newIndex = currentIndex < sortedUsers.length - 1 ? currentIndex + 1 : 0;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : sortedUsers.length - 1;
      }

      const newSelectedUser = sortedUsers[newIndex];
      if (newSelectedUser) {
        await handleSelectUser(newSelectedUser.id);
      }
    };

    document.addEventListener("wheel", handleGlobalWheel, { passive: false });

    return () => {
      document.removeEventListener("wheel", handleGlobalWheel);
    };
  }, [sortedUsers]);

  if (isLoading) {
    return <div></div>;
  }

  if (error) {
    return <div></div>;
  }

  const scrollToSelectedUser = (userId: number) => {
    if (!userListRef.current) return;

    const selectedUserElement = userListRef.current.querySelector(`[data-userid="${userId}"]`) as HTMLLIElement | null;

    if (selectedUserElement) {
      selectedUserElement.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectSearchResult = async (userId: number) => {
    await handleSelectUser(userId);
    setSearchTerm("");
  };

  const handleSelectUser = async (userId: number) => {
    if (editingUserData && editingUserData.id !== userId) {
      const shouldContinue = await customConfirm({
        title: "Unsaved Changes",
        message: "You have unsaved changes. Discard changes and select a different user?",
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
        confirmColor: "red",
      });

      if (!shouldContinue) {
        return;
      }
      setEditingUserData(null);
    }

    await commands.users.selectUser(userId);
    queryClient.setQueryData(USERS_QUERY_KEY, (oldData: UserPageInformation) => {
      if (!oldData) return oldData;

      return {
        ...oldData,
        selectedUserId: userId,
      };
    });

    setEditingUserData(null);
    scrollToSelectedUser(userId);
  };

  const handleAddUser = async () => {
    if (editingUserData !== null) {
      showAlert({
        title: "Cannot Add User",
        message: "Please save or cancel current edits before adding a new user.",
      });
      return;
    }

    const newUser = await commands.users.createUser();
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

    await handleSelectUser(newUser.id);
    setEditingUserData({ ...newUser });
  };

  const handleDeleteUser = async (userIdToDelete: number) => {
    const nextSelectedUser = sortedUsers[currentIndex - 1];
    await commands.users.deleteUser(userIdToDelete);
    await commands.users.selectUser(nextSelectedUser.id);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

    setEditingUserData(null);
    setShowDeleteConfirm(null);
    scrollToSelectedUser(nextSelectedUser.id);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editingUserData) return;

    await commands.users.updateUser(editingUserData);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

    // Need to wait for the DOM to be updated
    setTimeout(() => {
      const newUserId = editingUserData.id;
      setEditingUserData(null);
      handleSelectUser(newUserId);
    }, 0);
  };

  const renderUserIcon = (user: UserType, extraClasses: string) => {
    return (
      <>
        <div
          className={`${extraClasses} mb-2 flex items-center justify-center rounded-full`}
          style={{ backgroundColor: user.color || "#ccc" }}
        >
          <PersonIcon className="h-6/10 w-6/10 text-white" />
        </div>
      </>
    );
  };

  const handleColorClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      setShowColorDropdown((prev) => !prev);
    }
  };

  const selectFixedColor = (color: string) => {
    if (!editingUserData) return;
    setEditingUserData((prev) => (prev ? { ...prev, color } : null));
    setShowColorDropdown(false);
  };

  const handleEditUpdate = <K extends keyof UserType>(field: K, value: UserType[K]) => {
    setEditingUserData((prev) => prev && { ...prev, [field]: value });
  };

  const startWeightMeasurement = async (deviceMac: number | null) => {
    if (weightChannelRef.current) return;
    if (!deviceMac) return;

    const ch = new Channel<number>();
    ch.onmessage = (value) => {
      // value is a weight sent from Rust
      setLiveWeight(value);
    };
    weightChannelRef.current = ch;
    await commands.users.startMeasureWeight(ch, Number(deviceMac));
    setIsMeasuringWeight(true);
  };

  const stopWeightMeasurement = async () => {
    // This is a hack. Ideally, dropping the channel in the frontend should drop it in the backend.
    // Sadly, however, Tauri does not work like this (for now).
    await commands.session.stopSession();
    weightChannelRef.current = null;
    setIsMeasuringWeight(false);
  };

  return (
    <div className={"flex h-full flex-col justify-between gap-5"}>
      <header className="grid grid-cols-8">
        <PageTitle>Users</PageTitle>

        <ToolkitButton color="blue" onClick={handleAddUser}>
          Create user
        </ToolkitButton>

        <div className="relative z-10 col-span-2 col-start-4 items-center">
          <div className="absolute top-1/2 left-4 size-4 -translate-y-1/2 opacity-70">
            <img src={searchIcon} alt="Search" />
          </div>
          <input
            type="text"
            className="search-input w-full rounded-lg bg-white px-10 py-2 text-sm outline-0"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={handleSearch}
          />

          {isSearching && (
            <div className="absolute top-12 left-0 max-h-50 w-full overflow-auto rounded-lg bg-white">
              {searchResults.length === 0 ? (
                <div className="p-2 text-center text-gray-500 italic">No users found</div>
              ) : (
                <>
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex cursor-pointer items-center gap-2 border-b border-gray-300 px-3 py-2 hover:bg-[#f0f7ff]"
                      onClick={() => handleSelectSearchResult(user.id)}
                    >
                      {renderUserIcon(user, "size-6")}
                      <span className="font-semibold">{user.name}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className={"flex-1 flex flex-col"}>
        <div className={"flex-1 min-h-0"}>
          <ul className="carousel-list px-[calc(50vw-10rem)] h-7/10 pt-10 flex-1 flex gap-8 overflow-hidden" ref={userListRef}>
            {sortedUsers.map((user) => (
              <li
                key={user.id}
                data-userid={user.id}
                ref={(el) => {
                  if (el && user.id === selectedUserId && !hasInitialScroll.current) {
                    hasInitialScroll.current = true;
                    el.scrollIntoView({
                      behavior: "instant",
                      inline: "center",
                      block: "center",
                    });
                  }
                }}
                className={clsx(
                  "user-carousel-item min-h-40 aspect-[0.95] flex-1 flex flex-col items-center px-10 py-3 ",
                  selectedUserId === user.id && "selected",
                )}
                onClick={() => handleSelectUser(user.id)}
              >
                {selectedUserId === user.id && (
                  <div
                    className={clsx(
                      "user-selection-status mb-3 rounded-lg bg-(--primary) px-2 py-1 text-xs text-white",
                      user.isDefault && "default-user",
                    )}
                  >
                    {user.isDefault ? "Default" : "Selected"}
                  </div>
                )}
                {renderUserIcon(user, "h-3/10 aspect-[0.95]")}
                <span className="whitespace-nowrap">{user.name}</span>
                <div className={"mt-auto text-center text-xs text-gray-500"}>
                  <div>Updated</div>
                  <div>{new Date(user.updatedAt).toLocaleDateString()}</div>
                </div>
              </li>
            ))}
          </ul>
          <CarouselIndicators
            className={"mt-5"}
            entries={sortedUsers.map((user) => user.name)}
            selectedIndex={currentIndex}
            onSelect={async (index) => {
              const user = sortedUsers[index];
              await handleSelectUser(user.id);
            }}
          />
        </div>
      </div>

      <ToolkitContainer className="p-12">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-4 border-b border-gray-300 py-2">
            {renderUserIcon(selectedUserData, "size-10")}
            <div className="flex flex-col">
              <h2 className={"font-bold"}> {selectedUserData.name} </h2>
              <div className="flex gap-4 text-sm">
                <div>
                  <span>Created:</span>
                  <span className={"ml-1 font-semibold"}>
                    {" "}
                    {new Date(selectedUserData.createdAt).toLocaleDateString()}{" "}
                  </span>
                </div>
                <div>
                  <span>Updated: </span>
                  <span className={"ml-1 font-semibold"}>
                    {" "}
                    {new Date(selectedUserData.updatedAt).toLocaleDateString()}{" "}
                  </span>
                </div>
              </div>
            </div>

            <div className="ml-auto flex gap-2">
              {editingUserData ? (
                <>
                  <ToolkitButton type="submit" color="blue">
                    Save
                  </ToolkitButton>

                  {!selectedUserData.isDefault && (
                    <ToolkitButton type="button" color="red" onClick={() => setShowDeleteConfirm(selectedUserData.id)}>
                      Delete
                    </ToolkitButton>
                  )}

                  <ToolkitButton type="button" color="grey" onClick={() => setEditingUserData(null)}>
                    Cancel
                  </ToolkitButton>
                </>
              ) : (
                <>
                  {!selectedUserData.isDefault && (
                    <ToolkitButton type="button" color="red" onClick={() => setShowDeleteConfirm(selectedUserData.id)}>
                      Delete
                    </ToolkitButton>
                  )}
                  <ToolkitButton type="button" color="blue" onClick={() => setEditingUserData(selectedUserData)}>
                    Edit
                  </ToolkitButton>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 grid-rows-2 gap-2">
            {/* Name */}
            <SingleColumn requiredField label="Name:" icon={<img src={personIcon} />}>
              <InputPrimitive
                required
                value={editingUserData?.name}
                onChange={(e) => handleEditUpdate("name", e.target.value)}
                disabled={!editingUserData}
              />
            </SingleColumn>

            {/* Age */}
            <SingleColumn label="Age:" icon={<img src={calendarIcon} />}>
              <InputPrimitive
                type="number"
                value={editingUserData?.age}
                onChange={(e) => handleEditUpdate("age", Number(e.target.value))}
                disabled={!editingUserData}
              />
            </SingleColumn>

            {/* Gender */}
            <SingleColumn label="Gender:" icon={<img src={sexIcon} />}>
              <SelectPrimitive
                value={
                  ["Male", "Female", "Non-binary", "Prefer not to say"].includes(editingUserData?.gender ?? "")
                    ? (editingUserData?.gender ?? "")
                    : "N/A"
                }
                onChange={(v) => handleEditUpdate("gender", v === "Other" ? "" : v)}
                options={[
                  { label: "Male", value: "Male" },
                  { label: "Female", value: "Female" },
                  { label: "Non-binary", value: "Non-binary" },
                  { label: "Other", value: "Other" },
                  { label: "Prefer not to say", value: "Prefer not to say" },
                ]}
                disabled={!editingUserData}
              />
            </SingleColumn>

            {/* Custom gender input if "Other" */}
            {!["Male", "Female", "Non-binary", "Prefer not to say"].includes(editingUserData?.gender ?? "Male") && (
              <SingleColumn label="Specify Gender:" icon={<img src={sexIcon} alt="" />}>
                <InputPrimitive
                  value={editingUserData?.gender ?? ""}
                  onChange={(e) => handleEditUpdate("gender", e.target.value)}
                  disabled={!editingUserData}
                />
              </SingleColumn>
            )}

            {/* Height */}
            <SingleColumn label="Height:" icon={<img src={heightIcon} />}>
              <div className="flex gap-3">
                <InputPrimitive
                  type="number"
                  value={editingUserData?.height ?? ""}
                  onChange={(e) => {
                    handleEditUpdate("height", Number(e.target.value));
                    if (!editingUserData?.heightMetric) {
                      handleEditUpdate("heightMetric", "cm");
                    }
                  }}
                  disabled={!editingUserData}
                />
                <SelectPrimitive
                  value={editingUserData?.heightMetric ?? "cm"}
                  onChange={(v) => handleEditUpdate("heightMetric", v)}
                  options={[
                    { label: "cm", value: "cm" },
                    { label: "in", value: "in" },
                  ]}
                />
              </div>
            </SingleColumn>

            {/* Weight */}
            <SingleColumn requiredField label="Weight:" icon={<img src={weightIcon} />}>
              <div className="flex justify-between gap-1">
                <InputPrimitive
                  required
                  type="number"
                  className={"min-w-20"}
                  value={editingUserData?.weight ?? ""}
                  onChange={(e) => {
                    handleEditUpdate("weight", Number(e.target.value));
                    if (!editingUserData?.weightMetric) {
                      handleEditUpdate("weightMetric", "kg");
                    }
                  }}
                  disabled={!editingUserData}
                />
                <SelectPrimitive
                  value={editingUserData?.weightMetric ?? "kg"}
                  onChange={(v) => handleEditUpdate("weightMetric", v)}
                  options={[
                    { label: "kg", value: "kg" },
                    { label: "lb", value: "lb" },
                  ]}
                />
                <ToolkitButton size={"sm"} type="button" color={"blue"} onClick={() => setShowWeightMeasure(true)}>
                  Weight
                </ToolkitButton>
              </div>
            </SingleColumn>

            {/* Dominant hand: */}
            <SingleColumn label="Dominant hand:" icon={<img src={handIcon} />}>
              <SelectPrimitive
                value={editingUserData?.dominantHand ?? ""}
                onChange={(v) => handleEditUpdate("dominantHand", v as UserType["dominantHand"])}
                options={[
                  { label: "Right", value: "Right" },
                  { label: "Left", value: "Left" },
                  { label: "Ambidextrous", value: "Ambidextrous" },
                ]}
                disabled={!editingUserData}
              />
            </SingleColumn>

            {/* Color */}
            <SingleColumn label="Color:" icon={<img src={paletteIcon} />}>
              <div className="relative">
                <div
                  className="h-8 w-full cursor-pointer rounded-lg border border-gray-300"
                  style={{ backgroundColor: editingUserData?.color || "#ccc" }}
                  onClick={handleColorClick}
                />
                {showColorDropdown && (
                  <div className="recent-colors-dropdown">
                    <div className="recent-colors">
                      {fixedColors.map((color, index) => (
                        <div
                          key={index}
                          className="recent-color-swatch"
                          style={{ backgroundColor: color }}
                          onClick={() => selectFixedColor(color)}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SingleColumn>
          </div>
        </form>
      </ToolkitContainer>

      <DeleteUserModal
        open={!!showDeleteConfirm}
        userName={users.find((u) => u.id === showDeleteConfirm)?.name}
        onConfirm={() => handleDeleteUser(showDeleteConfirm!)}
        onCancel={() => setShowDeleteConfirm(null)}
      />

      <WeightMeasureModal
        open={showWeightMeasure}
        onClose={async () => {
          await stopWeightMeasurement();
          setShowWeightMeasure(false);
        }}
        liveWeight={liveWeight}
        weightMetric={
          editingUserData?.weightMetric ??
          selectedUserData?.weightMetric ??
          "kg"
        }
        sessionDevices={sessionDevices}
        selectedDeviceMac={selectedWeightMeasureDeviceMac}
        isMeasuring={isMeasuringWeight}
        onDeviceSelect={async (macAddress) => {
          setSelectedWeightMeasureDeviceMac(macAddress);
          await startWeightMeasurement(macAddress);
        }}
        onTare={() =>
          commands.devices.tareDevice(Number(selectedWeightMeasureDeviceMac))
        }
        onStart={async () =>
          startWeightMeasurement(selectedWeightMeasureDeviceMac)
        }
        onStop={stopWeightMeasurement}
        onSave={async () => {
          handleEditUpdate("weight", Number(liveWeight?.toFixed(2)));
          setShowWeightMeasure(false);
          await stopWeightMeasurement();
        }}
      />

      <AlertDialog />
      <ConfirmDialog />
    </div>
  );
}
