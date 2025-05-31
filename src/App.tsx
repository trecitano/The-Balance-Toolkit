import { useState } from "react";
import Navigation from "./components/common/Navigation/Navigation";
import Home from "./pages/Home/Home";
import Devices from "./pages/Devices/Devices";
import User from "./pages/User/User";
import Session from "./pages/Session/Session";
import "./App.css";

function App() {
  const [activeView, setActiveView] = useState("home");

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
    <div className="app">
      <Navigation activeView={activeView} onViewChange={setActiveView} />
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;