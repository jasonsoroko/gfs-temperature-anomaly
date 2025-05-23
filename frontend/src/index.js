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
    
    // Reduced point density for cleaner look
    for (let i = 0; i < lats.length; i += 8) {
      for (let j = 0; j < lons.length; j += 8) {
        const lat = lats[i];
        const lon = lons[j];
        
        // Filter to North America only
        if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
          if (values[i] && values[i][j] !== undefined) {
            const normalized = (values[i][j] - min_anomaly) / (max_anomaly - min_anomaly);
            let color = '#ffffff';
            let size = 0;
            
            // Professional color scheme with appropriate sizing
            if (normalized < 0.1) {
              color = '#1a237e';
              size = 5;
            } else if (normalized < 0.3) {
              color = '#3949ab';
              size = 4;
            } else if (normalized < 0.4) {
              color = '#5e35b1';
              size = 3;
            } else if (normalized < 0.6) {
              color = '#90caf9';
              size = 2;
            } else if (normalized < 0.7) {
              color = '#fff176';
              size = 3;
            } else if (normalized < 0.9) {
              color = '#ff9800';
              size = 4;
            } else {
              color = '#d32f2f';
              size = 5;
            }
            
            // Map to North America view
            const x = ((lon - minLon) / (maxLon - minLon)) * 800;
            const y = ((maxLat - lat) / (maxLat - minLat)) * 500;
            
            points.push({
              x,
              y,
              color,
              size,
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
          GFS Model Analysis • High Resolution Temperature Departures
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
                {data.mock_data ? 'Demonstration Data' : 'Live GFS Data'} • Forecast: +{forecastHour}h
              </div>
            </div>
          )}

          {loading && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              height: '500px', 
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
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Loading temperature analysis...</p>
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
                <svg width="800" height="500" viewBox="0 0 800 500" style={{ display: 'block' }}>
                  <rect width="800" height="500" fill="#f8f9fa"/>
                  
                  <g stroke="#666" strokeWidth="1.5" fill="none">
                    <path d="M 120 280 Q 100 270 90 250 Q 85 230 95 210 Q 110 190 140 180 Q 180 170 220 175 Q 280 180 340 185 Q 400 190 460 195 Q 520 200 580 205 Q 640 210 690 220 Q 730 230 750 250 Q 760 270 755 290 Q 750 310 730 325 Q 700 340 660 345 Q 620 350 580 345 Q 540 340 500 335 Q 460 330 420 325 Q 380 320 340 315 Q 300 310 260 305 Q 220 300 180 295 Q 140 290 120 280 Z"/>
                    <path d="M 100 150 Q 80 140 75 120 Q 70 100 85 85 Q 105 70 135 65 Q 180 60 225 65 Q 290 70 355 75 Q 420 80 485 85 Q 550 90 615 95 Q 680 100 735 110 Q 770 120 785 140 Q 790 160 775 180 Q 760 200 735 210 Q 700 220 665 215 Q 630 210 595 205 Q 560 200 525 195 Q 490 190 455 185 Q 420 180 385 175 Q 350 170 315 165 Q 280 160 245 155 Q 210 150 175 145 Q 140 140 115 135 Q 100 130 100 150 Z"/>
                    <path d="M 200 380 Q 190 370 188 355 Q 186 340 195 325 Q 210 310 235 305 Q 270 300 305 305 Q 340 310 375 315 Q 410 320 445 325 Q 480 330 510 340 Q 535 350 545 370 Q 550 390 535 405 Q 520 420 495 425 Q 470 430 445 425 Q 420 420 395 415 Q 370 410 345 405 Q 320 400 295 395 Q 270 390 245 385 Q 220 380 200 380 Z"/>
                  </g>
                  
                  <g stroke="#2196F3" strokeWidth="1" fill="rgba(33, 150, 243, 0.1)">
                    <ellipse cx="550" cy="220" rx="18" ry="12"/>
                    <ellipse cx="580" cy="230" rx="15" ry="10"/>
                    <ellipse cx="520" cy="235" rx="12" ry="8"/>
                    <ellipse cx="490" cy="245" rx="10" ry="6"/>
                    <ellipse cx="605" cy="225" rx="8" ry="5"/>
                  </g>
                  
                  <ellipse cx="450" cy="120" rx="25" ry="35" stroke="#2196F3" strokeWidth="1" fill="rgba(33, 150, 243, 0.1)"/>
                  
                  {points.map((point, i) => (
                    <circle
                      key={i}
                      cx={point.x}
                      cy={point.y}
                      r={point.size}
                      fill={point.color}
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth="0.5"
                      opacity="0.85"
                    />
                  ))}
                  
                  <text x="450" y="130" fontSize="14" fontWeight="600" fill="#444" textAnchor="middle" fontFamily="system-ui">CANADA</text>
                  <text x="420" y="270" fontSize="14" fontWeight="600" fill="#444" textAnchor="middle" fontFamily="system-ui">UNITED STATES</text>
                  <text x="350" y="380" fontSize="14" fontWeight="600" fill="#444" textAnchor="middle" fontFamily="system-ui">MEXICO</text>
                  
                  <g stroke="white" strokeWidth="1" fill="#1976d2">
                    <circle cx="130" cy="190" r="2"/>
                    <circle cx="380" cy="220" r="2"/>
                    <circle cx="600" cy="240" r="2"/>
                    <circle cx="250" cy="340" r="2"/>
                    <circle cx="560" cy="310" r="2"/>
                    <circle cx="350" cy="410" r="2"/>
                  </g>
                  
                  <g fontSize="10" fill="#1976d2" fontFamily="system-ui" fontWeight="500">
                    <text x="135" y="186">Vancouver</text>
                    <text x="385" y="216">Chicago</text>
                    <text x="605" y="236">New York</text>
                    <text x="255" y="336">Los Angeles</text>
                    <text x="565" y="306">Miami</text>
                    <text x="355" y="406">Mexico City</text>
                  </g>
                </svg>
              </div>

              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1.5rem', 
                background: '#ffffff', 
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                width: '100%',
                maxWidth: '800px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '1rem' }}>
                  Temperature Anomaly Scale (°C)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#1a237e', borderRadius: '50%' }}></div>
                    <span>Much Colder ({data.statistics.min_anomaly.toFixed(1)}°)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#3949ab', borderRadius: '50%' }}></div>
                    <span>Colder</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#90caf9', borderRadius: '50%' }}></div>
                    <span>Near Normal</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#ff9800', borderRadius: '50%' }}></div>
                    <span>Warmer</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#d32f2f', borderRadius: '50%' }}></div>
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
            <h3 style={{ margin: '0 0 1rem', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>Model Info</h3>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.4', color: '#666' }}>
              <div style={{ marginBottom: '0.5rem' }}><strong>Model:</strong> GFS 0.25°</div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Resolution:</strong> ~25 km</div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Coverage:</strong> North America</div>
              <div style={{ marginBottom: '0.5rem' }}><strong>Updates:</strong> 4x daily</div>
              <div><strong>Source:</strong> NOAA/NCEP</div>
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