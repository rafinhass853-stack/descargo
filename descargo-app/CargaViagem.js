import React, { useEffect, useState, useMemo, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import MapView, { Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { db } from "./firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Navigation, MapPin, Package, AlertTriangle } from 'lucide-react-native';

// Otimização: Componente de Geofence separado para evitar re-render do mapa todo
const GeofenceLayer = memo(({ cerca }) => {
    if (!cerca || !cerca.geofence) return null;

    if (cerca.geofence.tipo === 'circle') {
        return (
            <Circle
                center={{
                    latitude: cerca.geofence.centro.lat,
                    longitude: cerca.geofence.centro.lng
                }}
                radius={cerca.geofence.raio}
                strokeColor="#FFD700"
                fillColor="rgba(255, 215, 0, 0.2)"
                zIndex={2}
            />
        );
    }

    const coords = cerca.geofence.coordenadas.map(c => ({
        latitude: c.lat,
        longitude: c.lng
    }));

    return (
        <Polygon
            coordinates={coords}
            strokeColor="#FFD700"
            fillColor="rgba(255, 215, 0, 0.2)"
            zIndex={2}
        />
    );
});

const CargaViagem = ({ motoristaEmail }) => {
    const [viagemAtiva, setViagemAtiva] = useState(null);
    const [cercaDestino, setCercaDestino] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Posição inicial fixa para carregar o mapa rápido
    const [region, setRegion] = useState({
        latitude: -21.78,
        longitude: -48.17,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    });

    useEffect(() => {
        const q = query(
            collection(db, "ordens_servico"),
            where("motorista_email", "==", motoristaEmail),
            where("status", "==", "EM VIAGEM")
        );

        const unsubViagem = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const dados = snapshot.docs[0].data();
                setViagemAtiva(dados);
                buscarCercaNoMapa(dados.cliente_destino);
            } else {
                setViagemAtiva(null);
                setCercaDestino(null);
            }
            setLoading(false);
        });

        return () => unsubViagem();
    }, [motoristaEmail]);

    const buscarCercaNoMapa = (nomeCliente) => {
        if (!nomeCliente) return;
        const qCerca = query(
            collection(db, "cadastro_clientes_pontos"),
            where("cliente", "==", nomeCliente.toUpperCase())
        );

        onSnapshot(qCerca, (snapshot) => {
            if (!snapshot.empty) {
                const dadosCerca = snapshot.docs[0].data();
                setCercaDestino(dadosCerca);
                
                // Atualiza a região apenas uma vez ao encontrar a cerca
                const lat = dadosCerca.geofence.tipo === 'circle' 
                    ? dadosCerca.geofence.centro.lat 
                    : dadosCerca.geofence.coordenadas[0].lat;
                const lng = dadosCerca.geofence.tipo === 'circle' 
                    ? dadosCerca.geofence.centro.lng 
                    : dadosCerca.geofence.coordenadas[0].lng;

                setRegion(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                }));
            }
        });
    };

    // Abre o Waze ou Google Maps externo (muito mais leve que navegar dentro do app)
    const abrirNavegacao = () => {
        const url = Platform.select({
            ios: `maps:0,0?q=${viagemAtiva.cliente_destino}`,
            android: `geo:0,0?q=${viagemAtiva.cliente_destino}`,
        });
        Linking.openURL(url);
    };

    if (loading) return <ActivityIndicator size="large" color="#FFD700" style={{flex:1, backgroundColor:'#000'}}/>;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>VIAGEM EM ANDAMENTO</Text>
                {viagemAtiva && (
                    <View style={styles.infoRow}>
                        <Package size={16} color="#666" />
                        <Text style={styles.text}>Carga: {viagemAtiva.produto}</Text>
                    </View>
                )}
            </View>

            <View style={styles.mapWrapper}>
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    initialRegion={region}
                    showsUserLocation={true}
                    followsUserLocation={false} // IMPORTANTE: true causa lentidão em aparelhos simples
                    loadingEnabled={true}
                    moveOnMarkerPress={false}
                    pitchEnabled={false} // Desativa inclinação 3D para ganhar performance
                    mapType="standard" // 'hybrid' é bem mais pesado, use 'standard' se estiver travando muito
                >
                    <GeofenceLayer cerca={cercaDestino} />
                </MapView>
            </View>

            {viagemAtiva && (
                <View style={styles.footer}>
                    <View style={styles.destCard}>
                        <Text style={styles.destLabel}>DESTINO FINAL</Text>
                        <View style={styles.infoRow}>
                            <MapPin size={18} color="#FFD700" />
                            <Text style={styles.destName}>{viagemAtiva.cliente_destino.toUpperCase()}</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.navButton} onPress={abrirNavegacao}>
                        <Navigation size={20} color="#000" />
                        <Text style={styles.navButtonText}>ABRIR NO GPS EXTERNO</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTitle: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
    text: { color: '#fff', fontSize: 14 },
    mapWrapper: { flex: 1, position: 'relative' }, // O mapa agora ocupa o espaço disponível
    map: { ...StyleSheet.absoluteFillObject },
    footer: { padding: 20, backgroundColor: '#000' },
    destCard: { backgroundColor: '#111', padding: 15, borderRadius: 10 },
    destLabel: { color: '#666', fontSize: 10 },
    destName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    navButton: {
        backgroundColor: '#FFD700', marginTop: 15, padding: 15,
        borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10
    },
    navButtonText: { fontWeight: 'bold', color: '#000' }
});

export default CargaViagem;