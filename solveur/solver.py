import logging
import time
import random
from typing import List
from models import OptimizationRequest

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

    def copy(self) -> 'Route':
        """Copie rapide de la structure de la route."""
        cloned = Route(self.vehicle, self.request)
        cloned.nodes = list(self.nodes)
        cloned.is_valid = self.is_valid
        cloned.timeline = list(self.timeline)
        cloned.total_distance = self.total_distance
        cloned.total_time = self.total_time
        return cloned

    def clone_and_insert(self, node_index: int, position: int) -> 'Route':
        """Copie la route et insère un nœud pour simuler sa faisabilité."""
        cloned = Route(self.vehicle, self.request)
        cloned.nodes = list(self.nodes)
        cloned.nodes.insert(position, node_index)
        cloned.recalculate(generate_timeline=False)  # Simulation rapide
        return cloned

    def recalculate(self, generate_timeline: bool = False):
        """
        VALIDATEUR CHRONOLOGIQUE ET LÉGAL ASYMÉTRIQUE
        Gère dynamiquement : Départ(Dépôt A) -> Clients -> Arrivée(Dépôt B)
        """
        self.is_valid = True
        self.total_distance = 0
        self.total_time = 0
        if generate_timeline:
            self.timeline = []

        if not self.nodes:
            return

        current_time = 0
        # Le véhicule commence à son dépôt de départ spécifique
        current_node_idx = self.vehicle.start_node_idx 
        accumulated_work_before_break = 0
        total_demand = 0

        if generate_timeline:
            self.timeline.append({
                "stop_type": "DEPOT_START",
                "client_id": self.request.nodes[current_node_idx].id,
                "arrival_time": current_time // 60
            })

        for next_node_idx in self.nodes:
            node = self.request.nodes[next_node_idx]
            
            # --- FILTRE 1 : Contrainte d'accès typologie véhicule ---
            if node.allowed_vehicle_types and self.vehicle.vehicle_type not in node.allowed_vehicle_types:
                self.is_valid = False
                return

            # --- FILTRE 2 : Capacité ---
            total_demand += node.demand
            if total_demand > self.vehicle.capacity:
                self.is_valid = False
                return

            transit_time = self.request.time_matrix[current_node_idx][next_node_idx]
            transit_dist = self.request.distance_matrix[current_node_idx][next_node_idx]

            # --- FILTRE 4 : RSE (4h30 max) ---
            if self.request.enforce_break and (accumulated_work_before_break + transit_time > 16200):
                current_time += self.request.break_duration_seconds
                if generate_timeline:
                    self.timeline.append({
                        "stop_type": "BREAK",
                        "client_id": "PAUSE_RSE",
                        "arrival_time": current_time // 60
                    })
                accumulated_work_before_break = 0

            current_time += transit_time
            accumulated_work_before_break += transit_time
            self.total_distance += transit_dist

            # --- FILTRE 3 : Fenêtres Horaires STRICTES ---
            if node.time_window:
                if current_time < node.time_window.start:
                    wait_time = node.time_window.start - current_time
                    if self.request.enforce_break and wait_time >= self.request.break_duration_seconds:
                        if generate_timeline and (not self.timeline or self.timeline[-1]["stop_type"] != "BREAK"):
                            self.timeline.append({
                                "stop_type": "BREAK",
                                "client_id": "PAUSE_RSE",
                                "arrival_time": current_time // 60
                            })
                        accumulated_work_before_break = 0
                    current_time = node.time_window.start
                elif current_time > node.time_window.end:
                    self.is_valid = False
                    return

            if generate_timeline:
                self.timeline.append({
                    "stop_type": "DELIVERY",
                    "client_id": node.id,
                    "arrival_time": current_time // 60
                })

            if self.request.enforce_break and (accumulated_work_before_break + node.service_time > 16200):
                current_time += self.request.break_duration_seconds
                if generate_timeline:
                    self.timeline.append({
                        "stop_type": "BREAK",
                        "client_id": "PAUSE_RSE",
                        "arrival_time": current_time // 60
                    })
                accumulated_work_before_break = 0

            current_time += node.service_time
            accumulated_work_before_break += node.service_time
            current_node_idx = next_node_idx

        # --- RETOUR AU DÉPÔT DISSOCIÉ (Fin de tournée) ---
        end_idx = self.vehicle.end_node_idx
        transit_to_depot = self.request.time_matrix[current_node_idx][end_idx]
        
        if self.request.enforce_break and (accumulated_work_before_break + transit_to_depot > 16200):
            current_time += self.request.break_duration_seconds
            if generate_timeline:
                self.timeline.append({
                    "stop_type": "BREAK",
                    "client_id": "PAUSE_RSE",
                    "arrival_time": current_time // 60
                })
            accumulated_work_before_break = 0

        current_time += transit_to_depot
        self.total_distance += self.request.distance_matrix[current_node_idx][end_idx]

        if generate_timeline:
            self.timeline.append({
                "stop_type": "DEPOT_END",
                "client_id": self.request.nodes[end_idx].id,
                "arrival_time": current_time // 60
            })

        self.total_time = current_time

        if self.total_time > self.vehicle.max_service_time:
            self.is_valid = False


