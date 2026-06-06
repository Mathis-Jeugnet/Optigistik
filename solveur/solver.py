import logging
import time
import random
import os
import concurrent.futures
from typing import List, Dict
from models import OptimizationRequest

logger = logging.getLogger(__name__)

class Route:
    def __init__(self, vehicle, request: OptimizationRequest):
        self.vehicle = vehicle
        self.request = request
        self.nodes: List[int] = []  
        self.is_valid = True
        self.timeline = []
        self.total_distance = 0
        self.total_time = 0

    def copy(self) -> 'Route':
        cloned = Route(self.vehicle, self.request)
        cloned.nodes = list(self.nodes)
        cloned.is_valid = self.is_valid
        cloned.timeline = list(self.timeline)
        cloned.total_distance = self.total_distance
        cloned.total_time = self.total_time
        return cloned

    def clone_and_insert(self, node_index: int, position: int) -> 'Route':
        cloned = Route(self.vehicle, self.request)
        cloned.nodes = list(self.nodes)
        cloned.nodes.insert(position, node_index)
        cloned.recalculate(generate_timeline=False)
        return cloned

    def recalculate(self, generate_timeline: bool = False) -> dict:
        self.is_valid = True
        self.total_distance = 0
        self.total_time = 0
        if generate_timeline:
            self.timeline = []

        if not self.nodes:
            return {"status": "VALID"}

        current_time = self.request.current_time
        current_node_idx = self.vehicle.start_node_idx 
        
        accum_drive = 0
        accum_work = 0
        total_demand = 0

        if generate_timeline:
            self.timeline.append({
                "stop_type": "DEPOT_START",
                "client_id": self.request.nodes[current_node_idx].id,
                "arrival_time": current_time // 60
            })

        nodes_triggering_reload = set()
        temp_demand = 0
        for idx, n_idx in enumerate(self.nodes):
            node_demand = self.request.nodes[n_idx].demand
            if temp_demand + node_demand > self.vehicle.capacity:
                nodes_triggering_reload.add(idx)
                temp_demand = node_demand
            else:
                temp_demand += node_demand

        for idx, next_node_idx in enumerate(self.nodes):
            node = self.request.nodes[next_node_idx]
            
            if node.allowed_vehicle_types and self.vehicle.vehicle_type not in node.allowed_vehicle_types:
                self.is_valid = False
                return {"status": "ERR_ACCES"}

            if node.required_skills:
                v_skills = self.vehicle.skills or []
                if not all(skill in v_skills for skill in node.required_skills):
                    self.is_valid = False
                    return {"status": "ERR_COMPETENCE"}

            if idx in nodes_triggering_reload:
                if self.request.allow_multi_trip:
                    depot_idx = self.vehicle.start_node_idx
                    transit_to_depot = self.request.time_matrix[current_node_idx][depot_idx]
                    dist_to_depot = self.request.distance_matrix[current_node_idx][depot_idx]
                    
                    dynamic_reload_time = 0
                    for future_idx in range(idx, len(self.nodes)):
                        if future_idx != idx and future_idx in nodes_triggering_reload:
                            break
                        dynamic_reload_time += self.request.nodes[self.nodes[future_idx]].loading_time
                    
                    if self.request.enforce_break and ((accum_drive + transit_to_depot > self.request.max_continuous_driving_seconds) or 
                                                       (accum_work + transit_to_depot > self.request.max_continuous_work_seconds)):
                        current_time += self.request.break_duration_seconds
                        if generate_timeline:
                            self.timeline.append({"stop_type": "BREAK", "client_id": "PAUSE_RSE", "arrival_time": current_time // 60})
                        accum_drive = 0
                        accum_work = 0
                        
                    current_time += transit_to_depot
                    accum_drive += transit_to_depot
                    accum_work += transit_to_depot
                    self.total_distance += dist_to_depot
                    
                    if generate_timeline:
                        self.timeline.append({
                            "stop_type": "RELOAD", 
                            "client_id": self.request.nodes[depot_idx].id, 
                            "arrival_time": current_time // 60,
                            "loading_duration_min": dynamic_reload_time // 60
                        })
                        
                    if self.request.enforce_break and (accum_work + dynamic_reload_time > self.request.max_continuous_work_seconds):
                        current_time += self.request.break_duration_seconds
                        if generate_timeline:
                            self.timeline.append({"stop_type": "BREAK", "client_id": "PAUSE_RSE", "arrival_time": current_time // 60})
                        accum_drive = 0
                        accum_work = 0
                        
                    current_time += dynamic_reload_time
                    accum_work += dynamic_reload_time
                    
                    total_demand = node.demand
                    current_node_idx = depot_idx
                else:
                    self.is_valid = False
                    return {"status": "ERR_CAPACITE"}
            else:
                total_demand += node.demand

            transit_time = self.request.time_matrix[current_node_idx][next_node_idx]
            transit_dist = self.request.distance_matrix[current_node_idx][next_node_idx]

            if self.request.enforce_break and ((accum_drive + transit_time > self.request.max_continuous_driving_seconds) or 
                                               (accum_work + transit_time > self.request.max_continuous_work_seconds)):
                current_time += self.request.break_duration_seconds
                if generate_timeline:
                    self.timeline.append({"stop_type": "BREAK", "client_id": "PAUSE_RSE", "arrival_time": current_time // 60})
                accum_drive = 0
                accum_work = 0

            current_time += transit_time
            accum_drive += transit_time
            accum_work += transit_time
            self.total_distance += transit_dist

            if node.time_window:
                if current_time < node.time_window.start:
                    wait_time = node.time_window.start - current_time
                    if self.request.enforce_break and wait_time >= self.request.break_duration_seconds:
                        if generate_timeline and (not self.timeline or self.timeline[-1]["stop_type"] != "BREAK"):
                            self.timeline.append({"stop_type": "BREAK", "client_id": "PAUSE_ATTENTE", "arrival_time": current_time // 60})
                        accum_drive = 0
                        accum_work = 0
                    current_time = node.time_window.start
                elif current_time > node.time_window.end:
                    self.is_valid = False
                    return {"status": "ERR_HORAIRE"}

            if generate_timeline:
                self.timeline.append({"stop_type": "DELIVERY", "client_id": node.id, "arrival_time": current_time // 60})

            # --- UTILISATION DE UNLOADING_TIME POUR LE CLIENT ---
            if self.request.enforce_break and (accum_work + node.unloading_time > self.request.max_continuous_work_seconds):
                current_time += self.request.break_duration_seconds
                if generate_timeline:
                    self.timeline.append({"stop_type": "BREAK", "client_id": "PAUSE_RSE", "arrival_time": current_time // 60})
                accum_drive = 0
                accum_work = 0

            current_time += node.unloading_time
            accum_work += node.unloading_time
            current_node_idx = next_node_idx

        end_idx = self.vehicle.end_node_idx
        transit_to_depot = self.request.time_matrix[current_node_idx][end_idx]
        
        if self.request.enforce_break and ((accum_drive + transit_to_depot > self.request.max_continuous_driving_seconds) or 
                                           (accum_work + transit_to_depot > self.request.max_continuous_work_seconds)):
            current_time += self.request.break_duration_seconds
            if generate_timeline:
                self.timeline.append({
                    "stop_type": "BREAK",
                    "client_id": "PAUSE_RSE",
                    "arrival_time": current_time // 60
                })
            accum_drive = 0
            accum_work = 0

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
            return {"status": "ERR_AMPLITUDE"}

        return {"status": "VALID"}


class VRPOptimizer:
    def __init__(self, request: OptimizationRequest, allow_split_deliveries: bool = True):
        self.request = request
        self.allow_split_deliveries = allow_split_deliveries
        self.unperformed_report: List[Dict] = []
        random.seed(42)
        
        if self.allow_split_deliveries:
            self._preprocess_split_deliveries()

    def _preprocess_split_deliveries(self):
        new_nodes = []
        old_indices = []
        old_to_new_mapping = {}
        
        current_new_idx = 0
        
        for idx, node in enumerate(self.request.nodes):
            old_to_new_mapping[idx] = current_new_idx
            
            if node.demand == 0:
                new_nodes.append(node)
                old_indices.append(idx)
                current_new_idx += 1
                continue
                
            compatible_capacities = [
                v.capacity for v in self.request.vehicles 
                if (not node.allowed_vehicle_types or v.vehicle_type in node.allowed_vehicle_types) and
                   (not node.required_skills or all(s in (v.skills or []) for s in node.required_skills))
            ]
            
            max_cap = max(compatible_capacities, default=0)
            
            if max_cap > 0 and node.demand > max_cap:
                num_full_trucks = node.demand // max_cap
                remainder = node.demand % max_cap
                
                for i in range(num_full_trucks):
                    sub_node = node.model_copy(deep=True)
                    sub_node.id = f"{node.id}_PART_{i+1}"
                    sub_node.demand = max_cap
                    new_nodes.append(sub_node)
                    old_indices.append(idx)
                    current_new_idx += 1
                    
                if remainder > 0:
                    sub_node = node.model_copy(deep=True)
                    sub_node.id = f"{node.id}_PART_FINAL"
                    sub_node.demand = remainder
                    new_nodes.append(sub_node)
                    old_indices.append(idx)
                    current_new_idx += 1
            else:
                new_nodes.append(node)
                old_indices.append(idx)
                current_new_idx += 1
                
        self.request.nodes = new_nodes
        
        new_distance_matrix = []
        new_time_matrix = []
        for i in old_indices:
            new_distance_matrix.append([self.request.distance_matrix[i][j] for j in old_indices])
            new_time_matrix.append([self.request.time_matrix[i][j] for j in old_indices])
            
        self.request.distance_matrix = new_distance_matrix
        self.request.time_matrix = new_time_matrix
        
        for v in self.request.vehicles:
            v.start_node_idx = old_to_new_mapping[v.start_node_idx]
            v.end_node_idx = old_to_new_mapping[v.end_node_idx]

    def _explore_vns_branch(self, seed_val: int, base_routes: List[Route], base_unperformed_report: List[Dict]) -> tuple:
        random.seed(seed_val)
        self.unperformed_report = [] 
        shaken_routes = [r.copy() for r in base_routes]
        shaken_unperformed_report = list(base_unperformed_report)

        num_to_eject = random.randint(3, 4)
        all_active_nodes = [node for r in shaken_routes for node in r.nodes if self.request.nodes[node].locked_vehicle_id is None]

        unperformed_priorities = [
            self.request.nodes[self._id_to_index(rep["client_id"])].priority_level 
            for rep in shaken_unperformed_report if self._id_to_index(rep["client_id"]) != -1
        ]
        max_unperformed_priority = max(unperformed_priorities) if unperformed_priorities else 1

        if len(all_active_nodes) >= num_to_eject:
            if max_unperformed_priority > 1:
                low_priority_active = [n for n in all_active_nodes if self.request.nodes[n].priority_level < max_unperformed_priority]
                
                if len(low_priority_active) >= num_to_eject:
                    ejected_nodes = random.sample(low_priority_active, num_to_eject)
                elif low_priority_active:
                    ejected_nodes = low_priority_active + random.sample([n for n in all_active_nodes if n not in low_priority_active], num_to_eject - len(low_priority_active))
                else:
                    ejected_nodes = random.sample(all_active_nodes, num_to_eject)
            else:
                ejected_nodes = random.sample(all_active_nodes, num_to_eject)
                
            for r in shaken_routes:
                r.nodes = [n for n in r.nodes if n not in ejected_nodes]
                r.recalculate(generate_timeline=False)

        nodes_to_reinsert = list(ejected_nodes)
        for rep in shaken_unperformed_report:
            idx = self._id_to_index(rep["client_id"])
            if idx != -1 and self.request.nodes[idx].locked_vehicle_id is None:
                nodes_to_reinsert.append(idx)

        shaken_routes = self._insert_nodes_regret(shaken_routes, nodes_to_reinsert, use_priority_multiplier=(max_unperformed_priority > 1))
        shaken_routes = self._variable_neighborhood_descent(shaken_routes)
        shaken_distance = sum(r.total_distance for r in shaken_routes if r.nodes)

        new_unperformed_score = sum(
            self.request.nodes[self._id_to_index(rep["client_id"])].priority_level 
            for rep in self.unperformed_report if self._id_to_index(rep["client_id"]) != -1
        )

        return shaken_routes, list(self.unperformed_report), shaken_distance, new_unperformed_score

    def solve(self, initial_routes=None) -> dict:
        start_time = time.time()
        logger.info(f"🚀 INITIALISATION MOTEUR DYNAMIQUE MULTI-CŒURS (T={self.request.current_time}s)")

        max_idx = len(self.request.nodes) - 1
        for v in self.request.vehicles:
            if v.start_node_idx > max_idx or v.end_node_idx > max_idx or v.start_node_idx < 0 or v.end_node_idx < 0:
                logger.error(f"Dépôt invalide pour le véhicule {v.id}.")
                return {
                    "status": "error",
                    "message_exploitant": f"Erreur fatale : Le véhicule {v.id} est assigné à un dépôt qui n'existe pas dans la matrice.",
                    "summary": {"total_distance_km": 0, "service_level_percent": 0, "vehicles_used_count": 0},
                    "rapport_affretement": [], "vehicles": []
                }

        routes = [Route(v, self.request) for v in self.request.vehicles]
        
        depot_indexes = set()
        for v in self.request.vehicles:
            depot_indexes.add(v.start_node_idx)
            depot_indexes.add(v.end_node_idx)
            
        all_client_indexes = [i for i in range(len(self.request.nodes)) if i not in depot_indexes]

        locked_indexes = [i for i in all_client_indexes if self.request.nodes[i].locked_vehicle_id is not None]
        free_indexes = [i for i in all_client_indexes if self.request.nodes[i].locked_vehicle_id is None]

        for node_idx in locked_indexes:
            node = self.request.nodes[node_idx]
            target_r_idx = next((i for i, r in enumerate(routes) if r.vehicle.id == node.locked_vehicle_id), -1)
            
            if target_r_idx != -1:
                best_cost = float('inf')
                best_cloned = None
                for pos in range(len(routes[target_r_idx].nodes) + 1):
                    cloned = routes[target_r_idx].clone_and_insert(node_idx, pos)
                    if cloned.is_valid and cloned.total_distance < best_cost:
                        best_cost = cloned.total_distance
                        best_cloned = cloned
                if best_cloned:
                    routes[target_r_idx] = best_cloned
                else:
                    self.unperformed_report.append({"client_id": node.id, "raison_rejet": "ERREUR_LOCKED_NODE_HORAIRE_DEPASSE"})
            else:
                self.unperformed_report.append({"client_id": node.id, "raison_rejet": "ERREUR_VEHICULE_VERROUILLE_INCONNU"})

        routes = self._insert_nodes_regret(routes, free_indexes)
        routes = self._variable_neighborhood_descent(routes)
        
        best_routes = [r.copy() for r in routes]
        best_distance = sum(r.total_distance for r in best_routes if r.nodes)

        best_unperformed_score = sum(
            self.request.nodes[self._id_to_index(rep["client_id"])].priority_level 
            for rep in self.unperformed_report if self._id_to_index(rep["client_id"]) != -1
        )

        max_vns_iterations = 8 
        generations = 2 
        workers = min(os.cpu_count() or 4, 8) 

        try:
            with concurrent.futures.ProcessPoolExecutor(max_workers=workers) as executor:
                for gen in range(generations):
                    futures = []
                    for i in range(max_vns_iterations):
                        seed_val = 42 + gen * max_vns_iterations + i 
                        futures.append(executor.submit(
                            self._explore_vns_branch, 
                            seed_val, 
                            best_routes, 
                            self.unperformed_report
                        ))

                    for future in concurrent.futures.as_completed(futures):
                        try:
                            shaken_routes, shaken_unperformed_report, shaken_distance, new_unperformed_score = future.result()

                            if new_unperformed_score < best_unperformed_score:
                                best_routes = [r.copy() for r in shaken_routes]
                                best_distance = shaken_distance
                                best_unperformed_score = new_unperformed_score
                                self.unperformed_report = list(shaken_unperformed_report)
                            elif new_unperformed_score == best_unperformed_score:
                                if len(shaken_unperformed_report) < len(self.unperformed_report):
                                    best_routes = [r.copy() for r in shaken_routes]
                                    best_distance = shaken_distance
                                    best_unperformed_score = new_unperformed_score
                                    self.unperformed_report = list(shaken_unperformed_report)
                                elif len(shaken_unperformed_report) == len(self.unperformed_report) and shaken_distance < best_distance - 10:
                                    best_routes = [r.copy() for r in shaken_routes]
                                    best_distance = shaken_distance
                                    best_unperformed_score = new_unperformed_score
                                    self.unperformed_report = list(shaken_unperformed_report)
                        except Exception as inner_e:
                            logger.error(f"Erreur dans un processus enfant : {inner_e}")
        except Exception as e:
            logger.warning(f"La parallélisation native a échoué ({e}), le solveur va continuer sur la meilleure route trouvée à la phase de construction.")

        for r in best_routes:
            r.recalculate(generate_timeline=True)

        logger.info(f"🏁 Résolution terminée en {round(time.time() - start_time, 3)}s")
        return self._format_solution(best_routes)

    def _insert_nodes_regret(self, routes: List[Route], node_indexes: List[int], use_priority_multiplier: bool = False) -> List[Route]:
        uninserted = list(node_indexes)
        
        while uninserted:
            best_node_idx = -1
            best_route_idx = -1
            best_insert_pos = -1
            max_regret = -1
            saved_best_cloned_route = None

            for node_idx in uninserted:
                node = self.request.nodes[node_idx]
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

                if use_priority_multiplier:
                    regret = regret * (node.priority_level ** 4)

                if regret > max_regret:
                    max_regret = regret
                    best_node_idx = node_idx
                    best_route_idx = node_best_route_idx
                    best_insert_pos = node_best_insert_pos
                    saved_best_cloned_route = node_best_cloned_route

            if best_node_idx == -1:
                for node_idx in list(uninserted):
                    node_id = self.request.nodes[node_idx].id
                    reason = self._diagnose_rejection_cause(routes, node_idx)
                    
                    self.unperformed_report.append({
                        "client_id": node_id,
                        "raison_rejet": reason
                    })
                    uninserted.remove(node_idx)
                break

            routes[best_route_idx] = saved_best_cloned_route
            uninserted.remove(best_node_idx)

        return routes

    def _diagnose_rejection_cause(self, routes: List[Route], node_idx: int) -> str:
        node = self.request.nodes[node_idx]
        
        all_vehicle_types = set(r.vehicle.vehicle_type for r in routes)
        if node.allowed_vehicle_types and not any(vt in node.allowed_vehicle_types for vt in all_vehicle_types):
            return "INCOMPATIBILITE_VEHICULE_FLOTTE"

        if node.required_skills:
            has_capable_vehicle = False
            for r in routes:
                v_skills = r.vehicle.skills or []
                if all(skill in v_skills for skill in node.required_skills):
                    has_capable_vehicle = True
                    break
            if not has_capable_vehicle:
                return "INCOMPATIBILITE_COMPETENCES_FLOTTE"

        causes = set()
        for route in routes:
            for pos in range(len(route.nodes) + 1):
                diag = route.clone_and_insert(node_idx, pos).recalculate(generate_timeline=False)
                if diag["status"] != "VALID":
                    causes.add(diag["status"])

        if "ERR_CAPACITE" in causes and len(causes) == 1:
            return "SATURE_CAPACITE_POIDS_VOLUME"
        if "ERR_HORAIRE" in causes or "ERR_AMPLITUDE" in causes:
            return "SATURE_AMPLITUDE_TEMPS_OU_FENETRES_HORAIRES"
            
        return "SATURE_FLOTTE_GENERALE"

    def _variable_neighborhood_descent(self, routes: List[Route]) -> List[Route]:
        improved = True
        loop_guard = 0
        
        while improved and loop_guard < 4:
            loop_guard += 1
            improved = False

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
                                if self.request.nodes[node1_idx].locked_vehicle_id or self.request.nodes[node2_idx].locked_vehicle_id:
                                    continue

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

            for r1_idx, route1 in enumerate(routes):
                for pos1, node_idx in enumerate(list(route1.nodes)):
                    for r2_idx, route2 in enumerate(routes):
                        max_pos2 = len(route2.nodes) + 1 if r1_idx != r2_idx else len(route2.nodes)
                        for pos2 in range(max_pos2):
                            if r1_idx == r2_idx and (pos2 == pos1 or pos2 == pos1 + 1): continue
                            
                            if r1_idx != r2_idx and self.request.nodes[node_idx].locked_vehicle_id:
                                continue
                            
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
        service_level = round(100 * (1 - len(self.unperformed_report) / total_nodes), 1) if total_nodes > 0 else 100

        statut_message = "Tournées 100% validées."
        if self.unperformed_report:
            statut_message = f"Attention, {len(self.unperformed_report)} point(s) n'ont pas pu être planifiés en raison de contraintes physiques ou légales strictes. Veuillez faire appel à un affréteur pour les points listés ci-dessous."

        return {
            "status": "success" if not self.unperformed_report else "partial_success",
            "message_exploitant": statut_message,
            "summary": {
                "total_distance_km": round(total_dist / 1000, 2),
                "service_level_percent": service_level,
                "vehicles_used_count": used_vehicles
            },
            "rapport_affretement": self.unperformed_report,
            "vehicles": vehicles_json
        }