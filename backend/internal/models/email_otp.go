package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type EmailOTP struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey"`
	Email      string     `gorm:"index;not null;size:255"`
	CodeHash   string     `gorm:"not null;size:64"`
	ExpiresAt  time.Time  `gorm:"index;not null"`
	ConsumedAt *time.Time
	Attempts   int       `gorm:"not null;default:0"`
	CreatedAt  time.Time `gorm:"index"`
}

func (o *EmailOTP) BeforeCreate(tx *gorm.DB) error {
	if o.ID == uuid.Nil {
		o.ID = uuid.New()
	}
	return nil
}
