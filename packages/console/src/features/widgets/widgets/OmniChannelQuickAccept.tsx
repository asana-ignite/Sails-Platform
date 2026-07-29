import React, { useState } from 'react';
import styles from './OmniChannelQuickAccept.module.css';

const OmniChannelQuickAccept: React.FC = () => {
  const [requestCount, setRequestCount] = useState(3);
  const [requests] = useState([
    { id: '1', channel: 'Chat', customer: 'Alice Chen', waitTime: '2m' },
    { id: '2', channel: 'Email', customer: 'Bob Martinez', waitTime: '5m' },
    { id: '3', channel: 'SMS', customer: 'Carol Wu', waitTime: '30s' },
  ]);

  const handleAccept = (id: string) => {
    setRequestCount(c => c - 1);
  };

  if (requestCount === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <span className={styles.checkmark}>&#10003;</span>
          <span className={styles.emptyText}>All requests served</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.badge}>
        <span className={styles.dot} />
        <span className={styles.count}>{requestCount}</span>
        <span className={styles.label}>Waiting</span>
      </div>
      <div className={styles.requests}>
        {requests.slice(0, requestCount).map((r, i) => (
          <div key={r.id} className={styles.request} style={{ animationDelay: `${i * 0.1}s` }}>
            <div className={styles.channel}>
              <span className={styles.channelIcon}>
                {r.channel === 'Chat' ? '\uD83D\uDCAC' : r.channel === 'Email' ? '\uD83D\uDCE7' : '\uD83D\uDCF1'}
              </span>
              <span className={styles.channelLabel}>{r.channel}</span>
            </div>
            <span className={styles.customer}>{r.customer}</span>
            <span className={styles.waitTime}>{r.waitTime}</span>
            <button className={styles.acceptBtn} onClick={() => handleAccept(r.id)}>
              Accept
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OmniChannelQuickAccept;
