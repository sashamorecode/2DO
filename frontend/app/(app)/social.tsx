import React from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../constants/colors';
import { Screen } from '../../components/ui/Screen';
import { FriendCard } from '../../components/friends/FriendCard';
import { FriendRequestCard } from '../../components/friends/FriendRequestCard';
import { FriendSearch } from '../../components/friends/FriendSearch';
import { friendsApi, FriendItem, FriendRequest } from '../../services/friends.api';

export default function SocialScreen() {
  const qc = useQueryClient();

  const { data: friends = [] } = useQuery({ queryKey: ['friends'], queryFn: friendsApi.list });
  const { data: incoming = [] } = useQuery({ queryKey: ['friends-incoming'], queryFn: friendsApi.incoming });

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['friends'] }); qc.invalidateQueries({ queryKey: ['feed'] }); },
  });
  const sendRequestMutation = useMutation({
    mutationFn: friendsApi.sendRequest,
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.error ?? 'Could not send request'),
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Section title="Add Friends">
          <FriendSearch onSendRequest={(id) => sendRequestMutation.mutate(id)} />
        </Section>

        {incoming.length > 0 ? (
          <Section title={`Friend Requests (${incoming.length})`}>
            {incoming.map((request) => (
              <IncomingRequestRow
                key={request.id}
                item={request}
                onAccept={() => acceptMutation.mutate(request.id)}
                onDecline={() => declineMutation.mutate(request.id)}
              />
            ))}
          </Section>
        ) : null}

        <Section title={`Friends (${friends.length})`}>
          {friends.length > 0 ? (
            friends.map((friend) => (
              <FriendRow
                key={friend.friendship_id}
                item={friend}
                onRemove={() => {
                  Alert.alert('Remove Friend', `Remove ${friend.user.username}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(friend.friendship_id) },
                  ]);
                }}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>No friends yet — search above to add some.</Text>
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {children}
    </View>
  );
}

function IncomingRequestRow({
  item,
  onAccept,
  onDecline,
}: {
  item: FriendRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <FriendRequestCard
      username={item.requester?.username ?? ''}
      onAccept={onAccept}
      onDecline={onDecline}
    />
  );
}

function FriendRow({ item, onRemove }: { item: FriendItem; onRemove: () => void }) {
  return <FriendCard username={item.user.username} onRemove={onRemove} />;
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
});
