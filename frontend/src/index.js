import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forecastHour, setForecastHour] = useState(0);
  const canvasRef = useRef(null);

  const fetchData = async (hour = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/temperature/anomaly?forecast_hour=${hour}&use_mock=false`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('App starting, fetching initial data...');
    fetchData(forecastHour);
  }, [forecastHour]);

  // Create temperature heatmap using Canvas
  useEffect(() => {
    if (!data?.anomaly_data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { lats, lons, values } = data.anomaly_data;
    const { min_anomaly, max_anomaly } = data.statistics;

    // Set canvas size
    canvas.width = 900;
    canvas.height = 600;

    // Clear canvas
    ctx.fillStyle = '#f0f8ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // North America bounds
    const minLat = 15, maxLat = 85;
    const minLon = -170, maxLon = -50;

    // Create ImageData for heatmap
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data_array = imageData.data;

    // Helper function to get temperature color
    const getTemperatureColor = (value) => {
      const normalized = (value - min_anomaly) / (max_anomaly - min_anomaly);
      let r, g, b;

      if (normalized < 0.2) {
        // Cold - blue
        r = 25; g = 55; b = 126;
      } else if (normalized < 0.4) {
        // Cool - light blue
        r = 57; g = 117; b = 180;
      } else if (normalized < 0.6) {
        // Normal - white/light blue
        r = 144; g = 202; b = 249;
      } else if (normalized < 0.8) {
        // Warm - yellow/orange
        r = 255; g = 152; b = 0;
      } else {
        // Hot - red
        r = 211; g = 47; b = 47;
      }

      return [r, g, b];
    };

    // Fill the heatmap
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        // Convert canvas coordinates to lat/lon
        const lon = minLon + (x / canvas.width) * (maxLon - minLon);
        const lat = maxLat - (y / canvas.height) * (maxLat - minLat);

        // Find nearest data point
        let closestValue = null;
        let minDistance = Infinity;

        for (let i = 0; i < lats.length; i++) {
          for (let j = 0; j < lons.length; j++) {
            if (values[i] && values[i][j] !== undefined) {
              const distance = Math.sqrt(
                Math.pow(lat - lats[i], 2) + Math.pow(lon - lons[j], 2)
              );
              if (distance < minDistance) {
                minDistance = distance;
                closestValue = values[i][j];
              }
            }
          }
        }

        // Set pixel color
        if (closestValue !== null) {
          const [r, g, b] = getTemperatureColor(closestValue);
          const pixelIndex = (y * canvas.width + x) * 4;
          data_array[pixelIndex] = r;     // Red
          data_array[pixelIndex + 1] = g; // Green
          data_array[pixelIndex + 2] = b; // Blue
          data_array[pixelIndex + 3] = 180; // Alpha (transparency)
        } else {
          const pixelIndex = (y * canvas.width + x) * 4;
          data_array[pixelIndex] = 240;     // Light gray
          data_array[pixelIndex + 1] = 248;
          data_array[pixelIndex + 2] = 255;
          data_array[pixelIndex + 3] = 255;
        }
      }
    }

    // Put the image data on canvas
    ctx.putImageData(imageData, 0, 0);

    // Draw country outlines on top
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Simplified North America outline
    const coords = [
      // USA outline (simplified)
      [200, 350], [180, 340], [170, 320], [160, 300], [155, 280], 
      [160, 260], [180, 240], [220, 230], [280, 225], [360, 235], 
      [460, 245], [580, 255], [680, 270], [750, 290], [800, 320], 
      [820, 360], [810, 400], [780, 440], [720, 470], [640, 480], 
      [540, 470], [440, 450], [340, 430], [240, 410], [200, 380]
    ];

    ctx.moveTo(coords[0][0], coords[0][1]);
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(coords[i][0], coords[i][1]);
    }
    ctx.closePath();
    ctx.stroke();

    // Add major cities
    ctx.fillStyle = '#1976d2';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;

    const cities = [
      { name: 'Vancouver', x: 130, y: 190 },
      { name: 'Chicago', x: 380, y: 220 },
      { name: 'New York', x: 600, y: 240 },
      { name: 'Los Angeles', x: 250, y: 340 },
      { name: 'Miami', x: 560, y: 310 },
      { name: 'Mexico City', x: 350, y: 410 }
    ];

    cities.forEach(city => {
      ctx.beginPath();
      ctx.arc(city.x, city.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // City labels
      ctx.fillStyle = '#1976d2';
      ctx.font = '12px system-ui';
      ctx.fontWeight = '600';
      ctx.fillText(city.name, city.x + 8, city.y + 4);
    });

    // Add country labels
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('CANADA', 450, 130);
    ctx.fillText('UNITED STATES', 420, 270);
    ctx.fillText('MEXICO', 350, 380);

  }, [data]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        padding: '2rem',
        boxShadow: '0 2px 20px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '2.5rem', fontWeight: '300' }}>
          North America Temperature Anomaly
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: '#7f8c8d', fontSize: '1.1rem' }}>
          High Resolution Heatmap • GFS Model Analysis
        </p>
      </div>

      <div style={{ padding: '2rem', display: 'flex', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          flex: 1, 
          background: 'white', 
          borderRadius: '8px', 
          padding: '2rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          {data && (
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem',
              padding: '1rem',
              background: data.mock_data ? '#fff3e0' : '#e8f5e8',
              borderRadius: '6px',
              border: `1px solid ${data.mock_data ? '#ffcc02' : '#4caf50'}`,
              fontWeight: '500',
              color: '#333'
            }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                Valid Time: {new Date(data.valid_time).toLocaleString('en-US', {
                  weekday: 'short',
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short'
                })}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                {data.mock_data ? 'High-Resolution Demonstration Data' : 'Live GFS Data'} • Forecast: +{forecastHour}h
              </div>
            </div>
          )}

          {loading && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              height: '600px', 
              justifyContent: 'center',
              color: '#666'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #f3f3f3',
                borderTop: '3px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Loading high-resolution temperature data...</p>
            </div>
          )}

          {error && (
            <div style={{ 
              background: '#ffebee', 
              color: '#c62828', 
              padding: '1rem', 
              borderRadius: '6px',
              border: '1px solid #ef5350',
              textAlign: 'center'
            }}>
              Unable to load data: {error}
            </div>
          )}

          {data && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '6px', 
                overflow: 'hidden',
                background: '#f8f9fa'
              }}>
                <canvas 
                  ref={canvasRef}
                  style={{ 
                    display: 'block',
                    width: '900px',
                    height: '600px'
                  }}
                />
              </div>

              {/* Professional legend */}
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1.5rem', 
                background: '#ffffff', 
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                width: '100%',
                maxWidth: '900px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '1rem' }}>
                  Temperature Anomaly Scale (°C)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '20px', height: '12px', background: 'linear-gradient(to right, #19377F, #3949ab)', borderRadius: '2px' }}></div>
                    <span>Much Colder ({data.statistics.min_anomaly.toFixed(1)}°)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '20px', height: '12px', backgroundColor: '#90caf9', borderRadius: '2px' }}></div>
                    <span>Near Normal</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '20px', height: '12px', background: 'linear-gradient(to right, #ff9800, #d32f2f)', borderRadius: '2px' }}></div>
                    <span>Much Warmer ({data.statistics.max_anomaly.toFixed(1)}°)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '8px', 
            padding: '1.5rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>Forecast Controls</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#555', fontSize: '0.9rem' }}>
                Forecast Hour:
              </label>
              <select 
                value={forecastHour}
                onChange={(e) => setForecastHour(parseInt(e.target.value))}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  background: 'white'
                }}
              >
                <option value={0}>Analysis (Current)</option>
                <option value={6}>+6 hours</option>
                <option value={12}>+12 hours</option>
                <option value={24}>+1 day</option>
                <option value={48}>+2 days</option>
                <option value={72}>+3 days</option>
                <option value={120}>+5 days</option>
              </select>
            </div>

            <button 
              onClick={() => fetchData(forecastHour)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: loading ? '#f5f5f5' : '#1976d2',
                color: loading ? '#999' : 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {loading ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>

          {data && (
            <div style={{ 
              background: 'white', 
              borderRadius: '8px', 
              padding: '1.5rem',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>Statistics</h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#e3f2fd', borderRadius: '4px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: '600', color: '#1976d2' }}>
                    {data.statistics.min_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>Coldest Anomaly</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: '600', color: '#666' }}>
                    {data.statistics.mean_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>Continental Average</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#ffebee', borderRadius: '4px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: '600', color: '#d32f2f' }}>
                    {data.statistics.max_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>Warmest Anomaly</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ 
            background: 'white', 
            borderRadius: '8px', 
            padding: '1.5rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>Heatmap Info</h3>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.4', color: '#666' }}>
              <div style={{ marginBottom: '0.5rem' }}><strong>Type:</strong> Continuous Field</div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Resolution:</strong> Full GFS Grid</div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Interpolation:</strong> Nearest Neighbor</div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Coverage:</strong> North America</div>
              <div><strong>Source:</strong> NOAA/NCEP GFS</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;