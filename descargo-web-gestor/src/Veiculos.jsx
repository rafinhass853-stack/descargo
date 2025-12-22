import React, { useState, useEffect } from 'react';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, doc, updateDoc, deleteDoc 
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { Truck, Plus, Trash2, Gauge, Box, Edit3, CheckCircle } from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
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
  const [editandoId, setEditandoId] = useState(null);
  const [novoVeiculo, setNovoVeiculo] = useState({
    placa: '',
    tipo: 'Truck',
    capacidade_tanque: '',
    modelo: '',
    status: 'DISPONÍVEL'
  });

  useEffect(() => {
    const q = query(collection(db, "cadastro_veiculos"), orderBy("placa", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setVeiculos(lista);
    });
    return () => unsubscribe();
  }, []);

  const salvarVeiculo = async (e) => {
    e.preventDefault();
    if (!novoVeiculo.placa || !novoVeiculo.capacidade_tanque) {
      alert("Placa e Capacidade do Tanque são obrigatórios!");
      return;
    }

    try {
      if (editandoId) {
        await updateDoc(doc(db, "cadastro_veiculos", editandoId), novoVeiculo);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "cadastro_veiculos"), novoVeiculo);
      }
      setNovoVeiculo({ placa: '', tipo: 'Truck', capacidade_tanque: '', modelo: '', status: 'DISPONÍVEL' });
    } catch (e) {
      console.error("Erro:", e);
    }
  };

  const prepararEdicao = (v) => {
    setEditandoId(v.id);
    setNovoVeiculo({ ...v });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const excluirVeiculo = async (id) => {
    if (window.confirm("Deseja realmente excluir este veículo?")) {
      await deleteDoc(doc(db, "cadastro_veiculos", id));
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.titulo}>Gestão de Veículos (Cavalos)</h2>

      {/* Formulário de Cadastro (Layout igual ao Carretas) */}
      <form onSubmit={salvarVeiculo} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Placa</label>
          <input 
            style={styles.input}
            placeholder="ABC-1234" 
            value={novoVeiculo.placa} 
            onChange={e => setNovoVeiculo({...novoVeiculo, placa: e.target.value.toUpperCase()})} 
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Tipo</label>
          <select style={styles.input} value={novoVeiculo.tipo} onChange={e => setNovoVeiculo({...novoVeiculo, tipo: e.target.value})}>
            <option value="Toco">Toco</option>
            <option value="Trucado">Trucado</option>
            <option value="Truck">Truck</option>
            <option value="Carreta">Carreta/Cavalo</option>
          </select>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Tanque (Litros)</label>
          <input 
            type="number" 
            style={styles.input} 
            placeholder="Ex: 300" 
            value={novoVeiculo.capacidade_tanque} 
            onChange={e => setNovoVeiculo({...novoVeiculo, capacidade_tanque: e.target.value})} 
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Modelo / Marca</label>
          <input 
            style={styles.input} 
            placeholder="Ex: Volvo FH 540" 
            value={novoVeiculo.modelo} 
            onChange={e => setNovoVeiculo({...novoVeiculo, modelo: e.target.value})} 
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{...styles.btnAdicionar, backgroundColor: editandoId ? '#2ecc71' : '#FFD700'}}>
                {editandoId ? <CheckCircle size={20} /> : <Plus size={20} />} 
                {editandoId ? 'Atualizar' : 'Cadastrar'}
            </button>
            {editandoId && (
                <button type="button" onClick={() => {setEditandoId(null); setNovoVeiculo({placa: '', tipo: 'Truck', capacidade_tanque: '', modelo: '', status: 'DISPONÍVEL'})}} style={{...styles.btnAdicionar, backgroundColor: '#e74c3c'}}>
                    Cancelar
                </button>
            )}
        </div>
      </form>

      {/* Lista de Veículos em Cards */}
      <div style={styles.grid}>
        {veiculos.map((v) => (
          <div key={v.id} style={styles.card}>
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
                <div style={{...styles.badge, backgroundColor: v.status === 'DISPONÍVEL' ? '#2ecc71' : '#f1c40f'}}>
                    {v.status}
                </div>
                <p style={styles.info}><Box size={14} /> <strong>Tipo:</strong> {v.tipo}</p>
                <p style={styles.info}><Gauge size={14} /> <strong>Tanque:</strong> {v.capacidade_tanque} L</p>
                <p style={styles.info}><Truck size={14} /> <strong>Modelo:</strong> {v.modelo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '10px', color: '#FFF' },
  titulo: { color: '#FFD700', fontSize: '22px', marginBottom: '20px' },
  form: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
    gap: '15px', 
    backgroundColor: '#111', 
    padding: '20px', 
    borderRadius: '12px',
    marginBottom: '30px',
    alignItems: 'end',
    border: '1px solid #222'
  },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '11px', color: '#888', fontWeight: 'bold', textTransform: 'uppercase' },
  input: { 
    backgroundColor: '#000', 
    border: '1px solid #333', 
    padding: '12px', 
    borderRadius: '6px', 
    color: '#FFF',
    outline: 'none',
    fontSize: '14px'
  },
  btnAdicionar: { 
    backgroundColor: '#FFD700', 
    color: '#000', 
    border: 'none', 
    padding: '12px', 
    borderRadius: '6px', 
    fontWeight: 'bold', 
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: '45px'
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
  card: { 
    backgroundColor: '#111', 
    borderRadius: '12px', 
    padding: '18px', 
    borderLeft: '4px solid #FFD700',
    border: '1px solid #222'
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' },
  placaText: { fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' },
  btnIconEdit: { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' },
  btnIconDelete: { background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: '10px' },
  info: { margin: 0, fontSize: '14px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' },
  badge: { 
    alignSelf: 'flex-start',
    padding: '4px 10px', 
    borderRadius: '4px', 
    fontSize: '10px', 
    fontWeight: 'bold', 
    color: '#000',
    marginBottom: '5px'
  }
};