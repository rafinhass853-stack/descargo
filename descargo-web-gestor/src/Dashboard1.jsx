import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

const Dashboard1 = ({ styles }) => {
    const [cargas, setCargas] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        pendentes: 0,
        emTransito: 0,
        concluidas: 0
    });

    useEffect(() => {
        // Ajuste o nome da coleção conforme o seu Firebase (ex: "cargas" ou "ordens_servico")
        const q = query(collection(db, "ordens_servico")); 
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            let pendentes = 0;
            let emTransito = 0;
            let concluidas = 0;

            snapshot.forEach((doc) => {
                const dados = doc.data();
                lista.push({ id: doc.id, ...dados });

                // Lógica de contagem baseada no status
                if (dados.status === 'PENDENTE') pendentes++;
                if (dados.status === 'EM_TRANSITO') emTransito++;
                if (dados.status === 'CONCLUIDA') concluidas++;
            });

            setCargas(lista);
            setStats({
                total: snapshot.size,
                pendentes,
                emTransito,
                concluidas
            });
        });
        return () => unsubscribe();
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <h2 style={styles.titulo}>Visibilidade Geral de Cargas</h2>

            {/* Cards de Resumo de Cargas */}
            <div style={styles.grid}>
                <div style={{ ...styles.card, borderLeft: '4px solid #FFD700' }}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>TOTAL DE CARGAS</span>
                        <span style={styles.cardValor}>{stats.total}</span>
                    </div>
                    <Package size={24} color="#FFD700" opacity={0.5} />
                </div>

                <div style={{ ...styles.card, borderLeft: '4px solid #3498db' }}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>AGUARDANDO</span>
                        <span style={styles.cardValor}>{stats.pendentes}</span>
                    </div>
                    <Clock size={24} color="#3498db" opacity={0.5} />
                </div>

                <div style={{ ...styles.card, borderLeft: '4px solid #e67e22' }}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>EM TRÂNSITO</span>
                        <span style={styles.cardValor}>{stats.emTransito}</span>
                    </div>
                    <ArrowRight size={24} color="#e67e22" opacity={0.5} />
                </div>

                <div style={{ ...styles.card, borderLeft: '4px solid #2ecc71' }}>
                    <div style={styles.cardInfo}>
                        <span style={styles.cardLabel}>CONCLUÍDAS</span>
                        <span style={styles.cardValor}>{stats.concluidas}</span>
                    </div>
                    <CheckCircle2 size={24} color="#2ecc71" opacity={0.5} />
                </div>
            </div>

            {/* Tabela Simples de Monitoramento */}
            <div style={localStyles.tabelaContainer}>
                <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Últimas Cargas Lançadas</h3>
                <table style={localStyles.table}>
                    <thead>
                        <tr>
                            <th style={localStyles.th}>ID / CTE</th>
                            <th style={localStyles.th}>Motorista</th>
                            <th style={localStyles.th}>Origem {'>'} Destino</th>
                            <th style={localStyles.th}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cargas.length > 0 ? cargas.map((carga) => (
                            <tr key={carga.id} style={localStyles.tr}>
                                <td style={localStyles.td}>{carga.numeroCarga || carga.id.substring(0,6)}</td>
                                <td style={localStyles.td}>{carga.motoristaNome || 'Não atribuído'}</td>
                                <td style={localStyles.td}>{carga.origem} {'→'} {carga.destino}</td>
                                <td style={localStyles.td}>
                                    <span style={{
                                        ...localStyles.statusBadge,
                                        backgroundColor: carga.status === 'CONCLUIDA' ? '#1b5e20' : '#d35400'
                                    }}>
                                        {carga.status}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                    Nenhuma carga encontrada.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const localStyles = {
    tabelaContainer: { backgroundColor: '#111', padding: '20px', borderRadius: '12px', border: '1px solid #222' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', padding: '12px', borderBottom: '1px solid #333', color: '#666', fontSize: '12px' },
    tr: { borderBottom: '1px solid #222' },
    td: { padding: '12px', fontSize: '13px', color: '#eee' },
    statusBadge: { padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }
};

export default Dashboard1;