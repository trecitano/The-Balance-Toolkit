import React, {useState, useEffect, useRef, useMemo} from "react";
import { UserType } from "@/types.ts";
import "./Users.css";
import defaultUserIcon from "../../assets/user-icon.svg";
import editIcon from "../../assets/edit-icon.svg";
import deleteIcon from "../../assets/trash-icon.svg";
import personIcon from "../../assets/user-icon.svg";
import paletteIcon from "../../assets/palette-icon.svg";
import calendarIcon from "../../assets/calendar-icon.svg";
import sexIcon from "../../assets/sex-icon.svg";
import heightIcon from  "../../assets/measure-icon.svg";
import weightIcon from "../../assets/weight-icon.svg";
import handIcon from "../../assets/hand-icon.svg";
import searchIcon from "../../assets/search-icon.svg";
import { commands } from "@/utils/requests.ts";
import {useQuery, useQueryClient} from "@tanstack/react-query";

const USERS_QUERY_KEY = ["users"];

export default function Users() {
  const [editingUserData, setEditingUserData] = useState<UserType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [leftFadeOpacity, setLeftFadeOpacity] = useState(0);
  const [rightFadeOpacity, setRightFadeOpacity] = useState(1);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showColorDropdown, setShowColorDropdown] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLUListElement>(null);
  const isAutoScrolling = useRef<boolean>(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const fixedColors = [
    "#e55d82",
    "#409edb",
    "#e8bd00",
    "#894c2f",
    "#dd2020",
    "#2a2a2a",
    "#989898",
    "#9bbc0f",
  ];

  const { data, isLoading, error } = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: async () => {
      const { users, selectedUser } = await commands.users.userPageInformation();

      return {users, selectedUser};
    },
    initialData: { users: [], selectedUser: '' }
  });

  const users = data.users ?? [];
  const [selectedUser, setSelectedUser] = useState<string>(data.selectedUser);
  const isSearching = searchTerm.trim().length > 0;
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [users]);
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);
  const displayUser = useMemo(() => {
    if (editingUserData) return editingUserData;
    return users.find(user => user.name === selectedUser) || null;
  }, [editingUserData, users, selectedUser]);
  const currentIndex = useMemo(
    () => sortedUsers.findIndex(user => user.name === selectedUser),
    [sortedUsers, selectedUser]
  );


  useEffect(() => {
    const adjustCardWidths = () => {
      const list = userListRef.current;
      if (!list) return;

      const items = list.querySelectorAll(".user-carousel-item");
      if (items.length === 0) return;

      const containerWidth = list.clientWidth;
      const gap = 16;
      const desiredCardCount = 5;

      const idealCardWidth = (containerWidth - gap * (desiredCardCount - 1)) / desiredCardCount;

      items.forEach((item) => {
        (item as HTMLElement).style.width = `${idealCardWidth}px`;
      });

      items.forEach((item) => {
        const element = item as HTMLElement;
        if (element.classList.contains("selected")) {
          const scaleIncrease = 0.15;
          const extraSpace = (idealCardWidth * scaleIncrease) / 2;
          element.style.marginLeft = `${extraSpace}px`;
          element.style.marginRight = `${extraSpace}px`;
        } else {
          element.style.marginLeft = "";
          element.style.marginRight = "";
        }
      });
    };

    adjustCardWidths();
    window.addEventListener("resize", adjustCardWidths);

    return () => {
      window.removeEventListener("resize", adjustCardWidths);
    };
  }, [users.length, selectedUser]);

  const scrollToSelectedUser= (userId: string) => {
    requestAnimationFrame(() => {
      if (!userListRef.current || !selectedUser) return;
      const selectedUserElement = userListRef.current.querySelector(
        `[data-userid="${userId}"]`
      ) as HTMLLIElement;

      if (!selectedUserElement) return;

      setTimeout(() => {
        const listElement = userListRef.current;
        if (!listElement) return;

        const listRect: DOMRect = listElement.getBoundingClientRect();
        const elementRect: DOMRect = selectedUserElement.getBoundingClientRect();

        const listCenter: number = listRect.left + listRect.width / 2;
        const elementCenter: number = elementRect.left + elementRect.width / 2;
        const offset: number = elementCenter - listCenter;

        if (Math.abs(offset) > 2) {
          isAutoScrolling.current = true;

          const newScrollLeft: number = listElement.scrollLeft + offset;

          listElement.scrollTo({
            left: newScrollLeft,
            behavior: "smooth",
          });

          setTimeout(() => {
            isAutoScrolling.current = false;
          }, 600);
        }
      }, 50);
    });
  }

  useEffect(() => {
    const container = scrollContainerRef.current;
    const list = userListRef.current;

    if (!container || !list) return;

    const handleWheel = (e: WheelEvent) => {
      console.log("Handle wheeee");
      e.preventDefault();

      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;

      const items = list.querySelectorAll(".user-carousel-item");
      if (items.length === 0) return;

      const firstItem = items[0] as HTMLElement;
      const itemWidth = firstItem.offsetWidth;

      const scrollAmount = Math.sign(delta) * (itemWidth + 26);

      list.scrollBy({
        left: scrollAmount,
        behavior: "smooth",
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
    };
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectSearchResult = (userId: string) => {
    handleSelectUser(userId);
    setSearchTerm("");
  };

  const handleSelectUser = (userId: string) => {
    if (editingUserData) {
      if (window.confirm("You have unsaved changes. Discard changes and select a different user?")) {
        setEditingUserData(null);
      } else {
        return;
      }
    }

    setSelectedUser(userId);
    setEditingUserData(null);
    scrollToSelectedUser(userId);
  };

  const handleAddUser = async (usersArg: UserType[]) => {
    if (editingUserData !== null) {
      alert("Please save or cancel current edits before adding a new user.");
      return;
    }

    const newUser: UserType = {
      name: `New User ${usersArg.filter((u) => u.name.startsWith("New User")).length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
      isDefault: false,
    };

    await commands.users.addUser(newUser);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

    setSelectedUser(newUser.name);
    setEditingUserData({ ...newUser });
    scrollToSelectedUser(newUser.name);
  };

  const handleDeleteUser = async (userIdToDelete: string) => {
    await commands.users.deleteUser(userIdToDelete);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });

    if (selectedUser === userIdToDelete) {
      setSelectedUser(users[0].name)
    }
    if (editingUserData?.name === userIdToDelete) {
      setEditingUserData(null);
    }
    setShowDeleteConfirm(null);
    scrollToSelectedUser(users[0].name);
  };

  const handleEditUser = (userId: string) => {
    const userToEdit = users.find((user) => user.name === userId);
    const userIndex = users.findIndex((user) => user.name === userId);
    if (userToEdit && userIndex !== -1) {
      setEditingUserData({ ...userToEdit });
      setSelectedUser(selectedUser);
    }
  };

  const handleCancelEdit = () => {
    setEditingUserData(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    if (!editingUserData) return;
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const { checked } = e.target as HTMLInputElement;
      setEditingUserData((prev) => (prev ? { ...prev, [name]: checked } : null));
    } else if (type === "number") {
      const numValue = parseFloat(value);
      setEditingUserData((prev) => (prev ? { ...prev, [name]: numValue } : null));
    } else {
      setEditingUserData((prev) => (prev ? { ...prev, [name]: value } : null));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUserData || editingUserData.name === null) return;

    if (!editingUserData.weight) {
      const weightField = document.querySelector(".form-field.required-field");
      weightField?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    await commands.users.updateUser(editingUserData);
    await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });


    setSelectedUser(editingUserData.name)
    scrollToSelectedUser(editingUserData.name);
    setEditingUserData(null);
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
            <div
              key={user.name}
              className={className}
              onClick={() => handleSelectUser(user.name)}
              title={user.name}
            />
          );
        })}
      </div>
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

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingUserData) return;
    const { name, value } = e.target;

    setEditingUserData((prev) => (prev ? { ...prev, [name]: value } : null));

    setShowColorDropdown(false);
  };

  if (isLoading) {
    return <div></div>;
  }

  if (error) {
    return (
      <div>
      </div>
    );
  }

  return (
    <div className="inside-page">
      {}
      <header className="page-header">
        <h1 className="page-title">Users</h1>

        <div className="search-container">
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
                <div
                  key={user.name}
                  className="search-result-item"
                  onClick={() => handleSelectSearchResult(user.name)}
                >
                  <img
                    src={defaultUserIcon}
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

        <button
          onClick={() => handleAddUser(users)}
          className="btn btn--primary add-user-btn"
          aria-label="Add new user"
        >
          Add New User
        </button>
      </header>
      {}
      <div className="users-main-content">
        <div className="users-list-panel">
          <div className="user-carousel-scroll-container" ref={scrollContainerRef}>
            <div
              className="users-list-fade users-list-fade-left"
              style={{ opacity: leftFadeOpacity }}
            />
            <ul className="users-list" ref={userListRef}>
              {sortedUsers.map((user) => (
                <li
                  key={user.name}
                  data-userid={user.name}
                  className={`user-carousel-item ${selectedUser === user.name ? "selected" : ""} ${editingUserData?.name === user.name ? "editing" : ""} ${user.isDefault ? "default-user" : ""}`}
                  onClick={() => handleSelectUser(user.name)}
                >
                  <div className="user-selection-status">
                    {selectedUser === user.name &&
                      (user.isDefault ? "Default" : "Selected")}
                  </div>
                  <img
                    src={defaultUserIcon}
                    alt="User"
                    className="user-carousel-icon"
                    style={{ border: `3px solid ${user.color || "#ccc"}` }}
                  />
                  <span className="user-carousel-name">{user.name}</span>
                  <span className="user-carousel-date">
                    <span className="user-carousel-date-label">Updated</span>
                    <span className="user-carousel-date-value">
                      {new Date(user.updatedAt).toLocaleDateString()}
                    </span>
                  </span>
                  {selectedUser === user.name && editingUserData === null && (
                    <button
                      onClick={() => handleEditUser(user.name)}
                      className="user-action-btn btn--icon-only"
                      aria-label="Edit user"
                    >
                      <img src={editIcon} alt="Edit" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div
              className="users-list-fade users-list-fade-right"
              style={{ opacity: rightFadeOpacity }}
            />
          </div>
          {renderCarouselIndicators()}
        </div>

        <div className="user-details-panel">
          {displayUser ? (
            <div className="user-display">
              <div className="user-display-header">
                <img
                  src={defaultUserIcon}
                  alt="User"
                  className="user-display-icon"
                  style={{ borderColor: displayUser.color || "#ccc" }}
                />
                <div className="user-header-info">
                  <h2>{displayUser.name}</h2>
                  <div className="user-metadata">
                    <span className="metadata-item">
                      <span className="metadata-label">ID:</span>
                      <span className="metadata-value">{displayUser.name.substring(0, 10)}...</span>
                    </span>
                    <span className="metadata-item">
                      <span className="metadata-label">Created:</span>
                      <span className="metadata-value">
                        {new Date(displayUser.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span className="metadata-item">
                      <span className="metadata-label">Updated:</span>
                      <span className="metadata-value">
                        {new Date(displayUser.updatedAt).toLocaleDateString()}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="user-display-actions">
                  {editingUserData ? (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editingUserData?.weight) {
                            const weightField = document.querySelector(
                              ".form-field.required-field",
                            );
                            weightField?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            return;
                          }
                          handleSubmit(
                            new Event("submit") as unknown as React.FormEvent<HTMLFormElement>,
                          );
                        }}
                        className="btn btn--primary"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="btn btn--secondary"
                      >
                        Cancel
                      </button>
                      {!displayUser.isDefault && (
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(displayUser.name)}
                          className="btn btn--delete"
                        >
                          <img src={deleteIcon} alt="Delete" /> Delete
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditUser(displayUser.name)}
                        className="btn btn--primary"
                        aria-label="Edit user"
                      >
                        <img src={editIcon} alt="Edit" /> Edit
                      </button>
                      {!displayUser.isDefault && (
                        <button
                          onClick={() => setShowDeleteConfirm(displayUser.name)}
                          className="btn btn--delete"
                          aria-label="Delete user"
                        >
                          <img src={deleteIcon} alt="Delete" /> Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="user-info-fields">
                <div className="form-field">
                  <label>
                    <img src={personIcon} alt="" className="info-grid-icon" />
                    Name:
                  </label>
                  {editingUserData ? (
                    <input
                      type="text"
                      name="name"
                      value={editingUserData.name}
                      onChange={handleChange}
                      required
                    />
                  ) : (
                    <div className="display-value">{displayUser.name}</div>
                  )}
                </div>

                <div className="form-field">
                  <label>
                    <img src={calendarIcon} alt="" className="info-grid-icon" />
                    Age:
                  </label>
                  {editingUserData ? (
                    <input
                      type="number"
                      name="age"
                      value={editingUserData.age ?? ""}
                      onChange={handleChange}
                    />
                  ) : (
                    <div className="display-value">{displayUser.age || "N/A"}</div>
                  )}
                </div>

                <div className="form-field">
                  <label>
                    <img src={sexIcon} alt="" className="info-grid-icon" />
                    Gender:
                  </label>
                  {editingUserData ? (
                    <select name="gender" value={editingUserData.gender} onChange={handleChange}>
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  ) : (
                    <div className="display-value">
                      {displayUser.gender === "Other"
                        ? displayUser.customGender
                        : displayUser.gender || "N/A"}
                    </div>
                  )}
                </div>

                {editingUserData && editingUserData.gender === "Other" ? (
                  <div className="form-field">
                    <label>
                      <img src={sexIcon} alt="" className="info-grid-icon" />
                      Specify Gender:
                    </label>
                    <input
                      type="text"
                      name="customGender"
                      value={editingUserData.customGender}
                      onChange={handleChange}
                    />
                  </div>
                ) : (
                  <div className="form-field">
                    <label>
                      <img src={heightIcon} alt="" className="info-grid-icon" />
                      Height:
                    </label>
                    {editingUserData ? (
                      <div className="user-weight-row">
                        <input
                          type="number"
                          name="height"
                          value={editingUserData.height ?? ""}
                          onChange={handleChange}
                        />
                        <select
                          name="heightMetric"
                          value={editingUserData.heightMetric || "cm"}
                          onChange={handleChange}
                          className="metric-select"
                        >
                          <option value="cm">cm</option>
                          <option value="in">in</option>
                        </select>
                      </div>
                    ) : (
                      <div className="display-value">
                        {displayUser.height
                          ? `${displayUser.height} ${displayUser.heightMetric || "cm"}`
                          : "N/A"}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-field required-field">
                  <label>
                    <img src={weightIcon} alt="" className="info-grid-icon" />
                    Weight:
                  </label>
                  {editingUserData ? (
                    <>
                      <div className={`user-weight-row ${!editingUserData.weight ? "error" : ""}`}>
                        <input
                          type="number"
                          name="weight"
                          value={editingUserData.weight ?? ""}
                          onChange={handleChange}
                          required
                        />
                        <select
                          name="metric"
                          value={editingUserData.weightMetric}
                          onChange={handleChange}
                          className="metric-select"
                        >
                          <option value="kg">kg</option>
                          <option value="lb">lb</option>
                        </select>
                      </div>
                      {!editingUserData.weight && (
                        <div className="validation-error">Weight is required</div>
                      )}
                    </>
                  ) : (
                    <div className="display-value">
                      {displayUser.weight
                        ? `${displayUser.weight} ${displayUser.weightMetric}`
                        : "N/A"}
                    </div>
                  )}
                </div>

                <div className="form-field">
                  <label>
                    <img src={handIcon} alt="" className="info-grid-icon" />
                    Handedness:
                  </label>
                  {editingUserData ? (
                    <select
                      name="handedness"
                      value={editingUserData.handedness}
                      onChange={handleChange}
                    >
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                      <option value="ambidextrous">Ambidextrous</option>
                    </select>
                  ) : (
                    <div className="display-value">{displayUser.handedness || "N/A"}</div>
                  )}
                </div>

                <div className="form-field">
                  <label>
                    <img src={paletteIcon} alt="" className="info-grid-icon" />
                    Color:
                  </label>
                  {editingUserData ? (
                    <div className="color-picker-container" ref={colorPickerRef}>
                      <input
                        type="color"
                        id="color"
                        name="color"
                        value={editingUserData.color || "#397aac"}
                        onChange={handleColorChange}
                      />
                      <div
                        className="color-swatch-trigger"
                        onClick={(e) => handleColorClick(e)}
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
                  ) : (
                    <div className="color-display" style={{ backgroundColor: "white" }}>
                      <div
                        className="color-swatch"
                        style={{ backgroundColor: displayUser.color || "#ccc" }}
                        title={displayUser.color || "No color selected"}
                      ></div>
                    </div>
                  )}
                </div>

                {editingUserData && editingUserData.gender === "Other" && (
                  <div className="form-field">
                    <label>
                      <img src={heightIcon} alt="" className="info-grid-icon" />
                      Height:
                    </label>
                    <input
                      type="number"
                      name="height"
                      value={editingUserData.height}
                      onChange={handleChange}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="no-user-selected">
              <p>No user selected or no users exist.</p>
              <p>Click 'Add User' to create a new profile.</p>
            </div>
          )}
        </div>
      </div>{" "}
      {}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-dialog">
            <h4>Confirm Delete</h4>
            <p>
              Are you sure you want to delete user "
              {users.find((u) => u.name === showDeleteConfirm)?.name}"?
            </p>

            {users.find((u) => u.name === showDeleteConfirm && u.isDefault) && (
              <p className="default-user-warning">Default User cannot be deleted!</p>
            )}

            <div className="delete-confirm-actions">
              <button
                onClick={() => handleDeleteUser(showDeleteConfirm)}
                className="btn btn--delete btn--medium"
                disabled={
                  users.find((u) => u.name === showDeleteConfirm && u.isDefault) !== undefined
                }
              >
                <span className="btn__icon btn__icon--left">
                  <img src={deleteIcon} alt="" />
                </span>
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn btn--secondary btn--medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}