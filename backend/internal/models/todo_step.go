package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TodoStep struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TodoID    uuid.UUID `gorm:"type:uuid;not null;index" json:"-"`
	Name      string    `gorm:"not null;size:255" json:"name"`
	Completed bool      `gorm:"not null;default:false" json:"completed"`
	Position  int       `gorm:"not null" json:"position"`
	CreatedAt time.Time `json:"-"`
	UpdatedAt time.Time `json:"-"`
}

func (s *TodoStep) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

func (s *TodoStep) BeforeSave(tx *gorm.DB) error {
	s.Name = strings.TrimSpace(s.Name)
	return nil
}
