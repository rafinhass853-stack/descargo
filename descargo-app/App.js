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
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { FontAwesome, MaterialCommunityIcons, Ionicons, MaterialIcons } from '@expo/vector-icons';

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
  or,
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

export default function App() {
  const mapRef = useRef(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [cargaAtiva, setCargaAtiva] = useState(null);
  const [statusOperacional, setStatusOperacional] = useState('Sem programação');
  const [statusJornada, setStatusJornada] = useState('fora da jornada');

  const abrirGPS = (destino) => {
    if (!destino) return;
    const url = destino.toString().startsWith('http') 
      ? destino 
      : Platform.select({
          ios: `maps:0,0?q=${encodeURIComponent(destino)}`,
          android: `geo:0,0?q=${encodeURIComponent(destino)}`
        });
    Linking.openURL(url);
  };

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

  // AJUSTE 1: Sincronização robusta usando o UID do usuário como ID do documento
  const sincronizarComFirestore = async (dadosExtra = {}) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return; 

    try {
      // Usar o UID garante que Rafael e Raabi tenham documentos diferentes na coleção
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
    } catch (error) {
      console.error("Erro na sincronização:", error);
    }
  };

  useEffect(() => {
    if (isLoggedIn && user) {
      const emailFiltro = user.email.toLowerCase().trim(); 
      const q = query(
        collection(db, "notificacoes_cargas"),
        and(
          or(where("motoristaEmail", "==", emailFiltro), where("motoristaId", "==", user.uid)),
          where("status", "in", ["pendente", "aceito"])
        )
      );

      const unsubscribeCargas = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          if (change.type === "added" && dados.status === "pendente") {
            const isVazio = dados.tipo === 'VAZIO' || dados.tipoViagem === 'VAZIO';
            
            Alert.alert(
              isVazio ? "⚪ LANÇAMENTO DE VAZIO" : "🔔 NOVA CARGA DISPONÍVEL",
              isVazio 
                ? `📍 DESTINO: ${dados.localEntrega || dados.entrega || "Não informado"}\n` +
                  `🏙️ CIDADE: ${dados.cidadeEntrega || dados.cidade || "Não informada"}\n` +
                  `🆔 DT: ${dados.dt || "---"}\n` +
                  `📝 OBS: ${dados.observacoes || "Nenhuma"}`
                : `📍 DESTINO: ${dados.localEntrega || "A definir"}\n` +
                  `🚛 CARRETA: ${dados.carreta || "Não informada"}\n` +
                  `⚖️ PESO: ${dados.peso || "0"}kg\n` +
                  `📦 CLIENTE: ${dados.clienteEntrega || "Informado no local"}`,
              [
                { 
                  text: "RECUSAR", 
                  style: "cancel", 
                  onPress: async () => await updateDoc(doc(db, "notificacoes_cargas", id), { status: "recusado" })
                },
                { 
                  text: "ACEITAR E INICIAR", 
                  onPress: () => confirmarCarga(id, dados) 
                }
              ],
              { cancelable: false }
            );
          }

          if (dados.status === "aceito") {
            setCargaAtiva({ id, ...dados });
          }
        });

        if (snapshot.empty) setCargaAtiva(null);
      });

      return () => unsubscribeCargas();
    }
  }, [isLoggedIn, user]);

  const confirmarCarga = async (docId, dados) => {
    try {
      const cargaRef = doc(db, "notificacoes_cargas", docId);
      const novoStatusOp = dados.tipo || dados.tipoViagem || 'Viagem carregado';

      await updateDoc(cargaRef, {
        status: "aceito",
        aceitoEm: serverTimestamp()
      });

      setCargaAtiva({ id: docId, ...dados });
      setStatusOperacional(novoStatusOp);
      sincronizarComFirestore({ statusOperacional: novoStatusOp });

      const destinoFinal = dados.linkEntrega || dados.linkMaps || dados.localEntrega || dados.entrega;
      abrirGPS(destinoFinal);

    } catch (error) {
      Alert.alert("Erro", "Falha ao aceitar carga.");
    }
  };

  const finalizarViagem = async () => {
    if (!cargaAtiva) return;
    Alert.alert("Finalizar Viagem", "Confirma a chegada ao destino final?", [
      { text: "Não", style: "cancel" },
      { 
        text: "Sim, Finalizar", 
        onPress: async () => {
          try {
            const cargaRef = doc(db, "notificacoes_cargas", cargaAtiva.id);
            await updateDoc(cargaRef, { status: "concluido", concluidoEm: serverTimestamp() });
            setCargaAtiva(null);
            setStatusOperacional("Sem programação");
            sincronizarComFirestore({ statusOperacional: "Sem programação" });
            Alert.alert("Sucesso", "Viagem concluída!");
          } catch (e) {
            Alert.alert("Erro", "Falha ao finalizar.");
          }
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

  // AJUSTE 2: Melhoria no watchPosition para envio em tempo real
  useEffect(() => {
    let subscriber;
    if (isLoggedIn) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        subscriber = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, 
          distanceInterval: 20
        }, (loc) => {
          setLocation(loc.coords);
          sincronizarComFirestore({ 
            latitude: loc.coords.latitude, 
            longitude: loc.coords.longitude 
          });
        });
      })();
    }
    return () => {
        if (subscriber) subscriber.remove();
    };
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
              <div style={styles.underline} />
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
      <MapView ref={mapRef} provider={PROVIDER_GOOGLE} style={styles.map} mapType="hybrid" showsUserLocation
        initialRegion={{ latitude: -23.5505, longitude: -46.6333, latitudeDelta: 0.05, longitudeDelta: 0.05 }}>
        {location && ( <Marker coordinate={{latitude: location.latitude, longitude: location.longitude}} /> )}
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
        <View style={styles.activeRouteCard}>
          <View style={styles.routeHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>{cargaAtiva.tipo || cargaAtiva.tipoViagem || 'VIAGEM'}</Text>
              <Text style={styles.routeInfo} numberOfLines={1}>{cargaAtiva.localEntrega || cargaAtiva.entrega}</Text>
              <Text style={{color: '#888', fontSize: 11, fontWeight: 'bold'}}>{cargaAtiva.cidadeEntrega || cargaAtiva.cidade || ''}</Text>
            </View>
            <TouchableOpacity onPress={finalizarViagem}>
              <Ionicons name="checkmark-done-circle" size={54} color="#2ecc71" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            onPress={() => abrirGPS(cargaAtiva.linkEntrega || cargaAtiva.linkMaps || cargaAtiva.localEntrega || cargaAtiva.entrega)} 
            style={styles.fullRouteBtn}>
            <MaterialIcons name="assistant-navigation" size={20} color="#000" />
            <Text style={styles.fullRouteBtnText}>ABRIR ROTA NO GOOGLE MAPS</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}><Ionicons name="home" size={22} color="#FFD700" /><Text style={[styles.tabText, { color: '#FFD700' }]}>Painel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}><MaterialCommunityIcons name="shield-account" size={22} color="#888" /><Text style={styles.tabText}>Perfil</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}><FontAwesome name="briefcase" size={20} color="#888" /><Text style={styles.tabText}>Viagens</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={handleLogout}><Ionicons name="log-out" size={22} color="#ff4d4d" /><Text style={[styles.tabText, {color: '#ff4d4d'}]}>Sair</Text></TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.gpsButton} onPress={centralizarMapa}>
        <MaterialIcons name="my-location" size={28} color="#FFD700" />
      </TouchableOpacity>
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
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  routeLabel: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  routeInfo: { color: '#FFF', fontSize: 22, fontWeight: '900' },
  fullRouteBtn: { backgroundColor: '#FFD700', flexDirection: 'row', gap: 10, padding: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  fullRouteBtnText: { color: '#000', fontSize: 13, fontWeight: '900' },
  gpsButton: { position: 'absolute', bottom: 280, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 50, borderWidth: 1, borderColor: '#333' },
  tabBar: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#000', paddingBottom: Platform.OS === 'ios' ? 35 : 20 },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#888', fontSize: 10, marginTop: 6, fontWeight: 'bold' }
});