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
  Linking
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions'; 
import * as Location from 'expo-location';
import { FontAwesome, MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

// --- FIREBASE SETUP ---
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  initializeAuth, // Adicionado para persistência
  getReactNativePersistence // Adicionado para persistência
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'; // Necessário instalar
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d"
};

const GOOGLE_MAPS_APIKEY = "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M";

// Inicialização com Persistência para resolver o erro da sua foto
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
const db = getFirestore(app);

const { width, height } = Dimensions.get('window');

export default function App() {
  const mapRef = useRef(null);

  // Estados de Autenticação e Carregamento
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados de Localização e Carga
  const [location, setLocation] = useState(null);
  const [cargaAtiva, setCargaAtiva] = useState(null);
  const [destinoCoords, setDestinoCoords] = useState(null);

  // Estados Operacionais (O que seus amigos vão administrar)
  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [statusJornada, setStatusJornada] = useState('fora da jornada');

  // Monitora estado da Autenticação
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

  // SINCRONIZAÇÃO EM TEMPO REAL COM O FIREBASE
  const sincronizarComFirestore = async (dadosExtra = {}) => {
    if (!user) return;
    try {
      const motoristaRef = doc(db, "localizacao_realtime", user.uid);
      await setDoc(motoristaRef, {
        motoristaId: user.uid,
        email: user.email,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        statusOperacional,
        statusJornada,
        ultimaAtualizacao: serverTimestamp(),
        ...dadosExtra
      }, { merge: true });
    } catch (error) {
      console.error("Erro ao sincronizar dados:", error);
    }
  };

  // ESCUTA NOTIFICAÇÕES DE CARGAS
  useEffect(() => {
    if (isLoggedIn && user) {
      // Busca tanto em maiúsculo quanto minúsculo para garantir que a carga chegue
      const emailFiltro = user.email.toLowerCase(); 

      const q = query(
        collection(db, "notificacoes_cargas"),
        where("motoristaEmail", "==", emailFiltro),
        where("status", "in", ["pendente", "aceito"])
      );

      const unsubscribeCargas = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          if (change.type === "added" && dados.status === "pendente") {
            Alert.alert(
              "🚛 NOVA VIAGEM",
              `DT: ${dados.dt}\nCOLETA: ${dados.clienteColeta}\nENTREGA: ${dados.clienteEntrega}`,
              [
                { text: "RECUSAR", style: "cancel" },
                { 
                  text: "ACEITAR", 
                  onPress: () => confirmarCarga(id, dados) 
                }
              ]
            );
          }

          if (dados.status === "aceito") {
            setCargaAtiva({ id, ...dados });
          }
        });

        if (snapshot.empty) {
          setCargaAtiva(null);
        }
      });

      return () => unsubscribeCargas();
    }
  }, [isLoggedIn, user]);

  const confirmarCarga = async (docId, dados) => {
    try {
      const cargaRef = doc(db, "notificacoes_cargas", docId);
      await updateDoc(cargaRef, {
        status: "aceito",
        aceitoEm: serverTimestamp()
      });
      setCargaAtiva({ id: docId, ...dados });
      setStatusOperacional("Viagem vazio");
      sincronizarComFirestore({ statusOperacional: "Viagem vazio" });
    } catch (error) {
      Alert.alert("Erro", "Falha ao aceitar carga.");
    }
  };

  // GERENCIAMENTO DE STATUS
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

  // LOGIN E LOGOUT
  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Atenção', 'Preencha todos os campos.');
    setLoading(true);
    try {
      const response = await signInWithEmailAndPassword(auth, email.trim(), password);
      setUser(response.user);
      setIsLoggedIn(true);
    } catch (error) {
      Alert.alert('Erro no Login', 'Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Sair", "Deseja encerrar a sessão?", [
      { text: "Não", style: "cancel" },
      { 
        text: "Sim", 
        onPress: async () => {
          await signOut(auth);
          setIsLoggedIn(false);
          setCargaAtiva(null);
        }
      }
    ]);
  };

  // LOCALIZAÇÃO
  useEffect(() => {
    if (isLoggedIn) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10
        }, (loc) => {
          setLocation(loc.coords);
          sincronizarComFirestore({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          });
        });
      })();
    }
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

  // --- INTERFACE DE LOGIN ---
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
              <TextInput
                style={styles.input}
                placeholder="E-mail"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Senha"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.socialContainer}>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/rafael-araujo1992/')}>
                <FontAwesome name="linkedin-square" size={32} color="#0e76a8" style={styles.socialIcon}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/rafael.araujo1992/')}>
                <FontAwesome name="instagram" size={32} color="#c13584" style={styles.socialIcon}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('mailto:rafinhass853@gmail.com')}>
                <FontAwesome name="envelope" size={32} color="#f39c12" style={styles.socialIcon}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('tel:16988318626')}>
                <FontAwesome name="whatsapp" size={32} color="#25D366" style={styles.socialIcon}/>
              </TouchableOpacity>
            </View>
            <Text style={styles.signature}>Desenvolvido por Rafael Araujo</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- INTERFACE PRINCIPAL ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType="hybrid"
        showsUserLocation
        initialRegion={{
          latitude: -23.5505,
          longitude: -46.6333,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {location && cargaAtiva && (
           <Marker 
              coordinate={{latitude: location.latitude, longitude: location.longitude}}
              title="Sua Posição"
           />
        )}
      </MapView>

      {/* STATUS SUPERIOR */}
      <View style={styles.topStatusContainer}>
        <TouchableOpacity style={styles.statusBox} onPress={mudarStatusOperacional}>
          <Text style={styles.statusLabel}>STATUS OPERACIONAL</Text>
          <Text style={styles.statusValue}>{statusOperacional.toUpperCase()}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.statusBox, { borderColor: statusJornada === 'dentro da jornada' ? '#2ecc71' : '#444' }]} 
          onPress={alternarJornada}
        >
          <Text style={styles.statusLabel}>JORNADA TRABALHO</Text>
          <Text style={[styles.statusValue, { color: statusJornada === 'dentro da jornada' ? '#2ecc71' : '#888' }]}>
            {statusJornada.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* CARD DE VIAGEM ATIVA */}
      {cargaAtiva && (
        <View style={styles.activeRouteCard}>
          <View style={styles.routeHeader}>
            <View>
              <Text style={styles.routeLabel}>DT: {cargaAtiva.dt} | {cargaAtiva.carreta}</Text>
              <Text style={styles.routeInfo}>{cargaAtiva.clienteEntrega || 'Destino Pendente'}</Text>
            </View>
            <MaterialCommunityIcons name="truck-delivery" size={24} color="#FFD700" />
          </View>
          
          <View style={styles.routeActions}>
            <TouchableOpacity 
              onPress={() => Linking.openURL(cargaAtiva.linkColeta)} 
              style={[styles.routeBtn, {backgroundColor: '#D97706'}]}
            >
              <FontAwesome name="map-marker" size={14} color="#000" />
              <Text style={styles.routeBtnText}>ROTA COLETA</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => Linking.openURL(cargaAtiva.linkEntrega)} 
              style={[styles.routeBtn, {backgroundColor: '#2563EB'}]}
            >
              <MaterialIcons name="assistant-navigation" size={14} color="#FFF" />
              <Text style={[styles.routeBtnText, {color: '#FFF'}]}>ROTA ENTREGA</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* BARRA DE NAVEGAÇÃO */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="home" size={22} color="#FFD700" />
          <Text style={[styles.tabText, { color: '#FFD700' }]}>Painel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="shield-account" size={22} color="#888" />
          <Text style={styles.tabText}>Perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <FontAwesome name="briefcase" size={20} color="#888" />
          <Text style={styles.tabText}>Viagens</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color="#ff4d4d" />
          <Text style={[styles.tabText, {color: '#ff4d4d'}]}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* BOTÃO FLUTUANTE GPS */}
      <TouchableOpacity style={styles.gpsButton} onPress={centralizarMapa}>
        <MaterialIcons name="my-location" size={28} color="#FFD700" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: width, height: height },
  
  // Login Styles
  loginContainer: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 30, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 50 },
  logoText: { fontSize: 52, fontWeight: '900', color: '#FFD700', letterSpacing: -2 },
  underline: { height: 4, width: 70, backgroundColor: '#D97706', marginTop: -5 },
  subtitle: { color: '#888', fontSize: 12, fontWeight: 'bold', marginTop: 25, letterSpacing: 2 },
  form: { width: '100%', maxWidth: 400 },
  input: { backgroundColor: '#111', color: '#FFF', padding: 18, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#222', fontSize: 16 },
  button: { backgroundColor: '#FFD700', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, shadowColor: '#FFD700', shadowOpacity: 0.2, shadowRadius: 10 },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  
  // Social & Signature
  socialContainer: { flexDirection: 'row', justifyContent: 'center', gap: 30, marginTop: 40, width: '100%' },
  socialIcon: { opacity: 0.8 },
  signature: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 30, fontWeight: 'bold' },

  // UI Components
  topStatusContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 15, right: 15, flexDirection: 'row', gap: 10 },
  statusBox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#333', alignItems: 'center', backdropFilter: 'blur(10px)' },
  statusLabel: { color: '#666', fontSize: 8, fontWeight: 'black', marginBottom: 4 },
  statusValue: { fontSize: 11, fontWeight: '900', color: '#FFD700' },

  activeRouteCard: { position: 'absolute', bottom: 110, left: 15, right: 15, backgroundColor: 'rgba(7,7,7,0.95)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#FFD70033', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  routeLabel: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  routeInfo: { color: '#FFF', fontSize: 18, fontWeight: '900', maxWidth: '85%' },
  routeActions: { flexDirection: 'row', gap: 12 },
  routeBtn: { flex: 1, flexDirection: 'row', gap: 8, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routeBtnText: { color: '#000', fontSize: 11, fontWeight: '900' },

  gpsButton: { position: 'absolute', bottom: 120, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 50, borderWidth: 1, borderColor: '#333' },

  tabBar: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000', paddingBottom: Platform.OS === 'ios' ? 35 : 20 },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#888', fontSize: 10, marginTop: 6, fontWeight: 'bold' }
});