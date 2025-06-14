import logo from '../../../assets/app-logo.png';
import homeIcon from '../../../assets/home-icon.svg';
import deviceIcon from '../../../assets/wbb-icon-line.svg';
import userIcon from '../../../assets/users-icon.svg';
import sessionIcon from '../../../assets/session-icon.svg';
import settingsIcon from '../../../assets/settings-icon.svg';
import helpIcon from '../../../assets/question-mark-icon.svg'; 
import activitiesIcon from '../../../assets/activities-icon.svg';

interface NavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const menuItems = [
  { id: "home", label: "Home", icon: homeIcon },
  { id: "devices", label: "Devices", icon: deviceIcon },
  { id: "users", label: "Users", icon: userIcon },
  { id: "session", label: "Session", icon: sessionIcon },
  { id: "activities", label: "Activities", icon: activitiesIcon },
];

function Navigation({ activeView, onViewChange }: NavigationProps) {
  return (
    <nav className={`menu-bar${activeView ? ' menu-bar--active' : ''}`}>
      <div>
        <img src={logo} alt="Logo" className="logo-placeholder" />
        <div className="menu-container">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {menuItems.map((item) => (
              <li
                key={item.id}
                className={`menu-item${activeView === item.id ? " active" : ""}`}
                onClick={() => onViewChange(item.id)}
              >
                <span className="menu-item-icon">
                  <img src={item.icon} alt={item.label} className="nav-icon" />
                </span>
                <span className="menu-item-text">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="menu-bottom">
        {/* Settings */}
        <button className="menu-item settings unstyled-button" title="Settings">
          <span className="menu-item-icon">
            <img src={settingsIcon} alt="Settings" className="nav-icon-sm" />
          </span>
          <span className="menu-item-text">Settings</span>
        </button>
        {/* Help & Support */}
        <button className="menu-item help unstyled-button" title="Help & Support">
          <span className="menu-item-icon">
            <img src={helpIcon} alt="Help & Support" className="nav-icon-sm" />
          </span>
          <span className="menu-item-text">Help</span>
        </button>
      </div>
    </nav>
  );
}

export default Navigation;