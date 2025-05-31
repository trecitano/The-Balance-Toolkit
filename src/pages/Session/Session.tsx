import "./Session.css";

function Session() {
  return (
    <div className="content-section">
      <h1>Session</h1>
      <div className="settings-group">
        <h3>Application Settings</h3>
        <div className="setting-item">
          <label>
            <input type="checkbox" defaultChecked />
            Enable notifications
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input type="checkbox" />
            Auto-start on system boot
          </label>
        </div>
        <div className="setting-item">
          <label>
            Theme:
            <select>
              <option>Light</option>
              <option>Dark</option>
              <option>System</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

export default Session;