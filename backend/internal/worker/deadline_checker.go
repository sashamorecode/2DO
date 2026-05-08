package worker

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/models"
	"github.com/sasha/2do-backend/internal/services"
	"gorm.io/gorm"
)

type DeadlineChecker struct {
	db    *gorm.DB
	notif *services.NotificationService
}

func NewDeadlineChecker(db *gorm.DB, notif *services.NotificationService) *DeadlineChecker {
	return &DeadlineChecker{db: db, notif: notif}
}

type todoWithToken struct {
	models.Todo
	PushToken string
	Username  *string
}

// Run sweeps for tasks that need a notification according to the current spec.
//
// Two-stage system:
//
//   Stage 1 — owner heads-up. Always sent before friends are pinged.
//     • Must-Do (priority A): when the *do date* (planned_at) has passed.
//     • Should-Do (priority B): when the *due date* (deadline) has passed.
//     The body explicitly tells the user that friends will be notified in 24h
//     unless they complete the task.
//
//   Stage 2 — friend intervention. Fires 24h after the matching Stage 1
//     notification, only if the task is still pending. Private tasks skip the
//     friend ping but still log the row so we don't keep checking them.
//
// Each (todo, notification_type) is logged in deadline_notifications so we
// fire at most once per task per rule.
func (dc *DeadlineChecker) Run(ctx context.Context) {
	dc.checkDoDatePassed(ctx)
	dc.checkDueDatePassed(ctx)
	dc.checkDoDateIntervention(ctx)
	dc.checkDueDateIntervention(ctx)
}

// --------------- Stage 1: owner heads-up ---------------

func (dc *DeadlineChecker) checkDoDatePassed(ctx context.Context) {
	var rows []todoWithToken
	if err := dc.db.WithContext(ctx).Raw(`
		SELECT t.*, u.push_token, u.username
		FROM todos t
		JOIN users u ON u.id = t.user_id
		LEFT JOIN deadline_notifications dn
			ON dn.todo_id = t.id AND dn.notification_type = ?
		WHERE t.status = ?
		  AND t.priority = ?
		  AND t.planned_at IS NOT NULL
		  AND t.planned_at < NOW()
		  AND dn.id IS NULL
	`, models.NotificationDoDateMissed, models.StatusPending, models.PriorityA).
		Scan(&rows).Error; err != nil {
		log.Printf("checkDoDatePassed query error: %v", err)
		return
	}

	for _, row := range rows {
		if row.PushToken != "" {
			if err := dc.notif.SendDoDateMissed(row.PushToken, row.Title); err != nil {
				log.Printf("do_date_missed send error for todo %s: %v", row.ID, err)
			}
		}
		dc.logNotification(ctx, row.ID, models.NotificationDoDateMissed)
	}
}

func (dc *DeadlineChecker) checkDueDatePassed(ctx context.Context) {
	var rows []todoWithToken
	if err := dc.db.WithContext(ctx).Raw(`
		SELECT t.*, u.push_token, u.username
		FROM todos t
		JOIN users u ON u.id = t.user_id
		LEFT JOIN deadline_notifications dn
			ON dn.todo_id = t.id AND dn.notification_type = ?
		WHERE t.status = ?
		  AND t.priority = ?
		  AND t.deadline IS NOT NULL
		  AND t.deadline < NOW()
		  AND dn.id IS NULL
	`, models.NotificationDueDateMissed, models.StatusPending, models.PriorityB).
		Scan(&rows).Error; err != nil {
		log.Printf("checkDueDatePassed query error: %v", err)
		return
	}

	for _, row := range rows {
		if row.PushToken != "" {
			if err := dc.notif.SendDueDateMissed(row.PushToken, row.Title); err != nil {
				log.Printf("due_date_missed send error for todo %s: %v", row.ID, err)
			}
		}
		dc.logNotification(ctx, row.ID, models.NotificationDueDateMissed)
	}
}

