import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Dimensions, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { useActiveTour } from '../../utils/ActiveTourContext';

export default function JourneyScreen({ navigation }: any) {
  const webViewRef = useRef<WebView>(null);
  const { activeTour } = useActiveTour();
  
  // Modals state
  const [isReportModalVisible, setReportModalVisible] = useState(false);
  const [isChatModalVisible, setChatModalVisible] = useState(false);
  const [isDeliveriesModalVisible, setDeliveriesModalVisible] = useState(false);
  const [isValidationModalVisible, setValidationModalVisible] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [rotationMode, setRotationMode] = useState<'NORTH_UP' | 'HEADING_UP'>('NORTH_UP');
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const signatureRef = useRef<any>(null);
  
  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  // Demo Wake Word state
  const [isDemoModeActive, setIsDemoModeActive] = useState(false);
  const [demoState, setDemoState] = useState<'idle' | 'listening_for_wake' | 'wake_word_detected'>('idle');
  const demoLoopRef = useRef<boolean>(false);
  const isLoopRunningRef = useRef<boolean>(false);

  // Deliveries state
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const [resolvedNodes, setResolvedNodes] = useState<any[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  const geocodeAddress = async (address: string): Promise<[number, number] | null> => {
    if (!address || address.trim() === '' || address.includes('Pause') || address.includes('Retour')) return null;
    try {
      const query = encodeURIComponent(address.trim());
      const url = `https://data.geopf.fr/geocodage/search?q=${query}&limit=1`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        return [lat, lng];
      }
    } catch (e) {
      console.error("Geocoding failed on mobile:", e);
    }
    return null;
  };

  useEffect(() => {
    if (!activeTour || !activeTour.nodes) {
      setResolvedNodes([]);
      return;
    }

    const resolveAllNodes = async () => {
      let depotCoords: [number, number] | null = null;
      
      const geocoded = await Promise.all(
        activeTour.nodes.map(async (node: any) => {
          if (typeof node.lat === 'number' && typeof node.lng === 'number' && node.lat !== null && node.lng !== null) {
            if (node.step_type === 'DEPOT_START' || node.step_type === 'DEPOT_END') {
              depotCoords = [node.lat, node.lng];
            }
            return node;
          }

          if (node.address && !node.address.includes('Pause') && !node.address.includes('Retour Dépôt')) {
            const coords = await geocodeAddress(node.address);
            if (coords) {
              if (node.step_type === 'DEPOT_START' || node.step_type === 'DEPOT_END') {
                depotCoords = coords;
              }
              return {
                ...node,
                lat: coords[0],
                lng: coords[1]
              };
            }
          }
          return node;
        })
      );

      const finalNodes = geocoded.map((node: any) => {
        if (node.step_type === 'RELOAD' || node.step_type === 'DEPOT_START' || node.step_type === 'DEPOT_END') {
          if ((typeof node.lat !== 'number' || node.lat === null) && depotCoords) {
            return {
              ...node,
              lat: depotCoords[0],
              lng: depotCoords[1]
            };
          }
        }
        return node;
      });

      setResolvedNodes(finalNodes);
    };

    resolveAllNodes();
  }, [activeTour]);

  useEffect(() => {
    if (resolvedNodes && resolvedNodes.length > 0) {
      const formatTime = (minutes: number) => {
        if (typeof minutes !== 'number' || isNaN(minutes)) return '--:--';
        const h = Math.floor(minutes / 60);
        const m = Math.floor(minutes % 60);
        return `${h.toString().padStart(2, '0')}h${m.toString().padStart(2, '0')}`;
      };

      const deliveryNodes = resolvedNodes.filter((n: any) => n.step_type === 'DELIVERY' || !n.step_type);
      const mapped = deliveryNodes.map((node: any, idx: number) => {
        const name = node.address ? node.address.split(',')[0].trim() : 'Client';
        return {
          id: node.id || `stop-${idx}`,
          name: name,
          initial: name.charAt(0).toUpperCase(),
          color: '#ffffff',
          textColor: '#ef4444',
          time: `≈ ${formatTime(node.arrival_time)}`,
          coords: [node.lat, node.lng],
          border: '#ef4444'
        };
      });
      setDeliveries(mapped);
    } else {
      setDeliveries([]);
    }
  }, [resolvedNodes]);

  useEffect(() => {
    if (isMapReady && webViewRef.current && resolvedNodes && resolvedNodes.length > 0) {
      const validNodes = resolvedNodes.filter((n: any) => typeof n.lat === 'number' && typeof n.lng === 'number' && n.lat !== null && n.lng !== null);
      if (validNodes.length > 0) {
        const stopsArray = validNodes.map(n => `[${n.lat}, ${n.lng}]`).join(',');
        webViewRef.current.injectJavaScript(`window.updateStops([${stopsArray}]); true;`);
      }
    }
  }, [isMapReady, resolvedNodes, deliveries]);

  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<{id: string, text: string, sender: 'driver' | 'logistician', time: string}[]>([
    { id: '1', text: 'Bonjour, un problème sur votre tournée ?', sender: 'logistician', time: '10:00' }
  ]);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription;
    let headingSubscription: Location.LocationSubscription;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          setUserLocation(location);
          const lat = location.coords.latitude;
          const lng = location.coords.longitude;
          const speed = location.coords.speed || 0;
          const heading = location.coords.heading;

          let jsCode = `window.updateLocation(${lat}, ${lng}); true;`;
          
          // Use GPS heading if moving > 0.5 m/s
          if (speed > 0.5 && heading !== null && heading >= 0) {
            jsCode += `window.updateHeading(${heading}, true); true;`;
          }

          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(jsCode);
          }
        }
      );

      headingSubscription = await Location.watchHeadingAsync((headingData) => {
        const heading = headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;
        if (heading >= 0) {
          const jsCode = `window.updateHeading(${heading}, false); true;`;
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(jsCode);
          }
        }
      });
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
      if (headingSubscription) headingSubscription.remove();
    };
  }, []);

  const startListening = async () => {
    try {
      setRecognizedText('');
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(recording);
        setIsListening(true);
      } else {
        alert('Permission microphone refusée.');
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'initialisation du micro.");
    }
  };

  const stopListening = async () => {
    try {
      setIsListening(false);
      if (!recording) return;
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        setRecognizedText('Analyse en cours via le serveur...');
        await sendAudioToBackend(uri);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const sendAudioToBackend = async (uri: string) => {
    try {
      // Tunnel public garanti (tourne sur l'hôte Mac actuel)
      const backendUrl = `https://warm-places-accept.loca.lt/transcribe_base64`;

      // Convert audio file to Base64 to bypass all FormData/Boundary bugs
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Ajouter un Timeout de 60 secondes pour laisser le temps au fichier de s'uploader
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(backendUrl, {
        method: 'POST',
        body: JSON.stringify({ audio_base64: base64Audio }),
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true' // Requis par localtunnel
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erreur serveur détaillée:", errorText);
        throw new Error("Erreur serveur");
      }

      const data = await response.json();
      const text = data.text?.toLowerCase() || '';
      setRecognizedText(text);

      if (text.includes('accident')) {
        handleReport('Accident', '💥');
      } else if (text.includes('embouteillage') || text.includes('bouchon')) {
        handleReport('Embouteillage', '🚗');
      } else if (text.includes('danger')) {
        handleReport('Danger', '⚠️');
      } else if (text.includes('route barrée') || text.includes('barré')) {
        handleReport('Route barrée', '🚧');
      } else if (text.includes('voie barrée') || text.includes('bloqué')) {
        handleReport('Voie barrée', '🛑');
      } else if (text.includes('mauvais temps') || text.includes('pluie')) {
        handleReport('Mauvais temps', '🌧️');
      }
    } catch (err) {
      console.error(err);
      setRecognizedText("Erreur réseau ou transcription.");
    }
  };

  const toggleDemoMode = () => {
    if (isDemoModeActive) {
      setIsDemoModeActive(false);
      demoLoopRef.current = false;
      setDemoState('idle');
      setRecognizedText('');
    } else {
      setIsDemoModeActive(true);
      demoLoopRef.current = true;
      setDemoState('listening_for_wake');
      if (!isLoopRunningRef.current) {
        startDemoLoop();
      }
    }
  };

  const startDemoLoop = async () => {
    if (!demoLoopRef.current || isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission refusée');
        demoLoopRef.current = false;
        setIsDemoModeActive(false);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const demoRecording = new Audio.Recording();
      await demoRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await demoRecording.startAsync();

      // Record for 2.5 seconds to make detection much faster
      await new Promise(resolve => setTimeout(resolve, 2500));

      if (!demoLoopRef.current) {
        try { await demoRecording.stopAndUnloadAsync(); } catch(e) {}
        return;
      }

      try { await demoRecording.stopAndUnloadAsync(); } catch(e) {}
      const uri = demoRecording.getURI();

      if (uri) {
        const backendUrl = `https://warm-places-accept.loca.lt/transcribe_base64`;
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const res = await fetch(backendUrl, {
              method: 'POST',
              body: JSON.stringify({ audio_base64: base64Audio }),
              headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
              },
              signal: controller.signal
            });
            const data = await res.json();
            
            if (data.wake_word_detected) {
               setDemoState('wake_word_detected');
               setRecognizedText('Prêt à signaler ! Quel est le problème ?');
            } else if (data.text) {
               const text = data.text.toLowerCase();
               setDemoState(prev => {
                   if (prev === 'wake_word_detected') {
                       if (text.includes("accident")) { handleReport("Accident", "💥"); return 'listening_for_wake'; }
                       else if (text.includes("danger")) { handleReport("Danger", "⚠️"); return 'listening_for_wake'; }
                       else if (text.includes("barré") || text.includes("bloqué")) { handleReport("Route barrée", "🚧"); return 'listening_for_wake'; }
                       else if (text.includes("embouteillage") || text.includes("bouchon")) { handleReport("Embouteillage", "🚗"); return 'listening_for_wake'; }
                   }
                   return prev;
               });
            }
        } catch (fetchErr) {
            console.log('Demo loop fetch err', fetchErr);
        } finally {
            clearTimeout(timeoutId);
        }
      }

    } catch (err) {
      console.error(err);
    } finally {
      isLoopRunningRef.current = false;
      if (demoLoopRef.current) {
        setTimeout(startDemoLoop, 200);
      }
    }
  };

  const leafletHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { padding: 0; margin: 0; overflow: hidden; background-color: #f3f4f6; }
        #map-wrapper { width: 100vw; height: 100vh; position: absolute; overflow: hidden; }
        #map { 
          width: 150vw; 
          height: 150vh; 
          left: -25vw; 
          top: -25vh; 
          position: absolute; 
          transition: transform 0.5s ease-out;
        }
        .leaflet-control-attribution { display: none; }
      </style>
    </head>
    <body>
      <div id="map-wrapper">
        <div id="map"></div>
      </div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          inertia: true,
          inertiaDeceleration: 1500,
          inertiaMaxSpeed: Infinity,
          easeLinearity: 0.1,
          zoomSnap: 0,
          zoomDelta: 0.5,
          wheelDebounceTime: 40,
          tap: true
        }).setView(${(() => {
          if (resolvedNodes && resolvedNodes.length > 0) {
            const firstValidNode = resolvedNodes.find((n: any) => typeof n.lat === 'number' && typeof n.lng === 'number' && n.lat !== null && n.lng !== null);
            if (firstValidNode) {
              return `[${firstValidNode.lat}, ${firstValidNode.lng}]`;
            }
          }
          return `[48.8566, 2.3522]`;
        })()}, 14);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(map);

        var stops = [
          ${(() => {
            if (resolvedNodes && resolvedNodes.length > 0) {
              const validNodes = resolvedNodes.filter((n: any) => typeof n.lat === 'number' && typeof n.lng === 'number' && n.lat !== null && n.lng !== null);
              if (validNodes.length > 0) {
                return validNodes.map(n => `[${n.lat}, ${n.lng}]`).join(',\n          ');
              }
            }
            return '';
          })()}
        ];

        var routePolyline = null;
        var markersGroup = L.layerGroup().addTo(map);

        var customIcon = L.divIcon({
          className: 'custom-icon',
          html: '<div style="background-color:#111827; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;"><div style="background-color:white; width:6px; height:6px; border-radius:50%;"></div></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        function drawRouteAndMarkers(newStops) {
          markersGroup.clearLayers();
          
          if (newStops.length === 0) {
            if (routePolyline) map.removeLayer(routePolyline);
            return;
          }

          newStops.forEach(function(coords) {
            L.marker(coords, { icon: customIcon }).addTo(markersGroup);
          });

          if (routePolyline) {
            map.removeLayer(routePolyline);
          }

          var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + newStops.map(function(s) { return s[1] + ',' + s[0]; }).join(';') + '?overview=full&geometries=geojson';
          
          fetch(osrmUrl)
            .then(function(res) { return res.json(); })
            .then(function(data) {
              if (data.routes && data.routes.length > 0) {
                var coords = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
                routePolyline = L.polyline(coords, {
                  color: '#3b82f6', 
                  weight: 6, 
                  opacity: 0.9,
                  lineJoin: 'round'
                }).addTo(map);
                map.fitBounds(routePolyline.getBounds(), { paddingBottomRight: [0, 300], paddingTopLeft: [50, 50] });
              }
            })
            .catch(function(err) {
              routePolyline = L.polyline(newStops, { color: '#3b82f6', weight: 6, opacity: 0.9 }).addTo(map);
              map.fitBounds(routePolyline.getBounds(), { paddingBottomRight: [0, 300], paddingTopLeft: [50, 50] });
            });
        }

        drawRouteAndMarkers(stops);

        window.updateStops = function(newStops) {
          drawRouteAndMarkers(newStops);
        };

        var currentLocIcon = L.divIcon({
          className: 'current-loc',
          html: '<div id="user-heading" style="width:40px; height:40px; position:relative; display:flex; align-items:center; justify-content:center; transition: transform 0.5s ease-out; filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.3));"><svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 4 L30 30 L18 24 L6 30 Z" fill="#3b82f6" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/><path d="M18 4 L30 30 L18 24 Z" fill="#2563eb" /></svg></div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        
        var userMarker = L.marker(${(() => {
          if (resolvedNodes && resolvedNodes.length > 0) {
            const firstValidNode = resolvedNodes.find((n: any) => typeof n.lat === 'number' && typeof n.lng === 'number' && n.lat !== null && n.lng !== null);
            if (firstValidNode) {
              return `[${firstValidNode.lat}, ${firstValidNode.lng}]`;
            }
          }
          return `[48.8566, 2.3522]`;
        })()}, { icon: currentLocIcon, zIndexOffset: 1000 }).addTo(map);

        window.updateLocation = function(lat, lng) {
          if (userMarker) {
            userMarker.setLatLng([lat, lng]);
            if (currentRotationMode === 'HEADING_UP') {
              map.setView([lat, lng], map.getZoom(), { animate: true, duration: 1 });
            }
          }
        };

        let currentHeading = 0;
        let isMoving = false;
        let movingTimeout = null;
        let currentRotationMode = 'NORTH_UP';

        window.setRotationMode = function(mode) {
          currentRotationMode = mode;
          var mapEl = document.getElementById('map');
          if (mode === 'NORTH_UP') {
            mapEl.style.transform = 'rotate(0deg)';
            map.dragging.enable();
          } else {
            map.dragging.disable();
            if (userMarker) {
              map.setView(userMarker.getLatLng(), map.getZoom(), { animate: false });
            }
            mapEl.style.transform = 'rotate(' + (-currentHeading) + 'deg)';
          }
        };

        window.updateHeading = function(heading, isGps) {
          if (heading === null || heading === undefined) return;
          if (!isGps && isMoving) return; 
          currentHeading = heading;
          var userHeadingEl = document.getElementById('user-heading');
          if (userHeadingEl) {
            userHeadingEl.style.transform = 'rotate(' + heading + 'deg)';
          }
          if (currentRotationMode === 'HEADING_UP') {
            var mapEl = document.getElementById('map');
            mapEl.style.transform = 'rotate(' + (-heading) + 'deg)';
            if (userMarker) {
              map.setView(userMarker.getLatLng(), map.getZoom(), { animate: true, duration: 0.5 });
            }
          }
        };

        window.recenterMap = function(lat, lng) {
          if (lat && lng) {
            map.flyTo([lat, lng], 17, { animate: true, duration: 1.5 });
          }
        };

        window.addIncidentMarker = function(type, emoji, lat, lng) {
          if (!lat || !lng) {
            var center = map.getCenter();
            lat = center.lat + (Math.random() * 0.01 - 0.005);
            lng = center.lng + (Math.random() * 0.01 - 0.005);
          }

          var incidentIcon = L.divIcon({
            className: 'incident-icon',
            html: '<div style="background-color:#ef4444; width:36px; height:36px; border-radius:18px; display:flex; align-items:center; justify-content:center; color:white; font-size:18px; border:2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">' + emoji + '</div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });

          L.marker([lat, lng], { icon: incidentIcon }).addTo(map).bindPopup("<b>" + type + "</b>").openPopup();
        };

        window.onload = function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: "MAP_READY" }));
          }
        };
      </script>
    </body>
    </html>
  `;

  const handleReport = (type: string, emoji: string) => {
    if (type === 'Contacter logisticien') {
      setReportModalVisible(false);
      setTimeout(() => {
        setChatModalVisible(true);
      }, 400); 
      return;
    }

    let lat = null;
    let lng = null;
    if (userLocation) {
      lat = userLocation.coords.latitude;
      lng = userLocation.coords.longitude;
    }

    const jsCode = `window.addIncidentMarker('${type}', '${emoji}', ${lat}, ${lng}); true;`;
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(jsCode);
    }
    setReportModalVisible(false);
  };

  const sendMessage = () => {
    if (chatMessage.trim().length === 0) return;
    
    const newMessage = {
      id: Date.now().toString(),
      text: chatMessage,
      sender: 'driver' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([...messages, newMessage]);
    setChatMessage('');
  };

  if (!activeTour) {
    return (
      <SafeAreaView style={styles.placeholderSafeArea}>
        <View style={styles.placeholderContainer}>
          <View style={styles.placeholderIconContainer}>
            <Feather name="navigation" size={64} color="#ef4444" />
          </View>
          <Text style={styles.placeholderTitle}>Aucune tournée active</Text>
          <Text style={styles.placeholderText}>
            Pour commencer vos livraisons, veuillez sélectionner et démarrer une tournée depuis l'onglet « Mes Tournées ».
          </Text>
          <TouchableOpacity 
            style={styles.placeholderButton}
            onPress={() => navigation.navigate('Mes Tournées')}
          >
            <Feather name="list" size={18} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.placeholderButtonText}>Voir mes tournées</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.containerFullScreen}>
      <View style={styles.mapContainer}>
        <WebView 
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.map}
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'MAP_READY') {
                setIsMapReady(true);
              }
            } catch (e) {
              console.error("WebView message parse error:", e);
            }
          }}
        />
      </View>

      <SafeAreaView style={styles.safeAreaOverlay} pointerEvents="box-none">
        <TouchableOpacity 
          style={[styles.demoModeBtn, isDemoModeActive && styles.demoModeBtnActive]}
          onPress={toggleDemoMode}
          activeOpacity={0.8}
        >
        <Feather name="mic" size={16} color={isDemoModeActive ? '#ef4444' : '#64748b'} style={{marginRight: 6}} />
        <Text style={[styles.demoModeText, isDemoModeActive && styles.demoModeTextActive]}>
          {demoState === 'wake_word_detected' ? '🪄 À votre écoute...' : (isDemoModeActive ? '🪄 Dites "Signaler incident"' : '🪄 Mode Présentation')}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomOverlay}>
        
        <View style={styles.recenterContainer}>
          <TouchableOpacity 
            style={[styles.recenterBtn, { marginBottom: 12 }]}
            activeOpacity={0.8}
            onPress={() => {
              const newMode = rotationMode === 'NORTH_UP' ? 'HEADING_UP' : 'NORTH_UP';
              setRotationMode(newMode);
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(`window.setRotationMode('${newMode}'); true;`);
              }
            }}
          >
            <Feather name={rotationMode === 'NORTH_UP' ? 'compass' : 'navigation-2'} size={24} color={rotationMode === 'HEADING_UP' ? '#ef4444' : '#0f172a'} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.recenterBtn, { marginBottom: 12 }]}
            activeOpacity={0.8}
            onPress={() => {
              if (userLocation && webViewRef.current) {
                webViewRef.current.injectJavaScript(`window.recenterMap(${userLocation.coords.latitude}, ${userLocation.coords.longitude}); true;`);
                if (rotationMode === 'HEADING_UP') {
                  webViewRef.current.injectJavaScript(`window.setRotationMode('HEADING_UP'); true;`);
                }
              }
            }}
          >
            <Feather name="crosshair" size={24} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.recenterBtn, { marginBottom: 12 }]}
            activeOpacity={0.8}
            onPress={() => {
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript('map.zoomIn(); true;');
              }
            }}
          >
            <Feather name="plus" size={24} color="#0f172a" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.recenterBtn}
            activeOpacity={0.8}
            onPress={() => {
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript('map.zoomOut(); true;');
              }
            }}
          >
            <Feather name="minus" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>

        {deliveries.length > 0 && (
          <View style={styles.currentDestCard}>
            <View style={styles.destLeft}>
              <View style={[styles.logoPlaceholder, { backgroundColor: deliveries[0].color, borderWidth: deliveries[0].border ? 2 : 0, borderColor: deliveries[0].border }]}>
                <Text style={[styles.logoText, { color: deliveries[0].textColor }]}>{deliveries[0].initial}</Text>
              </View>
              <Text style={styles.destName} numberOfLines={1} ellipsizeMode="tail">{deliveries[0].name}</Text>
            </View>
            <View style={styles.destRight}>
              <Feather name="map-pin" size={14} color="#ffffff" style={{marginRight: 6}} />
              <Text style={styles.destMetrics}>1.2 Km • 3 Mins</Text>
            </View>
          </View>
        )}

        <View style={styles.splitCard}>
          
          <View style={styles.nextDeliveriesSection}>
            <Text style={styles.nextTitle}>Prochaines livraisons</Text>
            <View style={styles.divider} />
            
            {deliveries.slice(1, 4).map((d) => (
              <View key={d.id} style={styles.deliveryItem}>
                <View style={[styles.deliveryLogo, { backgroundColor: d.color, borderWidth: d.border ? 1 : 0, borderColor: d.border }]}>
                  <Text style={[styles.logoTextSmall, { color: d.textColor }]}>{d.initial}</Text>
                </View>
                <Text style={styles.deliveryText} numberOfLines={1} ellipsizeMode="tail">{d.name}</Text>
              </View>
            ))}

            {deliveries.length > 4 && (
              <TouchableOpacity style={styles.voirPlusBtn} onPress={() => setDeliveriesModalVisible(true)}>
                <Text style={styles.voirPlusText}>Voir plus</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actionSection}>
            <View style={styles.delayBlock}>
              <Text style={styles.delayNumber}>5<Text style={styles.delayPlus}>+</Text></Text>
              <Text style={styles.delayMin}>min</Text>
            </View>
            <TouchableOpacity 
              style={styles.reportBlock}
              activeOpacity={0.7}
              onPress={() => setReportModalVisible(true)}
            >
              <View style={styles.warningIconContainer}>
                <Feather name="alert-triangle" size={32} color="#000000" />
              </View>
              <Text style={styles.reportText}>Signaler un incident</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>

      {/* Incident Selection Modal - Smooth & Premium */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isReportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlayPremium}>
          <TouchableOpacity 
            style={styles.modalBackdropPremium}
            activeOpacity={1}
            onPress={() => setReportModalVisible(false)}
          />
          <View style={styles.modalContentPremium}>
            <View style={styles.modalHandlePremium} />
            <Text style={styles.modalTitlePremium}>Que se passe-t-il ?</Text>

            <View style={styles.voiceSection}>
              <TouchableOpacity 
                style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
                onPress={isListening ? stopListening : startListening}
              >
                <Feather name="mic" size={32} color={isListening ? "#ffffff" : "#ef4444"} />
              </TouchableOpacity>
              <Text style={styles.voiceText}>
                {isListening ? "Écoute en cours... Parlez maintenant." : "Appuyez sur le micro et parlez"}
              </Text>
              {recognizedText !== '' && (
                <Text style={styles.voiceRecognizedText}>"{recognizedText}"</Text>
              )}
            </View>

            <View style={styles.incidentGridPremium}>
              <TouchableOpacity style={styles.incidentButtonPremium} onPress={() => handleReport('Accident', '💥')}>
                <View style={styles.incidentEmojiCircle}><Text style={styles.incidentEmojiPremium}>💥</Text></View>
                <Text style={styles.incidentButtonTextPremium}>Accident</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.incidentButtonPremium} onPress={() => handleReport('Embouteillage', '🚗')}>
                <View style={styles.incidentEmojiCircle}><Text style={styles.incidentEmojiPremium}>🚗</Text></View>
                <Text style={styles.incidentButtonTextPremium}>Embouteillage</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.incidentButtonPremium} onPress={() => handleReport('Danger', '⚠️')}>
                <View style={styles.incidentEmojiCircle}><Text style={styles.incidentEmojiPremium}>⚠️</Text></View>
                <Text style={styles.incidentButtonTextPremium}>Danger</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.incidentButtonPremium} onPress={() => handleReport('Route barrée', '🚧')}>
                <View style={styles.incidentEmojiCircle}><Text style={styles.incidentEmojiPremium}>🚧</Text></View>
                <Text style={styles.incidentButtonTextPremium}>Route barrée</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.incidentButtonPremium} onPress={() => handleReport('Voie barrée', '🛑')}>
                <View style={styles.incidentEmojiCircle}><Text style={styles.incidentEmojiPremium}>🛑</Text></View>
                <Text style={styles.incidentButtonTextPremium}>Voie barrée</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.incidentButtonPremium} onPress={() => handleReport('Mauvais temps', '🌧️')}>
                <View style={styles.incidentEmojiCircle}><Text style={styles.incidentEmojiPremium}>🌧️</Text></View>
                <Text style={styles.incidentButtonTextPremium}>Mauvais temps</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.incidentButtonPremium, { width: '100%' }]} onPress={() => handleReport('Contacter logisticien', '💬')}>
                <View style={[styles.incidentEmojiCircle, { width: 50, height: 50, borderRadius: 25 }]}><Text style={styles.incidentEmojiPremium}>💬</Text></View>
                <Text style={styles.incidentButtonTextPremium}>Contacter logisticien</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deliveries Modal "Voir plus" - Full Screen Overlay matching screenshot */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isDeliveriesModalVisible}
        onRequestClose={() => setDeliveriesModalVisible(false)}
      >
        <View style={styles.deliveriesOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdropPremium}
            activeOpacity={1}
            onPress={() => setDeliveriesModalVisible(false)}
          />
          <View style={styles.deliveriesCard}>
            
            {deliveries.length > 0 && (
              <View style={styles.currentDestCardLarge}>
                <View style={styles.destLeft}>
                  <View style={[styles.logoPlaceholder, { backgroundColor: deliveries[0].color, borderWidth: deliveries[0].border ? 2 : 0, borderColor: deliveries[0].border }]}>
                    <Text style={[styles.logoText, { color: deliveries[0].textColor }]}>{deliveries[0].initial}</Text>
                  </View>
                  <Text style={styles.destNameLarge}>{deliveries[0].name}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.validateButtonFull}
                  onPress={() => {
                    setDeliveriesModalVisible(false);
                    setValidationModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Feather name="check" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}

            <ScrollView contentContainerStyle={styles.deliveriesList}>
              {deliveries.slice(1).map((d, idx) => (
                <React.Fragment key={d.id}>
                  <View style={styles.deliveryListItem}>
                    <View style={styles.deliveryListLeft}>
                      <View style={[styles.deliveryLogoLarge, { backgroundColor: d.color, borderWidth: d.border ? 2 : 0, borderColor: d.border }]}>
                        <Text style={[styles.logoTextSmall, { color: d.textColor }]}>{d.initial}</Text>
                      </View>
                      <Text style={styles.deliveryListText}>{d.name}</Text>
                    </View>
                    <Text style={styles.deliveryTimeText}>{d.time}</Text>
                  </View>
                  {idx < deliveries.length - 2 && <View style={styles.deliveryListDivider} />}
                </React.Fragment>
              ))}
            </ScrollView>

            <View style={styles.fermerContainer}>
              <TouchableOpacity style={styles.fermerBtn} onPress={() => setDeliveriesModalVisible(false)}>
                <Text style={styles.fermerText}>FERMER</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* Chat Modal with Logistician */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isChatModalVisible}
        onRequestClose={() => setChatModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatOverlay}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setChatModalVisible(false)} style={styles.chatCloseBtn}>
              <Feather name="chevron-down" size={28} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.chatTitle}>Logisticien</Text>
            <View style={{width: 28}} />
          </View>

          <ScrollView style={styles.chatBody} contentContainerStyle={{padding: 16}}>
            {messages.map(msg => (
              <View key={msg.id} style={[styles.chatBubble, msg.sender === 'driver' ? styles.chatBubbleRight : styles.chatBubbleLeft]}>
                <Text style={[styles.chatText, msg.sender === 'driver' ? styles.chatTextRight : styles.chatTextLeft]}>
                  {msg.text}
                </Text>
                <Text style={styles.chatTime}>{msg.time}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.chatFooter}>
            <TextInput
              style={styles.chatInput}
              placeholder="Écrivez un message..."
              value={chatMessage}
              onChangeText={setChatMessage}
              multiline
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={sendMessage}>
              <Feather name="send" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Validation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isValidationModalVisible}
        onRequestClose={() => setValidationModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.deliveriesOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdropPremium}
            activeOpacity={1}
            onPress={() => setValidationModalVisible(false)}
          />
          <View style={styles.deliveriesCard}>
            
            <View style={styles.currentDestCardLarge}>
              <View style={styles.destLeft}>
                <View style={styles.logoPlaceholder}>
                  <Text style={styles.logoText}>C</Text>
                </View>
                <Text style={styles.destNameLarge}>Carrefour Market</Text>
              </View>
            </View>

            <View style={styles.perfBadgeContainer}>
              <View style={styles.perfBadge}>
                <Text style={styles.perfBadgeText}>Performances : </Text>
                <Feather name="map" size={14} color="#ffffff" style={{marginHorizontal: 4}} />
                <Text style={styles.perfBadgeText}>89 Km • 1H47 Mins</Text>
              </View>
            </View>

            <ScrollView 
              contentContainerStyle={styles.validationScroll}
              scrollEnabled={scrollEnabled}
            >
              <Text style={styles.validationSubtitle}>En signant vous attestez que :</Text>
              
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• la livraison a été effectuée dans les délais convenus</Text>
                <Text style={styles.bulletItem}>• les marchandises ont été déchargées</Text>
                <Text style={styles.bulletItem}>• la totalité des marchandises prévues a été livrée</Text>
                <Text style={styles.bulletItem}>• les marchandises sont en bon état après vérification</Text>
                <Text style={styles.bulletItem}>• vous êtes habilité à réceptionner les marchandises</Text>
                <Text style={styles.bulletItem}>• la responsabilité des marchandises vous est transférée</Text>
                <Text style={styles.bulletItem}>• le réceptionnaire avait la possibilité de refuser si non-conforme</Text>
                <Text style={styles.bulletItem}>• votre nom, prénom et signature sont conservés pendant 5 ans</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom</Text>
                <TextInput style={styles.textInputWhite} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Prénom</Text>
                <TextInput style={styles.textInputWhite} />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.signatureHeader}>
                  <Text style={styles.inputLabel}>Signature :</Text>
                  <TouchableOpacity onPress={() => signatureRef.current?.clearSignature()}>
                    <Text style={styles.clearText}>Effacer</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.signatureBox}>
                  <SignatureScreen
                    ref={signatureRef}
                    onBegin={() => setScrollEnabled(false)}
                    onEnd={() => setScrollEnabled(true)}
                    backgroundColor="#ffffff"
                    webStyle={`
                      .m-signature-pad { box-shadow: none; border: none; margin: 0; width: 100%; height: 100%; border-radius: 4px; }
                      .m-signature-pad--body { border: none; bottom: 0px; }
                      .m-signature-pad--footer { display: none; margin: 0px; }
                    `}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.fermerContainer}>
              <TouchableOpacity 
                style={styles.fermerBtn} 
                onPress={() => {
                  setDeliveries(prev => prev.slice(1));
                  setValidationModalVisible(false);
                  if (signatureRef.current) {
                    signatureRef.current.clearSignature();
                  }
                }}
              >
                <Text style={styles.fermerText}>Confirmer</Text>
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  containerFullScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  safeAreaOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  recenterContainer: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  recenterBtn: {
    backgroundColor: '#ffffff',
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  currentDestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  validateButtonFull: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10b981',
    width: 44,
    height: 44,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  destLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ef4444',
  },
  destName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  destRight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0,
  },
  destMetrics: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  demoModeBtn: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  demoModeBtnActive: {
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  demoModeText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  demoModeTextActive: {
    color: '#ef4444',
  },
  splitCard: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  nextDeliveriesSection: {
    flex: 1,
    padding: 16,
  },
  nextTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginBottom: 12,
  },
  deliveryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  deliveryLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoTextSmall: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  deliveryText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  voirPlusBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  voirPlusText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  actionSection: {
    width: 140,
    flexDirection: 'column',
  },
  delayBlock: {
    backgroundColor: '#ef4444',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  delayNumber: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
  },
  delayPlus: {
    fontSize: 24,
  },
  delayMin: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -8,
  },
  reportBlock: {
    backgroundColor: '#ffffff',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  warningIconContainer: {
    marginBottom: 4,
  },
  reportText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Premium Incident Modal
  modalOverlayPremium: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropPremium: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContentPremium: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHandlePremium: {
    width: 48,
    height: 5,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 24,
  },
  modalTitlePremium: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 24,
    textAlign: 'center',
  },
  voiceSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  voiceButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  voiceButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#b91c1c',
  },
  voiceText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  voiceRecognizedText: {
    fontSize: 15,
    color: '#0f172a',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  incidentGridPremium: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  incidentButtonPremium: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 16,
    marginTop: 8,
  },
  incidentButtonWidePremium: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    marginTop: 8,
  },
  incidentEmojiCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  incidentEmojiPremium: {
    fontSize: 28,
  },
  incidentButtonTextPremium: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
  },

  // Deliveries Modal (Voir plus)
  deliveriesOverlay: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  deliveriesCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    flex: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  currentDestCardLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    margin: 16,
  },
  destNameLarge: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  deliveriesList: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  deliveryListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  deliveryListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryLogoLarge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  deliveryListText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '500',
  },
  deliveryTimeText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  deliveryListDivider: {
    height: 1,
    backgroundColor: '#1e293b',
  },
  validateIconOnly: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fermerContainer: {
    padding: 20,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  fermerBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  fermerText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16,
  },

  // Validation UI additions
  perfBadgeContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  perfBadge: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  perfBadgeText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  validationScroll: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  validationSubtitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  bulletList: {
    marginBottom: 24,
  },
  bulletItem: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    backgroundColor: '#94a3b8',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  textInputWhite: {
    backgroundColor: '#ffffff',
    height: 40,
    paddingHorizontal: 12,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  clearText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  signatureBox: {
    backgroundColor: '#ffffff',
    height: 160,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
    overflow: 'hidden',
  },

  // Chat Styles
  chatOverlay: {
    flex: 1,
    backgroundColor: '#f9fafb',
    marginTop: 50,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    elevation: 10,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  chatCloseBtn: {
    padding: 4,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  chatBody: {
    flex: 1,
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  chatBubbleLeft: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chatBubbleRight: {
    alignSelf: 'flex-end',
    backgroundColor: '#ef4444',
    borderBottomRightRadius: 4,
  },
  chatText: {
    fontSize: 15,
    lineHeight: 22,
  },
  chatTextLeft: {
    color: '#1f2937',
  },
  chatTextRight: {
    color: '#ffffff',
  },
  chatTime: {
    fontSize: 10,
    color: '#9ca3af',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  chatFooter: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    marginRight: 12,
  },
  chatSendBtn: {
    backgroundColor: '#ef4444',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderSafeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#f9fafb',
  },
  placeholderIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  placeholderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  placeholderButton: {
    backgroundColor: '#ef4444',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  placeholderButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
