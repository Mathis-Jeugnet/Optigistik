import logging
from fastapi import FastAPI, HTTPException
from models import OptimizationRequest
from solver import VRPOptimizer
from clustering import ClusterManager

# Configuration des logs pour suivre l'exécution dans la console
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Optigistik Solveur API", version="2.0")

@app.post("/api/optimize")
def optimize_route(request: OptimizationRequest):
    """
    Point d'entrée principal :
    1. Calcule une solution initiale via clustering (Warm Start).
    2. Lance l'optimisation OR-Tools à partir de cette base.
    """
    try:
        logger.info(f"Requête reçue : {len(request.nodes)} nœuds à traiter.")

        # 1. Clustering pour le Warm Start
        # On génère une suggestion de répartition des tournées
        initial_routes = ClusterManager.get_initial_solution(request)
        logger.info("Clustering effectué avec succès.")

        # 2. Résolution avec OR-Tools
        optimizer = VRPOptimizer(request)
        
        # On passe la solution initiale au solveur
        result = optimizer.solve(initial_routes=initial_routes)
        
        logger.info("Optimisation terminée.")
        return result

    except HTTPException as he:
        # Relance les erreurs connues (ex: pas de solution)
        raise he
    except Exception as e:
        logger.exception("Erreur inattendue dans le solveur")
        raise HTTPException(
            status_code=500, 
            detail=f"Erreur interne du solveur : {str(e)}"
        )

# Pour lancer l'API en local (via uvicorn main:app --reload)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)