// --------------- Stage 2: friend intervention ---------------

type interventionKind string

const (
	doDateIntervention  interventionKind = "do"
	dueDateIntervention interventionKind = "due"
)

func (dc *DeadlineChecker) checkDoDateIntervention(ctx context.Context) {
	dc.runInterventionStage(
		ctx,
		models.NotificationDoDateMissed,
		models.NotificationDoDateInterventionFriends,
		models.PriorityA,
		doDateIntervention,
	)
}

func (dc *DeadlineChecker) checkDueDateIntervention(ctx context.Context) {
	dc.runInterventionStage(
		ctx,
		models.NotificationDueDateMissed,
		models.NotificationDueDateInterventionFriends,
		models.PriorityB,
		dueDateIntervention,
	)
}

func (dc *DeadlineChecker) runInterventionStage(
	ctx context.Context,
	stage1Type, stage2Type models.NotificationType,
	priority models.Priority,
	kind interventionKind,
) {
	var rows []todoWithToken
	if err := dc.db.WithContext(ctx).Raw(`
		SELECT t.*, u.push_token, u.username
		FROM todos t
		JOIN users u ON u.id = t.user_id
		JOIN deadline_notifications dn1
			ON dn1.todo_id = t.id AND dn1.notification_type = ?
		LEFT JOIN deadline_notifications dn2
			ON dn2.todo_id = t.id AND dn2.notification_type = ?
		WHERE t.status = ?
		  AND t.priority = ?
		  AND dn1.sent_at + INTERVAL '24 hours' <= NOW()
		  AND dn2.id IS NULL
	`, stage1Type, stage2Type, models.StatusPending, priority).Scan(&rows).Error; err != nil {
		log.Printf("intervention query error (%s): %v", stage2Type, err)
		return
	}

	for _, row := range rows {
		// Private tasks: still log the row so we stop checking, but don't
		// surface the task to friends.
		if row.IsPrivate {
			dc.logNotification(ctx, row.ID, stage2Type)
			continue
		}

		ownerName := "Someone"
		if row.Username != nil && *row.Username != "" {
			ownerName = *row.Username
		}
		dc.notifyFriendsForIntervention(row.UserID, ownerName, row.Title, kind)
		dc.logNotification(ctx, row.ID, stage2Type)
	}
}

func (dc *DeadlineChecker) notifyFriendsForIntervention(
	ownerID uuid.UUID,
	ownerUsername, todoTitle string,
	kind interventionKind,
) {
	var friends []models.User
	dc.db.Raw(`
		SELECT u.*
		FROM users u
		JOIN friendships f ON (
			(f.requester_id = ? AND f.addressee_id = u.id) OR
			(f.addressee_id = ? AND f.requester_id = u.id)
		)
		WHERE f.status = ? AND u.push_token IS NOT NULL AND u.push_token != ''
	`, ownerID, ownerID, models.FriendshipAccepted).Scan(&friends)

	for _, friend := range friends {
		if friend.PushToken == nil {
			continue
		}
		var err error
		switch kind {
		case doDateIntervention:
			err = dc.notif.SendDoDateInterventionToFriend(*friend.PushToken, ownerUsername, todoTitle)
		case dueDateIntervention:
			err = dc.notif.SendDueDateInterventionToFriend(*friend.PushToken, ownerUsername, todoTitle)
		}
		if err != nil {
			log.Printf("intervention friend send error for user %s: %v", friend.ID, err)
		}
	}
}

// --------------- helper ---------------

func (dc *DeadlineChecker) logNotification(ctx context.Context, todoID uuid.UUID, ntype models.NotificationType) {
	record := models.DeadlineNotification{
		TodoID:           todoID,
		NotificationType: ntype,
		SentAt:           time.Now(),
	}
	if err := dc.db.WithContext(ctx).Create(&record).Error; err != nil {
		log.Printf("failed to log notification for todo %s type %s: %v", todoID, ntype, err)
	}
}
