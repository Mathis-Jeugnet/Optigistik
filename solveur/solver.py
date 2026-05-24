import logging
import time
from typing import List
from models import OptimizationRequest
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class Route:
    def __init__(self, vehicle, request: OptimizationRequest):
        self.vehicle = vehicle
        self.request = request
        self.nodes: List[int] = []  # Indices des nœuds visités
        self.is_valid = True
        self.timeline = []
        self.total_distance = 0
        self.total_time = 0
        self.penalty = 0

    def clone_and_insert(self, node_index: int, position: int) -> 'Route':
        """Copie la route et insère un nœud pour simuler sa faisabilité."""
        cloned = Route(self.vehicle, self.request)
        cloned.nodes = list(self.nodes)
        cloned.nodes.insert(position, node_index)
        cloned.recalculate()
        return cloned

    def recalculate(self):
        """
        VALIDATEUR CHRONOLOGIQUE ET LÉGAL : Simule la route pas-à-pas.
        Filtre 1: Capacité | Filtre 2: Fenêtres Horaires | Filtre 3: RSE (4h30 max)
        """
        self.is_valid = True
        self.timeline = []
        self.total_distance = 0
        self.penalty = 0
        self.total_time = 0

        if not self.nodes:
            return

        current_time = 0
        current_node_idx = 0  # Dépôt
        accumulated_work_before_break = 0
        total_demand = 0

        # Départ dépôt
        self.timeline.append({
            "stop_type": "DEPOT_START",
            "client_id": self.request.nodes[0].id,
            "arrival_time": current_time // 60
        })

        for next_node_idx in self.nodes:
            node = self.request.nodes[next_node_idx]
            
            # --- FILTRE 1 : Capacité ---
            total_demand += node.demand
            if total_demand > self.vehicle.capacity:
                self.is_valid = False
                return

            transit_time = self.request.time_matrix[current_node_idx][next_node_idx]
            transit_dist = self.request.distance_matrix[current_node_idx][next_node_idx]

            # --- FILTRE 3 : RSE (Détection des 4h30 de travail continu) ---
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

            # --- FILTRE 2 : Fenêtres Horaires ---
            if node.time_window:
                if current_time < node.time_window.start:
                    wait_time = node.time_window.start - current_time
                    # Optimisation RSE sur temps mort
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
                    delay = current_time - node.time_window.end
                    if delay <= 900:  # Retard toléré de 15 min max avec pénalité
                        self.penalty += delay * 50
                    else:
                        self.is_valid = False
                        return

            self.timeline.append({
                "stop_type": "DELIVERY",
                "client_id": node.id,
                "arrival_time": current_time // 60
            })

            # RSE pendant le temps de service
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

        # Validation de l'amplitude maximale de travail du conducteur
        if self.total_time > self.vehicle.max_service_time:
            self.is_valid = False


