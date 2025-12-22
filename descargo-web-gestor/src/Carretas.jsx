import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, addDoc, onSnapshot, query, deleteDoc, doc } from "firebase/firestore";
import { Container, Plus, Trash2, Hash, Gauge, Box } from 'lucide-react';

const Carretas = () => {
    const [carretas, setCarretas] = useState([]);
    const [novaCarreta, setNovaCarreta] = useState({
        placa: '',
        tipo: 'Sider',
        capacidade: '',
        modeloMarca: ''
    });

    // Busca as carretas no Firebase em tempo real
    useEffect(() => {
        const q = query(collection(db, "carretas"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setCarretas(lista);
        });
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!novaCarreta.placa || !novaCarreta.capacidade) return alert("Preencha os campos obrigatórios!");

        try {
            await addDoc(collection(db, "carretas"), novaCarreta);
            setNovaCarreta({ placa: '', tipo: 'Sider', capacidade: '', modeloMarca: '' });
        } catch (error) {
            console.error("Erro ao salvar carreta:", error);
        }
    };

    const excluirCarreta = async (id) => {
        if (window.confirm("Deseja excluir esta carreta?")) {
            await deleteDoc(doc(db, "carretas", id));
        }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.titulo}>Gestão de Carretas</h2>

            {/* Formulário de Cadastro */}
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

                <button type="submit" style={styles.btnAdicionar}>
                    <Plus size={20} /> Cadastrar
                </button>
            </form>

            {/* Lista de Carretas */}
            <div style={styles.grid}>
                {carretas.map((item) => (
                    <div key={item.id} style={styles.card}>
                        <div style={styles.cardHeader}>
                            <Container size={24} color="#FFD700" />
                            <span style={styles.placaText}>{item.placa}</span>
                            <button onClick={() => excluirCarreta(item.id)} style={styles.btnExcluir}>
                                <Trash2 size={18} />
                            </button>
                        </div>
                        
                        <div style={styles.cardBody}>
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
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
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
        outline: 'none'
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
        gap: '8px'
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' },
    card: { 
        backgroundColor: '#111', 
        borderRadius: '12px', 
        padding: '15px', 
        borderLeft: '4px solid #FFD700',
        transition: '0.3s'
    },
    cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' },
    placaText: { fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px' },
    btnExcluir: { background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' },
    cardBody: { display: 'flex', flexDirection: 'column', gap: '8px' },
    info: { margin: 0, fontSize: '14px', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px' }
};

export default Carretas;