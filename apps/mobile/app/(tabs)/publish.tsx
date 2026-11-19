import { Redirect } from 'expo-router';

/** The center "+" tab opens the create-task flow; this route only exists for the tab slot. */
export default function PublishTab() {
  return <Redirect href="/task/create" />;
}
