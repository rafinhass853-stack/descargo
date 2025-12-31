import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, collection, onSnapshot, query, 
  orderBy, doc, updateDoc, deleteDoc
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Gauge, MapPin, Clock, User, Search, AlertTriangle, Calendar, Edit2, Trash2
} from 'lucide-react';

// Configuração Firebase
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
  const [motoristasNomes, setMotoristasNomes] = useState({});
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroData, setFiltroData] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const unsubMot = onSnapshot(query(collection(db, "cadastro_motoristas")), (snapshot) => {
      let nomes = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        nomes[doc.id] = data.nome;
        if(data.uid) nomes[data.uid] = data.nome;
      });
      setMotoristasNomes(nomes);
    });

    const qJor = query(collection(db, "historico_jornadas"), orderBy("timestamp", "desc"));
    const unsubJor = onSnapshot(qJor, (snapshot) => {
      const lista = [];
      snapshot.forEach(doc => lista.push({ id: doc.id, ...doc.data() }));
      setRegistros(lista);
    });

    return () => { unsubMot(); unsubJor(); };
  }, []);

  // --- FUNÇÕES DE GESTÃO ---
  const editarKM = async (id, kmAtual) => {
    const novoKM = prompt("Digite o novo valor de KM para este registro:", kmAtual);
    if (novoKM !== null && !isNaN(novoKM)) {
      try {
        await updateDoc(doc(db, "historico_jornadas", id), { km: Number(novoKM) });
        alert("KM atualizado com sucesso!");
      } catch (e) { alert("Erro ao atualizar."); }
    }
  };

  const excluirRegistro = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este registro permanentemente?")) {
      try {
        await deleteDoc(doc(db, "historico_jornadas", id));
      } catch (e) { alert("Erro ao excluir."); }
    }
  };

  const motoristasAgrupados = useMemo(() => {
    const grupos = {};
    const cronologico = [...registros].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    cronologico.forEach((reg) => {
      const dataReg = reg.timestamp ? new Date(reg.timestamp.seconds * 1000).toISOString().split('T')[0] : null;
      if (dataReg !== filtroData) return;

      const nomeReal = motoristasNomes[reg.motoristaId] || reg.motoristaNome || "Motorista Externo";
      if (!grupos[nomeReal]) grupos[nomeReal] = [];
      
      let alertas = [];
      const historicoDoMotorista = cronologico.filter(r => r.motoristaId === reg.motoristaId);
      const idx = historicoDoMotorista.findIndex(r => r.id === reg.id);
      const anterior = historicoDoMotorista[idx - 1];

      if (anterior) {
        if (Number(reg.km) < Number(anterior.km)) {
          alertas.push({ tipo: 'ERRO', msg: 'KM MENOR QUE ANTERIOR' });
        }
        if (reg.tipo === 'INICIO' && anterior.tipo === 'FIM') {
          const salto = Number(reg.km) - Number(anterior.km);
          if (salto > 2) alertas.push({ tipo: 'AVISO', msg: `SALTO DE ${salto}KM` });
        }
      }
      grupos[nomeReal].push({ ...reg, listaAlertas: alertas });
    });

    Object.keys(grupos).forEach(n => grupos[n].reverse());
    return grupos;
  }, [registros, motoristasNomes, filtroData]);

  const nomesFiltrados = Object.keys(motoristasAgrupados).filter(n => n.toLowerCase().includes(filtroNome.toLowerCase()));

  return (
    <div style={styles.container}>
      {/* Header e Filtros (Igual ao anterior) */}
      <div style={styles.headerArea}>
        <div style={styles.brand}>
          <div style={styles.logoIcon}><Gauge size={20} color="#000" /></div>
          <div>
            <h2 style={styles.titulo}>Jornada e Hodômetro</h2>
            <span style={styles.sub}>Painel de Auditoria e Ajustes</span>
          </div>
        </div>
        <div style={styles.filterRow}>
          <div style={styles.inputGroup}>
            <Calendar size={14} color="#FFD700" />
            <input type="date" style={styles.dateInput} value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
          </div>
          <div style={styles.searchBox}>
            <Search size={16} color="#555" />
            <input style={styles.inputBusca} placeholder="Buscar motorista..." onChange={(e) => setFiltroNome(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {nomesFiltrados.map((nome) => {
          const logs = motoristasAgrupados[nome];
          const kms = logs.map(l => Number(l.km) || 0);
          const kmRodadoDia = Math.max(...kms) - Math.min(...kms);

          return (
            <div key={nome} style={styles.cardMotorista}>
              <div style={styles.cardHeader}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <div style={styles.avatar}><User size={16} color="#000" /></div>
                  <span style={styles.nomeLabel}>{nome.toUpperCase()}</span>
                </div>
                <div style={styles.resumoDia}>
                   <span style={styles.resumoLabel}>RODADO NO DIA:</span>
                   <span style={styles.resumoValue}>{kmRodadoDia} KM</span>
                </div>
              </div>

              <div style={styles.timeline}>
                {logs.map((log, idx) => (
                  <div key={log.id} style={styles.itemLog}>
                    <div style={styles.statusIndicator}>
                      <div style={{...styles.ponto, backgroundColor: log.tipo === 'INICIO' ? '#2ecc71' : '#e67e22'}} />
                      {idx !== logs.length - 1 && <div style={styles.linha} />}
                    </div>

                    <div style={styles.contentLog}>
                      <div style={styles.logHeader}>
                        <div style={{display:'flex', gap: '8px', alignItems:'center'}}>
                            <span style={{...styles.badge, color: log.tipo === 'INICIO' ? '#2ecc71' : '#e67e22'}}>
                            {log.tipo === 'INICIO' ? 'ABERTURA' : 'FECHAMENTO'}
                            </span>
                            <button onClick={() => excluirRegistro(log.id)} style={styles.btnAcao} title="Excluir registro">
                                <Trash2 size={12} color="#444" />
                            </button>
                        </div>
                        
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px'}}>
                            {log.listaAlertas.map((a, i) => (
                                <div key={i} style={{...styles.alertaTag, color: a.tipo === 'ERRO' ? '#ff4d4d' : '#FFD700', borderColor: a.tipo === 'ERRO' ? '#ff4d4d' : '#FFD700'}}>
                                    <AlertTriangle size={10} />
                                    <span>{a.msg}</span>
                                </div>
                            ))}
                            <span style={styles.dataLog}>{log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString('pt-BR') : '...'}</span>
                        </div>
                      </div>

                      <div style={styles.detalhes}>
                        <div style={{...styles.detalheItem, cursor: 'pointer'}} onClick={() => editarKM(log.id, log.km)}>
                          <Gauge size={12} color="#FFD700" />
                          <span style={{fontWeight: 'bold', borderBottom: '1px dashed #444'}}>{log.km} KM</span>
                          <Edit2 size={10} color="#444" />
                        </div>
                        <div style={styles.detalheItem}>
                          <MapPin size={12} color="#888" />
                          <span>{log.cidade || '---'}</span>
                        </div>
                        {log.duracaoFinal && (
                          <div style={styles.detalheItem}>
                            <Clock size={12} color="#2ecc71" />
                            <span>{log.duracaoFinal}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '20px', backgroundColor: '#000', minHeight: '100vh' },
  headerArea: { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' },
  brand: { display: 'flex', gap: '12px', alignItems: 'center' },
  logoIcon: { backgroundColor: '#FFD700', padding: '10px', borderRadius: '10px' },
  titulo: { color: '#fff', margin: 0, fontSize: '18px' },
  sub: { color: '#666', fontSize: '10px', textTransform: 'uppercase' },
  filterRow: { display: 'flex', gap: '10px' },
  inputGroup: { background: '#111', padding: '8px 15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' },
  dateInput: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '12px' },
  searchBox: { background: '#111', padding: '8px 15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' },
  inputBusca: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '180px', fontSize: '12px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '20px' },
  cardMotorista: { background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '16px', padding: '20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: '15px', marginBottom: '20px' },
  avatar: { backgroundColor: '#FFD700', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nomeLabel: { color: '#fff', fontWeight: 'bold', fontSize: '14px' },
  resumoDia: { textAlign: 'right' },
  resumoLabel: { color: '#444', fontSize: '9px', fontWeight: 'bold' },
  resumoValue: { color: '#FFD700', fontSize: '16px', fontWeight: '900' },
  timeline: { display: 'flex', flexDirection: 'column' },
  itemLog: { display: 'flex', gap: '15px' },
  statusIndicator: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  ponto: { width: '8px', height: '8px', borderRadius: '50%', marginTop: '5px' },
  linha: { width: '1px', flex: 1, backgroundColor: '#1a1a1a', margin: '5px 0' },
  contentLog: { flex: 1, background: '#0d0d0d', padding: '15px', borderRadius: '12px', marginBottom: '15px', border: '1px solid #151515' },
  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' },
  badge: { fontSize: '10px', fontWeight: 'bold' },
  btnAcao: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' },
  dataLog: { color: '#333', fontSize: '10px', fontWeight: 'bold' },
  alertaTag: { display: 'flex', alignItems: 'center', gap: '5px', padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: '900', border: '1px solid' },
  detalhes: { display: 'flex', gap: '20px' },
  detalheItem: { display: 'flex', alignItems: 'center', gap: '6px', color: '#888', fontSize: '12px' }
};