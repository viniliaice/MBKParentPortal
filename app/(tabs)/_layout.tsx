import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useScheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

/**
 * Primary navigation reflects the app's parent purpose: Home (marks at a
 * glance), Marks (reports), Messages (school communication), More (secondary).
 * Learning stays registered (route must exist) but is demoted out of the tab
 * bar and reached from More, because its backing tables do not exist in the
 * live database (docs/app-db-contract.md).
 */
function TabLayout() {
  const { isDark } = useScheme();
  const c = useColors();
  const { unreadCount } = useApp();
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : c.card,
          borderTopWidth: 1,
          borderTopColor: c.border,
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
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'house.fill' : 'house'} tintColor={color} size={size} />
            ) : (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="marks"
        options={{
          title: 'Marks',
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'chart.bar.fill' : 'chart.bar'} tintColor={color} size={size} />
            ) : (
              <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: c.destructive, color: '#FFFFFF', fontSize: 11 },
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'envelope.fill' : 'envelope'} tintColor={color} size={size} />
            ) : (
              <Ionicons name={focused ? 'mail-unread' : 'mail-unread-outline'} size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'square.grid.2x2.fill' : 'square.grid.2x2'} tintColor={color} size={size} />
            ) : (
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="learning"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function TabLayoutScreen() {
  return <TabLayout />;
}