class VRPOptimizer:
    def __init__(self, request: OptimizationRequest):
        self.request = request
        self.unperformed_nodes: List[str] = []
        random.seed(42)

    def solve(self, initial_routes=None) -> dict:
        start_time = time.time()
        logger.info(f"🚀 INITIALISATION MOTEUR SÉQUENTIEL ASYMÉTRIQUE")

        # Initialisation de la flotte
        routes = [Route(v, self.request) for v in self.request.vehicles]
        
        # Identification de tous les index agissant comme dépôts (Départ ou Arrivée)
        depot_indexes = set()
        for v in self.request.vehicles:
            depot_indexes.add(v.start_node_idx)
            depot_indexes.add(v.end_node_idx)
            
        # Extraction exclusive des index clients à livrer
        all_client_indexes = [i for i in range(len(self.request.nodes)) if i not in depot_indexes]

        # --- PHASE 1 : Construction par Regret-2 ---
        routes = self._insert_nodes_regret(routes, all_client_indexes)

        # --- PHASE 2 : Recherche Locale Multilatérale (VND) ---
        routes = self._variable_neighborhood_descent(routes)
        
        best_routes = [r.copy() for r in routes]
        best_unperformed = list(self.unperformed_nodes)
        best_distance = sum(r.total_distance for r in best_routes if r.nodes)

        # --- PHASE 3 : META-VNS ---
        max_vns_iterations = 5
        for vns_iter in range(1, max_vns_iterations + 1):
            shaken_routes = [r.copy() for r in best_routes]
            shaken_unperformed = list(best_unperformed)

            num_to_eject = random.randint(3, 4)
            all_active_nodes = [node for r in shaken_routes for node in r.nodes]
            
            if len(all_active_nodes) >= num_to_eject:
                ejected_nodes = random.sample(all_active_nodes, num_to_eject)
                for r in shaken_routes:
                    r.nodes = [n for n in r.nodes if n not in ejected_nodes]
                    r.recalculate(generate_timeline=False)

            nodes_to_reinsert = ejected_nodes + [self._id_to_index(nid) for nid in shaken_unperformed]
            shaken_unperformed.clear()

            shaken_routes = self._insert_nodes_regret(shaken_routes, nodes_to_reinsert, shaken_unperformed)
            shaken_routes = self._variable_neighborhood_descent(shaken_routes)
            shaken_distance = sum(r.total_distance for r in shaken_routes if r.nodes)

            if len(shaken_unperformed) <= len(best_unperformed) and shaken_distance < best_distance - 10:
                best_routes = [r.copy() for r in shaken_routes]
                best_unperformed = list(shaken_unperformed)
                best_distance = shaken_distance

        self.unperformed_nodes = best_unperformed
        
        # Génération finale des parcours textuels
        for r in best_routes:
            r.recalculate(generate_timeline=True)

        logger.info(f"🏁 Résolution terminée en {round(time.time() - start_time, 3)}s")
        return self._format_solution(best_routes)

    def _insert_nodes_regret(self, routes: List[Route], node_indexes: List[int], unperformed_list=None) -> List[Route]:
        uninserted = list(node_indexes)
        
        while uninserted:
            best_node_idx = -1
            best_route_idx = -1
            best_insert_pos = -1
            max_regret = -1
            saved_best_cloned_route = None

            for node_idx in uninserted:
                best_cost = float('inf')
                second_best_cost = float('inf')
                
                node_best_route_idx = -1
                node_best_insert_pos = -1
                node_best_cloned_route = None

                for r_idx, route in enumerate(routes):
                    for pos in range(len(route.nodes) + 1):
                        cloned = route.clone_and_insert(node_idx, pos)
                        if cloned.is_valid:
                            cost = cloned.total_distance
                            if cost < best_cost:
                                second_best_cost = best_cost
                                best_cost = cost
                                node_best_route_idx = r_idx
                                node_best_insert_pos = pos
                                node_best_cloned_route = cloned
                            elif cost < second_best_cost:
                                second_best_cost = cost

                if best_cost == float('inf'):
                    continue

                if second_best_cost == float('inf'):
                    regret = 5000000 
                else:
                    regret = second_best_cost - best_cost

                if regret > max_regret:
                    max_regret = regret
                    best_node_idx = node_idx
                    best_route_idx = node_best_route_idx
                    best_insert_pos = node_best_insert_pos
                    saved_best_cloned_route = node_best_cloned_route

            if best_node_idx == -1:
                for node_idx in uninserted:
                    node_id = self.request.nodes[node_idx].id
                    if unperformed_list is not None:
                        unperformed_list.append(node_id)
                    else:
                        self.unperformed_nodes.append(node_id)
                break

            routes[best_route_idx] = saved_best_cloned_route
            uninserted.remove(best_node_idx)

        return routes

    def _variable_neighborhood_descent(self, routes: List[Route]) -> List[Route]:
        improved = True
        loop_guard = 0
        
        while improved and loop_guard < 4:
            loop_guard += 1
            improved = False

            # Voisinage 1 : 2-Opt
            for r_idx, route in enumerate(routes):
                if len(route.nodes) < 3: continue
                for i in range(len(route.nodes)):
                    for j in range(i + 1, len(route.nodes)):
                        test_route = Route(route.vehicle, self.request)
                        test_route.nodes = route.nodes[:i] + list(reversed(route.nodes[i:j+1])) + route.nodes[j+1:]
                        test_route.recalculate(generate_timeline=False)
                        
                        if test_route.is_valid and test_route.total_distance < route.total_distance - 10:
                            routes[r_idx] = test_route
                            improved = True
                            break
                    if improved: break
                if improved: break
            if improved: continue

            # Voisinage 2 : Swap
            for r1_idx, route1 in enumerate(routes):
                for pos1, node1_idx in enumerate(list(route1.nodes)):
                    for r2_idx, route2 in enumerate(routes):
                        for pos2, node2_idx in enumerate(list(route2.nodes)):
                            if r1_idx == r2_idx and pos1 >= pos2: continue
                            
                            if r1_idx == r2_idx:
                                test_route = Route(route1.vehicle, self.request)
                                test_route.nodes = list(route1.nodes)
                                test_route.nodes[pos1], test_route.nodes[pos2] = test_route.nodes[pos2], test_route.nodes[pos1]
                                test_route.recalculate(generate_timeline=False)
                                if test_route.is_valid and test_route.total_distance < route1.total_distance - 10:
                                    routes[r1_idx] = test_route
                                    improved = True
                                    break
                            else:
                                test_route1 = Route(route1.vehicle, self.request)
                                test_route1.nodes = list(route1.nodes)
                                test_route1.nodes[pos1] = node2_idx
                                test_route1.recalculate(generate_timeline=False)
                                
                                test_route2 = Route(route2.vehicle, self.request)
                                test_route2.nodes = list(route2.nodes)
                                test_route2.nodes[pos2] = node1_idx
                                test_route2.recalculate(generate_timeline=False)
                                
                                if test_route1.is_valid and test_route2.is_valid:
                                    if (test_route1.total_distance + test_route2.total_distance) < (route1.total_distance + route2.total_distance - 10):
                                        routes[r1_idx], routes[r2_idx] = test_route1, test_route2
                                        improved = True
                                        break
                        if improved: break
                    if improved: break
                if improved: break
            if improved: continue

            # Voisinage 3 : Relocate
            for r1_idx, route1 in enumerate(routes):
                for pos1, node_idx in enumerate(list(route1.nodes)):
                    for r2_idx, route2 in enumerate(routes):
                        max_pos2 = len(route2.nodes) + 1 if r1_idx != r2_idx else len(route2.nodes)
                        for pos2 in range(max_pos2):
                            if r1_idx == r2_idx and (pos2 == pos1 or pos2 == pos1 + 1): continue
                            
                            test_route1 = Route(route1.vehicle, self.request)
                            test_route1.nodes = [n for idx, n in enumerate(route1.nodes) if idx != pos1]
                            test_route1.recalculate(generate_timeline=False)
                            
                            test_route2 = route2.clone_and_insert(node_idx, pos2) if r1_idx != r2_idx else test_route1.clone_and_insert(node_idx, pos2 if pos2 < pos1 else pos2 - 1)
                            
                            if test_route1.is_valid and test_route2.is_valid:
                                if (test_route1.total_distance + test_route2.total_distance) < (route1.total_distance + route2.total_distance - 10):
                                    routes[r1_idx], routes[r2_idx] = test_route1, test_route2
                                    improved = True
                                    break
                        if improved: break
                    if improved: break
                if improved: break

        return routes

    def _id_to_index(self, node_id: str) -> int:
        for idx, n in enumerate(self.request.nodes):
            if n.id == node_id: return idx
        return -1

    def _format_solution(self, routes: List[Route]) -> dict:
        vehicles_json = []
        total_dist = 0
        used_vehicles = 0
        for r in routes:
            if not r.nodes: continue
            used_vehicles += 1
            total_dist += r.total_distance
            vehicles_json.append({"vehicle_id": r.vehicle.id, "route": r.timeline})
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