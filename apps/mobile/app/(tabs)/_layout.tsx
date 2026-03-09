import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Дропы' }} />
      <Tabs.Screen name="archive" options={{ title: 'Архив' }} />
      <Tabs.Screen name="profile" options={{ title: 'Я' }} />
      <Tabs.Screen name="drop/[id]" options={{ href: null, title: 'Дроп' }} />
    </Tabs>
  );
}
