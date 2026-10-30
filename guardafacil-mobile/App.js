import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthContextoProvider } from './contextos/AuthContexto';
import { EstadoConexionProvider } from './contextos/EstadoConexionContexto';
import NavegacionStack from './navegacion/NavegacionStack';

export default function App() {
	return (
		<AuthContextoProvider>
			<EstadoConexionProvider>
				<NavigationContainer>
					<NavegacionStack />
				</NavigationContainer>
			</EstadoConexionProvider>
		</AuthContextoProvider>
	);
}
