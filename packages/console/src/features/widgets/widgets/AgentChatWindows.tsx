import React, { useState } from 'react';
import styles from './AgentChatWindows.module.css';

interface ChatWindow {
  id: string;
  customer: string;
  lastMessage: string;
  unread: number;
  timestamp: string;
}

const AgentChatWindows: React.FC = () => {
  const [activeCount] = useState(2);
  const [chats] = useState<ChatWindow[]>([
    { id: '1', customer: 'David Park', lastMessage: 'Need help with my order #1023', unread: 2, timestamp: '1m ago' },
    { id: '2', customer: 'Emma Stone', lastMessage: 'Thanks, that works perfectly!', unread: 0, timestamp: '3m ago' },
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.badge}>
        <span className={styles.dot} />
        <span className={styles.count}>{activeCount}</span>
        <span className={styles.label}>Active</span>
      </div>
      <div className={styles.chats}>
        {chats.map(chat => (
          <div key={chat.id} className={styles.chat}>
            <div className={styles.chatInfo}>
              <span className={styles.customerName}>{chat.customer}</span>
              <span className={styles.lastMessage}>{chat.lastMessage}</span>
            </div>
            <div className={styles.chatMeta}>
              <span className={styles.timestamp}>{chat.timestamp}</span>
              {chat.unread > 0 && (
                <span className={styles.unreadBadge}>{chat.unread}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentChatWindows;
