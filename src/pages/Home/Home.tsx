import { useState, useEffect, useRef } from 'react';
import "./Home.css";
import clockIcon from '../../assets/clock-counter-clockwise-icon.svg';
import fileIcon from '../../assets/file-icon.svg';
import bookBookmarkIcon from '../../assets/book-bookmark-icon.svg';
import questionMarkIcon from '../../assets/question-mark-icon.svg';

interface RecentFile {
  id: string;
  name: string;
  location: string;
  lastUpdated: string;
  userName: string;
}

const mockRecentFiles: RecentFile[] = [
  { id: '1', name: 'Session_2025-06-12_Alpha.csv', location: 'Documents/BalanceToolkit/Sessions', lastUpdated: 'June 12, 2025', userName: 'User-123' },
  { id: '2', name: 'PatientReport_JohnDoe.pdf', location: 'Desktop/Reports', lastUpdated: 'June 11, 2025', userName: 'Dr. Emily' },
  { id: '3', name: 'ExercisePlan_Week5.docx', location: 'OneDrive/ClientFiles/JaneS', lastUpdated: 'June 10, 2025', userName: 'User-123' },
  { id: '4', name: 'System_Calibration_Log.txt', location: 'C:/ProgramData/BalanceToolkit', lastUpdated: 'June 9, 2025', userName: 'Admin' },
  { id: '5', name: 'ResearchData_StudyGamma.xlsx', location: 'SharedDrives/Research/FY2025', lastUpdated: 'June 8, 2025', userName: 'Dr. Smith' },
  { id: '6', name: 'MeetingNotes_ProjectPhoenix.md', location: 'Documents/Projects/Phoenix', lastUpdated: 'June 7, 2025', userName: 'User-456' },
  { id: '7', name: 'SoftwareUpdate_v2.3_Changelog.txt', location: 'Downloads/Software', lastUpdated: 'June 6, 2025', userName: 'DevTeam' },
  { id: '8', name: 'ClientFeedback_Q2_Summary.pptx', location: 'OneDrive/ClientPresentations', lastUpdated: 'June 5, 2025', userName: 'SalesTeam' },
  { id: '9', name: 'TrainingManual_NewStaff.pdf', location: 'CompanyPortal/HR/Onboarding', lastUpdated: 'June 4, 2025', userName: 'HR Dept' },
  { id: '10', name: 'Session_2025-06-03_Beta.csv', location: 'Documents/BalanceToolkit/Archive', lastUpdated: 'June 3, 2025', userName: 'User-123' },
  { id: '11', name: 'FinancialReport_May2025.pdf', location: 'Secure/Finance/MonthlyReports', lastUpdated: 'June 2, 2025', userName: 'FinanceLead' },
  { id: '12', name: 'MarketingCampaign_Summer25.ai', location: 'Marketing/Assets/Campaigns', lastUpdated: 'June 1, 2025', userName: 'MarketingGuru' },
  { id: '13', name: 'UserSurvey_Results_May.csv', location: 'Analytics/UserFeedback', lastUpdated: 'May 31, 2025', userName: 'DataAnalyst' },
  { id: '14', name: 'Backup_SystemConfig_2025-05-30.zip', location: 'D:/Backups/System', lastUpdated: 'May 30, 2025', userName: 'Admin' },
];

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos' | FileSystemHandle;
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

function Home() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const listContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sortedFiles = [...mockRecentFiles].sort((a, b) => {
      const dateA = new Date(a.lastUpdated);
      const dateB = new Date(b.lastUpdated);

      return dateB.getTime() - dateA.getTime();
    });
    setRecentFiles(sortedFiles);
  }, []);

  const handleMoreFilesClick = async () => {
    if (window.showDirectoryPicker) {
      try {
        const directoryHandle = await window.showDirectoryPicker({ startIn: 'documents' });
        console.log("Selected directory:", directoryHandle.name);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          console.log("User cancelled the directory selection.");
        } else {
          console.error("Error picking directory:", err);
          alert("Could not open directory picker.");
        }
      }
    } else {
      alert("Your browser does not support the directory picker API.");
      console.log("Directory Picker API not supported.");
    }
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <span className="page-title">Home</span>
      </div>
      <div className="home-content">
        <div className="home-left-sidebar">
          <div className="sidebar-header">
            <img src={clockIcon} alt="Recent" className="sidebar-header-icon" />
            <h2 className="sidebar-header-title">Recent</h2>
          </div>
          <div className="sidebar-list-container">
            <div className="sidebar-content" ref={listContentRef}>
              <div className="recent-files-header">
                <div className="recent-files-column-header file-column">File</div>
                <div className="recent-files-column-header user-column">User</div>
                <div className="recent-files-column-header updated-column">Updated</div>
              </div>
              {recentFiles.length > 0 ? (
                <ul className="recent-files-list">
                  {recentFiles.map((file) => (
                    <li key={file.id} className="recent-file-item">
                      <div className="recent-file-column file-column">
                        <img src={fileIcon} alt="file" className="recent-file-icon" />
                        <div className="recent-file-info">
                          <span className="recent-file-name">{file.name}</span>
                          <span className="recent-file-location">{file.location}</span>
                        </div>
                      </div>
                      <div className="recent-file-column user-column">
                        <span className="recent-file-user">{file.userName}</span>
                      </div>
                      <div className="recent-file-column updated-column">
                        <span className="recent-file-date">{file.lastUpdated}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-recent-files">No recent files to display.</p>
              )}
            </div>
          </div>
          <div className="link-footer">
            <div className="more-files-link" onClick={handleMoreFilesClick}>
              More files &rarr;
            </div>
          </div>
        </div>
        <div className="home-main-area">
          <div className="main-area-section documentation-section">
            <div className="main-section-icon-panel">
              <img src={bookBookmarkIcon} alt="Documentation" className="main-section-icon" />
            </div>
            <div className="main-section-details-column">
              <h3 className="main-section-title">Documentation</h3>
              <div className="main-section-text-wrapper">
                <p className="main-section-text">Read through the documentation for a seamless experience of using the balance toolkit with your wii balance board</p>
              </div>
              <div className="link-footer">
                <div className="main-section-action-link" onClick={() => console.log('View documentation clicked')}>
                  View documentation &rarr;
                </div>
              </div>
            </div>
          </div>
          <div className="main-area-section placeholder-section">
            <div className="main-section-icon-panel">
              <img src={fileIcon} alt="Placeholder" className="main-section-icon" />
            </div>
            <div className="main-section-details-column">
              <h3 className="main-section-title">Placeholder</h3>
              <div className="main-section-text-wrapper">
                <p className="main-section-text">Placeholder Content</p>
              </div>
              <div className="link-footer">
                <div className="main-section-action-link" onClick={() => console.log('Placeholder action clicked')}>
                  Placeholder &rarr;
                </div>
              </div>
            </div>
          </div>
          <div className="main-area-section help-section">
            <div className="main-section-icon-panel">
              <img src={questionMarkIcon} alt="Help" className="main-section-icon" />
            </div>
            <div className="main-section-details-column">
              <h3 className="main-section-title">Help & Support</h3>
              <div className="main-section-text-wrapper">
                <p className="main-section-text">Go through a quick tutorial and see how you can make the most of The Balance Toolkit</p>
              </div>
              <div className="link-footer">
                <div className="main-section-action-link" onClick={() => console.log('Go to tutorial clicked')}>
                  Go to tutorial &rarr;
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;