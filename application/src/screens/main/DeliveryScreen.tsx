import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';

export default function DeliveryScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Livraisons</Text>
          <Text style={styles.subtitle}>Gérez vos colis et statuts de livraison</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>En cours</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.packageId}>Colis #8492</Text>
              <View style={styles.badgePending}>
                <Text style={styles.badgeTextPending}>En transit</Text>
              </View>
            </View>
            <Text style={styles.clientName}>Client: Entreprise ABC</Text>
            <Text style={styles.address}>12 Rue de la Paix, 75002 Paris</Text>
            
            <View style={styles.actions}>
              <TouchableOpacity style={styles.buttonPrimary}>
                <Text style={styles.buttonTextPrimary}>Valider Livraison</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>À venir</Text>
          
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.packageId}>Colis #1120</Text>
              <View style={styles.badgeWaiting}>
                <Text style={styles.badgeTextWaiting}>En attente</Text>
              </View>
            </View>
            <Text style={styles.clientName}>Client: Boutique XYZ</Text>
            <Text style={styles.address}>45 Avenue des Champs-Élysées, 75008 Paris</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.packageId}>Colis #5541</Text>
              <View style={styles.badgeWaiting}>
                <Text style={styles.badgeTextWaiting}>En attente</Text>
              </View>
            </View>
            <Text style={styles.clientName}>Client: Particulier</Text>
            <Text style={styles.address}>8 Boulevard Haussmann, 75009 Paris</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    padding: 24,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  badgePending: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextPending: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeWaiting: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextWaiting: {
    color: '#4b5563',
    fontSize: 12,
    fontWeight: '600',
  },
  clientName: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  buttonPrimary: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonTextPrimary: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
});
