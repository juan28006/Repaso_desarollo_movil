import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from '@firebase/auth';
import type { Persistence } from 'firebase/auth';
import * as firebaseAuth from '@firebase/auth';

type ReactNativePersistenceFactory = (storage: unknown) => Persistence;

const getReactNativePersistence = (
  firebaseAuth as typeof firebaseAuth & {
    getReactNativePersistence: ReactNativePersistenceFactory;
  }
).getReactNativePersistence;

const firebaseConfig = {
  apiKey: 'AIzaSyC37CKb7ZOS7082Anw1YskKYX4GZZlXYg',
  authDomain: 'guardafacil-9d01f.firebaseapp.com',
  projectId: 'guardafacil-9d01f',
  storageBucket: 'guardafacil-9d01f.firebasestorage.app',
  messagingSenderId: '275667229026',
  appId: '1:275667229026:web:21ddbd99d81ce17cb0f43b',
  measurementId: 'G-THG9239297',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;

try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };