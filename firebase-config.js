// Configuracion manual de Firebase.
// 1) Crea tu proyecto en Firebase Console.
// 2) Crea una app web y copia los valores de configuracion.
// 3) Pega los valores abajo y cambia enabled a true.

export const firebaseSetup = {
  enabled: false,
  collectionName: "weeks",
  config: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  }
};

// Fecha base del ciclo 6x6.
// Ese dia es el dia 1 del ciclo (primera manana).
export const shiftSetup = {
  baseDate: "2026-04-18"
};

