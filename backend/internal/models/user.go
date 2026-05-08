package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Username           *string    `gorm:"uniqueIndex;size:50" json:"username"`
	Email              string     `gorm:"uniqueIndex;not null;size:255" json:"email"`
	GoogleSub          *string    `gorm:"size:255" json:"-"`
	PushToken          *string    `gorm:"size:512" json:"push_token,omitempty"`
	PushTokenUpdatedAt *time.Time `json:"push_token_updated_at,omitempty"`
	Timezone           string     `gorm:"size:64;not null;default:'UTC'" json:"timezone"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// UserPublic is the user payload safe to expose to other users
// (friends list, friend search, feed). Email is intentionally omitted.
type UserPublic struct {
	ID       uuid.UUID `json:"id"`
	Username *string   `json:"username"`
}

func (u *User) ToPublic() UserPublic {
	return UserPublic{ID: u.ID, Username: u.Username}
}

// UserMe is the user's own payload — includes email since they own it.
type UserMe struct {
	ID       uuid.UUID `json:"id"`
	Username *string   `json:"username"`
	Email    string    `json:"email"`
	Timezone string    `json:"timezone"`
}

func (u *User) ToMe() UserMe {
	return UserMe{ID: u.ID, Username: u.Username, Email: u.Email, Timezone: u.Timezone}
}
