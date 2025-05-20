// App.js or any component
import React, { useEffect } from 'react';
import { Button, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const GOOGLE_CLIENT_ID = '418248797101-dkeimqq5erl2q1cu3nbmvkuo5k5eugvh.apps.googleusercontent.com';

export default function App() {
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: AuthSession.makeRedirectUri({
        native: 'https://auth.expo.io/@gauravkaloliya/GSMS',
      }),
      scopes: ['openid', 'profile', 'email'],
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      console.log('Access Token:', authentication?.accessToken);
      // Use the access token to get user info
    }
  }, [response]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button
        disabled={!request}
        title="Login with Google"
        onPress={() => promptAsync()}
      />
    </View>
  );
}