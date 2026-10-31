import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { getToken, getRole } from '../src/utils/session';
import { colors } from '../src/theme/tokens';
import { useState } from 'react';

export default function Index() {
  const [state, setState] = useState<'loading' | 'auth' | 'owner' | 'admin'>('loading');

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return setState('auth');
      const role = await getRole();
      setState(role === 'admin' ? 'admin' : 'owner');
    })();
  }, []);

  if (state === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.dsBackground }}>
        <ActivityIndicator size="large" color={colors.dsPrimary} />
      </View>
    );
  }
  if (state === 'auth') return <Redirect href="/(auth)/login" />;
  if (state === 'admin') return <Redirect href="/(admin)/overview" />;
  return <Redirect href="/(owner)/products" />;
}

