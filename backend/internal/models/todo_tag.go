package models

import (
	"time"

	"github.com/google/uuid"
)

type TodoTag struct {
	TodoID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"todo_id"`
	TagID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"tag_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (TodoTag) TableName() string {
	return "todo_tags"
}
