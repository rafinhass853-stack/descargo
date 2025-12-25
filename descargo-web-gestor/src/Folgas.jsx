import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, onSnapshot, addDoc, query, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { Calendar as CalendarIcon, User, Plus, Trash2, Clock } from 'lucide-react';

const Folgas = () => {
    const [motoristas, setMotoristas] = useState([]);
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [motoristaId, setMotoristaId] = useState('');
    const [tipo, setTipo] = useState('Folga');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');

    useEffect(() => {
        // Carregar Motoristas para o Select
        const unsubMotoristas = onSnapshot(collection(db, "cadastro_motoristas"), (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            setMotoristas(list);
        });

        // Carregar Eventos de Folga
        const unsubFolgas = onSnapshot(collection(db, "escalas_motoristas"), (snap) => {
            const list = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            setEventos(list);
            setLoading(false);
        });

        return () => { unsubMotoristas(); unsubFolgas(); };
    }, []);

    const salvarEscala = async (e) => {
        e.preventDefault();
        if (!motoristaId || !dataInicio) return alert("Preencha os campos obrigatórios");

        const motoristaNome = motoristas.find(m => m.id === motoristaId)?.nome || "Motorista";

        try {
            await addDoc(collection(db, "escalas_motoristas"), {
                motoristaId,
                motoristaNome,
                tipo,
                dataInicio,
                dataFim: dataFim || dataInicio,
                criadoEm: serverTimestamp()
            });
            alert("Registrado com sucesso!");
        } catch (error) {
            console.error(error);
        }
    };

    const excluirEscala = async (id) => {
        if(window.confirm("Excluir este registro?")) {
            await deleteDoc(doc(db, "escalas_motoristas", id));
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ color: '#FFD700', borderLeft: '4px solid #FFD700', paddingLeft: '15px' }}>Controle de Folgas e Escalas</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                
                {/* FORMULÁRIO */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '14px', marginBottom: '15px', color: '#FFD700' }}>Lançar Novo Evento</h3>
                    <form onSubmit={salvarEscala} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label style={labelStyle}>Motorista</label>
                        <select style={inputStyle} value={motoristaId} onChange={e => setMotoristaId(e.target.value)}>
                            <option value="">Selecione...</option>
                            {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>

                        <label style={labelStyle}>Tipo de Ausência</label>
                        <select style={inputStyle} value={tipo} onChange={e => setTipo(e.target.value)}>
                            <option value="Folga">Folga</option>
                            <option value="Férias">Férias</option>
                            <option value="Atestado">Atestado</option>
                            <option value="Falta">Falta</option>
                        </select>

                        <label style={labelStyle}>Início</label>
                        <input type="date" style={inputStyle} value={dataInicio} onChange={e => setDataInicio(e.target.value)} />

                        <label style={labelStyle}>Fim (Opcional)</label>
                        <input type="date" style={inputStyle} value={dataFim} onChange={e => setDataFim(e.target.value)} />

                        <button type="submit" style={btnStyle}><Plus size={16} /> Salvar na Escala</button>
                    </form>
                </div>

                {/* LISTA DE ESCALAS */}
                <div style={cardStyle}>
                    <h3 style={{ fontSize: '14px', marginBottom: '15px', color: '#888' }}>Próximas Ausências Programadas</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #222', color: '#666', fontSize: '12px', textAlign: 'left' }}>
                                <th style={{ padding: '10px' }}>Motorista</th>
                                <th>Tipo</th>
                                <th>Período</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {eventos.map(ev => (
                                <tr key={ev.id} style={{ borderBottom: '1px solid #111', fontSize: '13px' }}>
                                    <td style={{ padding: '12px' }}>{ev.motoristaNome}</td>
                                    <td>
                                        <span style={{ 
                                            padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold',
                                            backgroundColor: ev.tipo === 'Folga' ? '#2ecc7133' : '#e74c3c33',
                                            color: ev.tipo === 'Folga' ? '#2ecc71' : '#e74c3c'
                                        }}>{ev.tipo.toUpperCase()}</span>
                                    </td>
                                    <td style={{ color: '#888' }}><Clock size={12} /> {ev.dataInicio} até {ev.dataFim}</td>
                                    <td>
                                        <button onClick={() => excluirEscala(ev.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Estilos internos rápidos
const cardStyle = { backgroundColor: '#0a0a0a', padding: '20px', borderRadius: '12px', border: '1px solid #222' };
const labelStyle = { fontSize: '11px', color: '#666', marginBottom: '4px', fontWeight: 'bold' };
const inputStyle = { backgroundColor: '#111', color: '#fff', border: '1px solid #333', padding: '10px', borderRadius: '6px', marginBottom: '5px' };
const btnStyle = { backgroundColor: '#FFD700', color: '#000', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' };

export default Folgas;