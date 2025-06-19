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


function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
}

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
  const [leftFadeOpacity, setLeftFadeOpacity] = useState(0);
  const [rightFadeOpacity, setRightFadeOpacity] = useState(1);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userListRef = useRef<HTMLUListElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isAutoScrolling = useRef<boolean>(false);

  

  useEffect(() => {
    const adjustCardWidths = () => {
      const list = userListRef.current;
      if (!list) return;
      
      const items = list.querySelectorAll('.user-carousel-item');
      if (items.length === 0) return;
      
      const containerWidth = list.clientWidth;
      const gap = 16; 
      const desiredCardCount = 5; 
      
      
      const idealCardWidth = (containerWidth - (gap * (desiredCardCount - 1))) / desiredCardCount;
      
      
      items.forEach(item => {
        (item as HTMLElement).style.width = `${idealCardWidth}px`;
      });

      
      items.forEach(item => {
        const element = item as HTMLElement;
        if (element.classList.contains('selected')) {
          
          const scaleIncrease = 0.15; 
          const extraSpace = (idealCardWidth * scaleIncrease) / 2;
          element.style.marginLeft = `${extraSpace}px`;
          element.style.marginRight = `${extraSpace}px`;
        } else {
          element.style.marginLeft = '';
          element.style.marginRight = '';
        }
      });
    };
    
    adjustCardWidths();
    window.addEventListener('resize', adjustCardWidths);
    
    return () => {
      window.removeEventListener('resize', adjustCardWidths);
    };
  }, [allUsers.length, currentSelectedUserId]); 

  useEffect(() => {
    if (userListRef.current && currentSelectedUserId) {
      const selectedUserElement = userListRef.current.querySelector(
        `[data-userid="${currentSelectedUserId}"]`
      ) as HTMLLIElement;
      
      if (selectedUserElement) {
        const listBounds = userListRef.current.getBoundingClientRect();
        const elementBounds = selectedUserElement.getBoundingClientRect();
        const listCenter = listBounds.left + listBounds.width / 2;
        const elementCenter = elementBounds.left + elementBounds.width / 2;

        
        if (Math.abs(listCenter - elementCenter) > 1) {
          isAutoScrolling.current = true;
          selectedUserElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
          
          
          setTimeout(() => {
            isAutoScrolling.current = false;
          }, 500); 
        }
      }
    }
  }, [currentSelectedUserId, allUsers]);

  
  
  useEffect(() => {
    const container = scrollContainerRef.current;
    const list = userListRef.current;

    if (!container || !list) return;

    const handleWheel = (e: WheelEvent) => {
      
      e.preventDefault();
      
      
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      
      
      const items = list.querySelectorAll('.user-carousel-item');
      if (items.length === 0) return;
      
      const firstItem = items[0] as HTMLElement;
      const itemWidth = firstItem.offsetWidth;
      const containerWidth = list.clientWidth;
      
      
      const cardsPerView = Math.floor(containerWidth / itemWidth);
      
      
      
      const scrollAmount = Math.sign(delta) * (itemWidth + 26); 
      
      
      list.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    };

    
    container.addEventListener("wheel", handleWheel, { passive: false });
    
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
    };
  }, []); 

  
  useEffect(() => {
    const listElement = userListRef.current;
    if (!listElement) return;

    const stableSetCurrentUser = setCurrentSelectedUserId;

    const updateSelectionOnScroll = () => {
      
      
      if (isAutoScrolling.current) return;
    
      const viewportCenter = listElement.getBoundingClientRect().left + listElement.clientWidth / 2;
      let closestElementId: string | null = null;
      let minDistance = Infinity;

      Array.from(listElement.children).forEach(child => {
        const element = child as HTMLLIElement;
        if (!element.dataset.userid) return; 
        const elementBounds = element.getBoundingClientRect();
        const elementCenter = elementBounds.left + elementBounds.width / 2;
        const distance = Math.abs(viewportCenter - elementCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestElementId = element.dataset.userid || null;
        }
      });

      if (closestElementId && closestElementId !== currentSelectedUserId) {
        stableSetCurrentUser(closestElementId);
      }
    };

    const debouncedUpdate = debounce(updateSelectionOnScroll, 150);

    const handleScroll = () => {
      
      const { scrollLeft, scrollWidth, clientWidth } = listElement;
      const maxFadeScroll = 50;
      const leftOpacity = Math.min(scrollLeft / maxFadeScroll, 1);
      setLeftFadeOpacity(leftOpacity);
      const scrollRight = scrollWidth - clientWidth - scrollLeft;
      const rightOpacity = Math.max(0, Math.min(scrollRight / maxFadeScroll, 1));
      setRightFadeOpacity(rightOpacity);

      debouncedUpdate();
    };

    listElement.addEventListener("scroll", handleScroll);
    handleScroll(); 

    return () => {
      listElement.removeEventListener("scroll", handleScroll);
    };
  }, [allUsers, currentSelectedUserId, setCurrentSelectedUserId]);

  

  const handleSelectUser = (userId: string, event?: React.MouseEvent) => {
    if (editingIdx !== null) {
      
      if (window.confirm("You have unsaved changes. Discard changes and select a different user?")) {
        
        setEditingIdx(null);
        setEditingUserData(null);
      } else {
        
        return;
      }
    }
    
    
    if (event) {
      event.stopPropagation(); 
      setCurrentSelectedUserId(userId);
      
      const selectedElement = userListRef.current?.querySelector(
        `[data-userid="${userId}"]`
      ) as HTMLLIElement;
      
      if (selectedElement) {
        isAutoScrolling.current = true;
        selectedElement.scrollIntoView({ 
          behavior: "smooth", 
          block: "nearest", 
          inline: "center" 
        });
        
        
        setTimeout(() => {
          isAutoScrolling.current = false;
        }, 500); 
      }
    } else {
      setCurrentSelectedUserId(userId);
    }
    
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
      {}
      <header className="users-page-header">
        <h1 className="page-title">Users</h1>
        <button onClick={handleAddUser} className="add-user-btn" aria-label="Add new user">
          Add New User
        </button>
      </header>

      {}
      <div className="users-main-content">
        <div className="users-list-panel">
          <div className="user-carousel-scroll-container" ref={scrollContainerRef}>
            <div className="users-list-fade users-list-fade-left" style={{ opacity: leftFadeOpacity }} />
            <ul className="users-list" ref={userListRef}>
              {allUsers.map(user => (
                <li
                  key={user.id}
                  data-userid={user.id}
                  className={`user-carousel-item ${currentSelectedUserId === user.id ? "selected" : ""} ${editingUserData?.id === user.id ? "editing" : ""}`}
                  onClick={(e) => handleSelectUser(user.id, e)}
                >
                  <img
                    src={defaultUserIcon} 
                    alt="User"
                    className="user-carousel-icon"
                    style={{ border: `3px solid ${user.color || '#ccc'}` }}
                  />
                  <span className="user-carousel-name">{user.name}</span>
                  {currentSelectedUserId === user.id && editingIdx === null && (
                     <button onClick={(e) => { e.stopPropagation(); handleEditUser(user.id);}} className="user-action-btn edit-btn" aria-label="Edit user">
                        <img src={editIcon} alt="Edit" />
                     </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="users-list-fade users-list-fade-right" style={{ opacity: rightFadeOpacity }} />
          </div>
        </div>

        <div className="user-details-panel">
          {displayUser ? (
            <>
              {editingUserData ? (
                <form onSubmit={handleSubmit} className="user-form" ref={formRef}>
                  <h3>{editingUserData.id === defaultUser.id || !allUsers.find(u=>u.id === editingUserData.id)?.submitted ? "Create User" : "Edit User"}</h3>
                  {}
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
      </div> {}

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