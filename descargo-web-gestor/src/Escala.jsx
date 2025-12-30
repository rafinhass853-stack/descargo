import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, collection, onSnapshot, query, 
  orderBy, doc, setDoc, updateDoc, getDocs, where
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Save, ChevronLeft, ChevronRight, 
  Calendar as CalIcon, CheckCircle, Trash2, Info
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

export default function AdminEscala() {
  const [motoristas, setMotoristas] = useState([]);
  const [notificacoes, setNotificacoes] = useState({});
  const [listaNotificacoes, setListaNotificacoes] = useState([]);
  const [escalaAtual, setEscalaAtual] = useState({});
  const [dataFiltro, setDataFiltro] = useState(new Date());
  
  const [form, setForm] = useState({
    motorista_id: '',
    motorista_nome: '',
    status: 'P',
    obs: '',
    diaPendente: null,
    motivoMotorista: '' // <-- NOVO CAMPO
  });

  const opcoesStatus = {
    'P': { label: 'Trabalhado', color: '#2ecc71' },
    'DS': { label: 'Descanso', color: '#ff85a2' },
    'F': { label: 'Falta', color: '#e67e22' },
    'FE': { label: 'Férias', color: '#3498db' },
    'A': { label: 'Atestado', color: '#f1c40f' },
    'D': { label: 'Demitido', color: '#e74c3c' },
    'C1': { label: 'Contratado', color: '#00ced1' },
  };

  const estatisticas = useMemo(() => {
    const stats = { trabalhados: 0, descansos: 0, faltas: 0, ferias: 0, atestados: 0, saldoFolga: 0 };
    const valores = Object.values(escalaAtual);
    valores.forEach(v => {
      if (v.status === 'P') stats.trabalhados++;
      if (v.status === 'DS') stats.descansos++;
      if (v.status === 'F') stats.faltas++;
      if (v.status === 'FE') stats.ferias++;
      if (v.status === 'A') stats.atestados++;
    });
    const folgasDireito = Math.floor(stats.trabalhados / 6);
    stats.saldoFolga = folgasDireito - stats.descansos;
    return stats;
  }, [escalaAtual]);

  useEffect(() => {
    const q = query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc"));
    const unsubMot = onSnapshot(q, (snapshot) => {
      let lista = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        lista.push({ id: data.uid || doc.id, ...data });
      });
      setMotoristas(lista);
    });

    const unsubNotif = onSnapshot(collection(db, "notificacoes_ajustes"), (snapshot) => {
      let notes = {};
      let lista = [];
      snapshot.forEach(doc => { 
        const data = doc.data();
        if(data.temPendencia) {
          notes[doc.id] = true; 
          lista.push({ id: doc.id, ...data });
        }
      });
      setNotificacoes(notes);
      setListaNotificacoes(lista);
    });

    return () => { unsubMot(); unsubNotif(); };
  }, []);

  useEffect(() => {
    if (!form.motorista_id) { setEscalaAtual({}); return; }
    const unsubEscala = onSnapshot(collection(db, "cadastro_motoristas", form.motorista_id, "escala"), (snapshot) => {
      const dados = {};
      snapshot.forEach(doc => { dados[doc.id] = doc.data(); });
      setEscalaAtual(dados);
    });
    return () => unsubEscala();
  }, [form.motorista_id]);

  const verificarPendenciasRestantes = async (motoristaId) => {
    try {
      const escalaRef = collection(db, "cadastro_motoristas", motoristaId, "escala");
      const q = query(escalaRef, where("ajustePendente", "==", true));
      const snapshot = await getDocs(q);
      await setDoc(doc(db, "notificacoes_ajustes", motoristaId), { 
        temPendencia: !snapshot.empty 
      }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  };

  const salvarEscala = async () => {
    if (!form.motorista_id || !form.diaPendente) return alert("Selecione um dia no calendário!");
    try {
      const info = opcoesStatus[form.status];
      await setDoc(doc(db, "cadastro_motoristas", form.motorista_id, "escala", form.diaPendente), {
        status: form.status,
        color: info.color,
        legenda: info.label,
        obs: form.obs,
        ajustePendente: false,
        alteradoEm: new Date()
      }, { merge: true });

      await verificarPendenciasRestantes(form.motorista_id);
      setForm({ ...form, diaPendente: null, obs: '', motivoMotorista: '' });
      alert("Escala atualizada!");
    } catch (e) { 
      alert("Erro ao salvar."); 
    }
  };

  const apagarNotificacao = async (id) => {
    if (window.confirm("Deseja remover este alerta?")) {
        await setDoc(doc(db, "notificacoes_ajustes", id), { temPendencia: false }, { merge: true });
    }
  };

  const gerarDias = () => {
    const ano = dataFiltro.getFullYear();
    const mes = dataFiltro.getMonth();
    const primeiro = new Date(ano, mes, 1).getDay();
    const total = new Date(ano, mes + 1, 0).getDate();
    const dias = [];
    for (let i = 0; i < primeiro; i++) dias.push(null);
    for (let d = 1; d <= total; d++) {
      dias.push({ dia: d, dataIso: `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
    return dias;
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.logoIcon}><CalIcon size={20} color="#000" /></div>
          <h2 style={styles.titulo}>Gestão de Escala</h2>
        </div>

        <div style={styles.notifSection}>
            <label style={styles.label}>PENDÊNCIAS DE MOTORISTAS</label>
            <div style={styles.notifList}>
                {listaNotificacoes.length === 0 ? (
                    <p style={styles.emptyNotif}>Nenhum ajuste solicitado</p>
                ) : (
                    listaNotificacoes.map(n => (
                        <div key={n.id} style={styles.notifCard} onClick={() => setForm({...form, motorista_id: n.id, motorista_nome: n.nome})}>
                            <div style={{flex: 1}}>
                                <div style={styles.notifNome}>{n.nome?.toUpperCase()}</div>
                                <div style={styles.notifData}>Verificar solicitações</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); apagarNotificacao(n.id); }} style={styles.trashBtn}>
                                <CheckCircle size={16} color="#2ecc71" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>

        <hr style={styles.divider} />
        
        <div style={styles.formGroup}>
          <label style={styles.label}>MOTORISTA SELECIONADO</label>
          <select 
            style={{...styles.input, borderColor: notificacoes[form.motorista_id] ? '#FFD700' : '#222'}} 
            value={form.motorista_id} 
            onChange={(e) => {
               const mot = motoristas.find(m => m.id === e.target.value);
               setForm({...form, motorista_id: e.target.value, motorista_nome: mot?.nome || '', diaPendente: null, motivoMotorista: ''});
            }}
          >
            <option value="">Selecione um motorista...</option>
            {motoristas.map(m => (
              <option key={m.id} value={m.id}>
                {notificacoes[m.id] ? '⚠️ ' : ''}{m.nome?.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {form.motorista_id && (
          <div style={styles.controls}>
            <div style={styles.selectionInfo}>
               <label style={styles.label}>EDITANDO: {form.diaPendente ? form.diaPendente.split('-')[2] : '--'}</label>
               <span style={{fontSize: '10px', color: '#FFD700'}}>{form.motorista_nome}</span>
            </div>

            {/* CAIXA DE MENSAGEM DO MOTORISTA */}
            {form.motivoMotorista && (
              <div style={styles.motivoAlerta}>
                <div style={{display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '5px'}}>
                  <Info size={12} color="#FFD700" />
                  <span style={{fontSize: '10px', fontWeight: 'bold', color: '#FFD700'}}>JUSTIFICATIVA DO MOTORISTA:</span>
                </div>
                <p style={styles.motivoTexto}>{form.motivoMotorista}</p>
              </div>
            )}

            <div style={styles.statusGrid}>
              {Object.keys(opcoesStatus).map(st => (
                <button 
                  key={st}
                  onClick={() => setForm({...form, status: st})}
                  style={{
                    ...styles.statusBtn,
                    backgroundColor: form.status === st ? opcoesStatus[st].color : '#1a1a1a',
                    color: form.status === st ? '#000' : '#888',
                    border: form.status === st ? '1px solid #fff' : 'none'
                  }}
                >{st}</button>
              ))}
            </div>

            <textarea 
              placeholder="Sua observação final..." 
              style={styles.textarea} 
              value={form.obs} 
              onChange={e => setForm({...form, obs: e.target.value})} 
            />

            <button onClick={salvarEscala} style={styles.saveBtn}>
              <Save size={18} /> SALVAR ALTERAÇÃO
            </button>
          </div>
        )}
      </div>

      <div style={styles.calendarArea}>
        {/* DASHBOARD MANTIDO */}
        <div style={styles.dashboard}>
          <div style={styles.dashCard}><span style={styles.dashLabel}>SALDO FOLGAS</span><span style={{...styles.dashValue, color: estatisticas.saldoFolga >= 0 ? '#2ecc71' : '#e74c3c'}}>{estatisticas.saldoFolga}</span></div>
          <div style={styles.dashCard}><span style={styles.dashLabel}>TRABALHADOS</span><span style={styles.dashValue}>{estatisticas.trabalhados}</span></div>
          <div style={styles.dashCard}><span style={styles.dashLabel}>FALTAS</span><span style={{...styles.dashValue, color: '#e67e22'}}>{estatisticas.faltas}</span></div>
          <div style={styles.dashCard}><span style={styles.dashLabel}>FÉRIAS/AT.</span><span style={{...styles.dashValue, color: '#3498db'}}>{estatisticas.ferias + estatisticas.atestados}</span></div>
        </div>

        <div style={styles.calHeader}>
          <h3 style={styles.monthName}>{dataFiltro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}</h3>
          <div style={styles.navGroup}>
            <button style={styles.navBtn} onClick={() => setDataFiltro(new Date(dataFiltro.setMonth(dataFiltro.getMonth()-1)))}><ChevronLeft/></button>
            <button style={styles.navBtn} onClick={() => setDataFiltro(new Date(dataFiltro.setMonth(dataFiltro.getMonth()+1)))}><ChevronRight/></button>
          </div>
        </div>

        <div style={styles.grid}>
          {['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(d => <div key={d} style={styles.weekDay}>{d}</div>)}
          {gerarDias().map((item, idx) => {
            const dado = item ? escalaAtual[item.dataIso] : null;
            const sel = form.diaPendente === item?.dataIso;
            return (
              <div 
                key={idx} 
                onClick={() => item && setForm({
                  ...form, 
                  diaPendente: item.dataIso, 
                  obs: dado?.obs || '', 
                  status: dado?.status || 'P',
                  motivoMotorista: dado?.motivoSolicitado || '' // <-- PEGA O MOTIVO AQUI
                })}
                style={{
                  ...styles.dayBox,
                  opacity: item ? 1 : 0,
                  border: sel ? '2px solid #FFD700' : (dado?.ajustePendente ? '1px solid #FF85A2' : '1px solid #1a1a1a'),
                  cursor: item ? 'pointer' : 'default'
                }}
              >
                {dado && <div style={{...styles.statusBackground, backgroundColor: dado.color}} />}
                <div style={styles.dayHeader}>
                  <span style={{color: item ? (dado ? '#fff' : '#444') : 'transparent', fontWeight: 'bold'}}>{item?.dia}</span>
                  {dado?.ajustePendente && (
                    <div style={styles.pulseContainer}><div style={styles.pulseDot} /></div>
                  )}
                </div>
                <div style={styles.dayFooter}>
                  <span style={{fontSize: '9px', color: dado?.color, fontWeight: 'bold'}}>{dado?.legenda}</span>
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
  container: { display: 'flex', gap: '20px', padding: '20px', backgroundColor: '#000', height: '100vh', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden' },
  sidebar: { width: '320px', backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '15px', border: '1px solid #1a1a1a', overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  brand: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  logoIcon: { backgroundColor: '#FFD700', padding: '5px', borderRadius: '5px' },
  titulo: { fontSize: '16px', margin: 0, fontWeight: 'bold' },
  label: { fontSize: '10px', color: '#555', fontWeight: 'bold', marginBottom: '8px', display: 'block', letterSpacing: '1px' },
  input: { width: '100%', padding: '12px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px', marginBottom: '20px', outline: 'none', fontSize: '12px' },
  selectionInfo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  statusGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '15px' },
  statusBtn: { padding: '10px 0', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', transition: '0.2s' },
  textarea: { width: '100%', height: '70px', background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '8px', padding: '10px', marginBottom: '15px', resize: 'none', fontSize: '12px' },
  saveBtn: { width: '100%', padding: '14px', background: '#FFD700', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  divider: { border: '0', borderTop: '1px solid #1a1a1a', margin: '20px 0' },
  notifSection: { marginBottom: '10px' },
  notifList: { display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' },
  notifCard: { display: 'flex', alignItems: 'center', background: '#111', padding: '10px', borderRadius: '8px', border: '1px solid #222', cursor: 'pointer' },
  notifNome: { fontSize: '11px', fontWeight: 'bold', color: '#FFD700' },
  notifData: { fontSize: '9px', color: '#555' },
  emptyNotif: { fontSize: '11px', color: '#333', textAlign: 'center', padding: '10px' },
  trashBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' },
  calendarArea: { flex: 1, background: '#0a0a0a', padding: '20px', borderRadius: '15px', border: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' },
  dashboard: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' },
  dashCard: { background: '#111', border: '1px solid #1a1a1a', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  dashLabel: { fontSize: '9px', color: '#555', fontWeight: 'bold', marginBottom: '5px' },
  dashValue: { fontSize: '24px', fontWeight: '900', color: '#fff' },
  dashSub: { fontSize: '8px', color: '#333', marginTop: '4px', textTransform: 'uppercase' },
  calHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  monthName: { color: '#FFD700', margin: 0, fontSize: '20px', fontWeight: '900' },
  navGroup: { display: 'flex', gap: '8px' },
  navBtn: { background: '#111', border: '1px solid #222', color: '#fff', padding: '8px', borderRadius: '8px', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', flex: 1 },
  weekDay: { textAlign: 'center', color: '#444', fontSize: '10px', fontWeight: 'bold', paddingBottom: '10px' },
  dayBox: { position: 'relative', padding: '10px', borderRadius: '10px', background: '#0d0d0d', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  statusBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.12, zIndex: 1, borderRadius: '10px' },
  dayHeader: { display: 'flex', justifyContent: 'space-between', zIndex: 2 },
  dayFooter: { zIndex: 2 },
  pulseContainer: { position: 'relative', width: '8px', height: '8px' },
  pulseDot: { width: '8px', height: '8px', background: '#FFD700', borderRadius: '50%', boxShadow: '0 0 10px #FFD700' },
  // ESTILOS DA CAIXA DE MOTIVO
  motivoAlerta: { background: 'rgba(255, 215, 0, 0.1)', border: '1px solid #FFD700', borderRadius: '8px', padding: '10px', marginBottom: '15px' },
  motivoTexto: { margin: 0, fontSize: '12px', color: '#fff', fontStyle: 'italic' }
};