package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NotificationType string

const (
	NotificationWarning6h     NotificationType = "warning_6h"
	NotificationDeadlineMiss  NotificationType = "deadline_missed"
	// Stage 1 — heads up to the owner that friends will be notified in 24h.
	NotificationDoDateMissed  NotificationType = "do_date_missed"
	NotificationDueDateMissed NotificationType = "due_date_missed"
	// Stage 2 — friends pinged 24h after the owner heads-up.
	NotificationDoDateInterventionFriends  NotificationType = "do_date_intervention_friends"
	NotificationDueDateInterventionFriends NotificationType = "due_date_intervention_friends"
)

type DeadlineNotification struct {
	ID               uuid.UUID        `gorm:"type:uuid;primaryKey" json:"id"`
	TodoID           uuid.UUID        `gorm:"type:uuid;not null;uniqueIndex:idx_todo_notif_type" json:"todo_id"`
	NotificationType NotificationType `gorm:"type:varchar(30);not null;uniqueIndex:idx_todo_notif_type" json:"notification_type"`
	SentAt           time.Time        `gorm:"not null;default:now()" json:"sent_at"`
}

func (d *DeadlineNotification) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
