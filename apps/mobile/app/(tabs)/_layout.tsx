import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Витрина' }} />
      <Tabs.Screen name="cart" options={{ title: 'Корзина' }} />
      <Tabs.Screen name="profile" options={{ title: 'Я' }} />
    </Tabs>
  );
}
