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

class Vehicle(BaseModel):
    id: str
    capacity: int
    max_service_time: int
    is_night_shift: bool = False

class OptimizationRequest(BaseModel):
    distance_matrix: List[List[int]]
    time_matrix: List[List[int]]
    nodes: List[Node]
    vehicles: List[Vehicle]
    
    # Paramètres par défaut requis par le moteur de contraintes
    enable_soft_time_windows: bool = True
    time_window_penalty: int = 100
    enforce_break: bool = True
    break_duration_seconds: int = 2700  # 45 minutes