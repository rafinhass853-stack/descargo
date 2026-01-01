import { useEffect } from 'react';
import { Alert, Vibration } from 'react-native';
import { collection, query, where, onSnapshot, doc, updateDoc, and } from 'firebase/firestore';

export const useNotificacaoCarga = (db, user, isLoggedIn, setCargaAtiva, confirmarCarga) => {
  useEffect(() => {
    if (isLoggedIn && user) {
      const q = query(
        collection(db, "ordens_servico"),
        and(
          where("motoristaId", "==", user.uid),
          where("status", "in", ["AGUARDANDO PROGRAMAÇÃO", "PENDENTE ACEITE", "ACEITO"])
        )
      );

      const unsubscribeCargas = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const dados = change.doc.data();
          const id = change.doc.id;

          if ((change.type === "added" || change.type === "modified") && 
              (dados.status === "AGUARDANDO PROGRAMAÇÃO" || dados.status === "PENDENTE ACEITE")) {
            
            Vibration.vibrate([0, 500, 500, 500], true); 

            const isVazio = dados.tipoViagem === 'VAZIO';
            
            // Definição do Título e Mensagem baseada no seu pedido
            const titulo = isVazio ? "Deslocamento Vazio" : "🔔 NOVA CARGA DISPONÍVEL";
            const mensagem = isVazio 
              ? `destino: ${dados.destinoCliente || dados.cliente_destino}\nhorário chegada: ${dados.horarioChegada || "Não informado"}`
              : `📍 ORIGEM: ${dados.origemCliente}\n🏁 DESTINO: ${dados.destinoCliente}\n🚛 CARRETA: ${dados.carreta || "---"}`;

            Alert.alert(
              titulo,
              mensagem,
              [
                { 
                  text: "RECUSAR", 
                  style: "cancel", 
                  onPress: async () => { 
                    Vibration.cancel(); 
                    await updateDoc(doc(db, "ordens_servico", id), { status: "RECUSADO" }); 
                  } 
                },
                { 
                  text: "ACEITAR E INICIAR", 
                  onPress: () => { 
                    Vibration.cancel(); 
                    confirmarCarga(id, dados); 
                  } 
                }
              ],
              { cancelable: false }
            );
          }
          if (dados.status === "ACEITO") setCargaAtiva({ id, ...dados });
        });
        if (snapshot.empty) setCargaAtiva(null);
      });

      return () => unsubscribeCargas();
    }
  }, [isLoggedIn, user, db]);
};