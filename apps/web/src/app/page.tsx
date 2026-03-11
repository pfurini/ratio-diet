'use client';
import { api } from '@ratio-diet/backend/convex/_generated/api';
import { useQuery } from 'convex/react';

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 `;

const getStatusColor = (status: string | undefined) => {
  if (status === 'OK') {
    return 'bg-green-500';
  }
  if (status === undefined) {
    return 'bg-orange-400';
  }
  return 'bg-red-500';
};

const getStatusText = (status: string | undefined) => {
  if (status === undefined) {
    return 'Checking...';
  }
  if (status === 'OK') {
    return 'Connected';
  }
  return 'Error';
};

const Home = () => {
  const healthCheck = useQuery(api.healthCheck.get);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-2">
      <pre className="overflow-x-auto font-mono text-sm">{TITLE_TEXT}</pre>
      <div className="grid gap-6">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">API Status</h2>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor(healthCheck)}`} />
            <span className="text-sm text-muted-foreground">{getStatusText(healthCheck)}</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
