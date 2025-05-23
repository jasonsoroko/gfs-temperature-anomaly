import numpy as np
import xarray as xr
import httpx
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging
import asyncio

logger = logging.getLogger(__name__)

class RealGFSDataService:
    """Service for fetching real high-resolution GFS temperature anomaly data"""
    
    def __init__(self):
        self.base_url = "https://nomads.ncep.noaa.gov/dods/gfs_0p25"
        self.backup_url = "https://thredds.ucar.edu/thredds/dodsC/grib/NCEP/GFS/Global_0p25deg"
        
    async def get_latest_run_time(self) -> datetime:
        """Get the latest available GFS model run time"""
        now = datetime.utcnow()
        # GFS runs at 00, 06, 12, 18 UTC, available ~3.5 hours after run time
        run_hours = [0, 6, 12, 18]
        
        # Check recent runs, accounting for processing delay
        for hours_back in range(4, 25, 6):  # Start 4 hours back to account for processing time
            check_time = now - timedelta(hours=hours_back)
            for run_hour in reversed(run_hours):
                if check_time.hour >= run_hour:
                    run_time = check_time.replace(hour=run_hour, minute=0, second=0, microsecond=0)
                    return run_time
        
        # Fallback to previous day's 18Z run
        yesterday = now - timedelta(days=1)
        return yesterday.replace(hour=18, minute=0, second=0, microsecond=0)
    
    async def fetch_gfs_temperature(self, run_time: datetime, forecast_hour: int = 0) -> Optional[xr.Dataset]:
        """Fetch real GFS temperature data from NOMADS"""
        try:
            date_str = run_time.strftime("%Y%m%d")
            hour_str = f"{run_time.hour:02d}"

            # Try primary NOMADS URL first
            urls_to_try = [
                f"{self.base_url}/gfs{date_str}/gfs_0p25_{hour_str}z",
                f"{self.backup_url}/GFS_Global_0p25deg_{date_str}_{hour_str}00.grib2"
            ]

            for url in urls_to_try:
                try:
                    logger.info(f"Attempting to fetch GFS data from: {url}")

                    # For NOMADS, we can use OpenDAP subsetting to get only what we need
                    if "nomads" in url:
                        # --- Coordinate‑based slicing (no guess‑work on array indices) ---
                        time_idx = forecast_hour // 3  # GFS outputs every 3 h

                        # Build a minimal OPeNDAP URL requesting only the chosen time slice & variable
                        slice_url = f"{url}?tmp2m[{time_idx}:1:{time_idx}]"

                        # Use pydap for NOMADS – lightweight and avoids the “netCDF4 compiled without DAP” issue
                        engine = "pydap"
                        logger.debug(f"OPeNDAP fetch: {slice_url} (engine={engine})")

                        ds = await asyncio.wait_for(
                            asyncio.to_thread(xr.open_dataset, slice_url, engine=engine),
                            timeout=60.0,
                        )

                        # Select the North‑America window by **coordinates**:
                        # GFS longitudes are 0–360; 170 W→50 W  == 190→310
                        ds = ds.sel(lat=slice(85, 15), lon=slice(190, 310))

                    else:
                        # UCAR THREDDS GRIB2 fallback – still use netcdf4
                        engine = "netcdf4"
                        logger.debug(f"THREDDS fetch: {url} (engine={engine})")

                        ds = await asyncio.wait_for(
                            asyncio.to_thread(xr.open_dataset, url, engine=engine),
                            timeout=60.0,
                        )

                    # Extract temperature variable
                    if "tmp2m" in ds.variables:
                        temp_data = ds["tmp2m"]
                    elif "TMP_2maboveground" in ds.variables:
                        temp_data = ds["TMP_2maboveground"]
                    else:
                        logger.warning(
                            f"No temperature variable found. Available variables: {list(ds.variables.keys())}"
                        )
                        continue

                    # Ensure we have valid data
                    if temp_data.size == 0:
                        logger.warning("Empty temperature data")
                        continue

                    logger.info(f"Successfully fetched GFS data from {url}")
                    logger.info(f"Data shape: {temp_data.shape}, dims: {temp_data.dims}")

                    return temp_data.to_dataset(name="temperature")

                except asyncio.TimeoutError:
                    logger.warning(f"Timeout fetching from {url}")
                    continue
                except Exception as e:
                    logger.warning(f"Failed to fetch from {url}: {e}")
                    continue

            logger.error("All GFS data sources failed")
            return None

        except Exception as e:
            logger.error(f"Error in fetch_gfs_temperature: {e}")
            return None
    
    def calculate_temperature_anomaly(self, temp_data: xr.Dataset) -> xr.Dataset:
        """Calculate temperature anomaly from climatology"""
        try:
            # Get temperature values
            if 'temperature' in temp_data:
                temp_values = temp_data['temperature'].values
                temp_var = temp_data['temperature']
            elif 'tmp2m' in temp_data:
                temp_values = temp_data['tmp2m'].values
                temp_var = temp_data['tmp2m']
            else:
                # Find the temperature variable
                for var in temp_data.data_vars:
                    temp_values = temp_data[var].values
                    temp_var = temp_data[var]
                    break
            
            # Get coordinates
            lat_name = 'lat' if 'lat' in temp_var.coords else 'latitude'
            lon_name = 'lon' if 'lon' in temp_var.coords else 'longitude'
            
            lats = temp_var[lat_name].values
            lons = temp_var[lon_name].values
            
            # Handle multi-dimensional temperature data
            if len(temp_values.shape) > 2:
                # If there's a time dimension, select the first time
                if len(temp_values.shape) == 3:
                    temp_values = temp_values[0, :, :]
                else:
                    # Squeeze out any singleton dimensions
                    temp_values = np.squeeze(temp_values)
            
            # Ensure 2D array
            if len(temp_values.shape) != 2:
                raise ValueError(f"Unexpected temperature data shape: {temp_values.shape}")
            
            logger.info(f"Temperature data shape after processing: {temp_values.shape}")
            logger.info(f"Lat range: {np.min(lats):.1f} to {np.max(lats):.1f}")
            logger.info(f"Lon range: {np.min(lons):.1f} to {np.max(lons):.1f}")
            
            # Convert temperature from Kelvin to Celsius if needed
            if np.nanmean(temp_values) > 200:  # Likely in Kelvin
                temp_values = temp_values - 273.15
                logger.info("Converted temperature from Kelvin to Celsius")
            
            # Create simplified climatology based on latitude
            lat_grid, lon_grid = np.meshgrid(lons, lats)
            
            # Get current date for seasonal adjustment
            now = datetime.utcnow()
            day_of_year = now.timetuple().tm_yday
            
            # Seasonal factor (peak summer around day 172)
            seasonal_factor = np.cos(2 * np.pi * (day_of_year - 172) / 365.25)
            
            # Approximate climatology
            base_temp = 25 - 0.7 * np.abs(lat_grid)  # Base decreases with latitude
            seasonal_adjustment = 10 * seasonal_factor * (1 - np.abs(lat_grid) / 90)  # Stronger seasonal effect at high latitudes
            continental_effect = -5 * np.exp(-((lon_grid + 100)**2) / 1000)  # Continental cooling effect
            
            climatology = base_temp + seasonal_adjustment + continental_effect
            
            # Calculate anomaly
            anomaly = temp_values - climatology
            
            # Log statistics
            valid_mask = ~np.isnan(anomaly)
            if np.any(valid_mask):
                logger.info(f"Anomaly statistics: min={np.nanmin(anomaly):.1f}, max={np.nanmax(anomaly):.1f}, mean={np.nanmean(anomaly):.1f}")
                logger.info(f"Valid data points: {np.sum(valid_mask)} out of {anomaly.size}")
            
            # Create anomaly dataset with proper coordinates
            anomaly_ds = xr.Dataset({
                'anomaly': ([lat_name, lon_name], anomaly),
            }, coords={
                lat_name: lats,
                lon_name: lons
            })
            
            return anomaly_ds
            
        except Exception as e:
            logger.error(f"Error calculating temperature anomaly: {e}")
            raise
    
    async def get_temperature_anomaly_data(self, forecast_hour: int = 0) -> Dict:
        """Get real high-resolution temperature anomaly data"""
        try:
            logger.info(f"Fetching real GFS temperature anomaly data for forecast hour {forecast_hour}")
            
            # Get latest model run time
            run_time = await self.get_latest_run_time()
            logger.info(f"Using GFS run time: {run_time}")
            
            # Fetch real temperature data
            temp_data = await self.fetch_gfs_temperature(run_time, forecast_hour)
            
            if temp_data is None:
                raise Exception("Failed to fetch GFS temperature data from all sources")
            
            # Calculate temperature anomaly
            anomaly_data = self.calculate_temperature_anomaly(temp_data)
            
            # Format for frontend
            result = self.format_for_frontend(anomaly_data, run_time, forecast_hour)
            
            logger.info("Successfully processed real GFS temperature anomaly data")
            return result
            
        except Exception as e:
            logger.error(f"Error getting real GFS data: {e}")
            # Return error that will trigger fallback to mock data
            return {"error": str(e)}
    
    def format_for_frontend(self, anomaly_data: xr.Dataset, run_time: datetime, forecast_hour: int) -> Dict:
        """Format real GFS data for frontend consumption"""
        try:
            # Get anomaly values
            anomaly_values = anomaly_data['anomaly'].values
            
            # Get coordinate names
            lat_name = 'lat' if 'lat' in anomaly_data.coords else 'latitude'
            lon_name = 'lon' if 'lon' in anomaly_data.coords else 'longitude'
            
            lats = anomaly_data[lat_name].values
            lons = anomaly_data[lon_name].values
            
            # Convert longitude to -180 to 180 if needed
            if np.max(lons) > 180:
                lons = np.where(lons > 180, lons - 360, lons)
                # Also need to reorder the data if we wrapped longitudes
                if np.any(lons < 0) and np.any(lons > 0):
                    # Find the wrapping point
                    wrap_idx = np.where(np.diff(lons) < 0)[0]
                    if len(wrap_idx) > 0:
                        wrap_idx = wrap_idx[0] + 1
                        # Reorder lons and data
                        lons = np.concatenate([lons[wrap_idx:], lons[:wrap_idx]])
                        anomaly_values = np.concatenate([anomaly_values[:, wrap_idx:], anomaly_values[:, :wrap_idx]], axis=1)
            
            # Ensure lats are in descending order (common for GFS data)
            if lats[0] < lats[-1]:
                lats = lats[::-1]
                anomaly_values = anomaly_values[::-1, :]
            
            # Check for valid data
            valid_mask = ~np.isnan(anomaly_values)
            valid_count = np.sum(valid_mask)
            total_count = anomaly_values.size
            
            logger.info(f"Data validation: {valid_count}/{total_count} valid points ({100*valid_count/total_count:.1f}%)")
            
            if valid_count == 0:
                raise ValueError("No valid temperature anomaly data")
            
            # Replace NaN with 0 for visualization
            anomaly_values_clean = np.nan_to_num(anomaly_values, nan=0.0)
            
            return {
                "run_time": run_time.isoformat(),
                "forecast_hour": forecast_hour,
                "valid_time": (run_time + timedelta(hours=forecast_hour)).isoformat(),
                "anomaly_data": {
                    "lats": lats.tolist(),
                    "lons": lons.tolist(),
                    "values": anomaly_values_clean.tolist()
                },
                "statistics": {
                    "min_anomaly": float(np.nanmin(anomaly_values)),
                    "max_anomaly": float(np.nanmax(anomaly_values)),
                    "mean_anomaly": float(np.nanmean(anomaly_values))
                },
                "source": "NOAA GFS 0.25°",
                "resolution": "0.25 degree",
                "mock_data": False  # This is real data!
            }
            
        except Exception as e:
            logger.error(f"Error formatting real GFS data: {e}")
            raise

