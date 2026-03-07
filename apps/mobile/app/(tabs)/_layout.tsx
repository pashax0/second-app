import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Дропы' }} />
      <Tabs.Screen name="archive" options={{ title: 'Архив' }} />
    </Tabs>
  );
}
