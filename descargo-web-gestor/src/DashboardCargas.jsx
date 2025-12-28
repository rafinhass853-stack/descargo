import React, { useState, useEffect } from 'react';
import { db } from "./firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { DollarSign, Scale, Truck, Settings, Navigation, Container, User } from 'lucide-react';

const DashboardCargas = () => {
    const [cargas, setCargas] = useState([]);
    const [veiculos, setVeiculos] = useState([]);
    const [carretas, setCarretas] = useState([]);
    const [stats, setStats] = useState({ faturamento: 0, peso: 0, total: 0 });

    useEffect(() => {
        // 1. Monitorar Ordens de Serviço
        const q = query(collection(db, "ordens_servico"), orderBy("criadoEm", "desc"));
        const unsubCargas = onSnapshot(q, (snapshot) => {
            const lista = [];
            let fat = 0;
            let p = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                lista.push({ id: doc.id, ...data });
                
                fat += parseFloat(data.valorCalculo || 0);
                if(data.tipoViagem === 'CARREGADO') {
                    // Limpa o peso de strings para somar corretamente
                    const pesoLimpo = String(data.peso || '0').replace(/[^\d.]/g, '');
                    p += parseFloat(pesoLimpo || 0);
                }
            });

            setCargas(lista);
            setStats({ faturamento: fat, peso: p, total: lista.length });
        });

        // 2. Monitorar Veículos (Cavalos) - Usando motorista_id do Firebase
        const unsubVeiculos = onSnapshot(collection(db, "cadastro_veiculos"), (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.motorista_id) lista.push(data);
            });
            setVeiculos(lista);
        });

        // 3. Monitorar Carretas - Usando motorista_id do Firebase
        const unsubCarretas = onSnapshot(collection(db, "carretas"), (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.motorista_id) lista.push(data);
            });
            setCarretas(lista);
        });

        return () => {
            unsubCargas();
            unsubVeiculos();
            unsubCarretas();
        };
    }, []);

    // FUNÇÃO DE BUSCA REVISADA - Compara motoristaId da carga com motorista_id do veículo
    const getPlacasMotorista = (idDaCarga) => {
        if (!idDaCarga) return { cavalo: '---', carreta: '---' };
        
        // Remove espaços extras para evitar erro de comparação
        const idBusca = String(idDaCarga).trim();

        // Procura nos veículos cadastrados
        const v = veiculos.find(v => String(v.motorista_id).trim() === idBusca);
        // Procura nas carretas cadastradas
        const c = carretas.find(c => String(c.motorista_id).trim() === idBusca);

        return {
            cavalo: v ? v.placa : '---',
            carreta: c ? c.placa : '---'
        };
    };

    const cargasAgrupadas = cargas.reduce((acc, carga) => {
        let cidade = "OUTROS";
        if (carga.tipoViagem === 'CARREGADO') cidade = carga.origemCidade || "S/ CIDADE";
        else if (carga.tipoViagem === 'MANUTENÇÃO') cidade = "OFICINA / MANUTENÇÃO";
        else cidade = "DESLOCAMENTO VAZIO";

        if (!acc[cidade]) acc[cidade] = [];
        acc[cidade].push(carga);
        return acc;
    }, {});

    const renderLinhaCarga = (item) => {
        // Busca as placas usando o motoristaId salvo na Ordem de Serviço
        const placas = getPlacasMotorista(item.motoristaId);

        return (
            <tr key={item.id} style={styles.tr}>
                <td style={styles.td}>
                    <div style={item.tipoViagem === 'MANUTENÇÃO' ? styles.badgeMaint : item.tipoViagem === 'VAZIO' ? styles.badgeVazio : styles.primaryText}>
                        {item.dt}
                    </div>
                </td>
                <td style={styles.td}>
                    <div style={styles.primaryText}>{item.destinoCliente || item.destinoCidade}</div>
                    <div style={styles.secondaryText}>{item.observacao || item.destinoCidade}</div>
                </td>
                <td style={styles.td}>
                    <span style={item.tipoViagem === 'MANUTENÇÃO' ? styles.valMaint : styles.valFrete}>
                        R$ {parseFloat(item.valorCalculo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </td>
                <td style={styles.td}>{item.peso || '---'}</td>
                <td style={styles.td}>
                    <div style={styles.motoristaText}>
                        <User size={12} color="#FFD700" style={{marginRight: 5}}/> 
                        {item.motoristaNome || 'Pendente'}
                    </div>
                </td>
                <td style={styles.td}>
                    <div style={styles.placaContainer}>
                        <span style={styles.placaItem}>
                            <Truck size={12} color="#FFD700" style={{marginRight: 5}}/> 
                            {placas.cavalo}
                        </span>
                        <span style={styles.placaItem}>
                            <Container size={12} color="#3498db" style={{marginRight: 5}}/> 
                            {placas.carreta}
                        </span>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h2 style={styles.titulo}>RELATÓRIO DE OPERAÇÕES LOGÍSTICAS</h2>
                <div style={styles.periodo}>CONTROLE ADMINISTRATIVO FINANCEIRO</div>
            </header>

            <div style={styles.statsRow}>
                <div style={styles.statCard}>
                    <DollarSign size={18} color="#2ecc71"/>
                    <span>Faturamento: <strong style={{color: '#2ecc71', marginLeft: 10}}>R$ {stats.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                </div>
                <div style={styles.statCard}>
                    <Scale size={18} color="#3498db"/>
                    <span>Peso Total: <strong style={{color: '#3498db', marginLeft: 10}}>{stats.peso.toLocaleString('pt-BR')} kg</strong></span>
                </div>
                <div style={styles.statCard}>
                    <Truck size={18} color="#FFD700"/>
                    <span>Total Viagens: <strong style={{color: '#FFD700', marginLeft: 10}}>{stats.total}</strong></span>
                </div>
            </div>

            {Object.keys(cargasAgrupadas).map(cidade => (
                <div key={cidade} style={styles.secao}>
                    <div style={styles.headerCidade}>
                        <span>{cidade.toUpperCase()}</span>
                    </div>
                    <div style={styles.tableWrapper}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>DT/PROCESSO</th>
                                    <th style={styles.th}>DESTINO / MOTIVO</th>
                                    <th style={styles.th}>VLR. CÁLCULO</th>
                                    <th style={styles.th}>PESO</th>
                                    <th style={styles.th}>MOTORISTA</th>
                                    <th style={styles.th}>CONJUNTO (PLACAS)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cargasAgrupadas[cidade].map(item => renderLinhaCarga(item))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

const styles = {
    container: { padding: '30px', backgroundColor: '#050505', minHeight: '100vh', color: '#FFF', fontFamily: 'sans-serif' },
    header: { display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #FFD700', paddingBottom: '15px', marginBottom: '25px', alignItems: 'center' },
    titulo: { fontSize: '18px', fontWeight: 'bold', color: '#FFD700', margin: 0 },
    periodo: { fontSize: '11px', color: '#888' },
    statsRow: { display: 'flex', gap: '15px', marginBottom: '30px' },
    statCard: { backgroundColor: '#111', border: '1px solid #222', padding: '15px', borderRadius: '6px', display: 'flex', alignItems: 'center', flex: 1 },
    secao: { marginBottom: '30px', backgroundColor: '#111', borderRadius: '8px', border: '1px solid #222', overflow: 'hidden' },
    headerCidade: { backgroundColor: '#1a1a1a', padding: '10px 15px', fontWeight: 'bold', fontSize: '12px', color: '#FFD700' },
    tableWrapper: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: { textAlign: 'left', fontSize: '10px', color: '#555', padding: '12px 15px', borderBottom: '1px solid #222', textTransform: 'uppercase' },
    td: { padding: '12px 15px', fontSize: '12px', borderBottom: '1px solid #1a1a1a' },
    tr: { transition: '0.2s' },
    primaryText: { fontWeight: 'bold', color: '#eee' },
    secondaryText: { fontSize: '10px', color: '#666', textTransform: 'uppercase' },
    valFrete: { color: '#2ecc71', fontWeight: 'bold' },
    valMaint: { color: '#e74c3c', fontWeight: 'bold' },
    motoristaText: { color: '#eee', display: 'flex', alignItems: 'center' },
    placaContainer: { display: 'flex', flexDirection: 'column', gap: '4px' },
    placaItem: { fontSize: '11px', color: '#FFD700', display: 'flex', alignItems: 'center', fontWeight: 'bold' },
    badgeMaint: { color: '#e74c3c', fontWeight: 'bold' },
    badgeVazio: { color: '#3498db', fontWeight: 'bold' }
};

export default DashboardCargas;