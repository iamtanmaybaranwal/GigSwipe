import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, errorMessage, type ApplicationDetail, type Message } from '../../api';
import { useCurrentUser } from '../../context/AuthContext';
import { useSocketEvent } from '../../hooks';
import { joinChat, leaveChat, sendSocketMessage } from '../../services/socket';
import { colors, radius, spacing, tint } from '../../theme';
import { Avatar, Button, ErrorView, IconButton, Loading } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { HireCodeSheet } from '../../components/HireCodeSheet';
import { RatingSheet } from '../../components/RatingSheet';
import { STATUS_META } from '../../components/ConversationRow';
import { clientId as newClientId, formatDate, formatTime, toast } from '../../utils/format';
import type { RootScreen } from '../../navigation/types';

type ChatMessage = Message & { local?: 'sending' | 'failed' };
const MAX_LEN = 2000;

export default function ChatScreen({ route, navigation }: RootScreen<'Chat'>) {
  const { applicationId } = route.params;
  const me = useCurrentUser();
  const isBusiness = me.role === 'business';

  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [rated, setRated] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Loading ────────────────────────────────────────────────────────────────
  const loadApp = useCallback(async () => {
    const { application } = await api.applications.get(applicationId);
    setApp(application);
  }, [applicationId]);

  const loadMessages = useCallback(async () => {
    const { messages: server } = await api.chat.messages(applicationId);
    setMessages(prev => {
      // Keep messages we're still sending / that failed
      const pending = prev.filter(m => m.local && !server.some(x => x.clientId && x.clientId === m.clientId));
      return [...server, ...pending];
    });
  }, [applicationId]);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadApp(), loadMessages()]);
      api.ratings.given().then(r => setRated(r.ratedApplicationIds.includes(applicationId))).catch(() => {});
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [loadApp, loadMessages, applicationId]);

  useEffect(() => {
    loadAll();
    joinChat(applicationId);
    return () => {
      leaveChat(applicationId);
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [applicationId, loadAll]);

  const markReadSoon = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => { api.chat.markRead(applicationId).catch(() => {}); }, 600);
  }, [applicationId]);

  // ── Live updates ───────────────────────────────────────────────────────────
  useSocketEvent<Message>('new_message', msg => {
    if (msg.applicationId !== applicationId) return;
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev;
      const i = msg.clientId ? prev.findIndex(m => m.clientId === msg.clientId) : -1;
      if (i >= 0) { const next = [...prev]; next[i] = msg; return next; }
      return [...prev, msg];
    });
    if (msg.senderId !== me.id) markReadSoon();
  });
  useSocketEvent<{ applicationId: string }>('application_update', p => {
    if (p?.applicationId === applicationId) loadApp().catch(() => {});
  });
  useSocketEvent<boolean>('connection_change', up => { if (up) loadMessages().catch(() => {}); });

  // ── Sending ────────────────────────────────────────────────────────────────
  const deliver = useCallback(async (text: string, cid: string) => {
    const settle = (saved: Message) => setMessages(prev => {
      const withoutDupes = prev.filter(m => m.id !== saved.id || m.clientId === cid);
      return withoutDupes.map(m => (m.clientId === cid ? { ...saved, clientId: cid } : m));
    });
    try {
      settle(await sendSocketMessage(applicationId, text, cid));
    } catch (e: any) {
      if (e?.fromServer) {
        setMessages(prev => prev.map(m => (m.clientId === cid ? { ...m, local: 'failed' } : m)));
        toast(e.message);
        return;
      }
      try {
        settle((await api.chat.send(applicationId, text, cid)).message); // socket down → REST
      } catch (err) {
        setMessages(prev => prev.map(m => (m.clientId === cid ? { ...m, local: 'failed' } : m)));
        toast(errorMessage(err));
      }
    }
  }, [applicationId]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const cid = newClientId();
    setInput('');
    setMessages(prev => [...prev, {
      id: cid, clientId: cid, applicationId, senderId: me.id, senderName: me.name,
      senderRole: me.role, text, timestamp: new Date().toISOString(), local: 'sending',
    }]);
    deliver(text, cid);
  };

  const retry = (m: ChatMessage) => {
    if (!m.clientId) return;
    setMessages(prev => prev.map(x => (x.clientId === m.clientId ? { ...x, local: 'sending' } : x)));
    deliver(m.text, m.clientId);
  };

  // ── Hiring actions ─────────────────────────────────────────────────────────
  const runAction = async (fn: () => Promise<unknown>) => {
    setActionBusy(true);
    try { await fn(); await loadApp(); } catch (e) { Alert.alert('Something went wrong', errorMessage(e)); }
    finally { setActionBusy(false); }
  };

  const accept = () => Alert.alert('Accept this applicant?', 'They’ll get a 4-digit hire code to show you when you meet.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Accept', onPress: () => runAction(() => api.applications.setStatus(applicationId, 'accepted')) },
  ]);
  const decline = () => Alert.alert('Decline this applicant?', 'The conversation will be closed.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Decline', style: 'destructive', onPress: () => runAction(() => api.applications.setStatus(applicationId, 'rejected')) },
  ]);
  const newCode = () => runAction(async () => {
    await api.applications.hireRequest(applicationId);
    toast('New hire code sent to the job seeker');
  });
  const verify = async (code: string) => {
    const { message } = await api.applications.verifyHire(applicationId, code);
    await loadApp();
    Alert.alert('Hired! 🎉', message);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  if (error && !app) {
    return <SafeAreaView style={s.safe}><HeaderBar onBack={() => navigation.goBack()} /><ErrorView message={error} onRetry={loadAll} /></SafeAreaView>;
  }
  if (!app) return <SafeAreaView style={s.safe}><HeaderBar onBack={() => navigation.goBack()} /><Loading /></SafeAreaView>;

  const otherName = isBusiness ? app.workerName : app.businessName;
  const otherColor = isBusiness ? app.workerColor : app.businessColor;
  const otherId = isBusiness ? app.workerId : app.businessId;
  const closed = app.status === 'rejected';
  const status = STATUS_META[app.status];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <HeaderBar onBack={() => navigation.goBack()}>
        <Pressable style={s.hCenter} onPress={() => navigation.navigate('UserProfile', { userId: otherId })}>
          <Avatar name={otherName} color={otherColor} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={s.hName} numberOfLines={1}>{otherName}</Text>
            <Text style={s.hGig} numberOfLines={1}>{app.gigTitle} · <Text style={{ color: status.color, fontWeight: '700' }}>{status.label}</Text></Text>
          </View>
        </Pressable>
      </HeaderBar>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Status / hiring bar */}
        <StatusBar
          app={app} isBusiness={isBusiness} rated={rated} busy={actionBusy}
          onAccept={accept} onDecline={decline} onNewCode={newCode}
          onEnterCode={() => setCodeOpen(true)} onRate={() => setRateOpen(true)}
        />

        {messages.length === 0 ? (
          <View style={s.emptyChat}>
            <Text style={{ fontSize: 34 }}>👋</Text>
            <Text style={s.emptyText}>
              {isBusiness ? `Say hello to ${otherName} and ask any questions about the gig.` : `Introduce yourself to ${otherName}!`}
            </Text>
          </View>
        ) : (
          <FlatList
            data={reversed}
            inverted
            keyExtractor={m => m.clientId ?? m.id}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => {
              const older = reversed[index + 1];
              const newDay = !older || new Date(older.timestamp).toDateString() !== new Date(item.timestamp).toDateString();
              return (
                <View>
                  {newDay ? <Text style={s.day}>{dayLabel(item.timestamp)}</Text> : null}
                  <Bubble msg={item} mine={item.senderId === me.id} onRetry={() => retry(item)} />
                </View>
              );
            }}
          />
        )}

        {closed ? (
          <View style={s.closed}><Text style={s.closedText}>This application was closed. Messaging is turned off.</Text></View>
        ) : (
          <View style={s.inputBar}>
            <TextInput
              style={s.input}
              value={input}
              onChangeText={setInput}
              placeholder="Message…"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={MAX_LEN}
            />
            <IconButton name="send" label="Send message" color={colors.white} bg={input.trim() ? colors.accent : colors.borderMid}
              size={18} onPress={send} disabled={!input.trim()} style={s.sendBtn} />
          </View>
        )}
      </KeyboardAvoidingView>

      <HireCodeSheet visible={codeOpen} workerName={app.workerName} gigTitle={app.gigTitle}
        onClose={() => setCodeOpen(false)} onSubmit={verify} />
      <RatingSheet visible={rateOpen} targetName={otherName} gigTitle={app.gigTitle}
        onClose={() => setRateOpen(false)}
        onSubmit={async (stars, review) => {
          await api.ratings.submit({ applicationId, stars, review: review || undefined });
          setRated(true);
          toast('Thanks for your review!');
        }} />
    </SafeAreaView>
  );
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(iso);
}

