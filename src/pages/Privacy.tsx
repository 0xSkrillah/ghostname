export default function Privacy() {
  return (
    <>
      <h1>What GhostName protects — and what it cannot</h1>
      <p className="lead">
        GhostName is forward privacy for ENS receiving addresses. It is not anonymity, not a
        mixer, not zero knowledge, and it cannot delete blockchain history. Here is the
        honest boundary.
      </p>

      <h2>Past — cannot be erased</h2>
      <div className="card danger">
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>Historic transactions of any address the name has resolved to.</li>
          <li>Historic ENS ownership and record state (public, archived, replicated).</li>
          <li>Anything already published or downloaded by others.</li>
        </ul>
      </div>

      <h2>Present — current exposure can be reduced</h2>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>
            Current public ENS records (address, profile, socials) are visible to everyone.
            You can review and remove records you no longer want associated — GhostName
            explains this but never executes destructive changes for you.
          </li>
          <li>
            A primary name (reverse record) publicly ties your wallet to your name; you can
            unset it in the ENS app if that association harms you.
          </li>
        </ul>
      </div>

      <h2>Future — what GhostName adds</h2>
      <div className="card ok">
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>Keep the human-readable ENS identity.</li>
          <li>
            Publish one public <code>stealth-meta-address[1]</code> record.
          </li>
          <li>Every future sender derives a fresh one-time receiving address, locally.</li>
          <li>Future payments no longer accumulate on one linkable address.</li>
        </ul>
      </div>

      <h2>Protected</h2>
      <table className="plain">
        <tbody>
          <tr>
            <td>
              Linkage between your ENS name and <em>future</em> one-time receiving addresses,
              against ordinary passive blockchain observers.
            </td>
          </tr>
          <tr>
            <td>Recipient-address reuse (each payment gets a fresh destination).</td>
          </tr>
          <tr>
            <td>
              No gateway dependency: ephemeral keys and stealth addresses are generated in
              the sender's client, so no third party learns destinations by construction.
            </td>
          </tr>
          <tr>
            <td>
              Recipient discovery without revealing viewing/spending secrets: scanning uses
              your private viewing key locally.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Not protected</h2>
      <table className="plain">
        <tbody>
          <tr><td>Historical blockchain activity — nothing can delete it.</td></tr>
          <tr><td>Existence and ownership of the ENS name itself.</td></tr>
          <tr><td>The public stealth meta-address record (it is meant to be public).</td></tr>
          <tr><td>Sender identity, if the sender pays from a public wallet.</td></tr>
          <tr><td>Amounts of ordinary ETH/ERC-20 transfers — visible on-chain.</td></tr>
          <tr><td>Timing, network, RPC and browser-fingerprint correlation attacks.</td></tr>
          <tr><td>A compromised device, or leaked viewing/spending keys.</td></tr>
          <tr><td>Your identity to a sender who already knows who they are paying.</td></tr>
        </tbody>
      </table>

      <p className="small dim">
        Mechanism: ERC-5564 scheme 1 (secp256k1 + view tags), resolved from the ENS text
        record <code>stealth-meta-address[1]</code> per the ENS stealth-resolution RFC.
        Mainnet is read-only in this app; writes are hard-gated to Sepolia.
      </p>
    </>
  );
}
