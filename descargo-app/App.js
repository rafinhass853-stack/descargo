import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  StatusBar, 
  ActivityIndicator, 
  Alert, 
  Vibration,
  Modal
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

// Componentes
import Conta from './Conta'; 
import Jornada from './Jornada';
import Escala from './Escala';
import MinhasViagens from './MinhasViagens';
import TelaLogin from './TelaLogin';
import StatusAtual from './StatusAtual';
import useMonitorarCargas from './MonitorarCargas'; 
import { useGpseCercas } from './GpseCercas'; // <--- Nosso novo Hook

// Firebase
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
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp
} from 'firebase/firestore';

// Config Firebase
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
  auth = initializeAuth(app, { persistence: getReactNativePersistence(ReactNativeAsyncStorage) });
} catch (e) { auth = getAuth(app); }
const db = getFirestore(app);

// --- Componentes Internos ---

const MapViewStatic = React.memo(({ html, webviewRef }) => {
  if (!html) return (
    <View style={{flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
      <ActivityIndicator size="large" color="#FFD700" />
    </View>
  );
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
      startInLoadingState={false}
    />
  );
}, (prev, next) => prev.html === next.html);

const ConfirmacaoChegadaModal = ({ visible, onConfirm, onCancel }) => (
  <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onCancel}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <MaterialIcons name="check-circle" size={40} color="#2ecc71" />
          <Text style={styles.modalTitle}>CHEGOU AO DESTINO!</Text>
        </View>
        <Text style={styles.modalMessage}>Você entrou na área de destino. Para finalizar a viagem, confirme sua chegada.</Text>
        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={onCancel}>
            <Text style={styles.modalButtonCancelText}>AGUARDAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={onConfirm}>
            <Text style={styles.modalButtonConfirmText}>CONFIRMAR CHEGADA</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const Speedometer = ({ currentSpeed }) => (
  <View style={styles.speedometerContainer}>
    <Text style={styles.speedText}>{currentSpeed}</Text>
    <Text style={styles.speedUnit}>KM/H</Text>
  </View>
);

const ViagemCard = ({ cargaAtiva, chegouAoDestino, confirmacaoPendente, geofenceAtiva }) => {
  if (!cargaAtiva) return null;
  return (
    <View style={[styles.floatingRouteCard, chegouAoDestino && {borderColor: '#2ecc71', borderLeftWidth: 5}]}>
      <View style={styles.routeHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.routeLabel}>{cargaAtiva.tipoViagem === 'VAZIO' ? '⚪ VAZIO' : '🚚 CARREGADO'} • DT {cargaAtiva.dt || '---'}</Text>
          <Text style={styles.routeInfo} numberOfLines={1}>
            {cargaAtiva.destinoCliente || cargaAtiva.clienteEntrega || 'Destino não especificado'}
          </Text>
          {confirmacaoPendente && <Text style={{color: '#FFD700', fontSize: 10, fontWeight: 'bold'}}>⚠️ AGUARDANDO CONFIRMAÇÃO</Text>}
        </View>
        <MaterialIcons name="location-on" size={30} color={chegouAoDestino ? "#2ecc71" : "#444"} />
      </View>
    </View>
  );
};

const NavigationBar = ({ activeTab, setActiveTab, handleLogout }) => (
  <View style={styles.floatingNavContainer}>
    <View style={styles.floatingNav}>
      {[
        { key: 'painel', icon: 'map', label: 'Início', component: Ionicons },
        { key: 'viagens', icon: 'truck-delivery', label: 'Cargas', component: MaterialCommunityIcons },
        { key: 'escala', icon: 'calendar-clock', label: 'Escala', component: MaterialCommunityIcons },
        { key: 'jornada', icon: 'timer', label: 'Jornada', component: Ionicons },
        { key: 'perfil', icon: 'shield-account', label: 'Perfil', component: MaterialCommunityIcons },
      ].map(({ key, icon, label, component: Icon }) => (
        <TouchableOpacity key={key} style={styles.navItem} onPress={() => { Vibration.vibrate(10); setActiveTab(key); }}>
          <Icon name={icon} size={26} color={activeTab === key ? "#FFD700" : "#999"} />
          <Text style={[styles.navText, { color: activeTab === key ? "#FFD700" : "#999" }]}>{label}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
        <Ionicons name="log-out" size={26} color="#ff4d4d" />
        <Text style={[styles.navText, { color: "#ff4d4d" }]}>Sair</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// --- App Principal ---

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('painel');
  const [user, setUser] = useState(null);
  const [location, setLocation] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [cargaAtiva, setCargaAtiva] = useState(null);
  const [viagemIniciada, setViagemIniciada] = useState(false);
  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false);
  
  const webviewRef = useRef(null);

  // Hook Refatorado de GPS e Cercas
  const {
    geofenceAtiva,
    rotaCoords,
    chegouAoDestino,
    confirmacaoPendente,
    setChegouAoDestino,
    setConfirmacaoPendente,
    setRotaCoords
  } = useGpseCercas(db, user, location, cargaAtiva, setCargaAtiva, viagemIniciada);

  // Monitorar Cargas (Firebase)
  useMonitorarCargas({
    db, user, viagemIniciada, cargaAtiva, setCargaAtiva, setViagemIniciada,
    setChegouAoDestino, setConfirmacaoPendente, setShowConfirmacaoModal,
    setStatusOperacional, sincronizarComFirestore: (extra) => sincronizarComFirestore(extra)
  });

  useEffect(() => { onAuthStateChanged(auth, (u) => { setUser(u); setIsLoggedIn(!!u); }); }, []);

  useEffect(() => {
    if (confirmacaoPendente) setShowConfirmacaoModal(true);
  }, [confirmacaoPendente]);

  useEffect(() => { 
    if (isLoggedIn) monitorarLocalizacao(); 
  }, [isLoggedIn]);

  // Atualização suave do marcador no mapa
  useEffect(() => { 
    if (location && webviewRef.current) {
      webviewRef.current.postMessage(JSON.stringify({ 
        type: 'updateLoc', lat: location.latitude, lng: location.longitude, center: false
      }));
    } 
  }, [location?.latitude, location?.longitude]);

  const monitorarLocalizacao = async () => {
  let { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;
  
  await Location.watchPositionAsync({ 
    accuracy: Location.Accuracy.High, 
    timeInterval: 180000, // <--- 3 minutos em milissegundos
    distanceInterval: 10   // <--- Só atualiza se mover 10 metros
  }, (loc) => {
    if (loc.coords) {
      const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
      setLocation(loc.coords); 
      setCurrentSpeed(speedKmh < 0 ? 0 : speedKmh);
      
      // Envia para o mapa via postMessage (Isso não faz o mapa piscar!)
      webviewRef.current?.postMessage(JSON.stringify({ 
        type: 'updateLoc', 
        lat: loc.coords.latitude, 
        lng: loc.coords.longitude, 
        center: false 
      }));

      sincronizarComFirestore({ 
        latitude: loc.coords.latitude, 
        longitude: loc.coords.longitude, 
        velocidade: speedKmh 
      });
    }
  });
};
  const sincronizarComFirestore = async (extra = {}) => {
    if (!auth.currentUser) return;
    try {
      const dados = { 
        motoristaId: auth.currentUser.uid, 
        email: auth.currentUser.email, 
        ultimaAtualizacao: serverTimestamp(),
        latitude: extra.latitude || location?.latitude,
        longitude: extra.longitude || location?.longitude,
        statusOperacional: extra.statusOperacional || statusOperacional,
        velocidade: extra.velocidade !== undefined ? extra.velocidade : currentSpeed,
        cargaAtiva: cargaAtiva?.id || null,
        viagemIniciada
      };
      await setDoc(doc(db, "localizacao_realtime", auth.currentUser.uid), dados, { merge: true });
    } catch (e) { console.error("Erro sincronia:", e); }
  };

  const confirmarChegada = async () => {
    if (!cargaAtiva) return;
    setShowConfirmacaoModal(false);
    try {
      await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), { 
        finalizada: true, confirmacaoPendente: false, status: 'FINALIZADA', dataFinalizacao: serverTimestamp() 
      });
      setCargaAtiva(null);
      setViagemIniciada(false);
      setRotaCoords([]);
      Alert.alert("Sucesso", "Viagem finalizada.");
    } catch (error) { Alert.alert("Erro", "Falha ao finalizar."); }
  };

  const mapHtml = useMemo(() => {
    if (!location) return null;
    const dest = geofenceAtiva?.centro || (rotaCoords.length > 0 ? {lat: rotaCoords[rotaCoords.length-1].latitude, lng: rotaCoords[rotaCoords.length-1].longitude} : null);
    
    return `
      <!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body { margin: 0; background: #000; } #map { height: 100vh; }</style>
      </head><body><div id="map"></div><script>
        var map = L.map('map', { zoomControl: false }).setView([${location.latitude}, ${location.longitude}], 15);
        L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }).addTo(map);
        var marker = L.marker([${location.latitude}, ${location.longitude}], {
          icon: L.divIcon({ html: '<div style="background:#FFD700; width:14px; height:14px; border-radius:50%; border:3px solid #fff;"></div>', className: '', iconSize: [14, 14] })
        }).addTo(map);
        ${dest ? `L.circle([${dest.lat}, ${dest.lng}], { radius: ${geofenceAtiva?.raio || 300}, color: '${chegouAoDestino ? '#2ecc71' : '#FFD700'}', weight: 2, fillOpacity: 0.15 }).addTo(map);` : ''}
        ${rotaCoords.length > 0 ? `L.polyline(${JSON.stringify(rotaCoords.map(c => [c.latitude, c.longitude]))}, {color: '#FFD700', weight: 4}).addTo(map);` : ''}
        window.addEventListener('message', function(e) {
          var d = JSON.parse(e.data);
          if(d.type === 'updateLoc') marker.setLatLng([d.lat, d.lng]);
          if(d.type === 'center') map.flyTo([d.lat, d.lng], 16);
        });
      </script></body></html>
    `;
  }, [location === null, rotaCoords, chegouAoDestino]);

  if (!isLoggedIn) return <TelaLogin onLogin={async (e, p) => signInWithEmailAndPassword(auth, e, p)} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={{flex: 1, paddingTop: activeTab === 'painel' ? 0 : 60}}>
        {activeTab === 'painel' ? (
          <View style={{flex: 1}}>
            <MapViewStatic html={mapHtml} webviewRef={webviewRef} />
            <StatusAtual cargaAtiva={cargaAtiva} />
            <Speedometer currentSpeed={currentSpeed} />
            <ViagemCard cargaAtiva={cargaAtiva} chegouAoDestino={chegouAoDestino} confirmacaoPendente={confirmacaoPendente} />
            <TouchableOpacity style={styles.floatingGps} onPress={() => webviewRef.current?.postMessage(JSON.stringify({ type: 'center', lat: location.latitude, lng: location.longitude }))}>
              <MaterialIcons name="my-location" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        ) : (
          activeTab === 'viagens' ? <MinhasViagens auth={auth} db={db} /> :
          activeTab === 'escala' ? <Escala auth={auth} db={db} /> :
          activeTab === 'jornada' ? <Jornada auth={auth} db={db} /> : <Conta auth={auth} db={db} />
        )}
      </View>
      <ConfirmacaoChegadaModal visible={showConfirmacaoModal} onConfirm={confirmarChegada} onCancel={() => setShowConfirmacaoModal(false)} />
      <NavigationBar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={() => signOut(auth)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  speedometerContainer: { position: 'absolute', top: 50, right: 20, width: 65, height: 65, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 35, borderWidth: 2, borderColor: '#FFD700', justifyContent: 'center', alignItems: 'center', zIndex: 30 },
  speedText: { color: '#FFD700', fontSize: 22, fontWeight: '900' },
  speedUnit: { color: '#FFF', fontSize: 8 },
  floatingRouteCard: { position: 'absolute', bottom: 125, left: 15, right: 15, backgroundColor: 'rgba(15,15,15,0.95)', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#333', zIndex: 5 },
  routeLabel: { color: '#FFD700', fontSize: 9, fontWeight: 'bold' },
  routeInfo: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  routeHeader: { flexDirection: 'row', alignItems: 'center' },
  floatingGps: { position: 'absolute', bottom: 210, right: 20, backgroundColor: 'rgba(0,0,0,0.9)', padding: 12, borderRadius: 50, zIndex: 5 },
  floatingNavContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 20, paddingHorizontal: 10, zIndex: 100 },
  floatingNav: { flexDirection: 'row', backgroundColor: '#151515', paddingVertical: 10, borderRadius: 20, justifyContent: 'space-around' },
  navItem: { alignItems: 'center', flex: 1 },
  navText: { fontSize: 8, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111', borderRadius: 20, padding: 25, width: '85%', borderWidth: 1, borderColor: '#FFD700' },
  modalHeader: { alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: '#2ecc71', fontSize: 18, fontWeight: 'bold' },
  modalMessage: { color: '#FFF', textAlign: 'center', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#333', marginRight: 10 },
  modalButtonConfirm: { backgroundColor: '#2ecc71' },
  modalButtonConfirmText: { color: '#fff', fontWeight: 'bold' },
  modalButtonCancelText: { color: '#fff' }
});