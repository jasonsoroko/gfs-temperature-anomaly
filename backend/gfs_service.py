# This should be saved as backend/app/services/gfs_service.py

import asyncio
import numpy as np
import xarray as xr
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import httpx
import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class GFSDataService:
    """Service for fetching and processing GFS temperature anomaly data"""
    
    def __init__(self):
        self.base_url = "https://nomads.ncep.noaa.gov/dods/gfs_0p25"
        self.cache_dir = Path("/app/cache")
        self.cache_dir.mkdir(exist_ok=True)
        
    async def get_latest_run_time(self) -> datetime:
        """Get the latest available GFS model run time"""
        now = datetime.utcnow()
        # GFS runs at 00, 06, 12, 18 UTC
        run_hours = [0, 6, 12, 18]
        
        for hours_back in range(0, 24, 6):
            check_time = now - timedelta(hours=hours_back)
            for run_hour in reversed(run_hours):
                if check_time.hour >= run_hour:
                    run_time = check_time.replace(hour=run_hour, minute=0, second=0, microsecond=0)
                    return run_time
        
        # Fallback to previous day's 18Z run
        yesterday = now - timedelta(days=1)
        return yesterday.replace(hour=18, minute=0, second=0, microsecond=0)
    
    async def fetch_temperature_data(self, run_time: datetime, forecast_hour: int = 0) -> Optional[xr.Dataset]:
        """Fetch temperature data from GFS for a specific run and forecast hour"""
        try:
            date_str = run_time.strftime("%Y%m%d")
            hour_str = run_time.strftime("%H")
            
            # Construct NOMADS OpenDAP URL
            url = f"{self.base_url}/gfs{date_str}/gfs_0p25_{hour_str}z"
            
            logger.info(f"Fetching GFS data from: {url}")
            
            # Try to open the dataset with xarray
            ds = xr.open_dataset(url, engine='netcdf4')
            
            # Select 2m temperature and extract for specific forecast hour
            temp_data = ds.sel(time=ds.time[forecast_hour])['tmp2m']
            
            return temp_data.to_dataset()
            
        except Exception as e:
            logger.error(f"Error fetching GFS data: {e}")
            return None
    
    async def calculate_temperature_anomaly(self, current_temp: xr.Dataset, climatology: Optional[xr.Dataset] = None) -> xr.Dataset:
        """Calculate temperature anomaly from climatology"""
        if climatology is None:
            # Use a simple approximation - subtract seasonal average
            # In a real implementation, you'd use historical climatology data
            climatology_temp = self.get_seasonal_climatology(current_temp)
        else:
            climatology_temp = climatology
            
        # Calculate anomaly
        anomaly = current_temp - climatology_temp
        return anomaly
    
    def get_seasonal_climatology(self, temp_data: xr.Dataset) -> xr.Dataset:
        """Get seasonal climatology approximation"""
        # Simple approximation - use global average as baseline
        # In reality, this would be based on 30-year climate normals
        temp_array = temp_data['tmp2m'].values
        
        # Create a rough seasonal climatology based on latitude
        lats = temp_data['lat'].values
        lons = temp_data['lon'].values
        
        # Simple temperature model: decreases with latitude
        lat_grid, lon_grid = np.meshgrid(lons, lats)
        
        # Approximate seasonal temperature (this is very simplified)
        seasonal_temp = 20 - 0.7 * np.abs(lat_grid) + 273.15  # Convert to Kelvin
        
        # Create xarray dataset with same structure
        climatology = temp_data.copy()
        climatology['tmp2m'].values = seasonal_temp
        
        return climatology
    
    async def get_temperature_anomaly_data(self, forecast_hour: int = 0) -> Dict:
        """Get processed temperature anomaly data for visualization"""
        try:
            # Get latest model run
            run_time = await self.get_latest_run_time()
            
            # Fetch current temperature data
            temp_data = await self.fetch_temperature_data(run_time, forecast_hour)
            
            if temp_data is None:
                return {"error": "Could not fetch temperature data"}
            
            # Calculate anomaly
            anomaly_data = await self.calculate_temperature_anomaly(temp_data)
            
            # Convert to format suitable for frontend
            result = self.format_for_frontend(anomaly_data, run_time, forecast_hour)
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing temperature anomaly data: {e}")
            return {"error": str(e)}
    
    def format_for_frontend(self, anomaly_data: xr.Dataset, run_time: datetime, forecast_hour: int) -> Dict:
        """Format data for frontend consumption"""
        try:
            # Extract anomaly values
            anomaly_values = anomaly_data['tmp2m'].values
            lats = anomaly_data['lat'].values
            lons = anomaly_data['lon'].values
            
            # Convert to lists for JSON serialization
            return {
                "run_time": run_time.isoformat(),
                "forecast_hour": forecast_hour,
                "valid_time": (run_time + timedelta(hours=forecast_hour)).isoformat(),
                "anomaly_data": {
                    "lats": lats.tolist(),
                    "lons": lons.tolist(),
                    "values": anomaly_values.tolist()
                },
                "statistics": {
                    "min_anomaly": float(np.nanmin(anomaly_values)),
                    "max_anomaly": float(np.nanmax(anomaly_values)),
                    "mean_anomaly": float(np.nanmean(anomaly_values))
                }
            }
        except Exception as e:
            logger.error(f"Error formatting data: {e}")
            return {"error": f"Error formatting data: {str(e)}"}

# Fallback service for when NOMADS is unavailable
class MockGFSDataService:
    """Mock service that generates synthetic temperature anomaly data"""
    
    async def get_temperature_anomaly_data(self, forecast_hour: int = 0) -> Dict:
        """Generate mock temperature anomaly data"""
        # Create synthetic data
        lats = np.linspace(90, -90, 181)  # 1-degree resolution
        lons = np.linspace(-180, 179, 360)
        
        # Generate realistic-looking temperature anomalies
        lon_grid, lat_grid = np.meshgrid(lons, lats)
        
        # Create some interesting patterns
        anomaly = (
            3 * np.sin(np.radians(lat_grid) * 2) * np.cos(np.radians(lon_grid) * 3) +
            2 * np.sin(np.radians(lat_grid) * 3) * np.sin(np.radians(lon_grid) * 2) +
            np.random.normal(0, 1, lat_grid.shape)
        )
        
        # Add some regional patterns
        anomaly += 5 * np.exp(-((lat_grid - 45)**2 + (lon_grid - (-100))**2) / 500)  # North America warm spot
        anomaly -= 4 * np.exp(-((lat_grid - 60)**2 + (lon_grid - 30)**2) / 300)    # Europe cold spot
        
        now = datetime.utcnow()
        run_time = now.replace(minute=0, second=0, microsecond=0)
        
        return {
            "run_time": run_time.isoformat(),
            "forecast_hour": forecast_hour,
            "valid_time": (run_time + timedelta(hours=forecast_hour)).isoformat(),
            "anomaly_data": {
                "lats": lats.tolist(),
                "lons": lons.tolist(),
                "values": anomaly.tolist()
            },
            "statistics": {
                "min_anomaly": float(np.min(anomaly)),
                "max_anomaly": float(np.max(anomaly)),
                "mean_anomaly": float(np.mean(anomaly))
            },
            "mock_data": True
        }