class MockGFSDataService:
    """Fallback mock service for when real data is unavailable"""
    
    async def get_temperature_anomaly_data(self, forecast_hour: int = 0) -> Dict:
        """Generate high-quality mock temperature anomaly data focused on North America"""
        try:
            logger.info("Using mock GFS data service as fallback")
            
            # Higher resolution for North America focus
            lats = np.linspace(85, 15, 141)  # 0.5-degree resolution for North America
            lons = np.linspace(-170, -50, 241)
            
            # Generate realistic North American temperature patterns
            lon_grid, lat_grid = np.meshgrid(lons, lats)
            
            # More sophisticated temperature anomaly patterns
            # Based on typical North American weather patterns
            base_anomaly = (
                2 * np.sin(np.radians(lat_grid) * 2) * np.cos(np.radians(lon_grid + 100) * 2) +
                1.5 * np.sin(np.radians(lat_grid) * 3) * np.sin(np.radians(lon_grid + 90) * 1.5) +
                np.random.normal(0, 0.8, lat_grid.shape)
            )
            
            # Add realistic North American weather features
            # Pacific Northwest cool pattern
            pnw_cool = -3 * np.exp(-((lat_grid - 48)**2 + (lon_grid - (-123))**2) / 200)
            
            # Great Plains warm pattern  
            plains_warm = 4 * np.exp(-((lat_grid - 40)**2 + (lon_grid - (-100))**2) / 400)
            
            # Canadian Arctic cool pattern
            arctic_cool = -5 * np.exp(-((lat_grid - 70)**2 + (lon_grid - (-110))**2) / 600)
            
            # Gulf of Mexico warm pattern
            gulf_warm = 3 * np.exp(-((lat_grid - 28)**2 + (lon_grid - (-90))**2) / 300)
            
            # Rocky Mountain cool pattern
            rockies_cool = -2 * np.exp(-((lat_grid - 45)**2 + (lon_grid - (-110))**2) / 150)
            
            # Combine patterns
            anomaly = base_anomaly + pnw_cool + plains_warm + arctic_cool + gulf_warm + rockies_cool
            
            # Add seasonal variation
            now = datetime.utcnow()
            day_of_year = now.timetuple().tm_yday
            seasonal_factor = np.cos(2 * np.pi * (day_of_year - 172) / 365.25)
            anomaly += seasonal_factor * lat_grid / 30  # Stronger seasonal effect at higher latitudes
            
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
                "source": "Synthetic Data (High-Resolution)",
                "resolution": "0.5 degree",
                "mock_data": True
            }
            
        except Exception as e:
            logger.error(f"Error generating mock data: {e}")
            return {"error": str(e)}