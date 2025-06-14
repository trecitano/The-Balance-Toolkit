import { useState, useEffect } from "react";
import Navigation from "./components/common/Navigation/Navigation";
import Home from "./pages/Home/Home";
import Devices from "./pages/Devices/Devices";
import Users from "./pages/Users/Users";
import Session from "./pages/Session/Session";
import Activities from "./pages/Activities/Activities";
import lightIcon from "./assets/light-icon.svg";
import darkIcon from "./assets/dark-icon.svg";
import "./App.css";

function App() {
  const [activeView, setActiveView] = useState("home");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [connectedDeviceNames, setConnectedDeviceNames] = useState<string[]>([]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
    document.body.className = theme === "light" ? "dark-theme" : "light-theme";
  };

  useEffect(() => {
    document.body.className = theme + "-theme";
  }, [theme]);

  const handleConnectedDevicesChange = (names: string[]) => {
    setConnectedDeviceNames(names);
  };

  const renderContent = () => {
    switch (activeView) {
      case "home":
        return <Home />;
      case "devices":
        return <Devices onConnectedDevicesChange={handleConnectedDevicesChange} />;
      case "users":
        return <Users />;
      case "session":
        return <Session availableBoards={connectedDeviceNames} onViewChange={setActiveView} />;
      case "activities":
        return <Activities />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className={`app ${theme}-theme`}>
      <Navigation activeView={activeView} onViewChange={setActiveView} />
      <main className="main-content">
        <div className="theme-toggle-hover-zone">
          <button
            className="theme-toggle-btn"
            onClick={(e) => {
              handleToggleTheme();
              e.currentTarget.blur(); // Remove focus so it hides on mouse out
            }}
            aria-label="Toggle theme"
          >
            <img
              src={theme === "light" ? lightIcon : darkIcon}
              alt={theme === "light" ? "Light mode" : "Dark mode"}
              className="theme-toggle-icon"
            />
          </button>
        </div>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;