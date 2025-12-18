import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Linking, SafeAreaView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// Firebase - Configuração corrigindo erros de inicialização e persistência
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, signInWithEmailAndPassword, signOut, getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXb0wUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d"
};

// Lógica para evitar erro "auth/already-initialized"
let app, auth;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage) // Resolve aviso do terminal
  });
} else {
  app = getApp();
  try {
    auth = getAuth(app);
  } catch (e) {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  }
}

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  // Configuração Google (Sempre manter androidClientId para evitar erro)
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '861188099814-knk1338hsoie70juve012qf7lpkmcqmg.apps.googleusercontent.com',
    androidClientId: '861188099814-knk1338hsoie70juve012qf7lpkmcqmg.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      setUsuario({ email: "google-user@descargo.com" });
    }
  }, [response]);

  const realizarLoginEmail = () => {
    if (!auth) return; // Proteção contra undefined
    setLoading(true);
    signInWithEmailAndPassword(auth, email.trim(), senha)
      .then((userCredential) => {
        setLoading(false);
        setUsuario(userCredential.user);
      })
      .catch((error) => {
        setLoading(false);
        Alert.alert("Erro", "Login falhou. Verifique seu e-mail e senha no Firebase.");
      });
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      setUsuario(null);
      setEmail(''); 
      setSenha(''); 
    });
  };

  if (!usuario) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.content}>
          <Text style={styles.logo}>DESCARGO</Text>
          <View style={styles.linhaDestaque} />
          
          <TextInput 
            style={styles.input} 
            placeholder="E-mail" 
            placeholderTextColor="#555" 
            value={email} 
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput 
            style={styles.input} 
            placeholder="Senha" 
            placeholderTextColor="#555" 
            secureTextEntry 
            value={senha} 
            onChangeText={setSenha}
          />
          
          <TouchableOpacity style={styles.botaoEntrar} onPress={realizarLoginEmail}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.botaoTextoEntrar}>ENTRAR</Text>}
          </TouchableOpacity>
          
          <Text style={styles.divisor}>─── ou ───</Text>
          
          <TouchableOpacity 
            style={styles.botaoGoogle} 
            onPress={() => promptAsync()}
            disabled={!request}
          >
            <Text style={styles.botaoTextoGoogle}>ENTRAR COM CONTA GOOGLE</Text>
          </TouchableOpacity>

          {/* SEUS LINKS RECUPERADOS! */}
          <View style={styles.areaLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/5516988318626')}>
               <Text style={styles.linkVerde}>💬 WHATSAPP SUPORTE</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => Linking.openURL('https://www.linkedin.com/in/rafinhass85/')} style={{marginTop: 15}}>
               <Text style={styles.linkAzul}>🔗 LINKEDIN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.dashboardHeader}>
        <Text style={{color: '#000', fontWeight: '900'}}>MOTORISTA CONECTADO</Text>
      </View>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text style={{color: '#FFF'}}>Bem-vindo, {usuario.email}</Text>
        <TouchableOpacity style={styles.botaoSair} onPress={handleLogout}>
          <Text style={{color: '#000', fontWeight: 'bold'}}>SAIR DO APP 🚪</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { flex: 1, padding: 35, justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 45, fontWeight: '900', color: '#FFD700' },
  linhaDestaque: { height: 4, backgroundColor: '#FF8C00', width: 80, marginBottom: 40 },
  input: { width: '100%', height: 60, backgroundColor: '#111', borderRadius: 12, color: '#FFF', paddingHorizontal: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  botaoEntrar: { width: '100%', height: 60, backgroundColor: '#FFD700', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  botaoTextoEntrar: { fontWeight: '900', color: '#000' },
  divisor: { color: '#444', marginVertical: 20 },
  botaoGoogle: { width: '100%', height: 60, backgroundColor: '#FFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  botaoTextoGoogle: { fontWeight: 'bold', color: '#000' },
  areaLinks: { marginTop: 40, alignItems: 'center' },
  linkVerde: { color: '#2ecc71', fontWeight: 'bold' },
  linkAzul: { color: '#3498db', fontWeight: 'bold' },
  dashboardHeader: { height: 60, backgroundColor: '#FFD700', justifyContent: 'center', alignItems: 'center' },
  botaoSair: { marginTop: 30, backgroundColor: '#FF8C00', padding: 15, borderRadius: 10 }
});