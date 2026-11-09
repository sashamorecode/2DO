import { AppDialog } from '../../services/appDialog';
import React, { useRef, useState } from 'react';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';
import { disclosureExit, gentleEnter, gentleExit, gentleLayout, listLayout, rowEnter } from '../../constants/motion';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { LoadState } from '../../components/ui/LoadState';
import { Screen } from '../../components/ui/Screen';
import { KeyboardAwareScrollView } from '../../components/ui/KeyboardAwareScrollView';
import { FriendCard } from '../../components/friends/FriendCard';
import { FriendRequestCard } from '../../components/friends/FriendRequestCard';
import { FriendSearch } from '../../components/friends/FriendSearch';
import { friendsApi, FriendItem, FriendRequest } from '../../services/friends.api';
import { useOfflineStore } from '../../store/offlineStore';

export default function SocialScreen() {
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const pendingRemovalIds = useRef(new Set<string>());
  const [removingIds, setRemovingIds] = useState(new Set<string>());
  const isOnline = useOfflineStore((s) => s.isOnline);

  const friendsQuery = useQuery({
    queryKey: ['friends'],
    queryFn: friendsApi.list,
    enabled: isOnline,
  });
  const incomingQuery = useQuery({
    queryKey: ['friends-incoming'],
    queryFn: friendsApi.incoming,
    enabled: isOnline,
  });

  const friends = friendsQuery.data ?? [];
  const incoming = incomingQuery.data ?? [];

  const acceptMutation = useMutation({
    mutationFn: friendsApi.accept,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['friends'] }); qc.invalidateQueries({ queryKey: ['friends-incoming'] }); },
  });
  const declineMutation = useMutation({
    mutationFn: friendsApi.decline,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends-incoming'] }),
  });
  const removeMutation = useMutation({
    mutationFn: friendsApi.remove,
    onError: () => AppDialog.alert("Couldn't remove friend", 'Please try again when connected.'),
    onSuccess: (_data, id) => {
      qc.setQueryData<FriendItem[]>(['friends'], (old) => old?.filter((friend) => friend.friendship_id !== id));
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onSettled: (_data, _error, id) => {
      pendingRemovalIds.current.delete(id);
      setRemovingIds(new Set(pendingRemovalIds.current));
    },
  });
  function removeFriend(id: string) {
    if (!isOnline || pendingRemovalIds.current.has(id)) return;
    pendingRemovalIds.current.add(id);
    setRemovingIds(new Set(pendingRemovalIds.current));
    removeMutation.mutate(id);
  }

  const sendRequestMutation = useMutation({
    mutationFn: friendsApi.sendRequest,
    onError: (e: any) => AppDialog.alert('Error', e?.response?.data?.error ?? 'Could not send request'),
  });

  return (
    <Screen>
      <LayoutAnimationConfig skipEntering skipExiting>
        <KeyboardAwareScrollView contentContainerStyle={styles.list}>
          {!isOnline ? (
            <View style={styles.offlineBanner}>
              <WifiOff size={16} color={colors.warning} strokeWidth={2.2} />
              <Text style={styles.offlineBannerText}>
                You're offline — friend management is unavailable.
              </Text>
            </View>
          ) : null}

          <Section title="Add Friends">
            <FriendSearch disabled={!isOnline} onSendRequest={(id) => sendRequestMutation.mutateAsync(id)} />
          </Section>

          {incomingQuery.isError ? (
            <LoadState title="Couldn't load friend requests" onRetry={isOnline ? () => { void incomingQuery.refetch(); } : undefined} />
          ) : incomingQuery.isLoading ? <LoadState title="Loading friend requests…" loading /> : null}

          {incoming.length > 0 ? (
            <Section title={`Friend Requests (${incoming.length})`}>
              {incoming.map((request) => (
                <Animated.View
                  key={request.id}
                  entering={reduced ? gentleEnter : rowEnter}
                  exiting={reduced ? gentleExit : disclosureExit}
                  layout={reduced ? gentleLayout : listLayout}
                >
                  <IncomingRequestRow
                    item={request}
                    disabled={!isOnline}
                    onAccept={() => acceptMutation.mutateAsync(request.id)}
                    onDecline={() => declineMutation.mutateAsync(request.id)}
                  />
                </Animated.View>
              ))}
            </Section>
          ) : null}

          <Section title={friendsQuery.data ? `Friends (${friends.length})` : 'Friends'}>
            {friendsQuery.isError ? <LoadState title="Couldn't refresh friends" description={friendsQuery.data ? "Showing your saved friends." : undefined} onRetry={isOnline ? () => { void friendsQuery.refetch(); } : undefined} /> : null}
            {friends.length > 0 ? (
              friends.map((friend) => (
                <FriendRow
                  key={friend.friendship_id}
                  item={friend}
                  disabled={!isOnline}
                  loading={removingIds.has(friend.friendship_id)}
                  onRemove={() => {
                    AppDialog.alert('Remove Friend', `Remove ${friend.user.username}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeFriend(friend.friendship_id) },
                    ]);
                  }}
                />
              ))
            ) : friendsQuery.isLoading ? (
              <LoadState title="Loading friends…" loading />
            ) : !friendsQuery.isError ? (
              <Text style={styles.emptyText}>{!isOnline && !friendsQuery.data ? 'Connect to load your friends.' : 'No friends yet — search above to add some.'}</Text>
            ) : null}
          </Section>
        </KeyboardAwareScrollView>
      </LayoutAnimationConfig>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      collapsable={false}
      layout={reduced ? gentleLayout : listLayout}
      exiting={reduced ? gentleExit : disclosureExit}
      style={styles.section}
    >
      <Text style={styles.sectionHeader}>{title}</Text>
      {children}
    </Animated.View>
  );
}

function IncomingRequestRow({
  item,
  onAccept,
  onDecline,
  disabled,
}: {
  item: FriendRequest;
  onAccept: () => Promise<unknown>;
  onDecline: () => Promise<unknown>;
  disabled?: boolean;
}) {
  return (
    <FriendRequestCard
      username={item.requester?.username ?? ''}
      disabled={disabled}
      onAccept={onAccept}
      onDecline={onDecline}
    />
  );
}

function FriendRow({ item, onRemove, disabled, loading }: { item: FriendItem; onRemove: () => void; disabled?: boolean; loading?: boolean }) {
  return <FriendCard username={item.user.username} onRemove={onRemove} disabled={disabled} loading={loading} />;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  section: { marginBottom: 8 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic' },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.warning + '18',
    borderWidth: 1,
    borderColor: colors.warning + '33',
    marginBottom: 12,
  },
  offlineBannerText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
});