function HeaderBar({ onBack, children }: { onBack: () => void; children?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <IconButton name="arrow-back" label="Go back" onPress={onBack} />
      {children}
    </View>
  );
}

function StatusBar({ app, isBusiness, rated, busy, onAccept, onDecline, onNewCode, onEnterCode, onRate }: {
  app: ApplicationDetail; isBusiness: boolean; rated: boolean; busy: boolean;
  onAccept: () => void; onDecline: () => void; onNewCode: () => void; onEnterCode: () => void; onRate: () => void;
}) {
  const rateBtn = !rated
    ? <Button title="Rate" icon="star-outline" size="sm" variant="soft" color={colors.amber} onPress={onRate} />
    : <Text style={s.ratedText}>✓ Rated</Text>;

  if (isBusiness) {
    if (app.status === 'pending') return (
      <Bar icon="person-outline" color={colors.amber} title="New applicant" sub="Accept to move forward, or decline.">
        <Button title="Decline" size="sm" variant="danger" onPress={onDecline} disabled={busy} />
        <Button title="Accept" size="sm" variant="success" onPress={onAccept} loading={busy} />
      </Bar>
    );
    if (app.status === 'accepted' && !app.hireCodeActive) return (
      <Bar icon="key-outline" color={colors.blue} title="Ready to hire?" sub="Send them a new 4-digit hire code.">
        <Button title="Get code" size="sm" onPress={onNewCode} loading={busy} />
      </Bar>
    );
    if (app.status === 'accepted') return (
      <Bar icon="shield-checkmark-outline" color={colors.blue} title="Meet, then confirm" sub="Enter the code they show you to confirm the hire.">
        {!rated ? <Button title="Rate" icon="star-outline" size="sm" variant="soft" color={colors.amber} onPress={onRate} /> : null}
        <Button title="Enter code" size="sm" onPress={onEnterCode} />
      </Bar>
    );
    if (app.status === 'hired') return (
      <Bar icon="checkmark-circle" color={colors.green} title="Hired" sub="Work is confirmed. Rate them when the gig is done.">{rateBtn}</Bar>
    );
    return null;
  }

  if (app.status === 'pending') return (
    <Bar icon="hourglass-outline" color={colors.amber} title="Application sent" sub="The job giver usually replies within a day." />
  );
  if (app.status === 'accepted' && app.hireCode) return (
    <Bar icon="key" color={colors.green} title={`Hire code: ${app.hireCode}`} sub="Show this to the job giver when you meet. It confirms you're hired.">
      {!rated ? <Button title="Rate" icon="star-outline" size="sm" variant="soft" color={colors.amber} onPress={onRate} /> : null}
    </Bar>
  );
  if (app.status === 'accepted') return (
    <Bar icon="checkmark-circle-outline" color={colors.blue} title="You were accepted!" sub="The job giver will send you a hire code when you meet.">{rateBtn}</Bar>
  );
  if (app.status === 'hired') return (
    <Bar icon="checkmark-circle" color={colors.green} title="You're hired!" sub="Rate the job giver when the gig is done.">{rateBtn}</Bar>
  );
  return null;
}

