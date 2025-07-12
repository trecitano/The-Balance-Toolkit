interface DeviceScannerProps {
  foundDevicesCount: number;
  handleCancelScan: () => void;
}

export default function DeviceScanner({ foundDevicesCount, handleCancelScan }: DeviceScannerProps) {
  return (
    <div className="scan-overlay">
      <div className="scan-overlay-spinner">
        <span className="spinner" />
        <span className="scan-overlay-text">Scanning...</span>

        {foundDevicesCount > 0 && (
          <p className="scan-overlay-count">Found {foundDevicesCount} devices so far...</p>
        )}

        <button
          className="scan-btn"
          style={{ marginTop: 24, minWidth: 120 }}
          onClick={handleCancelScan}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
