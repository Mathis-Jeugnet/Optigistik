import requests
import json
import random
import math
from typing import Dict, List, Tuple

API_URL = "http://localhost:8000"

class RealisticVRPGenerator:
    """
    Générateur de données VRP réalistes.
    
    Crée des nœuds sur une grille 2D avec distances euclidiennes cohérentes.
    Cela simule une zone géographique réelle avec clients disséminés.
    """
    
    def __init__(self, seed: int = 42):
        random.seed(seed)
        self.seed = seed
    
    def generate_locations(self, num_nodes: int, grid_size: int = 100) -> List[Tuple[float, float]]:
        """
        Génère des coordonnées (x, y) réalistes sur une grille.
        
        Args:
            num_nodes: Nombre de clients + dépôt
            grid_size: Taille de la grille (km)
        
        Returns:
            Liste de (x, y) coordonnées
        """
        locations = [(grid_size / 2, grid_size / 2)]  # Dépôt au centre
        
        for i in range(1, num_nodes):
            x = random.uniform(0, grid_size)
            y = random.uniform(0, grid_size)
            locations.append((x, y))
        
        return locations
    
    def euclidean_distance(self, loc1: Tuple[float, float], loc2: Tuple[float, float]) -> int:
        """Calcule distance euclidienne en mètres (1 unit = 1 km)."""
        dx = loc1[0] - loc2[0]
        dy = loc1[1] - loc2[1]
        distance_km = math.sqrt(dx*dx + dy*dy)
        return int(distance_km * 1000)  # Convertir en mètres
    
    def travel_time_from_distance(self, distance_m: int, speed_kmh: float = 60) -> int:
        """
        Calcule temps de trajet en secondes.
        
        Args:
            distance_m: Distance en mètres
            speed_kmh: Vitesse moyenne (60 km/h = réaliste en zone urbaine)
        
        Returns:
            Temps en secondes
        """
        distance_km = distance_m / 1000
        hours = distance_km / speed_kmh
        return int(hours * 3600)
    
    def generate_test_data(
        self,
        num_nodes: int = 101,
        num_vehicles: int = 17,
        grid_size: int = 100,  # 100 km × 100 km
        enable_soft_windows: bool = True,
        enable_soft_time_windows: bool = True,
        enforce_break: bool = True,
        time_window_start: int = 28800,    # 08h00
        time_window_end: int = 61200,      # 17h00
        vehicle_max_time: int = 43200,     # 12h
    ) -> Dict:
        """
        Génère un dataset VRP réaliste et faisable.
        
        Returns:
            Dictionnaire au format OptimizationRequest
        """
        
        print(f"\n📍 Génération données réalistes : {num_nodes} nœuds, {num_vehicles} véhicules")
        print(f"   Zone : {grid_size}×{grid_size} km")
        
        # Générer coordonnées
        locations = self.generate_locations(num_nodes, grid_size)
        
        # Construire matrices distance et temps
        dist_matrix = []
        time_matrix = []
        
        for i, loc_i in enumerate(locations):
            dist_row = []
            time_row = []
            
            for j, loc_j in enumerate(locations):
                if i == j:
                    dist_row.append(0)
                    time_row.append(0)
                else:
                    distance = self.euclidean_distance(loc_i, loc_j)
                    travel_time = self.travel_time_from_distance(distance)
                    dist_row.append(distance)
                    time_row.append(travel_time)
            
            dist_matrix.append(dist_row)
            time_matrix.append(time_row)
        
        # Statistiques
        distances = [d for i, row in enumerate(dist_matrix) for j, d in enumerate(row) if i != j]
        avg_distance = sum(distances) / len(distances) / 1000  # En km
        avg_time = sum([self.travel_time_from_distance(d) for d in distances]) / len(distances) / 60  # En min
        
        print(f"   Distance moyenne: {avg_distance:.1f} km ({avg_time:.1f} min)")
        
        # Créer nœuds
        nodes = [{
            "id": "DEPOT",
            "x": locations[0][0],
            "y": locations[0][1],
            "demand": 0,
            "service_time": 0,
            "time_window": {"start": 0, "end": 86400}
        }]
        
        for i in range(1, num_nodes):
            # Service time : 5-20 min
            service_time = random.randint(300, 1200)
            
            nodes.append({
                "id": f"CLIENT_{i:03d}",
                "x": locations[i][0],
                "y": locations[i][1],
                "demand": random.randint(1, 5),
                "service_time": service_time,
                "time_window": {"start": time_window_start, "end": time_window_end}
            })
        
        # Créer véhicules
        vehicles = [
            {
                "id": f"CAMION_{k:02d}",
                "capacity": 50,
                "max_service_time": vehicle_max_time,
                "is_night_shift": False
            }
            for k in range(1, num_vehicles + 1)
        ]
        
        # Statistiques faisabilité
        total_service = sum(n["service_time"] for n in nodes[1:])
        window_duration = time_window_end - time_window_start
        
        print(f"\n   Statistiques faisabilité:")
        print(f"   • Service time total: {total_service/60:.0f} min")
        print(f"   • Par véhicule (~{(num_nodes-1)//num_vehicles} clients): {(total_service/num_vehicles)/60:.0f} min")
        print(f"   • Fenêtre horaire: {window_duration/3600:.1f}h ({window_duration/60:.0f}min)")
        print(f"   • Marge pour trajets: {(window_duration - total_service/num_vehicles)/60:.0f} min")
        
        if (window_duration - total_service/num_vehicles) < avg_time * 10:
            print(f"   ⚠️  Fenêtre serrée - OK si distances non trop grandes")
        else:
            print(f"   ✅ Fenêtre confortable")
        
        return {
            "distance_matrix": dist_matrix,
            "time_matrix": time_matrix,
            "nodes": nodes,
            "vehicles": vehicles,
            "enable_soft_time_windows": enable_soft_windows,
            "enforce_break": enforce_break,
        }


