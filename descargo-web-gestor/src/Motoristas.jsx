import React, { useState, useEffect } from 'react';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, doc, updateDoc, getDocs, where 
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { 
  User, Phone, MapPin, CreditCard, ShieldCheck, Mail, 
  Key, Edit, Power, Eye, EyeOff, Award, Truck, Container 
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
const auth = getAuth(app);

export default function Motoristas() {
  const [motoristas, setMotoristas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [carretas, setCarretas] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [verSenhas, setVerSenhas] = useState(false);
  const [filtroMopp, setFiltroMopp] = useState('TODOS');

  const [novoMotorista, setNovoMotorista] = useState({
    nome: '', cpf: '', cnh_cat: '', mopp: 'Não',
    cidade: '', telefone: '', status: 'ATIVO',
    email_app: '', senha_app: '' 
  });

  // --- CÁLCULO DE TOTAIS ---
  const totalGeral = motoristas.length;
  const totalComMopp = motoristas.filter(m => m.mopp === 'Sim').length;
  const totalSemMopp = motoristas.filter(m => m.mopp === 'Não').length;

  const motoristasFiltrados = motoristas.filter(m => {
    if (filtroMopp === 'TODOS') return true;
    return m.mopp === filtroMopp;
  });

  const formatarCPF = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  useEffect(() => {
    const qM = query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc"));
    const unsubM = onSnapshot(qM, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => { lista.push({ id: doc.id, ...doc.data() }); });
      setMotoristas(lista);
    });

    const qV = query(collection(db, "cadastro_veiculos"));
    const unsubV = onSnapshot(qV, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setVeiculos(lista);
    });

    const qC = query(collection(db, "carretas"));
    const unsubC = onSnapshot(qC, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
      setCarretas(lista);
    });

    return () => { unsubM(); unsubV(); unsubC(); };
  }, []);

  const getPlacasAssociadas = (motoristaId) => {
    const veiculo = veiculos.find(v => v.motorista_id === motoristaId);
    const carreta = carretas.find(c => c.motorista_id === motoristaId);
    return {
      cavalo: veiculo ? veiculo.placa : '---',
      carreta: carreta ? carreta.placa : '---'
    };
  };

  const salvarMotorista = async () => {
    if (!novoMotorista.nome || novoMotorista.cpf.length < 14 || !novoMotorista.email_app || !novoMotorista.senha_app) {
      alert("Erro: Preencha todos os campos obrigatórios!");
      return;
    }
    setCarregando(true);
    try {
      if (editandoId) {
        await updateDoc(doc(db, "cadastro_motoristas", editandoId), novoMotorista);
        setEditandoId(null);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, novoMotorista.email_app, novoMotorista.senha_app);
        await addDoc(collection(db, "cadastro_motoristas"), { ...novoMotorista, uid: userCredential.user.uid });
      }
      setNovoMotorista({ nome: '', cpf: '', cnh_cat: '', mopp: 'Não', cidade: '', telefone: '', status: 'ATIVO', email_app: '', senha_app: '' });
    } catch (e) { alert("Erro: " + e.message); } finally { setCarregando(false); }
  };

  const prepararEdicao = (m) => {
    setEditandoId(m.id);
    setNovoMotorista({ ...m });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const alternarStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    await updateDoc(doc(db, "cadastro_motoristas", id), { status: novoStatus });
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerAcoes}>
        <h2 style={styles.titulo}>CADASTRO DE MOTORISTAS</h2>
        <button onClick={() => setVerSenhas(!verSenhas)} style={styles.btnRevelar}>
          {verSenhas ? <EyeOff size={16}/> : <Eye size={16}/>} 
          {verSenhas ? 'OCULTAR ACESSOS' : 'VER SENHAS'}
        </button>
      </div>

      {/* PAINEL DE TOTAIS */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>TOTAL MOTORISTAS</span>
          <span style={styles.statValue}>{totalGeral}</span>
        </div>
        <div style={{...styles.statCard, borderLeft: '4px solid #3498db'}}>
          <span style={styles.statLabel}>COM CURSO MOPP</span>
          <span style={styles.statValue}>{totalComMopp}</span>
        </div>
        <div style={{...styles.statCard, borderLeft: '4px solid #e74c3c'}}>
          <span style={styles.statLabel}>SEM CURSO MOPP</span>
          <span style={styles.statValue}>{totalSemMopp}</span>
        </div>
      </div>

      {/* FORMULÁRIO */}
      <div style={styles.cardForm}>
        <div style={styles.gridForm}>
          <div style={styles.campo}><label style={styles.label}><User size={12}/> Nome</label>
            <input style={styles.input} placeholder="Nome completo" value={novoMotorista.nome} onChange={e => setNovoMotorista({...novoMotorista, nome: e.target.value.toUpperCase()})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><CreditCard size={12}/> CPF</label>
            <input style={styles.input} placeholder="000.000.000-00" value={novoMotorista.cpf} onChange={e => setNovoMotorista({...novoMotorista, cpf: formatarCPF(e.target.value)})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><ShieldCheck size={12}/> MOPP</label>
            <select style={styles.input} value={novoMotorista.mopp} onChange={e => setNovoMotorista({...novoMotorista, mopp: e.target.value})}>
              <option value="Não">Não</option><option value="Sim">Sim</option>
            </select>
          </div>
          <div style={styles.campo}><label style={styles.label}><MapPin size={12}/> Cidade onde reside</label>
            <input style={styles.input} placeholder="Ex: São Paulo/SP" value={novoMotorista.cidade} onChange={e => setNovoMotorista({...novoMotorista, cidade: e.target.value.toUpperCase()})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><Phone size={12}/> WhatsApp</label>
            <input style={styles.input} placeholder="(00) 00000-0000" value={novoMotorista.telefone} onChange={e => setNovoMotorista({...novoMotorista, telefone: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><Mail size={12}/> E-mail App</label>
            <input style={{...styles.input, borderColor: '#FFD700'}} value={novoMotorista.email_app} onChange={e => setNovoMotorista({...novoMotorista, email_app: e.target.value})} />
          </div>
          <div style={styles.campo}><label style={styles.label}><Key size={12}/> Senha App</label>
            <input style={{...styles.input, borderColor: '#FFD700'}} value={novoMotorista.senha_app} onChange={e => setNovoMotorista({...novoMotorista, senha_app: e.target.value})} />
          </div>
        </div>
        <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
          <button onClick={salvarMotorista} disabled={carregando} style={{...styles.btnSalvar, backgroundColor: editandoId ? '#2ecc71' : '#FFD700'}}>
            {carregando ? 'PROCESSANDO...' : (editandoId ? 'ATUALIZAR' : 'CADASTRAR')}
          </button>
          {editandoId && <button onClick={() => setEditandoId(null)} style={styles.btnCancelar}>CANCELAR</button>}
        </div>
      </div>

      {/* FILTROS RÁPIDOS */}
      <div style={styles.filterBar}>
        <button onClick={() => setFiltroMopp('TODOS')} style={{...styles.btnFiltro, backgroundColor: filtroMopp === 'TODOS' ? '#FFD700' : '#111', color: filtroMopp === 'TODOS' ? '#000' : '#888'}}>VER TODOS</button>
        <button onClick={() => setFiltroMopp('Sim')} style={{...styles.btnFiltro, backgroundColor: filtroMopp === 'Sim' ? '#3498db' : '#111', color: filtroMopp === 'Sim' ? '#FFF' : '#888'}}>SÓ COM MOPP</button>
        <button onClick={() => setFiltroMopp('Não')} style={{...styles.btnFiltro, backgroundColor: filtroMopp === 'Não' ? '#e74c3c' : '#111', color: filtroMopp === 'Não' ? '#FFF' : '#888'}}>SÓ SEM MOPP</button>
      </div>

      {/* TABELA */}
      <div style={styles.wrapperTabela}>
        <table style={styles.tabela}>
          <thead>
            <tr style={styles.headerTab}>
              <th style={styles.th}>STATUS</th>
              <th style={styles.th}>NOME</th>
              <th style={styles.th}>CIDADE EM QUE RESIDE</th>
              <th style={styles.th}>MOPP</th>
              <th style={styles.th}>PLACAS</th>
              <th style={styles.th}>ACESSO APP</th>
              <th style={styles.th}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {motoristasFiltrados.map(m => {
              const conjunto = getPlacasAssociadas(m.id);
              return (
                <tr key={m.id} style={styles.linha}>
                  <td style={styles.td}><span style={{...styles.badge, backgroundColor: m.status === 'ATIVO' ? '#2ecc71' : '#e74c3c'}}>{m.status}</span></td>
                  <td style={{...styles.td, fontWeight: 'bold'}}>{m.nome}</td>
                  <td style={styles.td}>{m.cidade || '---'}</td>
                  <td style={styles.td}>
                    <span style={{...styles.badge, backgroundColor: m.mopp === 'Sim' ? '#3498db' : '#333', color: '#FFF'}}>{m.mopp === 'Sim' ? 'SIM' : 'NÃO'}</span>
                  </td>
                  <td style={styles.td}>
                    <div style={{fontSize: '10px'}}><span style={{color: '#FFD700'}}>CVL:</span> {conjunto.cavalo}</div>
                    <div style={{fontSize: '10px'}}><span style={{color: '#3498db'}}>CRT:</span> {conjunto.carreta}</div>
                  </td>
                  <td style={{...styles.td, color: '#FFD700'}}>
                    <div>{m.email_app}</div>
                    {verSenhas && <div style={{fontSize: '10px', color: '#FFF'}}>Senha: {m.senha_app}</div>}
                  </td>
                  <td style={styles.td}>
                    <div style={{display: 'flex', gap: '5px'}}>
                      <button onClick={() => prepararEdicao(m)} style={styles.btnIcon}><Edit size={14}/></button>
                      <button onClick={() => alternarStatus(m.id, m.status)} style={{...styles.btnIcon, color: m.status === 'ATIVO' ? '#e74c3c' : '#2ecc71'}}><Power size={14}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '20px', backgroundColor: '#000', minHeight: '100vh', color: '#FFF' },
  headerAcoes: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  titulo: { color: '#FFD700', fontSize: '16px', borderLeft: '4px solid #FFD700', paddingLeft: '10px', fontWeight: 'bold' },
  btnRevelar: { backgroundColor: '#111', color: '#FFD700', border: '1px solid #FFD700', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px' },
  
  // ESTILO DOS TOTAIS
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' },
  statCard: { backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222', textAlign: 'center' },
  statLabel: { display: 'block', fontSize: '10px', color: '#666', fontWeight: 'bold', marginBottom: '5px' },
  statValue: { fontSize: '20px', fontWeight: 'bold', color: '#FFF' },

  cardForm: { backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', border: '1px solid #222', marginBottom: '20px' },
  gridForm: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' },
  campo: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { color: '#666', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' },
  input: { backgroundColor: '#111', border: '1px solid #333', color: '#FFF', padding: '10px', borderRadius: '6px', fontSize: '13px', outline: 'none' },
  btnSalvar: { flex: 1, padding: '12px', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', color: '#000' },
  btnCancelar: { padding: '12px 20px', backgroundColor: '#e74c3c', border: 'none', borderRadius: '6px', color: '#FFF', cursor: 'pointer' },
  filterBar: { display: 'flex', gap: '10px', marginBottom: '15px' },
  btnFiltro: { padding: '8px 15px', borderRadius: '6px', border: '1px solid #333', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' },
  wrapperTabela: { backgroundColor: '#0a0a0a', borderRadius: '12px', border: '1px solid #222', overflowX: 'auto' },
  tabela: { width: '100%', borderCollapse: 'collapse', minWidth: '950px' },
  headerTab: { backgroundColor: '#111', textAlign: 'left' },
  th: { padding: '15px', color: '#666', fontSize: '10px', fontWeight: 'bold' },
  td: { padding: '12px 15px', fontSize: '12px', borderBottom: '1px solid #111' },
  linha: { borderBottom: '1px solid #111' },
  badge: { padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', color: '#000' },
  btnIcon: { backgroundColor: '#1a1a1a', border: '1px solid #333', color: '#FFF', padding: '6px', borderRadius: '4px', cursor: 'pointer' }
};