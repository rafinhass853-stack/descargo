import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  Alert, 
  ScrollView,
  Dimensions,
  Linking,
  Vibration 
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { FontAwesome, MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

// Componentes do Sistema
import Conta from './Conta'; 
import Jornada from './Jornada';
import Escala from './Escala';
import MinhasViagens from './MinhasViagens';

// Firebase Imports
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  initializeAuth, 
  getReactNativePersistence 
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'; 
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp,
  and 
} from 'firebase/firestore';

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  if (data) {
    const { locations } = data;
  }
});

const firebaseConfig = {
  apiKey: "AIzaSyDT5OptLHwnCVPuevN5Ie8SFWxm4mRPAl4",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:android:fd1b81db2c11ea523bca8d"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (e) {
  auth = getAuth(app);
}

const db = getFirestore(app);

const MapViewStatic = memo(({ html, webviewRef }) => {
  if (!html) return <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center'}}><ActivityIndicator color="#FFD700" /></View>;
  return (
    <WebView
      ref={webviewRef}
      originWhitelist={['*']}
      source={{ html }}
      style={{ flex: 1, backgroundColor: '#000' }}
      onMessage={() => {}}
      androidLayerType="hardware"
      domStorageEnabled={true}
      javaScriptEnabled={true}
    />
  );
}, (prev, next) => prev.html === next.html);

const getDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

