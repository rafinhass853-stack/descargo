import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  and
} from 'firebase/firestore';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

export default function Rotas({ auth, db, setCargaAtiva, setActiveTab }) {
  const [loading, setLoading] = useState(true);
  const [rotasDisponiveis, setRotasDisponiveis] = useState([]);

  useEffect(() => {
    if (!auth?.currentUser) {
      setLoading(false);
      return;
    }

    // Mantemos os status que o motorista precisa ver
    const q = query(
      collection(db, "ordens_servico"), 
      and(
        where("motoristaId", "==", auth.currentUser.uid),
        where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO"])
      )
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      
      // Ordenação: ACEITO sempre fica no topo para fácil acesso
      lista.sort((a, b) => (a.status === 'ACEITO' ? -1 : 1));
      
      setRotasDisponiveis(lista);
      setLoading(false);
    }, (error) => {
      console.error("Erro Firestore Rotas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth?.currentUser]);

  const handleAceitarRota = async (rota) => {
    // Se já estiver aceita, só troca a aba
    if (rota.status === "ACEITO") {
      setCargaAtiva(rota);
      setActiveTab('painel');
      return;
    }

    try {
      setLoading(true);
      const docRef = doc(db, "ordens_servico", rota.id);
      
      // Atualização no Firestore
      await updateDoc(docRef, {
        status: "ACEITO",
        dataAceite: serverTimestamp()
      });
      
      // Criamos o objeto atualizado para o App.js processar a rota imediatamente
      const rotaAtualizada = { ...rota, status: "ACEITO" };
      
      setCargaAtiva(rotaAtualizada);
      setActiveTab('painel');
      
      // Feedback rápido
      Alert.alert("Sucesso", "Viagem iniciada!");
    } catch (error) {
      console.error("Erro ao aceitar:", error);
      Alert.alert("Erro", "Não foi possível iniciar a rota.");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const isAceito = item.status === "ACEITO";

    return (
      <View style={[styles.card, isAceito && styles.cardAceito]}>
        <View style={styles.cardHeader}>
          <View style={[styles.badge, isAceito && { backgroundColor: '#2ecc71' }]}>
            <Text style={[styles.badgeText, isAceito && { color: '#fff' }]}>
              {isAceito ? "EM ANDAMENTO" : (item.tipoViagem || 'CARGA')}
            </Text>
          </View>
          <Text style={styles.dtText}>DT: {item.dt || 'N/A'}</Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="store-24-hour" size={20} color="#FFD700" />
          <View style={styles.infoTextGroup}>
            <Text style={styles.label}>ORIGEM</Text>
            <Text style={styles.value} numberOfLines={1}>
              {item.origemCliente || item.cliente_origem || 'Não informada'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <MaterialIcons name="location-on" size={20} color="#FF4D4D" />
          <View style={styles.infoTextGroup}>
            <Text style={styles.label}>DESTINO FINAL</Text>
            <Text style={styles.value} numberOfLines={1}>
              {item.destinoCliente || item.cliente_destino}
            </Text>
            <Text style={styles.subValue}>
              {item.destinoCidade || item.cidade_destino}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.btnAceitar, isAceito && styles.btnAtivo]} 
          onPress={() => handleAceitarRota(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>
            {isAceito ? "VER NO MAPA" : "ACEITAR E INICIAR ROTA"}
          </Text>
          <MaterialCommunityIcons 
            name={isAceito ? "map-search" : "arrow-right"} 
            size={20} 
            color="#000" 
          />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && rotasDisponiveis.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFD700" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerTitleRow}>
        <Text style={styles.title}>Minhas Rotas</Text>
        {rotasDisponiveis.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{rotasDisponiveis.length}</Text>
          </View>
        )}
      </View>
      
      {rotasDisponiveis.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="tray-blank" size={60} color="#222" />
          <Text style={styles.emptyText}>Nenhuma rota programada.</Text>
        </View>
      ) : (
        <FlatList
          data={rotasDisponiveis}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20, paddingTop: 10 },
  centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFF' },
  countBadge: { backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  countText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
  list: { paddingBottom: 120 },
  card: { 
    backgroundColor: '#0A0A0A', 
    borderRadius: 18, 
    padding: 18, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#1A1A1A',
    elevation: 3
  },
  cardAceito: { borderColor: '#FFD70044', backgroundColor: '#0F0F05' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  badge: { backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#000', fontSize: 10, fontWeight: '900' },
  dtText: { color: '#555', fontSize: 12, fontWeight: 'bold' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 6 },
  infoTextGroup: { marginLeft: 12, flex: 1 },
  label: { color: '#333', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  value: { color: '#EEE', fontSize: 15, fontWeight: 'bold' },
  subValue: { color: '#777', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#1A1A1A', marginVertical: 10, marginLeft: 32 },
  btnAceitar: { 
    backgroundColor: '#FFD700', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 12, 
    marginTop: 15,
    gap: 10
  },
  btnAtivo: { backgroundColor: '#FFF' },
  btnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#444', marginTop: 15, textAlign: 'center', fontSize: 14, fontWeight: 'bold' }
});