import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';


const App = () => {
  console.log("App component rendering!");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [forecastHour, setForecastHour] = useState(0);
  const [worldData, setWorldData] = useState(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);

  // Load world topology data
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
      .then(response => response.json())
      .then(data => {
        setWorldData(data);
      })
      .catch(err => console.error('Error loading world data:', err));
  }, []);

  const fetchData = async (hour = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/v1/temperature/anomaly?forecast_hour=${hour}&use_mock=false`
      );
      
   // Comment out or remove these lines:
    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status}`);
    // }
      
      const result = await response.json();
      console.log('Fetched data:', result); // DEBUG
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(forecastHour);
  }, [forecastHour]);

  // Create D3 visualization
  useEffect(() => {
    console.log("DEBUG: useEffect trigger", {
      hasData: !!data,
      hasAnomaly: !!data?.anomaly_data,
      hasWorldData: !!worldData,
      hasSVG: !!svgRef.current
    });
    if (!data?.anomaly_data || !worldData || !svgRef.current) {
      console.log("DEBUG: Not rendering, missing dependency", {
        data,
        anomaly_data: data?.anomaly_data,
        worldData,
        svg: svgRef.current
      });
      return;
    }

    const { lats, lons, values } = data.anomaly_data;
    const { min_anomaly, max_anomaly } = data.statistics;

    // DEBUG: Log data structure
    console.log('=== VISUALIZATION DEBUG ===');
    console.log('Data structure:', {
      latsLength: lats.length,
      lonsLength: lons.length,
      valuesLength: values.length,
      firstLat: lats[0],
      lastLat: lats[lats.length - 1],
      firstLon: lons[0],
      lastLon: lons[lons.length - 1],
      sampleValue: values[0]?.[0]
    });

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    // --- BEGIN: SVG TEST SHAPES ---
    const width = 1000;
    const height = 700;
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('background', '#f0f8ff');

    // Draw a huge blue circle at SVG center
    svg.append('circle')
      .attr('cx', width / 2)
      .attr('cy', height / 2)
      .attr('r', 80)
      .attr('fill', 'blue')
      .attr('opacity', 0.7);

    // Draw a red rectangle in upper left
    svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 200)
      .attr('height', 80)
      .attr('fill', 'red')
      .attr('opacity', 0.5);

    // Write 'SVG TEST' in the center
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '40px')
      .attr('fill', 'white')
      .attr('font-weight', 'bold')
      .text('SVG TEST');
    // --- END: SVG TEST SHAPES ---

// Create projection focused on North America
const projection = d3.geoAzimuthalEqualArea()
  .rotate([100, -45])
  .scale(600)
  .translate([width / 2, height / 2])
  .clipAngle(180 - 1e-3)
  .precision(1);

