import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Platform, Animated, Easing } from 'react-native';
import React, { useRef, useEffect } from 'react';

function AnimatedIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  focused: boolean;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.2 : 1)).current;

  useEffect(() => {
    Animated.timing(scale, {
      toValue: focused ? 1.2 : 1,
      duration: 200,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <MaterialIcons name={name} size={28} color={color} />
    </Animated.View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 30,
          marginHorizontal: 20,
          backgroundColor: '#121212',
          borderRadius: 35,
          height: 85,
          paddingHorizontal: 30,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.35,
          shadowRadius: 18,
          borderTopWidth: 0,
          ...Platform.select({
            android: {
              elevation: 24,
            },
          }),
          borderColor: '#222',
        },
        tabBarActiveTintColor: '#1E90FF',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 0.5,
        },
        tabBarShowLabel: true,
        tabBarItemStyle: {
          paddingVertical: 10,
          justifyContent: 'center',
        },
        tabBarIconStyle: {
          marginBottom: 3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon name="search" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="uploadFile"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon name="add-circle-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <AnimatedIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}