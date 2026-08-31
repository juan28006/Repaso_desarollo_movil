// AuthStack.js
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../pantallas/LoginScreen';
const Stack = createStackNavigator();
const AuthStack = () => {
 return (
 <Stack.Navigator initialRouteName="Login">
 <Stack.Screen name="Login" component={LoginScreen} options={{
headerShown: false }} />
 </Stack.Navigator>
 );
};
export default AuthStack;

