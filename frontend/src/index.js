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