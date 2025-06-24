import {useState, useEffect, useRef} from 'react';
import "./Home.css";
import clockIcon from '@/assets/clock-counter-clockwise-icon.svg';
import fileIcon from '@/assets/file-icon.svg';
import bookBookmarkIcon from '@/assets/book-bookmark-icon.svg';
import questionMarkIcon from '@/assets/question-mark-icon.svg';
import githubIcon from '@/assets/github-icon.svg';
import {commands} from "@/utils/requests.ts";

interface RecentFile {
  id: string;
  name: string;
  location: string;
  lastUpdated: string;
  userName: string;
}

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
  const [topFadeOpacity, setTopFadeOpacity] = useState(0);
  const [bottomFadeOpacity, setBottomFadeOpacity] = useState(1);

  useEffect(() => {
    const sortedFiles = async () => {
      const recentFiles = await commands.fetchRecentFiles();
      [...recentFiles].sort((a, b) => {
        const dateA = new Date(a.lastUpdated);
        const dateB = new Date(b.lastUpdated);

        return dateB.getTime() - dateA.getTime();
      })
      setRecentFiles(recentFiles);
    };
    void sortedFiles();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!listContentRef.current) return;
      const {scrollTop, scrollHeight, clientHeight} = listContentRef.current;
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
        const directoryHandle = await window.showDirectoryPicker({startIn: 'documents'});
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
            <img src={clockIcon} alt="Recent" className="sidebar-header-icon"/>
            <h2 className="sidebar-header-title">Recent</h2>
          </div>
          <div className="sidebar-list-container">
            <div className="sidebar-fade sidebar-fade-top" style={{opacity: topFadeOpacity}}/>
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
                        <img src={fileIcon} alt="file" className="recent-file-icon"/>
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
            <div className="sidebar-fade sidebar-fade-bottom" style={{opacity: bottomFadeOpacity}}/>
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
              <img src={bookBookmarkIcon} alt="Documentation" className="main-section-icon"/>
            </div>
            <div className="main-section-details-column">
              <h3 className="main-section-title">Documentation</h3>
              <div className="main-section-text-wrapper">
                <p className="main-section-text">Read through the documentation for a seamless experience of using the
                  balance toolkit with your wii balance board</p>
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
              <img src={fileIcon} alt="Placeholder" className="main-section-icon"/>
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
              <img src={questionMarkIcon} alt="Help" className="main-section-icon"/>
            </div>
            <div className="main-section-details-column">
              <h3 className="main-section-title">Help & Support</h3>
              <div className="main-section-text-wrapper">
                <p className="main-section-text">Go through a quick tutorial and see how you can make the most of The
                  Balance Toolkit</p>
              </div>
              <div className="link-footer">
                <div className="main-section-action-link" onClick={() => console.log('Go to tutorial clicked')}>
                  Go to tutorial &rarr;
                </div>
              </div>
            </div>
          </div>


          <div className="main-area-section contact-section">
            <div className="main-section-details-column">
              <div className="contact-item-list">
                <div className="contact-item">
                  <span className="contact-label">Source</span>
                  <a
                    href="YOUR_GITHUB_REPOSITORY_LINK_HERE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contact-visual-link"
                    aria-label="View on GitHub"
                  >
                    <img src={githubIcon} alt="GitHub" className="contact-icon github-icon"/>
                  </a>
                </div>
                <div className="contact-item">
                  <span className="contact-label">Cite</span>
                  <a
                    href="YOUR_PUBLICATION_LINK_HERE"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="contact-visual-link"
                    aria-label="View Publication"
                  >
                    <img src={fileIcon} alt="Publication" className="contact-icon citation-icon"/>
                  </a>
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