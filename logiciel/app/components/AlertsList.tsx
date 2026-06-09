"use client";

import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Car,
  Construction,
  Info,
  Loader2,
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
}

interface AlertsListProps {
  alerts: AlertData[];
  isLoading?: boolean;
  error?: string | null;
}

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

// Rendu d'une alerte "trafic" : icône = catégorie, couleur = sévérité.
function renderTrafficAlert(alert: AlertData) {
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
      </div>
    </>
  );
}

export default function AlertsList({ alerts, isLoading, error }: AlertsListProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "urgent": return <AlertCircle className="w-5 h-5 text-opti-red" />;
      case "maintenance": return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "info": return <Info className="w-5 h-5 text-blue-500" />;
      default: return <Info className="w-5 h-5 text-slate-500" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case "urgent": return <span className="text-[10px] font-bold text-opti-red uppercase tracking-wider">Urgent</span>;
      case "maintenance": return <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Maintenance</span>;
      case "info": return <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Info</span>;
      default: return null;
    }
  };

  // Rendu d'une alerte "générique" (compat. ascendante, sans champ trafic).
  const renderGenericAlert = (alert: AlertData) => (
    <>
      <div className="shrink-0 mt-1.5 flex justify-center w-6">
        {getIcon(alert.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          {getLabel(alert.type)}
          <span className="text-[10px] text-slate-400 shrink-0 ml-2 font-medium">{alert.time}</span>
        </div>
        <h4 className="text-sm font-bold text-opti-blue truncate my-0.5">{alert.title}</h4>
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{alert.description}</p>
      </div>
    </>
  );

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

    return alerts.map((alert) => (
      <div key={alert.id} className="flex gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
        {alert.kind ? renderTrafficAlert(alert) : renderGenericAlert(alert)}
      </div>
    ));
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col h-full">
      <h3 className="text-xl font-bold text-opti-blue mb-4 font-display">Alertes & Notifications</h3>
      <div className="space-y-4 flex-1 max-h-[300px] overflow-y-auto pr-1">{renderBody()}</div>
    </div>
  );
}