function Bar({ icon, color, title, sub, children }: {
  icon: React.ComponentProps<typeof Icon>['name']; color: string; title: string; sub: string; children?: React.ReactNode;
}) {
  return (
    <View style={[s.bar, { backgroundColor: tint(color, 0.07), borderBottomColor: tint(color, 0.2) }]}>
      <Icon name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[s.barTitle, { color }]}>{title}</Text>
        <Text style={s.barSub}>{sub}</Text>
      </View>
      {children ? <View style={s.barBtns}>{children}</View> : null}
    </View>
  );
}

function Bubble({ msg, mine, onRetry }: { msg: ChatMessage; mine: boolean; onRetry: () => void }) {
  const failed = msg.local === 'failed';
  return (
    <Pressable onPress={failed ? onRetry : undefined} disabled={!failed}
      style={[s.bRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
      <View style={{ maxWidth: '80%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <View style={[s.bubble, mine ? s.mine : s.theirs, msg.local === 'sending' && { opacity: 0.7 }, failed && s.failed]}>
          <Text style={[s.bText, mine && { color: colors.white }]} selectable>{msg.text}</Text>
        </View>
        <Text style={[s.bTime, failed && { color: colors.red }]}>
          {failed ? 'Not sent · tap to retry' : msg.local === 'sending' ? 'Sending…' : formatTime(msg.timestamp)}
        </Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, height: 62, borderBottomWidth: 1, borderBottomColor: colors.border },
  hCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 12 },
  hName: { fontSize: 16, fontWeight: '800', color: colors.dark },
  hGig: { fontSize: 12, color: colors.muted, marginTop: 1 },

  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  barTitle: { fontSize: 14, fontWeight: '800' },
  barSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  barBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  ratedText: { fontSize: 12, fontWeight: '700', color: colors.amber },

  list: { paddingHorizontal: 14, paddingVertical: 12 },
  day: { alignSelf: 'center', fontSize: 11, fontWeight: '700', color: colors.subtle, backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginVertical: 10, overflow: 'hidden' },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl, gap: 10 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },

  bRow: { flexDirection: 'row', marginVertical: 3 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 6 },
  failed: { backgroundColor: colors.red },
  bText: { fontSize: 15, color: colors.dark, lineHeight: 21 },
  bTime: { fontSize: 10, color: colors.subtle, marginTop: 3, marginHorizontal: 6 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.white },
  input: { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.xl,
    paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: colors.dark },
  sendBtn: { width: 44, height: 44, borderRadius: 22 },
  closed: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  closedText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
});
