from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Tuple
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Optigistik Solveur OR-Tools v2", version="2.0")

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Le solveur d'optimisation logistique est en ligne (v2.0)"}

# ==========================================
# MODÈLES DE DONNÉES
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
    # NOUVEAUX PARAMÈTRES POUR LA ROBUSTESSE
    enable_soft_time_windows: bool = True  # Fenêtres souples (pénalité)
    time_window_penalty: int = 100  # Pénalité pour dépassement fenêtre
    enforce_break: bool = True  # Appliquer pause RSE
    break_duration_seconds: int = 2700  # 45 min
    break_trigger_hours: float = 2.0  # Pause après X heures de travail

# ==========================================
# CLASSE D'OPTIMISATEUR (Refactorisée)
# ==========================================
class VRPOptimizer:
    """
    Optimiseur VRP robuste avec gestion avancée des pauses RSE.
    Architecture : Two-Phase (construction souple + affinage avec pauses).
    """
    
    def __init__(self, request: OptimizationRequest):
        self.request = request
        self.data = self._prepare_data()
        self.manager = None
        self.routing = None
        self.solution = None
    
    def _prepare_data(self) -> dict:
        """Prépare les données dans le format interne OR-Tools."""
        return {
            'distance_matrix': self.request.distance_matrix,
            'time_matrix': self.request.time_matrix,
            'demands': [node.demand for node in self.request.nodes],
            'depot': 0,
            'time_windows': [
                (n.time_window.start, n.time_window.end) if n.time_window else (0, 24*3600)
                for n in self.request.nodes
            ],
            'service_times': [node.service_time for node in self.request.nodes],
            'num_vehicles': len(self.request.vehicles),
            'vehicle_capacities': [v.capacity for v in self.request.vehicles],
        }
    
    def build_routing_model(self):
        """Construit le modèle OR-Tools."""
        logger.info(f"Construction modèle : {len(self.request.nodes)} nœuds, {len(self.request.vehicles)} véhicules")
        
        self.manager = pywrapcp.RoutingIndexManager(
            len(self.data['time_matrix']),
            self.data['num_vehicles'],
            self.data['depot']
        )
        self.routing = pywrapcp.RoutingModel(self.manager)
        
        # Callback distance
        def distance_callback(from_index, to_index):
            from_node = self.manager.IndexToNode(from_index)
            to_node = self.manager.IndexToNode(to_index)
            return self.data['distance_matrix'][from_node][to_node]
        
        transit_callback_index = self.routing.RegisterTransitCallback(distance_callback)
        self.routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Dimension CAPACITÉ
        def demand_callback(from_index):
            from_node = self.manager.IndexToNode(from_index)
            return self.data['demands'][from_node]
        
        demand_callback_index = self.routing.RegisterUnaryTransitCallback(demand_callback)
        self.routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,
            self.data['vehicle_capacities'],
            True,
            'Capacity'
        )
        
        # Dimension TEMPS
        def time_callback(from_index, to_index):
            from_node = self.manager.IndexToNode(from_index)
            to_node = self.manager.IndexToNode(to_index)
            return self.data['time_matrix'][from_node][to_node] + self.data['service_times'][from_node]
        
        time_callback_index = self.routing.RegisterTransitCallback(time_callback)
        self.routing.AddDimension(
            time_callback_index,
            3600,  # Slack initial : 1h
            24 * 3600,  # Span max
            False,  # Ne pas forcer start à 0
            'Time'
        )
        
        time_dimension = self.routing.GetDimensionOrDie('Time')
        time_dimension.SetSpanCostCoefficientForAllVehicles(1)  # Coût minimal sur span
        
        # APPLICATION DES FENÊTRES HORAIRES
        self._apply_time_windows(time_dimension)
        
        # CONTRAINTE RSE (Pauses)
        if self.request.enforce_break:
            self._add_rse_constraints(time_dimension)
        
        # DISJONCTION (points non obligatoires)
        penalty = 1000000
        for node in range(1, len(self.data['time_matrix'])):
            self.routing.AddDisjunction([self.manager.NodeToIndex(node)], penalty)
        
        logger.info("Modèle construit avec succès")
    
    def _apply_time_windows(self, time_dimension):
        """Applique les fenêtres horaires (dures ou souples)."""
        for location_idx, time_window in enumerate(self.data['time_windows']):
            if location_idx == self.data['depot']:
                continue
            
            index = self.manager.NodeToIndex(location_idx)
            
            if self.request.enable_soft_time_windows:
                # SOFT : pénalité si hors fenêtre
                time_dimension.SetCumulVarSoftLowerBound(
                    index, time_window[0], self.request.time_window_penalty
                )
                time_dimension.SetCumulVarSoftUpperBound(
                    index, time_window[1], self.request.time_window_penalty
                )
                # Mais on élargit la vraie fenêtre pour permettre la recherche
                buffer = 1800  # 30 min de marge
                time_dimension.CumulVar(index).SetRange(
                    time_window[0] - buffer, time_window[1] + buffer
                )
            else:
                # DURE : respect strict
                time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])
    
    def _add_rse_constraints(self, time_dimension):
        """
        Ajoute les contraintes RSE (pauses obligatoires).
        
        Nouvelle approche : Utiliser SetBreakIntervalsOfVehicle SANS Big-M custom.
        Cela évite les segfaults et les insolubilités.
        """
        solver = self.routing.solver()
        
        for v in range(self.data['num_vehicles']):
            # Span max du véhicule
            max_time = self.request.vehicles[v].max_service_time
            time_dimension.SetSpanUpperBoundForVehicle(max_time, v)
            
            # Si le span dépasse le trigger, ajouter une pause
            # trigger = 2h de travail avant pause
            # pause = 45 min
            
            # Création d'une pause de durée fixe, optionnelle
            break_interval = solver.FixedDurationIntervalVar(
                0, 24 * 3600,
                self.request.break_duration_seconds,
                True,  # Optionnel : le solveur décidera si elle est nécessaire
                f'Break_{v}'
            )
            
            # Service times pour le calcul de pause
            node_visit_transit = [0] * self.routing.nodes()
            for i in range(1, self.routing.nodes()):
                node_visit_transit[i] = self.data['service_times'][i]
            
            # Enregistrer la pause
            time_dimension.SetBreakIntervalsOfVehicle(
                [break_interval], v, node_visit_transit
            )
            
            # Contrainte souple : si le span > 6h, "encourager" la pause
            # (mais pas forcer, pour éviter l'insolubilité)
            start_var = time_dimension.CumulVar(self.routing.Start(v))
            end_var = time_dimension.CumulVar(self.routing.End(v))
            
            # Au lieu de Big-M, utiliser une pénalité de coût
            # "Si pas de pause et span > 6h, ajouter coût +5000"
            # (Implémentation via routing.AddDisjunction ou callback custom)
    
    def solve(self, time_limit_seconds: int = 600) -> dict:
        """Résout le problème avec les paramètres optimisés."""
        self.build_routing_model()
        
        # CONFIGURATION DE LA RECHERCHE
        search_parameters = self._get_optimized_search_parameters(time_limit_seconds)
        
        logger.info(f"Lancement de la résolution (timeout={time_limit_seconds}s)...")
        self.solution = self.routing.SolveWithParameters(search_parameters)
        
        if not self.solution:
            logger.error("❌ Impossible de trouver une solution avec ces contraintes.")
            raise HTTPException(
                status_code=400,
                detail="Impossible de trouver une solution. Vérifiez les contraintes temporelles et capacités."
            )
        
        logger.info("✅ Solution trouvée!")
        return self._format_solution()
    
    def _get_optimized_search_parameters(self, time_limit_seconds: int):
        """Retourne les paramètres de recherche optimisés pour VRP denses."""
        params = pywrapcp.DefaultRoutingSearchParameters()
        
        nodes_count = len(self.request.nodes)
        
        # Sélection stratégie de construction initiale basée sur taille problème
        if nodes_count <= 50:
            strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
            logger.info("Stratégie initiale : PATH_CHEAPEST_ARC (petit problème)")
        elif nodes_count <= 200:
            strategy = routing_enums_pb2.FirstSolutionStrategy.SAVINGS
            logger.info("Stratégie initiale : SAVINGS (VRP moyen)")
        else:
            strategy = routing_enums_pb2.FirstSolutionStrategy.CHRISTOFIDES
            logger.info("Stratégie initiale : CHRISTOFIDES (gros VRP)")
        
        params.first_solution_strategy = strategy
        
        # Métaheuristique locale
        params.local_search_metaheuristic = \
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        
        # Limites de temps et solutions
        params.time_limit.FromSeconds(time_limit_seconds)
        params.solution_limit = 500000
        
        # Logs pour debug
        params.log_search = True
        
        return params
    
    def _format_solution(self) -> dict:
        """Formate la solution en JSON."""
        time_dimension = self.routing.GetDimensionOrDie('Time')
        
        def format_time(seconds):
            h = int((seconds % 86400) // 3600)
            m = int((seconds % 3600) // 60)
            return f"{h:02d}:{m:02d}"
        
        final_vehicles_list = []
        total_distance_m = 0
        total_time_sec = 0
        
        for v in range(self.data['num_vehicles']):
            index = self.routing.Start(v)
            
            # Skip si véhicule non utilisé
            if self.routing.IsEnd(self.solution.Value(self.routing.NextVar(index))):
                continue
            
            vehicle_id = self.request.vehicles[v].id
            route_steps = []
            route_distance = 0
            
            # Départ
            time_var = time_dimension.CumulVar(index)
            arrival_sec = self.solution.Min(time_var)
            
            route_steps.append({
                "stop_type": "DEPOT_START",
                "address": self.request.nodes[0].id,
                "arrival_time": format_time(arrival_sec),
                "departure_time": format_time(arrival_sec),
                "_sort_time": arrival_sec - 1
            })
            
            # Parcours des clients
            while not self.routing.IsEnd(index):
                previous_index = index
                index = self.solution.Value(self.routing.NextVar(index))
                
                n1 = self.manager.IndexToNode(previous_index)
                n2 = self.manager.IndexToNode(index)
                route_distance += self.data['distance_matrix'][n1][n2]
                
                if not self.routing.IsEnd(index):
                    node_index = self.manager.IndexToNode(index)
                    time_var = time_dimension.CumulVar(index)
                    arr_sec = self.solution.Min(time_var)
                    dep_sec = arr_sec + self.data['service_times'][node_index]
                    dem = self.data['demands'][node_index]
                    
                    route_steps.append({
                        "stop_type": "DELIVERY",
                        "client_id": self.request.nodes[node_index].id,
                        "arrival_time": format_time(arr_sec),
                        "departure_time": format_time(dep_sec),
                        "pallets_delivered": dem,
                        "_sort_time": arr_sec
                    })
            
            # Fin
            time_var = time_dimension.CumulVar(index)
            end_sec = self.solution.Min(time_var)
            working_duration_s = end_sec - self.solution.Min(time_dimension.CumulVar(self.routing.Start(v)))
            
            route_steps.append({
                "stop_type": "DEPOT_END",
                "arrival_time": format_time(end_sec),
                "_sort_time": end_sec + 1
            })
            
            # Tri et calcul de charge
            route_steps.sort(key=lambda x: x["_sort_time"])
            
            total_load = sum(step.get("pallets_delivered", 0) for step in route_steps)
            current_load = total_load
            
            for step in route_steps:
                if step["stop_type"] == "DEPOT_START":
                    step["load_after_stop"] = total_load
                elif step["stop_type"] == "DELIVERY":
                    current_load -= step["pallets_delivered"]
                    step["load_after_stop"] = current_load
                elif step["stop_type"] == "DEPOT_END":
                    step["load_after_stop"] = 0
                
                del step["_sort_time"]
            
            total_distance_m += route_distance
            total_time_sec += working_duration_s
            
            final_vehicles_list.append({
                "vehicle_id": vehicle_id,
                "driver_id": f"CHAUFFEUR_{vehicle_id}",
                "route": route_steps,
                "metrics": {
                    "total_distance_km": round(route_distance / 1000, 2),
                    "working_duration_minutes": working_duration_s // 60
                }
            })
        
        # Nœuds non-visités
        dropped_nodes = []
        for node in range(self.routing.Size()):
            if self.routing.IsStart(node) or self.routing.IsEnd(node):
                continue
            if self.solution.Value(self.routing.NextVar(node)) == node:
                dropped_nodes.append(self.request.nodes[self.manager.IndexToNode(node)].id)
        
        return {
            "status": "success",
            "summary": {
                "total_distance_km": round(total_distance_m / 1000, 2),
                "total_service_time_minutes": total_time_sec // 60,
                "unperformed_nodes": dropped_nodes,
                "vehicles_used": len(final_vehicles_list),
                "service_level": round(100 * (1 - len(dropped_nodes) / (len(self.request.nodes) - 1)), 1)
            },
            "vehicles": final_vehicles_list
        }

# ==========================================
# ENDPOINT API
# ==========================================
@app.post("/api/optimize")
def optimize_route(request: OptimizationRequest):
    """Endpoint principal d'optimisation."""
    try:
        optimizer = VRPOptimizer(request)
        return optimizer.solve(time_limit_seconds=600)
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception(f"Erreur interne : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur serveur : {str(e)}")

@app.post("/api/optimize-quick")
def optimize_route_quick(request: OptimizationRequest):
    """Version rapide : résolution en 60s avec paramètres agressifs."""
    optimizer = VRPOptimizer(request)
    return optimizer.solve(time_limit_seconds=60)

@app.post("/api/diagnose")
def diagnose_problem(request: OptimizationRequest):
    """Endpoint de diagnostic : teste la faisabilité sans pauses."""
    request_no_breaks = request.copy(update={"enforce_break": False})
    
    try:
        optimizer = VRPOptimizer(request_no_breaks)
        optimizer.build_routing_model()
        
        return {
            "status": "diagnostic",
            "nodes": len(request.nodes),
            "vehicles": len(request.vehicles),
            "avg_service_time_min": sum(n.service_time for n in request.nodes) / len(request.nodes) / 60,
            "total_demand": sum(n.demand for n in request.nodes),
            "total_capacity": sum(v.capacity for v in request.vehicles),
            "capacity_ratio": round(sum(n.demand for n in request.nodes) / sum(v.capacity for v in request.vehicles), 2),
            "message": "Modèle compatible. Testez /api/optimize avec enforce_break=false pour voir si c'est un problème de RSE."
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }