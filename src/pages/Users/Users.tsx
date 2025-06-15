/**
 * @file User.tsx
 * @description User management page for the Balance Toolkit App.
 * Allows creating, editing, deleting, and viewing user profiles.
 * Each user has fields for ID, name, gender, age, height, handedness, weight, and color.
 * Includes UI for scrolling, editing, and selecting users.
 */

import React, { useState, useEffect, useRef } from "react";
import { UserType, defaultUser } from "../../types";
import "./Users.css";
import defaultUserIcon from "../../assets/user-icon.svg";
import editIcon from "../../assets/edit-icon.svg";
import deleteIcon from "../../assets/trash-icon.svg";
import plusIcon from "../../assets/plus-icon.svg";
import { v4 as uuidv4 } from "uuid";

interface UsersProps {
  allUsers: UserType[];
  setAllUsers: React.Dispatch<React.SetStateAction<UserType[]>>;
  currentSelectedUserId: string | null;
  setCurrentSelectedUserId: (userId: string | null) => void;
}

export default function Users({
  allUsers,
  setAllUsers,
  currentSelectedUserId,
  setCurrentSelectedUserId,
}: UsersProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingUserData, setEditingUserData] = useState<UserType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [topFadeOpacity, setTopFadeOpacity] = useState(0);
  const [bottomFadeOpacity, setBottomFadeOpacity] = useState(1);

  const userListRef = useRef<HTMLUListElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (userListRef.current && currentSelectedUserId) {
      const selectedUserElement = userListRef.current.querySelector(
        `[data-userid="${currentSelectedUserId}"]`
      ) as HTMLLIElement;
      if (selectedUserElement) {
        selectedUserElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [currentSelectedUserId, allUsers]);

  useEffect(() => {
    const listElement = userListRef.current;
    if (!listElement) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = listElement;
      const maxFadeScroll = 50; 

      const topOpacity = Math.min(scrollTop / maxFadeScroll, 1);
      setTopFadeOpacity(topOpacity);

      const scrollBottom = scrollHeight - clientHeight - scrollTop;
      const bottomOpacity = Math.max(0, Math.min(scrollBottom / maxFadeScroll, 1));
      setBottomFadeOpacity(bottomOpacity);
    };

    listElement.addEventListener("scroll", handleScroll);
    handleScroll(); 

    return () => {
      listElement.removeEventListener("scroll", handleScroll);
    };
  }, [allUsers]); 

  const handleSelectUser = (userId: string) => {
    if (editingIdx !== null) {
      console.log("Currently editing, selection change aborted or prompt user.");
      return;
    }
    setCurrentSelectedUserId(userId);
    setEditingIdx(null); 
    setEditingUserData(null);
  };

  const handleAddUser = () => {
    if (editingIdx !== null) {
      alert("Please save or cancel current edits before adding a new user.");
      return;
    }
    const newUser: UserType = {
      ...defaultUser,
      id: uuidv4(), 
      name: `New User ${allUsers.filter(u => u.name.startsWith("New User")).length + 1}`,
      createdOn: new Date().toISOString(),
      lastUpdatedOn: new Date().toISOString(),
      color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}` 
    };
    setAllUsers(prevUsers => [...prevUsers, newUser]);
    setCurrentSelectedUserId(newUser.id);
    const newIndex = allUsers.length; 
    setEditingIdx(newIndex);
    setEditingUserData({ ...newUser });
    if (formRef.current) formRef.current.reset();
  };

  const handleDeleteUser = (userIdToDelete: string) => {
    setAllUsers(prevUsers => prevUsers.filter(user => user.id !== userIdToDelete));
    if (currentSelectedUserId === userIdToDelete) {
      setCurrentSelectedUserId(allUsers.length > 1 ? allUsers.filter(u => u.id !== userIdToDelete)[0]?.id || null : null);
    }
    if (editingUserData?.id === userIdToDelete) {
      setEditingIdx(null);
      setEditingUserData(null);
    }
    setShowDeleteConfirm(null); 
  };

  const handleEditUser = (userId: string) => {
    const userToEdit = allUsers.find(user => user.id === userId);
    const userIndex = allUsers.findIndex(user => user.id === userId);
    if (userToEdit && userIndex !== -1) {
      setEditingUserData({ ...userToEdit });
      setEditingIdx(userIndex); 
      setCurrentSelectedUserId(userId); 
    }
  };

  const handleCancelEdit = () => {
    setEditingIdx(null);
    setEditingUserData(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    if (!editingUserData) return;
    const { name, value, type } = e.target;
    
    if (type === "checkbox") {
        const { checked } = e.target as HTMLInputElement;
        setEditingUserData(prev => prev ? { ...prev, [name]: checked } : null);
    } else {
        setEditingUserData(prev => prev ? { ...prev, [name]: value } : null);
    }
  };
  
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUserData || editingUserData.id === null) return; 

    const updatedUser = {
        ...editingUserData,
        lastUpdatedOn: new Date().toISOString(),
        submitted: true, 
    };

    setAllUsers(prevUsers =>
      prevUsers.map(user => (user.id === updatedUser.id ? updatedUser : user))
    );
    setCurrentSelectedUserId(updatedUser.id); 
    setEditingIdx(null);
    setEditingUserData(null);
  };

  const currentUserData = allUsers.find(user => user.id === currentSelectedUserId) || editingUserData || (allUsers.length > 0 ? allUsers[0] : null);
  const displayUser = editingUserData || currentUserData;


  return (
    <div className="users-page">
      {/* New Header Section */}
      <header className="users-page-header">
        <h1 className="page-title">Users</h1>
        <button onClick={handleAddUser} className="add-user-btn" aria-label="Add new user">
          Add New User
        </button>
      </header>

      {/* Main Content Wrapper */}
      <div className="users-main-content">
        <div className="users-list-panel">
          {/* The users-list-header div and its content (h2 "Profiles") are removed from here */}
          <div className="user-list-scroll-container"> {/* New wrapper for list and fades */}
            <div className="users-list-fade users-list-fade-top" style={{ opacity: topFadeOpacity }} />
            <ul className="users-list" ref={userListRef}>
              {allUsers.map(user => (
                <li
                  key={user.id}
                  data-userid={user.id}
                  className={`user-list-item ${currentSelectedUserId === user.id ? "selected" : ""} ${editingUserData?.id === user.id ? "editing" : ""}`}
                  onClick={() => handleSelectUser(user.id)}
                >
                  <img
                    src={defaultUserIcon} 
                    alt="User"
                    className="user-list-icon"
                    style={{ border: `2px solid ${user.color || '#ccc'}` }}
                  />
                  <span className="user-list-name">{user.name}</span>
                  {currentSelectedUserId === user.id && editingIdx === null && (
                     <button onClick={(e) => { e.stopPropagation(); handleEditUser(user.id);}} className="user-action-btn edit-btn" aria-label="Edit user">
                        <img src={editIcon} alt="Edit" />
                     </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="users-list-fade users-list-fade-bottom" style={{ opacity: bottomFadeOpacity }} />
          </div>
        </div>

        <div className="user-details-panel">
          {displayUser ? (
            <>
              {editingUserData ? (
                <form onSubmit={handleSubmit} className="user-form" ref={formRef}>
                  <h3>{editingUserData.id === defaultUser.id || !allUsers.find(u=>u.id === editingUserData.id)?.submitted ? "Create User" : "Edit User"}</h3>
                  {/* Form Fields */}
                  <div className="form-field">
                    <label htmlFor="name">Name:</label>
                    <input type="text" id="name" name="name" value={editingUserData.name} onChange={handleChange} required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="color">Color:</label>
                    <input type="color" id="color" name="color" value={editingUserData.color || '#397aac'} onChange={handleChange} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="age">Age:</label>
                    <input type="number" id="age" name="age" value={editingUserData.age} onChange={handleChange} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="gender">Gender:</label>
                    <select id="gender" name="gender" value={editingUserData.gender} onChange={handleChange}>
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Non-binary">Non-binary</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                  {editingUserData.gender === "Other" && (
                    <div className="form-field">
                      <label htmlFor="customGender">Specify Gender:</label>
                      <input type="text" id="customGender" name="customGender" value={editingUserData.customGender} onChange={handleChange} />
                    </div>
                  )}
                  <div className="form-field">
                    <label htmlFor="height">Height (cm):</label>
                    <input type="number" id="height" name="height" value={editingUserData.height} onChange={handleChange} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="weight">Weight:</label>
                    <input type="number" id="weight" name="weight" value={editingUserData.weight} onChange={handleChange} />
                    <select name="metric" value={editingUserData.metric} onChange={handleChange} className="metric-select">
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="handedness">Handedness:</label>
                    <select id="handedness" name="handedness" value={editingUserData.handedness} onChange={handleChange}>
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                      <option value="ambidextrous">Ambidextrous</option>
                    </select>
                  </div>
                  
                  <div className="form-actions">
                    <button type="submit" className="save-btn">Save</button>
                    <button type="button" onClick={handleCancelEdit} className="cancel-btn">Cancel</button>
                    {editingUserData.id !== defaultUser.id && allUsers.find(u=>u.id === editingUserData.id)?.submitted && (
                       <button type="button" onClick={() => setShowDeleteConfirm(editingUserData.id)} className="delete-btn-form">Delete User</button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="user-display">
                  <div className="user-display-header">
                      <img 
                          src={defaultUserIcon} 
                          alt="User" 
                          className="user-display-icon" 
                          style={{ borderColor: displayUser.color || '#ccc' }}
                      />
                      <h2>{displayUser.name}</h2>
                      <div className="user-display-actions">
                          <button onClick={() => handleEditUser(displayUser.id)} className="edit-btn-display" aria-label="Edit user">
                              <img src={editIcon} alt="Edit" /> Edit
                          </button>
                           <button onClick={() => setShowDeleteConfirm(displayUser.id)} className="delete-btn-display" aria-label="Delete user">
                              <img src={deleteIcon} alt="Delete" /> Delete
                          </button>
                      </div>
                  </div>
                  <div className="user-info-grid">
                      <p><strong>Age:</strong> {displayUser.age || "N/A"}</p>
                      <p><strong>Gender:</strong> {displayUser.gender === "Other" ? displayUser.customGender : displayUser.gender || "N/A"}</p>
                      <p><strong>Height:</strong> {displayUser.height ? `${displayUser.height} cm` : "N/A"}</p>
                      <p><strong>Weight:</strong> {displayUser.weight ? `${displayUser.weight} ${displayUser.metric}` : "N/A"}</p>
                      <p><strong>Handedness:</strong> {displayUser.handedness || "N/A"}</p>
                      <p><strong>User ID:</strong> {displayUser.id}</p>
                      <p><strong>Created:</strong> {new Date(displayUser.createdOn).toLocaleDateString()}</p>
                      <p><strong>Last Updated:</strong> {new Date(displayUser.lastUpdatedOn).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-user-selected">
              <p>No user selected or no users exist.</p>
              <p>Click 'Add User' to create a new profile.</p>
            </div>
          )}
        </div>
      </div> {/* End of users-main-content */}

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-dialog">
            <h4>Confirm Delete</h4>
            <p>Are you sure you want to delete user "{allUsers.find(u => u.id === showDeleteConfirm)?.name}"?</p>
            <div className="delete-confirm-actions">
              <button onClick={() => handleDeleteUser(showDeleteConfirm)} className="confirm-btn">Delete</button>
              <button onClick={() => setShowDeleteConfirm(null)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div> 
  );
}