import React, { useState, useEffect } from 'react';
import { 
  getFirestore, collection, onSnapshot, query, 
  orderBy, doc, setDoc, deleteDoc, getDoc
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Save, User, ChevronLeft, ChevronRight, 
  Trash2, Calendar as CalIcon, AlertCircle, XCircle
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

export default function Escala() {
  const [motoristas, setMotoristas] = useState([]);
  const [escalaAtual, setEscalaAtual] = useState({});
  const [dataFiltro, setDataFiltro] = useState(new Date());
  
  const [form, setForm] = useState({
    motorista_id: '',
    motorista_nome: '',
    status: 'P',
    obs: '',
    diaPendente: null
  });

  const opcoesStatus = {
    'P': { label: 'Trabalhado', color: '#2ecc71', bg: 'rgba(46, 204, 113, 0.2)' },
    'DS': { label: 'Descanso', color: '#ff85a2', bg: 'rgba(255, 133, 162, 0.2)' },
    'F': { label: 'Falta', color: '#e67e22', bg: 'rgba(230, 126, 34, 0.2)' },
    'FE': { label: 'Férias', color: '#3498db', bg: 'rgba(52, 152, 219, 0.2)' },
    'A': { label: 'Atestado', color: '#f1c40f', bg: 'rgba(241, 196, 15, 0.2)' },
    'D': { label: 'Demitido', color: '#e74c3c', bg: 'rgba(231, 76, 60, 0.2)' },
    'C1': { label: 'Contratado', color: '#00ced1', bg: 'rgba(0, 206, 209, 0.2)' },
  };

  // 1. Carregar Motoristas
  useEffect(() => {
    try {
      const q = query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc"));
      const unsub = onSnapshot(q, (snapshot) => {
        const lista = [];
        snapshot.forEach((doc) => {
          const dados = doc.data();
          lista.push({ id: dados.uid || doc.id, ...dados });
        });
        setMotoristas(lista);
      }, (error) => console.error("Erro motoristas:", error));
      return () => unsub();
    } catch (e) { console.error(e); }
  }, []);

  // 2. Monitorar Escala do Motorista Selecionado
  useEffect(() => {
    if (!form.motorista_id) {
      setEscalaAtual({});
      return;
    }
    const caminhoEscala = collection(db, "cadastro_motoristas", form.motorista_id, "escala");
    const unsubEscala = onSnapshot(caminhoEscala, (snapshot) => {
      const dados = {};
      snapshot.forEach(doc => { dados[doc.id] = doc.data(); });
      setEscalaAtual(dados);
    });
    return () => unsubEscala();
  }, [form.motorista_id]);

  const handleSelectMotorista = (e) => {
    const uidSelecionado = e.target.value;
    if (!uidSelecionado) {
      setForm({ ...form, motorista_id: '', motorista_nome: '', diaPendente: null, obs: '' });
    } else {
      const mot = motoristas.find(m => (m.uid === uidSelecionado || m.id === uidSelecionado));
      setForm({ ...form, motorista_id: uidSelecionado, motorista_nome: mot?.nome || '', diaPendente: null, obs: '' });
    }
  };

  const apagarEscala = async () => {
    if (!form.motorista_id || !form.diaPendente) return alert("Selecione um dia com escala para apagar.");
    if (!window.confirm(`Deseja realmente remover a escala do dia ${form.diaPendente}?`)) return;

    try {
      const escalaDocRef = doc(db, "cadastro_motoristas", form.motorista_id, "escala", form.diaPendente);
      await deleteDoc(escalaDocRef);
      setForm({ ...form, diaPendente: null, obs: '' });
      alert("Escala removida!");
    } catch (error) {
      alert("Erro ao apagar escala.");
    }
  };

  const salvarEscala = async () => {
    if (!form.motorista_id || !form.diaPendente) {
      alert("Selecione um motorista e clique em um dia no calendário!");
      return;
    }

    try {
      const infoStatus = opcoesStatus[form.status];
      const escalaDocRef = doc(db, "cadastro_motoristas", form.motorista_id, "escala", form.diaPendente);

      await setDoc(escalaDocRef, {
        motoristaId: form.motorista_id,
        motoristaNome: form.motorista_nome,
        status: form.status,
        color: infoStatus.color,
        legenda: infoStatus.label,
        obs: form.obs,
        dataReferencia: form.diaPendente,
        dataRegistro: new Date().toISOString(),
        ajustePendente: false 
      }, { merge: true });

      setForm({ ...form, diaPendente: null, obs: '' });
    } catch (error) {
      alert("Erro ao gravar no banco de dados.");
    }
  };

  const gerarDias = () => {
    const ano = dataFiltro.getFullYear();
    const mes = dataFiltro.getMonth();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    const dias = [];
    
    for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
    for (let d = 1; d <= totalDiasMes; d++) {
      const dataIso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({ dia: d, dataIso });
    }
    return dias;
  };

  const mudarMes = (offset) => {
    const novaData = new Date(dataFiltro.getFullYear(), dataFiltro.getMonth() + offset, 1);
    setDataFiltro(novaData);
  };

  return (
    <div style={styles.container}>
      {/* SIDEBAR DE CONTROLE */}
      <div style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.logoIcon}><CalIcon size={20} color="#000" /></div>
          <h2 style={styles.titulo}>Escala Digital</h2>
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>SELECIONAR MOTORISTA</label>
          <select style={styles.input} value={form.motorista_id} onChange={handleSelectMotorista}>
            <option value="">Selecione um colaborador...</option>
            {motoristas.map(m => (
              <option key={m.id} value={m.uid || m.id}>{m.nome}</option>
            ))}
          </select>
        </div>

        {form.motorista_id ? (
          <div style={styles.controls}>
            <label style={styles.label}>
              STATUS {form.diaPendente ? `PARA O DIA ${form.diaPendente.split('-')[2]}` : '(ESCOLHA UM DIA)'}
            </label>
            <div style={styles.statusGrid}>
              {Object.keys(opcoesStatus).map(st => (
                <button 
                  key={st}
                  onClick={() => setForm({...form, status: st})}
                  style={{
                    ...styles.statusBtn,
                    backgroundColor: form.status === st ? opcoesStatus[st].color : '#1a1a1a',
                    color: form.status === st ? '#000' : '#888',
                    borderColor: form.status === st ? opcoesStatus[st].color : '#333'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            <label style={styles.label}>OBSERVAÇÕES DO DIA</label>
            <textarea 
              placeholder="Notas ou motivos de falta..."
              style={styles.textarea} 
              value={form.obs} 
              onChange={e => setForm({...form, obs: e.target.value})} 
            />

            <div style={styles.actionRow}>
              <button onClick={salvarEscala} style={styles.saveBtn}>
                <Save size={18} /> GRAVAR
              </button>
              <button onClick={apagarEscala} title="Remover este dia" style={styles.deleteBtn}>
                <Trash2 size={18} />
              </button>
            </div>
            
            <button onClick={() => setForm({...form, diaPendente: null, obs: ''})} style={styles.clearBtn}>
              <XCircle size={14} /> LIMPAR SELEÇÃO
            </button>
          </div>
        ) : (
          <div style={styles.emptyState}>
            <AlertCircle size={40} color="#333" />
            <p style={{color: '#555', fontSize: '13px', textAlign: 'center'}}>Escolha um motorista para gerenciar a escala</p>
          </div>
        )}
      </div>

      {/* ÁREA DO CALENDÁRIO */}
      <div style={styles.calendarArea}>
        <div style={styles.calHeader}>
          <div style={styles.calTitle}>
            <h3 style={styles.monthName}>
              {dataFiltro.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase()}
            </h3>
            <span style={styles.yearName}>{dataFiltro.getFullYear()}</span>
          </div>
          <div style={styles.navGroup}>
            <button style={styles.navBtn} onClick={() => mudarMes(-1)}><ChevronLeft size={20}/></button>
            <button style={styles.navBtn} onClick={() => setDataFiltro(new Date())}>HOJE</button>
            <button style={styles.navBtn} onClick={() => mudarMes(1)}><ChevronRight size={20}/></button>
          </div>
        </div>

        <div style={styles.grid}>
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
            <div key={d} style={styles.weekDay}>{d}</div>
          ))}
          {gerarDias().map((item, idx) => {
            const dado = item ? escalaAtual[item.dataIso] : null;
            const selecionado = form.diaPendente === item?.dataIso;
            return (
              <div 
                key={idx} 
                onClick={() => item && setForm({...form, diaPendente: item.dataIso, obs: dado?.obs || ''})}
                style={{
                  ...styles.dayBox,
                  backgroundColor: dado ? 'transparent' : '#0d0d0d',
                  opacity: item ? 1 : 0,
                  border: selecionado ? '2px solid #FFD700' : '1px solid #1a1a1a',
                  boxShadow: selecionado ? '0 0 15px rgba(255, 215, 0, 0.3)' : 'none'
                }}
              >
                {dado && (
                  <div style={{...styles.statusBackground, backgroundColor: dado.color}} />
                )}
                
                <div style={styles.dayHeader}>
                  <span style={{color: dado ? '#fff' : '#444', fontSize: '14px', zIndex: 2, fontWeight: '900'}}>
                    {item?.dia}
                  </span>
                  {dado?.ajustePendente && <div style={styles.pulseDot} title="O motorista solicitou ajuste" />}
                </div>

                <div style={styles.dayFooter}>
                  {dado?.status && (
                    <span style={{...styles.statusBadge, color: dado.color}}>
                      {dado.legenda?.toUpperCase() || dado.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', gap: '24px', padding: '24px', backgroundColor: '#000', height: '100vh', boxSizing: 'border-box', color: '#fff', fontFamily: 'sans-serif' },
  sidebar: { width: '340px', backgroundColor: '#0a0a0a', padding: '24px', borderRadius: '16px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' },
  brand: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' },
  logoIcon: { backgroundColor: '#FFD700', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  titulo: { color: '#fff', fontSize: '20px', fontWeight: 'bold', margin: 0 },
  formGroup: { marginBottom: '24px' },
  label: { color: '#555', fontSize: '10px', fontWeight: '800', letterSpacing: '1px', marginBottom: '8px', display: 'block' },
  input: { width: '100%', backgroundColor: '#111', border: '1px solid #222', color: '#fff', padding: '12px', borderRadius: '10px', fontSize: '14px', outline: 'none' },
  statusGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' },
  statusBtn: { padding: '10px 0', border: '1px solid', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: 'all 0.2s' },
  textarea: { width: '100%', height: '80px', backgroundColor: '#111', border: '1px solid #222', color: '#fff', borderRadius: '10px', padding: '12px', marginBottom: '20px', fontSize: '13px', resize: 'none', outline: 'none' },
  actionRow: { display: 'flex', gap: '10px', marginBottom: '12px' },
  saveBtn: { flex: 1, backgroundColor: '#FFD700', color: '#000', padding: '14px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' },
  deleteBtn: { width: '54px', backgroundColor: '#222', color: '#ff4444', border: '1px solid #331111', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  clearBtn: { backgroundColor: 'transparent', color: '#444', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', opacity: 0.5 },
  calendarArea: { flex: 1, backgroundColor: '#0a0a0a', padding: '24px', borderRadius: '16px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  calHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' },
  monthName: { margin: 0, color: '#FFD700', fontSize: '24px', fontWeight: '900' },
  yearName: { color: '#444', fontSize: '16px', fontWeight: 'bold', marginLeft: '10px' },
  navGroup: { display: 'flex', gap: '8px' },
  navBtn: { backgroundColor: '#111', border: '1px solid #222', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', flex: 1 },
  weekDay: { textAlign: 'center', color: '#333', fontSize: '11px', fontWeight: '900', paddingBottom: '10px' },
  dayBox: { position: 'relative', minHeight: '80px', padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' },
  statusBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15, zIndex: 1 },
  dayHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2 },
  dayFooter: { zIndex: 2 },
  statusBadge: { fontSize: '9px', fontWeight: '900', letterSpacing: '0.5px' },
  pulseDot: { width: '8px', height: '8px', backgroundColor: '#FFD700', borderRadius: '50%', boxShadow: '0 0 10px #FFD700' }
};