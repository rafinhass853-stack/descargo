import React, { useState } from 'react';
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
  ScrollView,
  Linking
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

const TelaLogin = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // Novo estado para controlar a visibilidade da senha
  const [showPassword, setShowPassword] = useState(false);

  const openLink = (url) => Linking.openURL(url);

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Atenção: Preencha todos os campos.');
      return;
    }
    setLoading(true);
    try {
      await onLogin(email.trim().toLowerCase(), password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginContainer}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
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
              keyboardType="email-address"
            />

            {/* Container da Senha */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Senha"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword} // Alterna entre true/false
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <FontAwesome 
                  name={showPassword ? "eye" : "eye-slash"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>ENTRAR NO SISTEMA</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.socialContainer}>
            <Text style={styles.socialTitle}>SUPORTE E REDES SOCIAIS</Text>
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialIcon}
                onPress={() => openLink('https://wa.me/5516988318626')}
              >
                <FontAwesome name="whatsapp" size={24} color="#25D366" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialIcon}
                onPress={() => openLink('https://www.instagram.com/rafael.araujo1992/')}
              >
                <FontAwesome name="instagram" size={24} color="#E1306C" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialIcon}
                onPress={() => openLink('https://www.linkedin.com/in/rafael-araujo1992/')}
              >
                <FontAwesome name="linkedin" size={24} color="#0077B5" />
              </TouchableOpacity>
            </View>
            <Text style={styles.signature}>Desenvolvido por Rafael Araujo</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  loginContainer: { flex: 1, backgroundColor: '#000' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 30,
    alignItems: 'center',
  },
  header: { alignItems: 'center', marginBottom: 50 },
  logoText: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: -2,
  },
  underline: {
    height: 4,
    width: 70,
    backgroundColor: '#D97706',
    marginTop: -5,
  },
  subtitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 25,
    letterSpacing: 2,
  },
  form: { width: '100%', maxWidth: 400 },
  input: {
    backgroundColor: '#111',
    color: '#FFF',
    padding: 18,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#222',
    fontSize: 16,
  },
  // Novos estilos para o container da senha e o ícone
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative'
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  button: {
    backgroundColor: '#FFD700',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  socialContainer: { marginTop: 40, alignItems: 'center' },
  socialTitle: {
    color: '#444',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 15,
  },
  socialRow: { flexDirection: 'row', gap: 25, marginBottom: 20 },
  socialIcon: {
    padding: 10,
    backgroundColor: '#111',
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#222',
  },
  signature: { color: '#333', fontSize: 10, fontWeight: 'bold' },
});

export default TelaLogin;