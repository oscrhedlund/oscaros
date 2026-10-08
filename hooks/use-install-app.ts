'use client';
import {useEffect, useState} from 'react';
type InstallPrompt = Event & {prompt: () => Promise<void>; userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>};
export function useInstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(mode.matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone));
    const capture = (event: Event) => {event.preventDefault(); setPrompt(event as InstallPrompt);};
    const complete = () => {setInstalled(true); setPrompt(null);};
    update();
    mode.addEventListener('change', update);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    return () => {mode.removeEventListener('change', update); window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', complete);};
  }, []);
  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }
  return {canInstall: Boolean(prompt), installed, install};
}
