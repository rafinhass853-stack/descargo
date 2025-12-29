import React, { useState, useEffect } from 'react';
import { 
  getFirestore, collection, onSnapshot, query, 
  orderBy, doc, setDoc, where, getDoc
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Save, User, ChevronLeft, ChevronRight, 
  Trash2 
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
    motorista_id: '', // Este agora será o UID do Auth
    motorista_nome: '',
    status: 'P',
    obs: '',
    diaPendente: null
  });

  // 1. Carrega Motoristas (Garante que pegamos o campo 'uid' do documento)
  useEffect(() => {
    const q = query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const lista = [];
      snapshot.forEach((doc) => {
        const dados = doc.data();
        // PRIORIDADE: Usar o campo 'uid' salvo dentro do documento
        lista.push({ 
          id: dados.uid || doc.id, 
          ...dados 
        });
      });
      setMotoristas(lista);
    });
    return () => unsub();
  }, []);

  // 2. Monitora Escala em tempo real
  useEffect(() => {
    if (!form.motorista_id) {
      setEscalaAtual({});
      return;
    }

    const caminhoEscala = collection(db, "cadastro_motoristas", form.motorista_id, "escala");
    const unsubEscala = onSnapshot(caminhoEscala, (snapshot) => {
      const dados = {};
      snapshot.forEach(doc => {
        dados[doc.id] = doc.data();
      });
      setEscalaAtual(dados);
    });

    return () => unsubEscala();
  }, [form.motorista_id]);

  // Alteração do Select para usar o UID (Conforme imagem enviada)
  const handleSelectMotorista = (e) => {
    const uidSelecionado = e.target.value;
    if (!uidSelecionado) {
      setForm({ ...form, motorista_id: '', motorista_nome: '', diaPendente: null });
    } else {
      const mot = motoristas.find(m => m.uid === uidSelecionado || m.id === uidSelecionado);
      setForm({ 
        ...form, 
        motorista_id: uidSelecionado, 
        motorista_nome: mot?.nome || '', 
        diaPendente: null 
      });
    }
  };

  // Botão Limpar (Solicitado na imagem)
  const limparFormulario = () => {
    setForm({
      ...form,
      status: 'P',
      obs: '',
      diaPendente: null
    });
  };

  const salvarEscala = async () => {
    if (!form.motorista_id || !form.diaPendente) {
      alert("Selecione um motorista e um dia!");
      return;
    }

    try {
      const opcoesStatus = {
        'P': { label: 'Trabalhado', color: '#2ecc71' },
        'DS': { label: 'Descanso', color: '#ff85a2' },
        'F': { label: 'Falta', color: '#e67e22' },
        'FE': { label: 'Férias', color: '#3498db' },
        'A': { label: 'Atestado', color: '#f1c40f' },
        'D': { label: 'Demitido', color: '#e74c3c' },
        'C1': { label: 'Contratado', color: '#00ced1' },
      };

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
        ajustePendente: false // Limpa pendência ao salvar
      }, { merge: true });

      alert(`Escala de ${form.motorista_nome} atualizada!`);
      setForm({ ...form, diaPendente: null, obs: '' });

    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao gravar. Verifique se o ID do motorista está correto.");
    }
  };

  const gerarDias = () => {
    const ano = dataFiltro.getFullYear();
    const mes = dataFiltro.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const dias = [];
    for (let i = 0; i < primeiroDia; i++) dias.push(null);
    for (let d = 1; d <= totalDias; d++) {
      const dataIso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      dias.push({ dia: d, dataIso });
    }
    return dias;
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <h2 style={styles.titulo}><User /> Escala</h2>
        
        <label style={styles.label}>Motorista</label>
        <select style={styles.input} value={form.motorista_id} onChange={handleSelectMotorista}>
          <option value="">Selecione...</option>
          {motoristas.map(m => (
            <option key={m.id} value={m.uid || m.id}>{m.nome}</option>
          ))}
        </select>

        {form.motorista_id && (
          <>
            <div style={styles.statusGrid}>
              {['P', 'DS', 'F', 'FE', 'A', 'D', 'C1'].map(st => (
                <button 
                  key={st}
                  onClick={() => setForm({...form, status: st})}
                  style={{
                    ...styles.statusBtn,
                    backgroundColor: form.status === st ? '#FFD700' : '#111',
                    color: form.status === st ? '#000' : '#888'
                  }}
                >{st}</button>
              ))}
            </div>

            <label style={styles.label}>Observação</label>
            <textarea 
              style={styles.textarea} 
              value={form.obs} 
              onChange={e => setForm({...form, obs: e.target.value})} 
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={salvarEscala} style={styles.saveBtn}>
                <Save size={18} /> GRAVAR
              </button>
              <button onClick={limparFormulario} style={styles.clearBtn}>
                <Trash2 size={18} />
              </button>
            </div>
          </>
        )}
      </div>

      <div style={styles.calendarArea}>
        <div style={styles.calHeader}>
          <button style={styles.navBtn} onClick={() => setDataFiltro(new Date(dataFiltro.setMonth(dataFiltro.getMonth() - 1)))}><ChevronLeft/></button>
          <h3 style={{color: '#FFD700'}}>{dataFiltro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</h3>
          <button style={styles.navBtn} onClick={() => setDataFiltro(new Date(dataFiltro.setMonth(dataFiltro.getMonth() + 1)))}><ChevronRight/></button>
        </div>

        <div style={styles.grid}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d} style={styles.weekDay}>{d}</div>)}
          {gerarDias().map((item, idx) => {
            const dado = item ? escalaAtual[item.dataIso] : null;
            const selecionado = form.diaPendente === item?.dataIso;
            return (
              <div 
                key={idx} 
                onClick={() => item && setForm({...form, diaPendente: item.dataIso})}
                style={{
                  ...styles.dayBox,
                  backgroundColor: dado ? dado.color : '#0a0a0a',
                  opacity: item ? 1 : 0,
                  border: selecionado ? '2px solid #FFD700' : (dado?.ajustePendente ? '2px dashed #FFD700' : '1px solid #1a1a1a')
                }}
              >
                <span style={{color: dado ? '#000' : '#444', fontWeight: 'bold'}}>{item?.dia}</span>
                {dado?.status && <span style={styles.statusTag}>{dado.status}</span>}
                {dado?.ajustePendente && <span style={{fontSize: '8px', color: '#000'}}>SOLICITADO</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', gap: '20px', padding: '20px', backgroundColor: '#000', height: '100vh', boxSizing: 'border-box' },
  sidebar: { width: '300px', backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', border: '1px solid #222' },
  calendarArea: { flex: 1, backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', border: '1px solid #222' },
  titulo: { color: '#FFD700', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  label: { color: '#666', fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '5px' },
  input: { width: '100%', backgroundColor: '#000', border: '1px solid #333', color: '#fff', padding: '10px', borderRadius: '6px', marginBottom: '15px' },
  statusGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '15px' },
  statusBtn: { padding: '8px 0', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  textarea: { width: '100%', height: '60px', backgroundColor: '#000', border: '1px solid #333', color: '#fff', borderRadius: '6px', padding: '10px', marginBottom: '15px' },
  saveBtn: { flex: 1, backgroundColor: '#FFD700', color: '#000', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' },
  clearBtn: { width: '50px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  calHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  navBtn: { backgroundColor: '#111', border: '1px solid #222', color: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' },
  weekDay: { textAlign: 'center', color: '#333', fontSize: '12px', fontWeight: 'bold' },
  dayBox: { height: '70px', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  statusTag: { alignSelf: 'flex-end', fontSize: '14px', fontWeight: 'bold', color: 'rgba(0,0,0,0.6)' }
};