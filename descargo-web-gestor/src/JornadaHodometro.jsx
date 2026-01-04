import React, { useState, useEffect, useMemo } from 'react';
import { 
  getFirestore, collection, onSnapshot, query, 
  orderBy, doc, updateDoc, deleteDoc
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Gauge, MapPin, Clock, User, Search, AlertTriangle, Calendar, Edit2, Trash2, ArrowRight
} from 'lucide-react';

// Configuração Firebase (Mantida a sua configuração original)
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

  // FUNÇÃO DE EDIÇÃO DE KM (IMPORTANTE PARA CORREÇÕES)
  const editarKM = async (id, kmAtual) => {
    const novoKM = prompt(`KM Atual: ${kmAtual}\nDigite o valor correto do KM:`, kmAtual);
    if (novoKM !== null && !isNaN(novoKM) && novoKM !== "") {
      try {
        await updateDoc(doc(db, "historico_jornadas", id), { km: Number(novoKM) });
      } catch (e) { alert("Erro ao atualizar o KM no banco de dados."); }
    }
  };

  const excluirRegistro = async (id) => {
    if (window.confirm("Deseja excluir este registro permanentemente?")) {
      try { await deleteDoc(doc(db, "historico_jornadas", id)); } catch (e) { alert("Erro ao excluir."); }
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

      // Verificação de inconsistência de KM
      if (anterior && Number(reg.km) < Number(anterior.km)) {
        alertas.push({ tipo: 'ERRO', msg: 'KM MENOR QUE O ANTERIOR' });
      }
      
      grupos[nomeReal].push({ ...reg, listaAlertas: alertas });
    });

    Object.keys(grupos).forEach(n => grupos[n].reverse());
    return grupos;
  }, [registros, motoristasNomes, filtroData]);

  const nomesFiltrados = Object.keys(motoristasAgrupados).filter(n => n.toLowerCase().includes(filtroNome.toLowerCase()));

  return (
    <div style={styles.container}>
      {/* HEADER PRINCIPAL */}
      <div style={styles.headerArea}>
        <div style={styles.brand}>
          <div style={styles.logoIcon}><Gauge size={24} color="#000" /></div>
          <div>
            <h2 style={styles.titulo}>Controle de KM e Jornada</h2>
            <span style={styles.sub}>Auditoria de Aberturas e Fechamentos</span>
          </div>
        </div>
        <div style={styles.filterRow}>
          <div style={styles.inputGroup}>
            <Calendar size={16} color="#FFD700" />
            <input type="date" style={styles.dateInput} value={filtroData} onChange={(e) => setFiltroData(e.target.value)} />
          </div>
          <div style={styles.searchBox}>
            <Search size={18} color="#555" />
            <input style={styles.inputBusca} placeholder="Filtrar motorista..." onChange={(e) => setFiltroNome(e.target.value)} />
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {nomesFiltrados.map((nome) => {
          const logs = motoristasAgrupados[nome];
          const kms = logs.map(l => Number(l.km) || 0);
          // CÁLCULO DE KM RODADO NO DIA (DIFERENÇA ENTRE O MAIOR E MENOR REGISTRO)
          const kmRodadoDia = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0;

          return (
            <div key={nome} style={styles.cardMotorista}>
              <div style={styles.cardHeader}>
                <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                  <div style={styles.avatar}><User size={20} color="#000" /></div>
                  <span style={styles.nomeLabel}>{nome.toUpperCase()}</span>
                </div>
                <div style={styles.resumoDia}>
                   <span style={styles.resumoLabel}>KM RODADO (CÁLCULO)</span>
                   <span style={styles.resumoValue}>{kmRodadoDia} KM</span>
                </div>
              </div>

              <div style={styles.timeline}>
                {logs.map((log, idx) => {
                  const isInicio = log.tipo === 'INICIO';
                  const corAcao = isInicio ? '#2ecc71' : '#e67e22';
                  const dataFormatada = log.timestamp?.seconds 
                    ? new Date(log.timestamp.seconds * 1000).toLocaleDateString('pt-BR') 
                    : '--/--/--';
                  const horaFormatada = log.timestamp?.seconds 
                    ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second:'2-digit'}) 
                    : '--:--:--';

                  return (
                    <div key={log.id} style={styles.itemLog}>
                      <div style={styles.statusIndicator}>
                        <div style={{...styles.ponto, backgroundColor: corAcao}} />
                        {idx !== logs.length - 1 && <div style={styles.linha} />}
                      </div>

                      <div style={styles.contentLog}>
                        <div style={styles.logHeader}>
                          <div style={{display:'flex', gap: '12px', alignItems:'center'}}>
                              <div style={{...styles.badge, backgroundColor: corAcao, color: '#000'}}>
                                {isInicio ? 'ABERTURA' : 'FECHAMENTO'}
                              </div>
                              <span style={styles.dataLogText}>{dataFormatada}</span>
                              <button onClick={() => excluirRegistro(log.id)} style={styles.btnTrash}>
                                  <Trash2 size={16} color="#444" />
                              </button>
                          </div>
                          
                          <div style={styles.horaBadge}>
                             <span style={{...styles.horaLabel, color: corAcao}}>{horaFormatada}</span>
                          </div>
                        </div>

                        {/* SEÇÃO DE KM E EDIÇÃO */}
                        <div style={styles.dataRow}>
                          <div style={styles.kmDisplay} onClick={() => editarKM(log.id, log.km)}>
                            <Gauge size={16} color="#FFD700" />
                            <div style={{display:'flex', flexDirection:'column'}}>
                                <span style={styles.kmValue}>{log.km} KM</span>
                                <span style={styles.editHint}>Clique para editar KM</span>
                            </div>
                            <Edit2 size={14} color="#FFD700" style={{marginLeft: '10px'}} />
                          </div>
                          
                          <div style={styles.locInfo}>
                            <MapPin size={16} color="#888" />
                            <span style={styles.locText}>{log.cidade || 'Local não informado'}</span>
                          </div>
                        </div>

                        {log.listaAlertas.length > 0 && (
                          <div style={styles.alertBox}>
                            <AlertTriangle size={14} color="#ff4d4d" />
                            <span>{log.listaAlertas[0].msg}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '30px', backgroundColor: '#000', minHeight: '100vh', color: '#fff' },
  headerArea: { display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'center' },
  brand: { display: 'flex', gap: '15px', alignItems: 'center' },
  logoIcon: { backgroundColor: '#FFD700', padding: '12px', borderRadius: '12px' },
  titulo: { margin: 0, fontSize: '22px', fontWeight: 'bold' },
  sub: { color: '#666', fontSize: '12px', textTransform: 'uppercase' },
  filterRow: { display: 'flex', gap: '15px' },
  inputGroup: { background: '#111', padding: '12px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #222' },
  dateInput: { background: 'transparent', border: 'none', color: '#fff', outline: 'none' },
  searchBox: { background: '#111', padding: '12px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #222' },
  inputBusca: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', width: '220px' },
  
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))', gap: '30px' },
  cardMotorista: { background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '24px', padding: '25px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', paddingBottom: '20px', marginBottom: '25px' },
  avatar: { backgroundColor: '#FFD700', width: '45px', height: '45px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nomeLabel: { color: '#fff', fontWeight: 'bold', fontSize: '17px' },
  resumoDia: { textAlign: 'right' },
  resumoLabel: { color: '#444', fontSize: '10px', fontWeight: '900' },
  resumoValue: { color: '#FFD700', fontSize: '22px', fontWeight: '900' },

  timeline: { display: 'flex', flexDirection: 'column' },
  itemLog: { display: 'flex', gap: '20px' },
  statusIndicator: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  ponto: { width: '12px', height: '12px', borderRadius: '50%', marginTop: '10px' },
  linha: { width: '2px', flex: 1, backgroundColor: '#1a1a1a', margin: '10px 0' },
  
  contentLog: { flex: 1, background: '#111', padding: '20px', borderRadius: '20px', marginBottom: '20px', border: '1px solid #1f1f1f' },
  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' },
  badge: { fontSize: '10px', fontWeight: '900', padding: '5px 12px', borderRadius: '8px' },
  dataLogText: { color: '#666', fontSize: '13px', fontWeight: 'bold' },
  horaBadge: { background: '#000', padding: '8px 15px', borderRadius: '10px', border: '1px solid #222' },
  horaLabel: { fontSize: '18px', fontWeight: '800', fontFamily: 'monospace' },
  
  dataRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  kmDisplay: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    cursor: 'pointer', 
    background: '#1a1a1a', 
    padding: '10px 15px', 
    borderRadius: '12px',
    border: '1px dashed #333' 
  },
  kmValue: { fontSize: '18px', fontWeight: 'bold', color: '#FFD700' },
  editHint: { fontSize: '9px', color: '#555', textTransform: 'uppercase' },
  
  locInfo: { display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '180px' },
  locText: { color: '#888', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  
  alertBox: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px', color: '#ff4d4d', fontSize: '11px', fontWeight: 'bold', background: 'rgba(255, 77, 77, 0.1)', padding: '8px 12px', borderRadius: '8px' },
  btnTrash: { background: 'none', border: 'none', cursor: 'pointer' }
};