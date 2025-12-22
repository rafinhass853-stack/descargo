import React, { useState, useEffect } from 'react';
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { collection, onSnapshot, query } from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { 
  Truck, Users, LayoutDashboard, ClipboardList, 
  LogOut, Fuel, Settings, UserCheck 
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- ÍCONE DE CAMINHÃO ---
const caminhaoIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -35],
});

const PainelGestor = () => {
    const [motoristasOnline, setMotoristasOnline] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "localizacao_realtime"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const lista = [];
            snapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() });
            });
            setMotoristasOnline(lista);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = () => signOut(auth);

    return (
        <div style={styles.container}>
            {/* Sidebar com todos os menus recuperados */}
            <aside style={styles.sidebar}>
                <h1 style={styles.logo}>DESCARGO</h1>
                <nav style={styles.nav}>
                    <div style={styles.navItemAtivo}><LayoutDashboard size={18} /> Dashboard</div>
                    <div style={styles.navItem}><ClipboardList size={18} /> Painel de Cargas</div>
                    <div style={styles.navItem}><Truck size={18} /> Veículos</div>
                    <div style={styles.navItem}><Users size={18} /> Motoristas</div>
                    <div style={styles.navItem}><Fuel size={18} /> Abastecimento</div>
                    <div style={styles.navItem}><Settings size={18} /> Manutenções</div>
                    <div style={styles.navItem}><UserCheck size={18} /> RH / Funcionários</div>
                </nav>
                <button onClick={handleLogout} style={styles.btnSair}><LogOut size={18} /> Sair</button>
            </aside>

            {/* Conteúdo Principal */}
            <main style={styles.main}>
                <header style={styles.header}>
                    <span>Operação Logística | Rafael Araujo</span>
                </header>

                <div style={styles.content}>
                    <h2 style={styles.titulo}>Monitoramento em Tempo Real (Satélite)</h2>
                    
                    <div style={styles.grid}>
                        <div style={styles.card}>
                            <span style={styles.cardLabel}>MOTORISTAS LOGADOS</span>
                            <span style={styles.cardValor}>{motoristasOnline.length}</span>
                        </div>
                        <div style={styles.card}>
                            <span style={styles.cardLabel}>EM JORNADA</span>
                            <span style={styles.cardValor}>
                                {motoristasOnline.filter(m => m.status !== 'OFFLINE').length}
                            </span>
                        </div>
                    </div>

                    {/* Mapa em Versão Satélite Híbrido */}
                    <div style={styles.mapaContainer}>
                        <MapContainer 
                            center={[-21.78, -48.17]} 
                            zoom={6} 
                            style={{ height: '100%', width: '100%' }}
                        >
                            {/* Layer de Satélite do Google com informações de ruas */}
                            <TileLayer 
                                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                                attribution='&copy; Google Maps'
                            />
                            
                            {motoristasOnline.map((mot) => (
                                mot.lat && mot.lng && (
                                    <Marker key={mot.id} position={[mot.lat, mot.lng]} icon={caminhaoIcon}>
                                        <Popup>
                                            <div style={{color: '#000', padding: '5px'}}>
                                                <strong style={{fontSize: '14px'}}>{mot.usuario}</strong><br/>
                                                <span style={{color: '#d35400', fontWeight: 'bold'}}>Status: {mot.status || 'Logado'}</span><br/>
                                                <small style={{color: '#666'}}>Atualizado: {mot.ultimaAtualizacao?.toDate().toLocaleTimeString()}</small>
                                            </div>
                                        </Popup>
                                    </Marker>
                                )
                            ))}
                        </MapContainer>
                    </div>
                </div>
            </main>
        </div>
    );
};

const styles = {
    container: { display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#000', color: '#FFF', overflow: 'hidden' },
    sidebar: { width: '260px', backgroundColor: '#0a0a0a', padding: '20px', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column' },
    logo: { color: '#FFD700', fontSize: '24px', fontWeight: 'bold', marginBottom: '35px', letterSpacing: '1px' },
    nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' },
    navItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#888', cursor: 'pointer', fontSize: '14px', borderRadius: '8px' },
    navItemAtivo: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#000', backgroundColor: '#FFD700', borderRadius: '8px', fontWeight: 'bold' },
    btnSair: { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'transparent', color: '#ff4d4d', border: 'none', cursor: 'pointer', padding: '10px', marginTop: 'auto' },
    main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
    header: { height: '60px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 30px', color: '#444', fontSize: '11px' },
    content: { padding: '25px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' },
    titulo: { color: '#FFD700', fontSize: '22px', margin: 0 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' },
    card: { backgroundColor: '#111', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #FFD700' },
    cardLabel: { fontSize: '11px', color: '#666', fontWeight: 'bold' },
    cardValor: { fontSize: '30px', fontWeight: 'bold', display: 'block', marginTop: '5px' },
    mapaContainer: { flex: 1, borderRadius: '15px', overflow: 'hidden', border: '1px solid #333', backgroundColor: '#111' }
};

export default PainelGestor;