import React, { useState, useEffect } from 'react';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, doc, updateDoc, deleteDoc, getDocs, where 
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Truck, Plus, Trash2, Box, Edit3, 
  CheckCircle, UserPlus
} from 'lucide-react';

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
  const [motoristas, setMotoristas] = useState([]); 
  const [editandoId, setEditandoId] = useState(null);
  const [novoVeiculo, setNovoVeiculo] = useState({
    placa: '',
    tipo: 'Truck',
    status: 'DISPONÍVEL',
    motorista_id: '',
    motorista_nome: 'SEM MOTORISTA'
  });

  // Função para formatar a placa automaticamente
  const formatarPlaca = (valor) => {
    const v = valor.toUpperCase().replace(/[^A-Z0-9]/g, ""); // Remove tudo que não é letra ou número
    if (v.length <= 3) return v;
    return `${v.slice(0, 3)}-${v.slice(3, 7)}`; // Adiciona o hífen após o 3º caractere
  };

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

    return () => {
      unsubscribeV();
      unsubscribeM();
    };
  }, []);

  const salvarVeiculo = async (e) => {
    e.preventDefault();
    if (novoVeiculo.placa.length < 8) {
      alert("Placa inválida! Use o formato ABC-1234 ou ABC-1D23.");
      return;
    }

    try {
      // --- VERIFICAÇÃO DE DUPLICIDADE ---
      // Só verifica se não for uma edição ou se a placa mudou
      const q = query(collection(db, "cadastro_veiculos"), where("placa", "==", novoVeiculo.placa));
      const querySnapshot = await getDocs(q);
      
      const existeDuplicata = querySnapshot.docs.some(doc => doc.id !== editandoId);

      if (existeDuplicata) {
        alert("Erro: Já existe um veículo cadastrado com esta placa!");
        return;
      }

      if (editandoId) {
        await updateDoc(doc(db, "cadastro_veiculos", editandoId), novoVeiculo);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "cadastro_veiculos"), novoVeiculo);
      }

      setNovoVeiculo({ 
        placa: '', 
        tipo: 'Truck', 
        status: 'DISPONÍVEL',
        motorista_id: '',
        motorista_nome: 'SEM MOTORISTA'
      });
    } catch (e) {
      console.error("Erro:", e);
      alert("Erro ao salvar veículo.");
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

  const handleSelectMotorista = (e) => {
    const id = e.target.value;
    if (!id) {
      setNovoVeiculo({ ...novoVeiculo, motorista_id: '', motorista_nome: 'SEM MOTORISTA' });
    } else {
      const mot = motoristas.find(m => m.id === id);
      setNovoVeiculo({ 
        ...novoVeiculo, 
        motorista_id: id, 
        motorista_nome: mot.nome 
      });
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.titulo}>Gestão de Veículos (Cavalos)</h2>

      {/* Formulário de Cadastro */}
      <form onSubmit={salvarVeiculo} style={styles.form}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Placa</label>
          <input 
            style={styles.input}
            placeholder="ABC-1234" 
            maxLength={8}
            value={novoVeiculo.placa} 
            onChange={e => setNovoVeiculo({...novoVeiculo, placa: formatarPlaca(e.target.value)})} 
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Tipo</label>
          <select 
            style={styles.input} 
            value={novoVeiculo.tipo} 
            onChange={e => setNovoVeiculo({...novoVeiculo, tipo: e.target.value})}
          >
            <option value="Toco">Toco</option>
            <option value="Trucado">Trucado</option>
            <option value="Truck">Truck</option>
            <option value="Carreta">Carreta/Cavalo</option>
          </select>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Associar Motorista</label>
          <select 
            style={{...styles.input, color: novoVeiculo.motorista_id ? '#FFD700' : '#888'}} 
            value={novoVeiculo.motorista_id} 
            onChange={handleSelectMotorista}
          >
            <option value="">-- Sem Motorista --</option>
            {motoristas.map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{...styles.btnAdicionar, backgroundColor: editandoId ? '#2ecc71' : '#FFD700'}}>
                {editandoId ? <CheckCircle size={20} /> : <Plus size={20} />} 
                {editandoId ? 'Atualizar' : 'Cadastrar'}
            </button>
            {editandoId && (
                <button 
                  type="button" 
                  onClick={() => {
                    setEditandoId(null); 
                    setNovoVeiculo({
                      placa: '', tipo: 'Truck', status: 'DISPONÍVEL', motorista_id: '', motorista_nome: 'SEM MOTORISTA'
                    })
                  }} 
                  style={{...styles.btnAdicionar, backgroundColor: '#e74c3c'}}
                >
                    Cancelar
                </button>
            )}
        </div>
      </form>

      {/* Lista de Veículos */}
      <div style={styles.grid}>
        {veiculos.map((v) => (
          <div key={v.id} style={{...styles.card, borderLeft: v.motorista_id ? '4px solid #3498db' : '4px solid #FFD700'}}>
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

                <div style={styles.motoristaBox}>
                  <UserPlus size={14} color={v.motorista_id ? "#3498db" : "#666"} />
                  <div style={{display: 'flex', flexDirection: 'column'}}>
                    <span style={{fontSize: '10px', color: '#666', fontWeight: 'bold'}}>MOTORISTA:</span>
                    <span style={{fontSize: '13px', color: v.motorista_id ? '#3498db' : '#888', fontWeight: 'bold'}}>
                      {v.motorista_nome || 'SEM MOTORISTA'}
                    </span>
                  </div>
                </div>

                <p style={styles.info}><Box size={14} /> <strong>Tipo:</strong> {v.tipo}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ... (seus estilos permanecem os mesmos)
const styles = {
  container: { padding: '10px', color: '#FFF' },
  titulo: { color: '#FFD700', fontSize: '22px', marginBottom: '20px' },
  form: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
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
    border: '1px solid #222'
  },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' },
  placaText: { fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' },
  btnIconEdit: { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' },
  btnIconDelete: { background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' },
  cardBody: { display: 'flex', flexDirection: 'column', gap: '10px' },
  motoristaBox: {
    backgroundColor: '#0a0a0a',
    padding: '10px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    border: '1px dashed #333',
    marginBottom: '5px'
  },
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