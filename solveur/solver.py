import logging
import time
from typing import List, Dict
from models import OptimizationRequest
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class Route:
    def __init__(self, vehicle, request: OptimizationRequest):
        self.vehicle = vehicle
        self.request = request
        self.nodes: List[int] = []  # Stocke les indices des nœuds (ex: [1, 4, 2])
        self.is_valid = True
        self.timeline = []
        self.total_distance = 0
        self.total_time = 0
        self.penalty = 0

    def clone_and_insert(self, node_index: int, position: int) -> 'Route':
        """Crée une copie de la route et y insère un nœud pour simuler la faisabilité."""
        cloned = Route(self.vehicle, self.request)
        cloned.nodes = list(self.nodes)
        cloned.nodes.insert(position, node_index)
        cloned.recalculate()
        return cloned

    def recalculate(self):
        """
        VALIDATEUR CHRONOLOGIQUE : Simule la route pas-à-pas.
        Applique les filtres : Capacité -> RSE (4h30) -> Fenêtres horaires.
        """
        self.is_valid = True
        self.timeline = []
        self.total_distance = 0
        self.penalty = 0
        self.total_time = 0

        if not self.nodes:
            return

        current_time = 0
        current_node_idx = 0  # Le dépôt est toujours à l'index 0
        accumulated_work_before_break = 0
        total_demand = 0

        # Enregistrement du départ au dépôt
        self.timeline.append({
            "stop_type": "DEPOT_START",
            "client_id": self.request.nodes[0].id,
            "arrival_time": current_time // 60
        })

        for next_node_idx in self.nodes:
            node = self.request.nodes[next_node_idx]
            
            # --- FILTRE 1 : Capacité maximale ---
            total_demand += node.demand
            if total_demand > self.vehicle.capacity:
                self.is_valid = False
                return

            transit_time = self.request.time_matrix[current_node_idx][next_node_idx]
            transit_dist = self.request.distance_matrix[current_node_idx][next_node_idx]

            # --- FILTRE 3 : Législation RSE (Pause dynamique avant ou pendant trajet) ---
            if self.request.enforce_break and (accumulated_work_before_break + transit_time > 16200):
                current_time += self.request.break_duration_seconds
                self.timeline.append({
                    "stop_type": "BREAK",
                    "client_id": "PAUSE_RSE",
                    "arrival_time": current_time // 60
                })
                accumulated_work_before_break = 0

            current_time += transit_time
            accumulated_work_before_break += transit_time
            self.total_distance += transit_dist

            # --- FILTRE 2 : Fenêtres Horaires (Time Windows) ---
            if node.time_window:
                if current_time < node.time_window.start:
                    # Arrivée en avance -> Attente (Idle)
                    wait_time = node.time_window.start - current_time
                    
                    # Optimisation RSE : Si l'attente est assez longue, on valide la pause RSE ici
                    if self.request.enforce_break and wait_time >= self.request.break_duration_seconds:
                        if not self.timeline or self.timeline[-1]["stop_type"] != "BREAK":
                            self.timeline.append({
                                "stop_type": "BREAK",
                                "client_id": "PAUSE_RSE",
                                "arrival_time": current_time // 60
                            })
                            accumulated_work_before_break = 0
                    current_time = node.time_window.start
                elif current_time > node.time_window.end:
                    # Arrivée en retard -> Tolérance maximale de 15 minutes (900s)
                    delay = current_time - node.time_window.end
                    if delay <= 900:
                        self.penalty += delay * 50  # Forte pénalité sur le score
                    else:
                        self.is_valid = False  # Hors tolérance : Route rejetée
                        return

            # Étape de livraison chez le client
            self.timeline.append({
                "stop_type": "DELIVERY",
                "client_id": node.id,
                "arrival_time": current_time // 60
            })

            # Gestion de la RSE pendant le temps de service (déchargement)
            if self.request.enforce_break and (accumulated_work_before_break + node.service_time > 16200):
                current_time += self.request.break_duration_seconds
                self.timeline.append({
                    "stop_type": "BREAK",
                    "client_id": "PAUSE_RSE",
                    "arrival_time": current_time // 60
                })
                accumulated_work_before_break = 0

            current_time += node.service_time
            accumulated_work_before_break += node.service_time
            current_node_idx = next_node_idx

        # --- RETOUR AU DÉPÔT ---
        transit_to_depot = self.request.time_matrix[current_node_idx][0]
        if self.request.enforce_break and (accumulated_work_before_break + transit_to_depot > 16200):
            current_time += self.request.break_duration_seconds
            self.timeline.append({
                "stop_type": "BREAK",
                "client_id": "PAUSE_RSE",
                "arrival_time": current_time // 60
            })
            accumulated_work_before_break = 0

        current_time += transit_to_depot
        self.total_distance += self.request.distance_matrix[current_node_idx][0]

        self.timeline.append({
            "stop_type": "DEPOT_END",
            "client_id": self.request.nodes[0].id,
            "arrival_time": current_time // 60
        })

        self.total_time = current_time

        # Validation de l'amplitude de la journée max du véhicule
        if self.total_time > self.vehicle.max_service_time:
            self.is_valid = False


