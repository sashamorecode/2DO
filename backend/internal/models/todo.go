package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Priority string

const (
	PriorityA Priority = "A"
	PriorityB Priority = "B"
	PriorityC Priority = "C"
)

type TodoStatus string

const (
	StatusPending   TodoStatus = "pending"
	StatusCompleted TodoStatus = "completed"
)

type Todo struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID      uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	User        *User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Title       string     `gorm:"not null;size:255" json:"title"`
	Description string     `gorm:"type:text" json:"description"`
	Priority    Priority   `gorm:"type:varchar(1);not null" json:"priority"`
	Deadline    *time.Time `json:"deadline"`
	Status      TodoStatus `gorm:"type:varchar(20);not null;default:pending" json:"status"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

func (t *Todo) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}
