package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"github.com/sasha/2do-backend/internal/services"
	"gorm.io/gorm"
)

type TodoHandler struct {
	db    *gorm.DB
	notif *services.NotificationService
}

func NewTodoHandler(db *gorm.DB, notif *services.NotificationService) *TodoHandler {
	return &TodoHandler{db: db, notif: notif}
}

type todoRequest struct {
	Title       string          `json:"title" binding:"required,max=255"`
	Description string          `json:"description"`
	Priority    models.Priority `json:"priority" binding:"required,oneof=A B C"`
	Deadline    *time.Time      `json:"deadline"`
	PlannedAt   *time.Time      `json:"planned_at"`
	IsPrivate   bool            `json:"is_private"`
	TagIDs      []uuid.UUID     `json:"tag_ids"`
}

func (h *TodoHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var todos []models.Todo
	status := c.Query("status")
	q := h.db.Model(&models.Todo{}).Preload("Tags").Where("user_id = ?", userID)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	priority := c.Query("priority")
	if priority == "" {
		var ok bool
		priority, ok = parseUrgency(c.Query("urgency"))
		if c.Query("urgency") != "" && !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid urgency"})
			return
		}
	}
	if priority != "" {
		q = q.Where("priority = ?", priority)
	}

	tagIDs, err := parseTagIDs(c.Query("tag_ids"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tag_ids"})
		return
	}
	if len(tagIDs) > 0 {
		q = q.Joins("JOIN todo_tags ON todo_tags.todo_id = todos.id").Where("todo_tags.tag_id IN ?", tagIDs).Group("todos.id")
	}

	if status == string(models.StatusCompleted) {
		// Most recently finished first
		q = q.Order("completed_at DESC NULLS LAST")
	} else {
		// Pending list: A → B → C, then earliest deadline first
		q = q.Order("CASE priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END, deadline ASC NULLS LAST")
	}
	q.Find(&todos)
	c.JSON(http.StatusOK, todos)
}

func (h *TodoHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req todoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tags, err := h.findOwnedTags(userID, req.TagIDs)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "one or more tags are invalid"})
		return
	}

	todo := models.Todo{
		UserID:      userID,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		Deadline:    req.Deadline,
		PlannedAt:   req.PlannedAt,
		IsPrivate:   req.IsPrivate,
		Status:      models.StatusPending,
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&todo).Error; err != nil {
			return err
		}
		if len(tags) > 0 {
			if err := tx.Model(&todo).Association("Tags").Replace(tags); err != nil {
				return err
			}
		}
		return tx.Preload("Tags").First(&todo, "id = ?", todo.ID).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create todo"})
		return
	}
	c.JSON(http.StatusCreated, todo)
}

func (h *TodoHandler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	todo, ok := h.findOwned(c, userID)
	if !ok {
		return
	}
	c.JSON(http.StatusOK, todo)
}

func (h *TodoHandler) Update(c *gin.Context) {
	userID := middleware.GetUserID(c)
	todo, ok := h.findOwned(c, userID)
	if !ok {
		return
	}
	var req todoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tagsProvided := req.TagIDs != nil
	var tags []models.Tag
	var err error
	if tagsProvided {
		tags, err = h.findOwnedTags(userID, req.TagIDs)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "one or more tags are invalid"})
			return
		}
	}

	todo.Title = req.Title
	todo.Description = req.Description
	todo.Priority = req.Priority
	todo.Deadline = req.Deadline
	todo.PlannedAt = req.PlannedAt
	todo.IsPrivate = req.IsPrivate

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&todo).Error; err != nil {
			return err
		}
		if tagsProvided {
			if err := tx.Model(&todo).Association("Tags").Replace(tags); err != nil {
				return err
			}
		}
		return tx.Preload("Tags").First(&todo, "id = ?", todo.ID).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update todo"})
		return
	}
	c.JSON(http.StatusOK, todo)
}

func (h *TodoHandler) Delete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	todo, ok := h.findOwned(c, userID)
	if !ok {
		return
	}
	h.db.Delete(&todo)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *TodoHandler) Complete(c *gin.Context) {
	userID := middleware.GetUserID(c)
	todo, ok := h.findOwned(c, userID)
	if !ok {
		return
	}
	now := time.Now()
	todo.Status = models.StatusCompleted
	todo.CompletedAt = &now
	if err := h.db.Save(&todo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete todo"})
		return
	}
	h.db.Preload("Tags").First(&todo, "id = ?", todo.ID)
	c.JSON(http.StatusOK, todo)
}

