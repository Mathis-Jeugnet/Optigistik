import logging
from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from models import OptimizationRequest
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class VRPOptimizer:
    def __init__(self, request: OptimizationRequest):
        self.request = request
        self.data = self._prepare_data()
        self.manager = None
        self.routing = None
        self.solution = None

    def _prepare_data(self) -> dict:
        return {
            'distance_matrix': self.request.distance_matrix,
            'time_matrix': self.request.time_matrix,
            'demands': [n.demand for n in self.request.nodes],
            'depot': 0,
            # Application d'une Time Window large par défaut si elle n'est pas spécifiée
            'time_windows': [
                (n.time_window.start, n.time_window.end) if n.time_window else (0, 86400) 
                for n in self.request.nodes
            ],
            'service_times': [n.service_time for n in self.request.nodes],
            'num_vehicles': len(self.request.vehicles),
            'vehicle_capacities': [v.capacity for v in self.request.vehicles],
        }

    def build_routing_model(self):
        self.manager = pywrapcp.RoutingIndexManager(len(self.data['time_matrix']), self.data['num_vehicles'], self.data['depot'])
        self.routing = pywrapcp.RoutingModel(self.manager)

        # --- 1. Dimension Distance ---
        transit_callback_index = self.routing.RegisterTransitCallback(
            lambda i, j: self.data['distance_matrix'][self.manager.IndexToNode(i)][self.manager.IndexToNode(j)]
        )
        self.routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        self.routing.AddDimension(transit_callback_index, 0, 1000000, True, 'Distance')

        # --- 2. Dimension Capacité (Cruciale pour rejeter ou non un Warm Start) ---
        demand_callback_index = self.routing.RegisterUnaryTransitCallback(
            lambda i: self.data['demands'][self.manager.IndexToNode(i)]
        )
        self.routing.AddDimensionWithVehicleCapacity(
            demand_callback_index, 0, self.data['vehicle_capacities'], True, 'Capacity'
        )

        # --- 3. Dimension Temps ---
        def time_callback(from_index, to_index):
            f, t = self.manager.IndexToNode(from_index), self.manager.IndexToNode(to_index)
            return self.data['time_matrix'][f][t] + self.data['service_times'][f]

        time_callback_index = self.routing.RegisterTransitCallback(time_callback)
        self.routing.AddDimension(time_callback_index, 14400, 86400, False, 'Time')
        time_dim = self.routing.GetDimensionOrDie('Time')

        # Ajout des contraintes de Time Windows
        for i, (start, end) in enumerate(self.data['time_windows']):
            index = self.manager.NodeToIndex(i)
            time_dim.CumulVar(index).SetRange(start, end)

        # Disjunction (Permet au solveur d'ignorer des points s'il n'a pas le choix, moyennant pénalité)
        penalty = 1000000
        for i in range(1, len(self.data['time_matrix'])):
            self.routing.AddDisjunction([self.manager.NodeToIndex(i)], penalty)

    def solve(self, initial_routes=None) -> dict:
        self.build_routing_model()
        
        params = pywrapcp.DefaultRoutingSearchParameters()
        # Heuristique d'insertion beaucoup plus robuste pour la première solution
        params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
        params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        params.time_limit.FromSeconds(60)

        # --- GESTION DU WARM START ---
        if initial_routes:
            logger.info(f"Tentative de Warm Start avec les routes : {initial_routes}")
            try:
                # On lit les routes (sans les dépôts)
                assignment = self.routing.ReadAssignmentFromRoutes(initial_routes, True)
                if assignment:
                    logger.info("Assignation lue avec succès. Résolution depuis le Warm Start...")
                    self.solution = self.routing.SolveFromAssignmentWithParameters(assignment, params)
                else:
                    logger.warning("L'assignation issue du clustering viole une contrainte stricte (ex: Capacité dépassée).")
            except Exception as e:
                logger.warning(f"Erreur lors du Warm Start : {e}")
                self.solution = None
        
        # Fallback classique si le Warm Start n'a pas fonctionné (ou n'a pas été fourni)
        if not self.solution:
            logger.info("Résolution standard OR-Tools (sans Warm Start)...")
            self.solution = self.routing.SolveWithParameters(params)

        if not self.solution:
            raise HTTPException(status_code=400, detail="Impossible de trouver une solution")
        
        return self._format_solution()

    def _format_solution(self) -> dict:
        dist_dim = self.routing.GetDimensionOrDie('Distance')
        time_dim = self.routing.GetDimensionOrDie('Time')
        vehicles_json = []
        total_dist = 0
        dropped_nodes = []

        for v in range(self.data['num_vehicles']):
            index = self.routing.Start(v)
            route = []
            while not self.routing.IsEnd(index):
                node_idx = self.manager.IndexToNode(index)
                arrival_time = self.solution.Value(time_dim.CumulVar(index))
                
                route.append({
                    "stop_type": "DELIVERY" if node_idx != 0 else "DEPOT_START",
                    "client_id": self.request.nodes[node_idx].id,
                    "arrival_time": arrival_time // 60,
                })
                index = self.solution.Value(self.routing.NextVar(index))
                
            total_dist += self.solution.Value(dist_dim.CumulVar(self.routing.End(v)))
            vehicles_json.append({"vehicle_id": self.request.vehicles[v].id, "route": route})

        # Nœuds rejetés
        for i in range(1, len(self.data['time_matrix'])):
            if self.solution.Value(self.routing.NextVar(self.manager.NodeToIndex(i))) == self.manager.NodeToIndex(i):
                dropped_nodes.append(self.request.nodes[i].id)

        total_nodes = len(self.data['time_matrix']) - 1
        service_level = round(100 * (1 - len(dropped_nodes) / total_nodes), 1) if total_nodes > 0 else 100

        return {
            "status": "success",
            "summary": {
                "total_distance_km": round(total_dist / 1000, 2),
                "unperformed_nodes": dropped_nodes,
                "service_level": service_level,
                "vehicles_used": len(vehicles_json)
            },
            "vehicles": vehicles_json
        }