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

  const createNorthAmericaMapPoints = () => {
    if (!data?.anomaly_data) return [];
    
    const { lats, lons, values } = data.anomaly_data;
    const { min_anomaly, max_anomaly } = data.statistics;
    const points = [];
    
    // North America bounds: 15°N to 85°N, 170°W to 50°W
    const minLat = 15, maxLat = 85;
    const minLon = -170, maxLon = -50;
    
    for (let i = 0; i < lats.length; i += 2) {  // Higher resolution
      for (let j = 0; j < lons.length; j += 2) {
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
              height: '600px', 
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
              <p>Loading North America temperature data...</p>
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
                <svg width="900" height="600" viewBox="0 0 900 600">
                  <rect width="900" height="600" fill="#f0f8ff" stroke="#ccc" />
                  
                  {/* Grid lines */}
                  <defs>
                    <pattern id="grid" width="90" height="60" patternUnits="userSpaceOnUse">
                      <path d="M 90 0 L 0 0 0 60" fill="none" stroke="#e0e0e0" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="900" height="600" fill="url(#grid)" />
                  
                  {/* North America Coastlines */}
                  {/* United States mainland */}
                  <path d="M 200 350 Q 180 340 170 325 Q 160 310 155 295 Q 150 280 160 265 Q 170 250 185 240 Q 200 230 220 225 Q 250 220 280 225 Q 320 230 360 235 Q 400 240 440 245 Q 480 250 520 255 Q 560 260 600 265 Q 640 270 680 275 Q 720 280 750 290 Q 780 300 800 320 Q 820 340 825 365 Q 830 390 820 415 Q 810 440 790 455 Q 770 470 740 475 Q 710 480 680 485 Q 650 490 620 485 Q 590 480 560 475 Q 530 470 500 465 Q 470 460 440 455 Q 410 450 380 445 Q 350 440 320 435 Q 290 430 260 425 Q 230 420 210 405 Q 200 390 200 375 Z" fill="none" stroke="#2c3e50" strokeWidth="2"/>
                  
                  {/* Canada mainland */}
                  <path d="M 150 180 Q 130 170 120 155 Q 110 140 115 125 Q 120 110 135 100 Q 150 90 170 85 Q 200 80 230 85 Q 270 90 310 95 Q 350 100 390 105 Q 430 110 470 115 Q 510 120 550 125 Q 590 130 630 135 Q 670 140 710 145 Q 750 150 780 160 Q 810 170 830 185 Q 850 200 860 220 Q 870 240 860 260 Q 850 280 830 295 Q 810 310 780 315 Q 750 320 720 315 Q 690 310 660 305 Q 630 300 600 295 Q 570 290 540 285 Q 510 280 480 275 Q 450 270 420 265 Q 390 260 360 255 Q 330 250 300 245 Q 270 240 240 235 Q 210 230 180 225 Q 150 220 140 200 Q 135 185 150 180 Z" fill="none" stroke="#2c3e50" strokeWidth="2"/>
                  
                  {/* Mexico */}
                  <path d="M 280 460 Q 270 450 265 435 Q 260 420 270 405 Q 280 390 300 385 Q 320 380 340 385 Q 360 390 380 395 Q 400 400 420 405 Q 440 410 460 415 Q 480 420 500 425 Q 520 430 535 440 Q 550 450 560 465 Q 570 480 565 495 Q 560 510 545 520 Q 530 530 510 535 Q 490 540 470 535 Q 450 530 430 525 Q 410 520 390 515 Q 370 510 350 505 Q 330 500 310 495 Q 290 490 280 475 Q 275 465 280 460 Z" fill="none" stroke="#2c3e50" strokeWidth="2"/>
                  
                  {/* Great Lakes */}
                  <ellipse cx="650" cy="280" rx="25" ry="15" fill="none" stroke="#4682b4" strokeWidth="1.5"/>
                  <ellipse cx="620" cy="290" rx="20" ry="12" fill="none" stroke="#4682b4" strokeWidth="1.5"/>
                  <ellipse cx="680" cy="275" rx="15" ry="10" fill="none" stroke="#4682b4" strokeWidth="1.5"/>
                  <ellipse cx="590" cy="300" rx="12" ry="8" fill="none" stroke="#4682b4" strokeWidth="1.5"/>
                  <ellipse cx="560" cy="310" rx="10" ry="6" fill="none" stroke="#4682b4" strokeWidth="1.5"/>
                  
                  {/* Hudson Bay */}
                  <ellipse cx="550" cy="180" rx="30" ry="40" fill="none" stroke="#4682b4" strokeWidth="1.5"/>
                  
                  {/* Temperature anomaly points */}
                  {points.map((point, i) => (
                    <circle
                      key={i}
                      cx={point.x}
                      cy={point.y}
                      r="3"
                      fill={point.color}
                      opacity="0.7"
                    />
                  ))}
                  
                  {/* Country labels */}
                  <text x="550" y="170" fontSize="16" fontWeight="700" fill="#2c3e50" textAnchor="middle">CANADA</text>
                  <text x="500" y="340" fontSize="16" fontWeight="700" fill="#2c3e50" textAnchor="middle">UNITED STATES</text>
                  <text x="420" y="480" fontSize="16" fontWeight="700" fill="#2c3e50" textAnchor="middle">MEXICO</text>
                  
                  {/* Major cities */}
                  <circle cx="180" cy="220" r="3" fill="#d32f2f" stroke="white" strokeWidth="1"/>
                  <text x="190" y="225" fontSize="11" fill="#d32f2f" fontWeight="600">Vancouver</text>
                  
                  <circle cx="450" cy="260" r="3" fill="#d32f2f" stroke="white" strokeWidth="1"/>
                  <text x="460" y="265" fontSize="11" fill="#d32f2f" fontWeight="600">Chicago</text>
                  
                  <circle cx="720" cy="310" r="3" fill="#d32f2f" stroke="white" strokeWidth="1"/>
                  <text x="730" y="315" fontSize="11" fill="#d32f2f" fontWeight="600">New York</text>
                  
                  <circle cx="320" cy="420" r="3" fill="#d32f2f" stroke="white" strokeWidth="1"/>
                  <text x="330" y="425" fontSize="11" fill="#d32f2f" fontWeight="600">Los Angeles</text>
                  
                  <circle cx="650" cy="380" r="3" fill="#d32f2f" stroke="white" strokeWidth="1"/>
                  <text x="660" y="385" fontSize="11" fill="#d32f2f" fontWeight="600">Miami</text>
                  
                  <circle cx="420" cy="510" r="3" fill="#d32f2f" stroke="white" strokeWidth="1"/>
                  <text x="430" y="515" fontSize="11" fill="#d32f2f" fontWeight="600">Mexico City</text>
                </svg>
              </div>

              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: '#f8f9fa', 
                borderRadius: '8px',
                width: '100%',
                maxWidth: '900px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Temperature Anomaly (°C)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#313695', fontWeight: '600' }}>Much Colder: {data.statistics.min_anomaly.toFixed(1)}°C</span>
                  <span style={{ color: '#4575b4' }}>Colder</span>
                  <span style={{ fontWeight: '600' }}>Normal: 0.0°C</span>
                  <span style={{ color: '#fee090' }}>Warmer</span>
                  <span style={{ color: '#d73027', fontWeight: '600' }}>Much Warmer: {data.statistics.max_anomaly.toFixed(1)}°C</span>
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
                <option value={0}>Current Analysis</option>
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
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? '🔄 Loading...' : '🔄 Refresh Data'}
            </button>
          </div>

          {data && (
            <div style={{ 
              background: 'white', 
              borderRadius: '12px', 
              padding: '1.5rem',
              boxShadow: '0 4px 25px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem', color: '#2c3e50' }}>📊 North America Stats</h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#e8f4fd', borderRadius: '8px', border: '2px solid #2980b9' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2980b9' }}>
                    {data.statistics.min_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#2980b9', fontWeight: '600' }}>COLDEST SPOT</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#95a5a6' }}>
                    {data.statistics.mean_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#7f8c8d' }}>CONTINENTAL AVERAGE</div>
                </div>
                <div style={{ textAlign: 'center', padding: '1rem', background: '#fdf2e8', borderRadius: '8px', border: '2px solid #e74c3c' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#e74c3c' }}>
                    {data.statistics.max_anomaly.toFixed(1)}°C
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#e74c3c', fontWeight: '600' }}>WARMEST SPOT</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '1.5rem',
            boxShadow: '0 4px 25px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: '#2c3e50' }}>📋 Map Info</h3>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#555' }}>
              <p><strong>Coverage:</strong> North America</p>
              <p><strong>Countries:</strong> USA, Canada, Mexico</p>
              <p><strong>Resolution:</strong> GFS 0.25°</p>
              <p><strong>Update:</strong> Every 6 hours</p>
              <p><strong>Projection:</strong> Geographic</p>
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

// Render the App
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;