// --- PLACE THIS BLOCK HERE ---
const cochraneCoords = projection([-81.0177, 49.7859]);
console.log('Placing debug circle at:', cochraneCoords);
if (cochraneCoords) {
  svg.append('circle')
    .attr('cx', cochraneCoords[0])
    .attr('cy', cochraneCoords[1])
    .attr('r', 40)
    .attr('fill', 'red')
    .attr('opacity', 0.5);
  svg.append('text')
    .attr('x', cochraneCoords[0])
    .attr('y', cochraneCoords[1] + 55)
    .attr('font-size', '20px')
    .attr('fill', 'red')
    .attr('text-anchor', 'middle')
    .text('Cochrane ON');
}



    // DEBUG: Test projection
    console.log('Testing projection:');
    console.log('New York [-74, 40.7]:', projection([-74, 40.7]));
    console.log('Los Angeles [-118.2, 34]:', projection([-118.2, 34]));
    console.log('Center of data:', projection([(lons[0] + lons[lons.length-1])/2, (lats[0] + lats[lats.length-1])/2]));

    const path = d3.geoPath().projection(projection);

    // Create color scale (reversed so blue is cold, red is hot)
    const colorScale = d3.scaleSequential()
      .domain([max_anomaly, min_anomaly]) // Reversed domain
      .interpolator(d3.interpolateRdBu)
      .clamp(true);

    // Draw world map first
    const world = topojson.feature(worldData, worldData.objects.countries);
    const northAmericaCountries = [840, 124, 484]; // USA, Canada, Mexico
    
    svg.append('g')
      .attr('class', 'countries')
      .selectAll('path')
      .data(world.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('fill', '#f5f5f5')
      .attr('stroke', d => northAmericaCountries.includes(d.id) ? '#333' : '#ccc')
      .attr('stroke-width', d => northAmericaCountries.includes(d.id) ? 1.5 : 0.5);

    // Create a group for temperature data
    const tempGroup = svg.append('g').attr('class', 'temperature-data');

    // Debug: show sample longitude fix before circle-drawing loop
    console.log('Sample lon before/after fix:', lons[0], lons[0] > 180 ? lons[0] - 360 : lons[0]);

    // Draw temperature data as circles
    let successfulPoints = 0;
    let failedPoints = 0;

    for (let i = 0; i < lats.length; i += 5) { // Sample every 5th point for performance
      for (let j = 0; j < lons.length; j += 5) {
        if (values[i] && values[i][j] !== undefined && !isNaN(values[i][j])) {
          // Convert 0–360° lon → -180…180° expected by the projection
          const lonFixed = lons[j] > 180 ? lons[j] - 360 : lons[j];
          const coords = projection([lonFixed, lats[i]]);
          
          // DEBUG: Log first few projections
          if (successfulPoints < 5) {
            console.log(`Point ${i},${j}: [${lons[j]}, ${lats[i]}] (fixed: ${lonFixed}) -> ${coords ? `[${coords[0]?.toFixed(1)}, ${coords[1]?.toFixed(1)}]` : 'null'}`);
          }

          if (coords) {
            tempGroup.append('circle')
              .attr('cx', coords[0])
              .attr('cy', coords[1])
              .attr('r', 6) // slightly smaller radius
              .attr('fill', colorScale(values[i][j]))
              .attr('fill-opacity', 0.75)
              .attr('stroke', '#222')
              .attr('stroke-width', 0.4);
            successfulPoints++;
          } else {
            failedPoints++;
          }
        }
      }
    }

    console.log('Visualization results:', {
      successfulPoints,
      failedPoints,
      totalCircles: document.querySelectorAll('.temperature-data circle').length
    });

    // Add graticule (grid lines)
    const graticule = d3.geoGraticule()
      .step([10, 10]);
    
    svg.append('path')
      .datum(graticule)
      .attr('class', 'graticule')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.5);

    // Add major cities
    const cities = [
      { name: 'New York', coords: [-74.006, 40.7128] },
      { name: 'Los Angeles', coords: [-118.2437, 34.0522] },
      { name: 'Chicago', coords: [-87.6298, 41.8781] },
      { name: 'Toronto', coords: [-79.3832, 43.6532] },
      { name: 'Mexico City', coords: [-99.1332, 19.4326] },
      { name: 'Vancouver', coords: [-123.1207, 49.2827] },
      { name: 'Montreal', coords: [-73.5673, 45.5017] },
      { name: 'Miami', coords: [-80.1918, 25.7617] },
      { name: 'Denver', coords: [-104.9903, 39.7392] },
      { name: 'Seattle', coords: [-122.3321, 47.6062] }
    ];

    const cityGroup = svg.append('g').attr('class', 'cities');

    cities.forEach(city => {
      const projected = projection(city.coords);
      if (projected) {
        // City dot
        cityGroup.append('circle')
          .attr('cx', projected[0])
          .attr('cy', projected[1])
          .attr('r', 3)
          .attr('fill', '#fff')
          .attr('stroke', '#333')
          .attr('stroke-width', 1.5);

        // City label
        cityGroup.append('text')
          .attr('x', projected[0])
          .attr('y', projected[1])
          .attr('dx', 5)
          .attr('dy', -5)
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .attr('fill', '#333')
          .attr('stroke', 'white')
          .attr('stroke-width', 3)
          .attr('paint-order', 'stroke')
          .text(city.name);
      }
    });

    // Add simple test rectangle to verify SVG is working
    svg.append('rect')
      .attr('x', 10)
      .attr('y', 10)
      .attr('width', 100)
      .attr('height', 20)
      .attr('fill', 'red')
      .attr('opacity', 0.5);
    
    svg.append('text')
      .attr('x', 15)
      .attr('y', 25)
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .text('DEBUG: SVG Working');

    // === FINAL TEST SHAPES (SHOULD ALWAYS BE VISIBLE) ===
    svg.append('rect')
      .attr('x', 100)
      .attr('y', 100)
      .attr('width', 200)
      .attr('height', 80)
      .attr('fill', 'red')
      .attr('opacity', 1.0);

    svg.append('circle')
      .attr('cx', 500)
      .attr('cy', 350)
      .attr('r', 80)
      .attr('fill', 'blue')
      .attr('opacity', 1.0);

    svg.append('text')
      .attr('x', 600)
      .attr('y', 200)
      .attr('text-anchor', 'middle')
      .attr('font-size', '48px')
      .attr('fill', 'black')
      .attr('font-weight', 'bold')
      .text('SVG TEST TOP');

  }, [data, worldData]);

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
          North America Temperature Anomaly (DEBUG MODE)
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: '#7f8c8d', fontSize: '1.1rem' }}>
          Check browser console for debug information
        </p>
      </div>

      <div style={{ padding: '2rem', display: 'flex', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          flex: 1, 
          background: 'white', 
          borderRadius: '8px', 
          padding: '2rem',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          position: 'relative'
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
                {data.mock_data ? 'High-Resolution Demonstration Data' : 'Live GFS Data'} • 
                Resolution: {data.resolution} • Forecast: +{forecastHour}h
              </div>
            </div>
          )}

          {loading && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              height: '700px', 
              justifyContent: 'center',
              color: '#666'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ marginTop: '1rem', fontSize: '1rem' }}>Loading high-resolution temperature data...</p>
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
              <svg ref={svgRef} style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '6px',
                background: '#f0f8ff'
              }}></svg>

              {/* Temperature scale legend */}
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1.5rem', 
                background: '#ffffff', 
                borderRadius: '6px',
                border: '1px solid #e0e0e0',
                width: '100%',
                maxWidth: '1000px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '1rem', color: '#333', fontSize: '1rem' }}>
                  Temperature Anomaly Scale (°C)
                </div>
                <div style={{ 
                  height: '30px', 
                  background: `linear-gradient(to right, 
                    #053061 0%, #2166ac 10%, #4393c3 20%, #92c5de 30%, #d1e5f0 40%, 
                    #f7f7f7 50%, 
                    #fddbc7 60%, #f4a582 70%, #d6604d 80%, #b2182b 90%, #67001f 100%)`,
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#666' }}>
                  <span>{data.statistics.min_anomaly.toFixed(1)}°C</span>
                  <span>0°C</span>
                  <span>+{data.statistics.max_anomaly.toFixed(1)}°C</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '8px', 
            padding: '1.5rem',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>
              Forecast Controls
            </h3>
            
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
                <option value={96}>+4 days</option>
                <option value={120}>+5 days</option>
                <option value={144}>+6 days</option>
                <option value={168}>+7 days</option>
                <option value={240}>+10 days</option>
                <option value={384}>+16 days</option>
              </select>
            </div>

            <button 
              onClick={() => fetchData(forecastHour)}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: loading ? '#f5f5f5' : '#667eea',
                color: loading ? '#999' : 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>

          {data && (
            <>
              <div style={{ 
                background: 'white', 
                borderRadius: '8px', 
                padding: '1.5rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 1rem', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>
                  Debug Info
                </h3>
                <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#666' }}>
                  <div>Grid: {data.anomaly_data?.lats?.length} x {data.anomaly_data?.lons?.length}</div>
                  <div>Lat: {data.anomaly_data?.lats?.[0]?.toFixed(1)}° to {data.anomaly_data?.lats?.[data.anomaly_data.lats.length-1]?.toFixed(1)}°</div>
                  <div>Lon: {data.anomaly_data?.lons?.[0]?.toFixed(1)}° to {data.anomaly_data?.lons?.[data.anomaly_data.lons.length-1]?.toFixed(1)}°</div>
                  <div>Circles: <span id="circle-count">Check console</span></div>
                </div>
              </div>

              <div style={{ 
                background: 'white', 
                borderRadius: '8px', 
                padding: '1.5rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{ margin: '0 0 1rem', color: '#333', fontSize: '1.1rem', fontWeight: '600' }}>
                  Statistics
                </h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '1rem', 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    borderRadius: '6px',
                    color: 'white'
                  }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: '600' }}>
                      {data.statistics.min_anomaly.toFixed(1)}°C
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.9 }}>
                      Coldest Anomaly
                    </div>
                  </div>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '1rem', 
                    background: '#f5f5f5', 
                    borderRadius: '6px' 
                  }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: '600', color: '#666' }}>
                      {data.statistics.mean_anomaly.toFixed(1)}°C
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                      Continental Average
                    </div>
                  </div>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '1rem', 
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
                    borderRadius: '6px',
                    color: 'white'
                  }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: '600' }}>
                      +{data.statistics.max_anomaly.toFixed(1)}°C
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', opacity: 0.9 }}>
                      Warmest Anomaly
                    </div>
                  </div>
                </div>
              </div>
            </>
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


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

export default App;