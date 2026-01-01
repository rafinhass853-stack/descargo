import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { 
    collection, addDoc, onSnapshot, query, 
    deleteDoc, doc, orderBy, updateDoc, getDocs, where 
} from "firebase/firestore";
import { 
    Container, Plus, Trash2, 
    Box, UserPlus, UserMinus, Edit3, CheckCircle, XCircle, Gauge, Filter 
} from 'lucide-react';

const Carretas = () => {
    const [carretas, setCarretas] = useState([]);
    const [motoristas, setMotoristas] = useState([]); 
    const [editandoId, setEditandoId] = useState(null);
    
    // ESTADOS DE FILTRO
    const [filtroTipo, setFiltroTipo] = useState('TODOS');
    const [filtroCapacidade, setFiltroCapacidade] = useState('TODOS');

    const [novaCarreta, setNovaCarreta] = useState({
        placa: '',
        tipo: 'Sider',
        capacidade: '',
        motorista_id: '',
        motorista_nome: 'SEM MOTORISTA'
    });

    useEffect(() => {
        const qCarretas = query(collection(db, "carretas"), orderBy("placa", "asc"));
        const unsubscribeCarretas = onSnapshot(qCarretas, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setCarretas(lista);
        });

        const qMotoristas = query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc"));
        const unsubscribeMotoristas = onSnapshot(qMotoristas, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() }));
            setMotoristas(lista);
        });

        return () => { unsubscribeCarretas(); unsubscribeMotoristas(); };
    }, []);

    // --- CÁLCULO DE ESTATÍSTICAS ---
    const totalGeral = carretas.length;
    const total28 = carretas.filter(c => c.capacidade === "28").length;
    const total30 = carretas.filter(c => c.capacidade === "30").length;

    // --- LÓGICA DE FILTRAGEM COMBINADA ---
    const carretasFiltradas = carretas.filter(c => {
        const matchTipo = filtroTipo === 'TODOS' || c.tipo.toUpperCase() === filtroTipo.toUpperCase();
        const matchCap = filtroCapacidade === 'TODOS' || c.capacidade === filtroCapacidade;
        return matchTipo && matchCap;
    });

    const desassociarMotorista = async (carretaId) => {
        if (window.confirm("Deseja remover o motorista desta carreta?")) {
            try {
                await updateDoc(doc(db, "carretas", carretaId), {
                    motorista_id: '',
                    motorista_nome: 'SEM MOTORISTA'
                });
            } catch (e) { alert("Erro ao desassociar."); }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (novaCarreta.placa.length < 8) return alert("Placa inválida!");
        try {
            if (editandoId) {
                await updateDoc(doc(db, "carretas", editandoId), novaCarreta);
                setEditandoId(null);
            } else {
                await addDoc(collection(db, "carretas"), novaCarreta);
            }
            setNovaCarreta({ placa: '', tipo: 'Sider', capacidade: '', motorista_id: '', motorista_nome: 'SEM MOTORISTA' });
        } catch (error) { alert("Erro ao salvar."); }
    };

    const prepararEdicao = (item) => {
        setEditandoId(item.id);
        setNovaCarreta({ ...item });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const excluirCarreta = async (id) => {
        if (window.confirm("Deseja excluir esta carreta?")) {
            await deleteDoc(doc(db, "carretas", id));
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.titulo}>Gestão de Carretas</h2>

            {/* FORMULÁRIO */}
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Placa</label>
                    <input style={styles.input} maxLength={8} value={novaCarreta.placa} onChange={(e) => setNovaCarreta({...novaCarreta, placa: e.target.value.toUpperCase()})} />
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Tipo</label>
                    <select style={styles.input} value={novaCarreta.tipo} onChange={(e) => setNovaCarreta({...novaCarreta, tipo: e.target.value})}>
                        <option value="Sider">Sider</option>
                        <option value="Baú">Baú</option>
                        <option value="Grade Baixa">Grade Baixa</option>
                        <option value="Prancha">Prancha</option>
                    </select>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Capacidade (Paletes)</label>
                    <select style={styles.input} value={novaCarreta.capacidade} onChange={(e) => setNovaCarreta({...novaCarreta, capacidade: e.target.value})}>
                        <option value="">Selecione...</option>
                        <option value="28">28 Paletes</option>
                        <option value="30">30 Paletes</option>
                    </select>
                </div>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Motorista</label>
                    <select style={styles.input} value={novaCarreta.motorista_id} onChange={(e) => {
                        const mot = motoristas.find(m => m.id === e.target.value);
                        setNovaCarreta({...novaCarreta, motorista_id: e.target.value, motorista_nome: mot ? mot.nome : 'SEM MOTORISTA'});
                    }}>
                        <option value="">-- Sem Motorista --</option>
                        {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                </div>
                <button type="submit" style={{...styles.btnAdicionar, backgroundColor: editandoId ? '#2ecc71' : '#FFD700'}}>
                    {editandoId ? 'Atualizar' : 'Cadastrar'}
                </button>
            </form>

            {/* PAINEL DE ESTATÍSTICAS RÁPIDAS */}
            <div style={styles.statsContainer}>
                <div style={styles.statCard}>
                    <span style={styles.statLabel}>TOTAL</span>
                    <span style={styles.statValue}>{totalGeral}</span>
                </div>
                <div style={{...styles.statCard, borderLeft: '3px solid #FFD700'}}>
                    <span style={styles.statLabel}>28 PALETES</span>
                    <span style={styles.statValue}>{total28}</span>
                </div>
                <div style={{...styles.statCard, borderLeft: '3px solid #3498db'}}>
                    <span style={styles.statLabel}>30 PALETES</span>
                    <span style={styles.statValue}>{total30}</span>
                </div>
            </div>

            {/* SEÇÃO DE FILTROS */}
            <div style={styles.filterSection}>
                <div style={styles.filterBar}>
                    <span style={styles.labelFiltro}><Filter size={14}/> TIPO:</span>
                    {['TODOS', 'SIDER', 'BAÚ', 'GRADE BAIXA'].map(t => (
                        <button key={t} onClick={() => setFiltroTipo(t)} style={{...styles.btnFiltro, backgroundColor: filtroTipo === t ? '#FFD700' : '#111', color: filtroTipo === t ? '#000' : '#888'}}>{t}</button>
                    ))}
                </div>

                <div style={styles.filterBar}>
                    <span style={styles.labelFiltro}><Gauge size={14}/> CAPACIDADE:</span>
                    {['TODOS', '28', '30'].map(c => (
                        <button key={c} onClick={() => setFiltroCapacidade(c)} style={{...styles.btnFiltro, backgroundColor: filtroCapacidade === c ? '#3498db' : '#111', color: filtroCapacidade === c ? '#FFF' : '#888', borderColor: filtroCapacidade === c ? '#3498db' : '#333'}}>
                            {c === 'TODOS' ? 'TODAS' : `${c} PLTS`}
                        </button>
                    ))}
                </div>
            </div>

            {/* GRID */}
            <div style={styles.grid}>
                {carretasFiltradas.map((item) => (
                    <div key={item.id} style={{...styles.card, borderLeft: item.motorista_id ? '4px solid #3498db' : '4px solid #FFD700'}}>
                        <div style={styles.cardHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Container size={24} color="#FFD700" />
                                <span style={styles.placaText}>{item.placa}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => prepararEdicao(item)} style={styles.btnIconEdit}><Edit3 size={18} /></button>
                                <button onClick={() => excluirCarreta(item.id)} style={styles.btnExcluir}><Trash2 size={18} /></button>
                            </div>
                        </div>
                        <div style={styles.cardBody}>
                            <div style={styles.motoristaBox}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px', flex: 1}}>
                                    <UserPlus size={14} color={item.motorista_id ? "#3498db" : "#666"} />
                                    <div style={{display: 'flex', flexDirection: 'column'}}>
                                        <span style={{fontSize: '10px', color: '#666'}}>MOTORISTA:</span>
                                        <span style={{fontSize: '13px', color: item.motorista_id ? '#3498db' : '#888', fontWeight: 'bold'}}>{item.motorista_nome}</span>
                                    </div>
                                </div>
                                {item.motorista_id && (
                                    <button onClick={() => desassociarMotorista(item.id)} style={styles.btnDesassociar}><UserMinus size={16} /></button>
                                )}
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '5px'}}>
                                <p style={styles.info}><Box size={14} /> {item.tipo}</p>
                                <p style={{...styles.info, color: '#FFD700'}}><Gauge size={14} /> {item.capacidade} Plts</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '10px', color: '#FFF' },
    titulo: { color: '#FFD700', fontSize: '22px', marginBottom: '20px', borderLeft: '4px solid #FFD700', paddingLeft: '10px' },
    form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', backgroundColor: '#111', padding: '20px', borderRadius: '12px', marginBottom: '20px', alignItems: 'end', border: '1px solid #222' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
    label: { fontSize: '11px', color: '#888', fontWeight: 'bold' },
    input: { backgroundColor: '#000', border: '1px solid #333', padding: '10px', borderRadius: '6px', color: '#FFF', outline: 'none' },
    btnAdicionar: { backgroundColor: '#FFD700', color: '#000', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', height: '42px' },
    
    statsContainer: { display: 'flex', gap: '10px', marginBottom: '20px' },
    statCard: { backgroundColor: '#0a0a0a', padding: '10px 20px', borderRadius: '8px', border: '1px solid #222', flex: 1, textAlign: 'center' },
    statLabel: { fontSize: '9px', color: '#666', fontWeight: 'bold' },
    statValue: { fontSize: '18px', fontWeight: 'bold', display: 'block' },

    filterSection: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', backgroundColor: '#0a0a0a', padding: '15px', borderRadius: '10px', border: '1px solid #222' },
    filterBar: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
    labelFiltro: { color: '#666', fontSize: '10px', fontWeight: 'bold', minWidth: '80px' },
    btnFiltro: { padding: '5px 12px', borderRadius: '4px', border: '1px solid #333', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' },
    card: { backgroundColor: '#111', borderRadius: '12px', padding: '15px', border: '1px solid #222' },
    cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
    placaText: { fontSize: '18px', fontWeight: 'bold' },
    btnExcluir: { background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' },
    btnIconEdit: { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' },
    cardBody: { display: 'flex', flexDirection: 'column', gap: '8px' },
    motoristaBox: { backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px dashed #333' },
    btnDesassociar: { background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' },
    info: { margin: 0, fontSize: '13px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '5px' }
};

export default Carretas;