class VRPOptimizer:
    def __init__(self, request: OptimizationRequest):
        self.request = request
        self.unperformed_nodes: List[str] = []

    def solve(self, initial_routes=None) -> dict:
        start_time = time.time()
        logger.info(f"🚀 Début VRP Pur Python — Clients: {len(self.request.nodes)-1} | Véhicules: {len(self.request.vehicles)}")

        # Instanciation des structures de tournées vides
        routes = [Route(v, self.request) for v in self.request.vehicles]

        # --- PHASE 1 : Construction Initiale (Heuristique d'insertion triée) ---
        # Tri des index clients (excluant le dépôt 0) par sévérité de leur fenêtre horaire
        sorted_client_indexes = sorted(
            [i for i in range(1, len(self.request.nodes))],
            key=lambda i: (self.request.nodes[i].time_window.end - self.request.nodes[i].time_window.start) if self.request.nodes[i].time_window else 86400
        )

        for client_idx in sorted_client_indexes:
            node_id = self.request.nodes[client_idx].id
            best_route_idx = -1
            best_insert_pos = -1
            best_cost = float('inf')
            best_cloned_route = None

            # Test de toutes les insertions possibles sur toutes les routes
            for r_idx, route in enumerate(routes):
                for pos in range(len(route.nodes) + 1):
                    cloned = route.clone_and_insert(client_idx, pos)
                    
                    if cloned.is_valid:
                        cost = cloned.total_distance + cloned.penalty
                        if cost < best_cost:
                            best_cost = cost
                            best_route_idx = r_idx
                            best_insert_pos = pos
                            best_cloned_route = cloned

            if best_route_idx != -1 and best_cloned_route:
                routes[best_route_idx] = best_cloned_route
            else:
                # Disjonction automatique : le client ne rentre nulle part légalement -> préservé hors-tournée
                self.unperformed_nodes.append(node_id)

        # --- PHASE 2 : Affinage (Recherche Locale — Relocate) ---
        # Limitation stricte à 3 passes maximum pour garantir la performance synchrone
        improved = True
        local_search_pass = 0
        
        while improved and local_search_pass < 3:
            local_search_pass += 1
            improved = False
            
            for r1_idx, route1 in enumerate(routes):
                for pos1, node_idx in enumerate(list(route1.nodes)):
                    
                    for r2_idx, route2 in enumerate(routes):
                        max_pos2 = len(route2.nodes) + 1 if r1_idx != r2_idx else len(route2.nodes)
                        
                        for pos2 in range(max_pos2):
                            if r1_idx == r2_idx and (pos2 == pos1 or pos2 == pos1 + 1):
                                continue
                            
                            # On reconstruit la route 1 sans le nœud courant
                            test_route1 = Route(route1.vehicle, self.request)
                            test_route1.nodes = [n for idx, n in enumerate(route1.nodes) if idx != pos1]
                            test_route1.recalculate()
                            
                            # On l'insère dans la route 2
                            if r1_idx != r2_idx:
                                test_route2 = route2.clone_and_insert(node_idx, pos2)
                            else:
                                actual_pos2 = pos2 if pos2 < pos1 else pos2 - 1
                                test_route2 = test_route1.clone_and_insert(node_idx, actual_pos2)

                            # Si le mouvement est légal et fait gagner plus de 1 km, on valide
                            if test_route1.is_valid and test_route2.is_valid:
                                old_cost = (route1.total_distance + route1.penalty) + (route2.total_distance + route2.penalty)
                                new_cost = (test_route1.total_distance + test_route1.penalty) + (test_route2.total_distance + test_route2.penalty)
                                
                                if new_cost < old_cost - 1000:
                                    routes[r1_idx] = test_route1
                                    routes[r2_idx] = test_route2
                                    improved = True
                                    break
                        if improved: break
                if improved: break

        logger.info(f"🏁 Optimisation terminée en {round(time.time() - start_time, 3)}s")
        return self._format_solution(routes)

    def _format_solution(self, routes: List[Route]) -> dict:
        vehicles_json = []
        total_dist = 0
        used_vehicles = 0

        for r in routes:
            if not r.nodes:
                continue
            used_vehicles += 1
            total_dist += r.total_distance
            vehicles_json.append({
                "vehicle_id": r.vehicle.id,
                "route": r.timeline
            })

        total_nodes = len(self.request.nodes) - 1
        service_level = round(100 * (1 - len(self.unperformed_nodes) / total_nodes), 1) if total_nodes > 0 else 100

        return {
            "status": "success",
            "summary": {
                "total_distance_km": round(total_dist / 1000, 2),
                "unperformed_nodes": self.unperformed_nodes,
                "service_level": service_level,
                "vehicles_used": used_vehicles
            },
            "vehicles": vehicles_json
        }