"use client";

import { MaintenanceLog } from "@/services/fleet";
import { UserRole, canEdit } from "@/app/context/AuthContext";
import { Wrench, AlertTriangle, CheckCircle2, AlertCircle, MessageSquare, Clock, Edit2, Trash2 } from "lucide-react";

interface MaintenanceTimelineProps {
  logs: MaintenanceLog[];
  onEdit: (log: MaintenanceLog) => void;
  onDelete: (logId: string) => void;
  userRole: UserRole;
}

export default function MaintenanceTimeline({ logs, onEdit, onDelete, userRole }: MaintenanceTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
        <Clock className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-sm font-medium">Aucun historique disponible</p>
      </div>
    );
  }

  const getIcon = (type: MaintenanceLog['type']) => {
    switch (type) {
      case 'Maintenance': return <Wrench className="w-4 h-4" />;
      case 'Panne': return <AlertTriangle className="w-4 h-4" />;
      case 'Avarie': return <AlertCircle className="w-4 h-4" />;
      case 'Réactivation': return <CheckCircle2 className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getColorClass = (type: MaintenanceLog['type']) => {
    switch (type) {
      case 'Maintenance': return "bg-blue-100 text-blue-600 border-blue-200";
      case 'Panne': return "bg-red-100 text-red-600 border-red-200";
      case 'Avarie': return "bg-orange-100 text-orange-600 border-orange-200";
      case 'Réactivation': return "bg-green-100 text-green-600 border-green-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  return (
    <div className="relative pl-8 space-y-8 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
      {logs.map((log, index) => (
        <div key={log.id || index} className="relative group animate-fade-in">
          {/* Point/Icon on Timeline */}
          <div className={`absolute -left-11 top-0 w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 transition-transform group-hover:scale-110 ${getColorClass(log.type)}`}>
            {getIcon(log.type)}
          </div>

          {/* Content Card */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm group-hover:border-opti-red/30 transition-all group-hover:shadow-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getColorClass(log.type)}`}>
                  {log.type}
                </span>
                {canEdit(userRole) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(log)}
                      className="text-gray-400 hover:text-blue-600 transition-colors"
                      title="Modifier cet événement"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => log.id && onDelete(log.id)}
                      className="text-gray-400 hover:text-opti-red transition-colors"
                      title="Supprimer cet événement"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {log.date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <p className="text-sm text-opti-blue font-medium leading-relaxed">
              {log.description}
            </p>
            {log.author && (
              <p className="mt-2 text-[10px] text-gray-400 italic">Par {log.author}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
