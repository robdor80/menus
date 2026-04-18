// Configuracion manual de Firebase.
// 1) Crea tu proyecto en Firebase Console.
// 2) Crea una app web y copia los valores de configuracion.
// 3) Pega los valores abajo y cambia enabled a true.

export const firebaseSetup = {
  enabled: true,
  collectionName: "weeks",
  config: {
    apiKey: "AIzaSyAc1xl6kbzB20xtMq48q-7d_o-0qMEo5MM",
    authDomain: "menu-semanal-casa.firebaseapp.com",
    projectId: "menu-semanal-casa",
    storageBucket: "menu-semanal-casa.firebasestorage.app",
    messagingSenderId: "308735669254",
    appId: "1:308735669254:web:222da56cc51b22afa37f87"
  }
};

// Fecha base del ciclo 6x6.
// Ese dia es el dia 1 del ciclo (primera manana).
export const shiftSetup = {
  baseDate: "2026-04-18"
};
