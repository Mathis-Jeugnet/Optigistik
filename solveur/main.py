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
    start: int
    end: int

class Node(BaseModel):
    id: str
    demand: int
    service_time: int
    time_window: Optional[TimeWindow] = None

class Vehicle(BaseModel):
    id: str
    capacity: int
    max_service_time: int
    is_night_shift: bool

class OptimizationRequest(BaseModel):
    distance_matrix: List[List[int]]
    time_matrix: List[List[int]]
    nodes: List[Node]
    vehicles: List[Vehicle]

# ==========================================
# LOGIQUE OR-TOOLS
# ==========================================
@app.post("/api/optimize")
def optimize_route(request: OptimizationRequest):
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
        'num_vehicles': len(request.vehicles),
        'vehicle_capacities': [v.capacity for v in request.vehicles],
    }

    manager = pywrapcp.RoutingIndexManager(len(data['time_matrix']), data['num_vehicles'], data['depot'])
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data['distance_matrix'][from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

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

    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data['time_matrix'][from_node][to_node] + data['service_times'][from_node]

    time_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(
        time_callback_index,
        3600, 
        24 * 3600,
        False, 
        'Time'
    )
    
    time_dimension = routing.GetDimensionOrDie('Time')
    time_dimension.SetSpanCostCoefficientForAllVehicles(100)

    for location_idx, time_window in enumerate(data['time_windows']):
        if location_idx == data['depot']:
            continue
        index = manager.NodeToIndex(location_idx)
        time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])

    # 6. Contraintes RSE : La méthode 100% stable
    solver = routing.solver()
    node_visit_transit = [0] * routing.nodes()
    for i in range(routing.nodes()):
        if i != data['depot']:
            node_visit_transit[i] = data['service_times'][manager.IndexToNode(i)]

    break_intervals_dict = {}
    for v in range(data['num_vehicles']):
        # Plafond global RSE du camion (ex: 12h)
        time_dimension.SetSpanUpperBoundForVehicle(request.vehicles[v].max_service_time, v)

        # Création de la pause de 45 minutes (2700 secondes)
        # False = OBLIGATOIRE (C'est ce qui empêche le solveur de crasher)
        break_interval = solver.FixedDurationIntervalVar(0, 24 * 3600, 45 * 60, False, f'Break_{v}')
        time_dimension.SetBreakIntervalsOfVehicle([break_interval], v, node_visit_transit)
        break_intervals_dict[v] = break_interval

        start_var = time_dimension.CumulVar(routing.Start(v))
        
        # La pause doit commencer entre 2h et 6h après le départ du camion
        solver.Add(break_interval.StartExpr() >= start_var + 2 * 3600)
        solver.Add(break_interval.StartExpr() <= start_var + 6 * 3600)

    # 7. Pénalités pour les points impossibles
    penalty = 1000000
    for node in range(1, len(data['time_matrix'])):
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    # 8. Résolution
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.FromSeconds(5)

    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        raise HTTPException(status_code=400, detail="Impossible de trouver une solution avec ces contraintes.")

    # 9. Formatage JSON
    def format_time(seconds):
        h = int((seconds % 86400) // 3600)
        m = int((seconds % 3600) // 60)
        return f"{h:02d}:{m:02d}"

    final_vehicles_list = []
    total_distance_m_global = 0
    total_time_sec_global = 0

    for v in range(data['num_vehicles']):
        index = routing.Start(v)
        
        if routing.IsEnd(solution.Value(routing.NextVar(index))):
            continue
            
        vehicle_id = request.vehicles[v].id
        route_steps = []
        route_distance_m = 0
        
        time_var = time_dimension.CumulVar(index)
        arrival_sec = solution.Min(time_var)
        
        route_steps.append({
            "stop_type": "DEPOT_START",
            "address": request.nodes[0].id,
            "arrival_time": format_time(arrival_sec),
            "departure_time": format_time(arrival_sec),
            "_sort_time": arrival_sec - 1
        })
        
        while not routing.IsEnd(index):
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            
            n1 = manager.IndexToNode(previous_index)
            n2 = manager.IndexToNode(index)
            route_distance_m += data['distance_matrix'][n1][n2]
            
            if not routing.IsEnd(index):
                node_index = manager.IndexToNode(index)
                time_var = time_dimension.CumulVar(index)
                arr_sec = solution.Min(time_var)
                dep_sec = arr_sec + data['service_times'][node_index]
                dem = data['demands'][node_index]
                
                route_steps.append({
                    "stop_type": "DELIVERY",
                    "client_id": request.nodes[node_index].id,
                    "arrival_time": format_time(arr_sec),
                    "departure_time": format_time(dep_sec),
                    "pallets_delivered": dem,
                    "_sort_time": arr_sec
                })

        # Extraction de la pause (qui est maintenant toujours effectuée)
        brk = break_intervals_dict[v]
        b_start = solution.StartMin(brk)
        route_steps.append({
            "stop_type": "BREAK",
            "duration_minutes": 45,
            "arrival_time": format_time(b_start),
            "departure_time": format_time(b_start + 45 * 60),
            "_sort_time": b_start
        })

        time_var = time_dimension.CumulVar(index)
        end_sec = solution.Min(time_var)
        working_duration_s = end_sec - solution.Min(time_dimension.CumulVar(routing.Start(v)))
        
        route_steps.append({
            "stop_type": "DEPOT_END",
            "arrival_time": format_time(end_sec),
            "_sort_time": end_sec + 1
        })

        route_steps.sort(key=lambda x: x["_sort_time"])
        
        total_load = sum(step.get("pallets_delivered", 0) for step in route_steps)
        current_load = total_load
        
        for step in route_steps:
            if step["stop_type"] == "DEPOT_START":
                step["load_after_stop"] = total_load
            elif step["stop_type"] == "DELIVERY":
                current_load -= step["pallets_delivered"]
                step["load_after_stop"] = current_load
            elif step["stop_type"] == "BREAK":
                step["load_after_stop"] = current_load
            elif step["stop_type"] == "DEPOT_END":
                step["load_after_stop"] = 0
                
            del step["_sort_time"]

        total_distance_m_global += route_distance_m
        total_time_sec_global += working_duration_s
        
        final_vehicles_list.append({
            "vehicle_id": vehicle_id,
            "driver_id": f"CHAUFFEUR_{vehicle_id}",
            "route": route_steps,
            "metrics": {
                "total_distance_km": round(route_distance_m / 1000, 2),
                "working_duration_minutes": working_duration_s // 60
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