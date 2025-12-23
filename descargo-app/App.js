import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, View, Text, TextInput, TouchableOpacity, 
  SafeAreaView, StatusBar, KeyboardAvoidingView, 
  Platform, ActivityIndicator, Alert, ScrollView 
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { FontAwesome, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Configuração Firebase (Suas credenciais)
const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);

  const openSocial = (type) => {
    let url = '';
    if (type === 'whatsapp') url = 'https://wa.me/5511999999999'; 
    if (type === 'instagram') url = 'https://instagram.com/seu_perfil';
    if (type === 'linkedin') url = 'https://linkedin.com/in/seu_perfil';
    Linking.openURL(url).catch(() => Alert.alert('Erro', 'Não foi possível abrir o link.'));
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

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Atenção', 'Preencha os campos.');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoggedIn(true);
    } catch (error) {
      Alert.alert('Falha no Login', 'E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  // --- TELA DE LOGIN (ESTILO EXATO DA FOTO) ---
  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            
            <View style={styles.header}>
              <Text style={styles.logoText}>DESCARGO</Text>
              <View style={styles.underline} />
              <Text style={styles.subtitle}>PAINEL DO GESTOR</Text>
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
              <TouchableOpacity style={styles.button} onPress={handleLogin} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Desenvolvido por Rafael Araujo</Text>
              <View style={styles.socialIcons}>
                <TouchableOpacity onPress={() => openSocial('whatsapp')}>
                  <FontAwesome name="whatsapp" size={28} color="#25D366" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openSocial('instagram')}>
                  <FontAwesome name="instagram" size={28} color="#E4405F" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openSocial('linkedin')}>
                  <FontAwesome name="linkedin-square" size={28} color="#0077B5" />
                </TouchableOpacity>
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- TELA PRINCIPAL (MAPA SATÉLITE + MENU) ---
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        mapType="satellite"
        region={{
          latitude: location ? location.latitude : -23.5505,
          longitude: location ? location.longitude : -46.6333,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={true}
      />

      {/* MENU RODAPÉ (DASHBOARD) */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="home" size={24} color="#FFD700" />
          <Text style={[styles.tabText, {color: '#FFD700', fontWeight: 'bold'}]}>Início</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <MaterialCommunityIcons name="shield-account" size={24} color="#888" />
          <Text style={styles.tabText}>Conta</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <FontAwesome name="briefcase" size={22} color="#888" />
          <Text style={styles.tabText}>Operação</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="calendar" size={24} color="#888" />
          <Text style={styles.tabText}>Escala</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Estilos Gerais
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: '100%', height: '100%' },

  // Estilos do Login (Fiel à imagem)
  loginContainer: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  header: { alignItems: 'center', marginBottom: 60 },
  logoText: { fontSize: 48, fontWeight: '900', color: '#FFD700', letterSpacing: 1 },
  underline: { height: 3, width: 65, backgroundColor: '#D97706', marginTop: -2 },
  subtitle: { color: '#888', fontSize: 13, fontWeight: 'bold', letterSpacing: 4, marginTop: 25 },
  form: { width: '100%', maxWidth: 400 },
  input: { 
    backgroundColor: '#111', 
    color: '#FFF', 
    padding: 20, 
    borderRadius: 10, 
    marginBottom: 15, 
    fontSize: 16, 
    borderWidth: 1, 
    borderColor: '#222' 
  },
  button: { 
    backgroundColor: '#FFD700', 
    padding: 20, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginTop: 10,
    minHeight: 60,
    justifyContent: 'center'
  },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },

  // Estilos do Rodapé (Login)
  footer: { marginTop: 80, alignItems: 'center' },
  footerText: { color: '#444', fontSize: 12, marginBottom: 20 },
  socialIcons: { flexDirection: 'row', gap: 35 },

  // Estilos do Menu Inferior (Pós-login)
  tabBar: { 
    position: 'absolute', 
    bottom: 0, 
    flexDirection: 'row', 
    backgroundColor: '#000', 
    paddingVertical: 15, 
    borderTopWidth: 1, 
    borderTopColor: '#222', 
    justifyContent: 'space-around', 
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 15 
  },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabText: { color: '#888', fontSize: 10, marginTop: 4 }
});