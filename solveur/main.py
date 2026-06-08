import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware # 1. Import nécessaire
from models import OptimizationRequest
from solver import VRPOptimizer

# Configuration des logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Optigistik Solveur API", version="3.0")

# 2. Configuration CORS : Autorise votre front-end à communiquer avec cette API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"], # URL de votre interface Next.js
    allow_credentials=True,
    allow_methods=["*"], # Autorise tous les verbes HTTP (POST, OPTIONS, etc.)
    allow_headers=["*"], # Autorise tous les headers
)

@app.post("/api/optimize")
def optimize_route(request: OptimizationRequest):
    """
    Point d'entrée principal du solveur Python Pur :
    1. Reçoit la requête de livraison.
    2. Valide et optimise de manière chronologique (Contraintes RSE prioritaires).
    """
    try:
        logger.info(f"📥 Requête reçue : {len(request.nodes) - 1} clients à traiter.")

        # Initialisation du nouveau solveur en Python pur
        optimizer = VRPOptimizer(request)
        
        # Résolution (Le solveur gère en interne la construction et la recherche locale)
        result = optimizer.solve()
        
        logger.info("🏁 Optimisation et vérification RSE terminées avec succès.")
        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("💥 Erreur inattendue dans le moteur de calcul")
        raise HTTPException(
            status_code=500, 
            detail=f"Erreur interne du solveur : {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)