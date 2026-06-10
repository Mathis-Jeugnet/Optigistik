import logging
import os
import tempfile
import base64
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import speech_recognition as sr
from pydub import AudioSegment
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

class AudioBase64Request(BaseModel):
    audio_base64: str

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

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    Prend un fichier audio (m4a, wav, etc.) et le transcrit en texte 
    via l'API gratuite de Google Speech Recognition.
    """
    logger.info(f"🎤 Réception d'un fichier audio : {audio.filename}")
    
    # 1. Sauvegarder le fichier uploadé temporairement
    with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as tmp_in:
        tmp_in.write(await audio.read())
        tmp_in_path = tmp_in.name
        
    tmp_out_path = tmp_in_path + ".wav"
    
    try:
        # 2. Convertir en .wav 16kHz Mono (format idéal pour SpeechRecognition)
        audio_segment = AudioSegment.from_file(tmp_in_path)
        audio_segment = audio_segment.set_channels(1).set_frame_rate(16000)
        audio_segment.export(tmp_out_path, format="wav")
        
        # 3. Transcrire avec Google Speech Recognition
        recognizer = sr.Recognizer()
        with sr.AudioFile(tmp_out_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language="fr-FR")
            logger.info(f"✅ Texte reconnu : '{text}'")
            return {"text": text}
            
    except sr.UnknownValueError:
        logger.warning("Je n'ai pas compris l'audio.")
        return {"text": ""}
    except sr.RequestError as e:
        logger.error(f"Erreur de service Google Speech Recognition : {e}")
        raise HTTPException(status_code=500, detail="Service vocal indisponible.")
    except Exception as e:
        logger.exception(f"Erreur lors de la transcription : {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 4. Nettoyage
        if os.path.exists(tmp_in_path):
            os.remove(tmp_in_path)
        if os.path.exists(tmp_out_path):
            os.remove(tmp_out_path)

@app.post("/transcribe_base64")
async def transcribe_audio_base64(request: AudioBase64Request):
    tmp_in_path = ""
    tmp_out_path = ""
    try:
        audio_bytes = base64.b64decode(request.audio_base64)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".m4a") as tmp_in:
            tmp_in.write(audio_bytes)
            tmp_in_path = tmp_in.name

        logging.info("🎤 Réception d'un fichier audio (base64)")

        # Convert to WAV
        audio_segment = AudioSegment.from_file(tmp_in_path)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_out:
            tmp_out_path = tmp_out.name
            
        audio_segment.export(tmp_out_path, format="wav")

        recognizer = sr.Recognizer()
        with sr.AudioFile(tmp_out_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language="fr-FR")
            
        text_lower = text.lower()
        
        # Pour forcer à dire "Signalez un incident", on vérifie que la phrase contient "signal" et "incident"
        has_signal = any(w in text_lower for w in ["signal", "signaler", "signalez"])
        has_incident = any(w in text_lower for w in ["incident", "problème", "souci"])
        is_wake_word = has_signal and has_incident
        
        if is_wake_word:
            logging.info("🌟 WAKE WORD DÉTECTÉ !")
            
        logging.info(f"✅ Texte reconnu : '{text}'")
        return {"text": text, "wake_word_detected": is_wake_word}

    except sr.UnknownValueError:
        logging.warning("⚠️ Audio inintelligible")
        return {"text": "", "wake_word_detected": False}
    except sr.RequestError as e:
        logging.error(f"Erreur API Google : {e}")
        raise HTTPException(status_code=500, detail="Erreur du service de reconnaissance")
    except Exception as e:
        logging.error(f"Erreur lors de la transcription base64 : {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_in_path and os.path.exists(tmp_in_path):
            os.unlink(tmp_in_path)
        if tmp_out_path and os.path.exists(tmp_out_path):
            os.unlink(tmp_out_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)