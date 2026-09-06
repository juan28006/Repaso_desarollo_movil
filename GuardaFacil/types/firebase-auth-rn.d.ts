declare module '@firebase/auth/dist/rn/index.js' {
  import type { Persistence } from 'firebase/auth';

  export function getReactNativePersistence(storage: unknown): Persistence;
}
