package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SyncHandler accepts batched offline mutations from the client and upserts
// them by the client-generated ID. The client is the source of truth: whatever
// local state it sends wins, and IDs the client no longer has are deleted.
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

// errSyncOwnership is returned when a client tries to upsert or delete a row
// whose ID already belongs to a different user.
var errSyncOwnership = errors.New("sync resource owned by another user")

// --- request / response types ---

type SyncRequest struct {
	Todos []SyncTodo `json:"todos"`
	Tags  []SyncTag  `json:"tags"`
	// DeletedTodoIDs / DeletedTagIDs are tombstones for rows removed locally.
	// They are deleted server-side, but only when owned by the caller.
	DeletedTodoIDs []string `json:"deleted_todo_ids"`
	DeletedTagIDs  []string `json:"deleted_tag_ids"`
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
	// TagIDs are the client-side tag IDs to associate. A nil slice means
	// "leave associations untouched"; an empty (non-nil) slice clears them.
	TagIDs []string `json:"tag_ids"`
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

	var syncedTags []models.Tag
	var syncedTodos []models.Todo

	err := h.db.Transaction(func(tx *gorm.DB) error {
		// Tags first so todos can reference them in the same request.
		tags, tagRemap, err := h.upsertTags(tx, userID, req.Tags)
		if err != nil {
			return err
		}
		syncedTags = tags

		todos, err := h.upsertTodos(tx, userID, req.Todos, tagRemap)
		if err != nil {
			return err
		}
		syncedTodos = todos

		if err := h.deleteTodos(tx, userID, req.DeletedTodoIDs); err != nil {
			return err
		}
		if err := h.deleteTags(tx, userID, req.DeletedTagIDs); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		if errors.Is(err, errSyncOwnership) {
			c.JSON(http.StatusConflict, gin.H{"error": "sync conflict: resource belongs to another user"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync"})
		return
	}

	c.JSON(http.StatusOK, SyncResponse{Todos: syncedTodos, Tags: syncedTags})
}

// upsertTags writes the client's tags and returns the canonical rows plus a
// remap from client tag IDs to canonical IDs. When a client tag collides with
// an existing tag name (the unique index is per-user + name), the existing row
// is adopted and the client's ID is remapped onto it.
func (h *SyncHandler) upsertTags(tx *gorm.DB, userID uuid.UUID, items []SyncTag) ([]models.Tag, map[uuid.UUID]uuid.UUID, error) {
	result := make([]models.Tag, 0, len(items))
	remap := make(map[uuid.UUID]uuid.UUID, len(items))

	for _, item := range items {
		id, err := uuid.Parse(item.ID)
		if err != nil {
			continue
		}
		name := strings.TrimSpace(item.Name)
		if name == "" {
			continue
		}
		color := strings.ToUpper(strings.TrimSpace(item.Color))

		if err := ensureTagOwnership(tx, id, userID); err != nil {
			return nil, nil, err
		}

		// Adopt an existing tag with the same name instead of violating the
		// unique (user_id, name) index.
		var existing models.Tag
		err = tx.Where("user_id = ? AND LOWER(name) = LOWER(?) AND id <> ?", userID, name, id).
			First(&existing).Error
		if err == nil {
			remap[id] = existing.ID
			existing.Color = color
			if err := tx.Save(&existing).Error; err != nil {
				return nil, nil, err
			}
			result = append(result, existing)
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, err
		}

		tag := models.Tag{ID: id, UserID: userID, Name: name, Color: color}
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"user_id", "name", "color", "updated_at",
			}),
		}).Create(&tag).Error; err != nil {
			return nil, nil, err
		}

		remap[id] = id
		result = append(result, tag)
	}

	return result, remap, nil
}

