package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sasha/2do-backend/internal/middleware"
	"github.com/sasha/2do-backend/internal/models"
	"gorm.io/gorm"
)

type TodoHandler struct {
	db *gorm.DB
}

func NewTodoHandler(db *gorm.DB) *TodoHandler {
	return &TodoHandler{db: db}
}

type todoRequest struct {
	Title       string          `json:"title" binding:"required,max=255"`
	Description string          `json:"description"`
	Priority    models.Priority `json:"priority" binding:"required,oneof=A B C"`
	Deadline    *time.Time      `json:"deadline"`
}

func (h *TodoHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var todos []models.Todo
	q := h.db.Where("user_id = ?", userID)
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	if priority := c.Query("priority"); priority != "" {
		q = q.Where("priority = ?", priority)
	}
	// Sort: A → B → C, then earliest deadline first
	q.Order("CASE priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 ELSE 3 END, deadline ASC NULLS LAST").Find(&todos)
	c.JSON(http.StatusOK, todos)
}

func (h *TodoHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	var req todoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	todo := models.Todo{
		UserID:      userID,
		Title:       req.Title,
		Description: req.Description,
		Priority:    req.Priority,
		Deadline:    req.Deadline,
		Status:      models.StatusPending,
	}
	if err := h.db.Create(&todo).Error; err != nil {
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
	todo.Title = req.Title
	todo.Description = req.Description
	todo.Priority = req.Priority
	todo.Deadline = req.Deadline
	if err := h.db.Save(&todo).Error; err != nil {
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
	c.JSON(http.StatusOK, todo)
}

func (h *TodoHandler) findOwned(c *gin.Context, userID uuid.UUID) (models.Todo, bool) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return models.Todo{}, false
	}
	var todo models.Todo
	if err := h.db.Where("id = ? AND user_id = ?", id, userID).First(&todo).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "todo not found"})
		return models.Todo{}, false
	}
	return todo, true
}
