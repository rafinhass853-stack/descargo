import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity,
  Dimensions,
  Platform
} from 'react-native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function MinhasViagens({ auth, db }) {
  const [loading, setLoading] = useState(true);
  const [todasViagens, setTodasViagens] = useState([]);
  const [filtroAtivo, setFiltroAtivo] = useState('TUDO'); // TUDO, HOJE, 7DIAS, 30DIAS

  useEffect(() => {
    if (!auth.currentUser) return;

    // Removido o orderBy para evitar o erro de índice composto
    const q = query(
      collection(db, "ordens_servico"),
      where("motoristaId", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });

      // Ordenação manual via JavaScript (mais seguro sem índice)
      lista.sort((a, b) => {
        const dataA = a.aceitoEm?.seconds || 0;
        const dataB = b.aceitoEm?.seconds || 0;
        return dataB - dataA;
      });

      setTodasViagens(lista);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar histórico:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Lógica de Filtro e Cálculo de Estatísticas
  const dadosFiltrados = useMemo(() => {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    
    const filtradas = todasViagens.filter(v => {
      if (!v.aceitoEm) return filtroAtivo === 'TUDO';
      const dataViagem = v.aceitoEm.toDate().getTime();

      if (filtroAtivo === 'HOJE') return dataViagem >= hoje;
      if (filtroAtivo === '7DIAS') return dataViagem >= (agora - 7 * 24 * 60 * 60 * 1000);
      if (filtroAtivo === '30DIAS') return dataViagem >= (agora - 30 * 24 * 60 * 60 * 1000);
      return true;
    });

    let aceitas = 0;
    let recusadas = 0;
    filtradas.forEach(v => {
      if (v.status === "ACEITO" || v.status === "CONCLUÍDO") aceitas++;
      if (v.status === "RECUSADO") recusadas++;
    });

    const total = aceitas + recusadas;
    const taxa = total > 0 ? ((aceitas / total) * 100).toFixed(1) : 0;

    return { lista: filtradas, aceitas, recusadas, taxa };
  }, [todasViagens, filtroAtivo]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.dtText}>DT: {item.dt || '---'}</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.badgeText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.clienteText}>{item.destinoCliente || item.cliente_destino}</Text>
      <View style={styles.cardFooter}>
        <MaterialCommunityIcons name="calendar-clock" size={14} color="#666" />
        <Text style={styles.dateText}>
          {item.aceitoEm?.toDate().toLocaleString('pt-BR') || 'Aguardando...'}
        </Text>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONCLUÍDO': return '#2ecc71';
      case 'ACEITO': return '#FFD700';
      case 'RECUSADO': return '#ff4d4d';
      default: return '#333';
    }
  };

  const FilterButton = ({ label, id }) => (
    <TouchableOpacity 
      style={[styles.filterBtn, filtroAtivo === id && styles.filterBtnActive]} 
      onPress={() => setFiltroAtivo(id)}
    >
      <Text style={[styles.filterBtnText, filtroAtivo === id && styles.filterBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#FFD700" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Seletor de Filtros */}
      <View style={styles.filterBar}>
        <FilterButton label="Tudo" id="TUDO" />
        <FilterButton label="Hoje" id="HOJE" />
        <FilterButton label="7 Dias" id="7DIAS" />
        <FilterButton label="30 Dias" id="30DIAS" />
      </View>

      {/* Header de Estatísticas Dinâmico */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{dadosFiltrados.aceitas}</Text>
          <Text style={styles.statLabel}>ACEITAS</Text>
        </View>
        <View style={[styles.statBox, styles.statDivider]}>
          <Text style={[styles.statValue, { color: '#FFD700' }]}>{dadosFiltrados.taxa}%</Text>
          <Text style={styles.statLabel}>TAXA ACEITE</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#ff4d4d' }]}>{dadosFiltrados.recusadas}</Text>
          <Text style={styles.statLabel}>RECUSADAS</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        {filtroAtivo === 'TUDO' ? 'HISTÓRICO COMPLETO' : `VIAGENS: ${filtroAtivo}`}
      </Text>

      <FlatList
        data={dadosFiltrados.lista}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-off-outline" size={40} color="#222" />
            <Text style={styles.emptyText}>Nenhuma viagem neste período.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 20 },
  filterBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, marginBottom: 10 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  filterBtnActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  filterBtnText: { color: '#666', fontSize: 11, fontWeight: 'bold' },
  filterBtnTextActive: { color: '#000' },
  
  statsContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#111', 
    borderRadius: 20, 
    padding: 20, 
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#222',
    elevation: 5
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#222' },
  statValue: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#666', fontSize: 10, fontWeight: 'bold', marginTop: 5 },
  
  sectionTitle: { color: '#444', fontSize: 10, fontWeight: '900', marginTop: 25, marginBottom: 15, letterSpacing: 1 },
  listContent: { paddingBottom: 120 },
  
  card: { backgroundColor: '#0A0A0A', borderRadius: 15, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dtText: { color: '#FFD700', fontWeight: 'bold', fontSize: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  badgeText: { color: '#000', fontSize: 9, fontWeight: 'bold' },
  clienteText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText: { color: '#444', fontSize: 11 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#222', textAlign: 'center', marginTop: 10, fontSize: 12 }
});