// upsertTodos writes the client's todos and applies their tag associations.
// tagRemap translates client tag IDs onto canonical IDs from upsertTags.
func (h *SyncHandler) upsertTodos(tx *gorm.DB, userID uuid.UUID, items []SyncTodo, tagRemap map[uuid.UUID]uuid.UUID) ([]models.Todo, error) {
	result := make([]models.Todo, 0, len(items))

	for _, item := range items {
		id, err := uuid.Parse(item.ID)
		if err != nil {
			continue
		}
		if err := ensureTodoOwnership(tx, id, userID); err != nil {
			return nil, err
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
		if t, ok := parseSyncTime(item.Deadline); ok {
			todo.Deadline = t
		}
		if t, ok := parseSyncTime(item.PlannedAt); ok {
			todo.PlannedAt = t
		}
		if t, ok := parseSyncTime(item.CompletedAt); ok {
			todo.CompletedAt = t
		}

		// Upsert by client ID; the client is the source of truth.
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"user_id", "title", "description", "priority",
				"deadline", "planned_at", "is_private",
				"status", "completed_at", "updated_at",
			}),
		}).Create(&todo).Error; err != nil {
			return nil, err
		}

		// nil TagIDs means "not provided" (leave associations alone); an empty
		// but non-nil slice means the client intentionally cleared them.
		if item.TagIDs != nil {
			tags, err := h.ownedTags(tx, userID, item.TagIDs, tagRemap)
			if err != nil {
				return nil, err
			}
			if err := tx.Model(&todo).Association("Tags").Replace(tags); err != nil {
				return nil, err
			}
		}

		var reloaded models.Todo
		if err := tx.Preload("Tags").First(&reloaded, "id = ?", id).Error; err != nil {
			return nil, err
		}
		result = append(result, reloaded)
	}

	return result, nil
}

func (h *SyncHandler) deleteTodos(tx *gorm.DB, userID uuid.UUID, rawIDs []string) error {
	ids := parseSyncIDs(rawIDs)
	if len(ids) == 0 {
		return nil
	}

	// Resolve to IDs actually owned by the caller before touching the join
	// table, so a forged tombstone can never sever another user's rows.
	var owned []models.Todo
	if err := tx.Select("id").Where("id IN ? AND user_id = ?", ids, userID).Find(&owned).Error; err != nil {
		return err
	}
	if len(owned) == 0 {
		return nil
	}
	ownedIDs := make([]uuid.UUID, len(owned))
	for i, t := range owned {
		ownedIDs[i] = t.ID
	}
	if err := tx.Where("todo_id IN ?", ownedIDs).Delete(&models.TodoTag{}).Error; err != nil {
		return err
	}
	return tx.Where("id IN ?", ownedIDs).Delete(&models.Todo{}).Error
}

func (h *SyncHandler) deleteTags(tx *gorm.DB, userID uuid.UUID, rawIDs []string) error {
	ids := parseSyncIDs(rawIDs)
	if len(ids) == 0 {
		return nil
	}

	var owned []models.Tag
	if err := tx.Select("id").Where("id IN ? AND user_id = ?", ids, userID).Find(&owned).Error; err != nil {
		return err
	}
	if len(owned) == 0 {
		return nil
	}
	ownedIDs := make([]uuid.UUID, len(owned))
	for i, t := range owned {
		ownedIDs[i] = t.ID
	}
	if err := tx.Where("tag_id IN ?", ownedIDs).Delete(&models.TodoTag{}).Error; err != nil {
		return err
	}
	return tx.Where("id IN ?", ownedIDs).Delete(&models.Tag{}).Error
}

// ownedTags resolves the given tag IDs to tags owned by userID, translating
// remapped client IDs first. Unknown or foreign IDs are silently dropped.
func (h *SyncHandler) ownedTags(tx *gorm.DB, userID uuid.UUID, rawIDs []string, tagRemap map[uuid.UUID]uuid.UUID) ([]models.Tag, error) {
	seen := make(map[uuid.UUID]struct{}, len(rawIDs))
	ids := make([]uuid.UUID, 0, len(rawIDs))
	for _, raw := range rawIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			continue
		}
		if mapped, ok := tagRemap[id]; ok {
			id = mapped
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return []models.Tag{}, nil
	}

	var tags []models.Tag
	if err := tx.Where("user_id = ? AND id IN ?", userID, ids).Find(&tags).Error; err != nil {
		return nil, err
	}
	return tags, nil
}

func ensureTodoOwnership(tx *gorm.DB, id, userID uuid.UUID) error {
	var existing models.Todo
	err := tx.Select("id", "user_id").Where("id = ?", id).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if existing.UserID != userID {
		return errSyncOwnership
	}
	return nil
}

func ensureTagOwnership(tx *gorm.DB, id, userID uuid.UUID) error {
	var existing models.Tag
	err := tx.Select("id", "user_id").Where("id = ?", id).First(&existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if existing.UserID != userID {
		return errSyncOwnership
	}
	return nil
}

func parseSyncTime(raw *string) (*time.Time, bool) {
	if raw == nil || *raw == "" {
		return nil, false
	}
	t, err := time.Parse(time.RFC3339Nano, *raw)
	if err != nil {
		return nil, false
	}
	return &t, true
}

func parseSyncIDs(rawIDs []string) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(rawIDs))
	for _, raw := range rawIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			continue
		}
		out = append(out, id)
	}
	return out
}
