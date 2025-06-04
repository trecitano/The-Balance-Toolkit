/**
 * @file User.tsx
 * @description User management page for the Balance Toolkit App.
 * Allows creating, editing, deleting, and viewing user profiles.
 * Each user has fields for ID, name, gender, age, height, handedness, weight, and color.
 * Includes UI for scrolling, editing, and selecting users.
 */

import React, { useState, useRef, useEffect } from "react";
import "./User.css";
import wbbIcon from "../../assets/wbb-icon-line.svg";

/**
 * Represents a user profile.
 */
type UserType = {
  /** Unique identifier for the user */
  id: string;
  /** User's name */
  name: string;
  /** User's gender (from predefined options or "Other") */
  gender: string;
  /** Custom gender if "Other" is selected */
  customGender: string;
  /** User's age */
  age: string;
  /** User's height in centimeters */
  height: string;
  /** User's handedness ("left" or "right") */
  handedness: "left" | "right";
  /** User's weight */
  weight: string;
  /** Weight metric ("kg" or "lb") */
  metric: "kg" | "lb";
  /** Whether the user has submitted their profile */
  submitted: boolean;
  /** ISO string of when the user was created */
  createdOn: string;
  /** ISO string of when the user was last updated */
  lastUpdatedOn: string;
  /** Display color for the user card */
  color: string;
};

/**
 * Generates a random weight.
 * @param kg - If true, returns weight in kg; otherwise, in lb.
 * @returns Random weight as a number.
 */
function getRandomWeight(kg = true) {
  const value = Math.floor(Math.random() * 21) + 50;
  return kg ? value : Math.round(value * 2.20462);
}

/** Default user object template */
const defaultUser: UserType = {
  id: "000",
  name: "",
  gender: "",
  customGender: "",
  age: "",
  height: "",
  handedness: "right",
  weight: "",
  metric: "kg",
  submitted: false,
  createdOn: new Date().toISOString(),
  lastUpdatedOn: new Date().toISOString(),
  color: "#397aac",
};

/** List of gender options for the dropdown */
const genderOptions = [
  "Female",
  "Male",
  "Non-binary",
  "Transgender",
  "Intersex",
  "Prefer not to say",
  "Other",
];

/**
 * Represents the User page component.
 * This component allows users to manage user profiles, including creating,
 * editing, deleting, and viewing user details.
 * It displays a list of users in a scrollable container, with options to
 * edit user information such as ID, name, gender, age, height, handedness,
 * weight, and display color.
 *
 * @component
 * @returns {JSX.Element} The rendered User management page.
 */
