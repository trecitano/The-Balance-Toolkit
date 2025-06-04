import logo from '../../../assets/logo.svg';
import homeIcon from '../../../assets/home-icon.svg';
import deviceIcon from '../../../assets/wbb-icon-line.svg';
import userIcon from '../../../assets/users-icon.svg';
import sessionIcon from '../../../assets/session-icon.svg';
import settingsIcon from '../../../assets/settings-icon.svg';
import helpIcon from '../../../assets/question-mark-icon.svg'; // <-- Add this line

interface NavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const menuItems = [
  { id: "home", label: "Home", icon: homeIcon },
  { id: "devices", label: "Devices", icon: deviceIcon },
  { id: "user", label: "User", icon: userIcon },
  { id: "session", label: "Session", icon: sessionIcon },
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
                  <img src={item.icon} alt={item.label} style={{ width: 22, height: 22 }} />
                </span>
                {/* Optionally hide text on small screens */}
                <span className="menu-item-text">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="menu-bottom">
        {/* Settings */}
        <button className="menu-item settings" style={{ background: "none", border: "none" }} title="Settings">
          <span className="menu-item-icon">
            <img src={settingsIcon} alt="Settings" style={{ width: 20, height: 22 }} />
          </span>
          <span className="menu-item-text">Settings</span>
        </button>
        {/* Help & Support */}
        <button className="menu-item help" style={{ background: "none", border: "none" }} title="Help & Support">
          <span className="menu-item-icon">
            <img src={helpIcon} alt="Help & Support" style={{ width: 20, height: 22 }} />
          </span>
          <span className="menu-item-text">Help</span>
        </button>
      </div>
    </nav>
  );
}

export default Navigation;