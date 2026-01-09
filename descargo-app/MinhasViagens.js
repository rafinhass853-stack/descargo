import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  SafeAreaView, StatusBar, Linking, TouchableOpacity, Alert, Image, Modal
} from 'react-native';
import { collection, query, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// MinhasViagens.js - ATUALIZADO
export default function MinhasViagens({ auth, db }) {
  const [loading, setLoading] = useState(true);
  const [viagens, setViagens] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('ativas');
  const [uploading, setUploading] = useState(false);
  const [modalImagem, setModalImagem] = useState(null);

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setLoading(false);
      return;
    }

    const motoristaUid = auth.currentUser.uid;
    console.log("🔍 Buscando viagens para motorista UID:", motoristaUid);
    
    // Buscar viagens onde motoristaUid corresponde ao usuário logado
    const q = query(
      collection(db, "viagens_ativas"),
      where("motoristaUid", "==", motoristaUid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("📥 Viagens recebidas:", snapshot.size);
      const lista = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log("Viagem encontrada:", data.motoristaNome, "- Status:", data.statusOperacional);
        lista.push({ id: doc.id, ...data });
      });
      
      // Ordenar por data (mais recente primeiro)
      lista.sort((a, b) => {
        const dateA = a.criadoEm?.toDate?.() || new Date(0);
        const dateB = b.criadoEm?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setViagens(lista);
      setLoading(false);
    }, (error) => {
      console.error("❌ Erro ao buscar viagens:", error);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  // Restante do código permanece igual...

  // Filtragem das viagens conforme a aba selecionada
  const viagensExibidas = viagens.filter(v => {
    if (abaAtiva === 'ativas') return !v.urlCanhoto; // Sem canhoto = Ativa
    return !!v.urlCanhoto; // Com canhoto = Finalizada/Histórico
  });

  const enviarCanhoto = async (viagemId) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Erro", "Precisamos de permissão para a câmera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.5 });

    if (!result.canceled) {
      setUploading(true);
      try {
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const storage = getStorage();
        const fileRef = ref(storage, `canhotos/${viagemId}.jpg`);
        
        await uploadBytes(fileRef, blob);
        const photoUrl = await getDownloadURL(fileRef);

        await updateDoc(doc(db, "viagens_ativas", viagemId), {
          urlCanhoto: photoUrl,
          statusOperacional: "FINALIZADA",
          dataFinalizacao: new Date().toISOString()
        });

        Alert.alert("Sucesso", "Viagem finalizada com sucesso!");
      } catch (error) {
        Alert.alert("Erro", "Falha no envio.");
      } finally {
        setUploading(false);
      }
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: item.urlCanhoto ? '#2ecc71' : '#FFD700' }]}>
          <Text style={styles.statusText}>{item.statusOperacional}</Text>
        </View>
        <Text style={styles.dtLabel}>DT: {item.dt}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CLIENTE</Text>
        <Text style={styles.mainInfo}>{item.clienteEntrega}</Text>
        <Text style={styles.subInfo}>{item.destinoCidade}</Text>
      </View>

      <View style={styles.actionArea}>
        {item.urlCanhoto ? (
          <TouchableOpacity 
            style={styles.btnVisualizar} 
            onPress={() => setModalImagem(item.urlCanhoto)}
          >
            <MaterialCommunityIcons name="image-search" size={20} color="#FFD700" />
            <Text style={styles.btnVisualizarText}>VER CANHOTO ENVIADO</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.btnCanhoto} 
            onPress={() => enviarCanhoto(item.id)}
            disabled={uploading}
          >
            {uploading ? <ActivityIndicator color="#000" /> : (
              <>
                <MaterialCommunityIcons name="camera" size={20} color="#000" />
                <Text style={styles.btnCanhotoText}>ENTREGAR CANHOTOS</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* HEADER E ABAS */}
      <View style={styles.header}>
        <Text style={styles.title}>MINHAS VIAGENS</Text>
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tab, abaAtiva === 'ativas' && styles.tabAtiva]} 
            onPress={() => setAbaAtiva('ativas')}
          >
            <Text style={[styles.tabText, abaAtiva === 'ativas' && styles.tabTextAtivo]}>ATIVAS</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, abaAtiva === 'historico' && styles.tabAtiva]} 
            onPress={() => setAbaAtiva('historico')}
          >
            <Text style={[styles.tabText, abaAtiva === 'historico' && styles.tabTextAtivo]}>HISTÓRICO</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={viagensExibidas}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma viagem encontrada.</Text>}
        />
      )}

      {/* MODAL PARA VER A FOTO AMPLIADA */}
      <Modal visible={!!modalImagem} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setModalImagem(null)}>
            <MaterialCommunityIcons name="close-circle" size={40} color="#FFF" />
          </TouchableOpacity>
          {modalImagem && <Image source={{ uri: modalImagem }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { backgroundColor: '#050505', borderBottomWidth: 1, borderBottomColor: '#111' },
  title: { color: '#FFF', fontSize: 20, fontWeight: '900', padding: 20, textAlign: 'center' },
  tabBar: { flexDirection: 'row', height: 50 },
  tab: { flex: 1, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabAtiva: { borderBottomColor: '#FFD700' },
  tabText: { color: '#444', fontWeight: 'bold' },
  tabTextAtivo: { color: '#FFD700' },
  card: { backgroundColor: '#0A0A0A', borderRadius: 15, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#1A1A1A' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusText: { color: '#000', fontSize: 10, fontWeight: '900' },
  dtLabel: { color: '#FFF', fontWeight: 'bold' },
  mainInfo: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  subInfo: { color: '#888', fontSize: 13 },
  actionArea: { marginTop: 15, borderTopWidth: 1, borderTopColor: '#111', paddingTop: 15 },
  btnCanhoto: { backgroundColor: '#FFD700', flexDirection: 'row', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 10 },
  btnCanhotoText: { color: '#000', fontWeight: '900' },
  btnVisualizar: { borderWidth: 1, borderColor: '#FFD700', flexDirection: 'row', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 10 },
  btnVisualizarText: { color: '#FFD700', fontWeight: 'bold' },
  empty: { color: '#333', textAlign: 'center', marginTop: 50 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullImage: { width: '95%', height: '80%' }
});