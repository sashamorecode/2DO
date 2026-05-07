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
	Username  string
}

func (dc *DeadlineChecker) Run(ctx context.Context) {
	dc.checkWarning6h(ctx)
	dc.checkDeadlineMissed(ctx)
}

func (dc *DeadlineChecker) checkWarning6h(ctx context.Context) {
	var rows []todoWithToken
	dc.db.WithContext(ctx).Raw(`
		SELECT t.*, u.push_token, u.username
		FROM todos t
		JOIN users u ON u.id = t.user_id
		LEFT JOIN deadline_notifications dn
			ON dn.todo_id = t.id AND dn.notification_type = ?
		WHERE t.status = ?
		  AND t.deadline BETWEEN NOW() AND NOW() + INTERVAL '6 hours'
		  AND dn.id IS NULL
	`, models.NotificationWarning6h, models.StatusPending).Scan(&rows)

	for _, row := range rows {
		if row.PushToken != "" {
			if err := dc.notif.SendWarning6h(row.PushToken, row.Title); err != nil {
				log.Printf("warning_6h send error for todo %s: %v", row.ID, err)
			}
		}
		dc.logNotification(ctx, row.ID, models.NotificationWarning6h)
	}
}

func (dc *DeadlineChecker) checkDeadlineMissed(ctx context.Context) {
	var rows []todoWithToken
	dc.db.WithContext(ctx).Raw(`
		SELECT t.*, u.push_token, u.username
		FROM todos t
		JOIN users u ON u.id = t.user_id
		LEFT JOIN deadline_notifications dn
			ON dn.todo_id = t.id AND dn.notification_type = ?
		WHERE t.status = ?
		  AND t.deadline < NOW()
		  AND dn.id IS NULL
	`, models.NotificationDeadlineMiss, models.StatusPending).Scan(&rows)

	for _, row := range rows {
		// Notify owner
		if row.PushToken != "" {
			if err := dc.notif.SendDeadlineMissedToOwner(row.PushToken, row.Title); err != nil {
				log.Printf("deadline_missed owner send error for todo %s: %v", row.ID, err)
			}
		}

		// Notify friends
		dc.notifyFriends(row.UserID, row.Username, row.Title)
		dc.logNotification(ctx, row.ID, models.NotificationDeadlineMiss)
	}
}

func (dc *DeadlineChecker) notifyFriends(ownerID uuid.UUID, ownerUsername, todoTitle string) {
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
		if err := dc.notif.SendDeadlineMissedToFriend(*friend.PushToken, ownerUsername, todoTitle); err != nil {
			log.Printf("deadline_missed friend send error for user %s: %v", friend.ID, err)
		}
	}
}

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
