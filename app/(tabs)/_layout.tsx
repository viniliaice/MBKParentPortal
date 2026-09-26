import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';

/**
 * The parent app's four destinations, in the order a parent needs them:
 * home (how are my children doing), marks, messages, everything else.
 *
 * Learning is deliberately *not* a tab any more — it is practice material for the
 * child, not one of the two questions the app exists to answer, so it lives under
 * More. The route is unchanged, only its place in the bar.
 */
function TabLayout() {
  const c = useColors();
  const { isDark } = useTheme();
  const { unreadCommunications } = useApp();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.tabBarInactive,
        headerShown: false,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarBadgeStyle: {
          backgroundColor: c.destructive,
          color: c.destructiveForeground,
          fontSize: 10,
          fontWeight: '700',
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : c.tabBar,
          borderTopWidth: 1,
          borderTopColor: c.tabBarBorder,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c.tabBar }]} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c.tabBar }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="house.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="home" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="marks"
        options={{
          title: 'Marks',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="bar-chart" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unreadCommunications > 0 ? unreadCommunications : undefined,
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="envelope.fill" tintColor={color} size={size} />
            ) : (
              <Ionicons name="mail" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="ellipsis.circle" tintColor={color} size={size} />
            ) : (
              <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />
            ),
        }}
      />
      {/* Practice material for the child: reachable from More, not a primary destination. */}
      <Tabs.Screen name="learning" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayoutScreen() {
  return <TabLayout />;
}
