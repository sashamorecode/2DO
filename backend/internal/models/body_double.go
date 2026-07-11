package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BodyDoubleStatus string

const (
	BodyDoublePending  BodyDoubleStatus = "pending"
	BodyDoubleAccepted BodyDoubleStatus = "accepted"
	BodyDoubleMaybe    BodyDoubleStatus = "maybe"
	BodyDoubleDeclined BodyDoubleStatus = "declined"
)

type BodyDoubleSession struct {
	ID          uuid.UUID                 `gorm:"type:uuid;primaryKey" json:"id"`
	RequesterID uuid.UUID                 `gorm:"type:uuid;not null;index" json:"requester_id"`
	Requester   *User                     `gorm:"foreignKey:RequesterID" json:"requester,omitempty"`
	TodoID      *uuid.UUID                `gorm:"type:uuid;index" json:"todo_id,omitempty"`
	Todo        *Todo                     `gorm:"foreignKey:TodoID" json:"todo,omitempty"`
	Message     *string                   `gorm:"type:text" json:"message,omitempty"`
	ScheduledAt time.Time                 `gorm:"not null" json:"scheduled_at"`
	CreatedAt   time.Time                 `json:"created_at"`
	UpdatedAt   time.Time                 `json:"updated_at"`
	Invitations []BodyDoubleInvitation    `gorm:"-" json:"invitations,omitempty"`
}

func (s *BodyDoubleSession) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

type BodyDoubleInvitation struct {
	ID        uuid.UUID           `gorm:"type:uuid;primaryKey" json:"id"`
	SessionID uuid.UUID           `gorm:"type:uuid;not null;uniqueIndex:idx_session_invitee" json:"session_id"`
	Session   *BodyDoubleSession  `gorm:"foreignKey:SessionID" json:"session,omitempty"`
	InviteeID uuid.UUID           `gorm:"type:uuid;not null;uniqueIndex:idx_session_invitee" json:"invitee_id"`
	Invitee   *User               `gorm:"foreignKey:InviteeID" json:"invitee,omitempty"`
	Status    BodyDoubleStatus    `gorm:"type:varchar(20);not null;default:pending" json:"status"`
	CreatedAt time.Time           `json:"created_at"`
	UpdatedAt time.Time           `json:"updated_at"`
}

func (i *BodyDoubleInvitation) BeforeCreate(tx *gorm.DB) error {
	if i.ID == uuid.Nil {
		i.ID = uuid.New()
	}
	return nil
}
