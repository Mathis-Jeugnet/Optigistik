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
    loading_time: int
    unloading_time: int
    time_window: Optional[TimeWindow] = None
    allowed_vehicle_types: Optional[List[str]] = None
    locked_vehicle_id: Optional[str] = None
    required_skills: Optional[List[str]] = None
    priority_level: int = 1

class Vehicle(BaseModel):
    id: str
    capacity: int
    max_service_time: int
    is_night_shift: bool = False
    vehicle_type: str = "STANDARD"
    start_node_idx: int = 0
    end_node_idx: int = 0
    skills: Optional[List[str]] = None

class OptimizationRequest(BaseModel):
    distance_matrix: List[List[int]]
    time_matrix: List[List[int]]
    nodes: List[Node]
    vehicles: List[Vehicle]
    time_window_penalty: int = 0
    enforce_break: bool = True
    break_duration_seconds: int = 2700
    max_continuous_driving_seconds: int = 16200
    max_continuous_work_seconds: int = 21600
    current_time: int = 0
    allow_multi_trip: bool = False