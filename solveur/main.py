from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

app = FastAPI(title="Optigistik Solveur OR-Tools", version="1.0")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Le solveur d'optimisation logistique est en ligne."}

# ==========================================
# MODÈLES DE DONNÉES (Input)
# ==========================================
class TimeWindow(BaseModel):
    start: int # en secondes depuis 00:00
    end: int   # en secondes depuis 00:00

class Node(BaseModel):
    id: str
    demand: int # Nombre de palettes (0 pour le dépôt)
    service_time: int # Durée de déchargement en secondes
    time_window: Optional[TimeWindow] = None

class Vehicle(BaseModel):
    id: str
    capacity: int # Capacité max en palettes
    max_service_time: int # Ex: 12h (43200s) ou 10h (36000s) pour la nuit
    is_night_shift: bool

class OptimizationRequest(BaseModel):
    distance_matrix: List[List[int]] # Matrice de distances (en mètres)
    time_matrix: List[List[int]]     # Matrice de temps (en secondes)
    nodes: List[Node]                # Liste des points (Index 0 = Dépôt)
    vehicles: List[Vehicle]          # Liste des camions disponibles

# ==========================================
# LOGIQUE OR-TOOLS
# ==========================================
@app.post("/api/optimize")
def optimize_route(request: OptimizationRequest):
    # 1. Préparation des données et Multi-trip
    TRIPS_PER_VEHICLE = 2 
    num_physical_vehicles = len(request.vehicles)
    
    data = {
        'distance_matrix': request.distance_matrix,
        'time_matrix': request.time_matrix,
        'demands': [node.demand for node in request.nodes],
        'depot': 0,
        'time_windows': [
            (n.time_window.start, n.time_window.end) if n.time_window else (0, 24*3600)
            for n in request.nodes
        ],
        'service_times': [node.service_time for node in request.nodes],
        'num_vehicles': num_physical_vehicles * TRIPS_PER_VEHICLE,
        'vehicle_capacities': [],
        'physical_vehicle_ids': []
    }

    for v in request.vehicles:
        for _ in range(TRIPS_PER_VEHICLE):
            data['vehicle_capacities'].append(v.capacity)
            data['physical_vehicle_ids'].append(v.id)

    # 2. Création des Managers
    manager = pywrapcp.RoutingIndexManager(len(data['time_matrix']), data['num_vehicles'], data['depot'])
    routing = pywrapcp.RoutingModel(manager)

    # 3. Fonction de coût : Distance + Temps
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data['distance_matrix'][from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # 4. Dimension : Capacité (Palettes)
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return data['demands'][from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  
        data['vehicle_capacities'], 
        True,  
        'Capacity'
    )

    # 5. Dimension : Temps (Priorité de minimisation)
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data['time_matrix'][from_node][to_node] + data['service_times'][from_node]

    time_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(
        time_callback_index,
        3600,  # slack max
        24 * 3600,  # Plafond par trip
        False, 
        'Time'
    )
    
    time_dimension = routing.GetDimensionOrDie('Time')
    time_dimension.SetSpanCostCoefficientForAllVehicles(100)

    # Application des fenêtres horaires
    for location_idx, time_window in enumerate(data['time_windows']):
        if location_idx == data['depot']:
            continue
        index = manager.NodeToIndex(location_idx)
        time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])

    # 6. Contraintes Multi-trip Allégées
    solver = routing.solver()
    for v in range(num_physical_vehicles):
        for t in range(TRIPS_PER_VEHICLE - 1):
            current_trip = v * TRIPS_PER_VEHICLE + t
            next_trip = v * TRIPS_PER_VEHICLE + t + 1
            # Séquençage logique : le trip 2 démarre après le trip 1 (sans imposer un trou de 30min bloquant pour l'instant)
            solver.Add(
                time_dimension.CumulVar(routing.Start(next_trip)) >= 
                time_dimension.CumulVar(routing.End(current_trip))
            )

    # 7. Nœuds irréalisables (Pénalités)
    penalty = 1000000
    for node in range(1, len(data['time_matrix'])):
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    # 8. Résolution (Stratégie modifiée ici !)
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.FromSeconds(5)

    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        raise HTTPException(status_code=400, detail="Impossible de trouver une solution (Contraintes trop strictes).")

    # 9. Formatage JSON strict
    def format_time(seconds):
        h = int((seconds % 86400) // 3600)
        m = int((seconds % 3600) // 60)
        return f"{h:02d}:{m:02d}"

    physical_routes_map = {}
    total_distance_m_global = 0
    total_time_sec_global = 0

    for virt_v in range(data['num_vehicles']):
        index = routing.Start(virt_v)
        if routing.IsEnd(solution.Value(routing.NextVar(index))):
            continue
            
        physical_id = data['physical_vehicle_ids'][virt_v]
        
        if physical_id not in physical_routes_map:
            physical_routes_map[physical_id] = {
                "vehicle_id": physical_id,
                "driver_id": f"CHAUFFEUR_{physical_id}",
                "route": [],
                "distance_m": 0,
                "working_duration_s": 0
            }
            
        truck_data = physical_routes_map[physical_id]
        
        time_var = time_dimension.CumulVar(index)
        arrival_sec = solution.Min(time_var)
        departure_sec = arrival_sec + 1800 if len(truck_data["route"]) > 0 else arrival_sec
        
        truck_data["route"].append({
            "stop_type": "DEPOT_START",
            "address": request.nodes[0].id,
            "arrival_time": format_time(arrival_sec),
            "departure_time": format_time(departure_sec),
            "load_after_stop": 0 
        })
        
        trip_load = 0
        
        while not routing.IsEnd(index):
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            truck_data["distance_m"] += routing.GetArcCostForVehicle(previous_index, index, virt_v)
            
            if not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                time_var = time_dimension.CumulVar(index)
                arr_sec = solution.Min(time_var)
                dep_sec = arr_sec + data['service_times'][node_index]
                dem = data['demands'][node_index]
                trip_load += dem
                
                truck_data["route"].append({
                    "stop_type": "DELIVERY",
                    "client_id": request.nodes[node_index].id,
                    "arrival_time": format_time(arr_sec),
                    "departure_time": format_time(dep_sec),
                    "pallets_delivered": dem,
                    "load_after_stop": 0 
                })

        depot_start_step = [s for s in truck_data["route"] if s["stop_type"] == "DEPOT_START"][-1]
        depot_start_step["load_after_stop"] = trip_load
        
        current_decreasing_load = trip_load
        for step in reversed(truck_data["route"]):
            if step["stop_type"] == "DELIVERY" and step.get("load_after_stop") == 0:
                current_decreasing_load -= step["pallets_delivered"]
                step["load_after_stop"] = current_decreasing_load

        time_var = time_dimension.CumulVar(index)
        end_sec = solution.Min(time_var)
        truck_data["working_duration_s"] = end_sec - solution.Min(time_dimension.CumulVar(routing.Start(virt_v - (virt_v % TRIPS_PER_VEHICLE))))
        
        truck_data["route"].append({
            "stop_type": "DEPOT_END",
            "arrival_time": format_time(end_sec)
        })

    final_vehicles_list = []
    for p_id, t_data in physical_routes_map.items():
        total_distance_m_global += t_data["distance_m"]
        total_time_sec_global += t_data["working_duration_s"]
        
        final_vehicles_list.append({
            "vehicle_id": t_data["vehicle_id"],
            "driver_id": t_data["driver_id"],
            "route": t_data["route"],
            "metrics": {
                "total_distance_km": round(t_data["distance_m"] / 1000, 2),
                "working_duration_minutes": t_data["working_duration_s"] // 60
            }
        })

    dropped_nodes_ids = []
    for node in range(routing.Size()):
        if routing.IsStart(node) or routing.IsEnd(node):
            continue
        if solution.Value(routing.NextVar(node)) == node:
            dropped_nodes_ids.append(request.nodes[manager.IndexToNode(node)].id)

    return {
        "status": "success",
        "summary": {
            "total_distance_km": round(total_distance_m_global / 1000, 2),
            "total_service_time_minutes": total_time_sec_global // 60,
            "unperformed_nodes": dropped_nodes_ids
        },
        "vehicles": final_vehicles_list
    }