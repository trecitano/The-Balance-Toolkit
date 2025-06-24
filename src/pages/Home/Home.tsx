import { useState, useEffect, useRef, FC } from 'react';
import "./Home.css";
import clockIcon from '../../assets/clock-counter-clockwise-icon.svg';
import fileIcon from '../../assets/file-icon.svg';
import bookBookmarkIcon from '../../assets/book-bookmark-icon.svg';
import questionMarkIcon from '../../assets/question-mark-icon.svg';
import githubIcon from '../../assets/github-icon.svg';

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

// Helper component for main content sections
interface MainSectionProps {
  className?: string;
  icon: string;
  alt: string;
  title:string;
  text: string;
  linkText: string;
  onLinkClick: () => void;
}

const MainSection: FC<MainSectionProps> = ({ className, icon, alt, title, text, linkText, onLinkClick }) => (
  <div className={`main-area-section ${className || ''}`}>
    <div className="main-section-icon-panel">
      <img src={icon} alt={alt} className="main-section-icon" />
    </div>
    <div className="main-section-details-column">
      <h3 className="main-section-title">{title}</h3>
      <div className="main-section-text-wrapper">
        <p className="main-section-text">{text}</p>
      </div>
      <div className="link-footer">
        <div className="main-section-action-link" onClick={onLinkClick}>
          {linkText} &rarr;
        </div>
      </div>
    </div>
  </div>
);

// Helper component for a single recent file item
interface RecentFileItemProps {
  file: RecentFile;
}

const RecentFileItem: FC<RecentFileItemProps> = ({ file }) => (
  <li className="recent-file-item">
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
);

// Helper component for a single contact item
interface ContactItemProps {
  label: string;
  href: string;
  ariaLabel: string;
  icon: string;
  alt: string;
  iconClassName: string;
}

const ContactItem: FC<ContactItemProps> = ({ label, href, ariaLabel, icon, alt, iconClassName }) => (
  <div className="contact-item">
    <span className="contact-label">{label}</span>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="contact-visual-link"
      aria-label={ariaLabel}
    >
      <img src={icon} alt={alt} className={`contact-icon ${iconClassName}`} />
    </a>
  </div>
);

function Home() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const listContentRef = useRef<HTMLDivElement>(null);
  const [topFadeOpacity, setTopFadeOpacity] = useState(0);
  const [bottomFadeOpacity, setBottomFadeOpacity] = useState(1);

  useEffect(() => {
    const sortedFiles = [...mockRecentFiles].sort((a, b) => {
      const dateA = new Date(a.lastUpdated);
      const dateB = new Date(b.lastUpdated);

      return dateB.getTime() - dateA.getTime();
    });
    setRecentFiles(sortedFiles);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!listContentRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = listContentRef.current;
      const maxFade = 50; // Adjust this value to control fade sensitivity

      // Top fade
      const calculatedTopOpacity = Math.min(scrollTop / maxFade, 1);
      setTopFadeOpacity(calculatedTopOpacity);

      // Bottom fade
      const scrollBottom = scrollHeight - clientHeight - scrollTop;
      const calculatedBottomOpacity = Math.max(0, Math.min(scrollBottom / maxFade, 1));
      setBottomFadeOpacity(calculatedBottomOpacity);
    };

    const listElement = listContentRef.current;
    if (listElement) {
      listElement.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial check
    }

    return () => {
      if (listElement) {
        listElement.removeEventListener('scroll', handleScroll);
      }
    };
  }, [recentFiles]); // Re-run if recentFiles changes, affecting scrollHeight

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
            <div className="sidebar-fade sidebar-fade-top" style={{ opacity: topFadeOpacity }} />
            <div className="sidebar-content" ref={listContentRef}>
              <div className="recent-files-header">
                <div className="recent-files-column-header file-column">File</div>
                <div className="recent-files-column-header user-column">User</div>
                <div className="recent-files-column-header updated-column">Updated</div>
              </div>
              {recentFiles.length > 0 ? (
                <ul className="recent-files-list">
                  {recentFiles.map((file) => (
                    <RecentFileItem key={file.id} file={file} />
                  ))}
                </ul>
              ) : (
                <p className="no-recent-files">No recent files to display.</p>
              )}
            </div>
            <div className="sidebar-fade sidebar-fade-bottom" style={{ opacity: bottomFadeOpacity }} />
          </div>
          <div className="link-footer">
            <div className="more-files-link" onClick={handleMoreFilesClick}>
              More files &rarr;
            </div>
          </div>
        </div>
        <div className="home-main-area">
          <MainSection
            className="documentation-section"
            icon={bookBookmarkIcon}
            alt="Documentation"
            title="Documentation"
            text="Read through the documentation for a seamless experience of using the balance toolkit with your wii balance board"
            linkText="View documentation"
            onLinkClick={() => console.log('View documentation clicked')}
          />
          <MainSection
            className="placeholder-section"
            icon={fileIcon}
            alt="Placeholder"
            title="Placeholder"
            text="Placeholder Content"
            linkText="Placeholder"
            onLinkClick={() => console.log('Placeholder action clicked')}
          />
          <MainSection
            className="help-section"
            icon={questionMarkIcon}
            alt="Help"
            title="Help & Support"
            text="Go through a quick tutorial and see how you can make the most of The Balance Toolkit"
            linkText="Go to tutorial"
            onLinkClick={() => console.log('Go to tutorial clicked')}
          />
          
          <div className="main-area-section contact-section">
            <div className="main-section-details-column">
              <div className="contact-item-list">
                <ContactItem
                  label="Source"
                  href="YOUR_GITHUB_REPOSITORY_LINK_HERE"
                  ariaLabel="View on GitHub"
                  icon={githubIcon}
                  alt="GitHub"
                  iconClassName="github-icon"
                />
                <ContactItem
                  label="Cite"
                  href="YOUR_PUBLICATION_LINK_HERE"
                  ariaLabel="View Publication"
                  icon={fileIcon}
                  alt="Publication"
                  iconClassName="citation-icon"
                />
              </div>
            </div>
          </div>
          

        </div>
      </div>
    </div>
  );
}

export default Home;