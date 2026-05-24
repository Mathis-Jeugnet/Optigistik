from pydantic import BaseModel
from typing import List, Optional

class TimeWindow(BaseModel):
    start: int
    end: int

class Node(BaseModel):
    id: str
    x: float
    y: float
    demand: int
    service_time: int
    time_window: Optional[TimeWindow] = None
    allowed_vehicle_types: Optional[List[str]] = None

class Vehicle(BaseModel):
    id: str
    capacity: int
    max_service_time: int
    is_night_shift: bool = False
    vehicle_type: str = "STANDARD"
    # Gestion dissociée des dépôts (0 par défaut pour la rétrocompatibilité)
    start_node_idx: int = 0
    end_node_idx: int = 0

class OptimizationRequest(BaseModel):
    distance_matrix: List[List[int]]
    time_matrix: List[List[int]]
    nodes: List[Node]
    vehicles: List[Vehicle]
    enable_soft_time_windows: bool = False
    time_window_penalty: int = 0
    enforce_break: bool = True
    break_duration_seconds: int = 2700