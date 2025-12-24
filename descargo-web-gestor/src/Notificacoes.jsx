import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc } from "firebase/firestore";
import { Bell, Trash2, Clock, User, Hash, CheckCircle2, AlertCircle } from 'lucide-react';

const Notificacoes = () => {
    const [logs, setLogs] = useState([]);
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        // Busca as últimas 50 notificações enviadas para não sobrecarregar a tela
        const q = query(
            collection(db, "notificacoes_cargas"), 
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setLogs(lista);
            setCarregando(false);
        }, (error) => {
            console.error("Erro ao buscar logs:", error);
            setCarregando(false);
        });

        return () => unsubscribe();
    }, []);

    const excluirLog = async (id) => {
        if (window.confirm("Deseja remover este registro de histórico?")) {
            try {
                await deleteDoc(doc(db, "notificacoes_cargas", id));
            } catch  {
                alert("Erro ao excluir.");
            }
        }
    };

    // Formatação de data simples
    const formatarData = (timestamp) => {
        if (!timestamp) return "...";
        const d = timestamp.toDate();
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <h2 style={styles.titulo}>CENTRAL DE NOTIFICAÇÕES</h2>
                    <p style={styles.subtitulo}>Histórico de envios e disparos para o App Motorista</p>
                </div>
                <div style={styles.badgeCount}>{logs.length} Registros</div>
            </header>

            <div style={styles.lista}>
                {carregando ? (
                    <div style={styles.loading}>Sincronizando com Firebase...</div>
                ) : logs.length === 0 ? (
                    <div style={styles.vazio}>Nenhuma notificação disparada recentemente.</div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} style={styles.cardLog}>
                            <div style={styles.iconStatus}>
                                {log.status === 'pendente' ? 
                                    <Clock size={20} color="#ff9f43" /> : 
                                    <CheckCircle2 size={20} color="#2ecc71" />
                                }
                            </div>

                            <div style={styles.infoPrincipal}>
                                <div style={styles.row}>
                                    <span style={styles.label}><Hash size={12}/> DT:</span>
                                    <span style={styles.valorDt}>{log.dt || 'S/DT'}</span>
                                    
                                    <span style={{...styles.label, marginLeft: '15px'}}><User size={12}/> MOTORISTA:</span>
                                    <span style={styles.valorNome}>{log.motoristaNome?.toUpperCase()}</span>
                                </div>
                                <div style={styles.row}>
                                    <span style={styles.data}><Clock size={10}/> Enviado em: {formatarData(log.timestamp)}</span>
                                    <span style={styles.vinculoBadge}>{log.vinculo || 'FROTA'}</span>
                                </div>
                            </div>

                            <div style={styles.acoes}>
                                <button onClick={() => excluirLog(log.id)} style={styles.btnExcluir}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const styles = {
    container: { display: 'flex', flexDirection: 'column', gap: '20px', animate: 'fadeIn 0.5s' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '15px' },
    titulo: { color: '#FFD700', fontSize: '20px', fontWeight: 'bold', margin: 0 },
    subtitulo: { color: '#666', fontSize: '12px', margin: '5px 0 0 0' },
    badgeCount: { backgroundColor: '#111', border: '1px solid #333', padding: '5px 12px', borderRadius: '20px', fontSize: '11px', color: '#FFD700' },
    lista: { display: 'flex', flexDirection: 'column', gap: '10px' },
    cardLog: { 
        backgroundColor: '#0a0a0a', 
        border: '1px solid #1a1a1a', 
        padding: '12px 15px', 
        borderRadius: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '15px',
        transition: '0.2s hover',
    },
    iconStatus: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    infoPrincipal: { flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' },
    row: { display: 'flex', alignItems: 'center', gap: '8px' },
    label: { color: '#444', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '3px' },
    valorDt: { color: '#FFD700', fontSize: '13px', fontWeight: 'bold' },
    valorNome: { color: '#FFF', fontSize: '13px', fontWeight: 'bold' },
    data: { color: '#555', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' },
    vinculoBadge: { backgroundColor: '#111', color: '#888', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #222' },
    acoes: { display: 'flex', alignItems: 'center' },
    btnExcluir: { backgroundColor: 'transparent', border: 'none', color: '#333', cursor: 'pointer', padding: '5px', transition: '0.2s' },
    loading: { textAlign: 'center', padding: '40px', color: '#FFD700', fontSize: '12px' },
    vazio: { textAlign: 'center', padding: '40px', color: '#444', fontSize: '13px', border: '1px dashed #222', borderRadius: '8px' }
};

export default Notificacoes;