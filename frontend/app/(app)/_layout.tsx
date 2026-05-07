import { Tabs } from 'expo-router';
import { colors } from '../../constants/colors';
import { Text } from 'react-native';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Tasks',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>☑️</Text>,
        }}
      />
      <Tabs.Screen
        name="friends-feed"
        options={{
          title: "Friends' Tasks",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👀</Text>,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>👥</Text>,
        }}
      />
      <Tabs.Screen name="todo/new" options={{ href: null }} />
      <Tabs.Screen name="todo/[id]" options={{ href: null }} />
    </Tabs>
  );
}
