from fastapi import APIRouter, HTTPException, Query
import logging
from ..services.gfs_service import MockGFSDataService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["temperature"])

# Initialize service
mock_service = MockGFSDataService()

@router.get("/temperature/anomaly")
async def get_temperature_anomaly(
    forecast_hour: int = Query(0, ge=0, le=384, description="Forecast hour (0-384)"),
    use_mock: bool = Query(True, description="Use mock data for testing")
):
    """
    Get temperature anomaly data for visualization
    """
    try:
        logger.info(f"Getting temperature anomaly data for hour {forecast_hour}")
        data = await mock_service.get_temperature_anomaly_data(forecast_hour)
        return data
        
    except Exception as e:
        logger.error(f"Error in temperature anomaly endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))