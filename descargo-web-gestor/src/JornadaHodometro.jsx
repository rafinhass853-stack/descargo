import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, collection, onSnapshot, query, 
  orderBy, doc, updateDoc, setDoc
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Gauge, MapPin, User, Search, CheckCircle2, Timer, Users, Send, TrendingUp
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

export default function JornadaHodometro() {
  const [registros, setRegistros] = useState([]);
  const [motoristasCadastrados, setMotoristasCadastrados] = useState([]);
  const [solicitacaoAtiva, setSolicitacaoAtiva] = useState(false);
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);
  
  const [mesConsolidado, setMesConsolidado] = useState(new Date().getMonth() + 1);
  const [anoConsolidado, setAnoConsolidado] = useState(new Date().getFullYear());

  // --- AUTOMATIZAÇÃO (ROBOT) ---
  useEffect(() => {
    const verificarHorario = async () => {
      const agora = new Date();
      const hora = agora.getHours();
      const minuto = agora.getMinutes();

      // Dispara às 08:00 AM ou 18:00 PM (apenas no minuto zero)
      if ((hora === 8 || hora === 18) && minuto === 0) {
        if (!solicitacaoAtiva) {
          console.log("Disparando solicitação automática de KM...");
          await setDoc(doc(db, "configuracoes", "controle_app"), { 
            pedirHodometro: true,
            timestampSolicitacao: new Date(),
            origem: "AUTOMATICO"
          }, { merge: true });
        }
      }
    };

    const interval = setInterval(verificarHorario, 60000); // Checa a cada 1 minuto
    return () => clearInterval(interval);
  }, [solicitacaoAtiva]);

  useEffect(() => {
    const unsubMot = onSnapshot(collection(db, "cadastro_motoristas"), (snapshot) => {
      const lista = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
      setMotoristasCadastrados(lista);
    });

    const unsubStatus = onSnapshot(doc(db, "configuracoes", "controle_app"), (docSnap) => {
      if (docSnap.exists()) setSolicitacaoAtiva(docSnap.data().pedirHodometro);
    });

    const qJor = query(collection(db, "historico_jornadas"), orderBy("timestamp", "desc"));
    const unsubJor = onSnapshot(qJor, (snapshot) => {
      const lista = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
      setRegistros(lista);
    });

    return () => { unsubMot(); unsubStatus(); unsubJor(); };
  }, []);

  // --- CÁLCULOS DO CONSOLIDADO ---
  const consolidado = useMemo(() => {
    const dadosMotoristas = {};
    let kmTotalPeriodo = 0;

    registros.forEach(reg => {
      if (!reg.timestamp) return;
      const data = new Date(reg.timestamp.seconds * 1000);
      if ((data.getMonth() + 1) === Number(mesConsolidado) && data.getFullYear() === Number(anoConsolidado)) {
        const mId = reg.motoristaId;
        if (!dadosMotoristas[mId]) dadosMotoristas[mId] = [];
        dadosMotoristas[mId].push(Number(reg.km) || 0);
      }
    });

    const ranking = motoristasCadastrados.map(mot => {
      const kms = dadosMotoristas[mot.id] || dadosMotoristas[mot.uid] || [];
      const kmRodado = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
      kmTotalPeriodo += kmRodado;
      return { nome: mot.nome, km: kmRodado };
    }).sort((a, b) => b.km - a.km);

    return { ranking, kmTotalPeriodo };
  }, [registros, motoristasCadastrados, mesConsolidado, anoConsolidado]);

  // --- DASHBOARD DIÁRIO ---
  const { listaFinal, stats } = useMemo(() => {
    let kmTotalGeral = 0;
    const motoristasQueEnviaramIds = new Set();
    const enviosDeHoje = registros.filter(reg => 
      reg.timestamp && new Date(reg.timestamp.seconds * 1000).toISOString().split('T')[0] === filtroData
    );

    const grupos = {};
    enviosDeHoje.forEach(reg => {
      const mId = reg.motoristaId;
      if (!grupos[mId]) grupos[mId] = [];
      grupos[mId].push(reg);
      motoristasQueEnviaramIds.add(mId);
    });

    Object.values(grupos).forEach(logs => {
      const kms = logs.map(l => Number(l.km) || 0);
      if (kms.length > 1) kmTotalGeral += (Math.max(...kms) - Math.min(...kms));
    });

    const listaCompleta = motoristasCadastrados.map(mot => {
      const logs = grupos[mot.id] || grupos[mot.uid] || [];
      return { ...mot, logs, enviou: logs.length > 0 };
    });

    return {
      listaFinal: listaCompleta,
      stats: {
        total: motoristasCadastrados.length,
        enviaram: motoristasQueEnviaramIds.size,
        pendentes: motoristasCadastrados.length - motoristasQueEnviaramIds.size,
        kmTotal: kmTotalGeral
      }
    };
  }, [registros, motoristasCadastrados, filtroData]);

  const alternarSolicitacao = async () => {
    const novoEstado = !solicitacaoAtiva;
    try {
      await setDoc(doc(db, "configuracoes", "controle_app"), { 
        pedirHodometro: novoEstado,
        timestampSolicitacao: new Date(),
        origem: "MANUAL"
      }, { merge: true });
    } catch (e) { alert("Erro ao atualizar status."); }
  };

  return (
    <div style={styles.container}>
      {/* 1. CONSOLIDADO */}
      <div style={styles.consolidadoWrapper}>
        <div style={styles.consolidadoHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp color="#FFD700" size={24} />
            <h2 style={{ margin: 0 }}>Consolidado do Período</h2>
          </div>
          <div style={styles.filterRow}>
            <select style={styles.dateInput} value={mesConsolidado} onChange={(e) => setMesConsolidado(e.target.value)}>
              {Array.from({length: 12}, (_, i) => (
                <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', {month: 'long'}).toUpperCase()}</option>
              ))}
            </select>
            <select style={styles.dateInput} value={anoConsolidado} onChange={(e) => setAnoConsolidado(e.target.value)}>
              <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
            </select>
          </div>
        </div>
        <div style={styles.consolidadoGrid}>
          <div style={styles.totalDestaque}>
            <span style={styles.statLabel}>KM TOTAL NO MÊS</span>
            <div style={{ fontSize: '32px', fontWeight: '900', color: '#FFD700' }}>{consolidado.kmTotalPeriodo.toLocaleString()} KM</div>
          </div>
          <div style={styles.rankingLista}>
            {consolidado.ranking.slice(0, 5).map((item, idx) => (
              <div key={idx} style={styles.rankingItem}>
                <span style={{ color: '#666', width: '20px' }}>{idx + 1}º</span>
                <span style={{ flex: 1, fontWeight: 'bold', fontSize: '13px' }}>{item.nome}</span>
                <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{item.km} KM</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. DASHBOARD DIÁRIO */}
      <div style={styles.statsBar}>
        <div style={styles.statCard}><Users size={20} color="#FFD700" /><div><span style={styles.statLabel}>TOTAL</span><div style={styles.statValue}>{stats.total}</div></div></div>
        <div style={styles.statCard}><CheckCircle2 size={20} color="#2ecc71" /><div><span style={styles.statLabel}>ENVIARAM</span><div style={styles.statValue}>{stats.enviaram}</div></div></div>
        <div style={styles.statCard}><Timer size={20} color={stats.pendentes > 0 ? "#ff4d4d" : "#2ecc71"} /><div><span style={styles.statLabel}>PENDENTES</span><div style={styles.statValue}>{stats.pendentes}</div></div></div>
        <div style={styles.statCard}><Gauge size={20} color="#FFD700" /><div><span style={styles.statLabel}>KM HOJE</span><div style={styles.statValue}>{stats.kmTotal} KM</div></div></div>
        
        <button 
          onClick={alternarSolicitacao} 
          style={{
            ...styles.btnSolicitar, 
            backgroundColor: solicitacaoAtiva ? '#ff4d4d' : '#FFD700',
            cursor: 'pointer'
          }}
        >
          <Send size={18} color="#000" />
          <span style={{ color: "#000" }}>{solicitacaoAtiva ? "PEDIR KM (ATIVO)" : "PEDIR KM"}</span>
        </button>
      </div>

      {/* 3. LISTAGEM */}
      <div style={styles.headerArea}>
        <h2 style={styles.titulo}>Status do Dia (08:00h e 18:00h Auto)</h2>
        <div style={styles.filterRow}>
            <input type="date" style={styles.dateInput} value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
            <div style={styles.searchBox}>
                <Search size={18} color="#555" />
                <input style={styles.inputBusca} placeholder="Buscar..." value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} />
            </div>
        </div>
      </div>

      <div style={styles.grid}>
        {listaFinal
          .filter(m => (m.nome || '').toLowerCase().includes(filtroNome.toLowerCase()))
          .map((mot) => {
            const kms = mot.logs.map(l => Number(l.km) || 0);
            const kmRodado = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;
            return (
              <div key={mot.id} style={{...styles.cardMotorista, borderColor: !mot.enviou && solicitacaoAtiva ? '#ff4d4d' : '#1a1a1a'}}>
                <div style={styles.cardHeader}>
                  <div style={{display: 'flex', gap: '12px'}}>
                    <div style={{...styles.avatar, backgroundColor: mot.enviou ? '#FFD700' : '#333'}}><User size={20} color={mot.enviou ? "#000" : "#666"} /></div>
                    <div>
                        <div style={styles.nomeLabel}>{mot.nome?.toUpperCase()}</div>
                        <span style={{color: mot.enviou ? '#2ecc71' : '#ff4d4d', fontSize:'11px', fontWeight:'bold'}}>
                          {mot.enviou ? 'CONCLUÍDO' : 'PENDENTE'}
                        </span>
                    </div>
                  </div>
                  {mot.enviou && <div style={{textAlign:'right'}}><div style={styles.resumoLabel}>KM HOJE</div><div style={styles.resumoValue}>{kmRodado}</div></div>}
                </div>
                <div style={styles.timeline}>
                  {mot.logs.length > 0 ? mot.logs.map(log => (
                    <div key={log.id} style={styles.contentLog}>
                      <div style={styles.logHeader}>
                        <span style={styles.badge}>{log.tipo}</span>
                        <span style={styles.horaLabel}>{log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString() : '--:--'}</span>
                      </div>
                      <div style={styles.dataRow}>
                        <div style={styles.kmDisplay}><Gauge size={14} color="#FFD700" /><span style={styles.kmValue}>{log.km} KM</span></div>
                        <div style={styles.locInfo}><MapPin size={14} color="#555" /><span style={styles.locText}>{log.cidade || 'S/L'}</span></div>
                      </div>
                    </div>
                  )) : <div style={styles.emptyState}>Aguardando envio...</div>}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '30px', backgroundColor: '#000', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' },
  consolidadoWrapper: { background: '#0a0a0a', padding: '25px', borderRadius: '20px', border: '1px solid #1a1a1a', marginBottom: '20px' },
  consolidadoHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  consolidadoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'center' },
  totalDestaque: { background: '#111', padding: '30px', borderRadius: '15px', borderLeft: '5px solid #FFD700' },
  rankingLista: { background: '#111', padding: '15px', borderRadius: '15px' },
  rankingItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' },
  statsBar: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px', marginBottom: '30px', background: '#0a0a0a', padding: '20px', borderRadius: '20px', border: '1px solid #1a1a1a', alignItems: 'center' },
  statCard: { display: 'flex', alignItems: 'center', gap: '12px', background: '#111', padding: '15px', borderRadius: '15px' },
  statLabel: { fontSize: '9px', color: '#666', fontWeight: 'bold' },
  statValue: { fontSize: '18px', fontWeight: '900' },
  btnSolicitar: { border: 'none', padding: '15px', borderRadius: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: '0.2s' },
  headerArea: { display: 'flex', justifyContent: 'space-between', marginBottom: '30px', alignItems: 'center' },
  titulo: { margin: 0, fontSize: '22px', fontWeight: 'bold' },
  filterRow: { display: 'flex', gap: '10px' },
  searchBox: { background: '#111', padding: '10px 15px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #222' },
  inputBusca: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '150px' },
  dateInput: { background: '#111', border: '1px solid #222', color: '#fff', borderRadius: '10px', padding: '10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' },
  cardMotorista: { background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '20px', padding: '20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px' },
  avatar: { width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nomeLabel: { color: '#fff', fontWeight: 'bold', fontSize: '14px' },
  resumoLabel: { color: '#444', fontSize: '9px', fontWeight: 'bold' },
  resumoValue: { color: '#FFD700', fontSize: '18px', fontWeight: '900' },
  contentLog: { background: '#111', padding: '12px', borderRadius: '12px', marginBottom: '8px' },
  logHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  badge: { fontSize: '9px', fontWeight: 'bold', background: '#222', padding: '2px 6px', borderRadius: '4px' },
  horaLabel: { fontSize: '13px', fontWeight: 'bold', color: '#FFD700' },
  dataRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  kmDisplay: { display: 'flex', alignItems: 'center', gap: '6px' },
  kmValue: { fontSize: '14px', fontWeight: 'bold' },
  locInfo: { display: 'flex', alignItems: 'center', gap: '4px' },
  locText: { color: '#444', fontSize: '11px' },
  emptyState: { padding: '10px', textAlign: 'center', color: '#333', fontSize: '12px' }
};