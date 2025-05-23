import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forecastHour, setForecastHour] = useState(0);

  const fetchData = async (hour = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/temperature/anomaly?forecast_hour=${hour}&use_mock=true`);
      
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

  const createNorthAmericaMapPoints = () => {
    if (!data?.anomaly_data) return [];
    
    const { lats, lons, values } = data.anomaly_data;
    const { min_anomaly, max_anomaly } = data.statistics;
    const points = [];
    
    // North America bounds: 15°N to 85°N, 170°W to 50°W
    const minLat = 15, maxLat = 85;
    const minLon = -170, maxLon = -50;
    
    for (let i = 0; i < lats.length; i += 5) {
      for (let j = 0; j < lons.length; j += 5) {
        const lat = lats[i];
        const lon = lons[j];
        
        // Filter to North America only
        if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
          if (values[i] && values[i][j] !== undefined) {
            const normalized = (values[i][j] - min_anomaly) / (max_anomaly - min_anomaly);
            let color = '#abd9e9';
            if (normalized < 0.2) color = '#313695';
            else if (normalized < 0.4) color = '#4575b4';
            else if (normalized > 0.8) color = '#d73027';
            else if (normalized > 0.6) color = '#fee090';
            
            // Map to North America view
            const x = ((lon - minLon) / (maxLon - minLon)) * 900;
            const y = ((maxLat - lat) / (maxLat - minLat)) * 600;
            
            points.push({
              x,
              y,
              color,
              value: values[i][j],
              lat,
              lon
            });
          }
        }
      }
    }
    return points;
  };

  const points = createNorthAmericaMapPoints();

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        padding: '2rem',
        boxShadow: '0 2px 20px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, color: '#2c3e50', fontSize: '2.5rem' }}>
          🇺🇸 North America Temperature Anomaly Viewer
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: '#7f8c8d' }}>
          GFS temperature anomalies for United States, Canada, and Mexico
        </p>
      </div>

      <div style={{ padding: '2rem', display: 'flex', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          flex: 1, 
          background: 'white', 
          borderRadius: '12px', 
          padding: '1.5rem',
          boxShadow: '0 4px 25px rgba(0,0,0,0.1)'
        }}>
          {data && (
            <div style={{
              textAlign: 'center',
              marginBottom: '1rem',
              padding: '0.75rem',
              background: '#e3f2fd',
              borderRadius: '8px',
              fontWeight: '600',
              color: '#1976d2'
            }}>
              Valid: {new Date(data.valid_time).toLocaleString()}
              {data.mock_data && <span style={{ marginLeft: '1rem', opacity: 0.7 }}>(Demo Data)</span>}
            </div>
          )}

          {loading && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              height: '400px', 
              justifyContent: 'center' 
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #e3e3e3',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p>Loading temperature data...</p>
            </div>
          )}

          {error && (
            <div style={{ 
              background: '#fee', 
              color: '#c33', 
              padding: '1rem', 
              borderRadius: '8px',
              borderLeft: '4px solid #c33'
            }}>
              ❌ Error: {error}
            </div>
          )}

          {data && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                border: '2px solid #e1e8ed', 
                borderRadius: '8px', 
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}>
                <svg width="800" height="400" viewBox="0 0 800 400">
                  <rect width="800" height="400" fill="#f0f8ff" stroke="#ccc" />
                  <line x1="0" y1="200" x2="800" y2="200" stroke="#ddd" strokeWidth="1" strokeDasharray="5,5" />
                  
                  {points.map((point, i) => (
                    <circle
                      key={i}
                      cx={point.x}
                      cy={point.y}
                      r="2"
                      fill={point.color}
                      opacity="0.8"
                    />
                  ))}
                  
                  <text x="100" y="100" fontSize="12" fill="#666">North America</text>
                  <text x="550" y="150" fontSize="12" fill="#666">Europe</text>
                  <text x="650" y="120" fontSize="12" fill="#666">Asia</text>
                </svg>
              </div>

              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: '#f8f9fa', 
                borderRadius: '8px',
                width: '100%',
                maxWidth: '800px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Temperature Anomaly (°C)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#313695' }}>Cold: {data.statistics.min_anomaly.toFixed(1)}</span>
                  <span>Normal: 0.0</span>
                  <span style={{ color: '#d73027' }}>Hot: {data.statistics.max_anomaly.toFixed(1)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '1.5rem',
            boxShadow: '0 4px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: '#2c3e50' }}>🎛️ Controls</h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                Forecast Hour:
              </label>
              <select 
                value={forecastHour}
                onChange={(e) => setForecastHour(parseInt(e.target.value))}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e1e8ed',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
              >
                <option value={0}>Analysis (0h)</option>
                <option value={6}>+6 hours</option>
                <option value={12}>+12 hours</option>
                <option value={24}>+24 hours</option>
                <option value={48}>+48 hours</option>
                <option value={72}>+72 hours</option>
              </select>
            </div>

            <button 
              onClick={() => fetchData(forecastHour)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>

          {data && (
            <div style={{ 
              background: 'white', 
              borderRadius: '12px', 
              padding: '1.5rem',
              boxShadow: '0 4px 25px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem', color: '#2c3e50' }}>📊 Statistics</h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2980b9' }}>
                    {data.statistics.min_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>COLDEST</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#95a5a6' }}>
                    {data.statistics.mean_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>AVERAGE</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#e74c3c' }}>
                    {data.statistics.max_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>HOTTEST</div>
                </div>
              </div>
            </div>
          )}
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

// Render the App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;