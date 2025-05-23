import numpy as np
from datetime import datetime, timedelta
from typing import Dict
import logging

logger = logging.getLogger(__name__)

class MockGFSDataService:
    """Mock service that generates synthetic temperature anomaly data"""
    
    async def get_temperature_anomaly_data(self, forecast_hour: int = 0) -> Dict:
        """Generate mock temperature anomaly data"""
        try:
            # Create synthetic data
            lats = np.linspace(90, -90, 181)  # 1-degree resolution
            lons = np.linspace(-180, 179, 360)
            
            # Generate realistic-looking temperature anomalies
            lon_grid, lat_grid = np.meshgrid(lons, lats)
            
            # Create some interesting patterns focused on North America
            anomaly = (
                3 * np.sin(np.radians(lat_grid) * 2) * np.cos(np.radians(lon_grid) * 3) +
                2 * np.sin(np.radians(lat_grid) * 3) * np.sin(np.radians(lon_grid) * 2) +
                np.random.normal(0, 1, lat_grid.shape)
            )
            
            # Add some regional patterns for North America
            anomaly += 5 * np.exp(-((lat_grid - 45)**2 + (lon_grid - (-100))**2) / 500)  # North America warm spot
            anomaly -= 3 * np.exp(-((lat_grid - 55)**2 + (lon_grid - (-110))**2) / 400)  # Canada cold spot
            anomaly += 4 * np.exp(-((lat_grid - 35)**2 + (lon_grid - (-95))**2) / 600)   # Southern US warm spot
            
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
        except Exception as e:
            logger.error(f"Error generating mock data: {e}")
            return {"error": str(e)}