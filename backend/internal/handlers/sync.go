package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SyncHandler accepts batched offline mutations from the client and upserts
// them unconditionally — the client's version always wins.
//
// SINGLE-DEVICE ASSUMPTION: this endpoint trusts the client's state completely.
// If a user were to run the app on two devices simultaneously, the last one to
// sync would overwrite the other's changes with no conflict resolution.
// Multi-device support would require vector clocks, CRDTs, or explicit
// per-field merging based on client_updated_at timestamps.

type SyncHandler struct {
	db *gorm.DB
}

func NewSyncHandler(db *gorm.DB) *SyncHandler {
	return &SyncHandler{db: db}
}

// --- request / response types ---

type SyncRequest struct {
	Todos []SyncTodo `json:"todos"`
	Tags  []SyncTag  `json:"tags"`
}

type SyncTodo struct {
	ID          string  `json:"id" binding:"required"`
	Title       string  `json:"title" binding:"required,max=255"`
	Description string  `json:"description"`
	Priority    string  `json:"priority" binding:"required,oneof=A B C"`
	Deadline    *string `json:"deadline"`
	PlannedAt   *string `json:"planned_at"`
	IsPrivate   bool    `json:"is_private"`
	Status      string  `json:"status" binding:"required,oneof=pending completed"`
	CompletedAt *string `json:"completed_at"`
	// ClientUpdatedAt is the ISO-8601 timestamp of the last local modification.
	// Stored for audit/debugging; not used for conflict resolution (local-wins).
	ClientUpdatedAt string `json:"client_updated_at"`
}

type SyncTag struct {
	ID              string `json:"id" binding:"required"`
	Name            string `json:"name" binding:"required,max=40"`
	Color           string `json:"color" binding:"required"`
	ClientUpdatedAt string `json:"client_updated_at"`
}

type SyncResponse struct {
	Todos []models.Todo `json:"todos"`
	Tags  []models.Tag  `json:"tags"`
}

// --- handler ---

func (h *SyncHandler) Sync(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req SyncRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var syncedTodos []models.Todo
	var syncedTags []models.Tag

	// Process todos in a transaction.
	if len(req.Todos) > 0 {
		todos, err := h.upsertTodos(userID, req.Todos)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync todos"})
			return
		}
		syncedTodos = todos
	}

	// Process tags in a transaction.
	if len(req.Tags) > 0 {
		tags, err := h.upsertTags(userID, req.Tags)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync tags"})
			return
		}
		syncedTags = tags
	}

	c.JSON(http.StatusOK, SyncResponse{
		Todos: syncedTodos,
		Tags:  syncedTags,
	})
}

func (h *SyncHandler) upsertTodos(userID uuid.UUID, items []SyncTodo) ([]models.Todo, error) {
	result := make([]models.Todo, 0, len(items))

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			id, err := uuid.Parse(item.ID)
			if err != nil {
				return err
			}

			todo := models.Todo{
				ID:          id,
				UserID:      userID,
				Title:       item.Title,
				Description: item.Description,
				Priority:    models.Priority(item.Priority),
				IsPrivate:   item.IsPrivate,
				Status:      models.TodoStatus(item.Status),
			}

			if item.Deadline != nil {
				t, err := time.Parse(time.RFC3339Nano, *item.Deadline)
				if err == nil {
					todo.Deadline = &t
				}
			}
			if item.PlannedAt != nil {
				t, err := time.Parse(time.RFC3339Nano, *item.PlannedAt)
				if err == nil {
					todo.PlannedAt = &t
				}
			}
			if item.CompletedAt != nil {
				t, err := time.Parse(time.RFC3339Nano, *item.CompletedAt)
				if err == nil {
					todo.CompletedAt = &t
				}
			}

			// Upsert: INSERT ON CONFLICT (id) DO UPDATE.
			// All fields from the client are applied unconditionally.
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				UpdateAll: true,
			}).Create(&todo).Error; err != nil {
				return err
			}

			// Reload to get the server's current view (includes tags, timestamps).
			var reloaded models.Todo
			if err := tx.Preload("Tags").First(&reloaded, "id = ?", todo.ID).Error; err != nil {
				return err
			}
			result = append(result, reloaded)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return result, nil
}

func (h *SyncHandler) upsertTags(userID uuid.UUID, items []SyncTag) ([]models.Tag, error) {
	result := make([]models.Tag, 0, len(items))

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			id, err := uuid.Parse(item.ID)
			if err != nil {
				return err
			}

			tag := models.Tag{
				ID:     id,
				UserID: userID,
				Name:   item.Name,
				Color:  item.Color,
			}

			// Upsert by ID.
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "id"}},
				UpdateAll: true,
			}).Create(&tag).Error; err != nil {
				return err
			}

			var reloaded models.Tag
			if err := tx.First(&reloaded, "id = ?", tag.ID).Error; err != nil {
				return err
			}
			result = append(result, reloaded)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}
	return result, nil
}
