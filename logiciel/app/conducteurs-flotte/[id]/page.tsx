"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Driver } from "@/types";
import { getDriverById } from "@/services/drivers";
import DriverDetail from "../../components/DriverDetail";
import DashboardLayout from "../../components/DashboardLayout";
import RoleGuard from "../../components/RoleGuard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DriverDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDriver = async () => {
      const data = await getDriverById(id);
      if (data) {
        setDriver(data);
      } else {
        router.replace("/conducteurs-flotte");
      }
      setLoading(false);
    };
    fetchDriver();
  }, [id, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20 w-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-opti-blue"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!driver) return null;

  return (
    <DashboardLayout>
      <RoleGuard allowedRoles={["Admin", "Gestionnaire", "Lecteur"]}>
        <DriverDetail
          driver={driver}
          onUpdate={setDriver}
          onBack={() => router.push("/conducteurs-flotte")}
        />
      </RoleGuard>
    </DashboardLayout>
  );
}