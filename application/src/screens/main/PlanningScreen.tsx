import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useActiveTour } from '../../utils/ActiveTourContext';
import { getApiUrl, fetchWithRetry } from '../../utils/api';

export default function PlanningScreen({ navigation }: any) {
  const { driverId } = useActiveTour();
  const [planning, setPlanning] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

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

  const parsePlanningDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
      const [d, m, y] = dateStr.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    const parsed = Date.parse(dateStr);
    return isNaN(parsed) ? null : new Date(parsed);
  };

  const getTodayMidnight = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const todayMidnight = getTodayMidnight();

  // Services à venir / aujourd'hui (tri chronologique croissant : le plus proche en haut)
  const upcomingPlanning = planning
    .filter((item) => {
      const pDate = parsePlanningDate(item.date);
      if (!pDate) return true;
      return pDate >= todayMidnight;
    })
    .sort((a, b) => {
      const dateA = parsePlanningDate(a.date)?.getTime() || 0;
      const dateB = parsePlanningDate(b.date)?.getTime() || 0;
      return dateA - dateB;
    });

  // Services passés (tri anti-chronologique décroissant : le plus récent en haut)
  const historyPlanning = planning
    .filter((item) => {
      const pDate = parsePlanningDate(item.date);
      if (!pDate) return false;
      return pDate < todayMidnight;
    })
    .sort((a, b) => {
      const dateA = parsePlanningDate(a.date)?.getTime() || 0;
      const dateB = parsePlanningDate(b.date)?.getTime() || 0;
      return dateB - dateA;
    });

  const getStatusStyle = (status: string, isHistory = false) => {
    if (isHistory) {
      return {
        bg: '#f3f4f6',
        text: '#6b7280',
        label: 'Terminé'
      };
    }
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

  const renderPlanningItem = (item: any, isHistory = false) => {
    const statusInfo = getStatusStyle(item.status, isHistory);
    const dateLabel = formatDateLabel(item.date);

    return (
      <View key={item.id} style={styles.cardContainer}>
        <View style={styles.dateHeader}>
          <Feather name="calendar" size={16} color={isHistory ? "#9ca3af" : "#4b5563"} style={{ marginRight: 8 }} />
          <Text style={[styles.dateLabelText, isHistory && { color: '#6b7280' }]}>{dateLabel || 'Date non définie'}</Text>
        </View>

        <View style={[styles.card, isHistory && styles.historyCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.timeContainer}>
              <Feather name="clock" size={16} color={isHistory ? "#9ca3af" : "#6b7280"} />
              <Text style={[styles.timeText, isHistory && { color: '#6b7280' }]}>
                {formatTime(item.startTime)} - {formatTime(item.endTime)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
            </View>
          </View>

          <Text style={[styles.sessionName, isHistory && { color: '#374151' }]}>{item.sessionName}</Text>

          <View style={styles.divider} />

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Feather name="truck" size={16} color={isHistory ? "#9ca3af" : "#ef4444"} style={{ marginRight: 8 }} />
              <Text style={[styles.detailText, isHistory && { color: '#6b7280' }]}>{item.vehicleName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="info" size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <Text style={[styles.detailText, isHistory && { color: '#6b7280' }]}>
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
        <ScrollView
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchPlanning(false);
              }}
              colors={['#ef4444']}
            />
          }
        >
          {/* SECTION 1 : SERVICES A VENIR */}
          <View style={styles.sectionHeaderContainer}>
            <View style={styles.sectionHeaderLeft}>
              <Feather name="calendar" size={18} color="#ef4444" />
              <Text style={styles.sectionTitle}>Services à venir</Text>
            </View>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{upcomingPlanning.length}</Text>
            </View>
          </View>

          {upcomingPlanning.length === 0 ? (
            <View style={styles.emptySectionCard}>
              <Feather name="calendar" size={24} color="#9ca3af" style={{ marginBottom: 6 }} />
              <Text style={styles.emptySubtext}>Aucun service à venir pour le moment.</Text>
            </View>
          ) : (
            upcomingPlanning.map((item) => renderPlanningItem(item, false))
          )}

          {/* SECTION 2 : MON HISTORIQUE */}
          <TouchableOpacity
            style={[styles.sectionHeaderContainer, { marginTop: 24 }]}
            onPress={() => setIsHistoryExpanded(!isHistoryExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Feather name="clock" size={18} color="#6b7280" />
              <Text style={styles.sectionTitle}>Mon Historique</Text>
            </View>
            <View style={styles.sectionHeaderRight}>
              <View style={[styles.badgeCount, { backgroundColor: '#f3f4f6' }]}>
                <Text style={[styles.badgeCountText, { color: '#4b5563' }]}>{historyPlanning.length}</Text>
              </View>
              <Feather name={isHistoryExpanded ? "chevron-up" : "chevron-down"} size={20} color="#6b7280" />
            </View>
          </TouchableOpacity>

          {isHistoryExpanded && (
            historyPlanning.length === 0 ? (
              <View style={styles.emptySectionCard}>
                <Feather name="archive" size={24} color="#9ca3af" style={{ marginBottom: 6 }} />
                <Text style={styles.emptySubtext}>Aucun service passé dans l'historique.</Text>
              </View>
            ) : (
              historyPlanning.map((item) => renderPlanningItem(item, true))
            )
          )}
        </ScrollView>
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
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  badgeCount: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  },
  emptySectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
    textAlign: 'center',
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
  historyCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    opacity: 0.88,
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
