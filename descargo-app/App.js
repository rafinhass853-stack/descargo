import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, 
  SafeAreaView, StatusBar, KeyboardAvoidingView, 
  Platform, ActivityIndicator, Alert, ScrollView 
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions'; 
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { FontAwesome, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

// FIREBASE
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d"
};

// IMPORTANTE: Para o rotograma interno, use a mesma chave de API do Google Maps
const GOOGLE_MAPS_APIKEY = "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const mapRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [cargaAtiva, setCargaAtiva] = useState(null);
  
  // Destino atual para o desenho do rotograma
  const [destinoCoords, setDestinoCoords] = useState(null);

  // --- ESCUTA NOTIFICAÇÕES E CARGA ATIVA EM TEMPO REAL ---
  useEffect(() => {
    if (isLoggedIn && user) {
      const q = query(
        collection(db, "notificacoes_cargas"),
        where("motoristaEmail", "==", user.email),
        where("status", "in", ["pendente", "aceito"])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          if (change.type === "added" && dados.status === "pendente") {
            Alert.alert(
              "🚛 VIAGEM PROGRAMADA",
              `DT: ${dados.dt}\n` +
              `Carreta: ${dados.carreta}\n` +
              `Peso: ${dados.peso} KG\n\n` +
              `📍 COLETA: ${dados.clienteColeta}\n` +
              `🏁 ENTREGA: ${dados.clienteEntrega}\n\n` +
              `Obs: ${dados.observacao}`,
              [
                { text: "RECUSAR", style: "cancel" },
                { text: "ACEITAR", onPress: () => aceitarCarga(id, dados) }
              ]
            );
          }

          if (dados.status === "aceito") {
            setCargaAtiva({ id, ...dados });
          }
        });
      });

      return () => unsubscribe();
    }
  }, [isLoggedIn, user]);

  const aceitarCarga = async (docId, dadosCarga) => {
    try {
      await updateDoc(doc(db, "notificacoes_cargas", docId), {
        status: "aceito",
        lidoEm: new Date()
      });
      setCargaAtiva({ id: docId, ...dadosCarga });
      Alert.alert("Sucesso", "Carga confirmada! Escolha a Rota abaixo para iniciar o traçado.");
    } catch (e) {
      Alert.alert("Erro", "Não foi possível confirmar a carga.");
    }
  };

  // FUNÇÃO PARA PEGAR O LINK E TRANSFORMAR EM ROTA NO MAPA
  const iniciarRotograma = (url) => {
    if (!url || url.includes("Considerar")) {
      return Alert.alert("Atenção", "Link não disponível ou considerar endereço da NF.");
    }

    // Tenta extrair coordenadas do link do Google Maps (@lat,long)
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = url.match(regex);

    if (match) {
      const coords = {
        latitude: parseFloat(match[1]),
        longitude: parseFloat(match[2]),
      };
      setDestinoCoords(coords);
    } else {
      // Se não achar coordenadas no link, tenta abrir o GPS externo como segurança
      Alert.alert(
        "Link de Texto", 
        "Não extraímos coordenadas automáticas. Abrir no Google Maps externo?",
        [
          { text: "Cancelar" },
          { text: "Abrir Externo", onPress: () => Linking.openURL(url) }
        ]
      );
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Atenção', 'Preencha os campos.');
    setLoading(true);
    try {
      const response = await signInWithEmailAndPassword(auth, email, password);
      setUser(response.user); 
      setIsLoggedIn(true);
    } catch (error) {
      Alert.alert('Falha no Login', 'E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let curLocation = await Location.getCurrentPositionAsync({});
        setLocation(curLocation.coords);
      })();
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.logoText}>DESCARGO</Text>
              <View style={styles.underline} />
              <Text style={styles.subtitle}>PAINEL DO MOTORISTA</Text>
            </View>
            <View style={styles.form}>
              <TextInput style={styles.input} placeholder="E-mail" placeholderTextColor="#666" value={email} onChangeText={setEmail} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Senha" placeholderTextColor="#666" value={password} onChangeText={setPassword} secureTextEntry />
              <TouchableOpacity style={styles.button} onPress={handleLogin} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType="hybrid"
        initialRegion={{
          latitude: -23.5505,
          longitude: -46.6333,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {location && destinoCoords && (
          <>
            <MapViewDirections
              origin={location}
              destination={destinoCoords}
              apikey={GOOGLE_MAPS_APIKEY}
              strokeWidth={4}
              strokeColor="#FFD700"
              onReady={result => {
                mapRef.current.fitToCoordinates(result.coordinates, {
                  edgePadding: { right: 30, bottom: 250, left: 30, top: 100 },
                });
              }}
            />
            <Marker coordinate={destinoCoords}>
              <View style={styles.markerContainer}>
                <MaterialCommunityIcons name="flag-checkered" size={30} color="#FFD700" />
              </View>
            </Marker>
          </>
        )}
      </MapView>

      {/* ROTOGRAMA ATIVO (CARD DE VIAGEM) */}
      {cargaAtiva && (
        <View style={styles.activeRouteCard}>
          <View style={styles.routeHeader}>
            <View>
              <Text style={styles.routeLabel}>ROTOGRAMA INTERNO - DT {cargaAtiva.dt}</Text>
              <Text style={styles.routeInfo}>{cargaAtiva.carreta} | {cargaAtiva.peso} KG</Text>
            </View>
            <TouchableOpacity onPress={() => { setCargaAtiva(null); setDestinoCoords(null); }}>
              <Ionicons name="close-circle" size={26} color="#666" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.routeCities}>{cargaAtiva.origem} ➔ {cargaAtiva.destino}</Text>
          
          <View style={styles.routeActions}>
            <TouchableOpacity 
              style={[styles.routeBtn, {backgroundColor: '#D97706'}]} 
              onPress={() => iniciarRotograma(cargaAtiva.linkColeta)}
            >
              <MaterialCommunityIcons name="map-marker-path" size={20} color="#000" />
              <Text style={styles.routeBtnText}>ROTA COLETA</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.routeBtn, {backgroundColor: '#2563EB'}]} 
              onPress={() => iniciarRotograma(cargaAtiva.linkEntrega)}
            >
              <MaterialCommunityIcons name="truck-delivery" size={20} color="#FFF" />
              <Text style={[styles.routeBtnText, {color: '#FFF'}]}>ROTA ENTREGA</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setDestinoCoords(null)}>
          <Ionicons name="home" size={24} color="#FFD700" />
          <Text style={[styles.tabText, {color: '#FFD700', fontWeight: 'bold'}]}>Início</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}><MaterialCommunityIcons name="shield-account" size={24} color="#888" /><Text style={styles.tabText}>Conta</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}><FontAwesome name="briefcase" size={22} color="#888" /><Text style={styles.tabText}>Operação</Text></TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}><Ionicons name="calendar" size={24} color="#888" /><Text style={styles.tabText}>Escala</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: '100%', height: '100%' },
  loginContainer: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  header: { alignItems: 'center', marginBottom: 60 },
  logoText: { fontSize: 48, fontWeight: '900', color: '#FFD700', letterSpacing: 1 },
  underline: { height: 3, width: 65, backgroundColor: '#D97706', marginTop: -2 },
  subtitle: { color: '#888', fontSize: 13, fontWeight: 'bold', letterSpacing: 4, marginTop: 25 },
  form: { width: '100%', maxWidth: 400 },
  input: { backgroundColor: '#111', color: '#FFF', padding: 20, borderRadius: 10, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#222' },
  button: { backgroundColor: '#FFD700', padding: 20, borderRadius: 10, alignItems: 'center', marginTop: 10, minHeight: 60, justifyContent: 'center' },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  activeRouteCard: { position: 'absolute', bottom: 100, left: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#333', elevation: 10 },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  routeLabel: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  routeInfo: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  routeCities: { color: '#BBB', fontSize: 13, marginVertical: 10, fontWeight: '600' },
  routeActions: { flexDirection: 'row', gap: 10, marginTop: 5 },
  routeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 10, gap: 8 },
  routeBtnText: { fontSize: 11, fontWeight: '900' },
  tabBar: { position: 'absolute', bottom: 0, flexDirection: 'row', backgroundColor: '#000', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#222', justifyContent: 'space-around', width: '100%', paddingBottom: Platform.OS === 'ios' ? 30 : 15 },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#888', fontSize: 10, marginTop: 4 },
  markerContainer: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 5, borderRadius: 20, borderWidth: 1, borderColor: '#FFD700' }
});