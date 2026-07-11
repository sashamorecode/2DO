import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors } from '../../constants/colors';
import { Screen } from '../../components/ui/Screen';
import { FriendRequestCard } from '../../components/friends/FriendRequestCard';
import { BodyDoubleInvitationCard } from '../../components/bodyDouble/BodyDoubleInvitationCard';
import { friendsApi, FriendRequest } from '../../services/friends.api';
import { bodyDoubleApi, BodyDoubleSession } from '../../services/bodyDouble.api';
import { formatDateTimeInTimeZone } from '../../services/timezone';
import { useAuthStore } from '../../store/authStore';

export default function InboxScreen() {
  const qc = useQueryClient();
  const timezone = useAuthStore((s) => s.user?.timezone);

  const {
    data: incoming = [],
    isLoading: friendsLoading,
    refetch: refetchFriends,
  } = useQuery({
    queryKey: ['friends-incoming'],
    queryFn: friendsApi.incoming,
  });

  const {
    data: sessions = [],
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['body-double-sessions', 'invitee'],
    queryFn: () => bodyDoubleApi.listSessions('invitee'),
  });

  // Extract pending invitations from sessions
  const pendingInvitations = useMemo(() => {
    return sessions.flatMap((session) =>
      (session.invitations ?? [])
        .filter((inv) => inv.status === 'pending')
        .map((inv) => ({
          invitationId: inv.id,
          sessionId: session.id,
          username: session.requester?.username ?? 'Someone',
          taskTitle: session.todo?.title,
          message: session.message,
          scheduledAt: session.scheduled_at,
        }))
    );
  }, [sessions]);

  const acceptFriendMutation = useMutation({
    mutationFn: friendsApi.accept,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['friends-incoming'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const declineFriendMutation = useMutation({
    mutationFn: friendsApi.decline,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends-incoming'] }),
  });

  const respondMutation = useMutation({
    mutationFn: ({
      invitationId,
      status,
    }: {
      invitationId: string;
      status: 'accepted' | 'maybe' | 'declined';
    }) => bodyDoubleApi.respond(invitationId, status),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ['body-double-sessions'] });
      qc.invalidateQueries({ queryKey: ['todos'] });
      if (variables.status === 'accepted' || variables.status === 'maybe') {
        Alert.alert(
          'Session Added',
          'The body doubling session has been added to your calendar.'
        );
      }
    },
    onError: (error: any) => {
      Alert.alert('Error', error?.response?.data?.error ?? 'Failed to respond.');
    },
  });

  const isLoading = friendsLoading || sessionsLoading;
  const hasContent = incoming.length > 0 || pendingInvitations.length > 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              refetchFriends();
              refetchSessions();
            }}
            tintColor={colors.accentLight}
          />
        }
      >
        {!hasContent && !isLoading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptySub}>
              No pending friend requests or body double invitations.
            </Text>
          </View>
        )}

        {pendingInvitations.length > 0 && (
          <Section title={`Body Double Invitations (${pendingInvitations.length})`}>
            {pendingInvitations.map((inv) => (
              <BodyDoubleInvitationCard
                key={inv.invitationId}
                username={inv.username}
                taskTitle={inv.taskTitle}
                message={inv.message}
                scheduledAt={formatDateTimeInTimeZone(inv.scheduledAt, timezone, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                loading={respondMutation.isPending}
                onAccept={() =>
                  respondMutation.mutate({
                    invitationId: inv.invitationId,
                    status: 'accepted',
                  })
                }
                onMaybe={() =>
                  respondMutation.mutate({
                    invitationId: inv.invitationId,
                    status: 'maybe',
                  })
                }
                onDecline={() =>
                  respondMutation.mutate({
                    invitationId: inv.invitationId,
                    status: 'declined',
                  })
                }
              />
            ))}
          </Section>
        )}

        {incoming.length > 0 && (
          <Section title={`Friend Requests (${incoming.length})`}>
            {incoming.map((request) => (
              <IncomingRequestRow
                key={request.id}
                item={request}
                onAccept={() => acceptFriendMutation.mutate(request.id)}
                onDecline={() => declineFriendMutation.mutate(request.id)}
              />
            ))}
          </Section>
        )}
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
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