export default function App() {
  const webviewRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('painel'); 
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [hasCentered, setHasCentered] = useState(false); // Flag para evitar reset de zoom
  const [currentSpeed, setCurrentSpeed] = useState(0); 
  const [cargaAtiva, setCargaAtiva] = useState(null);
  const [todasAsCercas, setTodasAsCercas] = useState([]);
  const [geofenceAtiva, setGeofenceAtiva] = useState(null); 
  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [statusJornada, setStatusJornada] = useState('fora da jornada');
  const [rotaCoords, setRotaCoords] = useState([]);
  const [destinoCoord, setDestinoCoord] = useState(null);
  const [chegouAoDestino, setChegouAoDestino] = useState(false);

  const openLink = (url) => Linking.openURL(url);

  // GERAÇÃO DO HTML - Só gera se tiver localização
  const mapHtml = useMemo(() => {
    if (!location) return null;

    const lat = location.latitude;
    const lng = location.longitude;

    const cercasJs = todasAsCercas.map(item => {
      if (!item.geofence) return '';
      const isDestino = item.cliente?.toUpperCase().trim() === (cargaAtiva?.destinoCliente || cargaAtiva?.cliente_destino)?.toUpperCase().trim();
      const color = isDestino ? "#FFD700" : "#FFFFFF";
      if (item.geofence.tipo === 'circle' && item.geofence.centro) {
        return `L.circle([${item.geofence.centro.lat}, ${item.geofence.centro.lng}], {radius: ${item.geofence.raio}, color: '${color}', weight: 2, fillOpacity: 0.3}).addTo(map);`;
      }
      if (item.geofence.coordenadas) {
        const coords = item.geofence.coordenadas.map(c => `[${c.lat}, ${c.lng}]`).join(',');
        return `L.polygon([${coords}], {color: '${color}', weight: 2, fillOpacity: 0.3}).addTo(map);`;
      }
      return '';
    }).join('\n');

    const rotaJs = rotaCoords.length > 0 
      ? `L.polyline(${JSON.stringify(rotaCoords.map(c => [c.latitude, c.longitude]))}, {color: '#FFD700', weight: 6, opacity: 0.8}).addTo(map);`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style> body { margin: 0; padding: 0; background: #000; overflow: hidden; } #map { height: 100vh; width: 100vw; } </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${lat}, ${lng}], 16);
          L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: 'Google Maps'
          }).addTo(map);
          var motoristaIcon = L.divIcon({
            html: '<div style="background-color:#FFD700; width:18px; height:18px; border-radius:50%; border:3px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
            className: 'custom-div-icon', iconSize: [18, 18], iconAnchor: [9, 9]
          });
          var marker = L.marker([${lat}, ${lng}], {icon: motoristaIcon}).addTo(map);
          ${cercasJs}
          ${rotaJs}
          window.addEventListener('message', function(e) {
            try {
              var data = JSON.parse(e.data);
              if(data.type === 'updateLoc') { marker.setLatLng([data.lat, data.lng]); }
              if(data.type === 'center') { map.flyTo([data.lat, data.lng], 16); }
            } catch(err) {}
          });
        </script>
      </body>
      </html>
    `;
  }, [todasAsCercas.length, rotaCoords.length, !!location, (cargaAtiva?.id || null)]);

  // Sincroniza posição com o WebView
  useEffect(() => {
    if (location && webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({ 
        type: 'updateLoc', 
        lat: location.latitude, 
        lng: location.longitude 
      }));
      
      // Se for a primeira vez que pegamos sinal real, força o mapa a ir para lá
      if (!hasCentered) {
        webviewRef.current.postMessage(JSON.stringify({ 
          type: 'center', 
          lat: location.latitude, 
          lng: location.longitude 
        }));
        setHasCentered(true);
      }
    }
  }, [location?.latitude, location?.longitude]);

  useEffect(() => {
    if (isLoggedIn) {
      const q = query(collection(db, "cadastro_clientes_pontos"));
      const unsubscribeCercas = onSnapshot(q, (snap) => {
        const cercasData = [];
        snap.forEach((doc) => { cercasData.push({ id: doc.id, ...doc.data() }); });
        setTodasAsCercas(cercasData);
      });
      return () => unsubscribeCercas();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (cargaAtiva && todasAsCercas.length > 0) {
      const nomeClienteRaw = cargaAtiva?.destinoCliente || cargaAtiva?.cliente_destino;
      if (nomeClienteRaw) {
        const nomeLimpo = nomeClienteRaw.toString().toUpperCase().trim();
        const encontrada = todasAsCercas.find(c => c.cliente?.toUpperCase().trim() === nomeLimpo);
        if (encontrada && encontrada.geofence) { setGeofenceAtiva(encontrada.geofence); }
      }
    } else { setGeofenceAtiva(null); }
  }, [cargaAtiva, todasAsCercas]);

  const buscarRotaOSRM = async (origem, latDest, lngDest) => {
    if (!origem || !latDest || !lngDest) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origem.longitude},${origem.latitude};${lngDest},${latDest}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        setRotaCoords(data.routes[0].geometry.coordinates.map(c => ({ latitude: c[1], longitude: c[0] })));
      }
    } catch (error) { console.error("Erro OSRM:", error); }
  };

  useEffect(() => {
    const atualizarDestinoERota = async () => {
      if (location && (geofenceAtiva || cargaAtiva)) {
        if (cargaAtiva?.trajeto && Array.isArray(cargaAtiva.trajeto) && cargaAtiva.trajeto.length > 0) {
          setRotaCoords(cargaAtiva.trajeto);
          const ultimo = cargaAtiva.trajeto[cargaAtiva.trajeto.length - 1];
          setDestinoCoord({ latitude: ultimo.latitude, longitude: ultimo.longitude });
        } 
        else if (geofenceAtiva?.centro?.lat) {
          const dLat = geofenceAtiva.centro.lat; const dLng = geofenceAtiva.centro.lng;
          setDestinoCoord({ latitude: dLat, longitude: dLng });
          buscarRotaOSRM(location, dLat, dLng);
        } else if (cargaAtiva) {
          const cidade = cargaAtiva.destinoCidade || cargaAtiva.cidade_destino;
          if (cidade) {
            const geo = await Location.geocodeAsync(cidade);
            if (geo.length > 0) {
              setDestinoCoord({ latitude: geo[0].latitude, longitude: geo[0].longitude });
              buscarRotaOSRM(location, geo[0].latitude, geo[0].longitude);
            }
          }
        }
      } else { setRotaCoords([]); setDestinoCoord(null); }
    };
    atualizarDestinoERota();
  }, [location?.latitude, geofenceAtiva, cargaAtiva]);

  useEffect(() => {
    if (location && (geofenceAtiva || destinoCoord)) {
      let estaDentro = false;
      const latMot = location.latitude; const lngMot = location.longitude;
      if (geofenceAtiva?.tipo === 'circle' && geofenceAtiva.centro) {
        const dist = getDistance(latMot, lngMot, geofenceAtiva.centro.lat, geofenceAtiva.centro.lng);
        estaDentro = dist <= (parseFloat(geofenceAtiva.raio) + 30); 
      } else if (destinoCoord) {
        const dist = getDistance(latMot, lngMot, destinoCoord.latitude, destinoCoord.longitude);
        estaDentro = dist <= 300;
      }
      if (estaDentro && !chegouAoDestino) { Vibration.vibrate([500, 500, 500]); setChegouAoDestino(true); }
      else if (!estaDentro && chegouAoDestino) { setChegouAoDestino(false); }
    }
  }, [location, geofenceAtiva, destinoCoord]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      if (u) { setUser(u); setIsLoggedIn(true); } 
      else { setUser(null); setIsLoggedIn(false); }
    });
    return () => unsubscribeAuth();
  }, []);

  const sincronizarComFirestore = async (extra = {}) => {
    const cur = auth.currentUser; 
    if (!cur) return;
    try {
      const dados = { motoristaId: cur.uid, email: cur.email, ultimaAtualizacao: serverTimestamp() };
      if (extra.latitude || location?.latitude) {
        dados.latitude = extra.latitude || location.latitude;
        dados.longitude = extra.longitude || location.longitude;
      }
      dados.statusOperacional = extra.statusOperacional || statusOperacional || "Sem programação";
      dados.statusJornada = extra.statusJornada || statusJornada || "fora da jornada";
      dados.velocidade = currentSpeed; 
      await setDoc(doc(db, "localizacao_realtime", cur.uid), dados, { merge: true });
    } catch (e) { console.error("Erro sincronia:", e); }
  };

  useEffect(() => {
    if (isLoggedIn && user) {
      const q = query(collection(db, "ordens_servico"), and(where("motoristaId", "==", user.uid), where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO"])));
      const unsubscribeCargas = onSnapshot(q, (snap) => {
        snap.docChanges().forEach((change) => {
          const d = change.doc.data(); const id = change.doc.id;
          if ((change.type === "added" || change.type === "modified") && (d.status === "AGUARDANDO PROGRAMAÇÃO" || d.status === "PENDENTE ACEITE")) {
            Vibration.vibrate([0, 500, 500, 500], true);
            Alert.alert(d.tipoViagem === 'VAZIO' ? "⚪ LANÇAMENTO DE VAZIO" : "🔔 NOVA CARGA", `📍 DESTINO: ${d.destinoCliente || d.cliente_destino}`, [
              { text: "RECUSAR", style: "cancel", onPress: async () => { Vibration.cancel(); await updateDoc(doc(db, "ordens_servico", id), { status: "RECUSADO" }); }},
              { text: "ACEITAR", onPress: () => { Vibration.cancel(); confirmarCarga(id, d); }}
            ]);
          }
          if (d.status === "ACEITO") { setCargaAtiva({ id, ...d }); }
        });
        if (snap.empty) setCargaAtiva(null);
      });
      return () => unsubscribeCargas();
    }
  }, [isLoggedIn, user]);

  const confirmarCarga = async (id, d) => {
    const op = d.tipoViagem === 'VAZIO' ? 'Viagem vazio' : 'Viagem carregado';
    await updateDoc(doc(db, "ordens_servico", id), { status: "ACEITO", aceitoEm: serverTimestamp() });
    setStatusOperacional(op); setCargaAtiva({ id, ...d }); 
    sincronizarComFirestore({ statusOperacional: op });
  };

  const finalizarViagem = async () => {
    if (!cargaAtiva) return;
    Alert.alert("Finalizar", "Confirma a chegada?", [
      { text: "Não", style: "cancel" },
      { text: "Sim", onPress: async () => {
          await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), { status: "CONCLUÍDO", concluidoEm: serverTimestamp() });
          setCargaAtiva(null); setRotaCoords([]); setDestinoCoord(null); 
          const statusReset = "Sem programação"; setStatusOperacional(statusReset);
          sincronizarComFirestore({ statusOperacional: statusReset });
      }}
    ]);
  };

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Atenção', 'Preencha tudo.');
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      setUser(res.user); setIsLoggedIn(true);
    } catch (e) { Alert.alert('Erro', 'Verifique os dados.'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    Alert.alert("Sair", "Encerrar sessão?", [
      { text: "Não" }, { text: "Sim", onPress: async () => { await signOut(auth); setIsLoggedIn(false); }}
    ]);
  };

  useEffect(() => {
    let sub;
    if (isLoggedIn) {
      (async () => {
        let { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') return;

        if (Platform.OS === 'android') {
            await Location.requestBackgroundPermissionsAsync();
        }

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 5000,
            distanceInterval: 10,
            foregroundService: {
                notificationTitle: "Descargo Proteção",
                notificationBody: "Monitoramento de rota ativo.",
                notificationColor: "#FFD700"
            }
        });

        sub = await Location.watchPositionAsync({ 
            accuracy: Location.Accuracy.High, 
            timeInterval: 2000, 
            distanceInterval: 1 
        }, (loc) => {
          if (loc.coords) { 
            setLocation(loc.coords); 
            const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
            setCurrentSpeed(speedKmh < 0 ? 0 : speedKmh);
            sincronizarComFirestore({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }); 
          }
        });
      })();
    }
    return () => { if (sub) sub.remove(); };
  }, [isLoggedIn]);

  const renderContent = () => {
    switch (activeTab) {
      case 'painel':
        return (
          <View style={{flex: 1}}>
            <MapViewStatic html={mapHtml} webviewRef={webviewRef} />
            
            <View style={styles.speedometerContainer}>
              <Text style={styles.speedText}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>KM/H</Text>
            </View>

            <View style={styles.topFloatingHeader}>
              <TouchableOpacity style={styles.floatingStatus} onPress={() => {
                Alert.alert("Status", "Alterar:", [
                  { text: "Sem programação", onPress: () => { setStatusOperacional("Sem programação"); sincronizarComFirestore({statusOperacional: "Sem programação"}); }},
                  { text: "Manutenção", onPress: () => { setStatusOperacional("Manutenção"); sincronizarComFirestore({statusOperacional: "Manutenção"}); }},
                  { text: "Cancelar", style: "cancel" }
                ]);
              }}>
                <View style={[styles.dot, {backgroundColor: '#FFD700'}]} />
                <Text style={styles.floatingStatusText}>{statusOperacional.toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.floatingStatus, {borderColor: statusJornada === 'dentro da jornada' ? '#2ecc71' : '#444'}]} onPress={() => {
                const n = statusJornada === 'dentro da jornada' ? 'fora da jornada' : 'dentro da jornada';
                setStatusJornada(n); sincronizarComFirestore({ statusJornada: n });
              }}>
                <View style={[styles.dot, {backgroundColor: statusJornada === 'dentro da jornada' ? '#2ecc71' : '#444'}]} />
                <Text style={styles.floatingStatusText}>{statusJornada === 'dentro da jornada' ? 'ONLINE' : 'OFFLINE'}</Text>
              </TouchableOpacity>
            </View>
            {cargaAtiva && (
              <View style={[styles.floatingRouteCard, chegouAoDestino && {borderColor: '#2ecc71', borderLeftWidth: 5}]}>
                <View style={styles.routeHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeLabel}>
                        {cargaAtiva.trajeto?.length > 0 ? '🛣️ ROTA PLANEJADA' : '⚠️ VIAGEM SEM ROTA'} • DT {cargaAtiva.dt || '---'}
                    </Text>
                    <Text style={styles.routeInfo} numberOfLines={1}>{cargaAtiva.destinoCliente || cargaAtiva.cliente_destino}</Text>
                  </View>
                  <TouchableOpacity onPress={finalizarViagem}>
                    <Ionicons name="checkmark-done-circle" size={45} color={chegouAoDestino ? "#2ecc71" : "#333"} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <TouchableOpacity style={styles.floatingGps} onPress={() => {
                if (webviewRef.current && location) { 
                  webviewRef.current.postMessage(JSON.stringify({ type: 'center', lat: location.latitude, lng: location.longitude })); 
                }
            }}>
              <MaterialIcons name="my-location" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        );
      case 'viagens': return <MinhasViagens auth={auth} db={db} />;
      case 'escala': return <Escala auth={auth} db={db} />; 
      case 'jornada': return <Jornada auth={auth} db={db} />;
      case 'perfil': return <Conta auth={auth} db={db} />;
      default: return null;
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={styles.logoText}>DESCARGO</Text>
              <View style={styles.underline} />
              <Text style={styles.subtitle}>PAINEL DO MOTORISTA</Text>
            </View>
            <View style={styles.form}>
              <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor="#666" value={email} onChangeText={setEmail} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Senha" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />
              <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.socialContainer}>
              <Text style={styles.socialTitle}>SUPORTE E REDES SOCIAIS</Text>
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialIcon} onPress={() => openLink('https://wa.me/5519996969894')}>
                  <FontAwesome name="whatsapp" size={24} color="#25D366" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.socialIcon} onPress={() => openLink('https://instagram.com/rafasousa_oficial')}>
                  <FontAwesome name="instagram" size={24} color="#E1306C" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.socialIcon} onPress={() => openLink('https://www.linkedin.com/in/rafael-araujo-64758a1a5/')}>
                  <FontAwesome name="linkedin" size={24} color="#0077B5" />
                </TouchableOpacity>
              </View>
              <Text style={styles.signature}>Desenvolvido por Rafael Araujo</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{flex: 1, paddingTop: activeTab === 'painel' ? 0 : 60}}>
        {renderContent()}
      </View>
      <View style={styles.floatingNavContainer}>
        <View style={styles.floatingNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('painel')}>
            <Ionicons name="map" size={24} color={activeTab === 'painel' ? "#FFD700" : "#666"} />
            {activeTab === 'painel' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('viagens')}>
            <MaterialCommunityIcons name="truck-delivery" size={24} color={activeTab === 'viagens' ? "#FFD700" : "#666"} />
            {activeTab === 'viagens' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('escala')}>
            <MaterialCommunityIcons name="calendar-clock" size={24} color={activeTab === 'escala' ? "#FFD700" : "#666"} />
            {activeTab === 'escala' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('jornada')}>
            <Ionicons name="timer" size={24} color={activeTab === 'jornada' ? "#FFD700" : "#666"} />
            {activeTab === 'jornada' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('perfil')}>
            <MaterialCommunityIcons name="shield-account" size={24} color={activeTab === 'perfil' ? "#FFD700" : "#666"} />
            {activeTab === 'perfil' && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
            <Ionicons name="log-out" size={24} color="#ff4d4d" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loginContainer: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 30, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logoText: { fontSize: 52, fontWeight: '900', color: '#FFD700', letterSpacing: -2 },
  underline: { height: 4, width: 70, backgroundColor: '#D97706', marginTop: -5 },
  subtitle: { color: '#888', fontSize: 12, fontWeight: 'bold', marginTop: 25, letterSpacing: 2 },
  form: { width: '100%', maxWidth: 400 },
  input: { backgroundColor: '#111', color: '#FFF', padding: 18, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#222', fontSize: 16 },
  button: { backgroundColor: '#FFD700', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  
  socialContainer: { marginTop: 40, alignItems: 'center' },
  socialTitle: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 15 },
  socialRow: { flexDirection: 'row', gap: 25, marginBottom: 20 },
  socialIcon: { padding: 10, backgroundColor: '#111', borderRadius: 50, borderWidth: 1, borderColor: '#222' },
  signature: { color: '#333', fontSize: 10, fontWeight: 'bold' },

  topFloatingHeader: { position: 'absolute', top: 50, left: 20, right: 100, flexDirection: 'row', gap: 10 },
  floatingStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.85)', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 30, borderWidth: 1, borderColor: '#222' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  floatingStatusText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  
  speedometerContainer: { position: 'absolute', top: 50, right: 20, width: 70, height: 70, backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 35, borderWidth: 2, borderColor: '#FFD700', justifyContent: 'center', alignItems: 'center', elevation: 10 },
  speedText: { color: '#FFD700', fontSize: 24, fontWeight: '900' },
  speedUnit: { color: '#FFF', fontSize: 8, fontWeight: 'bold', marginTop: -2 },

  floatingRouteCard: { position: 'absolute', bottom: 120, left: 20, right: 20, backgroundColor: 'rgba(15,15,15,0.95)', borderRadius: 20, padding: 15, borderBottomWidth: 1, borderBottomColor: '#FFD70033', elevation: 5 },
  routeLabel: { color: '#FFD700', fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  routeInfo: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  routeHeader: { flexDirection: 'row', alignItems: 'center' },
  floatingGps: { position: 'absolute', bottom: 200, right: 20, backgroundColor: 'rgba(0,0,0,0.9)', padding: 12, borderRadius: 50, borderWidth: 1, borderColor: '#222' },
  floatingNavContainer: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' },
  floatingNav: { flexDirection: 'row', backgroundColor: 'rgba(15,15,15,0.98)', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 40, borderWidth: 1, borderColor: '#222', gap: 15, elevation: 10 },
  navItem: { alignItems: 'center', justifyContent: 'center', width: 42 },
  activeIndicator: { position: 'absolute', bottom: -8, width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFD700' }
});