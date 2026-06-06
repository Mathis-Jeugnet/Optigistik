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
    # 1. Préparation des données pour OR-Tools
    data = {}
    data['distance_matrix'] = request.distance_matrix
    data['time_matrix'] = request.time_matrix
    data['demands'] = [node.demand for node in request.nodes]
    data['vehicle_capacities'] = [v.capacity for v in request.vehicles]
    data['num_vehicles'] = len(request.vehicles)
    data['depot'] = 0
    data['time_windows'] = [
        (n.time_window.start, n.time_window.end) if n.time_window else (0, 24*3600)
        for n in request.nodes
    ]
    data['service_times'] = [node.service_time for node in request.nodes]
    data['vehicle_max_times'] = [v.max_service_time for v in request.vehicles]

    # 2. Création des Managers
    manager = pywrapcp.RoutingIndexManager(len(data['time_matrix']), data['num_vehicles'], data['depot'])
    routing = pywrapcp.RoutingModel(manager)

    # 3. Fonction de coût : Distance
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return data['distance_matrix'][from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index) # Priorise la minimisation de la distance

    # 4. Dimension : Capacité (Palettes)
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return data['demands'][from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # pas de capacité bonus
        data['vehicle_capacities'],  # limites strictes par camion
        True,  # on commence à 0 palette
        'Capacity'
    )

    # 5. Dimension : Temps (Trajet + Service + Fenêtres Horaires)
    def time_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        # Temps total = temps de trajet + temps de service au client précédent
        return data['time_matrix'][from_node][to_node] + data['service_times'][from_node]

    time_callback_index = routing.RegisterTransitCallback(time_callback)
    routing.AddDimensionWithVehicleCapacity(
        time_callback_index,
        3600,  # slack : le chauffeur peut attendre jusqu'à 1h devant le client si arrivé en avance
        data['vehicle_max_times'],  # plafond RSE max (ex: 12h)
        False, 
        'Time'
    )

    time_dimension = routing.GetDimensionOrDie('Time')

    # Application des fenêtres horaires pour chaque point
    for location_idx, time_window in enumerate(data['time_windows']):
        if location_idx == data['depot']:
            continue
        index = manager.NodeToIndex(location_idx)
        time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])

    # 6. Nœuds irréalisables (Pénalités de rejet)
    # On assigne une très forte pénalité mathématique (1 Million) si le point est sauté.
    penalty = 1000000
    for node in range(1, len(data['time_matrix'])):
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)

    # 6.5. Pauses Réglementaires (RSE Breaks)
    # Règle simplifiée : Si la tournée dure, on insère une pause optionnelle de 45 minutes 
    # qui doit être prise entre 3h et 6h de travail.
    solver = routing.solver()
    # OR-Tools a besoin de savoir combien de temps de "service" est effectué à chaque noeud
    # pour calculer le vrai temps de travail (conduite + service) avant la pause.
    node_visit_transit = [0] * routing.nodes()
    for i in range(routing.nodes()):
        if i != data['depot']:
            node_visit_transit[i] = data['service_times'][manager.IndexToNode(i)]

    for vehicle_id in range(data['num_vehicles']):
        break_intervals = []
        # Pause de 45 minutes (2700 secondes)
        break_interval = solver.FixedDurationIntervalVar(
            3 * 3600,       # Start min (3h)
            6 * 3600,       # Start max (6h max de travail sans pause)
            45 * 60,        # Duration (45 min)
            True,           # Optionnel (ne s'active que si le temps de travail dépasse)
            f'Break_Vehicle_{vehicle_id}'
        )
        break_intervals.append(break_interval)
        time_dimension.SetBreakIntervalsOfVehicle(break_intervals, vehicle_id, node_visit_transit)

    # 7. Résolution
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.FromSeconds(5) # Limite le calcul à 5s pour rester performant

    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        raise HTTPException(status_code=400, detail="Impossible de trouver une solution (Contraintes trop strictes).")

    # 8. Parser la solution OR-Tools pour renvoyer un JSON structuré
    routes = []
    total_distance = 0
    total_time = 0

    for vehicle_id in range(data['num_vehicles']):
        index = routing.Start(vehicle_id)
        route = []
        route_distance = 0
        route_load = 0
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            time_var = time_dimension.CumulVar(index)
            
            # Récupérer les intervalles de temps estimés (fenêtre d'arrivée)
            time_min = solution.Min(time_var)
            time_max = solution.Max(time_var)
            
            # On ajoute le point à la tournée du camion
            route.append({
                "node_index": node_index,
                "arrival_time_min": time_min,
                "arrival_time_max": time_max,
                "load_added": data['demands'][node_index]
            })
            
            route_load += data['demands'][node_index]
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            # Ajout de la distance du trajet vers le prochain point
            route_distance += routing.GetArcCostForVehicle(previous_index, index, vehicle_id)
            
        # Ajout du point de fin (Retour au Dépôt)
        node_index = manager.IndexToNode(index)
        time_var = time_dimension.CumulVar(index)
        route.append({
            "node_index": node_index,
            "arrival_time_min": solution.Min(time_var),
            "arrival_time_max": solution.Max(time_var),
            "load_added": 0
        })

        routes.append({
            "vehicle_id": request.vehicles[vehicle_id].id,
            "total_distance_m": route_distance,
            "total_pallets": route_load,
            "total_time_s": solution.Min(time_var),
            "steps": route
        })
        total_distance += route_distance
        total_time += solution.Min(time_var)

    # 9. Récupérer les points rejetés (Unperformed nodes)
    dropped_nodes = []
    for node in range(routing.Size()):
        if routing.IsStart(node) or routing.IsEnd(node):
            continue
        if solution.Value(routing.NextVar(node)) == node:
            dropped_nodes.append(manager.IndexToNode(node))

    return {
        "status": "success",
        "message": "Optimisation terminée avec succès.",
        "metrics": {
            "total_distance_m": total_distance,
            "total_time_s": total_time,
            "unperformed_nodes_count": len(dropped_nodes)
        },
        "routes": routes,
        "dropped_nodes": dropped_nodes
    }
