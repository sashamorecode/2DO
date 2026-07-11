package models

import (
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Tag struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_user_tag_name" json:"user_id"`
	Name      string    `gorm:"not null;size:40;uniqueIndex:idx_user_tag_name" json:"name"`
	Color     string    `gorm:"not null;size:7" json:"color"`
	Todos     []Todo    `gorm:"many2many:todo_tags;" json:"-"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (t *Tag) BeforeCreate(tx *gorm.DB) error {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return nil
}

func (t *Tag) BeforeSave(tx *gorm.DB) error {
	t.Name = strings.TrimSpace(t.Name)
	return nil
}
