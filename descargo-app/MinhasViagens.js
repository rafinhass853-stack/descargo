// MinhasViagens.js - VERSÃO COMPLETA E CORRIGIDA
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  SafeAreaView, StatusBar, TouchableOpacity, Alert, Image, Modal
} from 'react-native';
import { collection, query, onSnapshot, doc, updateDoc, where, getDocs } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function MinhasViagens({ auth, db }) {
  const [loading, setLoading] = useState(true);
  const [viagens, setViagens] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('ativas');
  const [uploading, setUploading] = useState(false);
  const [modalImagem, setModalImagem] = useState(null);
  const [colecoesAtivas, setColecoesAtivas] = useState([]);

  useEffect(() => {
    buscarViagensDeTodasColecoes();
  }, [auth.currentUser]);

  const buscarViagensDeTodasColecoes = async () => {
    if (!auth.currentUser) {
      console.log("⚠️ Usuário não autenticado");
      setLoading(false);
      return;
    }

    const user = auth.currentUser;
    console.log("🔍 Buscando viagens para usuário:", {
      uid: user.uid,
      email: user.email
    });

    try {
      let todasViagens = [];
      const colecoesParaBuscar = ['viagens_ativas', 'ordens_servico'];
      
      for (const colecao of colecoesParaBuscar) {
        try {
          console.log(`🔎 Buscando na coleção: ${colecao}`);
          
          // Tentar por UID (campo pode variar)
          const camposUid = ['motoristaUid', 'motoristaiUid', 'motoristaId', 'uid'];
          
          for (const campo of camposUid) {
            const q = query(
              collection(db, colecao),
              where(campo, "==", user.uid)
            );
            
            const snapshot = await getDocs(q);
            console.log(`  Por ${campo}: ${snapshot.size} documentos`);
            
            snapshot.forEach(doc => {
              const data = doc.data();
              // Adicionar origem da coleção
              const viagemComOrigem = { 
                id: doc.id, 
                ...data, 
                origemColecao: colecao,
                // Garantir que temos os campos padrão
                motoristaUid: data.motoristaUid || data.motoristaiUid || data.motoristaId || user.uid,
                motoristaNome: data.motoristaNome || data.nome || 'Motorista',
                clienteEntrega: data.clienteEntrega || data.destinoCliente || 'Cliente não informado',
                statusOperacional: data.statusOperacional || data.status || 'PROGRAMADO'
              };
              
              // Evitar duplicatas
              if (!todasViagens.find(v => v.id === doc.id && v.origemColecao === colecao)) {
                todasViagens.push(viagemComOrigem);
              }
            });
          }
          
          // Tentar por email também
          if (user.email) {
            const qEmail = query(
              collection(db, colecao),
              where("motoristaEmail", "==", user.email)
            );
            
            const snapshotEmail = await getDocs(qEmail);
            console.log(`  Por email: ${snapshotEmail.size} documentos`);
            
            snapshotEmail.forEach(doc => {
              const data = doc.data();
              const viagemComOrigem = { 
                id: doc.id, 
                ...data, 
                origemColecao: colecao 
              };
              
              if (!todasViagens.find(v => v.id === doc.id && v.origemColecao === colecao)) {
                todasViagens.push(viagemComOrigem);
              }
            });
          }
          
        } catch (error) {
          console.log(`❌ Erro na coleção ${colecao}:`, error.message);
        }
      }

      console.log(`📊 Total encontrado: ${todasViagens.length} viagens`);
      
      // Log detalhado
      todasViagens.forEach((v, i) => {
        console.log(`Viagem ${i + 1}:`);
        console.log(`  Coleção: ${v.origemColecao}`);
        console.log(`  ID: ${v.id}`);
        console.log(`  Motorista: ${v.motoristaNome}`);
        console.log(`  UID no doc: ${v.motoristaUid || v.motoristaiUid}`);
        console.log(`  Email: ${v.motoristaEmail}`);
        console.log(`  Cliente: ${v.clienteEntrega}`);
        console.log(`  Status: ${v.statusOperacional}`);
        console.log(`  DT: ${v.dt}`);
        console.log("---");
      });

      // Ordenar por data
      todasViagens.sort((a, b) => {
        const dateA = a.criadoEm?.toDate?.() || new Date(0);
        const dateB = b.criadoEm?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setViagens(todasViagens);
      setColecoesAtivas([...new Set(todasViagens.map(v => v.origemColecao))]);
      
      // Se não encontrou nada, fazer busca completa para debug
      if (todasViagens.length === 0) {
        await buscarTodasViagensParaDebug();
      }

    } catch (error) {
      console.error("❌ Erro geral:", error);
      Alert.alert("Erro", "Falha ao carregar viagens");
    } finally {
      setLoading(false);
    }
  };

  const buscarTodasViagensParaDebug = async () => {
    try {
      const colecoes = ['viagens_ativas', 'ordens_servico'];
      
      for (const colecao of colecoes) {
        console.log(`\n=== DEBUG: ${colecao.toUpperCase()} ===`);
        const qAll = query(collection(db, colecao));
        const snapshot = await getDocs(qAll);
        
        console.log(`Total na ${colecao}: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
          const data = doc.data();
          console.log(`📄 ${doc.id.substring(0, 20)}...`);
          console.log(`   Motorista: ${data.motoristaNome || data.nome || 'N/D'}`);
          console.log(`   UID: ${data.motoristaUid || data.motoristaiUid || data.motoristaId || 'N/D'}`);
          console.log(`   Email: ${data.motoristaEmail || 'N/D'}`);
          console.log(`   Status: ${data.statusOperacional || data.status || 'N/D'}`);
          console.log(`   Cliente: ${data.clienteEntrega || data.destinoCliente || 'N/D'}`);
          console.log("---");
        });
      }
      
    } catch (error) {
      console.error("Erro no debug:", error);
    }
  };

  const enviarCanhoto = async (viagemId, colecaoOrigem = 'viagens_ativas') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Erro", "Precisamos de permissão para a câmera.");
      return;
    }

    Alert.alert(
      "Enviar Canhoto",
      "Escolha a origem da foto:",
      [
        { text: "Câmera", onPress: () => tirarFoto(viagemId, colecaoOrigem, true) },
        { text: "Galeria", onPress: () => tirarFoto(viagemId, colecaoOrigem, false) },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const tirarFoto = async (viagemId, colecaoOrigem, usarCamera) => {
    const options = {
      allowsEditing: true,
      quality: 0.7,
    };

    const result = usarCamera 
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      setUploading(true);
      try {
        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();
        const storage = getStorage();
        const fileRef = ref(storage, `canhotos/${viagemId}_${Date.now()}.jpg`);
        
        await uploadBytes(fileRef, blob);
        const photoUrl = await getDownloadURL(fileRef);

        // Atualizar na coleção de origem
        await updateDoc(doc(db, colecaoOrigem, viagemId), {
          urlCanhoto: photoUrl,
          statusOperacional: "FINALIZADA",
          dataFinalizacao: new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        });

        // Se também existe na outra coleção, atualizar lá também
        const outraColecao = colecaoOrigem === 'viagens_ativas' ? 'ordens_servico' : 'viagens_ativas';
        try {
          await updateDoc(doc(db, outraColecao, viagemId), {
            urlCanhoto: photoUrl,
            statusOperacional: "FINALIZADA",
            dataFinalizacao: new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
          });
        } catch (e) {
          console.log("Não encontrado na outra coleção:", e.message);
        }

        Alert.alert("✅ Sucesso", "Viagem finalizada com sucesso!");
        
        // Atualizar lista local
        setViagens(prev => prev.map(v => 
          v.id === viagemId && v.origemColecao === colecaoOrigem
            ? { ...v, urlCanhoto: photoUrl, statusOperacional: "FINALIZADA" }
            : v
        ));

      } catch (error) {
        console.error("Erro:", error);
        Alert.alert("❌ Erro", "Falha no envio");
      } finally {
        setUploading(false);
      }
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusBadge, { 
            backgroundColor: item.urlCanhoto ? '#2ecc71' : 
                           item.statusOperacional === 'PROGRAMADO' ? '#3498db' : 
                           '#FFD700' 
          }]}>
            <Text style={styles.statusText}>
              {item.statusOperacional || 'PROGRAMADO'}
            </Text>
          </View>
          <Text style={styles.colecaoBadge}>
            {item.origemColecao === 'viagens_ativas' ? 'APP' : 'ORDEM'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.dtLabel}>DT: {item.dt || 'N/D'}</Text>
          {item.dataColeta && (
            <Text style={styles.dataLabel}>
              {formatarData(item.dataColeta)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>COLETA</Text>
          <Text style={styles.infoText}>{item.clienteColeta || 'Não informado'}</Text>
          <Text style={styles.infoSub}>{item.origemCidade || ''}</Text>
        </View>
        
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ENTREGA</Text>
          <Text style={styles.infoTextMain}>{item.clienteEntrega || 'Não informado'}</Text>
          <Text style={styles.infoSub}>{item.destinoCidade || ''}</Text>
        </View>
      </View>

      {item.observacao ? (
        <View style={styles.obsSection}>
          <Text style={styles.obsTitle}>OBSERVAÇÃO</Text>
          <Text style={styles.obsText}>{item.observacao}</Text>
        </View>
      ) : null}

      <View style={styles.actionArea}>
        {item.urlCanhoto ? (
          <TouchableOpacity 
            style={styles.btnVisualizar} 
            onPress={() => setModalImagem(item.urlCanhoto)}
          >
            <MaterialCommunityIcons name="image-search" size={20} color="#FFD700" />
            <Text style={styles.btnVisualizarText}>VER CANHOTO</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.btnCanhoto} 
            onPress={() => enviarCanhoto(item.id, item.origemColecao)}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <MaterialCommunityIcons name="camera" size={20} color="#000" />
                <Text style={styles.btnCanhotoText}>ENTREGAR CANHOTO</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const formatarData = (dataString) => {
    try {
      const data = new Date(dataString);
      return data.toLocaleDateString('pt-BR');
    } catch {
      return dataString;
    }
  };

  // Filtragem
  const viagensExibidas = viagens.filter(v => {
    if (abaAtiva === 'ativas') return !v.urlCanhoto;
    return !!v.urlCanhoto;
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>MINHAS VIAGENS</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => {
            setLoading(true);
            buscarViagensDeTodasColecoes();
          }}
        >
          <MaterialCommunityIcons name="refresh" size={22} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* INFO DAS COLEÇÕES ENCONTRADAS */}
      {colecoesAtivas.length > 0 && (
        <View style={styles.colecoesInfo}>
          <Text style={styles.colecoesText}>
            Buscando em: {colecoesAtivas.join(', ')}
          </Text>
        </View>
      )}

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, abaAtiva === 'ativas' && styles.tabAtiva]} 
          onPress={() => setAbaAtiva('ativas')}
        >
          <Text style={[styles.tabText, abaAtiva === 'ativas' && styles.tabTextAtivo]}>
            ATIVAS ({viagens.filter(v => !v.urlCanhoto).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, abaAtiva === 'historico' && styles.tabAtiva]} 
          onPress={() => setAbaAtiva('historico')}
        >
          <Text style={[styles.tabText, abaAtiva === 'historico' && styles.tabTextAtivo]}>
            FINALIZADAS ({viagens.filter(v => !!v.urlCanhoto).length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Buscando viagens...</Text>
        </View>
      ) : viagensExibidas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="truck-off" size={70} color="#333" />
          <Text style={styles.emptyTitle}>Nenhuma viagem encontrada</Text>
          <Text style={styles.emptyText}>
            Verifique se o UID do app ({auth.currentUser?.uid?.substring(0, 20)}...)
            corresponde ao salvo no painel.
          </Text>
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={buscarTodasViagensParaDebug}
          >
            <Text style={styles.debugButtonText}>DEBUG NO CONSOLE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={viagensExibidas}
          keyExtractor={item => `${item.id}_${item.origemColecao}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
          refreshing={loading}
          onRefresh={buscarViagensDeTodasColecoes}
        />
      )}

      <Modal visible={!!modalImagem} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalClose} 
            onPress={() => setModalImagem(null)}
          >
            <MaterialCommunityIcons name="close-circle" size={40} color="#FFF" />
          </TouchableOpacity>
          {modalImagem && (
            <Image source={{ uri: modalImagem }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ESTILOS COMPLETOS
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#000' 
  },
  
  header: { 
    backgroundColor: '#050505', 
    borderBottomWidth: 1, 
    borderBottomColor: '#111',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15
  },
  
  title: { 
    color: '#FFF', 
    fontSize: 20, 
    fontWeight: '900' 
  },
  
  refreshButton: { 
    padding: 5 
  },
  
  colecoesInfo: {
    backgroundColor: '#111',
    padding: 8,
    alignItems: 'center',
  },
  
  colecoesText: {
    color: '#888',
    fontSize: 11,
  },
  
  tabBar: { 
    flexDirection: 'row', 
    height: 50, 
    backgroundColor: '#050505' 
  },
  
  tab: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  tabAtiva: { 
    borderBottomWidth: 3, 
    borderBottomColor: '#FFD700' 
  },
  
  tabText: { 
    color: '#666', 
    fontWeight: 'bold', 
    fontSize: 12 
  },
  
  tabTextAtivo: { 
    color: '#FFD700' 
  },
  
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  loadingText: { 
    color: '#FFD700', 
    marginTop: 15, 
    fontSize: 14 
  },
  
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40 
  },
  
  emptyTitle: { 
    color: '#FFF', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginTop: 20, 
    marginBottom: 10 
  },
  
  emptyText: { 
    color: '#666', 
    textAlign: 'center', 
    marginBottom: 30,
    fontSize: 12
  },
  
  card: { 
    backgroundColor: '#0A0A0A', 
    borderRadius: 15, 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: '#1A1A1A' 
  },
  
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    marginBottom: 15 
  },
  
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  headerRight: {
    alignItems: 'flex-end',
  },
  
  statusBadge: { 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 4 
  },
  
  statusText: { 
    color: '#000', 
    fontSize: 11, 
    fontWeight: '900' 
  },
  
  colecaoBadge: {
    backgroundColor: '#333',
    color: '#888',
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
  },
  
  dtLabel: { 
    color: '#FFF', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  
  dataLabel: { 
    color: '#888', 
    fontSize: 11, 
    marginTop: 2 
  },
  
  infoGrid: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  
  infoBox: {
    flex: 1,
  },
  
  infoTitle: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  infoText: {
    color: '#DDD',
    fontSize: 14,
    fontWeight: '600',
  },
  
  infoTextMain: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  infoSub: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  
  obsSection: { 
    backgroundColor: '#111', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 15 
  },
  
  obsTitle: { 
    color: '#FFD700', 
    fontSize: 11, 
    fontWeight: 'bold', 
    marginBottom: 5 
  },
  
  obsText: { 
    color: '#CCC', 
    fontSize: 12 
  },
  
  actionArea: { 
    marginTop: 15, 
    borderTopWidth: 1, 
    borderTopColor: '#1A1A1A', 
    paddingTop: 15 
  },
  
  btnCanhoto: { 
    backgroundColor: '#FFD700', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 15, 
    borderRadius: 8, 
    gap: 10 
  },
  
  btnCanhotoText: { 
    color: '#000', 
    fontWeight: '900', 
    fontSize: 14 
  },
  
  btnVisualizar: { 
    borderWidth: 1, 
    borderColor: '#FFD700', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 15, 
    borderRadius: 8, 
    gap: 10 
  },
  
  btnVisualizarText: { 
    color: '#FFD700', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  
  debugButton: {
    backgroundColor: '#222',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 20,
  },
  
  debugButtonText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  modalContainer: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  
  modalClose: { 
    position: 'absolute', 
    top: 50, 
    right: 20, 
    zIndex: 10 
  },
  
  fullImage: { 
    width: '95%', 
    height: '80%' 
  }
});