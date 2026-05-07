package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FriendshipStatus string

const (
	FriendshipPending  FriendshipStatus = "pending"
	FriendshipAccepted FriendshipStatus = "accepted"
	FriendshipDeclined FriendshipStatus = "declined"
)

type Friendship struct {
	ID          uuid.UUID        `gorm:"type:uuid;primaryKey" json:"id"`
	RequesterID uuid.UUID        `gorm:"type:uuid;not null" json:"requester_id"`
	Requester   *User            `gorm:"foreignKey:RequesterID" json:"requester,omitempty"`
	AddresseeID uuid.UUID        `gorm:"type:uuid;not null" json:"addressee_id"`
	Addressee   *User            `gorm:"foreignKey:AddresseeID" json:"addressee,omitempty"`
	Status      FriendshipStatus `gorm:"type:varchar(20);not null;default:pending" json:"status"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

func (f *Friendship) BeforeCreate(tx *gorm.DB) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	return nil
}
