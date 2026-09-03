import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView, SafeAreaView, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useActiveTour } from '../../utils/ActiveTourContext';
import { getApiUrl, fetchWithRetry } from '../../utils/api';

export default function ToursScreen({ navigation }: any) {
  const { driverId, selectTour, activeTour } = useActiveTour();
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTour, setSelectedTour] = useState<any | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);

  const fetchTours = async (showLoadingIndicator = true) => {
    if (!driverId) {
      setError('Chauffeur non connecté.');
      setLoading(false);
      return;
    }

    if (showLoadingIndicator) setLoading(true);
    setError(null);

    try {
      const apiUrl = getApiUrl();
      const { response, data } = await fetchWithRetry(`${apiUrl}/api/driver/tours?driverId=${driverId}`, {
        method: 'GET',
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        }
      });

      if (response.ok && data.success) {
        setTours(data.tours || []);
      } else {
        setError(data.error || 'Impossible de récupérer les tournées.');
      }
    } catch (err) {
      console.error('Fetch tours error:', err);
      setError('Erreur de connexion au serveur.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTours();
  }, [driverId]);

  const handleSelectTour = (tour: any) => {
    selectTour(tour);
    setSelectedTour(null); // Fermer le modal de détails
    navigation.navigate('Trajet'); // Retourner sur l'onglet GPS
  };

  const formatTime = (minutes: number) => {
    if (typeof minutes !== 'number' || isNaN(minutes)) return '--:--';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
  };

  const parseTourDate = (dateStr: string): Date | null => {
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

  // Tournées à venir / aujourd'hui (date >= aujourd'hui)
  // Trie chronologique croissant : la plus proche en haut
  const upcomingTours = tours
    .filter((tour) => {
      const tourDate = parseTourDate(tour.date);
      if (!tourDate) return true; // Si pas de date, conservée dans à venir
      return tourDate >= todayMidnight;
    })
    .sort((a, b) => {
      const dateA = parseTourDate(a.date)?.getTime() || 0;
      const dateB = parseTourDate(b.date)?.getTime() || 0;
      return dateA - dateB;
    });

  // Tournées passées (date < aujourd'hui)
  // Trie anti-chronologique décroissant : la plus récente passée en haut
  const historyTours = tours
    .filter((tour) => {
      const tourDate = parseTourDate(tour.date);
      if (!tourDate) return false;
      return tourDate < todayMidnight;
    })
    .sort((a, b) => {
      const dateA = parseTourDate(a.date)?.getTime() || 0;
      const dateB = parseTourDate(b.date)?.getTime() || 0;
      return dateB - dateA;
    });

  const getStopIcon = (type: string) => {
    switch (type) {
      case 'DEPOT_START': return 'home';
      case 'DEPOT_END': return 'flag';
      case 'RELOAD': return 'refresh-cw';
      case 'BREAK': return 'coffee';
      default: return 'map-pin';
    }
  };

  const getStopColor = (type: string) => {
    switch (type) {
      case 'DEPOT_START': return '#3b82f6';
      case 'DEPOT_END': return '#10b981';
      case 'RELOAD': return '#f59e0b';
      case 'BREAK': return '#8b5cf6';
      default: return '#ef4444';
    }
  };

  const renderTourCard = (item: any, isHistory = false) => {
    const isActive = activeTour && activeTour.sessionId === item.sessionId;

    return (
      <TouchableOpacity 
        key={item.sessionId}
        style={[styles.card, isHistory && styles.historyCard, isActive && styles.activeCard]} 
        onPress={() => setSelectedTour(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Feather name="calendar" size={16} color={isHistory ? "#9ca3af" : "#6b7280"} />
            <Text style={[styles.dateText, isHistory && styles.historyDateText]}>{item.date}</Text>
          </View>
          {isActive ? (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Actif sur GPS</Text>
            </View>
          ) : isHistory ? (
            <View style={styles.historyBadge}>
              <Text style={styles.historyBadgeText}>Passée</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.tourName, isHistory && styles.historyTourName]}>{item.sessionName}</Text>

        <View style={styles.truckContainer}>
          <Feather name="truck" size={16} color={isHistory ? "#9ca3af" : "#ef4444"} />
          <Text style={[styles.truckText, isHistory && styles.historyTruckText]}>{item.vehicleName}</Text>
        </View>

        <View style={[styles.statsContainer, isHistory && styles.historyStatsContainer]}>
          <View style={styles.statItem}>
            <Feather name="map-pin" size={14} color="#6b7280" />
            <Text style={styles.statValue}>{item.stopsCount}</Text>
            <Text style={styles.statLabel}>arrêts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Feather name="package" size={14} color="#6b7280" />
            <Text style={styles.statValue}>{item.palletsCount}</Text>
            <Text style={styles.statLabel}>palettes</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.viewDetailsText, isHistory && styles.historyViewDetailsText]}>
            Voir le détail des étapes
          </Text>
          <Feather name="chevron-right" size={16} color={isHistory ? "#9ca3af" : "#ef4444"} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Tournées</Text>
        <Text style={styles.subtitle}>Consultez et sélectionnez vos feuilles de route</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ef4444" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-triangle" size={48} color="#9ca3af" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchTours()}>
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : tours.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="clipboard" size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>Aucune tournée validée ne vous est assignée.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchTours(false)}>
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
                fetchTours(false);
              }}
              colors={['#ef4444']}
            />
          }
        >
          {/* SECTION 1 : TOURNEES A VENIR */}
          <View style={styles.sectionHeaderContainer}>
            <View style={styles.sectionHeaderLeft}>
              <Feather name="truck" size={18} color="#ef4444" />
              <Text style={styles.sectionTitle}>Tournées à venir</Text>
            </View>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{upcomingTours.length}</Text>
            </View>
          </View>

          {upcomingTours.length === 0 ? (
            <View style={styles.emptySectionCard}>
              <Feather name="calendar" size={24} color="#9ca3af" style={{ marginBottom: 6 }} />
              <Text style={styles.emptySubtext}>Aucune tournée à venir pour le moment.</Text>
            </View>
          ) : (
            upcomingTours.map((item) => renderTourCard(item, false))
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
                <Text style={[styles.badgeCountText, { color: '#4b5563' }]}>{historyTours.length}</Text>
              </View>
              <Feather name={isHistoryExpanded ? "chevron-up" : "chevron-down"} size={20} color="#6b7280" />
            </View>
          </TouchableOpacity>

          {isHistoryExpanded && (
            historyTours.length === 0 ? (
              <View style={styles.emptySectionCard}>
                <Feather name="archive" size={24} color="#9ca3af" style={{ marginBottom: 6 }} />
                <Text style={styles.emptySubtext}>Aucune tournée passée dans l'historique.</Text>
              </View>
            ) : (
              historyTours.map((item) => renderTourCard(item, true))
            )
          )}
        </ScrollView>
      )}

      {/* MODAL DE DÉTAIL DES ÉTAPES */}
      {selectedTour && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={!!selectedTour}
          onRequestClose={() => setSelectedTour(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedTour.sessionName}</Text>
                  <Text style={styles.modalSubtitle}>Camion: {selectedTour.vehicleName}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedTour(null)} style={styles.closeButton}>
                  <Feather name="x" size={24} color="#1f2937" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.stepsList} contentContainerStyle={styles.stepsListContent}>
                {selectedTour.nodes.map((node: any, index: number) => {
                  const stepType = node.step_type || 'DELIVERY';
                  const icon = getStopIcon(stepType);
                  const color = getStopColor(stepType);
                  const arrivalStr = formatTime(node.arrival_time);
                  const isLast = index === selectedTour.nodes.length - 1;

                  return (
                    <View key={node.uid || index} style={styles.stepItem}>
                      <View style={styles.stepLeft}>
                        <View style={[styles.stepIconContainer, { backgroundColor: color + '15', borderColor: color }]}>
                          <Feather name={icon as any} size={16} color={color} />
                        </View>
                        {!isLast && <View style={styles.stepTimelineLine} />}
                      </View>

                      <View style={styles.stepRight}>
                        <Text style={styles.stepAddress} numberOfLines={2}>
                          {node.address || 'Point de livraison'}
                        </Text>
                        <View style={styles.stepDetails}>
                          <View style={styles.stepBadge}>
                            <Feather name="clock" size={10} color="#6b7280" />
                            <Text style={styles.stepBadgeText}>{arrivalStr}</Text>
                          </View>
                          {stepType === 'DELIVERY' && (
                            <View style={[styles.stepBadge, { backgroundColor: '#eff6ff' }]}>
                              <Feather name="package" size={10} color="#3b82f6" />
                              <Text style={[styles.stepBadgeText, { color: '#3b82f6' }]}>{node.pallets || 0} pal</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.startButton} 
                  onPress={() => handleSelectTour(selectedTour)}
                >
                  <Feather name="navigation" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.startButtonText}>Démarrer cette tournée</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  activeCard: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    opacity: 0.88,
  },
  historyBadge: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6b7280',
  },
  historyDateText: {
    color: '#9ca3af',
  },
  historyTourName: {
    color: '#374151',
  },
  historyTruckText: {
    color: '#4b5563',
  },
  historyStatsContainer: {
    backgroundColor: '#f3f4f6',
  },
  historyViewDetailsText: {
    color: '#6b7280',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeBadge: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
  },
  tourName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  truckContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  truckText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#e5e7eb',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
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
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '80%',
    paddingTop: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 2,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 99,
  },
  stepsList: {
    flex: 1,
  },
  stepsListContent: {
    padding: 24,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  stepLeft: {
    alignItems: 'center',
    marginRight: 16,
    width: 32,
  },
  stepIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: '#ffffff',
  },
  stepTimelineLine: {
    width: 2,
    backgroundColor: '#e5e7eb',
    position: 'absolute',
    top: 32,
    bottom: -12,
  },
  stepRight: {
    flex: 1,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  stepAddress: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  stepDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4b5563',
  },
  modalFooter: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  startButton: {
    backgroundColor: '#ef4444',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
