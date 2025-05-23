from fastapi import APIRouter, HTTPException, Query
import logging
from ..services.gfs_service import RealGFSDataService, MockGFSDataService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["temperature"])

# Initialize services
real_gfs_service = RealGFSDataService()
mock_service = MockGFSDataService()

@router.get("/temperature/anomaly")
async def get_temperature_anomaly(
    forecast_hour: int = Query(0, ge=0, le=384, description="Forecast hour (0-384)"),
    use_mock: bool = Query(False, description="Force use of mock data for testing")
):
    """
    Get high-resolution North American temperature anomaly data
    
    - **forecast_hour**: Hours from model initialization (0-384)
    - **use_mock**: Force use of mock data instead of real GFS data
    """
    try:
        if use_mock:
            logger.info("Using mock data service (forced)")
            data = await mock_service.get_temperature_anomaly_data(forecast_hour)
        else:
            logger.info("Attempting to fetch real GFS data")
            data = await real_gfs_service.get_temperature_anomaly_data(forecast_hour)
            
            # Fall back to mock data if real data fails
            if "error" in data:
                logger.warning(f"Real GFS data failed: {data['error']}")
                logger.info("Falling back to high-resolution mock data")
                data = await mock_service.get_temperature_anomaly_data(forecast_hour)
        
        return data
        
    except Exception as e:
        logger.error(f"Error in temperature anomaly endpoint: {e}")
        # Final fallback to mock data
        try:
            logger.info("Final fallback to mock data")
            return await mock_service.get_temperature_anomaly_data(forecast_hour)
        except Exception as fallback_error:
            logger.error(f"Even mock data failed: {fallback_error}")
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/temperature/forecast-hours")
async def get_available_forecast_hours():
    """Get list of available forecast hours"""
    return {
        "forecast_hours": list(range(0, 385, 6)),  # Every 6 hours up to 384
        "description": "Available forecast hours from GFS model initialization"
    }

@router.get("/temperature/latest-run")
async def get_latest_run_info():
    """Get information about the latest GFS model run"""
    try:
        run_time = await real_gfs_service.get_latest_run_time()
        return {
            "latest_run": run_time.isoformat(),
            "run_cycle": f"{run_time.hour:02d}Z",
            "model": "GFS 0.25 degree",
            "source": "NOAA NOMADS"
        }
    except Exception as e:
        logger.error(f"Error getting latest run info: {e}")
        raise HTTPException(status_code=500, detail=str(e))