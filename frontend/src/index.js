import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <div style={{padding: "20px", textAlign: "center"}}>
      <h1>🌡️ GFS Temperature Anomaly Viewer</h1>
      <p>Weather application ready!</p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
