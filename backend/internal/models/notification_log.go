package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NotificationType string

const (
	NotificationWarning6h    NotificationType = "warning_6h"
	NotificationDeadlineMiss NotificationType = "deadline_missed"
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
