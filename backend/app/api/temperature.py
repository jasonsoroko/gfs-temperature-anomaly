from fastapi import APIRouter, HTTPException, Query
import logging
from ..services.gfs_service import GFSDataService, MockGFSDataService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["temperature"])

# Initialize services
gfs_service = GFSDataService()
mock_service = MockGFSDataService()

@router.get("/temperature/anomaly")
async def get_temperature_anomaly(
    forecast_hour: int = Query(0, ge=0, le=384, description="Forecast hour (0-384)"),
    use_mock: bool = Query(False, description="Use mock data for testing")
):
    """
    Get temperature anomaly data for visualization
    """
    try:
        if use_mock:
            logger.info("Using mock GFS data service")
            data = await mock_service.get_temperature_anomaly_data(forecast_hour)
        else:
            logger.info("Attempting to use real GFS data service")
            data = await gfs_service.get_temperature_anomaly_data(forecast_hour)
            
            # Fall back to mock data if real data fails
            if "error" in data:
                logger.warning(f"Real GFS data failed: {data['error']}, falling back to mock data")
                data = await mock_service.get_temperature_anomaly_data(forecast_hour)
        
        return data
        
    except Exception as e:
        logger.error(f"Error in temperature anomaly endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))