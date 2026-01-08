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
  Modal,
  Linking,
  ScrollView,
  Platform,
  TextInput,
  KeyboardAvoidingView
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

// --- COMPONENTES CUSTOMIZADOS ---
import Conta from './Conta'; 
import Jornada from './Jornada';
import Escala from './Escala';
import MinhasViagens from './MinhasViagens';
import TelaLogin from './TelaLogin';
import StatusAtual from './StatusAtual';
import useMonitorarCargas from './MonitorarCargas'; 
import { useGpseCercas } from './GpseCercas'; 
import BotaoRotaAutomatica from './BotaoRotaAutomatica'; 

// --- FIREBASE ---
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
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc
} from 'firebase/firestore';

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
} catch (e) { 
  auth = getAuth(app); 
}
const db = getFirestore(app);

const LOCATION_TASK_NAME = 'background-location-task';

// --- BACKGROUND TASK ---
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  if (data) {
    const { locations } = data;
    const loc = locations[0];
    if (auth.currentUser && loc) {
      const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
      try {
        await setDoc(doc(db, "localizacao_realtime", auth.currentUser.uid), {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          velocidade: speedKmh < 0 ? 0 : speedKmh,
          ultimaAtualizacao: serverTimestamp(),
          statusJornada: "EM ATIVIDADE (BACKGROUND)"
        }, { merge: true });
      } catch (e) { console.log("Erro background task:", e); }
    }
  }
});

// --- COMPONENTES AUXILIARES INTERNOS ---

