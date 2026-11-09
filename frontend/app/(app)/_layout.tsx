import { Tabs } from 'expo-router';
import { Users, ListChecks, UserRound, Inbox } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { AnimatedTabIcon } from '../../components/ui/AnimatedTabIcon';
import { CommitBadge } from '../../components/ui/CommitBadge';
import { useTodoReminderSync } from '../../hooks/useTodoReminderSync';
import { useDynamicAppIcon } from '../../hooks/useDynamicAppIcon';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { gentleDuration, navEaseOut } from '../../constants/motion';

export default function AppLayout() {
  useTodoReminderSync();
  useDynamicAppIcon();
  const reducedMotion = useReducedMotion();
  // Detail routes are hidden tabs, which cut by default; a short fade keeps
  // open/back from teleporting without slowing a tens-per-day path.
  const detailFade = (duration: number) => ({
    animation: 'fade' as const,
    transitionSpec: {
      animation: 'timing' as const,
      config: { duration: reducedMotion ? gentleDuration : duration, easing: navEaseOut },
    },
  });
  // Edge-to-edge Android draws behind the system navigation bar. Add its
  // inset to the tab bar height/padding so the tab buttons stay tappable.
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
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
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon Icon={ListChecks} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
            title: 'Social',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon Icon={Users} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
        title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon Icon={UserRound} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          headerRight: () => <CommitBadge />,
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon Icon={Inbox} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="todo/new" options={{ href: null, title: 'New Task', ...detailFade(160) }} />
      <Tabs.Screen name="todo/[id]" options={{ href: null, title: 'Edit Task', ...detailFade(160) }} />
      <Tabs.Screen name="todo/friend/[id]" options={{ href: null, title: 'Friend Task', ...detailFade(160) }} />
      <Tabs.Screen name="body-double/request" options={{ href: null, title: 'Body Double', ...detailFade(200) }} />
    </Tabs>
  );
}
