package handlers

import (
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/gorm"
)

type stepInput struct {
	Name      string `json:"name"`
	Completed bool   `json:"completed"`
}

func orderTodoSteps(tx *gorm.DB) *gorm.DB {
	return tx.Order("position ASC")
}

// replaceTodoSteps leaves steps untouched when omitted and clears them when
// inputs is empty. The caller supplies a transaction for atomic replacement.
func replaceTodoSteps(tx *gorm.DB, todoID uuid.UUID, inputs *[]stepInput) error {
	if inputs == nil {
		return nil
	}
	if err := tx.Where("todo_id = ?", todoID).Delete(&models.TodoStep{}).Error; err != nil {
		return err
	}

	steps := make([]models.TodoStep, 0, len(*inputs))
	for position, input := range *inputs {
		steps = append(steps, models.TodoStep{
			TodoID:    todoID,
			Name:      input.Name,
			Completed: input.Completed,
			Position:  position,
		})
	}
	if len(steps) == 0 {
		return nil
	}
	return tx.Create(&steps).Error
}
