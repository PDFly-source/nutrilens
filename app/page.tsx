import { SessionProvider } from '@/features/session/SessionContext';
import { AppShell } from '@/components/AppShell';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { ThemeInitializer } from '@/components/ThemeInitializer';

export default function HomePage() {
  return (
    <SessionProvider>
      <ThemeInitializer />
      <ServiceWorkerRegister />
      <AppShell />
    </SessionProvider>
  );
}
