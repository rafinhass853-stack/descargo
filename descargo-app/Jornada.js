import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, FlatList, ActivityIndicator 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons'; 

// Importações configuradas conforme suas credenciais (descargo-4090a)
import { db, storage, auth } from './firebase'; 
import { 
  collection, addDoc, serverTimestamp, 
  onSnapshot, query, orderBy, where, limit 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function Jornada({ onOnline }) {
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(false);
  const [hodometro, setHodometro] = useState('');
  const [image, setImage] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [timer, setTimer] = useState('00:00:00');
  const [historico, setHistorico] = useState([]);

  // 1. Monitoramento em tempo real (essencial para seus administradores)
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      // Esta query usa o índice composto: motoristaId (ASC) + timestamp (DESC)
      const q = query(
        collection(db, "historico_jornadas"),
        where("motoristaId", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(15)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistorico(data);
        
        // Recupera estado online baseado no último registro de INICIO
        if (data.length > 0 && data[0].tipo === 'INICIO') {
          setOnline(true);
          if (data[0].timestamp) {
            setStartTime(data[0].timestamp.toDate());
          }
          if (onOnline) onOnline(true);
        } else {
          setOnline(false);
          if (onOnline) onOnline(false);
        }
      }, (error) => {
        // Se o índice ainda estiver "Building", o erro aparecerá aqui no console
        console.error("Erro no Firestore (verifique se o índice está Ativo):", error);
      });

      return () => unsubscribe();
    }
  }, []);

  // 2. Lógica do Cronômetro
  useEffect(() => {
    let interval;
    if (online && startTime) {
      interval = setInterval(() => {
        const diff = new Date() - startTime;
        const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setTimer(`${hours}:${minutes}:${seconds}`);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [online, startTime]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Erro", "Precisamos de acesso à câmera.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ 
      quality: 0.3, 
      allowsEditing: true 
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  // 3. Função Principal de Registro (Salva na coleção correta)
  const registrarEvento = async (tipo) => {
    if (!hodometro || (tipo === 'INICIO' && !image)) {
      Alert.alert('Atenção', 'Informe o KM e a foto do painel.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      const { status } = await Location.requestForegroundPermissionsAsync();
      const loc = status === 'granted' ? await Location.getCurrentPositionAsync({}) : null;
      
      let imageUrl = "";

      // Upload da foto para o Storage (descargo-4090a)
      if (image && tipo === 'INICIO') {
        const response = await fetch(image);
        const blob = await response.blob();
        const imageRef = ref(storage, `jornadas/${user.uid}/${Date.now()}.jpg`);
        await uploadBytes(imageRef, blob);
        imageUrl = await getDownloadURL(imageRef);
      }

      // Salvando os dados (Este comando cria a coleção automaticamente no Firebase)
      await addDoc(collection(db, 'historico_jornadas'), {
        motoristaId: user.uid, // Campo usado no seu índice
        email: user.email,
        tipo: tipo,
        timestamp: serverTimestamp(), // Campo usado no seu índice
        km: parseFloat(hodometro),
        imageUrl: imageUrl,
        localizacao: loc ? { latitude: loc.coords.latitude, longitude: loc.coords.longitude } : null
      });

      if (tipo === 'INICIO') {
        setStartTime(new Date());
        setOnline(true);
      } else {
        setOnline(false);
        setStartTime(null);
        setTimer('00:00:00');
        setHodometro('');
        setImage(null);
      }

      Alert.alert("Sucesso", tipo === 'INICIO' ? "Jornada iniciada!" : "Jornada encerrada!");
    } catch (error) {
      console.error(error);
      Alert.alert("Erro ao salvar", "O índice composto pode ainda estar em criação. Aguarde 5 minutos.");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.historyCard}>
      <View style={[styles.statusTag, { backgroundColor: item.tipo === 'INICIO' ? '#2ecc71' : '#e74c3c' }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.historyText}>{item.tipo === 'INICIO' ? 'TURNO ABERTO' : 'TURNO FECHADO'}</Text>
        <Text style={styles.historySub}>
          {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString('pt-BR') : 'Gravando...'}
        </Text>
      </View>
      <Text style={styles.historyKm}>{item.km} KM</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={historico}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>DESCARGO - JORNADA</Text>

            <View style={styles.cardMain}>
              {!online ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="KM de Entrada"
                    placeholderTextColor="#555"
                    keyboardType="numeric"
                    value={hodometro}
                    onChangeText={setHodometro}
                  />
                  <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                    {image ? (
                      <Image source={{ uri: image }} style={styles.preview} />
                    ) : (
                      <MaterialCommunityIcons name="camera-plus" size={35} color="#FFD700" />
                    )}
                    <Text style={styles.buttonText}>{image ? 'FOTO CAPTURADA ✅' : 'FOTO DO HODÔMETRO'}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.btnStart} onPress={() => registrarEvento('INICIO')} disabled={loading}>
                    {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>ABRIR TURNO</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.timerContainer}>
                    <Text style={styles.timerValue}>{timer}</Text>
                    <Text style={styles.timerLabel}>TEMPO DE JORNADA</Text>
                  </View>
                  
                  <TextInput
                    style={styles.input}
                    placeholder="KM de Saída"
                    placeholderTextColor="#555"
                    keyboardType="numeric"
                    value={hodometro}
                    onChangeText={setHodometro}
                  />

                  <TouchableOpacity style={styles.btnEnd} onPress={() => registrarEvento('FIM')} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextWhite}>ENCERRAR TURNO</Text>}
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={styles.subtitle}>ÚLTIMOS REGISTROS</Text>
          </>
        }
        contentContainerStyle={{ padding: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { color: '#FFD700', fontSize: 20, fontWeight: '900', textAlign: 'center', marginVertical: 25 },
  cardMain: { backgroundColor: '#0D0D0D', padding: 20, borderRadius: 25, borderWidth: 1, borderColor: '#1A1A1A', elevation: 5 },
  input: { backgroundColor: '#000', color: '#fff', padding: 20, borderRadius: 15, fontSize: 24, textAlign: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#333', fontWeight: 'bold' },
  photoButton: { height: 140, backgroundColor: '#000', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: '#444', overflow: 'hidden' },
  preview: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  buttonText: { color: '#FFD700', fontSize: 11, marginTop: 10, fontWeight: 'bold' },
  btnStart: { backgroundColor: '#FFD700', padding: 22, borderRadius: 15, alignItems: 'center' },
  btnEnd: { backgroundColor: '#FF3B30', padding: 22, borderRadius: 15, alignItems: 'center' },
  btnText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  btnTextWhite: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  timerContainer: { alignItems: 'center', marginBottom: 25 },
  timerLabel: { color: '#444', fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  timerValue: { color: '#fff', fontSize: 50, fontWeight: 'bold' },
  subtitle: { color: '#FFD700', fontSize: 14, fontWeight: 'bold', marginTop: 35, marginBottom: 15 },
  historyCard: { backgroundColor: '#0D0D0D', flexDirection: 'row', padding: 18, borderRadius: 15, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#1A1A1A' },
  statusTag: { width: 5, height: 40, marginRight: 15, borderRadius: 3 },
  historyText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  historySub: { color: '#666', fontSize: 10, marginTop: 3 },
  historyKm: { color: '#FFD700', fontSize: 20, fontWeight: 'bold' }
});