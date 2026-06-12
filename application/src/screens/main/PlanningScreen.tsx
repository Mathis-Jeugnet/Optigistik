import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useActiveTour } from '../../utils/ActiveTourContext';
import { getApiUrl, fetchWithRetry } from '../../utils/api';

export default function PlanningScreen({ navigation }: any) {
  const { driverId } = useActiveTour();
  const [planning, setPlanning] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanning = async (showLoadingIndicator = true) => {
    if (!driverId) {
      setError('Chauffeur non connecté.');
      setLoading(false);
      return;
    }

    if (showLoadingIndicator) setLoading(true);
    setError(null);

    try {
      const apiUrl = getApiUrl();
      const { response, data } = await fetchWithRetry(`${apiUrl}/api/driver/planning?driverId=${driverId}`, {
        method: 'GET',
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        }
      });

      if (response.ok && data.success) {
        setPlanning(data.planning || []);
      } else {
        setError(data.error || 'Impossible de récupérer votre planning.');
      }
    } catch (err) {
      console.error('Fetch planning error:', err);
      setError('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlanning();
  }, [driverId]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '--:--';
    try {
      const d = new Date(dateStr);
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      return `${h}h${m}`;
    } catch (e) {
      return '--:--';
    }
  };

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      // Le format attendu de date est YYYY-MM-DD
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const options: any = { weekday: 'long', day: 'numeric', month: 'long' };
        const label = d.toLocaleDateString('fr-FR', options);
        return label.charAt(0).toUpperCase() + label.slice(1);
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          bg: '#e6f4ea',
          text: '#137333',
          label: 'Terminé'
        };
      case 'IN_PROGRESS':
        return {
          bg: '#e8f0fe',
          text: '#1a73e8',
          label: 'En cours'
        };
      default:
        return {
          bg: '#fef7e0',
          text: '#b06000',
          label: 'Planifié'
        };
    }
  };

  const renderPlanningItem = ({ item }: { item: any }) => {
    const statusInfo = getStatusStyle(item.status);
    const dateLabel = formatDateLabel(item.date);

    return (
      <View style={styles.cardContainer}>
        {/* En-tête de date s'il y a un changement de date */}
        <View style={styles.dateHeader}>
          <Feather name="calendar" size={16} color="#4b5563" style={{ marginRight: 8 }} />
          <Text style={styles.dateLabelText}>{dateLabel || 'Date non définie'}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.timeContainer}>
              <Feather name="clock" size={16} color="#6b7280" />
              <Text style={styles.timeText}>
                {formatTime(item.startTime)} - {formatTime(item.endTime)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
            </View>
          </View>

          <Text style={styles.sessionName}>{item.sessionName}</Text>

          <View style={styles.divider} />

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Feather name="truck" size={16} color="#ef4444" style={{ marginRight: 8 }} />
              <Text style={styles.detailText}>{item.vehicleName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="info" size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <Text style={styles.detailText}>
                Statut de la mission : {statusInfo.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Planning</Text>
        <Text style={styles.subtitle}>Consultez vos horaires de travail et vos services planifiés</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ef4444" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-triangle" size={48} color="#9ca3af" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchPlanning()}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : planning.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="calendar" size={64} color="#d1d5db" style={{ marginBottom: 16 }} />
          <Text style={styles.emptyTitle}>Aucun service planifié</Text>
          <Text style={styles.emptyText}>Vous n'avez pas de missions ou de plages de travail assignées pour le moment.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchPlanning(false)}>
            <Text style={styles.retryButtonText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={planning}
          renderItem={renderPlanningItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchPlanning(false);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  listContainer: {
    padding: 16,
  },
  cardContainer: {
    marginBottom: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  dateLabelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sessionName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginBottom: 12,
  },
  detailsContainer: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
