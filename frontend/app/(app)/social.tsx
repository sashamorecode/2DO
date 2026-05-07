import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, SectionList } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../constants/colors';
import { Screen } from '../../components/ui/Screen';
import { FriendCard } from '../../components/friends/FriendCard';
import { FriendRequestCard } from '../../components/friends/FriendRequestCard';
import { FriendSearch } from '../../components/friends/FriendSearch';
import { friendsApi } from '../../services/friends.api';

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
      <SectionList
        contentContainerStyle={styles.list}
        sections={[
          {
            title: 'Add Friends',
            data: ['search' as const],
            renderItem: () => (
              <FriendSearch onSendRequest={(id) => sendRequestMutation.mutate(id)} />
            ),
          },
          ...(incoming.length > 0 ? [{
            title: `Friend Requests (${incoming.length})`,
            data: incoming,
            renderItem: ({ item }: { item: typeof incoming[0] }) => (
              <FriendRequestCard
                username={item.requester?.username ?? ''}
                onAccept={() => acceptMutation.mutate(item.id)}
                onDecline={() => declineMutation.mutate(item.id)}
              />
            ),
          }] : []),
          {
            title: `Friends (${friends.length})`,
            data: friends.length > 0 ? friends : ['empty' as const],
            renderItem: ({ item }: { item: typeof friends[0] | 'empty' }) => {
              if (item === 'empty') return (
                <Text style={styles.emptyText}>No friends yet — search above to add some.</Text>
              );
              return (
                <FriendCard
                  username={(item as typeof friends[0]).user.username}
                  onRemove={() => {
                    Alert.alert('Remove Friend', `Remove ${(item as typeof friends[0]).user.username}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate((item as typeof friends[0]).friendship_id) },
                    ]);
                  }}
                />
              );
            },
          },
        ]}
        keyExtractor={(item, index) => (typeof item === 'string' ? item + index : (item as any).id)}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
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