class VRPOptimizer:
    def __init__(self, request: OptimizationRequest):
        self.request = request
        self.unperformed_nodes: List[str] = []

    def solve(self, initial_routes=None) -> dict:
        start_time = time.time()
        logger.info(f"🚀 MOTEUR PYTHON PUR — Clients: {len(self.request.nodes)-1} | Véhicules: {len(self.request.vehicles)}")

        # Init des tournées vides
        routes = [Route(v, self.request) for v in self.request.vehicles]

        # --- PHASE 1 : Construction Initiale (Heuristique de tri) ---
        sorted_client_indexes = sorted(
            [i for i in range(1, len(self.request.nodes))],
            key=lambda i: (self.request.nodes[i].time_window.end - self.request.nodes[i].time_window.start) if self.request.nodes[i].time_window else 86400
        )

        for client_idx in sorted_client_indexes:
            node_id = self.request.nodes[client_idx].id
            best_route_idx, best_insert_pos = -1, -1
            best_cost = float('inf')
            best_cloned_route = None

            for r_idx, route in enumerate(routes):
                for pos in range(len(route.nodes) + 1):
                    cloned = route.clone_and_insert(client_idx, pos)
                    if cloned.is_valid:
                        cost = cloned.total_distance + cloned.penalty
                        if cost < best_cost:
                            best_cost, best_route_idx, best_insert_pos, best_cloned_route = cost, r_idx, pos, cloned

            if best_route_idx != -1 and best_cloned_route:
                routes[best_route_idx] = best_cloned_route
            else:
                self.unperformed_nodes.append(node_id)

        # --- PHASE 2 : Recherche Locale Multilatérale ---
        # On va boucler sur 3 opérateurs puissants jusqu'à stabilisation (ou max 3 passes globales)
        global_improved = True
        local_search_pass = 0
        total_optimizations = 0

        while global_improved and local_search_pass < 3:
            local_search_pass += 1
            global_improved = False
            logger.info(f"🔄 --- Passe d'optimisation locale n°{local_search_pass} ---")

            # =================================================================
            # OPÉRATEUR A : 2-OPT (Décroisement géographique intra-tournée)
            # =================================================================
            for r_idx, route in enumerate(routes):
                if len(route.nodes) < 3: continue
                for i in range(len(route.nodes)):
                    for j in range(i + 1, len(route.nodes)):
                        # Inversion du sous-segment entre i et j
                        test_route = Route(route.vehicle, self.request)
                        test_route.nodes = route.nodes[:i] + list(reversed(route.nodes[i:j+1])) + route.nodes[j+1:]
                        test_route.recalculate()

                        if test_route.is_valid and test_route.total_distance < route.total_distance - 1000:
                            gain = round((route.total_distance - test_route.total_distance) / 1000, 2)
                            logger.info(f"   📐 [2-Opt] Modif {route.vehicle.id} : Décroisement réussi ! GAGNE {gain} km")
                            routes[r_idx] = test_route
                            route = test_route
                            global_improved = True
                            total_optimizations += 1

            # =================================================================
            # OPÉRATEUR B : SWAP (Échange de clients entre ou dans les tournées)
            # =================================================================
            for r1_idx, route1 in enumerate(routes):
                for pos1, node1_idx in enumerate(list(route1.nodes)):
                    for r2_idx, route2 in enumerate(routes):
                        for pos2, node2_idx in enumerate(list(route2.nodes)):
                            if r1_idx == r2_idx and pos1 >= pos2: continue

                            # Cas 1 : Échange au sein de la même tournée (Intra-Swap)
                            if r1_idx == r2_idx:
                                test_route = Route(route1.vehicle, self.request)
                                test_route.nodes = list(route1.nodes)
                                test_route.nodes[pos1], test_route.nodes[pos2] = test_route.nodes[pos2], test_route.nodes[pos1]
                                test_route.recalculate()

                                if test_route.is_valid and test_route.total_distance < route1.total_distance - 1000:
                                    gain = round((route1.total_distance - test_route.total_distance) / 1000, 2)
                                    logger.info(f"   🔀 [Intra-Swap] Modif {route1.vehicle.id} : Permutation payante ! GAGNE {gain} km")
                                    routes[r1_idx] = test_route
                                    route1 = test_route
                                    global_improved = True
                                    total_optimizations += 1

                            # Cas 2 : Échange entre deux camions différents (Inter-Swap)
                            else:
                                test_route1 = Route(route1.vehicle, self.request)
                                test_route1.nodes = list(route1.nodes)
                                test_route1.nodes[pos1] = node2_idx
                                test_route1.recalculate()

                                test_route2 = Route(route2.vehicle, self.request)
                                test_route2.nodes = list(route2.nodes)
                                test_route2.nodes[pos2] = node1_idx
                                test_route2.recalculate()

                                if test_route1.is_valid and test_route2.is_valid:
                                    old_dist = route1.total_distance + route2.total_distance
                                    new_dist = test_route1.total_distance + test_route2.total_distance
                                    if new_dist < old_dist - 1000:
                                        gain = round((old_dist - new_dist) / 1000, 2)
                                        logger.info(f"   🔀 [Inter-Swap] Échange entre {route1.vehicle.id} et {route2.vehicle.id} : GAGNE {gain} km")
                                        routes[r1_idx] = test_route1
                                        routes[r2_idx] = test_route2
                                        route1, route2 = test_route1, test_route2
                                        global_improved = True
                                        total_optimizations += 1

            # =================================================================
            # OPÉRATEUR C : RELOCATE (Déplacement simple d'un client)
            # =================================================================
            for r1_idx, route1 in enumerate(routes):
                for pos1, node_idx in enumerate(list(route1.nodes)):
                    for r2_idx, route2 in enumerate(routes):
                        max_pos2 = len(route2.nodes) + 1 if r1_idx != r2_idx else len(route2.nodes)
                        for pos2 in range(max_pos2):
                            if r1_idx == r2_idx and (pos2 == pos1 or pos2 == pos1 + 1): continue

                            test_route1 = Route(route1.vehicle, self.request)
                            test_route1.nodes = [n for idx, n in enumerate(route1.nodes) if idx != pos1]
                            test_route1.recalculate()
                            
                            if r1_idx != r2_idx:
                                test_route2 = route2.clone_and_insert(node_idx, pos2)
                            else:
                                actual_pos2 = pos2 if pos2 < pos1 else pos2 - 1
                                test_route2 = test_route1.clone_and_insert(node_idx, actual_pos2)

                            if test_route1.is_valid and test_route2.is_valid:
                                old_dist = route1.total_distance + route2.total_distance
                                new_dist = test_route1.total_distance + test_route2.total_distance
                                if new_dist < old_dist - 1000:
                                    gain = round((old_dist - new_dist) / 1000, 2)
                                    logger.info(f"   📦 [Relocate] Transfert de client réussi ! GAGNE {gain} km")
                                    routes[r1_idx] = test_route1
                                    routes[r2_idx] = test_route2
                                    route1, route2 = test_route1, test_route2
                                    global_improved = True
                                    total_optimizations += 1

        logger.info(f"🏁 Fin de l'optimisation. {total_optimizations} améliorations appliquées en {round(time.time() - start_time, 3)}s")
        return self._format_solution(routes)

    def _format_solution(self, routes: List[Route]) -> dict:
        vehicles_json = []
        total_dist = 0
        used_vehicles = 0

        for r in routes:
            if not r.nodes: continue
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