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
import Heading from "@/components/PageTitle.tsx";

const USERS_QUERY_KEY = ["users"];

export default function Users() {
  const [editingUserData, setEditingUserData] = useState<UserType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showColorDropdown, setShowColorDropdown] = useState<boolean>(false);

  const hasInitialScroll = useRef(false);
  const userListRef = useRef<HTMLUListElement>(null);
  const queryClient = useQueryClient();

  const fixedColors = ["#e55d82", "#409edb", "#e8bd00", "#894c2f", "#dd2020", "#2a2a2a", "#989898", "#9bbc0f"];

  const { data, isLoading, error } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const { users, selectedUser } = await commands.users.userPageInformation();
      return { users, selectedUser };
    },
  });

  const users = data?.users ?? [];
  const selectedUser = data?.selectedUser ?? "";
  const selectedUserData = users.find((user) => user.name === selectedUser)!;
  const isSearching = searchTerm.trim().length > 0;
  const sortedUsers = [...users].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  const searchResults = searchTerm.trim()
    ? users.filter((user) => user.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];
  const currentIndex = sortedUsers.findIndex((user) => user.name === selectedUser);

  // Resize user cards
  useEffect(() => {
    if (!userListRef.current) return;

    const adjustCardWidths = () => {
      const list = userListRef.current;
      if (!list) return;
      const items = list.querySelectorAll(".user-carousel-item");
      if (!items.length) return;

      const containerWidth = list.clientWidth;
      const gap = 16;
      const desiredCardCount = 5;
      const idealCardWidth = (containerWidth - gap * (desiredCardCount - 1)) / desiredCardCount;

      items.forEach((item) => {
        (item as HTMLElement).style.width = `${idealCardWidth}px`;
      });
    };

    const observer = new ResizeObserver(adjustCardWidths);
    observer.observe(userListRef.current);

    return () => observer.disconnect();
  }, []);

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
          await handleSelectUser(newSelectedUser.name);
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
        await handleSelectUser(newSelectedUser.name);
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

  const scrollToSelectedUser = (userId: string) => {
    if (!userListRef.current) return;

    const selectedUserElement = userListRef.current.querySelector(`[data-userid="${userId}"]`) as HTMLLIElement | null;

    if (selectedUserElement) {
      selectedUserElement.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "center",
      });
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectSearchResult = async (userName: string) => {
    await handleSelectUser(userName);
    setSearchTerm("");
  };

  const handleSelectUser = async (userName: string) => {
    if (editingUserData && editingUserData.name != userName) {
      if (window.confirm("You have unsaved changes. Discard changes and select a different user?")) {
        setEditingUserData(null);
      } else {
        return;
      }
    }

    await commands.users.selectUser(userName);
    queryClient.setQueryData(USERS_QUERY_KEY, (oldData: UserPageInformation) => {
      if (!oldData) return oldData;

      return {
        ...oldData,
        selectedUser: userName,
      };
    });

    setEditingUserData(null);
    scrollToSelectedUser(userName);
  };

  const handleAddUser = async (usersArg: UserType[]) => {
    if (editingUserData !== null) {
      alert("Please save or cancel current edits before adding a new user.");
      return;
    }

    const newUser: UserType = {
      name: createNewUniqueUsername(usersArg),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`,
      isDefault: false,
    };

    await commands.users.addUser(newUser);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

    setEditingUserData({ ...newUser });
    await handleSelectUser(newUser.name);
  };

  const createNewUniqueUsername = (usersArg: UserType[]) => {
    let baseNumber = usersArg.length;
    while (true) {
      const newUsername = `New User ${baseNumber}`;
      if (!usersArg.some((u) => u.name === newUsername)) {
        return newUsername;
      }
      baseNumber++;
    }
  };

  const handleDeleteUser = async (userIdToDelete: string) => {
    const nextSelectedUser = sortedUsers[currentIndex - 1];
    await commands.users.deleteUser(userIdToDelete);
    await commands.users.selectUser(nextSelectedUser.name);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

    setEditingUserData(null);
    setShowDeleteConfirm(null);
    scrollToSelectedUser(nextSelectedUser.name);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editingUserData) return;

    await commands.users.updateUser(editingUserData);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

    // Need to wait for the DOM to be updated
    setTimeout(() => {
      const newUsername = editingUserData.name;
      setEditingUserData(null);
      handleSelectUser(newUsername);
    }, 0);
  };

  const renderCarouselIndicators = () => {
    return (
      <div className="carousel-indicators">
        {sortedUsers.map((user, index) => {
          const distance = Math.abs(index - currentIndex);
          let className = "carousel-indicator-dot";

          if (user.name === selectedUser) {
            className += " active";
          } else if (distance <= 2) {
            className += " nearby";
          }

          return (
            <div key={user.name} className={className} onClick={() => handleSelectUser(user.name)} title={user.name} />
          );
        })}
      </div>
    );
  };

  const renderUserIcon = (user: UserType, extraClasses: string) => {
    return (
      <>
        <div
          className={`${extraClasses} mb-2 flex items-center justify-center rounded-full`}
          style={{ backgroundColor: user.color || "#ccc" }}
        >
          <PersonIcon className="h-[60%] w-[60%] text-white" />
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

  return (
    <>
      <header className="relative z-50 mb-6 flex justify-between">
        <Heading>Users</Heading>

        <div className="absolute left-1/2 mx-auto flex w-[25vw] shrink-0 grow-0 -translate-x-1/2 items-center">
          <span className="search-icon">
            <img src={searchIcon} alt="Search" />
          </span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={handleSearch}
          />
          {isSearching && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((user) => (
                <div key={user.name} className="search-result-item" onClick={() => handleSelectSearchResult(user.name)}>
                  <img
                    src={personIcon}
                    alt=""
                    className="search-result-icon"
                    style={{ border: `2px solid ${user.color || "#ccc"}` }}
                  />
                  <span className="search-result-name">{user.name}</span>
                  <span className="search-result-id">{user.name.substring(0, 8)}...</span>
                </div>
              ))}
            </div>
          )}
          {isSearching && searchResults.length === 0 && (
            <div className="search-results">
              <div className="search-no-results">No users found</div>
            </div>
          )}
        </div>

        <ToolkitButton type="button" variant="blue" onClick={() => handleAddUser(users)}>
          Add new user
        </ToolkitButton>
      </header>

      <div className="px-20">
        <ul
          className="users-list-panel flex min-h-80 gap-8 overflow-hidden px-[calc(50%-125px)] py-[3.5vh]"
          ref={userListRef}
        >
          {sortedUsers.map((user) => (
            <li
              key={user.name}
              data-userid={user.name}
              ref={(el) => {
                if (el && user.name === selectedUser && !hasInitialScroll.current) {
                  hasInitialScroll.current = true;
                  el.scrollIntoView({
                    behavior: "instant",
                    inline: "center",
                    block: "center",
                  });
                }
              }}
              className={`user-carousel-item ${selectedUser === user.name ? "selected" : ""} ${editingUserData?.name === user.name ? "editing" : ""} ${user.isDefault ? "default-user" : ""}`}
              onClick={() => handleSelectUser(user.name)}
            >
              <div className="user-selection-status">
                {selectedUser === user.name && (user.isDefault ? "Default" : "Selected")}
              </div>
              {renderUserIcon(user, "w-[5vw] h-[5vw]")}
              <span className="user-carousel-name">{user.name}</span>
              <span className="user-carousel-date">
                <span className="user-carousel-date-label">Updated</span>
                <span className="user-carousel-date-value">{new Date(user.updatedAt).toLocaleDateString()}</span>
              </span>
            </li>
          ))}
        </ul>
        {renderCarouselIndicators()}

        <div className="mt-20 h-full">
          {editingUserData ? (
            <form className="user-details-panel p-10" onSubmit={handleSubmit}>
              <div className="user-display">
                <div className="user-display-header">
                  {renderUserIcon(selectedUserData, "w-[3.5vw] h-[3.5vw]")}
                  <div className="user-header-info">
                    <h2>{selectedUserData.name}</h2>
                    <div className="user-metadata">
                      <span className="metadata-item">
                        <span className="metadata-label">Created:</span>
                        <span className="metadata-value">
                          {new Date(selectedUserData.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="metadata-item">
                        <span className="metadata-label">Updated:</span>
                        <span className="metadata-value">
                          {new Date(selectedUserData.updatedAt).toLocaleDateString()}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="user-display-actions">
                    <ToolkitButton type="submit" variant="blue">
                      Save
                    </ToolkitButton>

                    <ToolkitButton type="button" variant="grey" onClick={() => setEditingUserData(null)}>
                      Cancel
                    </ToolkitButton>

                    {!selectedUserData.isDefault && (
                      <ToolkitButton
                        type="button"
                        variant="red"
                        onClick={() => setShowDeleteConfirm(selectedUserData.name)}
                      >
                        Delete
                      </ToolkitButton>
                    )}
                  </div>
                </div>

                {/* Editable fields */}
                <div className="user-info-fields">
                  {/* Name */}
                  <SingleColumn requiredField label="Name:" icon={<img src={personIcon} />}>
                    <InputPrimitive
                      editable
                      required
                      value={editingUserData.name}
                      onChange={(e) => handleEditUpdate("name", e.target.value)}
                    />
                  </SingleColumn>

                  {/* Age */}
                  <SingleColumn label="Age:" icon={<img src={calendarIcon} />}>
                    <InputPrimitive
                      editable
                      type="number"
                      value={editingUserData.age}
                      onChange={(e) => handleEditUpdate("age", Number(e.target.value))}
                    />
                  </SingleColumn>

                  {/* Gender */}
                  <SingleColumn label="Gender:" icon={<img src={sexIcon} />}>
                    <SelectPrimitive
                      value={
                        ["Male", "Female", "Non-binary", "Prefer not to say"].includes(editingUserData.gender ?? "")
                          ? (editingUserData.gender ?? "")
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
                    />
                  </SingleColumn>

                  {/* Custom gender input if "Other" */}
                  {!["Male", "Female", "Non-binary", "Prefer not to say"].includes(
                    editingUserData.gender ?? "Male",
                  ) && (
                    <SingleColumn label="Specify Gender:" icon={<img src={sexIcon} alt="" />}>
                      <InputPrimitive
                        editable
                        value={editingUserData.gender ?? ""}
                        onChange={(e) => handleEditUpdate("gender", e.target.value)}
                      />
                    </SingleColumn>
                  )}

                  {/* Height */}
                  <SingleColumn label="Height:" icon={<img src={heightIcon} />}>
                    <div className="flex justify-between gap-3">
                      <InputPrimitive
                        editable
                        type="number"
                        value={editingUserData.height ?? ""}
                        onChange={(e) => {
                          handleEditUpdate("height", Number(e.target.value));
                          if (!editingUserData?.heightMetric) {
                            handleEditUpdate("heightMetric", "cm");
                          }
                        }}
                      />
                      <SelectPrimitive
                        value={editingUserData.heightMetric ?? "cm"}
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
                    <div className="flex justify-between gap-3">
                      <InputPrimitive
                        editable
                        required
                        type="number"
                        value={editingUserData.weight ?? ""}
                        onChange={(e) => {
                          handleEditUpdate("weight", Number(e.target.value));
                          if (!editingUserData?.heightMetric) {
                            handleEditUpdate("weightMetric", "kg");
                          }
                        }}
                      />
                      <SelectPrimitive
                        value={editingUserData.weightMetric ?? "kg"}
                        onChange={(v) => handleEditUpdate("weightMetric", v)}
                        options={[
                          { label: "kg", value: "kg" },
                          { label: "lb", value: "lb" },
                        ]}
                      />
                    </div>
                  </SingleColumn>

                  {/* Handedness */}
                  <SingleColumn label="Handedness:" icon={<img src={handIcon} />}>
                    <SelectPrimitive
                      value={editingUserData.handedness ?? ""}
                      onChange={(v) => handleEditUpdate("handedness", v as UserType["handedness"])}
                      options={[
                        { label: "Right", value: "Right" },
                        { label: "Left", value: "Left" },
                        { label: "Ambidextrous", value: "Ambidextrous" },
                      ]}
                    />
                  </SingleColumn>

                  {/* Color */}
                  <div className="form-field">
                    <label>
                      <img src={paletteIcon} alt="" className="info-grid-icon" />
                      Color:
                    </label>
                    <div className="color-picker-container">
                      <input
                        type="color"
                        id="color"
                        name="color"
                        value={editingUserData.color || "#397aac"}
                        onChange={(e) =>
                          setEditingUserData((prev) => ({
                            ...prev!,
                            color: e.target.value,
                          }))
                        }
                      />
                      <div
                        className="color-swatch-trigger"
                        onClick={handleColorClick}
                        style={{
                          backgroundColor: editingUserData.color || "#397aac",
                        }}
                      ></div>
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
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="user-details-panel p-10">
              <div className="user-display">
                <div className="user-display-header">
                  {renderUserIcon(selectedUserData, "w-[3.5vw] h-[3.5vw]")}
                  <div className="user-header-info">
                    <h2>{selectedUserData.name}</h2>
                    <div className="user-metadata">
                      <span className="metadata-item">
                        <span className="metadata-label">Created:</span>
                        <span className="metadata-value">
                          {new Date(selectedUserData.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                      <span className="metadata-item">
                        <span className="metadata-label">Updated:</span>
                        <span className="metadata-value">
                          {new Date(selectedUserData.updatedAt).toLocaleDateString()}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="user-display-actions">
                    <ToolkitButton type="button" variant="blue" onClick={() => setEditingUserData(selectedUserData)}>
                      Edit
                    </ToolkitButton>
                    {!selectedUserData.isDefault && (
                      <ToolkitButton
                        type="button"
                        variant="red"
                        onClick={() => setShowDeleteConfirm(selectedUserData.name)}
                      >
                        Delete
                      </ToolkitButton>
                    )}
                  </div>
                </div>

                <div className="user-info-fields">
                  {/* Name */}
                  <SingleColumn label="Name:" icon={<img src={personIcon} />}>
                    <InputPrimitive value={selectedUserData.name ?? "N/A"} />
                  </SingleColumn>

                  {/* Age */}
                  <SingleColumn label="Age:" icon={<img src={calendarIcon} />}>
                    <InputPrimitive value={selectedUserData.age ?? "N/A"} />
                  </SingleColumn>

                  {/* Gender */}
                  <SingleColumn label="Gender:" icon={<img src={sexIcon} />}>
                    <InputPrimitive value={selectedUserData.gender ?? "N/A"} />
                  </SingleColumn>

                  {/* Height */}
                  <SingleColumn label="Height:" icon={<img src={heightIcon} />}>
                    <InputPrimitive
                      value={
                        selectedUserData.height ? `${selectedUserData.height} ${selectedUserData.heightMetric}` : "N/A"
                      }
                    />
                  </SingleColumn>

                  {/* Weight */}
                  <SingleColumn label="Weight:" icon={<img src={weightIcon} />}>
                    <InputPrimitive
                      value={
                        selectedUserData.weight ? `${selectedUserData.weight} ${selectedUserData.weightMetric}` : "N/A"
                      }
                    />
                  </SingleColumn>

                  {/* Handedness */}
                  <SingleColumn label="Handedness:" icon={<img src={handIcon} />}>
                    <InputPrimitive value={selectedUserData.handedness ?? "N/A"} />
                  </SingleColumn>

                  {/* Color */}
                  <div className="form-field">
                    <label>
                      <img src={paletteIcon} alt="" className="info-grid-icon" />
                      Color:
                    </label>
                    <div className="color-display" style={{ backgroundColor: "white" }}>
                      <div
                        className="color-swatch"
                        style={{ backgroundColor: selectedUserData.color ?? "#ccc" }}
                        title={selectedUserData.color ?? "No color selected"}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-dialog">
            <h4>Confirm Delete</h4>
            <p>{`Are you sure you want to delete user "${users.find((u) => u.name === showDeleteConfirm)?.name}"?`}</p>

            <div className="delete-confirm-actions">
              <ToolkitButton type="button" variant="red" onClick={() => handleDeleteUser(showDeleteConfirm)}>
                Delete
              </ToolkitButton>

              <ToolkitButton type="button" variant="grey" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </ToolkitButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
