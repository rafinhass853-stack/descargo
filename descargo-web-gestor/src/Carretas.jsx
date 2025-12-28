import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { 
    collection, addDoc, onSnapshot, query, 
    deleteDoc, doc, orderBy, updateDoc 
} from "firebase/firestore";
import { 
    Container, Plus, Trash2, Hash, Gauge, 
    Box, UserPlus, Edit3, CheckCircle, XCircle 
} from 'lucide-react';

const Carretas = () => {
    const [carretas, setCarretas] = useState([]);
    const [motoristas, setMotoristas] = useState([]); // Lista para o dropdown
    const [editandoId, setEditandoId] = useState(null);
    const [novaCarreta, setNovaCarreta] = useState({
        placa: '',
        tipo: 'Sider',
        capacidade: '',
        modeloMarca: '',
        motorista_id: '',
        motorista_nome: 'SEM MOTORISTA'
    });

    // Busca as carretas e motoristas no Firebase em tempo real
    useEffect(() => {
        // Monitoramento de Carretas
        const qCarretas = query(collection(db, "carretas"), orderBy("placa", "asc"));
        const unsubscribeCarretas = onSnapshot(qCarretas, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setCarretas(lista);
        });

        // Monitoramento de Motoristas
        const qMotoristas = query(collection(db, "cadastro_motoristas"), orderBy("nome", "asc"));
        const unsubscribeMotoristas = onSnapshot(qMotoristas, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setMotoristas(lista);
        });

        return () => {
            unsubscribeCarretas();
            unsubscribeMotoristas();
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!novaCarreta.placa || !novaCarreta.capacidade) return alert("Preencha os campos obrigatórios!");

        try {
            if (editandoId) {
                await updateDoc(doc(db, "carretas", editandoId), novaCarreta);
                setEditandoId(null);
            } else {
                await addDoc(collection(db, "carretas"), novaCarreta);
            }
            setNovaCarreta({ 
                placa: '', tipo: 'Sider', capacidade: '', 
                modeloMarca: '', motorista_id: '', motorista_nome: 'SEM MOTORISTA' 
            });
        } catch (error) {
            console.error("Erro ao salvar carreta:", error);
        }
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

    const handleSelectMotorista = (e) => {
        const id = e.target.value;
        if (!id) {
            setNovaCarreta({ ...novaCarreta, motorista_id: '', motorista_nome: 'SEM MOTORISTA' });
        } else {
            const mot = motoristas.find(m => m.id === id);
            setNovaCarreta({ 
                ...novaCarreta, 
                motorista_id: id, 
                motorista_nome: mot.nome 
            });
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.titulo}>Gestão de Carretas</h2>

            {/* Formulário de Cadastro / Edição */}
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.inputGroup}>
                    <label style={styles.label}>Placa</label>
                    <input 
                        style={styles.input}
                        placeholder="ABC-1234"
                        value={novaCarreta.placa}
                        onChange={(e) => setNovaCarreta({...novaCarreta, placa: e.target.value.toUpperCase()})}
                    />
                </div>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>Tipo</label>
                    <select 
                        style={styles.input}
                        value={novaCarreta.tipo}
                        onChange={(e) => setNovaCarreta({...novaCarreta, tipo: e.target.value})}
                    >
                        <option value="Sider">Sider</option>
                        <option value="Baú">Baú</option>
                        <option value="Grade Baixa">Grade Baixa</option>
                        <option value="Prancha">Prancha</option>
                    </select>
                </div>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>Associar Motorista</label>
                    <select 
                        style={{...styles.input, color: novaCarreta.motorista_id ? '#FFD700' : '#888'}} 
                        value={novaCarreta.motorista_id} 
                        onChange={handleSelectMotorista}
                    >
                        <option value="">-- Sem Motorista --</option>
                        {motoristas.map(m => (
                            <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                    </select>
                </div>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>Qtd Paletes</label>
                    <input 
                        type="number"
                        style={styles.input}
                        placeholder="Ex: 28"
                        value={novaCarreta.capacidade}
                        onChange={(e) => setNovaCarreta({...novaCarreta, capacidade: e.target.value})}
                    />
                </div>

                <div style={styles.inputGroup}>
                    <label style={styles.label}>Modelo / Marca</label>
                    <input 
                        style={styles.input}
                        placeholder="Ex: Randon 2024"
                        value={novaCarreta.modeloMarca}
                        onChange={(e) => setNovaCarreta({...novaCarreta, modeloMarca: e.target.value})}
                    />
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
                                setNovaCarreta({
                                    placa: '', tipo: 'Sider', capacidade: '', 
                                    modeloMarca: '', motorista_id: '', motorista_nome: 'SEM MOTORISTA'
                                })
                            }} 
                            style={{...styles.btnAdicionar, backgroundColor: '#e74c3c'}}
                        >
                            <XCircle size={20} /> Cancelar
                        </button>
                    )}
                </div>
            </form>

            {/* Lista de Carretas */}
            <div style={styles.grid}>
                {carretas.map((item) => (
                    <div key={item.id} style={{...styles.card, borderLeft: item.motorista_id ? '4px solid #3498db' : '4px solid #FFD700'}}>
                        <div style={styles.cardHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Container size={24} color="#FFD700" />
                                <span style={styles.placaText}>{item.placa}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => prepararEdicao(item)} style={styles.btnIconEdit} title="Editar"><Edit3 size={18} /></button>
                                <button onClick={() => excluirCarreta(item.id)} style={styles.btnExcluir} title="Excluir"><Trash2 size={18} /></button>
                            </div>
                        </div>
                        
                        <div style={styles.cardBody}>
                            {/* Box do Motorista Associado */}
                            <div style={styles.motoristaBox}>
                                <UserPlus size={14} color={item.motorista_id ? "#3498db" : "#666"} />
                                <div style={{display: 'flex', flexDirection: 'column'}}>
                                    <span style={{fontSize: '10px', color: '#666', fontWeight: 'bold'}}>MOTORISTA:</span>
                                    <span style={{fontSize: '13px', color: item.motorista_id ? '#3498db' : '#888', fontWeight: 'bold'}}>
                                        {item.motorista_nome || 'SEM MOTORISTA'}
                                    </span>
                                </div>
                            </div>

                            <p style={styles.info}><Box size={14} /> <strong>Tipo:</strong> {item.tipo}</p>
                            <p style={styles.info}><Gauge size={14} /> <strong>Capacidade:</strong> {item.capacidade} paletes</p>
                            <p style={styles.info}><Hash size={14} /> <strong>Modelo:</strong> {item.modeloMarca}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

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
    label: { fontSize: '12px', color: '#888', fontWeight: 'bold' },
    input: { 
        backgroundColor: '#000', 
        border: '1px solid #333', 
        padding: '10px', 
        borderRadius: '6px', 
        color: '#FFF',
        outline: 'none',
        fontSize: '14px'
    },
    btnAdicionar: { 
        backgroundColor: '#FFD700', 
        color: '#000', 
        border: 'none', 
        padding: '10px', 
        borderRadius: '6px', 
        fontWeight: 'bold', 
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        height: '42px'
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
    card: { 
        backgroundColor: '#111', 
        borderRadius: '12px', 
        padding: '15px', 
        border: '1px solid #222',
        transition: '0.3s'
    },
    cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' },
    placaText: { fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' },
    btnExcluir: { background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' },
    btnIconEdit: { background: 'none', border: 'none', color: '#3498db', cursor: 'pointer' },
    cardBody: { display: 'flex', flexDirection: 'column', gap: '8px' },
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
    info: { margin: 0, fontSize: '14px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }
};

export default Carretas;