export default function User() {
  const [users, setUsers] = useState<UserType[]>(
    [
      {
        id: "DefaultUser",
        name: "DefaultUser",
        gender: "",
        customGender: "",
        age: "",
        height: "",
        handedness: "right",
        weight: "70",
        metric: "kg",
        submitted: false,
        createdOn: new Date().toISOString(),
        lastUpdatedOn: new Date().toISOString(),
        color: "#397aac",
      },
      {
        id: "001",
        name: "Alice Johnson",
        gender: "Female",
        customGender: "",
        age: "28",
        height: "165",
        handedness: "right",
        weight: "65",
        metric: "kg",
        submitted: false,
        createdOn: "2024-05-20T09:15:00.000Z",
        lastUpdatedOn: "2024-05-20T09:15:00.000Z",
        color: "#397aac",
      },
      {
        id: "002",
        name: "Bob Smith",
        gender: "Male",
        customGender: "",
        age: "34",
        height: "180",
        handedness: "left",
        weight: "78",
        metric: "kg",
        submitted: false,
        createdOn: "2025-05-19T14:30:00.000Z",
        lastUpdatedOn: "2025-05-19T14:30:00.000Z",
        color: "#397aac",
      },
      {
        id: "003",
        name: "Charlie Davis",
        gender: "Non-binary",
        customGender: "",
        age: "22",
        height: "172",
        handedness: "right",
        weight: "70",
        metric: "kg",
        submitted: false,
        createdOn: "2025-05-18T11:45:00.000Z",
        lastUpdatedOn: "2025-05-18T11:45:00.000Z",
        color: "#397aac",
      },
      {
        id: "004",
        name: "Diana Wilson",
        gender: "Female",
        customGender: "",
        age: "31",
        height: "168",
        handedness: "right",
        weight: "62",
        metric: "kg",
        submitted: false,
        createdOn: "2025-05-17T16:20:00.000Z",
        lastUpdatedOn: "2025-05-17T16:20:00.000Z",
        color: "#397aac",
      },
      {
        id: "005",
        name: "Ethan Brown",
        gender: "Male",
        customGender: "",
        age: "26",
        height: "175",
        handedness: "left",
        weight: "73",
        metric: "kg",
        submitted: false,
        createdOn: "2025-05-16T08:10:00.000Z",
        lastUpdatedOn: "2025-05-16T08:10:00.000Z",
        color: "#397aac",
      },
    ]
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingUserData, setEditingUserData] = useState<UserType | null>(
    null
  );
  const [showWeightPopup, setShowWeightPopup] = useState(false);
  const [weightInputThick, setWeightInputThick] = useState(false);
  const [leftFadeOpacity, setLeftFadeOpacity] = useState(0);
  const [rightFadeOpacity, setRightFadeOpacity] = useState(0);
  const [headerField, setHeaderField] = useState<
    | "id"
    | "name"
    | "gender"
    | "age"
    | "height"
    | "handedness"
    | "weight"
  >("id");
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!listRef.current) return;

      const container = listRef.current.parentElement;
      if (!container) return;

      const scrollLeft = container.scrollLeft;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;

      const leftOpacity = scrollLeft > 0 ? Math.min(scrollLeft / 100, 1) : 0;
      setLeftFadeOpacity(leftOpacity);

      const rightOpacity =
        maxScrollLeft > 0 && scrollLeft < maxScrollLeft - 5 ? 1 : 0;
      setRightFadeOpacity(rightOpacity);
    };

    const container = document.querySelector(".user-scroll-container");
    if (container) {
      container.addEventListener("scroll", handleScroll);
      handleScroll();
      const timeoutId = setTimeout(handleScroll, 300);

      const handleResize = () => setTimeout(handleScroll, 100);
      window.addEventListener("resize", handleResize);

      return () => {
        container.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleResize);
        clearTimeout(timeoutId);
      };
    }
  }, [users.length]);

  /**
   * Handles changes to a user field during editing.
   * Updates the editingUserData state and manages special logic for the "id" field to ensure uniqueness.
   * @param field - The name of the field being changed.
   * @param value - The new value for the field.
   */
  const handleChange = (field: string, value: string) => {
    if (!editingUserData) return;

    let newEditingData = {
      ...editingUserData,
      [field]: value,
      lastUpdatedOn: new Date().toISOString(),
    };

    if (field === "id") {
      const userInput = value.trim();
      let newId = userInput;

      if (
        userInput === "" &&
        editingIdx !== null &&
        users[editingIdx]?.id === "DefaultUser"
      ) {
        return;
      }
      if (userInput === "") {
        newId = "";
      } else if (editingIdx !== null) {
        const originalUserIdBeforeEdit = users[editingIdx].id;
        const otherUserIds = users
          .filter((u, i) => i !== editingIdx)
          .map((usr) => usr.id);

        if (otherUserIds.includes(userInput)) {
          if (originalUserIdBeforeEdit.startsWith(userInput + "-")) {
            newId = userInput;
          } else {
            let n = 1;
            let newSuffixedId = `${userInput}-${n}`;
            while (
              otherUserIds.includes(newSuffixedId) ||
              newSuffixedId === originalUserIdBeforeEdit
            ) {
              n++;
              newSuffixedId = `${userInput}-${n}`;
            }
            newId = newSuffixedId;
          }
        }
      }
      newEditingData = { ...newEditingData, id: newId };
    }
    setEditingUserData(newEditingData);
  };

  /**
   * Handles changes to the weight metric (kg/lb) dropdown.
   * Converts the weight value accordingly and updates the editingUserData state.
   * @param e - The change event from the metric select element.
   */
  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!editingUserData) return;
    const newMetric = e.target.value;
    const currentWeight = editingUserData.weight;
    let newWeight = "";

    if (currentWeight !== "" && !isNaN(Number(currentWeight))) {
      newWeight =
        newMetric === "kg"
          ? Math.round(Number(currentWeight) / 2.20462).toString()
          : Math.round(Number(currentWeight) * 2.20462).toString();
    } else {
      newWeight = "";
    }

    setEditingUserData({
      ...editingUserData,
      metric: newMetric as "kg" | "lb",
      weight: newWeight,
      lastUpdatedOn: new Date().toISOString(),
    });
  };

  /**
   * Handles the random weight button click.
   * Shows a popup and sets a random weight after a delay.
   */
  const handleWeightButton = () => {
    if (!editingUserData) return;
    setShowWeightPopup(true);
    setTimeout(() => {
      setShowWeightPopup(false);
      setEditingUserData((currentEditingData) => {
        if (!currentEditingData) return null;
        return {
          ...currentEditingData,
          weight: getRandomWeight(currentEditingData.metric === "kg").toString(),
          lastUpdatedOn: new Date().toISOString(),
        };
      });
    }, 3000);
  };

  /**
   * Handles form submission for editing or creating a user.
   * Validates input, updates the users list, and manages UI state.
   * @param e - The form submission event.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserData || editingIdx === null) return;

    if (
      document.activeElement &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement.tagName !== "BUTTON"
    ) {
      document.activeElement.blur();
    }

    let finalUserData = { ...editingUserData };

    if (finalUserData.id.trim() === "" && finalUserData.id !== "DefaultUser") {
      const unknownIds = users
        .filter((u, i) => i !== editingIdx)
        .map((u) => u.id)
        .filter((id) => /^Unknown\d+$/.test(id));
      let n = 1;
      while (unknownIds.includes(`Unknown${n}`)) n++;
      finalUserData.id = `Unknown${n}`;
    } else if (finalUserData.id.trim() === "" && finalUserData.id === "DefaultUser") {
      finalUserData.id = "DefaultUser";
    }

    if ((!finalUserData.weight || isNaN(Number(finalUserData.weight))) && finalUserData.id !== "DefaultUser") {
      setWeightInputThick(true);
      setTimeout(() => {
        setWeightInputThick(false);
      }, 2000);
      return;
    }

    const originalIndex = editingIdx;

    setUsers((prevUsers) =>
      prevUsers.map((u, i) =>
        i === originalIndex
          ? { ...finalUserData, submitted: true, lastUpdatedOn: new Date().toISOString() }
          : u
      )
    );

    setEditingIdx(null);
    setEditingUserData(null);

    requestAnimationFrame(() => {
      const scrollContainer = listRef.current?.parentElement;
      if (scrollContainer && listRef.current) {
        const allRenderedCards = listRef.current.children;
        let submittedCardElement: HTMLElement | null = null;

        if (originalIndex === 0 && users[0]?.id === "DefaultUser") {
          if (allRenderedCards.length > 0) {
            submittedCardElement = allRenderedCards[0] as HTMLElement;
          }
        } else {
          const submittedUser = users.find(
            (u) => u.id === finalUserData.id && u.lastUpdatedOn === finalUserData.lastUpdatedOn
          );
          let visualIndex = -1;
          if (submittedUser) {
            const sortedUsersForRender = [
              users[0],
              ...users
                .slice(1)
                .sort(
                  (a, b) => new Date(b.lastUpdatedOn).getTime() - new Date(a.lastUpdatedOn).getTime()
                ),
            ];
            visualIndex = sortedUsersForRender.findIndex((u) => u === submittedUser);
          }

          if (visualIndex !== -1 && allRenderedCards.length > visualIndex) {
            submittedCardElement = allRenderedCards[visualIndex] as HTMLElement;
          } else if (allRenderedCards.length > 1 && originalIndex !== 0) {
            submittedCardElement = allRenderedCards[1] as HTMLElement;
          }
        }

        if (submittedCardElement) {
          const desiredOffsetFromLeft = 70;
          let targetScrollLeft = submittedCardElement.offsetLeft - desiredOffsetFromLeft;
          targetScrollLeft = Math.max(0, targetScrollLeft);
          targetScrollLeft = Math.min(targetScrollLeft, scrollContainer.scrollWidth - scrollContainer.clientWidth);

          scrollContainer.scrollTo({
            left: targetScrollLeft,
            behavior: "smooth",
          });
        }
      }
    });
  };

  /**
   * Starts editing the user at the given index.
   * @param idx - The index of the user to edit.
   */
  const handleStartEdit = (idx: number) => {
    setCurrentIdx(idx);
    setEditingIdx(idx);
    setEditingUserData({ ...users[idx], submitted: false });

    setUsers((currentUsers) =>
      currentUsers.map((u, i) => (i === idx ? { ...u, submitted: false } : u))
    );
  };

  /**
   * Puts the currently selected user into edit mode.
   */
  const handleEdit = () => {
    setEditingIdx(currentIdx);
    setUsers((users) =>
      users.map((u, i) => (i === currentIdx ? { ...u, submitted: false } : u))
    );
  };

  /**
   * Cancels editing and resets editing state.
   */
  const handleCancelEdit = () => {
    if (editingIdx !== null) {
      const originalUser = users[editingIdx];
      if (originalUser.createdOn !== originalUser.lastUpdatedOn) {
      }
    }
    setEditingIdx(null);
    setEditingUserData(null);
  };

  /**
   * Deletes the user at the given index, except for the DefaultUser.
   * @param idx - The index of the user to delete.
   */
  const handleDelete = (idx: number) => {
    setUsers((users) => {
      if (users[idx].id === "DefaultUser") return users;

      const newUsers = users.filter((_, i) => i !== idx);

      setEditingIdx(null);

      if (newUsers.length === 0) {
        setCurrentIdx(0);
      } else if (idx < currentIdx) {
        setCurrentIdx(currentIdx - 1);
      } else if (idx === currentIdx) {
        if (idx >= newUsers.length) {
          setCurrentIdx(newUsers.length - 1);
        } else {
          setCurrentIdx(idx);
        }
      }
      return newUsers;
    });
  };

  /**
   * Selects the user at the given index.
   * Cancels editing if another user is being edited.
   * @param idx - The index of the user to select.
   */
  const handleSelectUser = (idx: number) => {
    if (editingIdx !== null && editingIdx !== idx) {
      handleCancelEdit();
    }
    setCurrentIdx(idx);
  };

  /**
   * Adds a new user to the list and enters edit mode for the new user.
   */
  const handleAddUser = () => {
    const numericIds = users
      .filter((u) => u.id !== "DefaultUser" && /^\d+$/.test(u.id))
      .map((u) => parseInt(u.id));
    const maxId = numericIds.length > 0 ? Math.max(0, ...numericIds) : 0;

    let newIdBase = maxId + 1;
    let newId = String(newIdBase).padStart(3, "0");

    const allIds = users.map((u) => u.id);
    while (allIds.includes(newId)) {
      newIdBase++;
      newId = String(newIdBase).padStart(3, "0");
    }

    const currentTime = new Date().toISOString();

    const newUserObject: UserType = {
      ...defaultUser,
      id: newId,
      createdOn: currentTime,
      lastUpdatedOn: currentTime,
      submitted: false,
      name: "",
      gender: "",
      customGender: "",
      age: "",
      height: "",
      weight: "",
      color: defaultUser.color || "#397aac",
    };

    let newUserActualIndex = 1;
    setUsers((currentUsers) => {
      const defaultUserFromState = currentUsers[0];
      const otherUsers = currentUsers.slice(1);
      const updatedUsers = [defaultUserFromState, newUserObject, ...otherUsers];
      newUserActualIndex = updatedUsers.findIndex((u) => u === newUserObject);
      return updatedUsers;
    });

    setTimeout(() => {
      setCurrentIdx(newUserActualIndex);
      setEditingIdx(newUserActualIndex);
      setEditingUserData({ ...users[newUserActualIndex], submitted: false });

      requestAnimationFrame(() => {
        const scrollContainer = listRef.current?.parentElement;
        if (scrollContainer && listRef.current) {
          const allRenderedCards = listRef.current.children;
          if (allRenderedCards.length > 1) {
            const newUserCardElement = allRenderedCards[1] as HTMLElement;
            if (newUserCardElement) {
              const desiredOffsetFromLeft = 70;
              let targetScrollLeft = newUserCardElement.offsetLeft - desiredOffsetFromLeft;
              targetScrollLeft = Math.max(0, targetScrollLeft);
              targetScrollLeft = Math.min(
                targetScrollLeft,
                scrollContainer.scrollWidth - scrollContainer.clientWidth
              );

              scrollContainer.scrollTo({
                left: targetScrollLeft,
                behavior: "smooth",
              });
            }
          }
        }
      });
    }, 0);
  };

  useEffect(() => {
    const container = document.querySelector(".user-scroll-container");
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        container.scrollLeft += (e.deltaY + e.deltaX) * 2;
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingIdx !== null && editingUserData !== null) {
        const editingCard = document.querySelector(".user-container-editing");
        if (editingCard && !editingCard.contains(e.target as Node)) {
          const userBeingEdited = users[editingIdx];
          const isNewUser =
            userBeingEdited.createdOn === userBeingEdited.lastUpdatedOn &&
            !userBeingEdited.submitted;

          if (isNewUser && (!editingUserData.weight || editingUserData.weight.trim() === "")) {
            handleCancelEdit();
          } else {
            handleCancelEdit();
          }
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingIdx, editingUserData, users]);

  return (
    <div className="user-page">
      <div className="user-header">
        <span className="page-title">User</span>
        <button className="user-add-btn" onClick={handleAddUser}>
          +
        </button>
      </div>
      <div className="user-scroll-wrapper">
        <div
          className="user-list-fade-left"
          style={{ opacity: leftFadeOpacity, pointerEvents: "none" }}
        />
        <div className="user-scroll-container">
          <div className="user-list" ref={listRef}>
            {[
              users[0],
              ...users
                .slice(1)
                .sort(
                  (a, b) =>
                    new Date(b.lastUpdatedOn).getTime() -
                    new Date(a.lastUpdatedOn).getTime()
                ),
            ].map((userInMap, visualIdx) => {
              const realIdx =
                userInMap.id === "DefaultUser"
                  ? 0
                  : users.findIndex((originalUser) => originalUser === userInMap);

              const isActive = realIdx === currentIdx;
              const isEditingThisUser = realIdx === editingIdx;

              if (isEditingThisUser && editingUserData) {
                return (
                  <form
                    key={`${realIdx}-editing`}
                    className={`user-container user-container-editing user-container-active${
                      editingUserData.id === "DefaultUser"
                        ? " user-container-default-editing"
                        : ""
                    }`}
                    onSubmit={handleSubmit}
                    onClick={(e) => e.stopPropagation()}
                    style={{ minWidth: 220, maxWidth: 220, position: "relative" }}
                  >
                    <div
                      className="user-active-header"
                      style={{ background: editingUserData.color || "#397aac" }}
                    >
                      <div style={{ position: "relative" }}>
                        {editingUserData.id !== "DefaultUser" && (
                          <button
                            className="user-color-btn"
                            style={{ background: editingUserData.color || "#397aac" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowColorDropdown((open) => !open);
                            }}
                            aria-label="Change card color"
                            type="button"
                          />
                        )}
                        {showColorDropdown && editingUserData.id !== "DefaultUser" && (
                          <div className="user-color-dropdown">
                            {[
                              "#397aac",
                              "#ffa202",
                              "#F16751",
                              "#F49C75",
                              "#EFE4B0",
                              "#6DAC9E",
                              "#ecbeed",
                              "#8e99a8",
                              "#b7c59c",
                              "#b0d0d3",
                            ].map((color) => (
                              <button
                                key={color}
                                className="user-color-option"
                                style={{ background: color }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingUserData((prev) =>
                                    prev ? { ...prev, color: color } : null
                                  );
                                  setShowColorDropdown(false);
                                }}
                                aria-label={`Set color ${color}`}
                                type="button"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="user-summary-name">
                        {editingUserData.id || "000"}
                      </span>
                      <button
                        type="button"
                        className="user-cancel-btn"
                        onClick={handleCancelEdit}
                        style={{
                          position: "absolute",
                          top: "5px",
                          right: "5px",
                          background: "transparent",
                          border: "none",
                          color: "white",
                          fontSize: "1.2em",
                          cursor: "pointer",
                        }}
                        title="Cancel edit"
                      >
                        ×
                      </button>
                    </div>
                    <div className="user-inline-label-row">
                      <label htmlFor={`user-id-edit-${realIdx}`}>ID</label>
                      <input
                        id={`user-id-edit-${realIdx}`}
                        type="text"
                        value={editingUserData.id}
                        onChange={(e) => handleChange("id", e.target.value)}
                        placeholder="000"
                        disabled={editingUserData.id === "DefaultUser"}
                      />
                    </div>
                    <div className="user-inline-label-row">
                      <label htmlFor={`user-name-edit-${realIdx}`}>Name</label>
                      <input
                        id={`user-name-edit-${realIdx}`}
                        type="text"
                        value={editingUserData.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Name"
                        disabled={
                          editingUserData.id === "DefaultUser" &&
                          editingUserData.name === "DefaultUser"
                        }
                      />
                    </div>
                    <label>
                      Gender
                      <div style={{ display: "flex", flexDirection: "row", gap: 8 }}>
                        <select
                          value={editingUserData.gender}
                          onChange={(e) => handleChange("gender", e.target.value)}
                          className="user-gender-dropdown"
                          style={{
                            width:
                              editingUserData.gender === "Other"
                                ? "60px"
                                : "100px",
                            maxWidth:
                              editingUserData.gender === "Other"
                                ? "80px"
                                : "100px",
                            minWidth:
                              editingUserData.gender === "Other"
                                ? "60px"
                                : "100px",
                          }}
                          disabled={editingUserData.id === "DefaultUser"}
                        >
                          <option value="">Select gender</option>
                          {genderOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        {editingUserData.gender === "Other" && (
                          <input
                            type="text"
                            value={editingUserData.customGender}
                            onChange={(e) =>
                              handleChange("customGender", e.target.value)
                            }
                            placeholder="Enter gender"
                            className="user-gender-custom-input"
                            style={{ flex: "1 1 0" }}
                            disabled={editingUserData.id === "DefaultUser"}
                          />
                        )}
                      </div>
                    </label>
                    <div className="user-inline-label-row">
                      <label htmlFor={`user-age-edit-${realIdx}`}>Age</label>
                      <input
                        id={`user-age-edit-${realIdx}`}
                        type="number"
                        value={editingUserData.age}
                        onChange={(e) => handleChange("age", e.target.value)}
                        placeholder="Age"
                        min={0}
                        disabled={editingUserData.id === "DefaultUser"}
                      />
                    </div>
                    <div className="user-inline-label-row">
                      <label htmlFor={`user-height-edit-${realIdx}`}>Height</label>
                      <input
                        id={`user-height-edit-${realIdx}`}
                        type="number"
                        value={editingUserData.height || ""}
                        onChange={(e) => handleChange("height", e.target.value)}
                        placeholder="Height (cm)"
                        min={0}
                        disabled={editingUserData.id === "DefaultUser"}
                      />
                    </div>
                    <div className="user-inline-label-row">
                      <label style={{ minWidth: 70 }}>Handedness</label>
                      <div className="handedness-toggle">
                        <label>
                          <input
                            type="radio"
                            name={`handedness-edit-${realIdx}`}
                            value="left"
                            checked={editingUserData.handedness === "left"}
                            onChange={(e) => handleChange("handedness", e.target.value)}
                            disabled={editingUserData.id === "DefaultUser"}
                          />
                          Left
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`handedness-edit-${realIdx}`}
                            value="right"
                            checked={editingUserData.handedness === "right"}
                            onChange={(e) => handleChange("handedness", e.target.value)}
                            disabled={editingUserData.id === "DefaultUser"}
                          />
                          Right
                        </label>
                      </div>
                    </div>
                    <label className="user-label-inline">
                      <span>
                        Weight
                        {editingUserData.id !== "DefaultUser" && (
                          <span
                            className="user-weight-required"
                            style={{ marginLeft: 4 }}
                          >
                            *
                          </span>
                        )}
                      </span>
                      <div className="user-weight-row">
                        <input
                          type="number"
                          className={`user-weight-input${
                            weightInputThick && editingUserData.id !== "DefaultUser"
                              ? " user-weight-input-thick"
                              : ""
                          }`}
                          value={editingUserData.weight}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 3);
                            handleChange("weight", val);
                          }}
                          placeholder="Weight"
                          min={0}
                          max={999}
                          disabled={editingUserData.id === "DefaultUser"}
                        />
                        <select
                          className="user-metric-dropdown"
                          value={editingUserData.metric}
                          onChange={handleMetricChange}
                          disabled={editingUserData.id === "DefaultUser"}
                        >
                          <option value="kg">kg</option>
                          <option value="lb">lb</option>
                        </select>
                        <button
                          type="button"
                          className="device-action-btn user-weight-btn-circle"
                          onClick={handleWeightButton}
                          title="Get random weight"
                          disabled={editingUserData.id === "DefaultUser"}
                          style={{
                            width: 40,
                            height: 40,
                            padding: 0,
                            fontSize: "0.85em",
                            minWidth: 40,
                            minHeight: 40,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <img
                            src={wbbIcon}
                            alt="Help"
                            style={{ width: 30, height: 30 }}
                          />
                        </button>
                      </div>
                    </label>
                    <div style={{ display: "flex", width: "100%" }}>
                      <button
                        className="user-submit-btn"
                        type="submit"
                        style={{ width: "100%" }}
                      >
                        Submit
                      </button>
                    </div>
                  </form>
                );
              } else if (isActive) {
                return (
                  <div
                    key={realIdx}
                    className={`user-container user-container-active${
                      userInMap.submitted ? " user-container-submitted" : ""
                    }${userInMap.id === "DefaultUser" ? " user-container-default" : ""}`}
                    onClick={() =>
                      userInMap.id === "DefaultUser"
                        ? handleSelectUser(realIdx)
                        : handleStartEdit(realIdx)
                    }
                    style={{ position: "relative" }}
                  >
                    <div className="user-selected-label">SELECTED</div>
                    <div
                      className="user-summary-header"
                      style={{ background: userInMap.color || "#397aac" }}
                    >
                      <span className="user-summary-name">{userInMap.id || "000"}</span>
                      {userInMap.id !== "DefaultUser" && (
                        <button
                          className="user-summary-delete"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(realIdx);
                          }}
                          title="Remove user"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="user-summary">
                      <div>
                        <span className="summary-label" data-field="id">
                          ID:
                        </span>
                        <span className="summary-value">{userInMap.id}</span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="name">
                          Name:
                        </span>
                        <span className="summary-value">{userInMap.name || "-"}</span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="gender">
                          Gender:
                        </span>
                        <span className="summary-value">
                          {userInMap.gender === "Other"
                            ? userInMap.customGender || "Other"
                            : userInMap.gender || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="age">
                          Age:
                        </span>
                        <span className="summary-value">{userInMap.age || "-"}</span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="height">
                          Height:
                        </span>
                        <span className="summary-value">
                          {userInMap.height ? `${userInMap.height} cm` : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="hand">
                          Hand:
                        </span>
                        <span className="summary-value">{userInMap.handedness || "-"}</span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="weight">
                          Weight:
                        </span>
                        <span className="summary-value">
                          {userInMap.weight ? `${userInMap.weight} ${userInMap.metric}` : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="created">
                          Created:
                        </span>
                        <span className="summary-value">
                          {(() => {
                            const date = new Date(userInMap.createdOn);
                            const currentYear = new Date().getFullYear();
                            const isCurrentYear = date.getFullYear() === currentYear;

                            return date.toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              ...(isCurrentYear ? {} : { year: "numeric" }),
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            });
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="updated">
                          Updated:
                        </span>
                        <span className="summary-value">
                          {(() => {
                            const date = new Date(userInMap.lastUpdatedOn);
                            const currentYear = new Date().getFullYear();
                            const isCurrentYear = date.getFullYear() === currentYear;

                            return date.toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              ...(isCurrentYear ? {} : { year: "numeric" }),
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            });
                          })()}
                        </span>
                      </div>
                    </div>
                    {userInMap.id !== "DefaultUser" && (
                      <button
                        type="button"
                        className="user-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(realIdx);
                        }}
                        style={{ marginTop: "auto" }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                );
              } else {
                return (
                  <div
                    key={realIdx}
                    className={`user-container${
                      userInMap.submitted ? " user-container-submitted" : ""
                    }${userInMap.id === "DefaultUser" ? " user-container-default" : ""}`}
                    onClick={() => handleSelectUser(realIdx)}
                  >
                    <div
                      className="user-summary-header"
                      style={{ background: userInMap.color || "#397aac" }}
                    >
                      <span className="user-summary-name">
                        {userInMap.id || "000"}
                      </span>
                      {userInMap.id !== "DefaultUser" && (
                        <button
                          className="user-summary-delete"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(realIdx);
                          }}
                          title="Remove user"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="user-summary">
                      <div>
                        <span className="summary-label" data-field="id">
                          ID:
                        </span>
                        <span className="summary-value">{userInMap.id}</span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="name">
                          Name:
                        </span>
                        <span className="summary-value">{userInMap.name || "-"}</span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="gender">
                          Gender:
                        </span>
                        <span className="summary-value">
                          {userInMap.gender === "Other"
                            ? userInMap.customGender || "Other"
                            : userInMap.gender || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="age">
                          Age:
                        </span>
                        <span className="summary-value">{userInMap.age || "-"}</span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="height">
                          Height:
                        </span>
                        <span className="summary-value">
                          {userInMap.height ? `${userInMap.height} cm` : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="hand">
                          Hand:
                        </span>
                        <span className="summary-value">{userInMap.handedness || "-"}</span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="weight">
                          Weight:
                        </span>
                        <span className="summary-value">
                          {userInMap.weight ? `${userInMap.weight} ${userInMap.metric}` : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="created">
                          Created:
                        </span>
                        <span className="summary-value">
                          {(() => {
                            const date = new Date(userInMap.createdOn);
                            const currentYear = new Date().getFullYear();
                            const isCurrentYear = date.getFullYear() === currentYear;

                            return date.toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              ...(isCurrentYear ? {} : { year: "numeric" }),
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            });
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="summary-label" data-field="updated">
                          Updated:
                        </span>
                        <span className="summary-value">
                          {(() => {
                            const date = new Date(userInMap.lastUpdatedOn);
                            const currentYear = new Date().getFullYear();
                            const isCurrentYear = date.getFullYear() === currentYear;

                            return date.toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              ...(isCurrentYear ? {} : { year: "numeric" }),
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            });
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>
        <div
          className="user-list-fade-right"
          style={{ opacity: rightFadeOpacity, pointerEvents: "none" }}
        />
      </div>
      {showWeightPopup && (
        <div className="identify-popup-overlay">
          <div className="identify-popup" onClick={(e) => e.stopPropagation()}>
            <span className="spinner" />
            <p>Measuring weight...</p>
            <button
              className="popup-close-btn"
              type="button"
              onClick={() => setShowWeightPopup(false)}
              style={{ marginTop: 18 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}