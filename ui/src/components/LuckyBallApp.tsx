import { useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Contract, ZeroHash, formatEther } from 'ethers';

import { Header } from './Header';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';

import '../styles/LuckyBall.css';

type DrawInfo = {
  executed: boolean;
  winningNumber: number;
  executedAt: bigint;
};

type TicketInfo = {
  index: number;
  handle: `0x${string}`;
  drawId: bigint;
  claimed: boolean;
};

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_TICKET_PRICE = 1_000_000_000_000_000n;

function normalizeDraw(raw: any): DrawInfo {
  const winningNumber = Number(raw?.winningNumber ?? raw?.[0] ?? 0);
  const executedAt = BigInt(raw?.executedAt ?? raw?.[1] ?? 0);
  const executed = Boolean(raw?.executed ?? raw?.[2] ?? false);
  return { executed, winningNumber, executedAt };
}

function normalizeTicket(raw: any, index: number): TicketInfo {
  const handle = (raw?.number ?? raw?.[0]) as `0x${string}`;
  const drawId = BigInt(raw?.drawId ?? raw?.[1] ?? 0);
  const claimed = Boolean(raw?.claimed ?? raw?.[2] ?? false);
  return { index, handle, drawId, claimed };
}

function parseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error occurred';
}

export function LuckyBallApp() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decryptedScore, setDecryptedScore] = useState<bigint | null>(null);
  const [decryptingScore, setDecryptingScore] = useState(false);
  const [ticketDecryptions, setTicketDecryptions] = useState<Record<number, { value?: bigint; loading: boolean }>>({});
  const [buyLoading, setBuyLoading] = useState(false);
  const [drawLoading, setDrawLoading] = useState(false);
  const [claimLoading, setClaimLoading] = useState<Record<number, boolean>>({});

  const contractReady = CONTRACT_ADDRESS !== EMPTY_ADDRESS;

  const { data: ticketPrice } = useQuery({
    queryKey: ['ticketPrice'],
    enabled: contractReady && Boolean(publicClient),
    queryFn: async () => {
      return (await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'TICKET_PRICE',
      })) as bigint;
    },
  });

  const { data: currentDrawId } = useQuery({
    queryKey: ['currentDrawId'],
    enabled: contractReady && Boolean(publicClient),
    queryFn: async () => {
      return (await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'currentDrawId',
      })) as bigint;
    },
  });

  const { data: activeDraw } = useQuery({
    queryKey: ['activeDraw', currentDrawId?.toString() ?? '0'],
    enabled: contractReady && Boolean(publicClient && currentDrawId !== undefined),
    queryFn: async () => {
      const raw = await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getDraw',
        args: [currentDrawId!],
      });
      return normalizeDraw(raw);
    },
  });

  const { data: previousDraw } = useQuery({
    queryKey: ['previousDraw', currentDrawId ? (currentDrawId - 1n).toString() : '0'],
    enabled: contractReady && Boolean(publicClient && currentDrawId !== undefined && currentDrawId > 1n),
    queryFn: async () => {
      const raw = await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getDraw',
        args: [currentDrawId! - 1n],
      });
      return normalizeDraw(raw);
    },
  });

  const { data: scoreHandle } = useQuery({
    queryKey: ['score', address],
    enabled: contractReady && Boolean(publicClient && address),
    queryFn: async () => {
      return (await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getScore',
        args: [address!],
      })) as `0x${string}`;
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ['tickets', address],
    enabled: contractReady && Boolean(publicClient && address),
    queryFn: async () => {
      const rawTickets = (await publicClient!.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getTickets',
        args: [address!],
      })) as any[];
      return rawTickets.map((ticket, index) => normalizeTicket(ticket, index));
    },
  });

  const ticketDrawIds = useMemo(() => {
    if (!tickets || tickets.length === 0) {
      return [] as string[];
    }
    const ids = new Set<string>();
    tickets.forEach((ticket) => ids.add(ticket.drawId.toString()));
    return Array.from(ids);
  }, [tickets]);

  const { data: historicalDraws } = useQuery({
    queryKey: ['ticket-draws', ticketDrawIds.join('-')],
    enabled: contractReady && Boolean(publicClient && ticketDrawIds.length > 0),
    queryFn: async () => {
      const entries = await Promise.all(
        ticketDrawIds.map(async (id) => {
          const raw = await publicClient!.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getDraw',
            args: [BigInt(id)],
          });
          return [id, normalizeDraw(raw)] as const;
        })
      );
      return Object.fromEntries(entries) as Record<string, DrawInfo>;
    },
  });

  const ticketPriceLabel = ticketPrice ? `${formatEther(ticketPrice)} ETH` : '0.001 ETH';

  const contractUnavailable = !contractReady;

  async function requestUserDecrypt(handles: string[]) {
    if (!instance) {
      throw new Error('Encryption service not initialized');
    }
    if (!signerPromise) {
      throw new Error('Wallet not connected');
    }

    const signer = await signerPromise;
    const keypair = instance.generateKeypair();
    const contractAddresses = [CONTRACT_ADDRESS];
    const startTimestamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = '7';
    const handleContractPairs = handles.map((handle) => ({ handle, contractAddress: CONTRACT_ADDRESS }));
    const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );

    const signerAddress = await signer.getAddress();

    return instance.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace('0x', ''),
      contractAddresses,
      signerAddress,
      startTimestamp,
      durationDays
    );
  }

  async function handleBuyTicket() {
    if (selectedNumber === null) {
      setErrorMessage('Select a number before purchasing');
      return;
    }
    if (!address) {
      setErrorMessage('Connect your wallet to buy a ticket');
      return;
    }
    if (!instance) {
      setErrorMessage('Encryption service not ready yet');
      return;
    }
    if (!signerPromise) {
      setErrorMessage('Wallet signer is not available');
      return;
    }

    setErrorMessage(null);
    setStatusMessage('Encrypting selected number...');
    setBuyLoading(true);

    try {
      const encryptedInputBuilder = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      encryptedInputBuilder.add8(selectedNumber);
      const encrypted = await encryptedInputBuilder.encrypt();

      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.buyTicket(encrypted.handles[0], encrypted.inputProof, {
        value: ticketPrice ?? DEFAULT_TICKET_PRICE,
      });

      setStatusMessage('Waiting for confirmation...');
      await tx.wait();

      setStatusMessage('Ticket purchased successfully');
      setSelectedNumber(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets', address] }),
        queryClient.invalidateQueries({ queryKey: ['score', address] }),
      ]);
    } catch (error) {
      setErrorMessage(parseError(error));
    } finally {
      setBuyLoading(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function handleExecuteDraw() {
    if (!signerPromise) {
      setErrorMessage('Connect your wallet to execute the draw');
      return;
    }
    setErrorMessage(null);
    setStatusMessage('Executing draw...');
    setDrawLoading(true);

    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.executeDraw();
      await tx.wait();

      setStatusMessage('Draw completed successfully');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['currentDrawId'] }),
        queryClient.invalidateQueries({ queryKey: ['tickets', address] }),
        queryClient.invalidateQueries({ queryKey: ['activeDraw'] }),
        queryClient.invalidateQueries({ queryKey: ['previousDraw'] }),
      ]);
    } catch (error) {
      setErrorMessage(parseError(error));
    } finally {
      setDrawLoading(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function handleClaimTicket(ticket: TicketInfo) {
    if (!signerPromise) {
      setErrorMessage('Connect your wallet to claim a ticket');
      return;
    }

    setClaimLoading((prev) => ({ ...prev, [ticket.index]: true }));
    setErrorMessage(null);
    setStatusMessage(`Claiming ticket #${ticket.index}...`);

    try {
      const signer = await signerPromise;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.claimTicket(ticket.index);
      await tx.wait();

      setStatusMessage(`Ticket #${ticket.index} processed`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets', address] }),
        queryClient.invalidateQueries({ queryKey: ['score', address] }),
      ]);
    } catch (error) {
      setErrorMessage(parseError(error));
    } finally {
      setClaimLoading((prev) => ({ ...prev, [ticket.index]: false }));
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  async function handleDecryptScore() {
    if (!scoreHandle || scoreHandle === ZeroHash) {
      setDecryptedScore(0n);
      return;
    }

    setDecryptingScore(true);
    setErrorMessage(null);

    try {
      const result = await requestUserDecrypt([scoreHandle]);
      const valueRaw = result[scoreHandle];
      const value = typeof valueRaw === 'bigint' ? valueRaw : BigInt(valueRaw);
      setDecryptedScore(value);
    } catch (error) {
      setErrorMessage(parseError(error));
    } finally {
      setDecryptingScore(false);
    }
  }

  async function handleDecryptTicket(ticket: TicketInfo) {
    if (!ticket.handle || ticket.handle === ZeroHash) {
      setTicketDecryptions((prev) => ({ ...prev, [ticket.index]: { value: 0n, loading: false } }));
      return;
    }

    setTicketDecryptions((prev) => ({ ...prev, [ticket.index]: { value: prev[ticket.index]?.value, loading: true } }));
    setErrorMessage(null);

    try {
      const result = await requestUserDecrypt([ticket.handle]);
      const valueRaw = result[ticket.handle];
      const value = typeof valueRaw === 'bigint' ? valueRaw : BigInt(valueRaw);
      setTicketDecryptions((prev) => ({ ...prev, [ticket.index]: { value, loading: false } }));
    } catch (error) {
      setErrorMessage(parseError(error));
      setTicketDecryptions((prev) => ({ ...prev, [ticket.index]: { value: prev[ticket.index]?.value, loading: false } }));
    }
  }

  const connected = Boolean(address);
  const ticketList = tickets ?? [];

  return (
    <div className="app-shell">
      <Header />
      <div className="content-wrapper">
        {contractUnavailable && (
          <div className="status-banner error">
            Contract address is not configured. Please update the frontend configuration.
          </div>
        )}
        {zamaError && <div className="status-banner error">{zamaError}</div>}
        {statusMessage && <div className="status-banner">{statusMessage}</div>}
        {errorMessage && <div className="status-banner error">{errorMessage}</div>}

        <div className="grid-layout">
          <div className="section">
            <h2 className="section-title">Your Score</h2>
            <p className="section-description">
              Encrypted player points awarded for matching draw results. Each winning ticket adds 10 points.
            </p>
            <div className="score-subtitle">Encrypted score handle</div>
            <div className="handle-box">{scoreHandle ?? '—'}</div>
            <div className="cta-row">
              <button
                className="action-button secondary"
                disabled={!connected || zamaLoading || decryptingScore}
                onClick={handleDecryptScore}
              >
                {decryptingScore ? 'Decrypting...' : 'Decrypt Score'}
              </button>
              <div className="muted-text">{decryptedScore !== null ? `Decrypted value: ${decryptedScore.toString()} pts` : ''}</div>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Buy Ticket</h2>
            <p>Your ticket is encrypted by zama.</p>
            <p className="section-description">
              Select a number and purchase a ticket for the current draw. Each ticket costs {ticketPriceLabel}.
            </p>
            <div className="number-grid">
              {Array.from({ length: 9 }, (_, idx) => idx + 1).map((number) => (
                <button
                  key={number}
                  className={`number-button ${selectedNumber === number ? 'active' : ''}`}
                  onClick={() => setSelectedNumber(number)}
                  type="button"
                >
                  {number}
                </button>
              ))}
            </div>
            <div className="cta-row">
              <button
                className="action-button"
                onClick={handleBuyTicket}
                disabled={
                  !connected || !instance || zamaLoading || buyLoading || selectedNumber === null || !contractReady
                }
              >
                {buyLoading ? 'Processing...' : 'Buy Ticket'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid-layout" style={{ marginTop: '24px' }}>
          <div className="section">
            <div className="list-header">
              <h2 className="section-title" style={{ marginBottom: 0 }}>Your Tickets</h2>
              <div className="muted-text">Total: {ticketList.length}</div>
            </div>
            {ticketList.length === 0 ? (
              <div className="empty-state">
                Purchase tickets to populate this list. You can decrypt them anytime.
              </div>
            ) : (
              <div className="ticket-list">
                {ticketList.map((ticket) => {
                  const ticketState = ticketDecryptions[ticket.index];
                  const decodedValue = ticketState?.value;
                  const drawInfo = historicalDraws?.[ticket.drawId.toString()];
                  const statusLabel = ticket.claimed
                    ? 'Claimed'
                    : drawInfo?.executed
                      ? 'Ready to claim'
                      : 'Waiting for draw';
                  const statusClass = ticket.claimed ? 'claimed' : 'open';

                  return (
                    <div className="ticket-card" key={ticket.index}>
                      <div className="ticket-header">
                        <div className="ticket-title">Ticket #{ticket.index}</div>
                        <span className={`ticket-status ${statusClass}`}>{statusLabel}</span>
                      </div>
                      <div className="ticket-meta">
                        <span>Draw ID: {ticket.drawId.toString()}</span>
                        {drawInfo?.executed && (
                          <span className="pill">Winning number: {drawInfo.winningNumber}</span>
                        )}
                        <span>{ticket.claimed ? 'Already processed' : 'Not claimed yet'}</span>
                      </div>
                      <div className="handle-box" style={{ marginBottom: '12px' }}>{ticket.handle}</div>
                      {decodedValue !== undefined && (
                        <div className="muted-text">Decrypted number: {decodedValue.toString()}</div>
                      )}
                      <div className="ticket-actions">
                        <button
                          className="action-button secondary"
                          type="button"
                          disabled={!connected || zamaLoading || ticketState?.loading}
                          onClick={() => handleDecryptTicket(ticket)}
                        >
                          {ticketState?.loading ? 'Decrypting...' : 'Decrypt Ticket'}
                        </button>
                        <button
                          className="action-button danger"
                          type="button"
                          disabled={
                            !connected || ticket.claimed || claimLoading[ticket.index] || !contractReady
                          }
                          onClick={() => handleClaimTicket(ticket)}
                        >
                          {claimLoading[ticket.index] ? 'Claiming...' : 'Claim Reward'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="section">
            <h2 className="section-title">Draw Control</h2>
            <div className="draw-info">
              <div>
                <strong>Active draw:</strong> #{currentDrawId ? currentDrawId.toString() : '—'}
              </div>
              <div>
                <strong>Status:</strong> {activeDraw?.executed ? 'Closed' : 'Open for tickets'}
              </div>
              {previousDraw?.executed && (
                <div>
                  <strong>Last winning number:</strong> {previousDraw.winningNumber}
                </div>
              )}
            </div>
            <button
              className="action-button"
              type="button"
              onClick={handleExecuteDraw}
              disabled={!connected || drawLoading || !contractReady}
            >
              {drawLoading ? 'Drawing...' : 'Execute Draw'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
