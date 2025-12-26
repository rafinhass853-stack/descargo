import React, { useState, useEffect, useRef } from 'react';
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
import MapView, { PROVIDER_GOOGLE, Marker, Polyline, Circle, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { FontAwesome, MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

// --- IMPORTAÇÃO DA NOVA TELA ---
import Conta from './Conta'; 

// --- FIREBASE SETUP ---
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

const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
let auth;
try {
  auth = getAuth(app);
} catch (e) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
}
const db = getFirestore(app);

const { width, height } = Dimensions.get('window');

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
  const mapRef = useRef(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('painel'); 
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [cargaAtiva, setCargaAtiva] = useState(null);
  
  // Lista de todas as cercas do sistema
  const [todasAsCercas, setTodasAsCercas] = useState([]);
  const [geofenceAtiva, setGeofenceAtiva] = useState(null); 

  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [statusJornada, setStatusJornada] = useState('fora da jornada');
  const [rotaCoords, setRotaCoords] = useState([]);
  const [destinoCoord, setDestinoCoord] = useState(null);
  const [chegouAoDestino, setChegouAoDestino] = useState(false);

  // 1. CARREGAR TODAS AS CERCAS DO FIREBASE
  useEffect(() => {
    if (isLoggedIn) {
      const q = query(collection(db, "cadastro_clientes_pontos"));
      const unsubscribeCercas = onSnapshot(q, (snap) => {
        const cercasData = [];
        snap.forEach((doc) => {
          cercasData.push({ id: doc.id, ...doc.data() });
        });
        setTodasAsCercas(cercasData);
      });
      return () => unsubscribeCercas();
    }
  }, [isLoggedIn]);

  // 2. IDENTIFICAR QUAL CERCA É A "ATIVA" (DO MEU DESTINO) PARA A ROTA
  useEffect(() => {
    if (cargaAtiva && todasAsCercas.length > 0) {
      const nomeClienteRaw = cargaAtiva?.destinoCliente || cargaAtiva?.cliente_destino;
      if (nomeClienteRaw) {
        const nomeLimpo = nomeClienteRaw.toString().toUpperCase().trim();
        const encontrada = todasAsCercas.find(c => c.cliente?.toUpperCase().trim() === nomeLimpo);
        if (encontrada && encontrada.geofence) {
          setGeofenceAtiva(encontrada.geofence);
        }
      }
    } else {
      setGeofenceAtiva(null);
    }
  }, [cargaAtiva, todasAsCercas]);

  // Função OSRM
  const buscarRotaOSRM = async (origem, latDest, lngDest) => {
    if (!origem || !latDest || !lngDest) return;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origem.longitude},${origem.latitude};${lngDest},${latDest}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(c => ({
          latitude: c[1],
          longitude: c[0]
        }));
        setRotaCoords(coords);
      }
    } catch (error) {
      console.error("Erro OSRM:", error);
    }
  };

  // 3. LÓGICA DE ROTA (VAI PARA A CERCA DO DESTINO)
  useEffect(() => {
    if (location && (geofenceAtiva || cargaAtiva)) {
      if (geofenceAtiva?.centro?.lat) {
        const dLat = geofenceAtiva.centro.lat;
        const dLng = geofenceAtiva.centro.lng;
        setDestinoCoord({ latitude: dLat, longitude: dLng });
        buscarRotaOSRM(location, dLat, dLng);
      } 
      else if (geofenceAtiva?.coordenadas && geofenceAtiva.coordenadas.length > 0) {
        const dLat = geofenceAtiva.coordenadas[0].lat;
        const dLng = geofenceAtiva.coordenadas[0].lng;
        setDestinoCoord({ latitude: dLat, longitude: dLng });
        buscarRotaOSRM(location, dLat, dLng);
      }
      else if (cargaAtiva) {
        const cidade = cargaAtiva.destinoCidade || cargaAtiva.cidade_destino;
        if (cidade) {
           Location.geocodeAsync(cidade).then(geo => {
             if (geo.length > 0) {
               setDestinoCoord({ latitude: geo[0].latitude, longitude: geo[0].longitude });
               buscarRotaOSRM(location, geo[0].latitude, geo[0].longitude);
             }
           });
        }
      }
    } else {
      setRotaCoords([]);
      setDestinoCoord(null);
    }
  }, [location?.latitude, geofenceAtiva, cargaAtiva]);

  // MONITORAMENTO DE CHEGADA
  useEffect(() => {
    if (location && (geofenceAtiva || destinoCoord)) {
      let estaDentro = false;
      const latMotorista = location.latitude;
      const lngMotorista = location.longitude;

      if (geofenceAtiva?.tipo === 'circle' && geofenceAtiva.centro) {
        const dist = getDistance(latMotorista, lngMotorista, geofenceAtiva.centro.lat, geofenceAtiva.centro.lng);
        estaDentro = dist <= (parseFloat(geofenceAtiva.raio) + 30); 
      } else if (geofenceAtiva?.coordenadas) {
        const dist = getDistance(latMotorista, lngMotorista, geofenceAtiva.coordenadas[0].lat, geofenceAtiva.coordenadas[0].lng);
        estaDentro = dist <= 250;
      } else if (destinoCoord) {
        const dist = getDistance(latMotorista, lngMotorista, destinoCoord.latitude, destinoCoord.longitude);
        estaDentro = dist <= 300;
      }

      if (estaDentro && !chegouAoDestino) {
        Vibration.vibrate([500, 500, 500]);
        setChegouAoDestino(true);
      } else if (!estaDentro && chegouAoDestino) {
        setChegouAoDestino(false);
      }
    }
  }, [location, geofenceAtiva, destinoCoord]);

  // Auth e Sincronização
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (authenticatedUser) => {
      if (authenticatedUser) {
        setUser(authenticatedUser);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const sincronizarComFirestore = async (dadosExtra = {}) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return; 
    try {
      const motoristaRef = doc(db, "localizacao_realtime", currentUser.uid);
      await setDoc(motoristaRef, {
        motoristaId: currentUser.uid,
        email: currentUser.email,
        latitude: dadosExtra.latitude || location?.latitude || null,
        longitude: dadosExtra.longitude || location?.longitude || null,
        statusOperacional: dadosExtra.statusOperacional || statusOperacional,
        statusJornada: dadosExtra.statusJornada || statusJornada,
        ultimaAtualizacao: serverTimestamp(),
      }, { merge: true });
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (isLoggedIn && user) {
      const q = query(
        collection(db, "ordens_servico"),
        and(
          where("motoristaId", "==", user.uid),
          where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO"])
        )
      );

      const unsubscribeCargas = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          if ((change.type === "added" || change.type === "modified") && 
              (dados.status === "AGUARDANDO PROGRAMAÇÃO" || dados.status === "PENDENTE ACEITE")) {
            
            Vibration.vibrate([0, 500, 500, 500], true); 
            const isVazio = dados.tipoViagem === 'VAZIO';
            
            Alert.alert(
              isVazio ? "⚪ LANÇAMENTO DE VAZIO" : "🔔 NOVA CARGA DISPONÍVEL",
              isVazio 
                ? `📍 DESTINO: ${dados.destinoCliente || dados.cliente_destino}\n🏙️ CIDADE: ${dados.destinoCidade || dados.cidade_destino}`
                : `📍 ORIGEM: ${dados.origemCliente}\n🏁 DESTINO: ${dados.destinoCliente || dados.cliente_destino}`,
              [
                { text: "RECUSAR", style: "cancel", onPress: async () => { Vibration.cancel(); await updateDoc(doc(db, "ordens_servico", id), { status: "RECUSADO" }); } },
                { text: "ACEITAR E INICIAR", onPress: () => { Vibration.cancel(); confirmarCarga(id, dados); } }
              ],
              { cancelable: false }
            );
          }
          if (dados.status === "ACEITO") setCargaAtiva({ id, ...dados });
        });
        if (snapshot.empty) setCargaAtiva(null);
      });
      return () => unsubscribeCargas();
    }
  }, [isLoggedIn, user]);

  const confirmarCarga = async (docId, dados) => {
    try {
      const cargaRef = doc(db, "ordens_servico", docId);
      const novoStatusOp = dados.tipoViagem === 'VAZIO' ? 'Viagem vazio' : 'Viagem carregado';
      await updateDoc(cargaRef, { status: "ACEITO", aceitoEm: serverTimestamp() });
      setCargaAtiva({ id: docId, ...dados });
      setStatusOperacional(novoStatusOp);
      sincronizarComFirestore({ statusOperacional: novoStatusOp });
    } catch (error) { Alert.alert("Erro", "Falha ao aceitar carga."); }
  };

  const finalizarViagem = async () => {
    if (!cargaAtiva) return;
    Alert.alert("Finalizar Viagem", "Confirma a chegada ao destino final?", [
      { text: "Não", style: "cancel" },
      { 
        text: "Sim, Finalizar", 
        onPress: async () => {
          try {
            const cargaRef = doc(db, "ordens_servico", cargaAtiva.id);
            await updateDoc(cargaRef, { status: "CONCLUÍDO", concluidoEm: serverTimestamp() });
            setCargaAtiva(null);
            setRotaCoords([]);
            setDestinoCoord(null);
            setStatusOperacional("Sem programação");
            sincronizarComFirestore({ statusOperacional: "Sem programação" });
            Alert.alert("Sucesso", "Viagem concluída!");
          } catch (e) { Alert.alert("Erro", "Falha ao finalizar."); }
        }
      }
    ]);
  };

  const alternarJornada = () => {
    const novoStatus = statusJornada === 'dentro da jornada' ? 'fora da jornada' : 'dentro da jornada';
    setStatusJornada(novoStatus);
    sincronizarComFirestore({ statusJornada: novoStatus });
  };

  const mudarStatusOperacional = () => {
    Alert.alert("Atualizar Operação", "Selecione seu estado atual:", [
      { text: "Sem programação", onPress: () => atualizarOp("Sem programação") },
      { text: "Viagem vazio", onPress: () => atualizarOp("Viagem vazio") },
      { text: "Viagem carregado", onPress: () => atualizarOp("Viagem carregado") },
      { text: "Manutenção", onPress: () => atualizarOp("Manutenção") },
      { text: "Cancelar", style: "cancel" }
    ]);
  };

  const atualizarOp = (valor) => {
    setStatusOperacional(valor);
    sincronizarComFirestore({ statusOperacional: valor });
  };

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Atenção', 'Preencha todos os campos.');
    setLoading(true);
    try {
      const response = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(response.user);
      setIsLoggedIn(true);
    } catch (error) { Alert.alert('Erro no Login', 'Verifique suas credenciais.'); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    Alert.alert("Sair", "Deseja encerrar a sessão?", [
      { text: "Não", style: "cancel" },
      { text: "Sim", onPress: async () => { await signOut(auth); setIsLoggedIn(false); setCargaAtiva(null); } }
    ]);
  };

  useEffect(() => {
    let subscriber;
    if (isLoggedIn) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        subscriber = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, 
          distanceInterval: 15
        }, (loc) => {
          setLocation(loc.coords);
          sincronizarComFirestore({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        });
      })();
    }
    return () => { if (subscriber) subscriber.remove(); };
  }, [isLoggedIn]);

  const centralizarMapa = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005
      }, 1000);
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
              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.socialContainer}>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/rafael-araujo1992/')}><FontAwesome name="linkedin-square" size={32} color="#0e76a8" /></TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/rafael.araujo1992/')}><FontAwesome name="instagram" size={32} color="#c13584" /></TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('mailto:rafinhass853@gmail.com')}><FontAwesome name="envelope" size={32} color="#f39c12" /></TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('tel:16988318626')}><FontAwesome name="whatsapp" size={32} color="#25D366" /></TouchableOpacity>
            </View>
            <Text style={styles.signature}>Desenvolvido por Rafael Araujo</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {activeTab === 'painel' ? (
        <>
          <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={styles.map} mapType="hybrid" showsUserLocation
            initialRegion={{ latitude: -23.5505, longitude: -46.6333, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
            
            {/* RENDERIZA TODAS AS CERCAS DO BANCO DE DADOS */}
            {todasAsCercas.map((item) => {
              if (!item.geofence) return null;
              
              // Se for o destino atual, usamos amarelo vibrante. Outras ficam com cinza/transparente.
              const isDestino = item.cliente?.toUpperCase().trim() === (cargaAtiva?.destinoCliente || cargaAtiva?.cliente_destino)?.toUpperCase().trim();
              const fillColor = isDestino ? "rgba(255, 215, 0, 0.4)" : "rgba(255, 255, 255, 0.2)";
              const strokeColor = isDestino ? "#FFD700" : "#AAA";

              if (item.geofence.tipo === 'circle' && item.geofence.centro) {
                return (
                  <Circle 
                    key={item.id}
                    center={{ latitude: item.geofence.centro.lat, longitude: item.geofence.centro.lng }}
                    radius={parseFloat(item.geofence.raio)}
                    fillColor={fillColor}
                    strokeColor={strokeColor}
                    strokeWidth={2}
                  />
                );
              }
              if ((item.geofence.tipo === 'polygon' || item.geofence.tipo === 'rectangle') && item.geofence.coordenadas) {
                return (
                  <Polygon 
                    key={item.id}
                    coordinates={item.geofence.coordenadas.map(c => ({ latitude: c.lat, longitude: c.lng }))}
                    fillColor={fillColor}
                    strokeColor={strokeColor}
                    strokeWidth={2}
                  />
                );
              }
              return null;
            })}

            {rotaCoords.length > 0 && (
              <Polyline coordinates={rotaCoords} strokeColor="#FFD700" strokeWidth={5} />
            )}
            
            {destinoCoord && (
              <Marker coordinate={destinoCoord}>
                <MaterialCommunityIcons name="map-marker-check" size={45} color="#FFD700" />
              </Marker>
            )}
          </MapView>

          <View style={styles.topStatusContainer}>
            <TouchableOpacity style={styles.statusBox} onPress={mudarStatusOperacional}>
              <Text style={styles.statusLabel}>STATUS OPERACIONAL</Text>
              <Text style={styles.statusValue}>{statusOperacional.toUpperCase()}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusBox, { borderColor: statusJornada === 'dentro da jornada' ? '#2ecc71' : '#444' }]} onPress={alternarJornada}>
              <Text style={styles.statusLabel}>JORNADA TRABALHO</Text>
              <Text style={[styles.statusValue, { color: statusJornada === 'dentro da jornada' ? '#2ecc71' : '#888' }]}>{statusJornada.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          {cargaAtiva && (
            <View style={[styles.activeRouteCard, chegouAoDestino && {borderColor: '#2ecc71', borderWidth: 2}]}>
              <View style={styles.routeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>{cargaAtiva.tipoViagem?.toUpperCase() || 'VIAGEM'} - DT {cargaAtiva.dt || '---'}</Text>
                  <Text style={styles.routeInfo} numberOfLines={1}>{cargaAtiva.destinoCliente || cargaAtiva.cliente_destino}</Text>
                  <Text style={{color: '#888', fontSize: 11}}>{cargaAtiva.destinoCidade || cargaAtiva.cidade_destino}</Text>
                </View>
                <TouchableOpacity onPress={finalizarViagem}>
                  <Ionicons name="checkmark-done-circle" size={60} color={chegouAoDestino ? "#2ecc71" : "#444"} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.gpsButton} onPress={centralizarMapa}>
            <MaterialIcons name="my-location" size={28} color="#FFD700" />
          </TouchableOpacity>
        </>
      ) : (
        <Conta auth={auth} db={db} />
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('painel')}>
          <Ionicons name="home" size={22} color={activeTab === 'painel' ? "#FFD700" : "#888"} />
          <Text style={[styles.tabText, { color: activeTab === 'painel' ? '#FFD700' : '#888' }]}>Painel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('perfil')}>
          <MaterialCommunityIcons name="shield-account" size={22} color={activeTab === 'perfil' ? "#FFD700" : "#888"} />
          <Text style={[styles.tabText, { color: activeTab === 'perfil' ? '#FFD700' : '#888' }]}>Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#ff4d4d" />
          <Text style={[styles.tabText, {color: '#ff4d4d'}]}>Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: width, height: height },
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
  socialContainer: { flexDirection: 'row', justifyContent: 'center', gap: 30, marginTop: 40 },
  signature: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 30, fontWeight: 'bold' },
  topStatusContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 15, right: 15, flexDirection: 'row', gap: 10 },
  statusBox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  statusLabel: { color: '#666', fontSize: 8, fontWeight: '900', marginBottom: 4 },
  statusValue: { fontSize: 11, fontWeight: '900', color: '#FFD700' },
  activeRouteCard: { position: 'absolute', bottom: 110, left: 15, right: 15, backgroundColor: 'rgba(7,7,7,0.98)', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#FFD70044' },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeLabel: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  routeInfo: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  gpsButton: { position: 'absolute', bottom: 250, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 50, borderWidth: 1, borderColor: '#333' },
  tabBar: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000', paddingBottom: Platform.OS === 'ios' ? 35 : 20 },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#888', fontSize: 10, marginTop: 6, fontWeight: 'bold' }
});