import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

const projectId = 'projectid';

export const config = getDefaultConfig({
  appName: 'LuckyBall Lottery',
  projectId,
  chains: [sepolia],
  ssr: false,
});
