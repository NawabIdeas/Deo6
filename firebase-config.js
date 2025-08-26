// Replace with your Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCBYyzCR5iDihKG-YgiKGnPTqWSRgEscrw",
    authDomain: "earnflow-3cqoj.firebaseapp.com",
    databaseURL: "https://earnflow-3cqoj-default-rtdb.firebaseio.com",
    projectId: "earnflow-3cqoj",
    storageBucket: "earnflow-3cqoj.firebasestorage.app",
    messagingSenderId: "557959267984",
    appId: "1:557959267984:web:2230ffd284b72812723a15"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
