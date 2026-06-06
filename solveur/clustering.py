import numpy as np
from sklearn.cluster import KMeans
from typing import List
from models import OptimizationRequest

class ClusterManager:
    @staticmethod
    def get_initial_solution(request: OptimizationRequest) -> List[List[int]]:
        """
        Retourne une solution initiale sous forme de liste de routes.
        ATTENTION : OR-Tools attend UNIQUEMENT les nœuds intermédiaires, pas les dépôts.
        Exemple attendu : [[5, 2], [1, 3], ...] et NON [[0, 5, 2, 0], [0, 1, 3, 0], ...]
        """
        clients = request.nodes[1:]
        
        # S'il n'y a pas de clients, on retourne des routes vides
        if not clients:
            return [[] for _ in range(len(request.vehicles))]
            
        coords = np.array([[n.x, n.y] for n in clients])
        n_vehicles = len(request.vehicles)
        
        # K-Means clustering
        kmeans = KMeans(n_clusters=min(n_vehicles, len(clients)), random_state=42).fit(coords)
        
        initial_routes = []
        for i in range(n_vehicles):
            # On récupère les index originaux (idx + 1 car le dépôt est à l'index 0)
            cluster_indices = [idx + 1 for idx, label in enumerate(kmeans.labels_) if label == i]
            
            # CORRECTION : On ne met PAS les '0' aux extrémités
            initial_routes.append(cluster_indices)
            
        return initial_routes