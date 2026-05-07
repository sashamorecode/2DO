package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Username           string     `gorm:"uniqueIndex;not null;size:50" json:"username"`
	Email              string     `gorm:"uniqueIndex;not null;size:255" json:"email"`
	PasswordHash       string     `gorm:"not null" json:"-"`
	PushToken          *string    `gorm:"size:512" json:"push_token,omitempty"`
	PushTokenUpdatedAt *time.Time `json:"push_token_updated_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

type UserPublic struct {
	ID       uuid.UUID `json:"id"`
	Username string    `json:"username"`
}

func (u *User) ToPublic() UserPublic {
	return UserPublic{ID: u.ID, Username: u.Username}
}
