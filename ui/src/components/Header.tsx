import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="brand">
            <h1 className="brand-title">LuckyBall Lottery</h1>
            <p className="brand-subtitle">Confidential draws powered by Zama FHE</p>
          </div>
          <ConnectButton chainStatus="icon" showBalance={false} />
        </div>
      </div>
    </header>
  );
}
