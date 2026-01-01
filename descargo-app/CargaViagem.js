import React, { useEffect, useState, memo } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    Linking, 
    ActivityIndicator, 
    Platform // Adicionado Platform
} from 'react-native';
import MapView, { Circle, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { db } from "./firebase";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore"; // Adicionado limit
import { Navigation, MapPin, Package } from 'lucide-react-native';

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
    
    const [region, setRegion] = useState({
        latitude: -21.78,
        longitude: -48.17,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    });

    useEffect(() => {
        if (!motoristaEmail) return;

        // Ajustado para buscar status "ACEITO" ou "EM VIAGEM"
        const q = query(
            collection(db, "ordens_servico"),
            where("motorista_email", "==", motoristaEmail),
            where("status", "in", ["ACEITO", "EM VIAGEM"]),
            limit(1)
        );

        const unsubViagem = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const dados = snapshot.docs[0].data();
                setViagemAtiva(dados);
                // A função buscarCerca agora retorna seu próprio unsubscribe
                const unsubCerca = buscarCercaNoMapa(dados.cliente_destino || dados.destinoCliente);
                return () => unsubCerca && unsubCerca();
            } else {
                setViagemAtiva(null);
                setCercaDestino(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Erro Viagem:", err);
            setLoading(false);
        });

        return () => unsubViagem();
    }, [motoristaEmail]);

    const buscarCercaNoMapa = (nomeCliente) => {
        if (!nomeCliente) return;
        
        const qCerca = query(
            collection(db, "cadastro_clientes_pontos"),
            where("cliente", "==", nomeCliente.toUpperCase()),
            limit(1)
        );

        // Retornamos o unsubscribe para ser limpo pelo useEffect pai
        return onSnapshot(qCerca, (snapshot) => {
            if (!snapshot.empty) {
                const dadosCerca = snapshot.docs[0].data();
                setCercaDestino(dadosCerca);
                
                const geo = dadosCerca.geofence;
                const lat = geo.tipo === 'circle' ? geo.centro.lat : geo.coordenadas[0].lat;
                const lng = geo.tipo === 'circle' ? geo.centro.lng : geo.coordenadas[0].lng;

                setRegion({
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                });
            }
        });
    };

    const abrirNavegacao = () => {
        if (!viagemAtiva) return;
        const destino = viagemAtiva.cliente_destino || viagemAtiva.destinoCliente;
        
        // Melhorei a URL para funcionar melhor no Google Maps e Waze
        const url = Platform.OS === 'ios' 
            ? `maps://0,0?q=${destino}`
            : `geo:0,0?q=${destino}`;
            
        Linking.openURL(url).catch(() => {
            Alert.alert("Erro", "Não foi possível abrir o mapa externo.");
        });
    };

    if (loading) return (
        <View style={styles.centered}>
            <ActivityIndicator size="large" color="#FFD700" />
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>
                    {viagemAtiva?.status === "ACEITO" ? "VIAGEM INICIADA" : "EM ANDAMENTO"}
                </Text>
                {viagemAtiva && (
                    <View style={styles.infoRow}>
                        <Package size={16} color="#666" />
                        <Text style={styles.text}>Carga: {viagemAtiva.produto || 'Geral'}</Text>
                    </View>
                )}
            </View>

            <View style={styles.mapWrapper}>
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    region={region} // Mudado de initialRegion para region para acompanhar o destino
                    showsUserLocation={true}
                    loadingEnabled={true}
                    pitchEnabled={false}
                    mapType="standard"
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
                            <Text style={styles.destName}>
                                {(viagemAtiva.cliente_destino || viagemAtiva.destinoCliente)?.toUpperCase()}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.navButton} onPress={abrirNavegacao}>
                        <Navigation size={20} color="#000" />
                        <Text style={styles.navButtonText}>INICIAR GPS EXTERNO</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    header: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#222', paddingTop: 40 },
    headerTitle: { color: '#FFD700', fontSize: 16, fontWeight: 'bold' },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
    text: { color: '#fff', fontSize: 14 },
    mapWrapper: { flex: 1 },
    map: { ...StyleSheet.absoluteFillObject },
    footer: { padding: 20, backgroundColor: '#000', paddingBottom: 30 },
    destCard: { backgroundColor: '#111', padding: 15, borderRadius: 10 },
    destLabel: { color: '#666', fontSize: 10, marginBottom: 4 },
    destName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    navButton: {
        backgroundColor: '#FFD700', marginTop: 15, padding: 15,
        borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10
    },
    navButtonText: { fontWeight: 'bold', color: '#000' }
});

export default CargaViagem;