func (h *TodoHandler) Reopen(c *gin.Context) {
	userID := middleware.GetUserID(c)
	todo, ok := h.findOwned(c, userID)
	if !ok {
		return
	}
	todo.Status = models.StatusPending
	todo.CompletedAt = nil
	if err := h.db.Save(&todo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to reopen todo"})
		return
	}
	h.db.Preload("Tags").First(&todo, "id = ?", todo.ID)
	c.JSON(http.StatusOK, todo)
}

func (h *TodoHandler) Poke(c *gin.Context) {
	userID := middleware.GetUserID(c)
	todoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var todo models.Todo
	if err := h.db.Where("id = ?", todoID).First(&todo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "todo not found"})
		return
	}

	if todo.UserID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "you cannot poke your own task"})
		return
	}

	if todo.IsPrivate {
		c.JSON(http.StatusForbidden, gin.H{"error": "task is private"})
		return
	}

	if todo.Status != models.StatusPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only pending tasks can be poked"})
		return
	}

	if !h.areFriends(userID, todo.UserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "you can only poke a friend's task"})
		return
	}

	if h.notif == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "notifications are unavailable"})
		return
	}

	var sender models.User
	if err := h.db.Select("id", "username").First(&sender, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load sender"})
		return
	}

	var owner models.User
	if err := h.db.Select("id", "push_token").First(&owner, "id = ?", todo.UserID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load task owner"})
		return
	}

	senderName := "A friend"
	if sender.Username != nil && *sender.Username != "" {
		senderName = *sender.Username
	}

	ownerPushToken := ""
	if owner.PushToken != nil {
		ownerPushToken = *owner.PushToken
	}

	if err := h.notif.SendTaskPoke(ownerPushToken, senderName, todo.Title); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send poke"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *TodoHandler) findOwned(c *gin.Context, userID uuid.UUID) (models.Todo, bool) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return models.Todo{}, false
	}
	var todo models.Todo
	if err := h.db.Preload("Tags").Where("id = ? AND user_id = ?", id, userID).First(&todo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "todo not found"})
		return models.Todo{}, false
	}
	return todo, true
}

func (h *TodoHandler) findOwnedTags(userID uuid.UUID, tagIDs []uuid.UUID) ([]models.Tag, error) {
	if len(tagIDs) == 0 {
		return []models.Tag{}, nil
	}

	uniq := make(map[uuid.UUID]struct{}, len(tagIDs))
	ids := make([]uuid.UUID, 0, len(tagIDs))
	for _, id := range tagIDs {
		if id == uuid.Nil {
			return nil, gorm.ErrRecordNotFound
		}
		if _, exists := uniq[id]; exists {
			continue
		}
		uniq[id] = struct{}{}
		ids = append(ids, id)
	}

	var tags []models.Tag
	if err := h.db.Where("user_id = ? AND id IN ?", userID, ids).Find(&tags).Error; err != nil {
		return nil, err
	}
	if len(tags) != len(ids) {
		return nil, gorm.ErrRecordNotFound
	}
	return tags, nil
}

func parseTagIDs(raw string) ([]uuid.UUID, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	parts := strings.Split(trimmed, ",")
	out := make([]uuid.UUID, 0, len(parts))
	for _, part := range parts {
		id, err := uuid.Parse(strings.TrimSpace(part))
		if err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, nil
}

func parseUrgency(raw string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "all":
		return "", true
	case "a", "high", "urgent":
		return string(models.PriorityA), true
	case "b", "medium", "med":
		return string(models.PriorityB), true
	case "c", "low":
		return string(models.PriorityC), true
	default:
		return "", false
	}
}

func (h *TodoHandler) areFriends(userID, otherUserID uuid.UUID) bool {
	var count int64
	h.db.Model(&models.Friendship{}).
		Where(
			"((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)) AND status = ?",
			userID, otherUserID, otherUserID, userID, models.FriendshipAccepted,
		).
		Count(&count)
	return count > 0
}
