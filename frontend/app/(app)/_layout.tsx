import { Tabs } from 'expo-router';
import { Users, ListChecks, UserRound } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { AnimatedTabIcon } from '../../components/ui/AnimatedTabIcon';

export default function AppLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accentLight,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '800', fontSize: 17, letterSpacing: -0.2 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon Icon={ListChecks} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon Icon={Users} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon Icon={UserRound} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="todo/new" options={{ href: null, title: 'New Task' }} />
      <Tabs.Screen name="todo/[id]" options={{ href: null, title: 'Edit Task' }} />
    </Tabs>
  );
}
