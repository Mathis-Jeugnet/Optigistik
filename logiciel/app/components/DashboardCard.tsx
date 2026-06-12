import { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  children: ReactNode;
  className?: string;
  fullHeight?: boolean;
}

export default function DashboardCard({
  title,
  children,
  className = "",
  fullHeight = false,
}: DashboardCardProps) {
  return (
    <div
      className={`bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col ${
        fullHeight ? "h-full" : ""
      } ${className}`}
    >
      <h3 className="text-lg font-bold text-opti-blue mb-5 font-display">
        {title}
      </h3>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
