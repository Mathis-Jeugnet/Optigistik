"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Car,
  Construction,
  Info,
  Loader2,
  MapPin,
} from "lucide-react";
import type { TrafficKind, TrafficSeverity } from "@/services/traffic";

export interface AlertData {
  id: string;
  type: "urgent" | "maintenance" | "info";
  title: string;
  description: string;
  time: string;
  // Champs optionnels pour les alertes trafic (Bison Futé).
  kind?: TrafficKind;
  severity?: TrafficSeverity;
  meta?: string; // ligne secondaire : voies impactées, sens, type de travaux…
  coordinates?: { lat: number; lon: number } | null;
}

interface AlertsListProps {
  alerts: AlertData[];
  isLoading?: boolean;
  error?: string | null;
}

// --- Carrousel vertical ---
const VISIBLE_SLIDES = 2; // nb d'alertes visibles à la fois
const SLIDE_HEIGHT = 124; // px, hauteur fixe d'une alerte (contenu clippé au-delà)
const ROTATE_INTERVAL = 4000; // ms entre deux changements
const TRANSITION_MS = 600;

// Couleur pilotée par la sévérité de l'incident.
const SEVERITY_COLOR: Record<TrafficSeverity, string> = {
  highest: "text-opti-red",
  high: "text-opti-red",
  medium: "text-amber-500",
  low: "text-blue-500",
  unknown: "text-slate-500",
};

const KIND_LABEL: Record<TrafficKind, string> = {
  accident: "Accident",
  bouchon: "Bouchon",
  travaux: "Travaux",
  fermeture: "Fermeture",
  info: "Info trafic",
};

function getKindIcon(kind: TrafficKind, className: string) {
  switch (kind) {
    case "accident": return <AlertTriangle className={className} />;
    case "bouchon": return <Car className={className} />;
    case "travaux": return <Construction className={className} />;
    case "fermeture": return <Ban className={className} />;
    default: return <Info className={className} />;
  }
}

function getGenericIcon(type: string) {
  switch (type) {
    case "urgent": return <AlertCircle className="w-5 h-5 text-opti-red" />;
    case "maintenance": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case "info": return <Info className="w-5 h-5 text-blue-500" />;
    default: return <Info className="w-5 h-5 text-slate-500" />;
  }
}

function getGenericLabel(type: string) {
  switch (type) {
    case "urgent": return <span className="text-[10px] font-bold text-opti-red uppercase tracking-wider">Urgent</span>;
    case "maintenance": return <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Maintenance</span>;
    case "info": return <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Info</span>;
    default: return null;
  }
}

// Contenu d'une alerte "trafic" : icône = catégorie, couleur = sévérité.
function TrafficAlertContent({ alert }: { alert: AlertData }) {
  const color = SEVERITY_COLOR[alert.severity ?? "unknown"];
  return (
    <>
      <div className="shrink-0 mt-1.5 flex justify-center w-6">
        {getKindIcon(alert.kind!, `w-5 h-5 ${color}`)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>
            {KIND_LABEL[alert.kind!]}
          </span>
          {alert.time && (
            <span className="text-[10px] text-slate-400 shrink-0 ml-2 font-medium">{alert.time}</span>
          )}
        </div>
        <h4 className="text-sm font-bold text-opti-blue truncate my-0.5">{alert.title}</h4>
        {alert.meta && (
          <p className="text-[11px] font-medium text-slate-600 truncate">{alert.meta}</p>
        )}
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{alert.description}</p>
        {alert.coordinates && (
          <p className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" />
            {alert.coordinates.lat.toFixed(5)}, {alert.coordinates.lon.toFixed(5)}
          </p>
        )}
      </div>
    </>
  );
}

// Contenu d'une alerte "générique" (compat. ascendante, sans champ trafic).
function GenericAlertContent({ alert }: { alert: AlertData }) {
  return (
    <>
      <div className="shrink-0 mt-1.5 flex justify-center w-6">{getGenericIcon(alert.type)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          {getGenericLabel(alert.type)}
          <span className="text-[10px] text-slate-400 shrink-0 ml-2 font-medium">{alert.time}</span>
        </div>
        <h4 className="text-sm font-bold text-opti-blue truncate my-0.5">{alert.title}</h4>
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{alert.description}</p>
      </div>
    </>
  );
}

// Une "diapo" du carrousel, à hauteur fixe.
function AlertSlide({ alert }: { alert: AlertData }) {
  return (
    <div
      className="flex gap-3 pt-1 overflow-hidden border-b border-gray-50"
      style={{ height: SLIDE_HEIGHT }}
    >
      {alert.kind ? <TrafficAlertContent alert={alert} /> : <GenericAlertContent alert={alert} />}
    </div>
  );
}

// Carrousel vertical auto-défilant : avance d'un cran toutes les ROTATE_INTERVAL ms,
// en boucle fluide (clones des premières diapos en fin de liste), pause au survol.
function AlertsCarousel({ alerts }: { alerts: AlertData[] }) {
  const loopable = alerts.length > VISIBLE_SLIDES;
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  const pausedRef = useRef(false);

  // Avance automatique
  useEffect(() => {
    if (!loopable) return;
    const id = setInterval(() => {
      if (!pausedRef.current) setIndex((i) => i + 1);
    }, ROTATE_INTERVAL);
    return () => clearInterval(id);
  }, [loopable]);

  // Réactive l'animation juste après un saut "sans transition" (retour au début)
  useEffect(() => {
    if (animate) return;
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(raf);
  }, [animate]);

  // Quand on atteint les clones de fin, on resnappe au début sans animation
  const handleTransitionEnd = () => {
    if (index >= alerts.length) {
      setAnimate(false);
      setIndex(0);
    }
  };

  if (!loopable) {
    return (
      <div>
        {alerts.map((alert) => (
          <AlertSlide key={alert.id} alert={alert} />
        ))}
      </div>
    );
  }

  const slides = [...alerts, ...alerts.slice(0, VISIBLE_SLIDES)];

  return (
    <div
      className="overflow-hidden"
      style={{ height: VISIBLE_SLIDES * SLIDE_HEIGHT }}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <div
        style={{
          transform: `translateY(-${index * SLIDE_HEIGHT}px)`,
          transition: animate ? `transform ${TRANSITION_MS}ms ease-in-out` : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {slides.map((alert, i) => (
          <AlertSlide key={`${alert.id}-${i}`} alert={alert} />
        ))}
      </div>
    </div>
  );
}

export default function AlertsList({ alerts, isLoading, error }: AlertsListProps) {
  const renderBody = () => {
    if (isLoading && alerts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-gray-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p>Chargement des infos trafic…</p>
        </div>
      );
    }

    if (error && alerts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-gray-400 gap-1">
          <AlertCircle className="w-5 h-5 text-opti-red" />
          <p className="text-center text-sm">{error}</p>
        </div>
      );
    }

    if (alerts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[100px] text-gray-400">
          <p>Aucune alerte</p>
        </div>
      );
    }

    // key sur le nombre d'alertes => remontage propre (reset) si la liste change de taille.
    return <AlertsCarousel key={alerts.length} alerts={alerts} />;
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
      <h3 className="text-xl font-bold text-opti-blue mb-4 font-display">Alertes & Notifications</h3>
      <div className="flex-1">{renderBody()}</div>
    </div>
  );
}
