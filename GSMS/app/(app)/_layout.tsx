import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 30,
          marginHorizontal: 20,
          backgroundColor: '#111',
          borderRadius: 30,
          borderColor: '#222',
          height: 78,
          paddingHorizontal: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25,
          shadowRadius: 16,
          borderTopWidth: 0,
          ...Platform.select({
            android: {
              elevation: 20,
            },
          }),
        },
        tabBarActiveTintColor: '#1E90FF',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
          marginVertical: 4,
          textAlign: 'center',
        },
        tabBarShowLabel: true,
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          alignSelf: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color }) => <MaterialIcons name="search" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={30} color={color} />,
        }}
      />
    </Tabs>
  );
}