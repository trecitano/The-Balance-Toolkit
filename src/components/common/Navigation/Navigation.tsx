import logo from '../../../assets/logo.svg';

interface NavigationProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

function Navigation({ activeView, onViewChange }: NavigationProps) {
  const menuItems = [
    { id: "home", label: "Home" },
    { id: "devices", label: "Devices" },
    { id: "user", label: "User" },
    { id: "session", label: "Session" },
  ];

  return (
    <nav className={`menu-bar${activeView ? ' menu-bar--active' : ''}`}>
      <div className="logo-placeholder">
        <img src={logo} alt="Logo" />
      </div>
      <div className="menu-container" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: "none" }}>
          {menuItems.map((item) => (
            <li
              key={item.id}
              className={`menu-item${activeView === item.id ? " active" : ""}`}
              onClick={() => onViewChange(item.id)}
            >
              <span className="menu-item-text">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export default Navigation;