import React, { useState, useEffect } from 'react';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, doc, updateDoc, deleteDoc, getDocs, where 
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Truck, Plus, Trash2, Box, Edit3, 
  CheckCircle, UserPlus, UserMinus, Filter, List
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE (MANTIDA) ---
const firebaseConfig = {
  apiKey: "AIzaSyAAANwxEopbLtRmWqF2b9mrOXbOwUf5x8M",
  authDomain: "descargo-4090a.firebaseapp.com",
  projectId: "descargo-4090a",
  storageBucket: "descargo-4090a.firebasestorage.app",
  messagingSenderId: "345718597496",
  appId: "1:345718597496:web:97af37f598666e0a3bca8d",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState([]);
  const [motoristas, setMotoristas] = useState([]); 
  const [editandoId, setEditandoId] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [novoVeiculo, setNovoVeiculo] = useState({
    placa: '', tipo: 'Truck', status: 'DISPONÍVEL',
    motorista_id: '', motorista_nome: 'SEM MOTORISTA'
  });

  useEffect(() => {
    const qV = query(collection(db, "cadastro_veiculos"), orderBy("placa", "asc"));
    const unsubscribeV = onSnapshot(qV, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setVeiculos(lista);
    });

    const qM = query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc"));
    const unsubscribeM = onSnapshot(qM, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setMotoristas(lista);
    });

    return () => { unsubscribeV(); unsubscribeM(); };
  }, []);

  // --- CÁLCULO DE TOTAIS ---
  const totalGeral = veiculos.length;
  const totalToco = veiculos.filter(v => v.tipo === 'Toco').length;
  const totalTrucado = veiculos.filter(v => v.tipo === 'Trucado').length;
  const totalTruck = veiculos.filter(v => v.tipo === 'Truck').length;
  const totalCarreta = veiculos.filter(v => v.tipo === 'Carreta/Cavalo').length;

  const veiculosFiltrados = veiculos.filter(v => 
    filtroTipo === 'TODOS' ? true : 
    (filtroTipo === 'CARRETA' ? v.tipo === 'Carreta/Cavalo' : v.tipo.toUpperCase() === filtroTipo)
  );

  const formatarPlaca = (valor) => {
    const v = valor.toUpperCase().replace(/[^A-Z0-9]/g, ""); 
    if (v.length <= 3) return v;
    return `${v.slice(0, 3)}-${v.slice(3, 7)}`;
  };

  const salvarVeiculo = async (e) => {
    e.preventDefault();
    if (novoVeiculo.placa.length < 8) { alert("Placa inválida!"); return; }
    try {
      const q = query(collection(db, "cadastro_veiculos"), where("placa", "==", novoVeiculo.placa));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.docs.some(doc => doc.id !== editandoId)) {
        alert("Erro: Placa já cadastrada!"); return;
      }
      if (editandoId) {
        await updateDoc(doc(db, "cadastro_veiculos", editandoId), novoVeiculo);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "cadastro_veiculos"), novoVeiculo);
      }
      setNovoVeiculo({ placa: '', tipo: 'Truck', status: 'DISPONÍVEL', motorista_id: '', motorista_nome: 'SEM MOTORISTA' });
    } catch (e) { alert("Erro ao salvar."); }
  };

  const desassociarMotorista = async (veiculoId) => {
    if (window.confirm("Remover motorista?")) {
      await updateDoc(doc(db, "cadastro_veiculos", veiculoId), { motorista_id: '', motorista_nome: 'SEM MOTORISTA' });
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.titulo}>Gestão de Veículos (Cavalos)</h2>

      {/* FORMULÁRIO */}
      <form onSubmit={salvarVeiculo} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Placa</label>
          <input style={styles.input} maxLength={8} value={novoVeiculo.placa} onChange={e => setNovoVeiculo({...novoVeiculo, placa: formatarPlaca(e.target.value)})} />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Tipo</label>
          <select style={styles.input} value={novoVeiculo.tipo} onChange={e => setNovoVeiculo({...novoVeiculo, tipo: e.target.value})}>
            <option value="Toco">Toco</option>
            <option value="Trucado">Trucado</option>
            <option value="Truck">Truck</option>
            <option value="Carreta/Cavalo">Carreta/Cavalo</option>
          </select>
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Motorista</label>
          <select style={{...styles.input, color: novoVeiculo.motorista_id ? '#FFD700' : '#888'}} value={novoVeiculo.motorista_id} onChange={e => {
            const mot = motoristas.find(m => m.id === e.target.value);
            setNovoVeiculo({...novoVeiculo, motorista_id: e.target.value, motorista_nome: mot ? mot.nome : 'SEM MOTORISTA'});
          }}>
            <option value="">-- Selecione --</option>
            {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <button type="submit" style={{...styles.btnAdicionar, backgroundColor: editandoId ? '#2ecc71' : '#FFD700'}}>
          {editandoId ? 'Atualizar' : 'Cadastrar'}
        </button>
      </form>

      {/* PAINEL DE TOTAIS */}
      <div style={styles.statsContainer}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>TOTAL GERAL</span>
          <span style={styles.statValue}>{totalGeral}</span>
        </div>
        <div style={{...styles.statCard, borderLeft: '3px solid #e74c3c'}}>
          <span style={styles.statLabel}>TOCO</span>
          <span style={styles.statValue}>{totalToco}</span>
        </div>
        <div style={{...styles.statCard, borderLeft: '3px solid #3498db'}}>
          <span style={styles.statLabel}>TRUCADO</span>
          <span style={styles.statValue}>{totalTrucado}</span>
        </div>
        <div style={{...styles.statCard, borderLeft: '3px solid #2ecc71'}}>
          <span style={styles.statLabel}>TRUCK</span>
          <span style={styles.statValue}>{totalTruck}</span>
        </div>
        <div style={{...styles.statCard, borderLeft: '3px solid #FFD700'}}>
          <span style={styles.statLabel}>CARRETA</span>
          <span style={styles.statValue}>{totalCarreta}</span>
        </div>
      </div>

      {/* FILTROS */}
      <div style={styles.filterBar}>
        <span style={styles.labelFiltro}><Filter size={14}/> FILTRAR:</span>
        {[
          {id: 'TODOS', label: 'TODOS', count: totalGeral},
          {id: 'TOCO', label: 'TOCO', count: totalToco},
          {id: 'TRUCADO', label: 'TRUCADO', count: totalTrucado},
          {id: 'TRUCK', label: 'TRUCK', count: totalTruck},
          {id: 'CARRETA', label: 'CARRETA', count: totalCarreta}
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => setFiltroTipo(item.id)}
            style={{
              ...styles.btnFiltro,
              backgroundColor: filtroTipo === item.id ? '#FFD700' : '#111',
              color: filtroTipo === item.id ? '#000' : '#888'
            }}
          >
            {item.label} ({item.count})
          </button>
        ))}
      </div>

      {/* GRID (Utilizando veiculosFiltrados) */}
      <div style={styles.grid}>
        {veiculosFiltrados.map((v) => (
          <div key={v.id} style={{...styles.card, borderLeft: v.motorista_id ? '4px solid #3498db' : '4px solid #FFD700'}}>
             {/* ... restante do card igual ao anterior ... */}
             <div style={styles.cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Truck size={24} color="#FFD700" />
                <span style={styles.placaText}>{v.placa}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => prepararEdicao(v)} style={styles.btnIconEdit}><Edit3 size={18} /></button>
                <button onClick={() => excluirVeiculo(v.id)} style={styles.btnIconDelete}><Trash2 size={18} /></button>
              </div>
            </div>
            <div style={styles.cardBody}>
                <div style={{...styles.badge, backgroundColor: v.status === 'DISPONÍVEL' ? '#2ecc71' : '#f1c40f'}}>{v.status}</div>
                <div style={styles.motoristaBox}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
                    <UserPlus size={14} color={v.motorista_id ? "#3498db" : "#666"} />
                    <div style={{display: 'flex', flexDirection: 'column'}}>
                      <span style={{fontSize: '10px', color: '#666'}}>MOTORISTA:</span>
                      <span style={{fontSize: '13px', color: v.motorista_id ? '#3498db' : '#888', fontWeight: 'bold'}}>{v.motorista_nome}</span>
                    </div>
                  </div>
                  {v.motorista_id && <button onClick={() => desassociarMotorista(v.id)} style={styles.btnDesassociar}><UserMinus size={16} /></button>}
                </div>
                <p style={styles.info}><Box size={14} /> <strong>Tipo:</strong> {v.tipo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '10px', color: '#FFF', backgroundColor: '#000', minHeight: '100vh' },
  titulo: { color: '#FFD700', fontSize: '20px', marginBottom: '20px', borderLeft: '4px solid #FFD700', paddingLeft: '10px' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #222' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '10px', color: '#666', fontWeight: 'bold' },
  input: { backgroundColor: '#111', border: '1px solid #333', padding: '10px', borderRadius: '6px', color: '#FFF', outline: 'none' },
  btnAdicionar: { backgroundColor: '#FFD700', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '40px', marginTop: 'auto' },
  
  // NOVOS ESTILOS: ESTATÍSTICAS
  statsContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' },
  statCard: { backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '8px', border: '1px solid #222', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  statLabel: { fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '5px' },
  statValue: { fontSize: '20px', fontWeight: 'bold', color: '#FFF' },

  filterBar: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px' },
  labelFiltro: { color: '#666', fontSize: '10px', fontWeight: 'bold', marginRight: '5px' },
  btnFiltro: { padding: '6px 12px', borderRadius: '4px', border: '1px solid #333', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' },
  
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' },
  card: { backgroundColor: '#0a0a0a', borderRadius: '10px', padding: '15px', border: '1px solid #222' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  placaText: { fontSize: '16px', fontWeight: 'bold' },
  btnIconEdit: { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' },
  btnIconDelete: { background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: '8px' },
  motoristaBox: { backgroundColor: '#000', padding: '8px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px dashed #222' },
  btnDesassociar: { background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' },
  info: { margin: 0, fontSize: '12px', color: '#888', display: 'flex', alignItems: 'center', gap: '5px' },
  badge: { alignSelf: 'flex-start', padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#000' }
};