const MapViewStatic = React.memo(({ html, webviewRef }) => {
  if (!html) return (
    <View style={styles.loadingContainer}>
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

const ConfirmacaoChegadaModal = ({ visible, onConfirm, onCancel, cargaAtiva }) => (
  <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onCancel}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <MaterialIcons name="check-circle" size={40} color="#2ecc71" />
          <Text style={styles.modalTitle}>CHEGOU AO DESTINO!</Text>
        </View>
        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.modalMessage}>Você entrou na área de destino. Para finalizar a viagem, confirme sua chegada.</Text>
          {cargaAtiva && (
            <View style={styles.detalhesCargaContainer}>
              <Text style={styles.detalhesTitulo}>Detalhes da Viagem:</Text>
              <View style={styles.detalhesLinha}>
                <Text style={styles.detalhesLabel}>Destino:</Text>
                <Text style={styles.detalhesValor}>{cargaAtiva.destinoCliente || cargaAtiva.clienteEntrega}</Text>
              </View>
              <View style={styles.detalhesLinha}>
                <Text style={styles.detalhesLabel}>Código:</Text>
                <Text style={[styles.detalhesValor, {fontFamily: 'monospace', fontWeight: 'bold'}]}>{cargaAtiva.destinoCodigo || '---'}</Text>
              </View>
              <View style={styles.detalhesLinha}>
                <Text style={styles.detalhesLabel}>Cidade:</Text>
                <Text style={styles.detalhesValor}>{cargaAtiva.destinoCidade || ''}</Text>
              </View>
            </View>
          )}
        </ScrollView>
        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={onCancel}>
            <Text style={styles.modalButtonCancelText}>AGUARDAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={onConfirm}>
            <Text style={styles.modalButtonConfirmText}>CONFIRMAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const ViagemCard = ({ cargaAtiva, chegouAoDestino, onOpenGoogleMaps }) => {
  if (!cargaAtiva) return null;
  return (
    <TouchableOpacity 
      style={[styles.floatingRouteCard, chegouAoDestino && {borderColor: '#2ecc71', borderLeftWidth: 5}]}
      activeOpacity={0.9}
      onPress={() => cargaAtiva.destinoLink && onOpenGoogleMaps(cargaAtiva.destinoLink)}
    >
      <View style={styles.routeHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.routeHeaderTop}>
            <Text style={styles.routeLabel}>
              {cargaAtiva.tipoViagem || 'CARREGADO'} • DT {cargaAtiva.dt || '---'}
            </Text>
          </View>
          <Text style={styles.routeInfo} numberOfLines={1}>{cargaAtiva.destinoCliente || cargaAtiva.clienteEntrega || 'Destino'}</Text>
          <div style={styles.cidadesContainer}>
            {cargaAtiva.origemCidade && <Text style={styles.cidadeText}>{cargaAtiva.origemCidade}</Text>}
            <Text style={styles.setaCidades}> → </Text>
            {cargaAtiva.destinoCidade && <Text style={[styles.cidadeText, {color: '#2ecc71'}]}>{cargaAtiva.destinoCidade}</Text>}
          </div>
        </View>
        <MaterialIcons name="location-on" size={30} color={chegouAoDestino ? "#2ecc71" : "#444"} />
      </View>
    </TouchableOpacity>
  );
};

// --- APP PRINCIPAL ---

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('painel');
  const [user, setUser] = useState(null);
  const [motoristaProfile, setMotoristaProfile] = useState(null);
  const [location, setLocation] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [cargaAtiva, setCargaAtiva] = useState(null);
  const [viagemIniciada, setViagemIniciada] = useState(false);
  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false);
  
  const [solicitacaoHodometro, setSolicitacaoHodometro] = useState(false);
  const [hodometroInput, setHodometroInput] = useState('');
  const [enviandoKm, setEnviandoKm] = useState(false);
  
  const webviewRef = useRef(null);
  const lastSolicitacaoStatus = useRef(false);

  // --- SINCRONIZAÇÃO COM FIRESTORE ---
  const sincronizarComFirestore = async (extra = {}) => {
    if (!auth.currentUser || !motoristaProfile) return;
    try {
      const dados = { 
        motoristaId: auth.currentUser.uid, 
        nomeMotorista: motoristaProfile.nome || "Não informado",
        ultimaAtualizacao: serverTimestamp(),
        latitude: extra.latitude || location?.latitude,
        longitude: extra.longitude || location?.longitude,
        statusOperacional: extra.statusOperacional || statusOperacional,
        velocidade: extra.velocidade !== undefined ? extra.velocidade : currentSpeed,
        cidade: extra.cidade || "---",
        uf: extra.uf || "",
        statusJornada: "EM ATIVIDADE", 
        viagemIniciada: viagemIniciada
      };
      await setDoc(doc(db, "localizacao_realtime", auth.currentUser.uid), dados, { merge: true });
    } catch (e) { console.log("Erro sincronia:", e); }
  };

  // --- HOOKS DE MONITORAMENTO E GPS ---
  const {
    geofenceAtiva, rotaCoords, chegouAoDestino, confirmacaoPendente,
    setChegouAoDestino, setConfirmacaoPendente, setRotaCoords
  } = useGpseCercas(db, user, location, cargaAtiva, setCargaAtiva, viagemIniciada);

  useMonitorarCargas({
    db, user, viagemIniciada, cargaAtiva, setCargaAtiva, setViagemIniciada,
    setChegouAoDestino, setConfirmacaoPendente, setShowConfirmacaoModal,
    setStatusOperacional, sincronizarComFirestore
  });

  // --- TRAVA DE HODÔMETRO ---
  const enviarKmObrigatorio = async () => {
    if (!hodometroInput.trim()) return Alert.alert("Atenção", "Informe o KM atual.");
    setEnviandoKm(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let cidade = "S/L";
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        const geo = await Location.reverseGeocodeAsync(loc.coords);
        if (geo.length > 0) cidade = geo[0].subregion || geo[0].city || "Cidade";
      }

      await addDoc(collection(db, 'historico_jornadas'), {
        motoristaId: user.uid,
        motoristaNome: motoristaProfile?.nome || user.email,
        tipo: 'LOG_SOLICITADO',
        timestamp: serverTimestamp(),
        km: parseFloat(hodometroInput.replace(',', '.')),
        cidade: cidade
      });

      await updateDoc(doc(db, "configuracoes", "controle_app"), { pedirHodometro: false });
      setHodometroInput('');
      Alert.alert("Sucesso", "KM enviado! Aplicativo liberado.");
    } catch (e) {
      Alert.alert("Erro", "Falha ao enviar dados.");
    } finally {
      setEnviandoKm(false);
    }
  };

  // --- LISTENERS DE AUTH E STATUS ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => { 
      if (u) {
        setUser(u);
        const q = query(collection(db, "cadastro_motoristas"), where("uid", "==", u.uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setMotoristaProfile(snap.docs[0].data());
          setIsLoggedIn(true);
        } else { signOut(auth); }
      } else {
        setUser(null); setIsLoggedIn(false);
      }
    }); 
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "configuracoes", "controle_app"), (docSnap) => {
      if (docSnap.exists()) {
        const isPedindo = docSnap.data().pedirHodometro;
        setSolicitacaoHodometro(isPedindo);
        if (isPedindo && !lastSolicitacaoStatus.current) {
          Vibration.vibrate([500, 200, 500]);
        }
        lastSolicitacaoStatus.current = isPedindo;
      }
    });
    return () => unsub();
  }, [user]);

  // --- MONITORAMENTO GPS ---
  useEffect(() => {
    if (isLoggedIn) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        
        await Location.watchPositionAsync({ 
          accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 
        }, async (loc) => {
          const speedKmh = loc.coords.speed ? Math.round(loc.coords.speed * 3.6) : 0;
          setLocation(loc.coords); 
          setCurrentSpeed(speedKmh < 0 ? 0 : speedKmh);
          webviewRef.current?.postMessage(JSON.stringify({ type: 'updateLoc', lat: loc.coords.latitude, lng: loc.coords.longitude }));
          
          let cidade = "---", uf = "";
          try {
            const geo = await Location.reverseGeocodeAsync(loc.coords);
            if (geo.length > 0) { cidade = geo[0].city || geo[0].subregion; uf = geo[0].region; }
          } catch (e) {}
          sincronizarComFirestore({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, velocidade: speedKmh, cidade, uf });
        });
      })();
    }
  }, [isLoggedIn]);

  const confirmarChegadaFinal = async () => {
    if (!cargaAtiva) return;
    setShowConfirmacaoModal(false);
    try {
      await updateDoc(doc(db, "ordens_servico", cargaAtiva.id), { 
        finalizada: true, status: 'FINALIZADA', dataFinalizacao: serverTimestamp() 
      });
      setCargaAtiva(null); setViagemIniciada(false); setRotaCoords([]);
      Alert.alert("Sucesso", "Viagem finalizada com sucesso!");
    } catch (error) { Alert.alert("Erro", "Falha ao finalizar."); }
  };

  // --- MAP HTML ---
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
        ${dest ? `L.circle([${dest.lat || dest.latitude}, ${dest.lng || dest.longitude}], { radius: ${geofenceAtiva?.raio || 300}, color: '${chegouAoDestino ? '#2ecc71' : '#FFD700'}', weight: 2, fillOpacity: 0.15 }).addTo(map);` : ''}
        ${rotaCoords.length > 0 ? `L.polyline(${JSON.stringify(rotaCoords.map(c => [c.latitude, c.longitude]))}, {color: '#FFD700', weight: 4}).addTo(map);` : ''}
        window.addEventListener('message', function(e) {
          var d = JSON.parse(e.data);
          if(d.type === 'updateLoc') marker.setLatLng([d.lat, d.lng]);
          if(d.type === 'center') map.flyTo([d.lat, d.lng], 16);
        });
      </script></body></html>
    `;
  }, [location === null, rotaCoords, chegouAoDestino, geofenceAtiva]);

  if (!isLoggedIn) return <TelaLogin onLogin={async (e, p) => signInWithEmailAndPassword(auth, e, p)} />;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* MODAL DE TRAVA HODÔMETRO */}
      <Modal visible={solicitacaoHodometro} transparent={false} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.lockScreen}>
          <View style={styles.lockContent}>
            <MaterialCommunityIcons name="gauge" size={100} color="#000" />
            <Text style={styles.lockTitle}>HODÔMETRO SOLICITADO</Text>
            <Text style={styles.lockSub}>Informe o KM atual para liberar o aplicativo.</Text>
            <TextInput 
              style={styles.lockInput}
              placeholder="000000"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={hodometroInput}
              onChangeText={setHodometroInput}
              autoFocus
            />
            <TouchableOpacity style={styles.lockBtn} onPress={enviarKmObrigatorio} disabled={enviandoKm}>
              {enviandoKm ? <ActivityIndicator color="#FFD700" /> : <Text style={styles.lockBtnText}>ENVIAR AGORA</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={{flex: 1, paddingTop: activeTab === 'painel' ? 0 : 60}}>
        {activeTab === 'painel' ? (
          <View style={{flex: 1}}>
            <MapViewStatic html={mapHtml} webviewRef={webviewRef} />
            <StatusAtual cargaAtiva={cargaAtiva} />
            <View style={styles.speedometerContainer}>
              <Text style={styles.speedText}>{currentSpeed}</Text>
              <Text style={styles.speedUnit}>KM/H</Text>
            </View>
            <ViagemCard cargaAtiva={cargaAtiva} chegouAoDestino={chegouAoDestino} onOpenGoogleMaps={(url) => Linking.openURL(url)} />
            <BotaoRotaAutomatica location={location} cargaAtiva={cargaAtiva} setRotaCoords={setRotaCoords} disabled={!viagemIniciada} onOpenGoogleMaps={(url) => Linking.openURL(url)} />
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

      <ConfirmacaoChegadaModal visible={showConfirmacaoModal} onConfirm={confirmarChegadaFinal} onCancel={() => setShowConfirmacaoModal(false)} cargaAtiva={cargaAtiva} />

      {/* NAVEGAÇÃO */}
      <View style={styles.floatingNavContainer}>
        <View style={styles.floatingNav}>
          {[
            { key: 'painel', icon: 'map', label: 'Início', lib: Ionicons },
            { key: 'viagens', icon: 'truck-delivery', label: 'Cargas', lib: MaterialCommunityIcons },
            { key: 'escala', icon: 'calendar-clock', label: 'Escala', lib: MaterialCommunityIcons },
            { key: 'jornada', icon: 'timer', label: 'Jornada', lib: Ionicons },
            { key: 'perfil', icon: 'shield-account', label: 'Perfil', lib: MaterialCommunityIcons },
          ].map(({ key, icon, label, lib: IconLib }) => (
            <TouchableOpacity key={key} style={styles.navItem} onPress={() => setActiveTab(key)}>
              <IconLib name={icon} size={24} color={activeTab === key ? "#FFD700" : "#999"} />
              <Text style={[styles.navText, { color: activeTab === key ? "#FFD700" : "#999" }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  lockScreen: { flex: 1, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center', padding: 30 },
  lockContent: { width: '100%', alignItems: 'center' },
  lockTitle: { fontSize: 22, fontWeight: '900', color: '#000', marginTop: 20, textAlign: 'center' },
  lockSub: { fontSize: 14, color: '#000', textAlign: 'center', marginTop: 10, marginBottom: 40, opacity: 0.8, fontWeight: '600' },
  lockInput: { backgroundColor: '#000', color: '#FFD700', width: '100%', borderRadius: 15, padding: 20, fontSize: 40, textAlign: 'center', fontWeight: 'bold', marginBottom: 20 },
  lockBtn: { backgroundColor: '#000', width: '100%', padding: 22, borderRadius: 15, alignItems: 'center', elevation: 10 },
  lockBtnText: { color: '#FFD700', fontSize: 18, fontWeight: '900' },
  speedometerContainer: { 
    position: 'absolute', top: 50, right: 20, width: 65, height: 65, 
    backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 35, borderWidth: 2, 
    borderColor: '#FFD700', justifyContent: 'center', alignItems: 'center', zIndex: 30 
  },
  speedText: { color: '#FFD700', fontSize: 22, fontWeight: '900' },
  speedUnit: { color: '#FFF', fontSize: 8 },
  floatingRouteCard: { 
    position: 'absolute', bottom: 125, left: 15, right: 15, 
    backgroundColor: 'rgba(15,15,15,0.95)', borderRadius: 15, padding: 15, 
    borderWidth: 1, borderColor: '#333', zIndex: 5 
  },
  routeHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  routeHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  routeLabel: { color: '#FFD700', fontSize: 9, fontWeight: 'bold' },
  routeInfo: { color: '#FFF', fontSize: 16, fontWeight: '900', marginBottom: 4 },
  cidadesContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cidadeText: { color: '#AAA', fontSize: 10 },
  setaCidades: { color: '#666', fontSize: 10, marginHorizontal: 4 },
  floatingGps: { position: 'absolute', bottom: 210, right: 20, backgroundColor: 'rgba(0,0,0,0.9)', padding: 12, borderRadius: 50, zIndex: 5 },
  floatingNavContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 20, paddingHorizontal: 10, zIndex: 100 },
  floatingNav: { flexDirection: 'row', backgroundColor: '#151515', paddingVertical: 10, borderRadius: 20, justifyContent: 'space-around' },
  navItem: { alignItems: 'center', flex: 1 },
  navText: { fontSize: 8, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#111', borderRadius: 20, padding: 20, width: '90%', borderWidth: 1, borderColor: '#FFD700' },
  modalHeader: { alignItems: 'center', marginBottom: 15 },
  modalTitle: { color: '#2ecc71', fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  modalScroll: { maxHeight: 200, marginBottom: 15 },
  modalMessage: { color: '#FFF', textAlign: 'center', marginBottom: 20 },
  detalhesCargaContainer: { backgroundColor: 'rgba(30,30,30,0.7)', borderRadius: 10, padding: 15, marginBottom: 15 },
  detalhesTitulo: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', marginBottom: 10 },
  detalhesLinha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detalhesLabel: { color: '#AAA', fontSize: 12 },
  detalhesValor: { color: '#FFF', fontSize: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: '#333', marginRight: 10 },
  modalButtonConfirm: { backgroundColor: '#2ecc71' },
  modalButtonConfirmText: { color: '#fff', fontWeight: 'bold' },
  modalButtonCancelText: { color: '#fff' },
});