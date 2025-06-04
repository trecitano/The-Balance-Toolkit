import { useState } from "react";
import Navigation from "./components/common/Navigation/Navigation";
import Home from "./pages/Home/Home";
import Devices from "./pages/Devices/Devices";
import User from "./pages/User/User";
import Session from "./pages/Session/Session";
import lightIcon from "./assets/light-icon.svg";
import darkIcon from "./assets/dark-icon.svg";
import "./App.css";

function App() {
  const [activeView, setActiveView] = useState("home");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
    // Optionally, add logic to update body class or CSS variables here
  };

  const renderContent = () => {
    switch (activeView) {
      case "home":
        return <Home />;
      case "devices":
        return <Devices />;
      case "user":
        return <User />;
      case "session":
        return <Session />;
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