class VRPTester:
    """Suite de tests avec données réalistes."""
    
    def __init__(self, api_url: str = API_URL):
        self.api_url = api_url
        self.generator = RealisticVRPGenerator()
        self.results = []
    
    def test_small(self):
        """Test 1: 20 points - baseline."""
        print("\n" + "="*70)
        print("TEST 1 : BASELINE - 20 points avec données réalistes")
        print("="*70)
        
        payload = self.generator.generate_test_data(
            num_nodes=21,
            num_vehicles=3,
            grid_size=50,  # Zone 50×50 km
            enforce_break=True
        )
        
        return self._run_test(payload, "Baseline 20 pts")
    
    def test_medium(self):
        """Test 2: 50 points."""
        print("\n" + "="*70)
        print("TEST 2 : MOYEN - 50 points avec données réalistes")
        print("="*70)
        
        payload = self.generator.generate_test_data(
            num_nodes=51,
            num_vehicles=6,
            grid_size=75,
            enforce_break=True
        )
        
        return self._run_test(payload, "Moyen 50 pts")
    
    def test_large_without_breaks(self):
        """Test 3: 100 points SANS pauses (diagnostic)."""
        print("\n" + "="*70)
        print("TEST 3 : LARGE SANS PAUSES - 100 points")
        print("="*70)
        
        payload = self.generator.generate_test_data(
            num_nodes=101,
            num_vehicles=17,
            grid_size=100,
            enforce_break=False
        )
        
        return self._run_test(payload, "100 pts sans pauses", expected_success=True)
    
    def test_large_with_soft_windows(self):
        """Test 4: 100 points avec fenêtres souples."""
        print("\n" + "="*70)
        print("TEST 4 : LARGE FENÊTRES SOUPLES - 100 points")
        print("="*70)
        
        payload = self.generator.generate_test_data(
            num_nodes=101,
            num_vehicles=17,
            grid_size=100,
            enable_soft_time_windows=True,
            enforce_break=True
        )
        
        return self._run_test(payload, "100 pts fenêtres souples")
    
    def test_large_extended_hours(self):
        """Test 5: 100 points avec heures étendues."""
        print("\n" + "="*70)
        print("TEST 5 : HEURES ÉTENDUES - 100 points (06h-19h)")
        print("="*70)
        
        payload = self.generator.generate_test_data(
            num_nodes=101,
            num_vehicles=17,
            grid_size=100,
            enable_soft_time_windows=True,
            time_window_start=21600,   # 06h00
            time_window_end=68400,     # 19h00
            vehicle_max_time=57600,    # 16h
            enforce_break=True
        )
        
        return self._run_test(payload, "100 pts heures étendues")
    
    def test_large_more_vehicles(self):
        """Test 6: 100 points avec plus de véhicules."""
        print("\n" + "="*70)
        print("TEST 6 : PLUS VÉHICULES - 100 points + 23 camions")
        print("="*70)
        
        payload = self.generator.generate_test_data(
            num_nodes=101,
            num_vehicles=23,
            grid_size=100,
            enforce_break=True
        )
        
        return self._run_test(payload, "100 pts + véhicules")
    
    def _run_test(self, payload: Dict, test_name: str, expected_success: bool = True) -> bool:
        """Exécute un test."""
        import time
        
        try:
            start = time.time()
            response = requests.post(
                f"{self.api_url}/api/optimize",
                json=payload,
                timeout=660
            )
            elapsed = time.time() - start
            
            if response.status_code == 200:
                data = response.json()
                
                print(f"✅ {test_name} - Succès en {elapsed:.1f}s")
                print(f"   Distance: {data['summary']['total_distance_km']} km")
                print(f"   Service level: {data['summary']['service_level']}%")
                print(f"   Points non servis: {len(data['summary']['unperformed_nodes'])}")
                print(f"   Véhicules utilisés: {data['summary']['vehicles_used']}")
                
                # Vérifier pauses
                total_breaks = sum(
                    len([s for s in v['route'] if s['stop_type'] == 'BREAK'])
                    for v in data['vehicles']
                )
                print(f"   Pauses RSE: {total_breaks}")
                
                self.results.append((test_name, True, elapsed))
                return True
            else:
                error = response.json().get('detail', response.text)
                print(f"❌ {test_name} - Erreur {response.status_code}")
                print(f"   {error}")
                
                self.results.append((test_name, False, elapsed))
                return expected_success == False
        
        except requests.Timeout:
            print(f"⏱️ {test_name} - Timeout")
            self.results.append((test_name, False, 600))
            return False
        
        except Exception as e:
            print(f"❌ {test_name} - Exception: {e}")
            self.results.append((test_name, False, 0))
            return False
    
    def print_summary(self):
        """Résumé des tests."""
        print("\n" + "="*70)
        print("RÉSUMÉ DES TESTS")
        print("="*70)
        
        for test_name, success, elapsed in self.results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status} | {test_name:40s} | {elapsed:6.1f}s")
        
        total_pass = sum(1 for _, s, _ in self.results if s)
        total = len(self.results)
        print(f"\nRésultat: {total_pass}/{total} tests réussis")


if __name__ == "__main__":
    print("\n🚀 SUITE DE TESTS VRP AVEC DONNÉES RÉALISTES")
    print("=" * 70)
    
    tester = VRPTester()
    
    # Exécuter les tests
    tester.test_small()
    tester.test_medium()
    tester.test_large_without_breaks()
    tester.test_large_with_soft_windows()
    tester.test_large_extended_hours()
    tester.test_large_more_vehicles()
    
    tester.print_summary()