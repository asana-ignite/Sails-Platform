/**
 * RecordStackContext — stacked record cards: create/edit dialogs opened
 * over a list (e.g. Related-List inline creation) are rendered in a stack
 * of overlay cards; this context manages the stack and change
 * notifications so parent lists refresh automatically.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface StackEntry {
  id: string;
  tableName: string;
  layoutKey: string;
  recordId: string;
  /** Pre-filled values for a new-record card (e.g. parent FK binding from a Related List block). */
  preset?: Record<string, any>;
}

export interface RecordStackContextValue {
  stack: StackEntry[];
  /** Entry ids currently animating out (fly-out) — still mounted until the animation ends. */
  closingIds: string[];
  /** Close the top card (fly-out), or all cards at/above `id` when provided. */
  requestClose: (id?: string) => void;
  /** Open a record detail card on top of the stack. */
  pushRecord: (entry: Omit<StackEntry, 'id'>) => void;
  /** Increments whenever a record is created/updated/deleted in a stacked card. */
  recordsVersion: number;
  /** Notify lists/related blocks underneath to refetch (call after mutations in stacked cards). */
  notifyRecordsChanged: () => void;
}

const MAX_STACK_DEPTH = 10;
const FLY_OUT_MS = 320;

const RecordStackContext = createContext<RecordStackContextValue>({
  stack: [],
  closingIds: [],
  requestClose: () => {},
  pushRecord: () => {},
  recordsVersion: 0,
  notifyRecordsChanged: () => {},
});

export const RecordStackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [closingIds, setClosingIds] = useState<string[]>([]);
  const [recordsVersion, setRecordsVersion] = useState(0);
  const idCounter = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stackRef = useRef<StackEntry[]>([]);
  useEffect(() => { stackRef.current = stack; }, [stack]);

  const notifyRecordsChanged = useCallback(() => {
    setRecordsVersion((v) => v + 1);
  }, []);

  const pushRecord = useCallback((entry: Omit<StackEntry, 'id'>) => {
    setStack((prev) => {
      if (prev.length >= MAX_STACK_DEPTH) return prev;
      idCounter.current += 1;
      return [...prev, { ...entry, id: `rec_${Date.now()}_${idCounter.current}` }];
    });
  }, []);

  // Mark entries (top card, or the given card and everything above it) as
  // closing, then remove them once the fly-out animation has completed.
  const requestClose = useCallback((id?: string) => {
    const prev = stackRef.current;
    if (prev.length === 0) return;
    const startIdx = id === undefined ? prev.length - 1 : prev.findIndex((e) => e.id === id);
    if (startIdx === -1) return;
    const toClose = prev.slice(startIdx).map((e) => e.id);

    setClosingIds((prevClosing) => [...new Set([...prevClosing, ...toClose])]);
    const timer = setTimeout(() => {
      setStack((current) => current.filter((e) => !toClose.includes(e.id)));
      setClosingIds((prevClosing) => prevClosing.filter((cid) => !toClose.includes(cid)));
    }, FLY_OUT_MS);
    timersRef.current.push(timer);
  }, []);

  // Clean up pending timers on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const value = useMemo(
    () => ({ stack, closingIds, requestClose, pushRecord, recordsVersion, notifyRecordsChanged }),
    [stack, closingIds, requestClose, pushRecord, recordsVersion, notifyRecordsChanged]
  );

  return (
    <RecordStackContext.Provider value={value}>
      {children}
    </RecordStackContext.Provider>
  );
};

export function useRecordStack(): RecordStackContextValue {
  return useContext(RecordStackContext);
}
